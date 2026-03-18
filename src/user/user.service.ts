import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * 用户服务
 * 处理用户相关的业务逻辑
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * 用户注册
   * @param registerDto 注册数据
   * @returns 创建的用户信息（不含密码）
   */
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    const { username, email, password } = registerDto;

    // 检查用户名是否已存在
    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new ConflictException('用户名已被使用');
    }

    // 检查邮箱是否已存在
    const existingEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('邮箱已被注册');
    }

    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建新用户
    const user = this.userRepository.create({
      username,
      email,
      password: hashedPassword,
    });

    // 保存用户到数据库
    const savedUser = await this.userRepository.save(user);

    // 返回用户信息，不包含密码
    const { password: _, ...result } = savedUser;
    return result;
  }

  /**
   * 用户登录
   * @param loginDto 登录数据
   * @returns 用户信息（不含密码）
   */
  async login(loginDto: LoginDto): Promise<Omit<User, 'password'>> {
    const { email, password } = loginDto;

    // 根据邮箱查找用户
    const user = await this.userRepository.findOne({
      where: { email },
    });

    // 检查用户是否存在
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 返回用户信息，不包含密码
    const { password: _, ...result } = user;
    return result;
  }
}
