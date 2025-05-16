
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

    const processUserStatus = async () => {
      setIsProcessingSanction(true);
      let currentUserState = user;

      if (currentUserState && currentUserState.status === 'sanctioned' && currentUserState.id !== 'visitor0') {
        // console.log(`[SanctionCheckWrapper] User ${currentUserState.username} is sanctioned. Checking end date: ${currentUserState.sanctionEndDate}`);
        if (currentUserState.sanctionEndDate && new Date() > new Date(currentUserState.sanctionEndDate)) {
          // console.log(`[SanctionCheckWrapper] Sanction for ${currentUserState.username} (ID: ${currentUserState.id}) has expired. Attempting to lift.`);
          const sanctionLifted = await checkAndLiftSanction(currentUserState.id);
          if (sanctionLifted) {
            // console.log(`[SanctionCheckWrapper] Sanction lifted for ${currentUserState.username}. Refreshing user state.`);
            // After checkAndLiftSanction updates Firestore and potentially internalCurrentUser,
            // the user object from useMockAuth should re-trigger this effect with updated status.
            // Forcing a re-evaluation or a more explicit state update might be needed if not immediate.
            // Let's try to rely on the listener mechanism in useMockAuth first.
            // A simple way to force re-evaluation of `user` from the hook:
            await switchToUser(currentUserState.id); // This will re-fetch/re-sync
            setIsProcessingSanction(false);
            return; // Exit effect, will re-run with new user state from switchToUser
          } else {
             // console.log(`[SanctionCheckWrapper] Sanction expired but lifting failed or not immediate. User remains sanctioned for now.`);
          }
        }
        
        // If still sanctioned (not expired or lifting failed) and not on sanctioned page, redirect.
        if (pathname !== '/auth/sanctioned') {
          // console.log(`[SanctionCheckWrapper] Redirecting sanctioned user ${currentUserState.username} to /auth/sanctioned.`);
          router.replace('/auth/sanctioned');
          setIsProcessingSanction(false);
          return;
        }
      } else if (currentUserState && currentUserState.status !== 'sanctioned' && pathname === '/auth/sanctioned') {
        // console.log(`[SanctionCheckWrapper] User ${currentUserState.username} is NOT sanctioned. Redirecting from /auth/sanctioned to /.`);
        router.replace('/');
        setIsProcessingSanction(false);
        return;
      } else if (!currentUserState && pathname === '/auth/sanctioned') { // Visitor on sanctioned page
        // console.log(`[SanctionCheckWrapper] No user (visitor) on /auth/sanctioned. Redirecting to /.`);
        router.replace('/');
        setIsProcessingSanction(false);
        return;
      }
      setIsProcessingSanction(false);
    };

    processUserStatus();

  }, [user, loading, pathname, router, checkAndLiftSanction, switchToUser]);

  if (loading || isProcessingSanction) {
     return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking user status...</p>
        </div>
     );
  }

  // This prevents content flash while useEffect triggers redirect for a sanctioned user.
  // Check if user exists and is truly sanctioned (date not passed)
  if (user && user.status === 'sanctioned' && user.sanctionEndDate && new Date() <= new Date(user.sanctionEndDate) && pathname !== '/auth/sanctioned') {
    return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Verifying sanction status...</p>
        </div>
    );
  }

  return <>{children}</>;
}
    