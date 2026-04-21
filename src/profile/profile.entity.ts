import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

/**
 * 语言档案实体
 * 存储用户的语言学习档案信息
 */
@Entity('language_profiles')
export class LanguageProfile {
  /**
   * 档案ID（主键，自增）
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 用户ID（外键关联 users 表）
   */
  @Column({ name: 'user_id' })
  userId: number;

  /**
   * 用户关联
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 学习语言
   */
  @Column({ length: 10 })
  language: string;

  /**
   * 当前水平
   */
  @Column({ length: 20 })
  level: string;

  /**
   * 学习动机
   */
  @Column({ type: 'text', array: true, default: '{}' })
  motivations: string[];

  /**
   * 学习目标
   */
  @Column({ type: 'text', array: true, default: '{}' })
  goals: string[];

  /**
   * 每日学习时间
   */
  @Column({ name: 'daily_time', length: 20 })
  dailyTime: string;

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
}
