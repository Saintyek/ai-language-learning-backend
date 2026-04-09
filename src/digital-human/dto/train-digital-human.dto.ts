import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class TrainDigitalHumanDto {
  @IsString()
  @MaxLength(20)
  langCode: string;

  @IsString()
  vid: string;

  @IsOptional()
  @IsString()
  alphaVid?: string;

  @IsOptional()
  @IsBoolean()
  interactionOptimise?: boolean;
}
