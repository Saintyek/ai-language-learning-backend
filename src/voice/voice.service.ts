/**
 * 语音服务
 * Feature: 20260508-voice-interaction-feature
 *
 * 管理与火山引擎 RealtimeAPI 的 WebSocket 连接
 * 使用二进制协议进行通信
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import {
  RealtimeApiConfig,
  RealtimeApiHeaders,
  REALTIME_API_URL,
  ServerEvent,
  AsrEvent,
  ChatEvent,
  TtsEvent,
  TtsEndedEvent,
  ErrorEvent,
} from './voice.interfaces';
import {
  ClientEventId,
  ServerEventId,
  encodeClientEvent,
  decodeServerFrame,
  parseServerEvent,
} from './binary-protocol';

/** StartSession 请求配置 */
interface StartSessionConfig {
  language?: string;
  bot_name?: string;
  system_role?: string;
}

/** 服务端响应事件 */
interface AsrResponseData {
  results: Array<{
    text: string;
    is_interim: boolean;
  }>;
}

interface ChatResponseData {
  content: string;
  question_id: string;
  reply_id: string;
}

interface ErrorData {
  status_code: string;
  message: string;
}

@Injectable()
export class VoiceService implements OnModuleDestroy {
  private readonly logger = new Logger(VoiceService.name);
  private config: RealtimeApiConfig;
  private connections: Map<string, WebSocket> = new Map();
  // 火山服务端在 SessionStarted 事件中返回的 dialog_id，用于加载历史上下文
  private dialogIds: Map<string, string> = new Map();
  // 二进制协议头里携带的 session id（必须由客户端生成 UUID），
  // 这是 Session 级事件（StartSession/TaskRequest/EndASR/FinishSession）的必填字段
  // 与 dialogIds 不是一个东西
  private protocolSessionIds: Map<string, string> = new Map();

  constructor(private readonly configService: ConfigService) {
    const appId = this.configService.get<string>('VOLCENGINE_VOICE_APP_ID');
    const accessKey = this.configService.get<string>(
      'VOLCENGINE_VOICE_ACCESS_KEY',
    );
    const resourceId = this.configService.get<string>(
      'VOLCENGINE_VOICE_RESOURCE_ID',
    );
    const appKey = this.configService.get<string>('VOLCENGINE_VOICE_APP_KEY');

    if (!appId || !accessKey || !resourceId || !appKey) {
      this.logger.warn(
        'Missing RealtimeAPI configuration. Voice feature will not work.',
      );
    }

    this.config = {
      appId: appId || '',
      accessKey: accessKey || '',
      resourceId: resourceId || '',
      appKey: appKey || '',
    };
  }

  async onModuleDestroy() {
    for (const [sessionId, ws] of this.connections) {
      this.logger.log(`Closing connection for session: ${sessionId}`);
      ws.close();
    }
    this.connections.clear();
    this.dialogIds.clear();
    this.protocolSessionIds.clear();
  }

