import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

const DEFAULT_EXPIRES_IN = '1d';

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  signUserToken(user: AuthenticatedUser): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + this.parseExpiresInSeconds(),
    };

    return this.signPayload(payload);
  }

  verifyToken(token: string): AuthenticatedUser {
    const payload = this.verifyAndDecodePayload(token);

    return {
      id: payload.sub,
      email: payload.email,
    };
  }

  extractBearerToken(authorization: string | undefined): string {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少登录凭证');
    }

    return authorization.slice('Bearer '.length).trim();
  }

  private signPayload(payload: JwtPayload): string {
    const header = this.encodeJson({ alg: 'HS256', typ: 'JWT' });
    const body = this.encodeJson(payload);
    const signature = this.sign(`${header}.${body}`);

    return `${header}.${body}.${signature}`;
  }

  private verifyAndDecodePayload(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('登录凭证无效');
    }

    const [header, body, signature] = parts;
    const expectedSignature = this.sign(`${header}.${body}`);
    if (!this.isSameSignature(signature, expectedSignature)) {
      throw new UnauthorizedException('登录凭证无效');
    }

    const payload = this.decodeJson<JwtPayload>(body);
    if (!Number.isFinite(payload.sub) || !payload.email) {
      throw new UnauthorizedException('登录凭证无效');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('登录凭证已过期');
    }

    return payload;
  }

  private sign(content: string): string {
    return createHmac('sha256', this.getSecret())
      .update(content)
      .digest('base64url');
  }

  private isSameSignature(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private encodeJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decodeJson<T>(value: string): T {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('登录凭证无效');
    }
  }

  private getSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('请先配置 JWT_SECRET');
    }
    return secret;
  }

  private parseExpiresInSeconds(): number {
    const expiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') ?? DEFAULT_EXPIRES_IN;
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 24 * 60 * 60;
    }

    const value = Number(match[1]);
    const unit = match[2];
    const unitSeconds: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return value * unitSeconds[unit];
  }
}
