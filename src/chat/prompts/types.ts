export type LanguageCode = 'cn' | 'jp' | 'es' | 'us';

export interface ScenePromptConfig {
  /** 系统角色设定模板 */
  role: string;
  /** 对话场景描述 */
  scenario: string;
  /** 行为指导 */
  guidelines: string[];
}