  /**
   * 建立与 RealtimeAPI 的 WebSocket 连接
   */
  async connectToRealtimeApi(
    sessionId: string,
    onEvent: (event: ServerEvent) => void,
    language: string = 'cn',
  ): Promise<void> {
    if (this.connections.has(sessionId)) {
      this.logger.warn(`Session ${sessionId} already connected`);
      return;
    }

    const headers: RealtimeApiHeaders = {
      'X-Api-App-ID': this.config.appId,
      'X-Api-Access-Key': this.config.accessKey,
      'X-Api-Resource-Id': this.config.resourceId,
      'X-Api-App-Key': this.config.appKey,
    };

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(REALTIME_API_URL, {
          headers: headers as Record<string, string>,
        });

        ws.on('open', () => {
          this.logger.log(`WebSocket connected for session: ${sessionId}`);
          this.connections.set(sessionId, ws);

          // 为本次会话生成协议层 session id（火山要求所有 Session 级事件
          // 的二进制头都必须携带；与后续 SessionStarted 返回的 dialog_id 不同）
          const protocolSessionId = randomUUID();
          this.protocolSessionIds.set(sessionId, protocolSessionId);
          this.logger.log(
            `Protocol session id for ${sessionId}: ${protocolSessionId}`,
          );

          // 发送 StartConnection 事件（连接级，不需要 session id）
          const startConnectionFrame = encodeClientEvent(
            ClientEventId.StartConnection,
            {},
          );
          ws.send(startConnectionFrame);

          // 发送 StartSession 事件
          const startSessionConfig: StartSessionConfig = {
            language,
            bot_name: 'AI助手',
            system_role: '你是一个友好的语言学习助手，帮助用户练习语言。',
          };

          // TTS 配置说明：
          // 不显式声明 audio_config，火山默认返回 OGG/Opus，浏览器
          // decodeAudioData 可正确解码（Chrome/Edge/Firefox 均支持）。
          // 若要改为裸 PCM 输出，需同步改造前端 audioPlayer 直接构造 AudioBuffer。
          // 注意：StartSession 是 Session 级事件，必须在协议头携带 session id
          const startSessionFrame = encodeClientEvent(
            ClientEventId.StartSession,
            {
              dialog: {
                bot_name: startSessionConfig.bot_name,
                system_role: startSessionConfig.system_role,
                extra: {
                  input_mod: 'push_to_talk', // 麦克风按键模式
                },
              },
            },
            protocolSessionId,
          );
          ws.send(startSessionFrame);

          resolve();
        });

        ws.on('message', (data: Buffer) => {
          try {
            const frame = decodeServerFrame(data);
            if (!frame) {
              this.logger.warn('Failed to decode server frame');
              return;
            }

            const event = parseServerEvent(frame);
            if (!event) {
              this.logger.warn('Failed to parse server event');
              return;
            }

            this.handleServerEvent(sessionId, event, onEvent);
          } catch (error) {
            this.logger.error(`Failed to handle message: ${error}`);
          }
        });

        ws.on('error', (error: Error) => {
          this.logger.error(`WebSocket error for session ${sessionId}:`, error);
          onEvent({
            type: 'error',
            code: 'CONNECTION_ERROR',
            message: error.message,
            retryable: true,
          } as ErrorEvent);
          this.connections.delete(sessionId);
          this.dialogIds.delete(sessionId);
          this.protocolSessionIds.delete(sessionId);
        });

        ws.on('close', (code: number, reason: Buffer) => {
          this.logger.log(
            `Connection closed for session ${sessionId}: code=${code}, reason=${reason.toString()}`,
          );
          this.connections.delete(sessionId);
          this.dialogIds.delete(sessionId);
          this.protocolSessionIds.delete(sessionId);
          onEvent({
            type: 'session_ended',
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 处理服务端事件
   */
  private handleServerEvent(
    sessionId: string,
    event: { eventId: number; data: unknown },
    onEvent: (event: ServerEvent) => void,
  ): void {
    const { eventId, data } = event;

    switch (eventId) {
      case ServerEventId.ConnectionStarted:
        this.logger.log(`Connection started for session: ${sessionId}`);
        break;

      case ServerEventId.ConnectionFailed:
        this.logger.error(`Connection failed: ${JSON.stringify(data)}`);
        onEvent({
          type: 'error',
          code: 'CONNECTION_FAILED',
          message: JSON.stringify(data),
          retryable: true,
        } as ErrorEvent);
        break;

      case ServerEventId.SessionStarted:
        this.logger.log(`Session started for session: ${sessionId}`);
        // 保存服务端返回的 dialog_id
        if (data && typeof data === 'object' && 'dialog_id' in data) {
          this.dialogIds.set(
            sessionId,
            (data as { dialog_id: string }).dialog_id,
          );
        }
        onEvent({
          type: 'connected',
          sessionId,
        });
        break;

      case ServerEventId.SessionFailed:
        this.logger.error(`Session failed: ${JSON.stringify(data)}`);
        onEvent({
          type: 'error',
          code: 'SESSION_FAILED',
          message: JSON.stringify(data),
          retryable: true,
        } as ErrorEvent);
        break;

      case ServerEventId.ASRResponse:
        // ASR 识别结果
        const asrData = data as AsrResponseData;
        if (asrData.results && asrData.results.length > 0) {
          const result = asrData.results[0];
          // 链路日志：观察 ASR 是否真的从音频里识别出文字
          this.logger.log(
            `[ASR] session=${sessionId} isFinal=${!result.is_interim} text="${result.text}"`,
          );
          onEvent({
            type: 'asr',
            isFinal: !result.is_interim,
            text: result.text,
          } as AsrEvent);
        }
        break;

      case ServerEventId.ASREnded:
        // ASR 结束
        this.logger.log(`[ASR] ended for session: ${sessionId}`);
        break;

      case ServerEventId.ChatResponse:
        // AI 回复
        const chatData = data as ChatResponseData;
        if (chatData.content) {
          // 链路日志：观察大模型是否产出文字
          this.logger.log(
            `[Chat] session=${sessionId} content="${chatData.content}"`,
          );
          onEvent({
            type: 'chat',
            isFinal: true,
            text: chatData.content,
          } as ChatEvent);
        }
        break;

      case ServerEventId.ChatEnded:
        // AI 回复结束
        this.logger.log(`[Chat] ended for session: ${sessionId}`);
        break;

      case ServerEventId.TTSResponse:
        // TTS 音频数据
        if (Buffer.isBuffer(data)) {
          // 链路日志：观察 TTS 是否产出音频
          this.logger.log(
            `[TTS] session=${sessionId} audio bytes=${data.length}`,
          );
          const audioBase64 = data.toString('base64');
          onEvent({
            type: 'tts',
            audio: audioBase64,
          } as TtsEvent);
        }
        break;

      case ServerEventId.TTSEnded:
        // TTS 结束
        this.logger.log(`[TTS] ended for session: ${sessionId}`);
        onEvent({
          type: 'tts_ended',
        } as TtsEndedEvent);
        break;

      case ServerEventId.DialogCommonError:
        // 错误
        const errorData = data as ErrorData;
        onEvent({
          type: 'error',
          code: errorData.status_code || 'UNKNOWN',
          message: errorData.message || 'Unknown error',
          retryable: false,
        } as ErrorEvent);
        break;

      default:
        this.logger.debug(
          `Unhandled event: ${eventId}, data: ${JSON.stringify(data)}`,
        );
    }
  }

  /**
   * 发送音频数据到 RealtimeAPI
   */
  // 用于按会话累计上传字节数（避免每包都打日志），每达到一定阈值打印一次
  private uploadBytesCounter: Map<string, number> = new Map();

  sendAudio(sessionId: string, audioBase64: string): boolean {
    const ws = this.connections.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`No active connection for session: ${sessionId}`);
      return false;
    }

    // 将 Base64 解码为 Buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // 链路日志：每累计 16KB（≈0.5s 16k/16bit PCM）打印一次，便于确认上传节奏
    const prev = this.uploadBytesCounter.get(sessionId) ?? 0;
    const next = prev + audioBuffer.length;
    if (Math.floor(next / 16000) > Math.floor(prev / 16000)) {
      this.logger.log(
        `[Audio] session=${sessionId} uploaded ~${next} bytes (frame=${audioBuffer.length})`,
      );
    }
    this.uploadBytesCounter.set(sessionId, next);

    // 使用二进制协议发送音频
    // TaskRequest 是 Session 级事件，必须携带客户端生成的 protocolSessionId
    const audioFrame = encodeClientEvent(
      ClientEventId.TaskRequest,
      audioBuffer,
      this.protocolSessionIds.get(sessionId),
    );

    ws.send(audioFrame);
    return true;
  }

  /**
   * 发送文本消息到 RealtimeAPI (用于测试或绕过 ASR)
   */
  sendText(sessionId: string, text: string): boolean {
    const ws = this.connections.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`No active connection for session: ${sessionId}`);
      return false;
    }

    // 使用 ChatTextQuery 事件发送文本（Session 级事件，必须带 protocolSessionId）
    const textFrame = encodeClientEvent(
      ClientEventId.ChatTextQuery,
      {
        content: text,
      },
      this.protocolSessionIds.get(sessionId),
    );

    ws.send(textFrame);
    return true;
  }

  /**
   * 发送 EndASR 信号（按键模式下音频输入结束）
   */
  sendEndASR(sessionId: string): boolean {
    const ws = this.connections.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`No active connection for session: ${sessionId}`);
      return false;
    }

