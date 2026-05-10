/**
 * 语音模块 DTO
 * Feature: 20260508-voice-interaction-feature
 *
 * WebSocket 消息数据传输对象
 */

import { IsString, IsOptional, IsIn, IsBase64 } from 'class-validator';

/** 开始会话 DTO */
export class StartSessionDto {
  @IsString()
  @IsOptional()
  @IsIn(['cn', 'jp', 'us', 'es'], {
    message: 'language must be one of: cn, jp, us, es',
  })
  language?: string;

  @IsString()
  @IsOptional()
  scenario?: string;
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
