import { Body, Controller, Post } from '@nestjs/common';
import { TranslateService } from './translate.service';
import { TranslateRequestDto, TranslateResponseDto } from './dto';

@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post()
  async translate(
    @Body() dto: TranslateRequestDto,
  ): Promise<TranslateResponseDto> {
    return this.translateService.translate(dto);
  }
}
