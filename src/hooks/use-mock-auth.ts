
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
// These keys should match the 'id' field of users in src/lib/mockData.ts
export const mockAuthUsers: Record<string, MockUser> = {
  'visitor0': { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor' },
  'guest1': { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://picsum.photos/seed/guest/100/100', role: 'guest' },
  'user1': { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/100/100', role: 'user', isQuarantined: true, karma: 10, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', registrationDate: '2023-01-15T10:00:00Z', canVote: true },
  'user2': { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/100/100', role: 'normal_user', karma: 150, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', registrationDate: '2023-03-20T14:30:00Z', canVote: true },
  'user3': { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/100/100', role: 'normal_user', karma: 75, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', registrationDate: '2022-11-01T08:00:00Z', canVote: true },
  'user4': { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', avatarUrl: 'https://picsum.photos/seed/diana/100/100', role: 'user', isQuarantined: true, karma: 0, location: 'New York', aboutMe: 'Just joined, excited to learn!', registrationDate: '2023-03-20T14:30:00Z', canVote: false },
  'admin1': { id: 'admin1', username: 'AdminAnna', email: 'adminana@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/100/100', role: 'admin', karma: 500, location: 'Control Room', aboutMe: 'Ensuring order and progress.', registrationDate: '2022-10-01T08:00:00Z', canVote: true },
  'founder1': { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/100/100', role: 'founder', karma: 1000, location: 'The Genesis Block', aboutMe: 'Laid the first stone.', registrationDate: '2022-09-01T08:00:00Z', canVote: true },
};


export function useMockAuth() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const storedUserKey = localStorage.getItem('mockUserKey') as string | null;
    let userToSet: MockUser | null = null;

    if (storedUserKey && mockAuthUsers[storedUserKey]) {
      userToSet = mockAuthUsers[storedUserKey];
    } else {
      // Default to visitor if no key or invalid key
      userToSet = mockAuthUsers['visitor0']; 
    }
    
    setCurrentUser(userToSet);
    setLoading(false);
  }, []);

  const login = (usernameOrEmail?: string, password?: string) => {
    let userKeyToLogin: string = 'user2'; 
    
    if (!usernameOrEmail) { 
        userKeyToLogin = 'guest1'; 
    } else if (usernameOrEmail?.toLowerCase().includes('admin')) {
        userKeyToLogin = 'admin1';
    } else if (usernameOrEmail?.toLowerCase().includes('alice')) {
        userKeyToLogin = 'user1';
    } else if (usernameOrEmail?.toLowerCase().includes('founder')) {
        userKeyToLogin = 'founder1';
    } else if (usernameOrEmail?.toLowerCase().includes('diana')) {
        userKeyToLogin = 'user4';
    } else if (usernameOrEmail?.toLowerCase().includes('bob')) {
        userKeyToLogin = 'user2';
    } else if (usernameOrEmail?.toLowerCase().includes('charlie')) {
        userKeyToLogin = 'user3';
    }


    const userToLogin = mockAuthUsers[userKeyToLogin] || mockAuthUsers['guest1'];
    setCurrentUser(userToLogin);
    localStorage.setItem('mockUserKey', userKeyToLogin);
  };
  
  const signup = (username: string, email: string) => {
    const newUserKey = 'user4'; 
    setCurrentUser(mockAuthUsers[newUserKey]);
    localStorage.setItem('mockUserKey', newUserKey);
  };

  const logout = () => {
    setCurrentUser(mockAuthUsers['visitor0']);
    localStorage.removeItem('mockUserKey');
  };
  
  const switchToUser = (roleOrKey: UserRole | string) => {
    let userToSwitchTo: MockUser | undefined;
    let keyToStore: string = 'visitor0'; 

    if (mockAuthUsers[roleOrKey]) {
        userToSwitchTo = mockAuthUsers[roleOrKey];
        keyToStore = roleOrKey; 
    } else {
      // Fallback for role names if direct key not found (though keys are preferred)
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
