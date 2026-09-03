'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/login') router.replace('/login');
    if (user && pathname === '/login') router.replace('/');
  }, [loading, user, pathname, router]);

  if (pathname === '/login') return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-gold">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
