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
}
