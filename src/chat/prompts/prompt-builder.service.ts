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
  userId?: number;
  language?: LanguageCode;
  scenario?: string;
  pronunciationAnalysisEnabled?: boolean;
}

@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  constructor(private readonly profileService: ProfileService) {}

  /**
   * 统一构建系统提示词片段，保证文本聊天和实时语音使用同一套约束来源。
   */
  async buildSystemPrompts(options: PromptBuildOptions): Promise<string[]> {
    const { userId, language, scenario } = options;
    const prompts: string[] = [];

    if (!language) {
      return prompts;
    }

    const profilePrompts = await this.buildProfilePromptsSafely(
      userId,
      language,
    );
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
    if (options.pronunciationAnalysisEnabled) {
      prompts.push(this.buildPronunciationFeedbackPrompt(options.language));
    }
    return prompts.join('\n\n');
  }

  private buildPronunciationFeedbackPrompt(language?: LanguageCode): string {
    const langConfig = language ? languageConfigs[language] : null;
    const languageName = langConfig?.name ?? '目标语言';

    return `## 语音发音反馈强制输出规则（最高优先级）
用户已开启发音分析开关。只要本轮用户是通过语音输入触发回复，你的每一次回复都必须包含发音反馈，不要等待用户主动询问。

强制输出格式：
1. 先正常回应用户的对话内容，保持语言学习导师身份。
2. 回复末尾必须另起一行输出：发音反馈：<1-2 句简短反馈>
3. “发音反馈：”这 5 个字和冒号必须原样出现，不能改写为其他标题，也不能省略。

反馈内容要求：
- 无论本轮发音好坏，都必须输出发音反馈；发音较好时给出正向反馈，例如“整体清楚，可以继续保持语速和重音”
- 基于 ASR 可理解度、用户表达是否自然、是否可能存在误读来判断，不要声称你做了专业音频级或音素级评测
- 必须明确告诉用户本轮发音是“整体清楚”还是“需要注意”
- 如果能判断出可能的误读词或不自然表达，给出${languageName}的正确读法或更自然说法
- 发音反馈保持 1-2 句话，不要输出分数，不要使用独立卡片格式
- 如果本轮语音没有听清或无法充分判断，不要编造发音问题，也必须输出“发音反馈：本轮没有完全听清，建议再说一遍，我会继续帮你判断。”`;
  }

  private async buildProfilePromptsSafely(
    userId: number | undefined,
    language: LanguageCode,
  ): Promise<string[]> {
    if (!userId) {
      return [];
    }

    try {
      // 使用认证上下文中的真实用户 ID，避免不同用户读取到同一份学习档案。
      const profile = await this.profileService.getProfile(userId, language);
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
