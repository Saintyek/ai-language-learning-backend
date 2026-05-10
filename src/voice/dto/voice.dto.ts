/**
 * 语音模块 DTO
 * Feature: 20260508-voice-interaction-feature
 *
 * WebSocket 消息数据传输对象
 */

import {
  IsString,
  IsOptional,
  IsIn,
  IsBase64,
  IsBoolean,
} from 'class-validator';

/** 开始会话 DTO */
export class StartSessionDto {
  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  @IsIn(['cn', 'jp', 'us', 'es'], {
    message: 'language must be one of: cn, jp, us, es',
  })
  language?: string;

  @IsString()
  @IsOptional()
  scenario?: string;

  @IsBoolean()
  @IsOptional()
  pronunciationAnalysisEnabled?: boolean;
}

/** 音频数据 DTO */
export class AudioDto {
  @IsBase64()
  data: string;
}

/** 文本消息 DTO */
export class TextDto {
  @IsString()
  content: string;
}
