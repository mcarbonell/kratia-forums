
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
}

// This object is prepared once and then returned by the hook.
const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    const role = user.role as UserRole | undefined;
    const status = user.status as 'active' | 'under_sanction_process' | 'sanctioned' | undefined;

    preparedMockAuthUsers[user.id] = {
        ...user,
        role: role || (user.id === 'visitor0' ? 'visitor' : user.id === 'guest1' ? 'guest' : 'user'),
        status: status || 'active',
    };
});

// Ensure special mock users are defined with correct default roles
if (!preparedMockAuthUsers['visitor0']) {
  preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active' };
} else if (preparedMockAuthUsers['visitor0']) {
  preparedMockAuthUsers['visitor0'].role = 'visitor';
}

if (!preparedMockAuthUsers['guest1']) {
  preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', role: 'guest', status: 'active' };
} else if (preparedMockAuthUsers['guest1']) {
  preparedMockAuthUsers['guest1'].role = 'guest';
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
  reason?: 'not_found' | 'sanctioned' | 'credentials_invalid';
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
        // Prioritize Firestore status, but keep mock role if FS doesn't have one (e.g. for new users)
        const updatedUser = {
             ...baseUser,
             ...firestoreData,
             role: baseUser.role, // Keep the role from the mock data as FS might not have it
             status: firestoreData.status || baseUser.status, // FS status is source of truth if exists
        };


        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        return updatedUser as MockUser;
      } else {
        return baseUser; // User not in FS, return base mock
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

    if (internalCurrentUser === null && typeof window !== 'undefined') {
      setLoading(true);
      const storedUserKey = localStorage.getItem('mockUserKey');
      let baseUserToSync = storedUserKey && preparedMockAuthUsers[storedUserKey]
                             ? { ...preparedMockAuthUsers[storedUserKey] }
                             : { ...preparedMockAuthUsers['visitor0'] };

      syncUserWithFirestore(baseUserToSync).then(syncedUser => {
        setInternalCurrentUser(syncedUser);
        if (!storedUserKey || !preparedMockAuthUsers[storedUserKey]) {
            localStorage.setItem('mockUserKey', 'visitor0');
        }
        setLoading(false);
      });
    } else if (internalCurrentUser) {
      setLoading(true);
      syncUserWithFirestore(internalCurrentUser).then(syncedUser => {
        setInternalCurrentUser(syncedUser);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore]);

  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    let userKeyToLogin: string | undefined;

    if (!usernameOrEmail) {
        return { success: false, reason: 'credentials_invalid' };
    }

    const lowerInput = usernameOrEmail.toLowerCase();
    userKeyToLogin = Object.keys(preparedMockAuthUsers).find(key =>
        preparedMockAuthUsers[key].username.toLowerCase() === lowerInput ||
        (preparedMockAuthUsers[key].email && preparedMockAuthUsers[key].email!.toLowerCase().startsWith(lowerInput)) ||
        key.toLowerCase() === lowerInput
    );

    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }

    let userToLogin = { ...preparedMockAuthUsers[userKeyToLogin] };
    userToLogin = await syncUserWithFirestore(userToLogin);

    if (userToLogin.status === 'sanctioned') {
       // Check if sanction has expired client-side before returning (sync might have caught it too)
      if (userToLogin.sanctionEndDate && new Date() > new Date(userToLogin.sanctionEndDate)) {
        // This implies syncUserWithFirestore might not have updated internalCurrentUser yet
        // or this is a direct login attempt for a user whose sanction just expired.
        // The checkAndLiftSanction can be called, or we rely on the next sync cycle.
        // For now, let's proceed with the 'sanctioned' status as per sync result.
      } else {
        return {
          success: false,
          user: userToLogin,
          reason: 'sanctioned',
          username: userToLogin.username,
          sanctionEndDate: userToLogin.sanctionEndDate
        };
      }
    }

    setInternalCurrentUser(userToLogin);
    localStorage.setItem('mockUserKey', userKeyToLogin);
    return { success: true, user: userToLogin };
  }, [syncUserWithFirestore]);

  const signup = useCallback((username: string, email: string) => {
    const newUserKey = 'user1'; // For mock, signup always maps to Alice for simplicity
    const userToSignup = { ...preparedMockAuthUsers[newUserKey] };
    userToSignup.username = username;
    userToSignup.email = email;
    userToSignup.status = 'active';
    userToSignup.sanctionEndDate = undefined;

    setInternalCurrentUser(userToSignup);
    localStorage.setItem('mockUserKey', newUserKey);
  }, []);

  const logout = useCallback(() => {
    setInternalCurrentUser(preparedMockAuthUsers['visitor0']);
    localStorage.setItem('mockUserKey', 'visitor0');
  }, []);

  const switchToUser = useCallback(async (userKey: string) => {
    let userToSwitchTo: MockUser | undefined = preparedMockAuthUsers[userKey] ? { ...preparedMockAuthUsers[userKey] } : undefined;

    if (userToSwitchTo) {
      userToSwitchTo = await syncUserWithFirestore(userToSwitchTo);
      setInternalCurrentUser(userToSwitchTo);
      localStorage.setItem('mockUserKey', userKey);
    } else {
      console.warn(`Mock user for key "${userKey}" not found in switchToUser. Defaulting to visitor0.`);
      const visitorUser = await syncUserWithFirestore({ ...preparedMockAuthUsers['visitor0'] });
      setInternalCurrentUser(visitorUser);
      localStorage.setItem('mockUserKey', 'visitor0');
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
          if (internalCurrentUser && internalCurrentUser.id === userId) {
            const updatedUser = { ...internalCurrentUser, status: 'active', sanctionEndDate: undefined } as MockUser;
            setInternalCurrentUser(updatedUser); // This will notify listeners
          }
          return true;
        }
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, []);


  return { user: currentUserLocal, loading, login, logout, signup, switchToUser, checkAndLiftSanction, mockAuthUsers: preparedMockAuthUsers };
}

