import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { ChatSession, ChatMessage } from './chat-session.entity';
import { GetSessionsQueryDto } from './dto/get-sessions-query.dto';

/**
 * 聊天会话服务
 * 处理聊天会话和消息的业务逻辑
 */
@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatSession)
    private sessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
  ) {}

  /**
   * 获取用户的聊天会话列表（分页）
   * @param userId 用户ID
   * @param query 分页查询参数
   * @returns 会话列表和总数
   */
  async getSessionList(
    userId: number,
    query: GetSessionsQueryDto,
  ): Promise<{
    data: ChatSession[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<ChatSession> = {
      where: { userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
      select: [
        'id',
        'userId',
        'title',
        'scenario',
        'language',
        'createdAt',
        'updatedAt',
      ],
    };

    const [data, total] =
      await this.sessionRepository.findAndCount(findOptions);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * 获取单个会话详情（包含消息）
   * @param sessionId 会话ID（UUID）
   * @param userId 用户ID（用于权限验证）
   * @returns 会话详情
   */
  async getSessionDetail(
    sessionId: string,
    userId: number,
  ): Promise<ChatSession | null> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['messages'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    return session;
  }

  /**
   * 创建新会话
   * @param userId 用户ID
   * @param title 会话标题
   * @param scenario 场景标识
   * @param language 目标语言
   * @returns 创建的会话
   */
  async createSession(
    userId: number,
    title: string = '新对话',
    scenario?: string,
    language?: string,
  ): Promise<ChatSession> {
    const session = this.sessionRepository.create({
      userId,
      title,
      scenario,
      language,
    });

    return this.sessionRepository.save(session);
  }

  /**
   * 添加消息到会话
   * @param sessionId 会话ID（UUID）
   * @param role 消息角色
   * @param content 消息内容
   * @returns 创建的消息
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<ChatMessage> {
    const message = this.messageRepository.create({
      sessionId,
      role,
      content,
    });

    return this.messageRepository.save(message);
  }

  /**
   * 更新会话标题
   * @param sessionId 会话ID（UUID）
   * @param userId 用户ID
   * @param title 新标题
   * @returns 更新后的会话
   */
  async updateSessionTitle(
    sessionId: string,
    userId: number,
    title: string,
  ): Promise<ChatSession | null> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return null;
    }

    session.title = title;
    return this.sessionRepository.save(session);
  }

  /**
   * 删除会话（及其所有消息）
   * @param sessionId 会话ID（UUID）
   * @param userId 用户ID
   * @returns 是否删除成功
   */
  async deleteSession(sessionId: string, userId: number): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return false;
    }

    await this.sessionRepository.remove(session);
    return true;
  }
}
