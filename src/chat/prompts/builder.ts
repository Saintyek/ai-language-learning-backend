import type { LanguageCode } from './types';
import { languageConfigs } from './language-config';
import type { ScenePromptConfig } from './types';

/**
 * 生成完整的场景 prompt
 */
export function buildScenePrompt(
  config: ScenePromptConfig,
  languageCode: LanguageCode,
): string {
  const langConfig = languageConfigs[languageCode];

  return `## 角色设定
${config.role}

## 对话场景
${config.scenario}

## 语言要求
- 你与用户对话时使用${langConfig.responseLanguage}
- ${langConfig.correctionHint}

## 行为指导
${config.guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n')}

请始终保持角色一致，用自然、地道的${langConfig.responseLanguage}与用户对话。`;
}
