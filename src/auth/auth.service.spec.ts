import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') {
        return 'test-secret';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '1d';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  it('签发并校验包含真实用户 ID 的 JWT', () => {
    const service = new AuthService(configService);

    const token = service.signUserToken({
      id: 42,
      email: 'learner@example.com',
    });

    expect(service.verifyToken(token)).toMatchObject({
      id: 42,
      email: 'learner@example.com',
    });
  });

  it('拒绝无效 JWT', () => {
    const service = new AuthService(configService);

    expect(() => service.verifyToken('invalid.token')).toThrow(
      UnauthorizedException,
    );
  });
});
