import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ChatStreamRequestDto } from './dto/chat-stream-request.dto';

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

const ARK_API_URL =
  'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = 'doubao-1-5-lite-32k-250115';
const ARK_REQUEST_TIMEOUT_MS = 60_000;
const ARK_TEMPERATURE = 0.3;
const ARK_MAX_TOKENS = 150;

@Injectable()
export class ChatService {
  constructor(private readonly configService: ConfigService) {}

  async streamChat(
    dto: ChatStreamRequestDto,
    response: Response,
    requestSignal?: AbortSignal,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('ARK_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException('请先配置 ARK_API_KEY');
    }

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
            messages: dto.messages,
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
        throw new BadGatewayException(
          errorText || 'Ark 流式请求失败',
        );
      }

      this.writeSseEvent(response, 'start', { model: ARK_MODEL });
      await this.pipeArkStream(upstreamResponse.body, response, upstreamController);
      this.writeSseEvent(response, 'done', { model: ARK_MODEL });
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

  private async pipeArkStream(
    stream: ReadableStream<Uint8Array>,
    response: Response,
    upstreamController: AbortController,
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          this.handleSseSegment(segment, response);
        }
      }

      if (buffer.trim()) {
        this.handleSseSegment(buffer, response);
      }
    } finally {
      upstreamController.abort('stream_completed');
      reader.releaseLock();
    }
  }

  private handleSseSegment(segment: string, response: Response): void {
    const lines = segment
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'));

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
      }
    }
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
