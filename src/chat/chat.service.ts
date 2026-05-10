import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ChatStreamRequestDto } from './dto/chat-stream-request.dto';
import { PromptBuilderService } from './prompts/prompt-builder.service';
import { ChatSessionService } from './chat-session.service';
import { TtsService } from '../tts/tts.service';

interface ArkStreamChunkChoiceDelta {
  content?: string;
  role?: string;
}

interface ArkStreamChunkChoice {
  delta?: ArkStreamChunkChoiceDelta;
  finish_reason?: string | null;
}

interface ArkStreamChunk {
  choices?: ArkStreamChunkChoice[];
  error?: {
    message?: string;
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const ARK_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = 'doubao-1-5-lite-32k-250115';
const ARK_REQUEST_TIMEOUT_MS = 60_000;
const ARK_TEMPERATURE = 0.3;
const ARK_MAX_TOKENS = 150;

@Injectable()
export class ChatService {
  constructor(
    private readonly configService: ConfigService,
    private readonly chatSessionService: ChatSessionService,
    private readonly ttsService: TtsService,
    private readonly promptBuilderService: PromptBuilderService,
  ) {}

  async streamChat(
    dto: ChatStreamRequestDto,
    response: Response,
    userId: number,
    requestSignal?: AbortSignal,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('ARK_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException('请先配置 ARK_API_KEY');
    }

    // 注入场景 prompt（包含档案提示词）
    const messages = await this.injectScenePrompt(dto, userId);

    const upstreamController = new AbortController();
    const timeout = setTimeout(() => {
      upstreamController.abort('timeout');
    }, ARK_REQUEST_TIMEOUT_MS);

    const abortUpstream = () => {
      if (!upstreamController.signal.aborted) {
        upstreamController.abort('client_disconnected');
      }
    };

    requestSignal?.addEventListener('abort', abortUpstream, { once: true });

    // 收集助手响应内容
    let assistantContent = '';

    // TTS 相关变量
    let ttsCleanup: (() => void) | null = null;
    const isTtsEnabled = !!dto.enableTTS;

    // Debug: Log TTS status
    console.log(
      'TTS Debug - enableTTS:',
      dto.enableTTS,
      'isTtsEnabled:',
      isTtsEnabled,
      'language:',
      dto.language,
    );

    try {
      // 初始化 TTS 音频回调 (HTTP API 不需要 startSession)
      if (isTtsEnabled) {
        // 设置 TTS 语言（关键：支持多语言语音合成）
        this.ttsService.setLanguage(dto.language);
        // 注册音频回调
        ttsCleanup = this.ttsService.onAudio((audioBase64: string) => {
          this.writeSseEvent(response, 'audio', { audio: audioBase64 });
        });
      }

      let upstreamResponse: globalThis.Response;

      try {
        upstreamResponse = await fetch(ARK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: ARK_MODEL,
            stream: true,
            temperature: ARK_TEMPERATURE,
            max_tokens: ARK_MAX_TOKENS,
            messages,
          }),
          signal: upstreamController.signal,
        });
      } catch (error) {
        if (upstreamController.signal.aborted) {
          const reason = upstreamController.signal.reason;
          if (reason === 'client_disconnected') {
            return;
          }
          throw new GatewayTimeoutException('Ark 响应超时');
        }

        throw new BadGatewayException(
          error instanceof Error ? error.message : 'Ark 请求失败',
        );
      }

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        const errorText = await upstreamResponse.text();
        throw new BadGatewayException(errorText || 'Ark 流式请求失败');
      }

      this.writeSseEvent(response, 'start', {
        model: ARK_MODEL,
        ttsEnabled: isTtsEnabled,
      });
      assistantContent = await this.pipeArkStream(
        upstreamResponse.body,
        response,
        upstreamController,
        isTtsEnabled,
      );

      // 在发送 done 之前，先完成 TTS 合成（确保所有音频都发送完毕）
      if (isTtsEnabled) {
        try {
          await this.ttsService.finish();
        } catch {
          // 忽略清理错误
        }
      }

      // 所有内容（包括音频）都发送完毕后，才发送 done 事件
      this.writeSseEvent(response, 'done', { model: ARK_MODEL });

      // 如果传了 sessionId，保存消息到数据库
      if (dto.sessionId && assistantContent) {
        await this.saveMessagesToSession(
          dto.sessionId,
          dto.messages,
          assistantContent,
        );
      }

