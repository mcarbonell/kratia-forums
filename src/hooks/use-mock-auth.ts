
"use client";

import type { User } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { mockUsers as initialMockAuthUsersData } from '@/lib/mockData';

export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  isQuarantined?: boolean;
  onboardingAccepted?: boolean;
}

const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return;

    preparedMockAuthUsers[user.id] = {
        ...user,
        role: user.role || 'user',
        status: user.status || 'active',
        onboardingAccepted: user.onboardingAccepted === undefined ? false : user.onboardingAccepted,
        isQuarantined: user.isQuarantined === undefined ? false : user.isQuarantined,
    };
});

preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active', onboardingAccepted: false, isQuarantined: false };
preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active', onboardingAccepted: false, isQuarantined: false };
// Ensure user4 (DianaNewbie) is correctly set for onboarding test
if (preparedMockAuthUsers['user4']) {
    preparedMockAuthUsers['user4'].isQuarantined = true;
    preparedMockAuthUsers['user4'].onboardingAccepted = false;
    // Keep her sanctioned status for other tests unless specifically overridden
    // preparedMockAuthUsers['user4'].status = 'active'; // Temporarily override if needed for onboarding test directly
}


let internalCurrentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const setInternalCurrentUser = (user: MockUser | null) => {
  internalCurrentUser = user;
  listeners.forEach(listener => listener(user));
};

export interface LoginResult {
  success: boolean;
  user?: MockUser;
  reason?: 'not_found' | 'sanctioned' | 'pending_admission' | 'credentials_invalid';
  username?: string;
  sanctionEndDate?: string;
}

