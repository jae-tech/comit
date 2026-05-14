'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      setTokens(res.data.accessToken, res.data.refreshToken);
      router.push('/');
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
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
          <h1 className="text-lg font-semibold text-stone-900 mb-1">로그인</h1>
          <p className="text-sm text-stone-500 mb-6">워크스페이스로 돌아오세요</p>

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
                placeholder="••••••••"
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
              {loading ? '로그인 중...' : '로그인'}
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
