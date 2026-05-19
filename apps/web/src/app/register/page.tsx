'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterDto } from '@comit/shared';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComitLogo } from '@/components/comit-logo';

export default function RegisterPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({
    resolver: zodResolver(RegisterSchema),
  });

  async function onSubmit(data: RegisterDto) {
    try {
      const res = await authApi.register(data.username, data.password);
      setTokens(res.data.accessToken, res.data.refreshToken);
      router.push('/');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError('root', {
        message: status === 409 ? '이미 사용 중인 아이디입니다.' : '회원가입에 실패했습니다.',
      });
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
          <h1 className="text-lg font-semibold text-stone-900 mb-1">회원가입</h1>
          <p className="text-sm text-stone-500 mb-6">무료로 시작하세요. API 키는 직접 연결합니다.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">아이디</label>
              <Input
                type="text"
                placeholder="영문, 숫자, _, - (2~32자)"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">비밀번호</label>
              <Input
                type="password"
                placeholder="8자 이상"
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
              {isSubmitting ? '처리 중...' : '계정 만들기'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-stone-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-stone-900 hover:text-blue-700 transition-colors">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
