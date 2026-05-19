'use client';

import { useAdminStats } from '@/lib/queries';
import { AdminPageGuard } from '@/components/admin-page-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Users, Activity, MessageSquare, DollarSign } from 'lucide-react';

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

function AdminDashboard() {
  const { data: stats, isLoading, isError } = useAdminStats();

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="관리자 대시보드"
        subtitle="전체 유저 대화 통계"
        right={null}
      />

      <main className={`${CONTENT_WIDTH} py-8 flex flex-col gap-6`}>
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            통계를 불러오지 못했습니다.
          </div>
        )}

        {/* 요약 카드 */}
        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-3">플랫폼 요약</h2>
          {isLoading ? (
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

        {/* 유저별 통계 테이블 */}
        <section className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-medium text-stone-700">유저별 통계</h2>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-3 border-b border-stone-50 animate-pulse flex items-center gap-4">
                  <div className="h-3 w-40 bg-stone-100 rounded" />
                  <div className="h-3 w-12 bg-stone-100 rounded ml-auto" />
                  <div className="h-3 w-12 bg-stone-100 rounded" />
                  <div className="h-3 w-16 bg-stone-100 rounded" />
                  <div className="h-3 w-14 bg-stone-100 rounded" />
                </div>
              ))}
            </div>
          ) : !stats || stats.byUser.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-stone-400">
              유저 데이터가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-stone-400 border-b border-stone-100">
                    <th className="px-5 py-2.5 text-left font-medium">아이디</th>
                    <th className="px-5 py-2.5 text-right font-medium">세션</th>
                    <th className="px-5 py-2.5 text-right font-medium">메시지</th>
                    <th className="px-5 py-2.5 text-right font-medium">토큰</th>
                    <th className="px-5 py-2.5 text-right font-medium">비용</th>
                    <th className="px-5 py-2.5 text-right font-medium">최근 활동</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byUser.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors"
                    >
                      <td className="px-5 py-2.5 font-medium text-stone-900 truncate max-w-[200px]">
                        {u.username}
                      </td>
                      <td className="px-5 py-2.5 text-right text-stone-600">
                        {u.sessionCount}
                      </td>
                      <td className="px-5 py-2.5 text-right text-stone-600">
                        {u.messageCount}
                      </td>
                      <td className="px-5 py-2.5 text-right text-stone-600">
                        {formatTokens(u.inputTokens + u.outputTokens)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-stone-500">
                        {u.inputTokens + u.outputTokens === 0 ? '—' : formatCost(u.costUsd)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-stone-400">
                        {formatDate(u.lastActivityAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
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
