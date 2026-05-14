'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(email, password);
      setTokens(res.data.accessToken, res.data.refreshToken);
      router.push('/');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 409 ? '이미 사용 중인 이메일입니다.' : '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold text-stone-900 tracking-tight">Comit</span>
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900 mb-1">회원가입</h1>
          <p className="text-sm text-stone-500 mb-6">무료로 시작하세요. API 키는 직접 연결합니다.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">이메일</label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">비밀번호</label>
              <Input
                type="password"
                placeholder="8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? '처리 중...' : '계정 만들기'}
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
