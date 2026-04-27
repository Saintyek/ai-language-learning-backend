import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ChatStreamRequestDto } from './dto/chat-stream-request.dto';
import {
  getScenePrompt,
  LanguageCode,
  buildProfilePrompt,
  ProfileData,
} from './prompts/index';
import { ChatSessionService } from './chat-session.service';
import { ProfileService } from '../profile/profile.service';

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
    private readonly profileService: ProfileService,
  ) {}

  async streamChat(
    dto: ChatStreamRequestDto,
    response: Response,
    requestSignal?: AbortSignal,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('ARK_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException('请先配置 ARK_API_KEY');
    }

    // 注入场景 prompt（包含档案提示词）
    const messages = await this.injectScenePrompt(dto);

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

    try {
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

      this.writeSseEvent(response, 'start', { model: ARK_MODEL });
      assistantContent = await this.pipeArkStream(
        upstreamResponse.body,
        response,
        upstreamController,
      );
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
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // 1. 最高优先级：学习档案提示词
    if (dto.language) {
      try {
        // TODO: 从认证中间件获取用户ID，暂时使用临时用户ID
        const tempUserId = 1;
        const profile = await this.profileService.getProfile(
          tempUserId,
          dto.language,
        );
        if (profile) {
          const profilePrompt = buildProfilePrompt(
            {
              level: profile.level as ProfileData['level'],
              motivations: profile.motivations,
              goals: profile.goals,
              dailyTime: profile.dailyTime,
            },
            dto.language,
          );
          messages.push({
            role: 'system',
            content: profilePrompt,
          });
        }
      } catch (error) {
        // 档案获取失败不应影响对话，记录日志后继续
        console.error('Failed to get profile for prompt injection:', error);
      }
    }

    // 2. 次优先级：场景提示词
    if (dto.scenario && dto.language) {
      const scenePrompt = getScenePrompt(dto.scenario, dto.language);
      if (scenePrompt) {
        messages.push({
          role: 'system',
          content: scenePrompt,
        });
      }
    }

    // 3. 用户消息
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
          const delta = this.handleSseSegment(segment, response);
          if (delta) {
            collectedContent += delta;
          }
        }
      }

      if (buffer.trim()) {
        const delta = this.handleSseSegment(buffer, response);
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

  private handleSseSegment(segment: string, response: Response): string | null {
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
      }
    }

    return collectedDelta || null;
  }

  private writeSseEvent(
    response: Response,
    event: 'start' | 'delta' | 'done' | 'error',
    data: Record<string, unknown>,
  ): void {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
