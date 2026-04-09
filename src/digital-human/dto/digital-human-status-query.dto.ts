import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DigitalHumanStatusQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  langCode?: string;
}
