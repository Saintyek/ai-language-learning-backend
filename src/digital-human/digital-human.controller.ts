import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DigitalHumanService } from './digital-human.service';
import { TrainDigitalHumanDto } from './dto/train-digital-human.dto';
import { DigitalHumanStatusQueryDto } from './dto/digital-human-status-query.dto';
import { DigitalHumanStatusResponseDto } from './dto/digital-human-status-response.dto';

@ApiTags('digital-human')
@Controller('digital-human')
export class DigitalHumanController {
  constructor(private readonly digitalHumanService: DigitalHumanService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询数字人状态' })
  @ApiQuery({
    name: 'langCode',
    required: false,
    description: '已忽略，当前所有语言共用同一个数字人',
  })
  @ApiOkResponse({
    description: '查询成功',
    type: DigitalHumanStatusResponseDto,
  })
  async getStatus(@Query() query: DigitalHumanStatusQueryDto) {
    void query;
    const data = await this.digitalHumanService.getStatus();
    return {
      message: '查询成功',
      data,
    };
  }

  @Post('train')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '提交数字人训练任务' })
  @ApiBody({ type: TrainDigitalHumanDto })
  @ApiCreatedResponse({
    description: '训练任务已提交',
    type: DigitalHumanStatusResponseDto,
  })
  async train(@Body() dto: TrainDigitalHumanDto) {
    const data = await this.digitalHumanService.train(dto);
    return {
      message: '训练任务已提交',
      data,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新数字人训练结果' })
  @ApiBody({ schema: { properties: { langCode: { type: 'string', example: 'gb' } } } })
  @ApiOkResponse({
    description: '刷新成功',
    type: DigitalHumanStatusResponseDto,
  })
  async refresh(@Body('langCode') langCode: string = 'gb') {
    void langCode;
    const data = await this.digitalHumanService.refresh();
    return {
      message: '刷新成功',
      data,
    };
  }
}
