import { IsString, IsArray, IsIn, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 有效的语言水平列表
 */
export const VALID_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'master',
] as const;

/**
 * 有效的每日学习时间列表
 */
export const VALID_DAILY_TIMES = ['15min', '30min', '1hour', '1hour+'] as const;

/**
 * 创建/更新语言档案数据传输对象
 */
export class CreateProfileDto {
  /**
   * 当前水平
   */
  @ApiProperty({
    description: '当前语言水平',
    example: 'beginner',
    enum: VALID_LEVELS,
  })
  @IsString({ message: '水平必须是字符串' })
  @IsIn(VALID_LEVELS, { message: '水平必须是有效的选项' })
  level: string;

  /**
   * 学习动机
   */
  @ApiProperty({
    description: '学习动机列表',
    example: ['travel', 'work', 'hobby'],
    type: [String],
  })
  @IsArray({ message: '学习动机必须是数组' })
  @ArrayMinSize(1, { message: '至少选择一个学习动机' })
  @IsString({ each: true, message: '每个动机必须是字符串' })
  motivations: string[];

  /**
   * 学习目标
   */
  @ApiProperty({
    description: '学习目标列表',
    example: ['speak-fluently', 'pass-exam', 'business'],
    type: [String],
  })
  @IsArray({ message: '学习目标必须是数组' })
  @ArrayMinSize(1, { message: '至少选择一个学习目标' })
  @IsString({ each: true, message: '每个目标必须是字符串' })
  goals: string[];

  /**
   * 每日学习时间
   */
  @ApiProperty({
    description: '每日学习时间',
    example: '30min',
    enum: VALID_DAILY_TIMES,
  })
  @IsString({ message: '每日学习时间必须是字符串' })
  @IsIn(VALID_DAILY_TIMES, { message: '每日学习时间必须是有效的选项' })
  dailyTime: string;
}
