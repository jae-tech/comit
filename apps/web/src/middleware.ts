import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const demoDomain = process.env.DEMO_DOMAIN ?? 'demo.com.it';
  const isDemoDomain = host === demoDomain || host === `${demoDomain}:3000`;
  const isLocalhost = host.startsWith('localhost');

  if (isDemoDomain) {
    // demo.com.it 직접 접속 → /demo prefix 내부 rewrite (URL은 demo.com.it 유지)
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith('/demo')) {
      url.pathname = '/demo' + (url.pathname === '/' ? '' : url.pathname);
    }
    return NextResponse.rewrite(url);
  }

  if (!isLocalhost && req.nextUrl.pathname.startsWith('/demo')) {
    // 프로덕션 메인 도메인에서 /demo/* 접근 → demo.com.it으로 308 redirect
    const url = req.nextUrl.clone();
    url.host = demoDomain;
    url.pathname = url.pathname.replace(/^\/demo/, '') || '/';
    return NextResponse.redirect(url, 308);
  }

  // localhost/demo/* → 통과 (로컬 개발)
}

export const config = {
  matcher: ['/demo/:path*'],
};
