// 汇总所有场景 Prompt
import { rolePrompts } from './roles';
import { professionalTrainingPrompts } from './professional-training';
import { medicalPrompts } from './medical';
import { travelPrompts } from './travel';
import { workPrompts } from './work';
import { dailyLifePrompts } from './daily-life';
import { entertainmentPrompts } from './entertainment';
import type { ScenePromptConfig } from '../types';

export const allScenePrompts: Record<string, ScenePromptConfig> = {
  ...rolePrompts,
  ...professionalTrainingPrompts,
  ...medicalPrompts,
  ...travelPrompts,
  ...workPrompts,
  ...dailyLifePrompts,
  ...entertainmentPrompts,
};

export { rolePrompts, professionalTrainingPrompts, medicalPrompts, travelPrompts, workPrompts, dailyLifePrompts, entertainmentPrompts };
