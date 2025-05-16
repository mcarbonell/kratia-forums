
"use client";

import type { User } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase'; // Import db
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Import Firestore functions

export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  isQuarantined?: boolean;
}

export const mockAuthUsers: Record<string, MockUser> = {
  'visitor0': { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active' },
  'guest1': { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://picsum.photos/seed/guest/100/100', role: 'guest', status: 'active' },
  'user1': { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/100/100', role: 'user', karma: 10, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', registrationDate: '2023-01-15T10:00:00Z', canVote: true, status: 'active' },
  'user2': { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/100/100', role: 'normal_user', karma: 150, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', registrationDate: '2023-03-20T14:30:00Z', canVote: true, status: 'active' },
  'user3': { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/100/100', role: 'normal_user', karma: 75, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', registrationDate: '2022-11-01T08:00:00Z', canVote: true, status: 'active' },
  'user4': { 
    id: 'user4', 
    username: 'DianaNewbie', 
    email: 'diana@example.com', 
    avatarUrl: 'https://picsum.photos/seed/diana/100/100', 
    role: 'user', 
    isQuarantined: false, 
    karma: 0, 
    location: 'New York', 
    aboutMe: 'Learning the ropes.', 
    registrationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Registered 5 days ago
    canVote: false, 
    status: 'sanctioned',
    sanctionEndDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // Sanction ends in 1 day
  },
  'user5': { id: 'user5', username: 'SanctionedSam', email: 'sam@example.com', avatarUrl: 'https://picsum.photos/seed/sam/100/100', role: 'user', karma: 5, location: 'Penalty Box', aboutMe: 'Currently sanctioned.', registrationDate: '2023-02-01T10:00:00Z', canVote: false, status: 'sanctioned', sanctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  'admin1': { id: 'admin1', username: 'AdminAnna', email: 'adminana@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/100/100', role: 'admin', karma: 500, location: 'Control Room', aboutMe: 'Ensuring order and progress.', registrationDate: '2022-10-01T08:00:00Z', canVote: true, status: 'active' },
  'founder1': { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/100/100', role: 'founder', karma: 1000, location: 'The Genesis Block', aboutMe: 'Laid the first stone.', registrationDate: '2022-09-01T08:00:00Z', canVote: true, status: 'active' },
};

export interface LoginResult {
  success: boolean;
  user?: MockUser;
  reason?: 'sanctioned' | 'not_found' | 'credentials_invalid';
  username?: string;
  sanctionEndDate?: string;
}

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
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        const updatedUser = { ...baseUser, ...firestoreData }; // Merge, Firestore data takes precedence for synced fields

        // Check for expired sanction
        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        return updatedUser as MockUser;
      }
    } catch (error) {
      console.error(`Error syncing user ${baseUser.id} with Firestore:`, error);
    }
    return baseUser; // Return base user if Firestore fetch fails or user not found in FS
  }, []);


  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    
    if (internalCurrentUser === null && typeof window !== 'undefined') {
      setLoading(true);
      const storedUserKey = localStorage.getItem('mockUserKey') as string | null;
      
      if (storedUserKey && mockAuthUsers[storedUserKey]) {
        const baseUser = { ...mockAuthUsers[storedUserKey] };
        syncUserWithFirestore(baseUser).then(syncedUser => {
          setInternalCurrentUser(syncedUser);
          setLoading(false);
        });
      } else {
        setInternalCurrentUser(mockAuthUsers['visitor0']);
        if (storedUserKey !== 'visitor0') {
          localStorage.setItem('mockUserKey', 'visitor0'); 
        }
        setLoading(false);
      }
    } else if (internalCurrentUser) {
      // Re-sync current user on mount if already set, to catch changes made in other tabs/sessions
      setLoading(true);
      syncUserWithFirestore(internalCurrentUser).then(syncedUser => {
        setInternalCurrentUser(syncedUser);
        setLoading(false);
      });
    }
     else {
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
    userKeyToLogin = Object.keys(mockAuthUsers).find(key => 
        mockAuthUsers[key].username.toLowerCase() === lowerInput || 
        mockAuthUsers[key].email.toLowerCase().startsWith(lowerInput) ||
        key.toLowerCase() === lowerInput
    );
    
    if (!userKeyToLogin || !mockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }

    let userToLogin = { ...mockAuthUsers[userKeyToLogin] };
    userToLogin = await syncUserWithFirestore(userToLogin); // Sync with Firestore

    if (userToLogin.status === 'sanctioned') {
      // Sanction check already handled by syncUserWithFirestore if expired
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
    const newUserKey = 'user1'; 
    const userToSignup = { ...mockAuthUsers[newUserKey] };
    userToSignup.status = 'active'; 
    userToSignup.sanctionEndDate = undefined;
    // In a real app, you'd create this user in Firestore here.
    // For mock, just set it.
    setInternalCurrentUser(userToSignup);
    localStorage.setItem('mockUserKey', newUserKey);
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
      setInternalCurrentUser(mockAuthUsers['visitor0']);
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
      console.error(`Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, []);


  return { user: currentUserLocal, loading, login, logout, signup, switchToUser, checkAndLiftSanction };
}
    