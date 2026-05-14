'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ComitLogo } from '@/components/comit-logo';

interface AppHeaderProps {
  /** 뒤로가기 대신 홈으로 이동할 때 true (홈페이지 헤더) */
  home?: boolean;
  /** 헤더 중앙 또는 좌측 타이틀 */
  title?: string;
  /** 타이틀 아래 서브텍스트 */
  subtitle?: string;
  /** 헤더 우측 영역 */
  right?: React.ReactNode;
  /** 뒤로가기 경로 (없으면 router.back()) */
  backHref?: string;
}

export const CONTENT_WIDTH = 'mx-auto max-w-2xl px-6';

export function AppHeader({ home, title, subtitle, right, backHref }: AppHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (backHref) router.push(backHref);
    else router.back();
  }

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
      <div className={`${CONTENT_WIDTH} h-14 flex items-center justify-between`}>
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {home ? (
            /* 홈: 브랜드 로고 */
            <div className="flex items-center gap-2">
              <ComitLogo size={24} color="#1d4ed8" className="shrink-0" />
              <span className="text-sm font-semibold text-stone-900 tracking-tight">Comit</span>
            </div>
          ) : (
            /* 서브페이지: 뒤로가기 + 타이틀 */
            <>
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {title && (
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 leading-tight truncate">{title}</p>
                  {subtitle && (
                    <p className="text-xs text-stone-400 leading-tight truncate">{subtitle}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right */}
        {right && (
          <div className="flex items-center gap-1 shrink-0 ml-4">
            {right}
          </div>
        )}
      </div>
    </header>
  );
}
