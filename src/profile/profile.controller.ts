import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * 语言档案控制器
 * 处理语言档案相关的 HTTP 请求
 */
@ApiTags('profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * 获取指定语言的档案
   * GET /profile/:language
   */
  @Get(':language')
  @ApiOperation({
    summary: '获取语言档案',
    description: '获取用户指定语言的档案信息，如果不存在则返回 null',
  })
  @ApiOkResponse({ description: '返回语言档案信息，不存在时 data 为 null' })
  async getProfile(
    @Param('language') language: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const profile = await this.profileService.getProfile(user.id, language);
    return {
      message: '获取成功',
      data: profile,
    };
  }

  /**
   * 创建或更新语言档案
   * POST /profile/:language
   */
  @Post(':language')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '创建或更新语言档案',
    description: '创建或更新用户指定语言的档案',
  })
  @ApiOkResponse({ description: '档案保存成功' })
  @ApiResponse({ status: 400, description: '请求参数验证失败' })
  async upsertProfile(
    @Param('language') language: string,
    @Body() createProfileDto: CreateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const profile = await this.profileService.upsertProfile(
      user.id,
      language,
      createProfileDto,
    );
    return {
      message: '保存成功',
      data: profile,
    };
  }

  /**
   * 删除语言档案
   * DELETE /profile/:language
   */
  @Delete(':language')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '删除语言档案',
    description: '删除用户指定语言的档案',
  })
  @ApiOkResponse({ description: '删除成功' })
  @ApiResponse({ status: 404, description: '未找到该语言的档案' })
  async deleteProfile(
    @Param('language') language: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.profileService.deleteProfile(user.id, language);
    return {
      message: '删除成功',
    };
  }
}
