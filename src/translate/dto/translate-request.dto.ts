import { IsString, IsOptional, MaxLength } from 'class-validator';

export class TranslateRequestDto {
  @IsString()
  @MaxLength(1000, { message: '文本长度不能超过1000个字符' })
  text: string;

  @IsOptional()
  @IsString()
  sourceLanguage?: string;

  @IsOptional()
  @IsString()
  targetLanguage?: string;
}
