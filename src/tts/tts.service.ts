import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTSConnectionConfig,
  DEFAULT_TTS_CONFIG,
  TTSHttpRequest,
  TTSHttpResponse,
  TTS_ERROR_CODES,
  TtsLanguageCode,
  mapLanguageCode,
} from './interfaces/volcengine-tts.interface';

const TTS_HTTP_URL =
  'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

@Injectable()
export class TtsService implements OnModuleDestroy {
  private config: TTSConnectionConfig;
  private audioCallbacks: Set<(audio: string) => void> = new Set();
  private errorCallbacks: Set<(error: string) => void> = new Set();
  private textBuffer: string = '';
  private isProcessing: boolean = false;
  private sentenceEndRegex: RegExp = /[。！？.!?，,]/; // 包含逗号以实现更短的语音片段
  private maxBufferLength: number = 50; // 降低缓冲区长度以更快发送
  private pendingFlush: boolean = false; // 标记是否有待处理的刷新请求
  private currentLanguage: TtsLanguageCode | undefined = undefined; // 当前语言

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('VOLCENGINE_TTS_API_KEY');
    const resourceId = this.configService.get<string>(
      'VOLCENGINE_TTS_RESOURCE_ID',
    );

    if (!apiKey || !resourceId) {
      throw new Error(
        'Missing TTS configuration: VOLCENGINE_TTS_API_KEY or VOLCENGINE_TTS_RESOURCE_ID',
      );
    }

    this.config = {
      apiKey,
      resourceId,
      speaker:
        this.configService.get<string>('VOLCENGINE_TTS_DEFAULT_SPEAKER') ||
        DEFAULT_TTS_CONFIG.speaker,
      format: DEFAULT_TTS_CONFIG.format,
      sampleRate: DEFAULT_TTS_CONFIG.sampleRate,
      bitRate: DEFAULT_TTS_CONFIG.bitRate,
    };
  }

  async onModuleDestroy() {
    this.audioCallbacks.clear();
    this.errorCallbacks.clear();
  }

  /**
   * 设置当前语言（用于 TTS 合成）
   * @param langCode 前端语言代码: cn, jp, us, es
   */
  setLanguage(langCode: string | undefined): void {
    this.currentLanguage = mapLanguageCode(langCode);
    console.log(
      '[TTS] Language set to:',
      this.currentLanguage,
      '(from',
      langCode,
      ')',
    );
  }

  /**
   * 发送文本进行语音合成 (流式)
   * 累积文本，检测句子边界后发送到 TTS API
   */
  async sendText(text: string): Promise<void> {
    this.textBuffer += text;

    // 检测句子结束符
    if (
      this.sentenceEndRegex.test(this.textBuffer) ||
      this.textBuffer.length >= this.maxBufferLength
    ) {
      await this.flushBuffer();
    }
  }

  /**
   * 刷新缓冲区，发送累积的文本到 TTS API
   */
  async flushBuffer(): Promise<void> {
    if (!this.textBuffer.trim()) {
      return;
    }

    // 如果正在处理，标记需要刷新，稍后处理
    if (this.isProcessing) {
      this.pendingFlush = true;
      return;
    }

    const textToSend = this.textBuffer.trim();
    this.textBuffer = '';
    this.isProcessing = true;

    try {
      await this.synthesizeText(textToSend);
    } finally {
      this.isProcessing = false;

      // 处理等待中的刷新请求
      if (this.pendingFlush && this.textBuffer.trim()) {
        this.pendingFlush = false;
        // 递归处理剩余缓冲区
        await this.flushBuffer();
      }
    }
  }

  /**
   * 完成 TTS 合成 (刷新剩余缓冲区)
   */
  async finish(): Promise<void> {
    // 重置 pendingFlush 标记，确保最后的刷新不会被跳过
    this.pendingFlush = false;
    await this.flushBuffer();

    // 如果仍在处理中，等待完成
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * 调用 HTTP API 进行语音合成
   */
  private async synthesizeText(text: string): Promise<void> {
    console.log(
      '[TTS] Sending text to HTTP API:',
      text.substring(0, 50) + '...',
      'language:',
      this.currentLanguage,
    );

    // 构建基础请求体
    const reqParams: TTSHttpRequest['req_params'] = {
      text,
      speaker: this.config.speaker!,
      audio_params: {
        format: this.config.format!,
        sample_rate: this.config.sampleRate!,
        bit_rate: this.config.bitRate,
      },
    };

    // 添加语言参数（additions 需要是 JSON 字符串格式）
    if (this.currentLanguage) {
      reqParams.additions = JSON.stringify({
        explicit_language: this.currentLanguage,
      });
    }

    const requestBody: TTSHttpRequest = {
      user: {
        uid: 'tts-service',
      },
      req_params: reqParams,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(TTS_HTTP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.config.apiKey,
          'X-Api-Resource-Id': this.config.resourceId,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // 处理流式响应
      await this.handleStreamResponse(response.body);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.error('[TTS] Request timeout');
        this.handleError('TTS request timeout');
      } else {
        console.error('[TTS] HTTP API error:', error);
        this.handleError(
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamResponse(
    stream: ReadableStream<Uint8Array>,
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 处理剩余的缓冲区
          if (buffer.trim()) {
            this.parseResponseLine(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // 尝试解析完整的 JSON 对象
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.trim()) {
            this.parseResponseLine(line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 解析响应行
   */
  private parseResponseLine(line: string): void {
    try {
      const response: TTSHttpResponse = JSON.parse(line);

      if (response.code === 0 && response.data) {
        // 音频数据
        this.audioCallbacks.forEach((cb) => cb(response.data!));
      } else if (response.code === TTS_ERROR_CODES.SUCCESS) {
        // 合成结束
        console.log('[TTS] Synthesis completed');
      } else {
        // 错误
        console.error('[TTS] API error:', response.code, response.message);
        this.handleError(
          `TTS API error: ${response.code} - ${response.message}`,
        );
      }
    } catch (error) {
      // 解析失败，可能是部分数据，忽略
      console.warn(
        '[TTS] Failed to parse response line:',
        line.substring(0, 100),
      );
    }
  }

  /**
   * 注册音频回调
   */
  onAudio(callback: (audio: string) => void): () => void {
    this.audioCallbacks.add(callback);
    return () => this.audioCallbacks.delete(callback);
  }

  /**
   * 注册错误回调
   */
  onError(callback: (error: string) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * 处理错误
   */
  private handleError(message: string): void {
    console.error('[TTS] Error:', message);
    this.errorCallbacks.forEach((cb) => cb(message));
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(TTS_HTTP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.config.apiKey,
          'X-Api-Resource-Id': this.config.resourceId,
        },
        body: JSON.stringify({
          user: { uid: 'health-check' },
          req_params: {
            text: 'test',
            speaker: this.config.speaker!,
            audio_params: {
              format: this.config.format!,
              sample_rate: this.config.sampleRate!,
            },
          },
        }),
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
