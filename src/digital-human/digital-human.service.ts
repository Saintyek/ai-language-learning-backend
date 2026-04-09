import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { DigitalHuman, DigitalHumanStatus } from './digital-human.entity';
import { TrainDigitalHumanDto } from './dto/train-digital-human.dto';
import { DigitalHumanStatusResponseDto } from './dto/digital-human-status-response.dto';

interface VolcengineResponse<T> {
  code: number;
  message: string;
  request_id?: string;
  data: T | null;
}

interface SubmitTaskData {
  task_id: string;
}

interface GetResultData {
  status?: string;
  resp_data?: string;
}

interface TrainingResultPayload {
  resource_id?: string;
  frontend_pic?: string;
}

const VOLCENGINE_HOST = 'visual.volcengineapi.com';
const VOLCENGINE_PATH = '/';
const VOLCENGINE_SERVICE = 'cv';
const VOLCENGINE_REGION = 'cn-north-1';
const VOLCENGINE_VERSION = '2022-08-31';
const VOLCENGINE_REQ_KEY = 'realman_avatar_training_task_streaming';
const SHARED_DIGITAL_HUMAN_LANG_CODE = 'shared';

@Injectable()
export class DigitalHumanService implements OnModuleInit {
  constructor(
    @InjectRepository(DigitalHuman)
    private readonly digitalHumanRepository: Repository<DigitalHuman>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const defaultVid = this.configService.get<string>('DIGITAL_HUMAN_DEFAULT_VID');

    if (!defaultVid) {
      return;
    }

    const existingRecord = await this.digitalHumanRepository.findOne({
      where: { langCode: SHARED_DIGITAL_HUMAN_LANG_CODE },
    });

    if (existingRecord) {
      return;
    }

    await this.digitalHumanRepository.save(
      this.digitalHumanRepository.create({
        langCode: SHARED_DIGITAL_HUMAN_LANG_CODE,
        vid: defaultVid,
        alphaVid: null,
        taskId: null,
        resourceId: null,
        frontendPicUrl: null,
        lastError: null,
        status: 'not_created',
        interactionOptimise: true,
      }),
    );
  }

  async getStatus(): Promise<DigitalHumanStatusResponseDto> {
    const record = await this.digitalHumanRepository.findOne({
      where: { langCode: SHARED_DIGITAL_HUMAN_LANG_CODE },
    });

    if (!record) {
      return { status: 'not_created' };
    }

    if (!record.taskId) {
      return this.toStatusResponse(record);
    }

    return this.toStatusResponse(record);
  }

  async train(
    dto: TrainDigitalHumanDto,
  ): Promise<DigitalHumanStatusResponseDto> {
    this.ensureCredentials();

    const existing = await this.digitalHumanRepository.findOne({
      where: { langCode: SHARED_DIGITAL_HUMAN_LANG_CODE },
    });

    const submitResult = await this.submitTrainingTask(dto);

    const entity = this.digitalHumanRepository.create({
      id: existing?.id,
      langCode: SHARED_DIGITAL_HUMAN_LANG_CODE,
      vid: dto.vid,
      alphaVid: dto.alphaVid ?? null,
      taskId: submitResult.task_id,
      status: 'training',
      resourceId: null,
      frontendPicUrl: null,
      lastError: null,
      interactionOptimise: dto.interactionOptimise ?? true,
    });

    const savedRecord = await this.digitalHumanRepository.save(entity);
    return this.toStatusResponse(savedRecord);
  }

  async refresh(): Promise<DigitalHumanStatusResponseDto> {
    const record = await this.digitalHumanRepository.findOne({
      where: { langCode: SHARED_DIGITAL_HUMAN_LANG_CODE },
    });

    if (!record) {
      throw new NotFoundException('未找到该语言对应的数字人任务');
    }

    if (!record.taskId) {
      return this.toStatusResponse(record);
    }

    await this.refreshTaskResult(record);

    const updatedRecord = await this.digitalHumanRepository.findOne({
      where: { id: record.id },
    });

    return this.toStatusResponse(updatedRecord ?? record);
  }

  private async submitTrainingTask(
    dto: TrainDigitalHumanDto,
  ): Promise<SubmitTaskData> {
    const response = await this.callVolcengine<SubmitTaskData>('CVSubmitTask', {
      req_key: VOLCENGINE_REQ_KEY,
      vid: dto.vid,
      alpha_vid: dto.alphaVid,
      interaction_optimise: dto.interactionOptimise === false ? 0 : 1,
    });

    if (!response.data?.task_id) {
      throw new BadGatewayException('火山引擎未返回 task_id');
    }

    return response.data;
  }

