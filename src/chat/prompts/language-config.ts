import type { LanguageCode } from './types';

export interface LanguageConfig {
  /** 语言名称 */
  name: string;
  /** AI 回复使用的语言 */
  responseLanguage: string;
  /** 纠正提示语 */
  correctionHint: string;
}

export const languageConfigs: Record<LanguageCode, LanguageConfig> = {
  cn: {
    name: '中文',
    responseLanguage: '中文',
    correctionHint: '当用户表达有误时，用正确的中文表达重复一遍，并简要说明错误',
  },
  jp: {
    name: '日语',
    responseLanguage: '日语',
    correctionHint: '当用户的日语表达有误时，用正确的日语表达重复一遍，并简要说明错误',
  },
  kr: {
    name: '韩语',
    responseLanguage: '韩语',
    correctionHint: '当用户的韩语表达有误时，用正确的韩语表达重复一遍，并简要说明错误',
  },
  us: {
    name: '美式英语',
    responseLanguage: '美式英语',
    correctionHint: '当用户的英语表达有误时，用正确的美式英语重复一遍，并简要说明错误',
  },
};
