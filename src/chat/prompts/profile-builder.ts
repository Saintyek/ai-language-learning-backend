/**
 * 档案提示词构建器
 * 将用户的学习档案转换为系统提示词
 */

import {
  levelDescriptions,
  motivationDescriptions,
  goalDescriptions,
  dailyTimeDescriptions,
  getDifficultyGuidance,
  getMotivationTopics,
} from './profile-template';

/**
 * 档案数据接口
 */
export interface ProfileData {
  level: 'beginner' | 'intermediate' | 'advanced' | 'master';
  motivations: string[];
  goals: string[];
  dailyTime: string;
}

/**
 * 构建档案提示词
 * @param profile 用户的学习档案
 * @param language 目标语言代码
 * @returns 格式化的系统提示词
 */
export function buildProfilePrompt(
  profile: ProfileData,
  language: string,
): string {
  const levelDesc = levelDescriptions[profile.level] || '学习者';
  const motivationList = profile.motivations
    .map((m) => motivationDescriptions[m] || m)
    .join('、');
  const goalList = profile.goals
    .map((g) => goalDescriptions[g] || g)
    .join('、');
  const dailyTimeDesc =
    dailyTimeDescriptions[profile.dailyTime] || profile.dailyTime;
  const difficultyGuidance = getDifficultyGuidance(profile.level);
  const suggestedTopics = getMotivationTopics(profile.motivations);

  return `## 学习者档案约束（最高优先级）

你正在与一位${levelDesc}进行对话学习。此档案约束具有最高优先级，请在任何场景设定之上优先考虑学习者的个人情况。

### 学习背景
- **语言水平**：${levelDesc}
- **学习动机**：${motivationList}
- **学习目标**：${goalList}
- **学习时间**：${dailyTimeDesc}

### 教学指导
${difficultyGuidance}

### 话题建议
根据学习动机，可以围绕以下话题展开对话：${suggestedTopics.slice(0, 4).join('、')}

### 重点训练
请重点帮助用户提升${goalList}能力。

---
请始终保持角色一致，根据学习者的档案信息提供个性化的学习体验。`;
}