      // 如果传了 scenario 和 sessionId，更新会话的场景标识
      if (dto.sessionId && dto.scenario) {
        await this.chatSessionService.updateSessionScenario(
          dto.sessionId,
          dto.scenario,
        );
      }
    } catch (error) {
      if (requestSignal?.aborted) {
        return;
      }

      if (upstreamController.signal.aborted) {
        const reason = upstreamController.signal.reason;
        if (reason === 'client_disconnected' || reason === 'stream_completed') {
          return;
        }
        throw new GatewayTimeoutException('Ark 响应超时');
      }

      if (error instanceof BadGatewayException) {
        this.writeSseEvent(response, 'error', { message: error.message });
      }

      throw error;
    } finally {
      // 清理 TTS 回调
      if (ttsCleanup) {
        ttsCleanup();
      }

      clearTimeout(timeout);
      requestSignal?.removeEventListener('abort', abortUpstream);
    }
  }

  /**
   * 保存消息到会话
   */
  private async saveMessagesToSession(
    sessionId: string,
    userMessages: Array<{ role: string; content: string }>,
    assistantContent: string,
  ): Promise<void> {
    try {
      // 只保存最后一条用户消息（当前对话）
      const lastUserMessage = [...userMessages]
        .reverse()
        .find((msg) => msg.role === 'user');

      if (lastUserMessage) {
        await this.chatSessionService.addMessage(
          sessionId,
          'user',
          lastUserMessage.content,
        );
      }

      // 保存助手响应
      if (assistantContent) {
        await this.chatSessionService.addMessage(
          sessionId,
          'assistant',
          assistantContent,
        );
      }
    } catch (error) {
      // 保存失败不影响主流程，只记录日志
      console.error('Failed to save messages to session:', error);
    }
  }

  /**
   * 注入场景 prompt 到消息列表
   * 注意：档案提示词具有最高优先级，在场景提示词之前注入
   */
  private async injectScenePrompt(
    dto: ChatStreamRequestDto,
    userId: number,
  ): Promise<ChatMessage[]> {
    const systemPrompts = await this.promptBuilderService.buildSystemPrompts({
      userId,
      language: dto.language,
      scenario: dto.scenario,
    });

    const messages: ChatMessage[] = systemPrompts.map((content) => ({
      role: 'system',
      content,
    }));

    // 用户消息保持在系统约束之后，避免覆盖前置 prompt。
    for (const msg of dto.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return messages;
  }

  private async pipeArkStream(
    stream: ReadableStream<Uint8Array>,
    response: Response,
    upstreamController: AbortController,
    ttsEnabled: boolean = false,
  ): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let collectedContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const segments = buffer.split('\n\n');
        buffer = segments.pop() ?? '';

        for (const segment of segments) {
          const delta = await this.handleSseSegment(
            segment,
            response,
            ttsEnabled,
          );
          if (delta) {
            collectedContent += delta;
          }
        }
      }

      if (buffer.trim()) {
        const delta = await this.handleSseSegment(buffer, response, ttsEnabled);
        if (delta) {
          collectedContent += delta;
        }
      }
    } finally {
      upstreamController.abort('stream_completed');
      reader.releaseLock();
    }

    return collectedContent;
  }

  private async handleSseSegment(
    segment: string,
    response: Response,
    ttsEnabled: boolean = false,
  ): Promise<string | null> {
    const lines = segment
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'));

    let collectedDelta = '';

    for (const line of lines) {
      const payload = line.slice(5).trim();

      if (!payload || payload === '[DONE]') {
        continue;
      }

      let chunk: ArkStreamChunk;
      try {
        chunk = JSON.parse(payload) as ArkStreamChunk;
      } catch {
        continue;
      }

      if (chunk.error?.message) {
        throw new BadGatewayException(chunk.error.message);
      }

      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        this.writeSseEvent(response, 'delta', { content: delta });
        collectedDelta += delta;

        // 发送文本到 TTS
        if (ttsEnabled) {
          try {
            // sendText 会累积文本并检测句子边界
            await this.ttsService.sendText(delta);
          } catch (ttsError) {
            // TTS 发送失败不影响主流程
            console.error('Failed to send text to TTS:', ttsError);
          }
        }
      }
    }

    return collectedDelta || null;
  }

  private writeSseEvent(
    response: Response,
    event: 'start' | 'delta' | 'audio' | 'done' | 'error',
    data: Record<string, unknown>,
  ): void {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
