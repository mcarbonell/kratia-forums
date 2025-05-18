
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

// Prepare mock users (module scope)
const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    // Skip special mock users that aren't meant to be seeded as full users
    if (user.id === 'visitor0' || user.id === 'guest1') return;

    preparedMockAuthUsers[user.id] = {
        ...user,
        role: user.role || 'user',
        status: user.status || 'active',
        onboardingAccepted: user.onboardingAccepted === undefined ? false : user.onboardingAccepted,
        isQuarantined: user.isQuarantined === undefined ? false : user.isQuarantined,
        sanctionEndDate: user.sanctionEndDate || undefined,
    };
});

// Add special mock users used for logged-out/guest states and dev switching
preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active', onboardingAccepted: false, isQuarantined: false };
preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active', onboardingAccepted: false, isQuarantined: false };

// Ensure specific test users have correct statuses for testing scenarios
if (preparedMockAuthUsers['user4']) { // DianaNewbie
    preparedMockAuthUsers['user4'].status = 'sanctioned'; // For testing SanctionCheckWrapper
    preparedMockAuthUsers['user4'].sanctionEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    preparedMockAuthUsers['user4'].isQuarantined = false;
    preparedMockAuthUsers['user4'].onboardingAccepted = true;
}
if (preparedMockAuthUsers['user5']) { // SanctionedSam
    preparedMockAuthUsers['user5'].status = 'sanctioned';
    preparedMockAuthUsers['user5'].sanctionEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}


// Simplified global-like state for current user
let internalCurrentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const setInternalCurrentUser = (user: MockUser | null) => {
  internalCurrentUser = user;
  listeners.forEach(listener => listener(user));
};

export interface LoginResult {
  success: boolean;
  user?: MockUser;
  reason?: 'not_found_in_firestore' | 'sanctioned' | 'pending_admission' | 'auth_error';
  username?: string;
  sanctionEndDate?: string;
  authErrorCode?: string;
}

