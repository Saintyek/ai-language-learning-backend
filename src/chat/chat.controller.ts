import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
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
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatStreamRequestDto } from './dto/chat-stream-request.dto';
import { ChatSessionService } from './chat-session.service';
import { GetSessionsQueryDto } from './dto/get-sessions-query.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatSessionService: ChatSessionService,
  ) {}

  @Post('messages/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '流式聊天',
    description: '通过 SSE 返回聊天增量内容',
  })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiBody({ type: ChatStreamRequestDto })
  @ApiResponse({
    status: 200,
    description: 'SSE 流式返回 start/delta/done/error 事件',
  })
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

  /**
   * 获取聊天会话列表
   * GET /chat/sessions
   */
  @Get('sessions')
  @ApiOperation({
    summary: '获取聊天会话列表',
    description: '分页获取用户的聊天会话列表',
  })
  @ApiQuery({ type: GetSessionsQueryDto })
  @ApiResponse({ status: 200, description: '返回会话列表' })
  async getSessions(@Query() query: GetSessionsQueryDto) {
    // TODO: 从认证中间件获取用户ID，暂时使用临时用户ID
    const tempUserId = 1;
    const result = await this.chatSessionService.getSessionList(
      tempUserId,
      query,
    );
    return {
      message: '获取成功',
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  /**
   * 获取单个会话详情
   * GET /chat/sessions/:id
   */
  @Get('sessions/:id')
  @ApiOperation({
    summary: '获取会话详情',
    description: '获取单个会话的完整信息，包含所有消息',
  })
  @ApiParam({ name: 'id', type: String, description: '会话ID（UUID）' })
  @ApiResponse({ status: 200, description: '返回会话详情' })
  @ApiResponse({ status: 404, description: '会话不存在' })
  async getSessionDetail(@Param('id') id: string) {
    // TODO: 从认证中间件获取用户ID，暂时使用临时用户ID
    const tempUserId = 1;
    const session = await this.chatSessionService.getSessionDetail(
      id,
      tempUserId,
    );

    if (!session) {
      return {
        message: '会话不存在',
        data: null,
      };
    }

    return {
      message: '获取成功',
      data: session,
    };
  }

  /**
   * 创建新会话
   * POST /chat/sessions
   */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建新会话', description: '创建一个新的聊天会话' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: '新对话' },
        scenario: { type: 'string', example: 'role/扮演老师' },
        language: { type: 'string', example: 'us' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '会话创建成功' })
  async createSession(
    @Body()
    body: {
      title?: string;
      scenario?: string;
      language?: string;
    },
  ) {
    // TODO: 从认证中间件获取用户ID，暂时使用临时用户ID
    const tempUserId = 1;
    const session = await this.chatSessionService.createSession(
      tempUserId,
      body.title,
      body.scenario,
      body.language,
    );

    return {
      message: '创建成功',
      data: session,
    };
  }

  /**
   * 更新会话标题
   * PUT /chat/sessions/:id/title
   */
  @Put('sessions/:id/title')
  @ApiOperation({ summary: '更新会话标题', description: '更新指定会话的标题' })
  @ApiParam({ name: 'id', type: Number, description: '会话ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: '关于旅行英语的对话' },
      },
      required: ['title'],
    },
  })
  @ApiResponse({ status: 200, description: '标题更新成功' })
  @ApiResponse({ status: 404, description: '会话不存在' })
  async updateSessionTitle(
    @Param('id') id: string,
    @Body() body: { title: string },
  ) {
    // TODO: 从认证中间件获取用户ID，暂时使用临时用户ID
    const tempUserId = 1;
    const session = await this.chatSessionService.updateSessionTitle(
      id,
      tempUserId,
      body.title,
    );

    if (!session) {
      return {
        message: '会话不存在',
        data: null,
      };
    }

    return {
      message: '更新成功',
      data: session,
    };
  }

  /**
   * 删除会话
   * DELETE /chat/sessions/:id
   */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '删除会话',
    description: '删除指定的聊天会话及其所有消息',
  })
  @ApiParam({ name: 'id', type: String, description: '会话ID（UUID）' })
  @ApiResponse({ status: 200, description: '会话删除成功' })
  @ApiResponse({ status: 404, description: '会话不存在' })
  async deleteSession(@Param('id') id: string) {
    // TODO: 从认证中间件获取用户ID，暂时使用临时用户ID
    const tempUserId = 1;
    const success = await this.chatSessionService.deleteSession(id, tempUserId);

    if (!success) {
      return {
        message: '会话不存在',
        data: null,
      };
    }

    return {
      message: '删除成功',
      data: null,
    };
  }
}
