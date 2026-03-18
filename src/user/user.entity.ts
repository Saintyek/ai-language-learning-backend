import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 用户实体
 * 表示系统中的用户信息
 */
@Entity('users')
export class User {
  /**
   * 用户ID（主键，自增）
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 用户名
   */
  @Column({ unique: true, length: 50 })
  username: string;

  /**
   * 邮箱地址
   */
  @Column({ unique: true, length: 100 })
  email: string;

  /**
   * 用户密码（加密存储）
   */
  @Column({ length: 255 })
  password: string;

  /**
   * 创建时间
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * 更新时间
   */
  @UpdateDateColumn()
  updatedAt: Date;
}
