
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
  'user4': { // DianaNewbie - Set as sanctioned for testing the redirect
    id: 'user4', 
    username: 'DianaNewbie', 
    email: 'diana@example.com', 
    avatarUrl: 'https://picsum.photos/seed/diana/100/100', 
    role: 'user', 
    isQuarantined: false, // No longer relevant if sanctioned
    karma: 0, 
    location: 'New York', 
    aboutMe: 'Was learning, now sanctioned.', 
    registrationDate: '2023-03-20T14:30:00Z', 
    canVote: false, 
    status: 'sanctioned', // Explicitly sanctioned here
    sanctionEndDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // Sanctioned for 1 day from now
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


export function useMockAuth() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const storedUserKey = localStorage.getItem('mockUserKey') as string | null;
    let userToSet: MockUser | null = null;

    if (storedUserKey && mockAuthUsers[storedUserKey]) {
      const potentialUser = mockAuthUsers[storedUserKey];
      // If storedUserKey points to a user defined as sanctioned in mockAuthUsers,
      // they should not be auto-logged in normally. The login function handles this block.
      // For auto-login via localStorage, if they were 'sanctioned' at the time of last session,
      // they effectively become a visitor until they try to log in again.
      if (potentialUser.status === 'sanctioned') {
         console.warn(`Attempted to auto-login sanctioned user via localStorage: ${potentialUser.username}. Defaulting to visitor.`);
         userToSet = mockAuthUsers['visitor0'];
         localStorage.setItem('mockUserKey', 'visitor0'); 
      } else {
        userToSet = potentialUser;
      }
    } else {
      userToSet = mockAuthUsers['visitor0'];
      localStorage.setItem('mockUserKey', 'visitor0'); 
    }
    
    setCurrentUser(userToSet);
    setLoading(false);
  }, []);

  const login = (usernameOrEmail?: string, password?: string): LoginResult => {
    let userKeyToLogin: string | undefined;
    
    if (!usernameOrEmail) { 
        userKeyToLogin = 'guest1'; 
    } else {
        const lowerInput = usernameOrEmail.toLowerCase();
        // Attempt to find user by username first, then by email part
        userKeyToLogin = Object.keys(mockAuthUsers).find(key => 
            mockAuthUsers[key].username.toLowerCase() === lowerInput || 
            mockAuthUsers[key].email.toLowerCase().startsWith(lowerInput) || // to match "sam" for sam@example.com
            key.toLowerCase() === lowerInput // to match "user4"
        );
    }
    
    if (!userKeyToLogin || !mockAuthUsers[userKeyToLogin]) {
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
    const newUserKey = 'user1'; 
    setCurrentUser(mockAuthUsers[newUserKey]);
    localStorage.setItem('mockUserKey', newUserKey);
  };

  const logout = () => {
    setCurrentUser(mockAuthUsers['visitor0']);
    localStorage.setItem('mockUserKey', 'visitor0');
  };
  
  const switchToUser = (userKey: string) => { // userKey is now like 'user1', 'admin1'
    let userToSwitchTo: MockUser | undefined = mockAuthUsers[userKey];
    
    if (userToSwitchTo) {
      // If switching to a user defined as sanctioned in mockAuthUsers, allow it for testing purposes
      // The SanctionCheckWrapper should then handle the redirect.
      setCurrentUser(userToSwitchTo);
      localStorage.setItem('mockUserKey', userKey);
    } else {
      console.warn(`Mock user for key "${userKey}" not found in switchToUser. Defaulting to visitor.`);
      setCurrentUser(mockAuthUsers['visitor0']);
      localStorage.setItem('mockUserKey', 'visitor0');
    }
  };

  return { user: currentUser, loading, login, logout, signup, switchToUser };
}
