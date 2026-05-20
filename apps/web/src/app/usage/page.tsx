'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useUsageSummary, useUsageDaily, useUsageSessions } from '@/lib/queries';
import { AdminPageGuard } from '@/components/admin-page-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { BarChart2, Zap, DollarSign, Database } from 'lucide-react';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(4)}`;
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
      <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
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

function UsagePage() {
  const router = useRouter();
  const { data: summary, isLoading: summaryLoading } = useUsageSummary();
  const { data: daily = [], isLoading: dailyLoading } = useUsageDaily(30);
  const { data: sessions = [], isLoading: sessionsLoading } = useUsageSessions(undefined, 20);

  const loading = summaryLoading || dailyLoading || sessionsLoading;
  const totalTokens = summary
    ? summary.totalInputTokens + summary.totalOutputTokens
    : 0;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="사용량 대시보드"
        subtitle="API 토큰 사용량 및 예상 비용"
        right={
          <button
            onClick={() => router.push('/')}
            className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
          >
            홈으로
          </button>
        }
      />

      <main className={`${CONTENT_WIDTH} py-8 flex flex-col gap-6`}>
        {/* 요약 카드 */}
        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-3">이번 달 요약</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                label="총 토큰"
                value={formatTokens(totalTokens)}
                icon={Zap}
                sub={`입력 ${formatTokens(summary?.totalInputTokens ?? 0)} / 출력 ${formatTokens(summary?.totalOutputTokens ?? 0)}`}
              />
              <SummaryCard
                label="예상 비용"
                value={formatCost(summary?.estimatedCostUsd ?? 0)}
                icon={DollarSign}
                sub="채팅 토큰 기준"
              />
              <SummaryCard
                label="임베딩 토큰"
                value={formatTokens(summary?.totalEmbeddingTokens ?? 0)}
                icon={Database}
                sub="문서 처리"
              />
              <SummaryCard
                label="워크스페이스"
                value={String(summary?.byWorkspace.length ?? 0)}
                icon={BarChart2}
                sub="활성 워크스페이스"
              />
            </div>
          )}
        </section>

        {/* 일별 차트 */}
        <section className="bg-white border border-stone-200 rounded-lg p-5">
          <h2 className="text-sm font-medium text-stone-700 mb-4">일별 토큰 사용량 (최근 30일)</h2>
          {loading ? (
            <div className="h-48 bg-stone-50 rounded animate-pulse" />
          ) : daily.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-stone-400">
              데이터가 없습니다. 채팅을 시작하면 사용량이 기록됩니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatTokens(v)}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e7e5e4',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  formatter={(value, name) => [
                    formatTokens(Number(value ?? 0)),
                    name === 'inputTokens' ? '입력 토큰' : '출력 토큰',
                  ]}
                  labelFormatter={(label) => `날짜: ${String(label)}`}
                />
                <Bar dataKey="inputTokens" stackId="a" fill="#bfdbfe" radius={[0, 0, 0, 0]} />
                <Bar dataKey="outputTokens" stackId="a" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#bfdbfe]" />
              <span className="text-xs text-stone-500">입력 토큰</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#1d4ed8]" />
              <span className="text-xs text-stone-500">출력 토큰</span>
            </div>
          </div>
        </section>

        {/* 워크스페이스별 요약 */}
        {!loading && (summary?.byWorkspace.length ?? 0) > 0 && (
          <section className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-medium text-stone-700">워크스페이스별 사용량</h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-400 border-b border-stone-100">
                  <th className="px-5 py-2.5 text-left font-medium">워크스페이스</th>
                  <th className="px-5 py-2.5 text-right font-medium">입력</th>
                  <th className="px-5 py-2.5 text-right font-medium">출력</th>
                  <th className="px-5 py-2.5 text-right font-medium">비용</th>
                </tr>
              </thead>
              <tbody>
                {summary?.byWorkspace.map((ws) => (
                  <tr key={ws.workspaceId} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-stone-900 truncate max-w-[160px]">
                      {ws.workspaceName}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-600">
                      {formatTokens(ws.inputTokens)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-600">
                      {formatTokens(ws.outputTokens)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-500">
                      {ws.inputTokens + ws.outputTokens === 0 ? '—' : formatCost(ws.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 세션별 드릴다운 */}
        <section className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-medium text-stone-700">최근 세션별 사용량</h2>
          </div>
          {loading ? (
            <div className="flex flex-col gap-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-3 border-b border-stone-50 animate-pulse flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3 w-36 bg-stone-100 rounded" />
                    <div className="h-2.5 w-24 bg-stone-100 rounded" />
                  </div>
                  <div className="h-3 w-20 bg-stone-100 rounded" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-stone-400">
              세션 데이터가 없습니다.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-400 border-b border-stone-100">
                  <th className="px-5 py-2.5 text-left font-medium">워크스페이스</th>
                  <th className="px-5 py-2.5 text-left font-medium hidden sm:table-cell">날짜</th>
                  <th className="px-5 py-2.5 text-right font-medium">메시지</th>
                  <th className="px-5 py-2.5 text-right font-medium">토큰</th>
                  <th className="px-5 py-2.5 text-right font-medium">비용</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => (
                  <tr key={sess.sessionId} className="border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-stone-900 truncate max-w-[120px]">
                      {sess.workspaceName}
                    </td>
                    <td className="px-5 py-2.5 text-stone-400 hidden sm:table-cell">
                      {new Date(sess.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-600">
                      {sess.messageCount}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-600">
                      {formatTokens(sess.inputTokens + sess.outputTokens)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-stone-500">
                      {sess.inputTokens + sess.outputTokens === 0 ? '—' : formatCost(sess.costUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

export default function UsagePageWrapper() {
  return (
    <AdminPageGuard>
      <UsagePage />
    </AdminPageGuard>
  );
}
