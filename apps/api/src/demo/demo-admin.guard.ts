import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class DemoAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const expected = this.config.get<string>('DEMO_ADMIN_TOKEN') ?? '';

    if (!expected || token.length !== expected.length) return false;

    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    return timingSafeEqual(tokenBuf, expectedBuf);
  }
}
