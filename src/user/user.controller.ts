import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * 用户控制器
 * 处理用户相关的 HTTP 请求
 */
@ApiTags('auth')
@Controller('auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 用户注册接口
   * POST /auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册', description: '创建新用户账号' })
  @ApiCreatedResponse({ description: '注册成功，返回用户信息' })
  @ApiResponse({ status: 400, description: '请求参数验证失败' })
  @ApiResponse({ status: 409, description: '用户名或邮箱已存在' })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.userService.register(registerDto);
    return {
      message: '注册成功',
      data: user,
    };
  }

  /**
   * 用户登录接口
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录', description: '使用邮箱和密码登录' })
  @ApiOkResponse({ description: '登录成功，返回用户信息' })
  @ApiResponse({ status: 400, description: '请求参数验证失败' })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.userService.login(loginDto);
    return {
      message: '登录成功',
      data: user,
    };
  }
}
