import { Injectable, Logger } from '@nestjs/common';
import { ProfileService } from '../../profile/profile.service';
import { buildProfilePrompt, ProfileData } from './profile-builder';
import { buildScenePrompt } from './builder';
import { languageConfigs } from './language-config';
import { allScenePrompts } from './scenes';
import {
  dailyTimeDescriptions,
  goalDescriptions,
  levelDescriptions,
  motivationDescriptions,
} from './profile-template';
import type { LanguageCode } from './types';

interface PromptBuildOptions {
  language?: LanguageCode;
  scenario?: string;
}

const TEMP_USER_ID = 1;

@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  constructor(private readonly profileService: ProfileService) {}

  /**
   * 统一构建系统提示词片段，保证文本聊天和实时语音使用同一套约束来源。
   */
  async buildSystemPrompts(options: PromptBuildOptions): Promise<string[]> {
    const { language, scenario } = options;
    const prompts: string[] = [];

    if (!language) {
      return prompts;
    }

    const profilePrompts = await this.buildProfilePromptsSafely(language);
    prompts.push(...profilePrompts);

    const scenePrompt = this.buildScenePromptSafely(scenario, language);
    prompts.push(scenePrompt ?? this.buildDefaultLanguagePrompt(language));

    return prompts;
  }

  /**
   * RealtimeAPI 只接收单个 system_role，这里把共享片段聚合为一个完整提示词。
   */
  async buildRealtimeSystemRole(options: PromptBuildOptions): Promise<string> {
    const prompts = await this.buildSystemPrompts(options);
    return prompts.join('\n\n');
  }

  private async buildProfilePromptsSafely(language: LanguageCode): Promise<string[]> {
    try {
      // 当前项目暂未接入认证用户，沿用文本聊天既有的临时用户 ID。
      const profile = await this.profileService.getProfile(TEMP_USER_ID, language);
      if (!profile) {
        return [];
      }

      const profileData = this.normalizeProfileData(profile);

      return [
        this.buildProfileFactsPrompt(profileData),
        buildProfilePrompt(profileData, language),
      ];
    } catch (error) {
      this.logger.warn(`Failed to build profile prompt: ${error}`);
      return [];
    }
  }

  private normalizeProfileData(profile: {
    level: string;
    motivations: string[];
    goals: string[];
    dailyTime: string;
  }): ProfileData {
    return {
      level: profile.level as ProfileData['level'],
      motivations: profile.motivations,
      goals: profile.goals,
      dailyTime: profile.dailyTime,
    };
  }

  private buildProfileFactsPrompt(profile: ProfileData): string {
    const levelDesc = levelDescriptions[profile.level] || '学习者';
    const motivationList = profile.motivations
      .map((motivation) => motivationDescriptions[motivation] || motivation)
      .join('、');
    const goalList = profile.goals
      .map((goal) => goalDescriptions[goal] || goal)
      .join('、');
    const dailyTimeDesc =
      dailyTimeDescriptions[profile.dailyTime] || profile.dailyTime;

    return `## 学习档案事实约束（必须准确遵守）
- 用户语言水平：${levelDesc}
- 用户学习动机完整列表：${motivationList}
- 用户学习目标完整列表：${goalList}
- 用户每日学习时间：${dailyTimeDesc}

当用户询问自己的学习动机、学习目标、语言水平或学习时间时，必须基于以上事实完整回答；列表类信息必须逐项列出，不得只回答第一项或自行删减。`;
  }

  private buildDefaultLanguagePrompt(language: LanguageCode): string {
    const langConfig = languageConfigs[language];

    return `## 角色设定
你是一名${langConfig.name}语言学习助手。

## 语言要求
- 请围绕${langConfig.name}口语练习、纠错和场景对话来回答
- 优先使用${langConfig.responseLanguage}回复
- 当用户明显看不懂时，可以补充简短中文解释
- ${langConfig.correctionHint}

请始终保持语言学习导师身份，给出自然、简洁、适合口语练习的回应。`;
  }

  private buildScenePromptSafely(
    scenario: string | undefined,
    language: LanguageCode,
  ): string | null {
    if (!scenario) {
      return null;
    }

    const config = allScenePrompts[scenario];
    if (!config) {
      return null;
    }

    return buildScenePrompt(config, language);
  }
}
