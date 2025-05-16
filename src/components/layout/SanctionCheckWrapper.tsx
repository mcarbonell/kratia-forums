
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
    if (!loading && user && user.status === 'sanctioned') {
      if (pathname !== '/auth/sanctioned') {
        router.replace('/auth/sanctioned');
      }
    }
  }, [user, loading, pathname, router]);

  // While loading, or if user is sanctioned and redirecting,
  // you might want to show a loader or nothing to prevent layout shifts.
  // For now, just render children, as redirect will handle it.
  if (loading) {
     // Optional: return a global loader if preferred
     // return <div className="flex justify-center items-center min-h-screen">Loading auth status...</div>;
  }
  
  // If user is sanctioned and not on the sanctioned page, the redirect will happen.
  // To prevent content flash, you could also conditionally render children here.
  if (user && user.status === 'sanctioned' && pathname !== '/auth/sanctioned') {
    return <div className="flex justify-center items-center min-h-screen">Redirecting...</div>; // Or a loader
  }


  return <>{children}</>;
}
