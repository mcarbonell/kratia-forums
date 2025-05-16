
"use client";

import { useEffect, useState } from 'react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface SanctionCheckWrapperProps {
  children: ReactNode;
}

export default function SanctionCheckWrapper({ children }: SanctionCheckWrapperProps) {
  const { user, loading, checkAndLiftSanction, switchToUser } = useMockAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isProcessingSanction, setIsProcessingSanction] = useState(false);

  useEffect(() => {
    if (loading) {
      // console.log('[SanctionCheckWrapper] Auth loading, returning.');
      return;
    }

    // Prevent concurrent processing
    if (isProcessingSanction) {
        // console.log('[SanctionCheckWrapper] Already processing sanction status, returning.');
        return;
    }

    const processUserStatus = async () => {
      setIsProcessingSanction(true);
      // console.log('[SanctionCheckWrapper] processUserStatus START for user:', user?.username, 'status:', user?.status, 'pathname:', pathname);
      let currentUserState = user;

      if (currentUserState && currentUserState.status === 'sanctioned' && currentUserState.id !== 'visitor0') {
        // console.log(`[SanctionCheckWrapper] User ${currentUserState.username} is sanctioned. Checking end date: ${currentUserState.sanctionEndDate}`);
        if (currentUserState.sanctionEndDate && new Date() > new Date(currentUserState.sanctionEndDate)) {
          // console.log(`[SanctionCheckWrapper] Sanction for ${currentUserState.username} (ID: ${currentUserState.id}) has expired. Attempting to lift.`);
          const sanctionLifted = await checkAndLiftSanction(currentUserState.id);
          if (sanctionLifted) {
            // console.log(`[SanctionCheckWrapper] Sanction lifted for ${currentUserState.username}. User state should refresh. Current pathname: ${pathname}`);
            // If user was on sanctioned page, redirect them away after sanction is lifted
            if (pathname === '/auth/sanctioned') {
              // console.log('[SanctionCheckWrapper] Sanction lifted, redirecting from /auth/sanctioned to /');
              router.replace('/');
              setIsProcessingSanction(false);
              return;
            }
            // No direct redirect needed here if not on /auth/sanctioned page, effect will re-run with new user state.
            setIsProcessingSanction(false);
            return; 
          } else {
             // console.log(`[SanctionCheckWrapper] Sanction expired but lifting failed or not immediate. User remains sanctioned for now.`);
          }
        }
        
        if (pathname !== '/auth/sanctioned') {
          // console.log(`[SanctionCheckWrapper] Redirecting sanctioned user ${currentUserState.username} to /auth/sanctioned. Current pathname: ${pathname}`);
          router.replace('/auth/sanctioned');
          setIsProcessingSanction(false);
          return;
        }
      } else if (currentUserState && currentUserState.status !== 'sanctioned' && pathname === '/auth/sanctioned') {
        // console.log(`[SanctionCheckWrapper] User ${currentUserState.username} is NOT sanctioned. Redirecting from /auth/sanctioned to /. Current pathname: ${pathname}`);
        router.replace('/');
        setIsProcessingSanction(false);
        return;
      } else if (!currentUserState && pathname === '/auth/sanctioned') { // Visitor on sanctioned page
        // console.log(`[SanctionCheckWrapper] No user (visitor) on /auth/sanctioned. Redirecting to /. Current pathname: ${pathname}`);
        router.replace('/');
        setIsProcessingSanction(false);
        return;
      }
      // console.log('[SanctionCheckWrapper] processUserStatus END, no redirect triggered by this run.');
      setIsProcessingSanction(false);
    };

    processUserStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, pathname, router, checkAndLiftSanction, switchToUser]); // Removed isProcessingSanction from dependencies

  if (loading) { // Show loading indicator if auth is loading OR if we are actively processing sanction status
     return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking user status...</p>
        </div>
     );
  }

  // This specific check is to prevent content flash for a user confirmed to be sanctioned AND not on the sanctioned page yet
  if (user && user.status === 'sanctioned' && user.sanctionEndDate && new Date() <= new Date(user.sanctionEndDate) && pathname !== '/auth/sanctioned') {
    // console.log('[SanctionCheckWrapper] Actively sanctioned user, not on sanctioned page. Showing loader before redirect.');
    return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying sanction status...</p>
        </div>
    );
  }

  return <>{children}</>;
}
