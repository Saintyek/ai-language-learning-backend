import { IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';

export class TTSStreamRequestDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  speaker?: string = 'zh_female_vv_uranus_bigtts';

  @IsOptional()
  @IsEnum(['mp3'])
  format?: 'mp3' = 'mp3';

  @IsOptional()
  @IsNumber()
  @Min(8000)
  sampleRate?: number = 24000;

  @IsOptional()
  @IsNumber()
  @Min(16000)
  bitRate?: number = 128000;
}
