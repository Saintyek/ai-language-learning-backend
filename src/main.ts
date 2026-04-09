import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 设置全局 API 前缀 /api
  app.setGlobalPrefix('api');

  // 配置全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动去除未在 DTO 中定义的属性
      forbidNonWhitelisted: true, // 如果有未定义的属性，抛出错误
      transform: true, // 自动转换类型（如字符串转数字）
    }),
  );

  // 配置 Swagger 文档（通用配置，新增模块无需修改此处）
  const config = new DocumentBuilder()
    .setTitle('AI 语言学习 API')
    .setDescription('AI 语言学习平台后端接口文档')
    .setVersion('1.0')
    .addServer('http://localhost:3000', '本地开发环境')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // 设置 Swagger UI 路径（注意：Swagger UI 路径不使用全局前缀）
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log('应用已启动，监听端口: 3000');
  console.log('API 文档地址: http://localhost:3000/api-docs');
}
void bootstrap();
