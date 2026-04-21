import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { LanguageProfile } from './profile.entity';

/**
 * 语言档案模块
 * 负责处理用户语言学习档案相关的所有业务逻辑
 */
@Module({
  imports: [TypeOrmModule.forFeature([LanguageProfile])],
  providers: [ProfileService],
  controllers: [ProfileController],
  exports: [ProfileService],
})
export class ProfileModule {}
