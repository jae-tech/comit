'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginDto } from '@comit/shared';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComitLogo } from '@/components/comit-logo';

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
  });

  async function onSubmit(data: LoginDto) {
    try {
      const res = await authApi.login(data.username, data.password);
      setTokens(res.data.accessToken, res.data.refreshToken);
      try {
        const payload = JSON.parse(atob(res.data.accessToken.split('.')[1]));
        if (payload.username === 'demo') {
          router.push('/demo');
          return;
        }
        if (payload.role === 'admin') {
          router.push('/admin');
          return;
        }
      } catch {
        // JWT 파싱 실패 시 기본 경로로
      }
      router.push('/');
    } catch {
      setError('root', { message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <ComitLogo size={32} color="#1d4ed8" />
          <span className="text-base font-semibold text-stone-900 tracking-tight">Comit</span>
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900 mb-1">로그인</h1>
          <p className="text-sm text-stone-500 mb-6">워크스페이스로 돌아오세요</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-username" className="text-xs font-medium text-stone-600">아이디</label>
              <Input
                id="login-username"
                type="text"
                placeholder="username"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-stone-600">비밀번호</label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
            {errors.root && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
              {isSubmitting ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-stone-500">
          계정이 없으신가요?{' '}
          <Link href="/register" className="font-medium text-stone-900 hover:text-blue-700 transition-colors">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
