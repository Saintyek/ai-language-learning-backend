/**
 * 语音模块
 * Feature: 20260508-voice-interaction-feature
 *
 * 提供实时语音交互功能，包括 ASR、AI 对话、TTS 和发音分析
 */

import { Module } from '@nestjs/common';
import { VoiceGateway } from './voice.gateway';
import { VoiceService } from './voice.service';
import { ProfileModule } from '../profile/profile.module';
import { PromptBuilderService } from '../chat/prompts/prompt-builder.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ProfileModule, AuthModule],
  providers: [VoiceGateway, VoiceService, PromptBuilderService],
  exports: [VoiceService],
})
export class VoiceModule {}