export function useMockAuth() {
  const [currentUserLocal, setCurrentUserLocal] = useState<MockUser | null>(internalCurrentUser);
  const [loading, setLoading] = useState(true);

  const syncUserWithFirestore = useCallback(async (baseUser: MockUser | null): Promise<MockUser | null> => {
    if (!baseUser || !baseUser.id || baseUser.id === 'visitor0' || baseUser.id === 'guest1') {
        // console.log('[syncUserWithFirestore] Skipping sync for visitor/guest or invalid baseUser:', baseUser?.id);
        return baseUser;
    }
    // console.log('[syncUserWithFirestore] Attempting to sync user from Firestore:', baseUser.id);
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        // console.log(`[syncUserWithFirestore] Firestore data for ${baseUser.id}:`, JSON.parse(JSON.stringify(firestoreData)));
        const updatedUser: MockUser = {
             ...baseUser,
             ...firestoreData,
             role: (firestoreData.role || baseUser.role || 'user') as UserRole,
             status: firestoreData.status || baseUser.status || 'active',
             onboardingAccepted: typeof firestoreData.onboardingAccepted === 'boolean' ? firestoreData.onboardingAccepted : (typeof baseUser.onboardingAccepted === 'boolean' ? baseUser.onboardingAccepted : false),
             isQuarantined: typeof firestoreData.isQuarantined === 'boolean' ? firestoreData.isQuarantined : (typeof baseUser.isQuarantined === 'boolean' ? baseUser.isQuarantined : false),
             sanctionEndDate: firestoreData.sanctionEndDate || baseUser.sanctionEndDate || undefined,
             karma: firestoreData.karma !== undefined ? firestoreData.karma : (baseUser.karma || 0),
             // Ensure all other User fields are merged
             location: firestoreData.location !== undefined ? firestoreData.location : baseUser.location,
             aboutMe: firestoreData.aboutMe !== undefined ? firestoreData.aboutMe : baseUser.aboutMe,
             presentation: firestoreData.presentation !== undefined ? firestoreData.presentation : baseUser.presentation,
             canVote: typeof firestoreData.canVote === 'boolean' ? firestoreData.canVote : baseUser.canVote,
             totalPostsByUser: firestoreData.totalPostsByUser !== undefined ? firestoreData.totalPostsByUser : baseUser.totalPostsByUser,
             totalReactionsReceived: firestoreData.totalReactionsReceived !== undefined ? firestoreData.totalReactionsReceived : baseUser.totalReactionsReceived,
             totalPostsInThreadsStartedByUser: firestoreData.totalPostsInThreadsStartedByUser !== undefined ? firestoreData.totalPostsInThreadsStartedByUser : baseUser.totalPostsInThreadsStartedByUser,
             totalThreadsStartedByUser: firestoreData.totalThreadsStartedByUser !== undefined ? firestoreData.totalThreadsStartedByUser : baseUser.totalThreadsStartedByUser,
        };

        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          // console.log(`[syncUserWithFirestore] Sanction for ${updatedUser.username} (ID: ${updatedUser.id}) has expired. Lifting.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        // console.log(`[syncUserWithFirestore] Synced user data for ${baseUser.id}:`, updatedUser);
        return updatedUser;
      } else {
        // console.warn(`[syncUserWithFirestore] User ${baseUser.id} not found in Firestore. Returning base mock user provided.`);
        return baseUser;
      }
    } catch (error) {
      console.error(`[syncUserWithFirestore] Error syncing user ${baseUser.id} with Firestore:`, error);
    }
    return baseUser; // Fallback
  }, []);

  const loginAndSetUserFromFirestore = useCallback(async (uid: string): Promise<LoginResult> => {
    // console.log(`[loginAndSetUserFromFirestore] Attempting to fetch user ${uid} from Firestore.`);
    const userRef = doc(db, "users", uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.warn(`[loginAndSetUserFromFirestore] User UID ${uid} not found in Firestore users collection.`);
        return { success: false, reason: 'not_found_in_firestore' };
      }
      let firestoreUser = { id: userSnap.id, ...userSnap.data() } as MockUser;
      // console.log(`[loginAndSetUserFromFirestore] User ${uid} found in Firestore:`, firestoreUser);

      if (firestoreUser.status === 'pending_admission') {
        // console.log(`[loginAndSetUserFromFirestore] User ${uid} is 'pending_admission'.`);
        return { success: false, reason: 'pending_admission', username: firestoreUser.username };
      }
      if (firestoreUser.status === 'sanctioned') {
        // console.log(`[loginAndSetUserFromFirestore] User ${uid} is 'sanctioned'. Checking end date: ${firestoreUser.sanctionEndDate}`);
        if (firestoreUser.sanctionEndDate && new Date() > new Date(firestoreUser.sanctionEndDate)) {
          // console.log(`[loginAndSetUserFromFirestore] Sanction for ${uid} expired. Lifting.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          firestoreUser.status = 'active';
          firestoreUser.sanctionEndDate = undefined;
        } else {
          // console.log(`[loginAndSetUserFromFirestore] Sanction for ${uid} still active.`);
          return {
            success: false,
            user: firestoreUser,
            reason: 'sanctioned',
            username: firestoreUser.username,
            sanctionEndDate: firestoreUser.sanctionEndDate
          };
        }
      }

      // If active or sanction just lifted
      // console.log(`[loginAndSetUserFromFirestore] Setting user ${uid} as current user.`);
      setInternalCurrentUser(firestoreUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', firestoreUser.id);
      }
      return { success: true, user: firestoreUser };

    } catch (error) {
      console.error(`[loginAndSetUserFromFirestore] Error fetching user ${uid} from Firestore:`, error);
      return { success: false, reason: 'auth_error' }; 
    }
  }, []); // Empty dependency array for useCallback is fine here due to module-scope usage

  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    setLoading(true);

    const initializeUser = async () => {
      // console.log("[useMockAuth initializeUser] Start");
      let userToSet: MockUser | null = null;
      if (typeof window !== 'undefined') {
        const storedUserKey = localStorage.getItem('mockUserKey');
        // console.log("[useMockAuth initializeUser] storedUserKey:", storedUserKey);
        if (storedUserKey) {
          if (preparedMockAuthUsers[storedUserKey]) { // It's one of our known mock users (e.g. visitor0, user1 after dev switch)
            // console.log(`[useMockAuth initializeUser] Key ${storedUserKey} is a prepared mock user. Syncing.`);
            userToSet = await syncUserWithFirestore({ ...preparedMockAuthUsers[storedUserKey] });
          } else { // Assume it's a Firebase UID from a real login
            // console.log(`[useMockAuth initializeUser] Key ${storedUserKey} is assumed Firebase UID. Fetching from Firestore.`);
            // Create a minimal base user object for syncUserWithFirestore to use if Firestore fetch fails partially
            const baseUserForSync: MockUser = { id: storedUserKey, username: 'Loading...', email: '', role: 'user', status: 'active' };
            const syncedUserFromUid = await loginAndSetUserFromFirestore(storedUserKey);

            if(syncedUserFromUid.success && syncedUserFromUid.user){
                userToSet = syncedUserFromUid.user;
            } else if (syncedUserFromUid.reason === 'sanctioned' && syncedUserFromUid.user){
                userToSet = syncedUserFromUid.user; // User is sanctioned, SanctionCheckWrapper will handle redirect
            } else if (syncedUserFromUid.reason === 'pending_admission' && syncedUserFromUid.user){
                userToSet = syncedUserFromUid.user; // User is pending, login page handles this message
            } else {
                 // console.warn(`[useMockAuth initializeUser] Could not fully sync user UID ${storedUserKey} from Firestore on init. Defaulting to visitor.`);
                 userToSet = { ...preparedMockAuthUsers['visitor0'] };
                 localStorage.setItem('mockUserKey', 'visitor0'); // Reset stored key to visitor if sync fails
            }
          }
        } else {
          // console.log("[useMockAuth initializeUser] No storedUserKey. Defaulting to visitor.");
          userToSet = { ...preparedMockAuthUsers['visitor0'] };
        }
      } else { // Server-side or no window
        // console.log("[useMockAuth initializeUser] No window object. Defaulting to visitor.");
        userToSet = { ...preparedMockAuthUsers['visitor0'] };
      }
      // console.log("[useMockAuth initializeUser] User to set internally:", userToSet?.id, "Status:", userToSet?.status);
      setInternalCurrentUser(userToSet);
      setLoading(false);
      // console.log("[useMockAuth initializeUser] End, loading false.");
    };

    if (internalCurrentUser === null) { // Only run full init if no user is set yet (e.g. first load of app)
      initializeUser();
    } else {
      // If already initialized, ensure local state matches internal, then set loading false.
      setCurrentUserLocal(internalCurrentUser);
      setLoading(false);
      // console.log("[useMockAuth useEffect] Already initialized. User:", internalCurrentUser?.id, "Loading:", loading);
    }
    
    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore, loginAndSetUserFromFirestore]); // Added loginAndSetUserFromFirestore


  const logout = useCallback(() => {
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
      userToSwitchTo = await syncUserWithFirestore(userToSwitchTo); // Sync with Firestore
      // console.log(`[switchToUser] User after sync: ${userToSwitchTo?.id}, Status: ${userToSwitchTo?.status}`);
      setInternalCurrentUser(userToSwitchTo);
      if (typeof window !== 'undefined' && userToSwitchTo) {
        localStorage.setItem('mockUserKey', userToSwitchTo.id);
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
        const userDataFromFirestore = userSnap.data() as User;
        if (userDataFromFirestore.status === 'sanctioned' && userDataFromFirestore.sanctionEndDate && new Date() > new Date(userDataFromFirestore.sanctionEndDate)) {
          // console.log(`[checkAndLiftSanction] Sanction expired for ${userId}. Lifting in Firestore.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          // console.log(`[checkAndLiftSanction] Firestore updated for ${userId}: status to active.`);
          if (internalCurrentUser && internalCurrentUser.id === userId) {
            // console.log(`[checkAndLiftSanction] Current user is ${userId}. Re-syncing with Firestore.`);
            const freshlySyncedUser = await syncUserWithFirestore({ ...internalCurrentUser, status: 'active', sanctionEndDate: undefined });
            setInternalCurrentUser(freshlySyncedUser);
            // console.log(`[checkAndLiftSanction] User ${userId} fully re-synced. New status in hook: ${freshlySyncedUser?.status}`);
          }
          return true;
        }
        // console.log(`[checkAndLiftSanction] User ${userId} not sanctioned or sanction not expired. Status: ${userDataFromFirestore.status}`);
      } else {
        // console.log(`[checkAndLiftSanction] User ${userId} not found in Firestore during sanction check.`);
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, [syncUserWithFirestore]);

  // This is the old mock login, mainly for the dev switcher now.
  const login = useCallback(async (emailOrUsername?: string, password?: string): Promise<LoginResult> => {
    // console.log(`[useMockAuth - mock login] Attempting for: ${emailOrUsername}`);
    if (!emailOrUsername) {
        return { success: false, reason: 'auth_error', authErrorCode: 'credentials_invalid_mock' };
    }
    const lowerInput = emailOrUsername.toLowerCase();
    const userKeyToLogin = Object.keys(preparedMockAuthUsers).find(
        key => key.toLowerCase() === lowerInput ||
               (preparedMockAuthUsers[key]?.username && preparedMockAuthUsers[key]?.username.toLowerCase() === lowerInput) ||
               (preparedMockAuthUsers[key]?.email && preparedMockAuthUsers[key]?.email!.toLowerCase().startsWith(lowerInput))
    );
    
    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        // console.warn(`[useMockAuth - mock login] User "${emailOrUsername}" not found in preparedMockAuthUsers.`);
        return { success: false, reason: 'not_found_in_firestore' }; // Using this reason for consistency
    }

    let userToLogin = await syncUserWithFirestore({ ...preparedMockAuthUsers[userKeyToLogin] }); // Sync with Firestore
    if (!userToLogin) {
        // console.error(`[useMockAuth - mock login] User ${userKeyToLogin} became null after sync. This is unexpected.`);
        return { success: false, reason: 'not_found_in_firestore' };
    }

    if (userToLogin.status === 'pending_admission') {
        // console.log(`[useMockAuth - mock login] User ${userToLogin.username} is 'pending_admission'.`);
        return { success: false, reason: 'pending_admission', username: userToLogin.username };
    }
    if (userToLogin.status === 'sanctioned') {
      // console.log(`[useMockAuth - mock login] User ${userToLogin.username} is 'sanctioned'.`);
      return { success: false, user: userToLogin, reason: 'sanctioned', username: userToLogin.username, sanctionEndDate: userToLogin.sanctionEndDate };
    }

    // console.log(`[useMockAuth - mock login] Login successful for ${userToLogin.username}. Setting as current user.`);
    setInternalCurrentUser(userToLogin);
    if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', userToLogin.id);
    }
    return { success: true, user: userToLogin };
  }, [syncUserWithFirestore]);

  return {
    user: currentUserLocal,
    loading,
    login, // Kept for dev switcher compatibility; primary login path is through LoginPage -> signInWithEmailAndPassword -> loginAndSetUserFromFirestore
    loginAndSetUserFromFirestore,
    logout,
    switchToUser,
    checkAndLiftSanction,
    mockAuthUsers: preparedMockAuthUsers,
    syncUserWithFirestore
  };
}
    
    