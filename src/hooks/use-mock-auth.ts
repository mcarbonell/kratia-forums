
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

// Prepare the mock users object that the hook will use internally
const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return; 

    preparedMockAuthUsers[user.id] = {
        ...user,
        role: user.role || 'user',
        status: user.status || 'active',
        onboardingAccepted: user.onboardingAccepted || false,
    };
});

// Ensure special mock users are defined with correct default roles and onboarding status
preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active', onboardingAccepted: false };
preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active', onboardingAccepted: false };


// Module-scoped variable for the current user state
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

  const syncUserWithFirestore = useCallback(async (baseUser: MockUser): Promise<MockUser> => {
    if (!baseUser || baseUser.id === 'visitor0' || baseUser.id === 'guest1') {
        return baseUser;
    }
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        const updatedUser: MockUser = {
             ...baseUser, 
             ...firestoreData, 
             role: (firestoreData.role || baseUser.role || 'user') as UserRole,
             status: firestoreData.status || baseUser.status || 'active',
             onboardingAccepted: firestoreData.onboardingAccepted || baseUser.onboardingAccepted || false,
        };

        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          console.log(`[syncUserWithFirestore] Sanction for ${updatedUser.username} (ID: ${updatedUser.id}) has expired. Attempting to lift.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
          console.log(`[syncUserWithFirestore] Sanction lifted for ${updatedUser.username}. User status set to active in Firestore.`);
        }
        return updatedUser;
      } else {
        console.warn(`[syncUserWithFirestore] User ${baseUser.id} not found in Firestore. Returning base mock user.`);
        return baseUser; 
      }
    } catch (error) {
      console.error(`[syncUserWithFirestore] Error syncing user ${baseUser.id} with Firestore:`, error);
    }
    return baseUser;
  }, []);


  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    setLoading(true);

    const initializeUser = async () => {
      let userToInitialize: MockUser | null = null;
      if (typeof window !== 'undefined') {
        const storedUserKey = localStorage.getItem('mockUserKey');
        userToInitialize = storedUserKey && preparedMockAuthUsers[storedUserKey] 
                           ? { ...preparedMockAuthUsers[storedUserKey] } 
                           : { ...preparedMockAuthUsers['visitor0'] };
      } else {
        // Fallback for SSR or if window is not defined, though this hook is client-side
        userToInitialize = { ...preparedMockAuthUsers['visitor0'] };
      }
      
      const syncedUser = await syncUserWithFirestore(userToInitialize);
      setInternalCurrentUser(syncedUser);
      setLoading(false);
    };

    if (internalCurrentUser === null) {
        initializeUser();
    } else {
        // If there's already an internalCurrentUser (e.g., from a previous session or switch), re-sync it
        syncUserWithFirestore(internalCurrentUser).then(syncedUser => {
            setInternalCurrentUser(syncedUser);
            setLoading(false);
        });
    }

    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore]);

  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    let userToLogin: MockUser | undefined;

    if (!usernameOrEmail) {
        return { success: false, reason: 'credentials_invalid' };
    }
    const lowerInput = usernameOrEmail.toLowerCase();
    
    let userKeyToLogin: string | undefined = Object.keys(preparedMockAuthUsers).find(
        key => key.toLowerCase() === lowerInput || 
               preparedMockAuthUsers[key].username.toLowerCase() === lowerInput ||
               (preparedMockAuthUsers[key].email && preparedMockAuthUsers[key].email!.toLowerCase().startsWith(lowerInput))
    );
    
    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }
    
    userToLogin = { ...preparedMockAuthUsers[userKeyToLogin] };
    userToLogin = await syncUserWithFirestore(userToLogin); // Sync with Firestore

    if (userToLogin.status === 'pending_admission') {
        return { 
            success: false, 
            reason: 'pending_admission', 
            username: userToLogin.username 
        };
    }
    if (userToLogin.status === 'sanctioned') {
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
    return { success: true, user: userToLogin };
  }, [syncUserWithFirestore]);

  const signup = useCallback((username: string, email: string) => {
    // This is a simplified mock signup, new flow writes to Firestore.
    const userToSignup = { ...preparedMockAuthUsers['user1'] };
    userToSignup.username = username;
    userToSignup.email = email;
    userToSignup.status = 'active'; 
    userToSignup.sanctionEndDate = undefined;
    userToSignup.onboardingAccepted = false;

    setInternalCurrentUser(userToSignup);
    if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', 'user1');
    }
  }, []);

  const logout = useCallback(() => {
    const visitorUser = preparedMockAuthUsers['visitor0'];
    setInternalCurrentUser(visitorUser);
    if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', 'visitor0');
    }
  }, []);

  const switchToUser = useCallback(async (userKey: string) => {
    let userToSwitchTo: MockUser | undefined = preparedMockAuthUsers[userKey] ? { ...preparedMockAuthUsers[userKey] } : undefined;

    if (userToSwitchTo) {
      userToSwitchTo = await syncUserWithFirestore(userToSwitchTo);
      setInternalCurrentUser(userToSwitchTo);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', userKey);
      }
    } else {
      console.warn(`Mock user for key "${userKey}" not found in switchToUser. Defaulting to visitor0.`);
      const visitorUser = await syncUserWithFirestore({ ...preparedMockAuthUsers['visitor0'] });
      setInternalCurrentUser(visitorUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mockUserKey', 'visitor0');
      }
    }
  }, [syncUserWithFirestore]);

  const checkAndLiftSanction = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId || userId === 'visitor0' || userId === 'guest1') return false;

    const userRef = doc(db, "users", userId);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        if (userData.status === 'sanctioned' && userData.sanctionEndDate && new Date() > new Date(userData.sanctionEndDate)) {
          await updateDoc(userRef, {
            status: 'active',
            sanctionEndDate: null
          });
          console.log(`[checkAndLiftSanction] Firestore updated for ${userId}: status to active, sanctionEndDate to null.`);
          if (internalCurrentUser && internalCurrentUser.id === userId) {
            const updatedUser = { ...internalCurrentUser, status: 'active', sanctionEndDate: undefined } as MockUser;
            setInternalCurrentUser(updatedUser); 
            console.log(`[checkAndLiftSanction] Internal current user state updated for ${userId}.`);
          }
          return true;
        }
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, []);


  return { 
    user: currentUserLocal, 
    loading, 
    login, 
    logout, 
    signup, 
    switchToUser, 
    checkAndLiftSanction, 
    mockAuthUsers: preparedMockAuthUsers,
    syncUserWithFirestore // Expose syncUserWithFirestore if needed elsewhere
  };
}
