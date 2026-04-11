import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { DigitalHumanModule } from './digital-human/digital-human.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    // 配置环境变量模块
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块无需再次导入
    }),
    // 配置 TypeORM 模块
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres', // 数据库类型
        host: configService.get<string>('DB_HOST'), // 数据库主机
        port: configService.get<number>('DB_PORT'), // 数据库端口
        username: configService.get<string>('DB_USERNAME'), // 数据库用户名
        password: configService.get<string>('DB_PASSWORD'), // 数据库密码
        database: configService.get<string>('DB_NAME'), // 数据库名称
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // 实体文件路径
        synchronize: configService.get<boolean>('DB_SYNC'), // 自动同步数据库结构（生产环境建议设为 false）
        logging: configService.get<boolean>('DB_LOGGING'), // 开启 SQL 日志
      }),
      inject: [ConfigService], // 注入 ConfigService
    }),
    // 导入用户模块
    UserModule,
    // 导入数字人模块
    DigitalHumanModule,
    // 导入聊天模块
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
