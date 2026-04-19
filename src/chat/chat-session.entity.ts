import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../user/user.entity';

/**
 * 聊天会话实体
 * 表示用户的聊天会话记录
 */
@Entity('chat_sessions')
export class ChatSession {
  /**
   * 会话ID（UUID）
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 关联的用户ID
   */
  @Column({ name: 'user_id' })
  userId: number;

  /**
   * 会话标题
   */
  @Column({ length: 1000, default: '新对话' })
  title: string;

  /**
   * 场景标识
   */
  @Column({ length: 100, nullable: true })
  scenario: string;

  /**
   * 目标学习语言
   */
  @Column({ length: 10, nullable: true })
  language: string;

  /**
   * 创建时间
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * 更新时间
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * 关联用户
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 会话中的消息列表
   */
  @OneToMany(() => ChatMessage, (message) => message.session, {
    cascade: true,
  })
  messages: ChatMessage[];
}

/**
 * 聊天消息实体
 * 表示聊天会话中的单条消息
 */
@Entity('chat_messages')
export class ChatMessage {
  /**
   * 消息ID（主键，自增）
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 关联的会话ID（UUID）
   */
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  /**
   * 消息角色：user 或 assistant
   */
  @Column({ length: 20 })
  role: 'user' | 'assistant';

  /**
   * 消息内容
   */
  @Column({ type: 'text' })
  content: string;

  /**
   * 创建时间
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * 关联会话
   */
  @ManyToOne(() => ChatSession, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;
}
