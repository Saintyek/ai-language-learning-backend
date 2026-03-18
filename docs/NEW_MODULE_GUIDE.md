# 新增模块快速指南

本指南说明如何快速添加新模块并自动生成 API 文档。

---

## 🚀 快速开始（5 步）

### 第 1 步：创建模块目录结构

```
src/
└── your-module/
    ├── your-module.module.ts
    ├── your-module.controller.ts
    ├── your-module.service.ts
    ├── your-module.entity.ts (可选)
    └── dto/
        ├── create-xxx.dto.ts
        └── update-xxx.dto.ts
```

---

### 第 2 步：编写 Controller（关键！）

**文件：** `src/your-module/your-module.controller.ts`

```typescript
import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { YourModuleService } from './your-module.service';
import { CreateXxxDto } from './dto/create-xxx.dto';

@ApiTags('your-module')  // ← 1. 必须添加！定义文档分组
@Controller('your-module')
export class YourModuleController {
  constructor(private readonly service: YourModuleService) {}

  @Post('xxx')
  @ApiOperation({ 
    summary: '简短的接口标题', 
    description: '详细的接口描述（可选）' 
  })  // ← 2. 添加接口描述
  @ApiCreatedResponse({ description: '创建成功的描述' })  // ← 3. 添加响应描述
  async create(@Body() dto: CreateXxxDto) {
    return this.service.create(dto);
  }

  @Get('xxx')
  @ApiOperation({ summary: '获取列表' })
  @ApiOkResponse({ description: '获取成功' })
  async findAll() {
    return this.service.findAll();
  }
}
```

---

### 第 3 步：编写 DTO（关键！）

**文件：** `src/your-module/dto/create-xxx.dto.ts`

```typescript
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';  // ← 1. 导入

export class CreateXxxDto {
  @ApiProperty({
    description: '字段描述',
    example: '示例值',
    required: true,  // 可选，默认为 true
  })  // ← 2. 每个字段都要加！
  @IsString()
  name: string;

  @ApiProperty({
    description: '可选字段示例',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  count?: number;
}
```

---

### 第 4 步：编写 Module

**文件：** `src/your-module/your-module.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YourModuleController } from './your-module.controller';
import { YourModuleService } from './your-module.service';
import { YourEntity } from './your-module.entity';

@Module({
  imports: [TypeOrmModule.forFeature([YourEntity])],
  controllers: [YourModuleController],
  providers: [YourModuleService],
})
export class YourModuleModule {}
```

---

### 第 5 步：集成到 AppModule 并生成文档

**文件：** `src/app.module.ts`

```typescript
import { YourModuleModule } from './your-module/your-module.module';

@Module({
  imports: [
    UserModule,
    YourModuleModule,  // ← 添加新模块
  ],
})
export class AppModule {}
```

**最后，重新生成文档：**

```bash
npm run gen:openapi && npm run gen:types
```

---

## ✅ 检查清单

添加新模块后，确保：

- [ ] Controller 上有 `@ApiTags('模块名')`
- [ ] 每个接口方法上有 `@ApiOperation()`
- [ ] 每个接口有 `@ApiCreatedResponse()` 或 `@ApiOkResponse()`
- [ ] DTO 的每个字段上有 `@ApiProperty()`
- [ ] Module 已导入到 AppModule
- [ ] 运行了 `npm run gen:openapi && npm run gen:types`

---

## 📝 常用 Swagger 装饰器速查表

### Controller 装饰器

| 装饰器 | 用途 | 示例 |
|--------|------|------|
| `@ApiTags('tag-name')` | 接口分组 | `@ApiTags('auth')` |
| `@ApiOperation({...})` | 接口描述 | `{ summary: '登录', description: '...' }` |

### 响应装饰器

| 装饰器 | 用途 |
|--------|------|
| `@ApiOkResponse({ description: '...' })` | 200 响应 |
| `@ApiCreatedResponse({ description: '...' })` | 201 响应 |
| `@ApiBadRequestResponse({ description: '...' })` | 400 响应 |
| `@ApiUnauthorizedResponse({ description: '...' })` | 401 响应 |
| `@ApiNotFoundResponse({ description: '...' })` | 404 响应 |
| `@ApiConflictResponse({ description: '...' })` | 409 响应 |

### DTO 装饰器

| 装饰器属性 | 说明 |
|-----------|------|
| `description` | 字段描述 |
| `example` | 示例值 |
| `required` | 是否必填（默认 true） |
| `type` | 字段类型（可选，通常自动推断） |

---

## 💡 完整示例

### 示例：新增「单词学习」模块

```typescript
// src/vocabulary/vocabulary.controller.ts
import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { VocabularyService } from './vocabulary.service';
import { CreateWordDto } from './dto/create-word.dto';

@ApiTags('vocabulary')
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly service: VocabularyService) {}

  @Post('words')
  @ApiOperation({ summary: '添加单词', description: '创建新单词条目' })
  @ApiCreatedResponse({ description: '单词创建成功' })
  async createWord(@Body() dto: CreateWordDto) {
    return this.service.createWord(dto);
  }

  @Get('words')
  @ApiOperation({ summary: '获取单词列表' })
  @ApiOkResponse({ description: '获取成功' })
  async getWords() {
    return this.service.getWords();
  }
}
```

```typescript
// src/vocabulary/dto/create-word.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWordDto {
  @ApiProperty({
    description: '英文单词',
    example: 'hello',
  })
  @IsString()
  word: string;

  @ApiProperty({
    description: '中文释义',
    example: '你好',
  })
  @IsString()
  meaning: string;

  @ApiProperty({
    description: '例句（可选）',
    example: 'Hello, world!',
    required: false,
  })
  @IsOptional()
  @IsString()
  example?: string;
}
```

---

就这么简单！按照这个模式，任何新模块都能自动生成文档！🎉
