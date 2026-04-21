import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LanguageProfile } from './profile.entity';
import { CreateProfileDto } from './dto/create-profile.dto';

/**
 * 语言档案服务
 * 处理语言档案相关的业务逻辑
 */
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(LanguageProfile)
    private profileRepository: Repository<LanguageProfile>,
  ) {}

  /**
   * 获取用户指定语言的档案
   * @param userId 用户ID
   * @param language 语言代码
   * @returns 语言档案，如果不存在则返回 null
   */
  async getProfile(userId: number, language: string): Promise<LanguageProfile | null> {
    const profile = await this.profileRepository.findOne({
      where: { userId, language },
    });

    return profile;
  }

  /**
   * 创建或更新语言档案
   * @param userId 用户ID
   * @param language 语言代码
   * @param createProfileDto 档案数据
   * @returns 创建或更新后的档案
   */
  async upsertProfile(
    userId: number,
    language: string,
    createProfileDto: CreateProfileDto,
  ): Promise<LanguageProfile> {
    // 查找现有档案
    let profile = await this.profileRepository.findOne({
      where: { userId, language },
    });

    if (profile) {
      // 更新现有档案
      Object.assign(profile, createProfileDto);
    } else {
      // 创建新档案
      profile = this.profileRepository.create({
        userId,
        language,
        ...createProfileDto,
      });
    }

    return this.profileRepository.save(profile);
  }

  /**
   * 删除语言档案
   * @param userId 用户ID
   * @param language 语言代码
   */
  async deleteProfile(userId: number, language: string): Promise<void> {
    const profile = await this.profileRepository.findOne({
      where: { userId, language },
    });

    if (!profile) {
      throw new NotFoundException('未找到该语言的档案');
    }

    await this.profileRepository.remove(profile);
  }
}
