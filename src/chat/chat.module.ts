import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';
import { ChatSession, ChatMessage } from './chat-session.entity';
import { ProfileModule } from '../profile/profile.module';
import { TtsModule } from '../tts/tts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
    ProfileModule,
    TtsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatSessionService],
  exports: [ChatService, ChatSessionService],
})
export class ChatModule {}
