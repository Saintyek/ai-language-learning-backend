import { IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 登录数据传输对象
 * 用于验证用户登录时的输入数据
 */
export class LoginDto {
  /**
   * 邮箱地址
   */
  @ApiProperty({
    description: '邮箱地址',
    example: 'test@example.com',
  })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  /**
   * 密码
   */
  @ApiProperty({
    description: '密码',
    example: '123456',
  })
  @IsString({ message: '密码必须是字符串' })
  password: string;
}
