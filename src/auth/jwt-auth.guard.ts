import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { RequestWithUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & Partial<RequestWithUser>>();
    const authorization = request.headers.authorization;

    if (Array.isArray(authorization)) {
      throw new UnauthorizedException('登录凭证无效');
    }

    const token = this.authService.extractBearerToken(authorization);
    request.user = this.authService.verifyToken(token);

    return true;
  }
}
