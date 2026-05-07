import { Controller, Post, Res, Body, Req } from '@nestjs/common';
import type { Response } from 'express';
import { TtsService } from './tts.service';
import { TTSStreamRequestDto } from './dto/tts-stream.dto';

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post('stream')
  async streamTTS(
    @Body() dto: TTSStreamRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const signal = req.signal;

    try {
      // 设置 TTS 语言
      if (dto.language) {
        this.ttsService.setLanguage(dto.language);
      }

      // 注册音频回调
      const unsubscribeAudio = this.ttsService.onAudio((audio: string) => {
        this.writeSseEvent(res, 'audio', { audio });
      });

      // 注册错误回调
      const unsubscribeError = this.ttsService.onError((error: string) => {
        this.writeSseEvent(res, 'error', { message: error });
      });

      // 监听客户端断开
      const abortHandler = () => {
        unsubscribeAudio();
        unsubscribeError();
      };

      signal?.addEventListener('abort', abortHandler, { once: true });

      // 发送就绪事件
      this.writeSseEvent(res, 'ready', {});

      // 发送文本进行合成
      if (dto.text) {
        await this.ttsService.sendText(dto.text);
        await this.ttsService.finish();
      }

      // 清理
      signal?.removeEventListener('abort', abortHandler);
      unsubscribeAudio();
      unsubscribeError();
      this.writeSseEvent(res, 'done', {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.writeSseEvent(res, 'error', { message });
    } finally {
      res.end();
    }
  }

  /**
   * 写入 SSE 事件
   */
  private writeSseEvent(
    res: Response,
    event: 'ready' | 'audio' | 'done' | 'error',
    data: Record<string, unknown>,
  ): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
