import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatStreamRequestDto } from './dto/chat-stream-request.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '流式聊天', description: '通过 SSE 返回聊天增量内容' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiBody({ type: ChatStreamRequestDto })
  @ApiResponse({ status: 200, description: 'SSE 流式返回 start/delta/done/error 事件' })
  @ApiResponse({ status: 400, description: '请求参数验证失败' })
  @ApiResponse({ status: 502, description: '上游 Ark 请求失败' })
  @ApiResponse({ status: 504, description: '上游 Ark 响应超时' })
  async streamMessages(
    @Body() dto: ChatStreamRequestDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const abortController = new AbortController();
    const abortStream = () => {
      if (!response.writableEnded && !abortController.signal.aborted) {
        abortController.abort('client_disconnected');
      }
    };

    request.on('aborted', abortStream);

    try {
      await this.chatService.streamChat(dto, response, abortController.signal);
    } finally {
      if (!response.writableEnded) {
        response.end();
      }
    }
  }
}