  private async refreshTaskResult(record: DigitalHuman): Promise<void> {
    this.ensureCredentials();

    const response = await this.callVolcengine<GetResultData>('CVGetResult', {
      req_key: VOLCENGINE_REQ_KEY,
      task_id: record.taskId,
    });

    const nextStatus = this.mapTaskStatus(response.data?.status);
    const nextFields: Partial<DigitalHuman> = {
      status: nextStatus,
      lastError: response.code === 10000 ? null : response.message,
    };

    const payload = this.parseRespData(response.data?.resp_data);
    if (payload.resource_id) {
      nextFields.resourceId = payload.resource_id;
    }
    if (payload.frontend_pic) {
      nextFields.frontendPicUrl = payload.frontend_pic;
      nextFields.status = 'ready';
    }

    if (response.code !== 10000) {
      nextFields.status = 'failed';
      nextFields.lastError = `${response.code}: ${response.message}`;
    }

    await this.digitalHumanRepository.update(record.id, nextFields);
  }

  private async callVolcengine<T>(
    action: string,
    body: Record<string, unknown>,
  ): Promise<VolcengineResponse<T>> {
    const accessKey = this.configService.get<string>('VOLCENGINE_ACCESS_KEY');
    const secretKey = this.configService.get<string>('VOLCENGINE_SECRET_KEY');

    if (!accessKey || !secretKey) {
      throw new InternalServerErrorException('缺少火山引擎凭证配置');
    }

    const method = 'POST';
    const query = new URLSearchParams({
      Action: action,
      Version: VOLCENGINE_VERSION,
    });
    const bodyString = JSON.stringify(
      Object.fromEntries(
        Object.entries(body).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      ),
    );
    const bodyHash = this.sha256(bodyString);
    const now = new Date();
    const xDate = this.formatXDate(now);
    const shortDate = xDate.slice(0, 8);
    const signedHeaders = 'content-type;host;x-content-sha256;x-date';
    const canonicalHeaders = [
      `content-type:application/json`,
      `host:${VOLCENGINE_HOST}`,
      `x-content-sha256:${bodyHash}`,
      `x-date:${xDate}`,
    ].join('\n');
    const canonicalRequest = [
      method,
      VOLCENGINE_PATH,
      query.toString(),
      canonicalHeaders,
      '',
      signedHeaders,
      bodyHash,
    ].join('\n');
    const credentialScope = `${shortDate}/${VOLCENGINE_REGION}/${VOLCENGINE_SERVICE}/request`;
    const stringToSign = [
      'HMAC-SHA256',
      xDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');
    const signingKey = this.getSigningKey(secretKey, shortDate);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');
    const authorization = `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(
      `https://${VOLCENGINE_HOST}${VOLCENGINE_PATH}?${query.toString()}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          Host: VOLCENGINE_HOST,
          'X-Date': xDate,
          'X-Content-Sha256': bodyHash,
          Authorization: authorization,
        },
        body: bodyString,
      },
    );

    const result = (await response.json()) as VolcengineResponse<T>;

    if (!response.ok) {
      throw new BadGatewayException(result.message || '火山引擎请求失败');
    }

    return result;
  }

  private ensureCredentials(): void {
    const accessKey = this.configService.get<string>('VOLCENGINE_ACCESS_KEY');
    const secretKey = this.configService.get<string>('VOLCENGINE_SECRET_KEY');

    if (!accessKey || !secretKey) {
      throw new InternalServerErrorException(
        '请先配置 VOLCENGINE_ACCESS_KEY 和 VOLCENGINE_SECRET_KEY',
      );
    }
  }

  private toStatusResponse(
    record: DigitalHuman,
  ): DigitalHumanStatusResponseDto {
    return {
      status: record.status,
      frontendPicUrl: record.frontendPicUrl ?? undefined,
      resourceId: record.resourceId ?? undefined,
    };
  }

  private mapTaskStatus(taskStatus?: string): DigitalHumanStatus {
    if (taskStatus === 'done') {
      return 'ready';
    }

    if (taskStatus === 'failed') {
      return 'failed';
    }

    if (
      taskStatus === 'queueing' ||
      taskStatus === 'running' ||
      taskStatus === 'processing'
    ) {
      return 'training';
    }

    return 'training';
  }

  private parseRespData(respData?: string): TrainingResultPayload {
    if (!respData) {
      return {};
    }

    try {
      return JSON.parse(respData) as TrainingResultPayload;
    } catch {
      return {};
    }
  }

  private sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private formatXDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  private getSigningKey(secretKey: string, shortDate: string): Buffer {
    const kDate = createHmac('sha256', secretKey).update(shortDate).digest();
    const kRegion = createHmac('sha256', kDate)
      .update(VOLCENGINE_REGION)
      .digest();
    const kService = createHmac('sha256', kRegion)
      .update(VOLCENGINE_SERVICE)
      .digest();
    return createHmac('sha256', kService).update('request').digest();
  }
}
