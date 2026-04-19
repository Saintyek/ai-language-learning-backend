import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { LanguageCode } from '../prompts/index';

class ChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant'], example: 'user' })
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty({ example: '你好，请帮我纠正这句英文。' })
  @IsString()
  content: string;

  @ApiProperty({ required: false, example: 'msg_1' })
  @IsOptional()
  @IsString()
  id?: string;
}

export class ChatStreamRequestDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiProperty({
    required: false,
    example: 'role/扮演老师',
    description: '场景标识，格式为 "一级场景/二级场景"',
  })
  @IsOptional()
  @IsString()
  scenario?: string;

  @ApiProperty({
    required: false,
    enum: ['cn', 'jp', 'kr', 'us'],
    example: 'us',
    description: '目标学习语言：cn-中文, jp-日文, kr-韩语, us-美式英语',
  })
  @IsOptional()
  @IsString()
  @IsIn(['cn', 'jp', 'kr', 'us'])
  language?: LanguageCode;

  @ApiProperty({
    required: false,
    example: '1',
    description: '会话ID，如果传了则会保存消息到该会话',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
