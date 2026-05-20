'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { documentApi } from '@/lib/api';
import { useDocuments, useUploadDocument, useRemoveDocument } from '@/lib/queries';
import { AdminPageGuard } from '@/components/admin-page-guard';
import { AppHeader, CONTENT_WIDTH } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, MessageSquare, FileText, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Document {
  id: string;
  filename: string;
  status: string;
  fileSize: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:    { label: '대기',    icon: <Clock className="h-3 w-3" />,                    className: 'text-stone-400 bg-stone-100' },
  processing: { label: '처리 중', icon: <Loader2 className="h-3 w-3 animate-spin" />,    className: 'text-blue-600 bg-blue-50' },
  ready:      { label: '완료',    icon: <CheckCircle className="h-3 w-3" />,              className: 'text-green-700 bg-green-50' },
  failed:     { label: '실패',    icon: <XCircle className="h-3 w-3" />,                 className: 'text-red-600 bg-red-50' },
};

function DocumentStatusBadge({ docId, workspaceId, initialStatus, filename }: {
  docId: string;
  workspaceId: string;
  initialStatus: string;
  filename: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState(initialStatus === 'ready' ? 100 : 0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (status === 'ready' || status === 'failed') return;

    const token = localStorage.getItem('comit-auth')
      ? JSON.parse(localStorage.getItem('comit-auth')!).state?.accessToken
      : null;

    const url = `${documentApi.statusUrl(docId, workspaceId)}&token=${token ?? ''}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { status: string; progress: number };
      setStatus(data.status);
      setProgress(data.progress);
      if (data.status === 'ready' || data.status === 'failed') {
        es.close();
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          if (data.status === 'ready') {
            toast.success(`"${filename}" 임베딩 완료`);
          } else {
            toast.error(`"${filename}" 임베딩 실패 — 파일을 확인해주세요.`);
          }
        }
      }
    };

    es.onerror = () => es.close();

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [docId, workspaceId, filename, status]);

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
      {status === 'processing' && progress > 0 && ` ${progress}%`}
    </span>
  );
}

function DocumentsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs = [] } = useDocuments(workspaceId);
  const uploadDocument = useUploadDocument(workspaceId);
  const removeDocument = useRemoveDocument(workspaceId);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(`파일 크기가 50MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      await uploadDocument.mutateAsync(file);
      toast.info(`"${file.name}" 업로드됨 — 임베딩 처리 중...`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '업로드에 실패했습니다. 다시 시도해주세요.';
      toast.error(msg);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRetry(doc: Document) {
    try {
      await removeDocument.mutateAsync(doc.id);
      toast.info(`"${doc.filename}" 삭제됨 — 파일을 다시 업로드해주세요.`);
    } catch {
      toast.error('재시도 준비 중 오류가 발생했습니다.');
    }
  }

  async function handleRemove(id: string, filename: string) {
    try {
      await removeDocument.mutateAsync(id);
      toast.success(`"${filename}" 삭제됨`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '삭제에 실패했습니다. 다시 시도해주세요.';
      toast.error(`"${filename}" ${msg}`);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <AppHeader
        backHref="/"
        title="문서 관리"
        right={
          <Button size="sm" onClick={() => router.push(`/workspaces/${workspaceId}/chat`)}>
            <MessageSquare className="h-3.5 w-3.5" />
            채팅
          </Button>
        }
      />

      <main className={`${CONTENT_WIDTH} py-8`}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-700">업로드된 문서</p>
            <p className="text-xs text-stone-400 mt-0.5">PDF, TXT, MD 파일 · 자동 임베딩</p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={handleUpload}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploadDocument.isPending}>
              {uploadDocument.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />처리 중...</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />업로드</>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {docs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-stone-400">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-stone-400" />
              </div>
              <p className="text-sm">업로드된 문서가 없습니다.</p>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                첫 문서 업로드
              </Button>
            </div>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between bg-white rounded-lg border border-stone-200 px-4 py-3 shadow-sm hover:border-stone-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-md bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-stone-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <DocumentStatusBadge docId={doc.id} workspaceId={workspaceId} initialStatus={doc.status} filename={doc.filename} />
                    <span className="text-xs text-stone-400 font-mono">{formatBytes(doc.fileSize)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {doc.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRetry(doc)}
                    className="text-xs text-stone-400 hover:text-orange-600 hover:bg-orange-50"
                  >
                    재시도
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(doc.id, doc.filename)}
                  className="text-stone-300 hover:text-red-500 hover:bg-red-50"
                  aria-label={`"${doc.filename}" 삭제`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function DocumentsPageWrapper() {
  return (
    <AdminPageGuard>
      <DocumentsPage />
    </AdminPageGuard>
  );
}
