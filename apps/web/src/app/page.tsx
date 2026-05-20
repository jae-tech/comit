'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useWorkspaces, useCreateWorkspace, useRemoveWorkspace } from '@/lib/queries';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Settings, LogOut, ChevronRight, MessageSquare, Trash2, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-stone-200 rounded-lg px-4 py-3.5 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-stone-100 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-36 bg-stone-100 rounded" />
              <div className="h-3 w-20 bg-stone-100 rounded" />
            </div>
          </div>
          <div className="flex gap-1">
            <div className="h-7 w-14 bg-stone-100 rounded-md" />
            <div className="h-7 w-16 bg-stone-100 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HomePage() {
  const router = useRouter();
  const { clear, refreshToken } = useAuthStore();
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: workspaces = [], isLoading } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const removeWorkspace = useRemoveWorkspace();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const ws = await createWorkspace.mutateAsync(newName.trim());
    setNewName('');
    setShowForm(false);
    router.push(`/workspaces/${ws.id}/documents`);
  }

  async function confirmRemove(id: string) {
    setPendingDeleteId(null);
    try {
      await removeWorkspace.mutateAsync(id);
      toast.success('워크스페이스가 삭제되었습니다.');
    } catch {
      toast.error('워크스페이스 삭제에 실패했습니다.');
    }
  }

  async function handleLogout() {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    clear();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader
        home
        right={
          <>
            <Button variant="ghost" size="sm" onClick={() => router.push('/usage')}>
              <BarChart2 className="h-4 w-4" />
              <span className="hidden sm:inline">사용량</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/settings/provider')}>
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">API 설정</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </>
        }
      />

      <main className={`${CONTENT_WIDTH} py-8`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 tracking-tight">워크스페이스</h1>
            <p className="text-sm text-stone-500 mt-0.5">문서를 업로드하고 AI와 대화하는 공간</p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              새 워크스페이스
            </Button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-4 flex gap-2 p-4 bg-white rounded-lg border border-stone-200 shadow-sm"
          >
            <Input
              placeholder="워크스페이스 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <Button type="submit" disabled={createWorkspace.isPending || !newName.trim()}>
              {createWorkspace.isPending ? '생성 중...' : '생성'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowForm(false); setNewName(''); }}
            >
              취소
            </Button>
          </form>
        )}

        {isLoading ? (
          <WorkspaceSkeleton />
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-stone-400">
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-stone-400" />
            </div>
            <p className="text-sm">아직 워크스페이스가 없습니다.</p>
            {!showForm && (
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                첫 워크스페이스 만들기
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="group bg-white border border-stone-200 rounded-lg px-4 py-3.5 flex items-center justify-between hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => router.push(`/workspaces/${ws.id}/chat`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{ws.name}</p>
                    {ws.personaName && (
                      <p className="text-xs text-stone-400 truncate">{ws.personaName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                  {pendingDeleteId === ws.id ? (
                    <>
                      <span className="text-xs text-red-600 font-medium mr-1">삭제할까요?</span>
                      <Button
                        size="sm"
                        onClick={() => confirmRemove(ws.id)}
                        className="h-7 px-2 text-xs bg-red-500 hover:bg-red-600 text-white"
                      >
                        삭제
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteId(null)}
                        className="h-7 px-2 text-xs text-stone-500"
                      >
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/workspaces/${ws.id}/documents`)}
                        className="text-stone-400 hover:text-stone-700"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline text-xs">문서</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/workspaces/${ws.id}/chat`)}
                      >
                        채팅
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDeleteId(ws.id)}
                        className="text-stone-300 hover:text-red-500 hover:bg-red-50"
                        aria-label={`"${ws.name}" 삭제`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomePage />
    </AuthGuard>
  );
}
