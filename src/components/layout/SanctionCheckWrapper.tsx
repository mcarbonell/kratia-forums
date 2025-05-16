
"use client";

import { useEffect } from 'react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

interface SanctionCheckWrapperProps {
  children: ReactNode;
}

export default function SanctionCheckWrapper({ children }: SanctionCheckWrapperProps) {
  const { user, loading } = useMockAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // For debugging:
    // console.log('[SanctionCheckWrapper] useEffect triggered. Loading:', loading, 'User:', user?.username, 'Status:', user?.status, 'Path:', pathname);

    if (loading) {
      // console.log('[SanctionCheckWrapper] Still loading auth state, returning.');
      return;
    }

    if (user && user.status === 'sanctioned') {
      if (pathname !== '/auth/sanctioned') {
        // console.log(`[SanctionCheckWrapper] User ${user.username} (${user.id}) is sanctioned. Redirecting from ${pathname} to /auth/sanctioned.`);
        router.replace('/auth/sanctioned');
      } else {
        // console.log(`[SanctionCheckWrapper] User ${user.username} (${user.id}) is sanctioned and already on /auth/sanctioned.`);
      }
    }
    // Optional: Handle if user is NOT sanctioned but IS on /auth/sanctioned page (e.g., navigated via history)
    else if (user && user.status !== 'sanctioned' && pathname === '/auth/sanctioned') {
    //   console.log(`[SanctionCheckWrapper] User ${user.username} (${user.id}) is NOT sanctioned. Redirecting from /auth/sanctioned to /.`);
      router.replace('/');
    }
    // Optional: Handle if no user (visitor) is on /auth/sanctioned page
    else if (!user && pathname === '/auth/sanctioned') {
    //   console.log(`[SanctionCheckWrapper] No user (visitor) on /auth/sanctioned. Redirecting to /.`);
      router.replace('/');
    }

  }, [user, loading, pathname, router]);

  if (loading) {
     return <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]"><p>Loading user status...</p></div>;
  }

  // This prevents content flash while useEffect triggers redirect for a sanctioned user.
  if (user && user.status === 'sanctioned' && pathname !== '/auth/sanctioned') {
    return <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]"><p>Redirecting to sanctioned page...</p></div>;
  }

  return <>{children}</>;
}
