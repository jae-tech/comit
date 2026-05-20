'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) return null;
  return <>{children}</>;
}
