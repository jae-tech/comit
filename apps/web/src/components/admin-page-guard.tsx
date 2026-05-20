'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function AdminPageGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      router.replace('/login');
    } else if (role !== 'admin') {
      router.replace('/');
    }
  }, [hydrated, accessToken, role, router]);

  if (!hydrated || !accessToken || role !== 'admin') return null;
  return <>{children}</>;
}
