import { PromptBuilderService } from './prompt-builder.service';
import { ProfileService } from '../../profile/profile.service';

describe('PromptBuilderService', () => {
  const createProfileService = () =>
    ({
      getProfile: jest.fn().mockResolvedValue({
        level: 'beginner',
        motivations: ['work', 'exam'],
        goals: ['speaking'],
        dailyTime: '30min',
      }),
    }) as unknown as ProfileService;

  it('根据传入的真实用户 ID 获取学习档案', async () => {
    const profileService = createProfileService();

    const service = new PromptBuilderService(profileService);

    const prompts = await service.buildSystemPrompts({
      userId: 42,
      language: 'cn',
    });

    expect(profileService.getProfile).toHaveBeenCalledWith(42, 'cn');
    expect(prompts.join('\n')).toContain('工作需要、考试准备');
  });

  it('仅在语音发音分析开关开启时注入轻量反馈规则', async () => {
    const service = new PromptBuilderService(createProfileService());

    const disabledPrompt = await service.buildRealtimeSystemRole({
      language: 'us',
      pronunciationAnalysisEnabled: false,
    });
    const enabledPrompt = await service.buildRealtimeSystemRole({
      language: 'us',
      pronunciationAnalysisEnabled: true,
    });

    expect(disabledPrompt).not.toContain('语音发音轻量反馈');
    expect(enabledPrompt).toContain('语音发音轻量反馈');
    expect(enabledPrompt).toContain('以“发音反馈：”开头');
    expect(enabledPrompt).toContain('不要声称你做了专业音频级或音素级评测');
  });
});
