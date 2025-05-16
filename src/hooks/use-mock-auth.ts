
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
    registrationDate: '2023-03-20T14:30:00Z', 
    canVote: false, 
    status: 'sanctioned', // Explicitly sanctioned here for testing
    sanctionEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // Sanctioned for 2 days from now
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
      // Load the user as they are, even if sanctioned.
      // The SanctionCheckWrapper will handle redirection if needed.
      userToSet = potentialUser;
    } else {
      // Default to visitor if no valid key is found
      userToSet = mockAuthUsers['visitor0'];
      if (storedUserKey !== 'visitor0') { // Only reset localStorage if it wasn't already visitor0 or invalid
        localStorage.setItem('mockUserKey', 'visitor0'); 
      }
    }
    
    setCurrentUser(userToSet);
    setLoading(false);
  }, []);

  const login = (usernameOrEmail?: string, password?: string): LoginResult => {
    let userKeyToLogin: string | undefined;
    
    if (!usernameOrEmail) { 
        // This case might be considered an error or default to guest, but for now, let's treat it as not_found.
        // If intending to allow guest login this way, need to handle it explicitly.
        return { success: false, reason: 'credentials_invalid' };
    }
    
    const lowerInput = usernameOrEmail.toLowerCase();
    // Attempt to find user by username first, then by email part, then by key
    userKeyToLogin = Object.keys(mockAuthUsers).find(key => 
        mockAuthUsers[key].username.toLowerCase() === lowerInput || 
        mockAuthUsers[key].email.toLowerCase().startsWith(lowerInput) || // to match "sam" for sam@example.com
        key.toLowerCase() === lowerInput // to match "user4"
    );
    
    if (!userKeyToLogin || !mockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found' };
    }

    const userToLogin = mockAuthUsers[userKeyToLogin];

    if (userToLogin.status === 'sanctioned') {
      console.log(`Login attempt for sanctioned user: ${userToLogin.username}`);
      // We still return the user object so the login page can display details
      return { 
        success: false, 
        user: userToLogin, // Include user details for the login page to use
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
    // For simplicity, signup always logs in as 'user1' (Alice) in this mock.
    // A real app would create a new user.
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
      setCurrentUser(userToSwitchTo);
      localStorage.setItem('mockUserKey', userKey);
    } else {
      console.warn(`Mock user for key "${userKey}" not found in switchToUser. Defaulting to visitor0.`);
      setCurrentUser(mockAuthUsers['visitor0']);
      localStorage.setItem('mockUserKey', 'visitor0');
    }
  };

  return { user: currentUser, loading, login, logout, signup, switchToUser };
}