    // EndASR 是 Session 级事件，必须带 protocolSessionId
    const endASRFrame = encodeClientEvent(
      ClientEventId.EndASR,
      {},
      this.protocolSessionIds.get(sessionId),
    );

    ws.send(endASRFrame);
    return true;
  }

  /**
   * 结束会话
   */
  endSession(sessionId: string): void {
    const ws = this.connections.get(sessionId);
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        // 发送 FinishSession 事件（Session 级，必须带 protocolSessionId）
        const finishSessionFrame = encodeClientEvent(
          ClientEventId.FinishSession,
          {},
          this.protocolSessionIds.get(sessionId),
        );
        ws.send(finishSessionFrame);

        // 发送 FinishConnection 事件（连接级，不带 sessionId）
        const finishConnectionFrame = encodeClientEvent(
          ClientEventId.FinishConnection,
          {},
        );
        ws.send(finishConnectionFrame);

        ws.close();
      }
      this.connections.delete(sessionId);
      this.dialogIds.delete(sessionId);
      this.protocolSessionIds.delete(sessionId);
      // 清理上传字节计数，避免内存泄漏
      this.uploadBytesCounter.delete(sessionId);
      this.logger.log(`Session ended: ${sessionId}`);
    }
  }

  /**
   * 检查会话是否已连接
   */
  isConnected(sessionId: string): boolean {
    const ws = this.connections.get(sessionId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }
}