export function useMockAuth() {
  const [currentUserLocal, setCurrentUserLocal] = useState<MockUser | null>(internalCurrentUser);
  const [loading, setLoading] = useState(true);
  const [isInitialUserSynced, setIsInitialUserSynced] = useState(false);

  const syncUserWithFirestore = useCallback(async (baseUser: MockUser | null): Promise<MockUser | null> => {
    if (!baseUser || baseUser.id === 'visitor0' || baseUser.id === 'guest1') {
        // console.log('[syncUserWithFirestore] Returning baseUser directly for visitor/guest or null user:', baseUser?.id);
        return baseUser;
    }
    // console.log('[syncUserWithFirestore] Attempting to sync user from Firestore:', baseUser.id);
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        // console.log(`[syncUserWithFirestore] Firestore data for ${baseUser.id}:`, JSON.parse(JSON.stringify(firestoreData)));

        const firestoreOnboardingAccepted = firestoreData.onboardingAccepted;
        const firestoreIsQuarantined = firestoreData.isQuarantined;

        const updatedUser: MockUser = {
             ...baseUser,
             ...firestoreData,
             role: (firestoreData.role || baseUser.role || 'user') as UserRole,
             status: firestoreData.status || baseUser.status || 'active',
             onboardingAccepted: typeof firestoreOnboardingAccepted === 'boolean' ? firestoreOnboardingAccepted : (baseUser.onboardingAccepted || false),
             isQuarantined: typeof firestoreIsQuarantined === 'boolean' ? firestoreIsQuarantined : (baseUser.isQuarantined || false),
             // Ensure karma and other numeric fields from Firestore are prioritized if they exist
             karma: firestoreData.karma !== undefined ? firestoreData.karma : (baseUser.karma || 0),
             totalPostsByUser: firestoreData.totalPostsByUser !== undefined ? firestoreData.totalPostsByUser : (baseUser.totalPostsByUser || 0),
             totalReactionsReceived: firestoreData.totalReactionsReceived !== undefined ? firestoreData.totalReactionsReceived : (baseUser.totalReactionsReceived || 0),
             totalPostsInThreadsStartedByUser: firestoreData.totalPostsInThreadsStartedByUser !== undefined ? firestoreData.totalPostsInThreadsStartedByUser : (baseUser.totalPostsInThreadsStartedByUser || 0),
             totalThreadsStartedByUser: firestoreData.totalThreadsStartedByUser !== undefined ? firestoreData.totalThreadsStartedByUser : (baseUser.totalThreadsStartedByUser || 0),
        };

        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          // console.log(`[syncUserWithFirestore] Sanction for ${updatedUser.username} (ID: ${updatedUser.id}) has expired. Attempting to lift from sync.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
          // console.log(`[syncUserWithFirestore] Sanction lifted for ${updatedUser.username} via sync. User status set to active in Firestore.`);
        }
        // console.log(`[syncUserWithFirestore] Synced user data for ${baseUser.id}:`, JSON.parse(JSON.stringify(updatedUser)));
        return updatedUser;
      } else {
        // console.warn(`[syncUserWithFirestore] User ${baseUser.id} not found in Firestore. Returning base mock user provided.`);
        return baseUser;
      }
    } catch (error) {
      // console.error(`[syncUserWithFirestore] Error syncing user ${baseUser.id} with Firestore:`, error);
    }
    return baseUser;
  }, []);


  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    // console.log("[useMockAuth Effect] Listener added. Current internalUser:", internalCurrentUser?.id, "isInitialUserSynced:", isInitialUserSynced);

    const initializeUser = async () => {
      // console.log("[useMockAuth Effect - initializeUser] START");
      setLoading(true);
      let userToInitialize: MockUser | null = null;
      if (typeof window !== 'undefined') {
        const storedUserKey = localStorage.getItem('mockUserKey');
        // console.log("[useMockAuth Effect - initializeUser] storedUserKey:", storedUserKey);
        userToInitialize = storedUserKey && preparedMockAuthUsers[storedUserKey]
                           ? { ...preparedMockAuthUsers[storedUserKey] }
                           : { ...preparedMockAuthUsers['visitor0'] };
      } else {
        userToInitialize = { ...preparedMockAuthUsers['visitor0'] };
      }
      // console.log("[useMockAuth Effect - initializeUser] User to initialize (before sync):", userToInitialize?.id, "Status:", userToInitialize?.status);
      const syncedUser = await syncUserWithFirestore(userToInitialize);
      // console.log("[useMockAuth Effect - initializeUser] User after sync:", syncedUser?.id, "Status:", syncedUser?.status, "OnboardingAccepted:", syncedUser?.onboardingAccepted, "IsQuarantined:", syncedUser?.isQuarantined);
      setInternalCurrentUser(syncedUser);
      setLoading(false);
      // console.log("[useMockAuth Effect - initializeUser] END, loading set to false.");
    };

    if (internalCurrentUser === null || !isInitialUserSynced) {
        initializeUser().then(() => setIsInitialUserSynced(true));
    } else if (internalCurrentUser && isInitialUserSynced && !loading) { // Ensure not to re-sync if already loading
        // console.log("[useMockAuth Effect] Already initialized, attempting re-sync for:", internalCurrentUser.id);
        setLoading(true);
        syncUserWithFirestore(internalCurrentUser).then(syncedUser => {
            // console.log("[useMockAuth Effect] Re-sync complete for:", syncedUser?.id, "Status:", syncedUser?.status);
            if (JSON.stringify(syncedUser) !== JSON.stringify(internalCurrentUser)) {
                 // console.log("[useMockAuth Effect] User data changed after re-sync, updating internalCurrentUser.");
                 setInternalCurrentUser(syncedUser);
            }
            setLoading(false);
            // console.log("[useMockAuth Effect] Re-sync loading set to false.");
        });
    } else {
      // If internalCurrentUser exists but was not synced initially, or if loading is already true, do nothing here to prevent loops.
      // setLoading(false); // Ensure loading is false if no action is taken
    }

    return () => {
      listeners.delete(listener);
      // console.log("[useMockAuth Effect] Cleanup, listener removed.");
    };
  }, [syncUserWithFirestore, isInitialUserSynced]); // Removed loading from deps

  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    // console.log(`[login] Attempting login for: ${usernameOrEmail}`);
    let userToLogin: MockUser | undefined;

    if (!usernameOrEmail) {
        return { success: false, reason: 'credentials_invalid' };
    }
    const lowerInput = usernameOrEmail.toLowerCase();

    let userKeyToLogin: string | undefined = Object.keys(preparedMockAuthUsers).find(
        key => key.toLowerCase() === lowerInput ||
               preparedMockAuthUsers[key]?.username.toLowerCase() === lowerInput ||
               (preparedMockAuthUsers[key]?.email && preparedMockAuthUsers[key]?.email!.toLowerCase().startsWith(lowerInput))
    );

    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        // console.warn(`[login] Mock login attempt for "${usernameOrEmail}" - user not found in preparedMockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }

    userToLogin = { ...preparedMockAuthUsers[userKeyToLogin] };
    userToLogin = (await syncUserWithFirestore(userToLogin)) || undefined; // Sync with Firestore

    if (!userToLogin) { // Should not happen if syncUserWithFirestore returns baseUser on error
        // console.error(`[login] User ${userKeyToLogin} disappeared after sync. This is unexpected.`);
        return { success: false, reason: 'not_found' };
    }
    // console.log(`[login] User found & synced: ${userToLogin.username}, Status: ${userToLogin.status}`);

    if (userToLogin.status === 'pending_admission') {
        // console.log(`[login] Login failed for ${userToLogin.username}: pending_admission`);
        return {
            success: false,
            reason: 'pending_admission',
            username: userToLogin.username
        };
    }
    if (userToLogin.status === 'sanctioned') {
        // console.log(`[login] Login failed for ${userToLogin.username}: sanctioned until ${userToLogin.sanctionEndDate}`);
        return {
          success: false,
          user: userToLogin,
          reason: 'sanctioned',
          username: userToLogin.username,
          sanctionEndDate: userToLogin.sanctionEndDate
        };
    }

    setInternalCurrentUser(userToLogin);
    if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', userToLogin.id);
    }
    // console.log(`[login] Login successful for ${userToLogin.username}. CurrentUser set.`);
    return { success: true, user: userToLogin };
  }, [syncUserWithFirestore]);

  const signup = useCallback((username: string, email: string) => {
    // This is mostly a placeholder as real signup creates user in Firestore with 'pending_admission'
    // console.log(`[signup] Mock signup called for ${username}. Note: Real signup flow creates user in Firestore.`);
    const userToSignup = { ...preparedMockAuthUsers['guest1'] }; // Start with guest, customize
    userToSignup.username = username;
    userToSignup.email = email;
    userToSignup.status = 'active'; // Or 'pending_admission' if this were the main flow
    userToSignup.sanctionEndDate = undefined;
    userToSignup.onboardingAccepted = false;
    userToSignup.isQuarantined = true; // New users might start quarantined

    // setInternalCurrentUser(userToSignup);
    // if (typeof window !== 'undefined') {
    //     localStorage.setItem('mockUserKey', 'guest1'); // Or a dynamic key if we were adding to preparedMockAuthUsers
    // }
  }, []);

  const logout = useCallback(() => {
    // console.log("[logout] Logging out. Setting currentUser to visitor0.");
    const visitorUser = preparedMockAuthUsers['visitor0'];
    setInternalCurrentUser(visitorUser);
    if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', 'visitor0');
    }
  }, []);

  const switchToUser = useCallback(async (userKey: string) => {
    // console.log(`[switchToUser] Attempting to switch to userKey: ${userKey}`);
    let userToSwitchTo: MockUser | null = preparedMockAuthUsers[userKey] ? { ...preparedMockAuthUsers[userKey] } : null;

    if (userToSwitchTo) {
      userToSwitchTo = await syncUserWithFirestore(userToSwitchTo);
      // console.log(`[switchToUser] User after sync: ${userToSwitchTo?.id}, Status: ${userToSwitchTo?.status}`);
      setInternalCurrentUser(userToSwitchTo);
      if (typeof window !== 'undefined' && userToSwitchTo) {
        localStorage.setItem('mockUserKey', userToSwitchTo.id);
      } else if (typeof window !== 'undefined') {
         localStorage.setItem('mockUserKey', 'visitor0'); // Fallback if userToSwitchTo becomes null
      }
    } else {
      // console.warn(`[switchToUser] Mock user for key "${userKey}" not found. Defaulting to visitor0.`);
      const visitorUser = await syncUserWithFirestore({ ...preparedMockAuthUsers['visitor0'] });
      setInternalCurrentUser(visitorUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', 'visitor0');
      }
    }
  }, [syncUserWithFirestore]);

  const checkAndLiftSanction = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId || userId === 'visitor0' || userId === 'guest1') return false;
    // console.log(`[checkAndLiftSanction] Checking sanction for user: ${userId}`);

    const userRef = doc(db, "users", userId);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        if (userData.status === 'sanctioned' && userData.sanctionEndDate && new Date() > new Date(userData.sanctionEndDate)) {
          // console.log(`[checkAndLiftSanction] Sanction expired for ${userId}. Lifting.`);
          await updateDoc(userRef, {
            status: 'active',
            sanctionEndDate: null
          });
          // console.log(`[checkAndLiftSanction] Firestore updated for ${userId}: status to active, sanctionEndDate to null.`);
          if (internalCurrentUser && internalCurrentUser.id === userId) {
            // Force a full re-sync to get the latest state including isQuarantined, onboardingAccepted etc.
            const baseUserForSync = { ...internalCurrentUser, status: 'active', sanctionEndDate: undefined } as MockUser;
            const freshlySyncedUser = await syncUserWithFirestore(baseUserForSync);
            setInternalCurrentUser(freshlySyncedUser);
            // console.log(`[checkAndLiftSanction] User ${userId} fully re-synced after sanction lift. New status: ${freshlySyncedUser?.status}`);
          }
          return true;
        }
        // console.log(`[checkAndLiftSanction] User ${userId} not sanctioned or sanction not expired. Status: ${userData.status}, EndDate: ${userData.sanctionEndDate}`);
      } else {
        // console.log(`[checkAndLiftSanction] User ${userId} not found in Firestore during sanction check.`);
      }
    } catch (error) {
      // console.error(`[checkAndLiftSanction] Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, [syncUserWithFirestore]);


  return {
    user: currentUserLocal,
    loading,
    login,
    logout,
    signup,
    switchToUser,
    checkAndLiftSanction,
    mockAuthUsers: preparedMockAuthUsers,
    syncUserWithFirestore // Ensure this is returned
  };
}

