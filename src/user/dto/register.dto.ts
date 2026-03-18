import { IsString, IsEmail, MinLength, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 自定义验证器：验证两次密码是否一致
 */
@ValidatorConstraint({ name: 'isPasswordMatching', async: false })
export class IsPasswordMatchingConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const { password } = args.object as any;
    return password === confirmPassword;
  }

  defaultMessage(args: ValidationArguments) {
    return '两次输入的密码不一致';
  }
}

/**
 * 注册数据传输对象
 * 用于验证用户注册时的输入数据
 */
export class RegisterDto {
  /**
   * 用户名
   * 要求：至少 3 个字符
   */
  @ApiProperty({
    description: '用户名',
    example: 'testuser',
    minLength: 3,
  })
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(3, { message: '用户名至少需要 3 个字符' })
  username: string;

  /**
   * 邮箱地址
   * 要求：有效的邮箱格式
   */
  @ApiProperty({
    description: '邮箱地址',
    example: 'test@example.com',
  })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  /**
   * 密码
   * 要求：至少 6 个字符
   */
  @ApiProperty({
    description: '密码',
    example: '123456',
    minLength: 6,
  })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码至少需要 6 个字符' })
  password: string;

  /**
   * 确认密码
   * 要求：与密码一致
   */
  @ApiProperty({
    description: '确认密码',
    example: '123456',
  })
  @IsString({ message: '确认密码必须是字符串' })
  @Validate(IsPasswordMatchingConstraint)
  confirmPassword: string;
}
