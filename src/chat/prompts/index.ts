// 主入口文件
export * from './types';
export * from './language-config';
export * from './builder';
export * from './scenes';
export * from './profile-template';
export * from './profile-builder';

import { allScenePrompts } from './scenes';
import { buildScenePrompt } from './builder';
import type { LanguageCode } from './types';

/**
 * 根据场景 key 和语言代码获取完整的 prompt 字符串
 */
export function getScenePrompt(
  sceneKey: string,
  languageCode: LanguageCode,
): string | null {
  const config = allScenePrompts[sceneKey];
  if (!config) {
    return null;
  }
  return buildScenePrompt(config, languageCode);
}

/**
 * 获取所有场景的 key 列表
 */
export function getAllSceneKeys(): string[] {
  return Object.keys(allScenePrompts);
}
