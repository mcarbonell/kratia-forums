
"use client";

import type { User } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore'; 
import { mockUsers as initialMockAuthUsersData } from '@/lib/mockData'; // Import initial mock user data

export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  isQuarantined?: boolean;
}

// Prepare mockAuthUsers from initialMockAuthUsersData
// This object will be used internally by the hook
const mockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    // Ensure role and status are always defined, falling back to defaults if necessary
    mockAuthUsers[user.id] = {
        ...user,
        role: user.role || 'user', // Default to 'user' if role is undefined
        status: user.status || 'active', // Default to 'active' if status is undefined
    };
});


let internalCurrentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const setInternalCurrentUser = (user: MockUser | null) => {
  internalCurrentUser = user;
  listeners.forEach(listener => listener(user));
};


export function useMockAuth() {
  const [currentUserLocal, setCurrentUserLocal] = useState<MockUser | null>(internalCurrentUser);
  const [loading, setLoading] = useState(true);

  const syncUserWithFirestore = useCallback(async (baseUser: MockUser): Promise<MockUser> => {
    if (!baseUser || baseUser.id === 'visitor0' || baseUser.id === 'guest1') {
        // console.log(`[syncUserWithFirestore] Skipping Firestore sync for special user: ${baseUser?.id}`);
        return baseUser; // No need to sync visitor or guest
    }
    // console.log(`[syncUserWithFirestore] Attempting to sync user: ${baseUser.id}`);
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        // console.log(`[syncUserWithFirestore] Firestore data for ${baseUser.id}:`, firestoreData);
        const updatedUser = { ...baseUser, ...firestoreData }; 

        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          // console.log(`[syncUserWithFirestore] Sanction expired for ${updatedUser.username}. Updating status.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        // console.log(`[syncUserWithFirestore] Synced user ${updatedUser.username}:`, updatedUser);
        return updatedUser as MockUser;
      } else {
        // console.warn(`[syncUserWithFirestore] User ${baseUser.id} not found in Firestore. Returning base mock data.`);
        // This can happen if seed was not run or user was deleted from FS.
        // For mock auth, we still want to provide the base mock user.
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
      // console.log(`[useMockAuth useEffect] Initial load. Stored key: ${storedUserKey}`);
      
      const baseUserToSync = storedUserKey && mockAuthUsers[storedUserKey] 
                             ? { ...mockAuthUsers[storedUserKey] } 
                             : { ...mockAuthUsers['visitor0'] }; // Fallback to visitor0

      syncUserWithFirestore(baseUserToSync).then(syncedUser => {
        // console.log(`[useMockAuth useEffect] Initial sync complete. User set to:`, syncedUser.username);
        setInternalCurrentUser(syncedUser);
        if (!storedUserKey || !mockAuthUsers[storedUserKey]) {
            localStorage.setItem('mockUserKey', 'visitor0');
        }
        setLoading(false);
      });
    } else if (internalCurrentUser) {
      // console.log(`[useMockAuth useEffect] internalCurrentUser exists. Re-syncing:`, internalCurrentUser.username);
      setLoading(true);
      syncUserWithFirestore(internalCurrentUser).then(syncedUser => {
        // console.log(`[useMockAuth useEffect] Re-sync complete. User state for ${syncedUser.username} is:`, syncedUser);
        setInternalCurrentUser(syncedUser); // Ensure listeners are notified of potentially changed status
        setLoading(false);
      });
    } else {
      // console.log("[useMockAuth useEffect] No internalCurrentUser, no stored key (or not in browser). Setting loading false.");
      setLoading(false); 
    }

    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore]); // syncUserWithFirestore is stable due to useCallback

  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    let userKeyToLogin: string | undefined;
    
    if (!usernameOrEmail) { 
        return { success: false, reason: 'credentials_invalid' };
    }
    
    const lowerInput = usernameOrEmail.toLowerCase();
    userKeyToLogin = Object.keys(mockAuthUsers).find(key => 
        mockAuthUsers[key].username.toLowerCase() === lowerInput || 
        mockAuthUsers[key].email?.toLowerCase().startsWith(lowerInput) || // email can be undefined
        key.toLowerCase() === lowerInput
    );
    
    if (!userKeyToLogin || !mockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }

    let userToLogin = { ...mockAuthUsers[userKeyToLogin] };
    userToLogin = await syncUserWithFirestore(userToLogin); 

    if (userToLogin.status === 'sanctioned') {
      // Sanction check already handled by syncUserWithFirestore if expired
      // So if status is still 'sanctioned' here, it's an active sanction.
      return { 
        success: false, 
        user: userToLogin,
        reason: 'sanctioned', 
        username: userToLogin.username, 
        sanctionEndDate: userToLogin.sanctionEndDate 
      };
    }
      
    setInternalCurrentUser(userToLogin);
    localStorage.setItem('mockUserKey', userKeyToLogin);
    return { success: true, user: userToLogin };
  }, [syncUserWithFirestore]);
  
  const signup = useCallback((username: string, email: string) => {
    // For mock purposes, sign up as 'user1' (Alice)
    const newUserKey = 'user1'; 
    const userToSignup = { ...mockAuthUsers[newUserKey] }; // Use a copy
    userToSignup.username = username; // Set the provided username
    userToSignup.email = email;       // Set the provided email
    userToSignup.status = 'active'; 
    userToSignup.sanctionEndDate = undefined;
    
    setInternalCurrentUser(userToSignup);
    localStorage.setItem('mockUserKey', newUserKey); // Still logs in as 'user1' effectively
  }, []);

  const logout = useCallback(() => {
    setInternalCurrentUser(mockAuthUsers['visitor0']);
    localStorage.setItem('mockUserKey', 'visitor0');
  }, []);
  
  const switchToUser = useCallback(async (userKey: string) => {
    let userToSwitchTo: MockUser | undefined = mockAuthUsers[userKey] ? { ...mockAuthUsers[userKey] } : undefined;
    
    if (userToSwitchTo) {
      userToSwitchTo = await syncUserWithFirestore(userToSwitchTo);
      setInternalCurrentUser(userToSwitchTo);
      localStorage.setItem('mockUserKey', userKey);
    } else {
      console.warn(`Mock user for key "${userKey}" not found in switchToUser. Defaulting to visitor0.`);
      const visitorUser = await syncUserWithFirestore({ ...mockAuthUsers['visitor0'] });
      setInternalCurrentUser(visitorUser);
      localStorage.setItem('mockUserKey', 'visitor0');
    }
  }, [syncUserWithFirestore]);

  const checkAndLiftSanction = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId || userId === 'visitor0' || userId === 'guest1') return false;
    
    // console.log(`[checkAndLiftSanction] Checking user ${userId}`);
    const userRef = doc(db, "users", userId);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        // console.log(`[checkAndLiftSanction] Firestore data for ${userId}: status=${userData.status}, endDate=${userData.sanctionEndDate}`);
        if (userData.status === 'sanctioned' && userData.sanctionEndDate && new Date() > new Date(userData.sanctionEndDate)) {
          // console.log(`[checkAndLiftSanction] Sanction expired for ${userId}. Lifting.`);
          await updateDoc(userRef, {
            status: 'active',
            sanctionEndDate: null 
          });
          if (internalCurrentUser && internalCurrentUser.id === userId) {
            // console.log(`[checkAndLiftSanction] Updating internalCurrentUser ${userId} to active.`);
            const updatedUser = { ...internalCurrentUser, status: 'active', sanctionEndDate: undefined } as MockUser;
            setInternalCurrentUser(updatedUser); // This will notify listeners
          }
          return true; 
        }
        // console.log(`[checkAndLiftSanction] Sanction for ${userId} not expired or user not sanctioned.`);
      } else {
        // console.warn(`[checkAndLiftSanction] User ${userId} not found in Firestore for sanction check.`);
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, []);


  return { user: currentUserLocal, loading, login, logout, signup, switchToUser, checkAndLiftSanction };
}
    

    