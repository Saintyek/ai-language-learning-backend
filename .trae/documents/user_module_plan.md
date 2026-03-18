# 用户模块实现计划

## 项目概述

为 NestJS 项目实现完整的用户模块，包含用户注册和登录功能。

***

## \[ ] 任务 1: 安装必要的依赖包

* **Priority**: P0

* **Depends On**: None

* **Description**:

  * 安装 \`@nestjs/passport、passport、passport-local、@nestjs/jwt、@nestjs/jwt、bcrypt、class-validator、class-transformer

  * bcrypt 用于密码加密

  * class-validator/class-transformer 用于数据验证

* **Success Criteria**:

  * 所有依赖安装成功

  * package.json 更新正确

* **Test Requirements**:

  * `programmatic` TR-1.1: npm install 成功执行，无错误

  * `human-judgement` TR-1.2: package.json 中包含新安装的依赖

* **Notes**: 这些是实现认证和验证功能的基础依赖

***

## \[ ] 任务 2: 创建用户模块（User Module）

* **Priority**: P0

* **Depends On**: Task 1

* **Description**:

  * 创建 user 目录结构

  * 创建 user.module.ts

  * 创建 user.service.ts（业务逻辑）

  * 创建 user.controller.ts（控制器）

* **Success Criteria**:

  * 用户模块目录结构完整

  * 模块可以正常导入到 AppModule

* **Test Requirements**:

  * `programmatic` TR-2.1: 项目可以正常构建

  * `human-judgement` TR-2.2: 目录结构符合 NestJS 规范

* **Notes**: 遵循 NestJS 模块化设计原则

***

## \[ ] 任务 3: 创建 DTO（数据传输对象）

* **Priority**: P0

* **Depends On**: None

* **Description**:

  * 创建 register.dto.ts（注册数据验证）

  * 创建 login.dto.ts（登录数据验证）

  * 使用 class-validator 进行验证

* **Success Criteria**:

  * 用户名至少 3 个字符

  * 邮箱格式正确验证

  * 相同邮箱不可被重复注册

  * 密码至少 6 个字符

* **Test Requirements**:

  * `programmatic` TR-3.1: 无效数据会抛出验证错误

  * `human-judgement` TR-3.2: 错误提示清晰易懂

* **Notes**: 验证逻辑要完善，提示信息要友好

***

## \[ ] 任务 4: 实现用户注册功能

* **Priority**: P0

* **Depends On**: Task 2, Task 3

* **Description**:

  * 在 UserService 中实现注册方法

  * 使用 bcrypt 加密密码

  * 检查用户名和邮箱是否已存在

  * 保存用户到数据库

* **Success Criteria**:

  * 重复用户名/邮箱会返回错误

  * 密码被加密存储

  * 新用户成功保存到数据库

* **Test Requirements**:

  * `programmatic` TR-4.1: 可以成功注册新用户

  * `programmatic` TR-4.2: 重复注册返回 400 错误

  * `human-judgement` TR-4.3: 数据库中密码是加密的

* **Notes**: 密码加密是必须的，不能存明文

***

## \[ ] 任务 5: 实现用户登录功能

* **Priority**: P0

* **Depends On**: Task 4

* **Description**:

  * 在 UserService 中实现登录方法

  * 验证邮箱是否存在

  * 使用 bcrypt 验证密码

  * 返回登录成功信息

* **Success Criteria**:

  * 邮箱不存在返回错误

  * 密码错误返回错误

  * 验证成功返回用户信息（不含密码）

* **Test Requirements**:

  * `programmatic` TR-5.1: 正确的邮箱和密码登录成功

  * `programmatic` TR-5.2: 错误的邮箱或密码返回 401 错误

  * `human-judgement` TR-5.3: 返回信息中不包含密码

* **Notes**: 登录验证要安全，不泄露敏感信息

***

## \[ ] 任务 6: 创建 API 接口

* **Priority**: P0

* **Depends On**: Task 4, Task 5

* **Description**:

  * 在 UserController 中创建 POST /auth/register 接口

  * 在 UserController 中创建 POST /auth/login 接口

  * 添加适当的 HTTP 状态码

* **Success Criteria**:

  * 注册接口可访问

  * 登录接口可访问

  * 返回正确的 HTTP 状态码

* **Test Requirements**:

  * `programmatic` TR-6.1: POST /auth/register 返回 201

  * `programmatic` TR-6.2: POST /auth/login 返回 200

  * `human-judgement` TR-6.3: 接口文档清晰

* **Notes**: RESTful API 设计规范

***

## \[ ] 任务 7: 集成和测试

* **Priority**: P1

* **Depends On**: Task 6

* **Description**:

  * 将 UserModule 导入到 AppModule

  * 启动应用测试数据库连接

  * 测试注册和登录流程

  * 验证数据库表自动创建

* **Success Criteria**:

  * 应用正常启动

  * 数据库连接成功

  * 注册登录流程完整可用

* **Test Requirements**:

  * `programmatic` TR-7.1: npm run start:dev 成功启动

  * `programmatic` TR-7.2: 数据库中存在 users 表

  * `human-judgement` TR-7.3: 可以完整走通注册登录流程

* **Notes**: 完整的端到端测试

