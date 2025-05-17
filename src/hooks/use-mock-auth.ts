
"use client";

import type { User } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { mockUsers as initialMockAuthUsersData } from '@/lib/mockData'; // Using the updated name from mockData.ts

export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  isQuarantined?: boolean;
}

const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return; // Skip special mock auth states

    const role = user.role as UserRole | undefined;
    const status = user.status as 'active' | 'under_sanction_process' | 'sanctioned' | 'pending_admission' | undefined;

    preparedMockAuthUsers[user.id] = {
        ...user, // Spread all properties from User type
        role: role || 'user', // Default role
        status: status || 'active', // Default status
    };
});

// Ensure special mock users are defined with correct default roles
preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active' };
preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active' };


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
        const updatedUser = {
             ...baseUser, // Start with mock data (which includes role from mockData.ts)
             ...firestoreData, // Override with Firestore data (like karma, status, sanctionEndDate, etc.)
             // Ensure role from mock (or a sensible default) is kept if not in Firestore
             role: (firestoreData.role || baseUser.role || 'user') as UserRole,
             status: firestoreData.status || baseUser.status || 'active',
        };

        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        return updatedUser as MockUser;
      } else {
        // User not in Firestore, could be an applicant not yet saved or an issue.
        // For mock auth, if we expect them to be in preparedMockAuthUsers, return baseUser.
        // If new signup flow creates users in FS, this path should be less common for "logged in" users.
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

    if (internalCurrentUser === null && typeof window !== 'undefined') {
      setLoading(true);
      const storedUserKey = localStorage.getItem('mockUserKey');
      let baseUserToSync = storedUserKey && preparedMockAuthUsers[storedUserKey]
                             ? { ...preparedMockAuthUsers[storedUserKey] }
                             : { ...preparedMockAuthUsers['visitor0'] };
      
      syncUserWithFirestore(baseUserToSync).then(syncedUser => {
        // After sync, if user is sanctioned AND their key was stored, DONT default to visitor.
        // Let SanctionCheckWrapper handle redirection if they are sanctioned.
        // If storedUserKey was not found or user became visitor due to some other logic, then set visitor.
        if (syncedUser.id === 'visitor0' && storedUserKey && storedUserKey !== 'visitor0') {
            // This means sync somehow turned a potential user into visitor0, perhaps they don't exist in FS yet.
            // Or if sync determined they should be visitor (e.g. missing in FS)
            setInternalCurrentUser(preparedMockAuthUsers['visitor0']);
            localStorage.setItem('mockUserKey', 'visitor0');
        } else {
            setInternalCurrentUser(syncedUser);
            // Ensure localStorage has a key, even if it's visitor0
            if (!storedUserKey || !preparedMockAuthUsers[storedUserKey]) {
                localStorage.setItem('mockUserKey', 'visitor0');
            }
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
  }, [syncUserWithFirestore]); // syncUserWithFirestore is stable

  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    let userToLogin: MockUser | undefined;

    if (!usernameOrEmail) {
        return { success: false, reason: 'credentials_invalid' };
    }
    const lowerInput = usernameOrEmail.toLowerCase();
    
    // Attempt to find user by key first (e.g. "user1", "admin1")
    let userKeyToLogin: string | undefined = Object.keys(preparedMockAuthUsers).find(key => key.toLowerCase() === lowerInput);

    // If not found by key, try by username or email
    if (!userKeyToLogin) {
        userKeyToLogin = Object.keys(preparedMockAuthUsers).find(key =>
            preparedMockAuthUsers[key].username.toLowerCase() === lowerInput ||
            (preparedMockAuthUsers[key].email && preparedMockAuthUsers[key].email!.toLowerCase().startsWith(lowerInput))
        );
    }
    
    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        // Try fetching from Firestore directly as a fallback if a new user applied
        try {
            // This is a simplified lookup; real app would query by email/username
            // For now, assume usernameOrEmail might be a user ID for direct FS check
            const userRef = doc(db, "users", usernameOrEmail);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                userToLogin = userSnap.data() as MockUser;
                // If user found in FS but not in preparedMockAuthUsers, it's likely a newly applied user
            } else {
                return { success: false, reason: 'not_found' };
            }
        } catch (e) {
             return { success: false, reason: 'not_found' };
        }
    } else {
        userToLogin = { ...preparedMockAuthUsers[userKeyToLogin] };
    }

    if (!userToLogin) return { success: false, reason: 'not_found' };


    // Sync with Firestore to get the latest status (especially for pending_admission or sanctioned)
    userToLogin = await syncUserWithFirestore(userToLogin);

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
    localStorage.setItem('mockUserKey', userToLogin.id); // Store by actual ID
    return { success: true, user: userToLogin };
  }, [syncUserWithFirestore]);

  // This mock signup is largely superseded by the new direct-to-Firestore application process.
  // Kept for potential use by dev switcher or if direct mock signup is ever needed without FS.
  const signup = useCallback((username: string, email: string) => {
    // This is a simplified mock signup, new flow writes to Firestore.
    // For testing, we can map to an existing mock user or create a temporary one.
    // Let's assume it logs in as 'user1' (Alice) for simplicity if this is called.
    const userToSignup = { ...preparedMockAuthUsers['user1'] };
    userToSignup.username = username;
    userToSignup.email = email;
    userToSignup.status = 'active'; 
    userToSignup.sanctionEndDate = undefined;

    setInternalCurrentUser(userToSignup);
    localStorage.setItem('mockUserKey', 'user1');
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
            setInternalCurrentUser(updatedUser); 
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
