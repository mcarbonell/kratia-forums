
"use client";

import type { User } from '@/lib/types';
import { useState, useEffect } from 'react';

// Define more specific user types based on roles for Kratia
export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  isQuarantined?: boolean;
}

// This object defines the users available for quick switching in the mock auth hook.
// The keys (e.g., 'visitor0', 'user1', 'admin1') are used by switchToUser.
export const mockAuthUsers: Record<string, MockUser> = {
  'visitor0': { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active' },
  'guest1': { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://picsum.photos/seed/guest/100/100', role: 'guest', status: 'active' },
  'user1': { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/100/100', role: 'user', isQuarantined: true, karma: 10, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', registrationDate: '2023-01-15T10:00:00Z', canVote: true, status: 'active' },
  'user2': { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/100/100', role: 'normal_user', karma: 150, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', registrationDate: '2023-03-20T14:30:00Z', canVote: true, status: 'active' },
  'user3': { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/100/100', role: 'normal_user', karma: 75, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', registrationDate: '2022-11-01T08:00:00Z', canVote: true, status: 'active' },
  'user4': { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', avatarUrl: 'https://picsum.photos/seed/diana/100/100', role: 'user', isQuarantined: true, karma: 0, location: 'New York', aboutMe: 'Just joined, excited to learn!', registrationDate: '2023-03-20T14:30:00Z', canVote: false, status: 'under_sanction_process' },
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


export function useMockAuth() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const storedUserKey = localStorage.getItem('mockUserKey') as string | null;
    let userToSet: MockUser | null = null;

    if (storedUserKey && mockAuthUsers[storedUserKey]) {
      const potentialUser = mockAuthUsers[storedUserKey];
      // If stored user is sanctioned, don't auto-login them, default to visitor
      if (potentialUser.status === 'sanctioned') {
         console.warn(`Attempted to auto-login sanctioned user: ${potentialUser.username}. Defaulting to visitor.`);
         userToSet = mockAuthUsers['visitor0'];
         localStorage.setItem('mockUserKey', 'visitor0'); // Correct visitor key
      } else {
        userToSet = potentialUser;
      }
    } else {
      // Default to visitor if no key or invalid key
      userToSet = mockAuthUsers['visitor0'];
      localStorage.setItem('mockUserKey', 'visitor0'); // Correct visitor key
    }
    
    setCurrentUser(userToSet);
    setLoading(false);
  }, []);

  const login = (usernameOrEmail?: string, password?: string): LoginResult => {
    let userKeyToLogin: string | undefined;
    
    if (!usernameOrEmail) { 
        userKeyToLogin = 'guest1'; 
    } else {
        const lowerEmail = usernameOrEmail.toLowerCase();
        if (lowerEmail.includes('admin')) userKeyToLogin = 'admin1';
        else if (lowerEmail.includes('alice')) userKeyToLogin = 'user1';
        else if (lowerEmail.includes('founder')) userKeyToLogin = 'founder1';
        else if (lowerEmail.includes('diana')) userKeyToLogin = 'user4';
        else if (lowerEmail.includes('bob')) userKeyToLogin = 'user2';
        else if (lowerEmail.includes('charlie')) userKeyToLogin = 'user3';
        else if (lowerEmail.includes('sam')) userKeyToLogin = 'user5'; // Sanctioned Sam
        else userKeyToLogin = undefined; // User not found by simple email check
    }
    
    if (!userKeyToLogin || !mockAuthUsers[userKeyToLogin]) {
        // Default to a generic "user not found" or "credentials invalid" if more complex logic were here
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }

    const userToLogin = mockAuthUsers[userKeyToLogin];

    if (userToLogin.status === 'sanctioned') {
      console.log(`Login attempt for sanctioned user: ${userToLogin.username}`);
      return { 
        success: false, 
        reason: 'sanctioned', 
        username: userToLogin.username, 
        sanctionEndDate: userToLogin.sanctionEndDate 
      };
    }
    
    setCurrentUser(userToLogin);
    localStorage.setItem('mockUserKey', userKeyToLogin);
    return { success: true, user: userToLogin };
  };
  
  const signup = (username: string, email: string) => {
    // For mock purposes, signup always 'creates' Alice (user1)
    const newUserKey = 'user1'; 
    setCurrentUser(mockAuthUsers[newUserKey]);
    localStorage.setItem('mockUserKey', newUserKey);
     // In a real app, this would return success/failure
  };

  const logout = () => {
    setCurrentUser(mockAuthUsers['visitor0']);
    localStorage.setItem('mockUserKey', 'visitor0'); // Store visitor key on logout
  };
  
  const switchToUser = (roleOrKey: UserRole | string) => {
    let userToSwitchTo: MockUser | undefined;
    let keyToStore: string = 'visitor0'; 

    if (mockAuthUsers[roleOrKey]) { 
        userToSwitchTo = mockAuthUsers[roleOrKey];
        keyToStore = roleOrKey; 
    } else {
      // Fallback for generic role strings, mapping to specific users
      const roleMap: Partial<Record<UserRole, string>> = {
        'user': 'user1', 
        'normal_user': 'user2',
        'admin': 'admin1', 
        'founder': 'founder1', 
        'guest': 'guest1',
        'visitor': 'visitor0',
      };
      const mappedKey = roleMap[roleOrKey as UserRole];
      if (mappedKey && mockAuthUsers[mappedKey]) {
        userToSwitchTo = mockAuthUsers[mappedKey];
        keyToStore = mappedKey;
      }
    }

    if (userToSwitchTo) {
      if (userToSwitchTo.status === 'sanctioned') {
        console.warn(`Attempted to switch to sanctioned user: ${userToSwitchTo.username} via role switcher. This action is typically for testing UI states but login would block this user.`);
        // For testing UI as a sanctioned user, we might allow the switch here,
        // but a real login attempt would be blocked.
        // Or, we could prevent the switch entirely:
        // console.warn("Switch to sanctioned user blocked by switchToUser. Defaulting to visitor.");
        // setCurrentUser(mockAuthUsers['visitor0']);
        // localStorage.setItem('mockUserKey', 'visitor0');
        // return; 
      }
      setCurrentUser(userToSwitchTo);
      localStorage.setItem('mockUserKey', keyToStore);
    } else {
      console.warn(`Mock user for role/key "${roleOrKey}" not found. Defaulting to visitor.`);
      setCurrentUser(mockAuthUsers['visitor0']);
      localStorage.setItem('mockUserKey', 'visitor0');
    }
  };

  return { user: currentUser, loading, login, logout, signup, switchToUser };
}

    
