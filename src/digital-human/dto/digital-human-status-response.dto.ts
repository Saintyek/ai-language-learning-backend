import { ApiProperty } from '@nestjs/swagger';

export class DigitalHumanStatusResponseDto {
  @ApiProperty({ enum: ['not_created', 'training', 'ready', 'failed'] })
  status: 'not_created' | 'training' | 'ready' | 'failed';

  @ApiProperty({ required: false })
  frontendPicUrl?: string;

  @ApiProperty({ required: false })
  resourceId?: string;
}
