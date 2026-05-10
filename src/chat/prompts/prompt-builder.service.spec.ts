import { PromptBuilderService } from './prompt-builder.service';
import { ProfileService } from '../../profile/profile.service';

describe('PromptBuilderService', () => {
  it('根据传入的真实用户 ID 获取学习档案', async () => {
    const profileService = {
      getProfile: jest.fn().mockResolvedValue({
        level: 'beginner',
        motivations: ['work', 'exam'],
        goals: ['speaking'],
        dailyTime: '30min',
      }),
    } as unknown as ProfileService;

    const service = new PromptBuilderService(profileService);

    const prompts = await service.buildSystemPrompts({
      userId: 42,
      language: 'cn',
    });

    expect(profileService.getProfile).toHaveBeenCalledWith(42, 'cn');
    expect(prompts.join('\n')).toContain('工作需要、考试准备');
  });
});
