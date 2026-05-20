'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useAdminStats,
  useAdminKeywords,
  useAdminDeleteUser,
  useAdminSetUserActive,
  useAdminChangeUserPassword,
} from '@/lib/queries';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AdminPageGuard } from '@/components/admin-page-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Activity,
  MessageSquare,
  DollarSign,
  KeyRound,
  FolderOpen,
  ChevronRight,
  Trash2,
  KeySquare,
  PowerOff,
  Power,
  LogOut,
} from 'lucide-react';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return '$0.00';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-5 py-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-blue-700" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-stone-500 mb-0.5">{label}</p>
        <p className="text-lg font-semibold text-stone-900 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-5 py-4 flex items-start gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-md bg-stone-100 shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-3 w-20 bg-stone-100 rounded" />
        <div className="h-5 w-28 bg-stone-100 rounded" />
      </div>
    </div>
  );
}

interface PasswordModalProps {
  username: string;
  onClose: () => void;
  onConfirm: (pw: string) => Promise<void>;
}

function PasswordModal({ username, onClose, onConfirm }: PasswordModalProps) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return;
    setLoading(true);
    try {
      await onConfirm(pw);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 shadow-xl p-6 mx-4">
        <h2 className="text-sm font-semibold text-stone-900 mb-1">비밀번호 변경</h2>
        <p className="text-xs text-stone-400 mb-4">
          <span className="font-medium text-stone-600">{username}</span>의 새 비밀번호를 입력하세요.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            placeholder="새 비밀번호 (8자 이상)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || pw.length < 8} className="flex-1">
              {loading ? '변경 중...' : '변경'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type TabId = 'users' | 'keywords';

function AdminDashboard() {
  const router = useRouter();
  const { clear, refreshToken } = useAuthStore();
  const [tab, setTab] = useState<TabId>('users');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<{ id: string; username: string } | null>(null);

  const { data: stats, isLoading: statsLoading, isError: statsError } = useAdminStats();
  const { data: keywords, isLoading: kwLoading, isError: kwError } = useAdminKeywords(100);

  const deleteUser = useAdminDeleteUser();
  const setUserActive = useAdminSetUserActive();
  const changePassword = useAdminChangeUserPassword();

  async function handleLogout() {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clear();
    router.push('/login');
  }

  async function handleDelete(id: string, username: string) {
    try {
      await deleteUser.mutateAsync(id);
      setPendingDeleteId(null);
      toast.success(`"${username}" 삭제됨`);
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  }

  async function handleToggleActive(id: string, username: string, currentlyActive: boolean) {
    try {
      await setUserActive.mutateAsync({ id, isActive: !currentlyActive });
      toast.success(currentlyActive ? `"${username}" 사용 중지됨` : `"${username}" 활성화됨`);
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  }

  async function handleChangePassword(id: string, newPassword: string) {
    try {
      await changePassword.mutateAsync({ id, newPassword });
      toast.success('비밀번호가 변경되었습니다.');
    } catch {
      toast.error('비밀번호 변경에 실패했습니다.');
      throw new Error('password change failed');
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="관리자 대시보드"
        subtitle="전체 유저 대화 통계"
        right={
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
        }
      />

      <main className={`${CONTENT_WIDTH} py-8 flex flex-col gap-6`}>
        {(statsError || kwError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            통계를 불러오지 못했습니다.
          </div>
        )}

        {/* 빠른 메뉴 */}
        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-3">관리 메뉴</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="/settings/provider"
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3.5 shadow-sm hover:border-stone-300 hover:shadow transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <KeyRound className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">API 설정</p>
                  <p className="text-xs text-stone-400">AI Provider 키 등록</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-stone-300" />
            </Link>
            <Link
              href="/"
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3.5 shadow-sm hover:border-stone-300 hover:shadow transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-stone-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">워크스페이스</p>
                  <p className="text-xs text-stone-400">문서 업로드 · 페르소나 설정</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-stone-300" />
            </Link>
          </div>
        </section>

        {/* 요약 카드 */}
        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-3">플랫폼 요약</h2>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                label="총 유저"
                value={String(stats?.totalUsers ?? 0)}
                icon={Users}
                sub={`활성(30일): ${stats?.activeUsers30d ?? 0}명`}
              />
              <SummaryCard
                label="총 세션"
                value={String(stats?.totalSessions ?? 0)}
                icon={Activity}
              />
              <SummaryCard
                label="총 메시지"
                value={String(stats?.totalMessages ?? 0)}
                icon={MessageSquare}
                sub={`입력 ${formatTokens(stats?.totalInputTokens ?? 0)} / 출력 ${formatTokens(stats?.totalOutputTokens ?? 0)} 토큰`}
              />
              <SummaryCard
                label="추정 비용"
                value={formatCost(stats?.estimatedCostUsd ?? 0)}
                icon={DollarSign}
                sub="채팅 토큰 기준"
              />
            </div>
          )}
        </section>

        {/* 탭 */}
        <section>
          <div className="flex gap-1 border-b border-stone-200 mb-4">
            {([
              { id: 'users', label: '유저 관리' },
              { id: 'keywords', label: '질문 현황' },
            ] as { id: TabId; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === id
                    ? 'border-stone-800 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'users' && (
            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="text-sm font-medium text-stone-700">유저 관리</h2>
              </div>
              {statsLoading ? (
                <div className="flex flex-col gap-0">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-5 py-3 border-b border-stone-50 animate-pulse flex items-center gap-4">
                      <div className="h-3 w-40 bg-stone-100 rounded" />
                      <div className="h-3 w-12 bg-stone-100 rounded ml-auto" />
                      <div className="h-3 w-12 bg-stone-100 rounded" />
                      <div className="h-3 w-16 bg-stone-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : !stats || stats.byUser.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-stone-400">
                  등록된 유저가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-100">
                        <th className="px-5 py-2.5 text-left font-medium">아이디</th>
                        <th className="px-5 py-2.5 text-right font-medium">세션</th>
                        <th className="px-5 py-2.5 text-right font-medium">메시지</th>
                        <th className="px-5 py-2.5 text-right font-medium">비용</th>
                        <th className="px-5 py-2.5 text-right font-medium">최근 활동</th>
                        <th className="px-5 py-2.5 text-right font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byUser.map((u) => (
                        <tr
                          key={u.userId}
                          className={`border-b border-stone-50 last:border-0 transition-colors ${
                            u.isActive ? 'hover:bg-stone-50' : 'bg-stone-50/50 opacity-60'
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-stone-900 truncate max-w-[160px]">
                            <div className="flex items-center gap-2">
                              {!u.isActive && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">
                                  중지
                                </span>
                              )}
                              {u.username}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-stone-600">{u.sessionCount}</td>
                          <td className="px-5 py-3 text-right text-stone-600">{u.messageCount}</td>
                          <td className="px-5 py-3 text-right text-stone-500">
                            {u.inputTokens + u.outputTokens === 0 ? '—' : formatCost(u.costUsd)}
                          </td>
                          <td className="px-5 py-3 text-right text-stone-400">
                            {formatDate(u.lastActivityAt)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {pendingDeleteId === u.userId ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-red-600 font-medium">삭제할까요?</span>
                                <Button
                                  size="sm"
                                  onClick={() => handleDelete(u.userId, u.username)}
                                  className="h-6 px-2 text-[11px] bg-red-500 hover:bg-red-600 text-white"
                                >
                                  삭제
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPendingDeleteId(null)}
                                  className="h-6 px-2 text-[11px]"
                                >
                                  취소
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  title={u.isActive ? '사용 중지' : '활성화'}
                                  onClick={() => handleToggleActive(u.userId, u.username, u.isActive)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    u.isActive
                                      ? 'text-stone-400 hover:text-orange-500 hover:bg-orange-50'
                                      : 'text-green-600 hover:bg-green-50'
                                  }`}
                                >
                                  {u.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  title="비밀번호 변경"
                                  onClick={() => setPasswordModalUser({ id: u.userId, username: u.username })}
                                  className="p-1.5 rounded-md text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                  <KeySquare className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  title="삭제"
                                  onClick={() => setPendingDeleteId(u.userId)}
                                  className="p-1.5 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'keywords' && (
            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-stone-700">질문 현황</h2>
                {keywords && (
                  <span className="text-xs text-stone-400">
                    상위 {keywords.total}개 질문
                  </span>
                )}
              </div>
              {kwLoading ? (
                <div className="flex flex-col gap-0">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="px-5 py-3 border-b border-stone-50 animate-pulse flex items-center gap-4">
                      <div className="h-3 w-64 bg-stone-100 rounded" />
                      <div className="h-3 w-8 bg-stone-100 rounded ml-auto" />
                      <div className="h-3 w-24 bg-stone-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : !keywords || keywords.items.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-stone-400">
                  질문 데이터가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-100">
                        <th className="px-5 py-2.5 text-left font-medium">질문</th>
                        <th className="px-5 py-2.5 text-right font-medium w-16">횟수</th>
                        <th className="px-5 py-2.5 text-right font-medium">최근 사용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.items.map((kw, i) => (
                        <tr
                          key={i}
                          className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors"
                        >
                          <td className="px-5 py-2.5 text-stone-800 max-w-[480px] truncate">
                            {kw.content}
                          </td>
                          <td className="px-5 py-2.5 text-right font-medium text-stone-600">
                            {kw.count}
                          </td>
                          <td className="px-5 py-2.5 text-right text-stone-400">
                            {formatDate(kw.lastUsedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {passwordModalUser && (
        <PasswordModal
          username={passwordModalUser.username}
          onClose={() => setPasswordModalUser(null)}
          onConfirm={(pw) => handleChangePassword(passwordModalUser.id, pw)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminPageGuard>
      <AdminDashboard />
    </AdminPageGuard>
  );
}
