import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigitalHuman } from './digital-human.entity';
import { DigitalHumanController } from './digital-human.controller';
import { DigitalHumanService } from './digital-human.service';

@Module({
  imports: [TypeOrmModule.forFeature([DigitalHuman])],
  controllers: [DigitalHumanController],
  providers: [DigitalHumanService],
  exports: [DigitalHumanService],
})
export class DigitalHumanModule {}
