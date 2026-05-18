import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class DemoThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: FastifyRequest): Promise<string> {
    // trustProxy: true 환경에서 Fastify는 X-Forwarded-For를 파싱해
    // req.ips 배열(신뢰된 홉 순서)을 채운다. 첫 번째 값이 실제 클라이언트 IP.
    // req.ip만 쓰면 프록시 체인 마지막 홉만 반영되므로 ips[0]을 우선 사용한다.
    const ip = req.ips?.[0] ?? req.ip ?? 'unknown';
    return Promise.resolve(ip);
  }
}
