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
    expect(enabledPrompt).toContain('语音发音反馈强制输出规则');
    expect(enabledPrompt).toContain('你的每一次回复都必须包含发音反馈');
    expect(enabledPrompt).toContain('不要等待用户主动询问');
    expect(enabledPrompt).toContain('发音反馈：<1-2 句简短反馈>');
    expect(enabledPrompt).toContain('无论本轮发音好坏，都必须输出发音反馈');
    expect(enabledPrompt).toContain('不要声称你做了专业音频级或音素级评测');
  });
});
