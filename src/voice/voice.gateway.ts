/**
 * 语音 WebSocket Gateway
 * Feature: 20260508-voice-interaction-feature
 *
 * 处理客户端 WebSocket 连接，协调与 RealtimeAPI 的双向通信
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, WebSocket } from 'ws';
import { validate } from 'class-validator';
import { VoiceService } from './voice.service';
import type {
  ServerEvent,
  StartSessionMessage,
  AudioMessage,
  TextMessage,
} from './voice.interfaces';
import { StartSessionDto, AudioDto, TextDto } from './dto';
import type { LanguageCode } from '../chat/prompts';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  path: '/ws/voice',
})
export class VoiceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private clients: Map<WebSocket, string> = new Map();

  constructor(
    private readonly voiceService: VoiceService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Voice WebSocket Gateway initialized');
  }

  async handleConnection(client: WebSocket) {
    const clientId = this.generateClientId();
    this.clients.set(client, clientId);
    this.logger.log(`Client connected: ${clientId}`);

    // 只记录消息摘要，避免 start_session 中的登录 token 泄露到日志。
    client.on('message', (data: Buffer) => {
      this.logger.debug(`Raw message received: ${data.length} bytes`);
    });
  }

  async handleDisconnect(client: WebSocket) {
    const clientId = this.clients.get(client);
    this.logger.log(`Client disconnected: ${clientId}`);
    if (clientId) {
      this.voiceService.endSession(clientId);
      this.clients.delete(client);
    }
  }

  /**
   * 处理开始会话消息
   */
  @SubscribeMessage('start_session')
  async handleStartSession(
    client: WebSocket,
    payload: StartSessionMessage,
  ): Promise<void> {
    this.logger.log(
      `handleStartSession called with payload: ${JSON.stringify(this.redactStartSessionPayload(payload))}`,
    );
    // 验证 DTO
    const dto = new StartSessionDto();
    dto.token = payload.token;
    dto.language = payload.language;
    dto.scenario = payload.scenario;
    dto.pronunciationAnalysisEnabled = payload.pronunciationAnalysisEnabled;
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.sendMessage(client, {
        type: 'error',
        code: 'VALIDATION_ERROR',
        message: errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .join('; '),
        retryable: false,
      });
      return;
    }

    const sessionId = this.clients.get(client) || this.generateClientId();
    this.clients.set(client, sessionId);
    const language = (payload.language || 'cn') as LanguageCode;
    const scenario = payload.scenario;
    const pronunciationAnalysisEnabled =
      payload.pronunciationAnalysisEnabled ?? false;
    const user = this.getAuthenticatedUser(client, payload.token);
    if (!user) {
      return;
    }

    this.logger.log(
      `Starting session ${sessionId} with language: ${language}, scenario: ${scenario ?? 'none'}, pronunciationAnalysis=${pronunciationAnalysisEnabled}`,
    );

    try {
      await this.voiceService.connectToRealtimeApi(
        sessionId,
        (event: ServerEvent) => this.sendEventToClient(client, event),
        { userId: user.id, language, scenario, pronunciationAnalysisEnabled },
      );

      // 发送连接成功事件
      this.sendMessage(client, {
        type: 'connected',
        sessionId,
      });
    } catch (error) {
      this.logger.error(`Failed to start session: ${error}`);
      this.sendMessage(client, {
        type: 'error',
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Connection failed',
        retryable: true,
      });
    }
  }

  /**
   * 处理结束 ASR（停止录音）消息
   * 在 push_to_talk 模式下，音频输入结束后必须发送此信号
   */
  @SubscribeMessage('end_asr')
  async handleEndASR(client: WebSocket): Promise<void> {
    const sessionId = this.clients.get(client);
    if (sessionId) {
      this.logger.log(`Ending ASR for session: ${sessionId}`);
      this.voiceService.sendEndASR(sessionId);
    }
  }

  /**
   * 处理结束会话消息
   */
  @SubscribeMessage('end_session')
  async handleEndSession(client: WebSocket): Promise<void> {
    const sessionId = this.clients.get(client);
    if (sessionId) {
      this.logger.log(`Ending session: ${sessionId}`);
      this.voiceService.endSession(sessionId);
      this.sendMessage(client, { type: 'session_ended' });
    }
  }

  /**
   * 处理音频数据消息
   */
  @SubscribeMessage('audio')
  async handleAudio(client: WebSocket, payload: AudioMessage): Promise<void> {
    // 验证 DTO
    const dto = new AudioDto();
    dto.data = payload.data;
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.sendMessage(client, {
        type: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid audio data: must be base64 encoded',
        retryable: false,
      });
      return;
    }

    const sessionId = this.clients.get(client);

    if (!sessionId || !this.voiceService.isConnected(sessionId)) {
      this.logger.warn(`Session not connected, ignoring audio`);
      this.sendMessage(client, {
        type: 'error',
        code: 'NOT_CONNECTED',
        message: 'Session not connected',
        retryable: false,
      });
      return;
    }

    this.voiceService.sendAudio(sessionId, payload.data);
  }

  /**
   * 处理文本消息 (用于测试或绕过 ASR)
   */
  @SubscribeMessage('text')
  async handleText(client: WebSocket, payload: TextMessage): Promise<void> {
    // 验证 DTO
    const dto = new TextDto();
    dto.content = payload.content;
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.sendMessage(client, {
        type: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid text: content is required',
        retryable: false,
      });
      return;
    }

    const sessionId = this.clients.get(client);

    if (!sessionId || !this.voiceService.isConnected(sessionId)) {
      this.logger.warn(`Session not connected, ignoring text`);
      this.sendMessage(client, {
        type: 'error',
        code: 'NOT_CONNECTED',
        message: 'Session not connected',
        retryable: false,
      });
      return;
    }

    this.voiceService.sendText(sessionId, payload.content);
  }

  /**
   * 向客户端发送消息
   */
  private sendMessage(client: WebSocket, data: unknown): void {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  }

  /**
   * 向客户端发送事件
   */
  private sendEventToClient(client: WebSocket, event: ServerEvent): void {
    this.sendMessage(client, event);
  }

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private redactStartSessionPayload(payload: StartSessionMessage) {
    return {
      ...payload,
      token: payload.token ? '[REDACTED]' : undefined,
    };
  }

  private getAuthenticatedUser(client: WebSocket, token?: string) {
    if (!token) {
      this.sendMessage(client, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: '请先登录后再开始语音会话',
        retryable: false,
      });
      return null;
    }

    try {
      return this.authService.verifyToken(token);
    } catch (error) {
      this.logger.warn(`Voice auth failed: ${error}`);
      this.sendMessage(client, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: '登录状态已失效，请重新登录',
        retryable: false,
      });
      return null;
    }
  }
}
