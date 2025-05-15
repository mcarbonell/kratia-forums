
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
// The keys (e.g., 'visitor', 'alice', 'admin_anna') are used by switchToUser.
// The 'role' property within each user object defines their functional role in the app.
const mockAuthUsers: Record<string, MockUser> = {
  'visitor': { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor' }, // id can be empty or a placeholder
  'guest': { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://picsum.photos/seed/guest/100/100', role: 'guest' },
  // User 'user1' from mockData.ts (Alice) represents the 'user' role (quarantined)
  'user1': { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/100/100', role: 'user', isQuarantined: true, karma: 10, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!' },
  // User 'user2' from mockData.ts (BobTheBuilder) represents the 'normal_user' role
  'user2': { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/100/100', role: 'normal_user', karma: 150, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!' },
  // User 'admin1' from mockData.ts (AdminAnna) represents the 'admin' role
  'admin1': { id: 'admin1', username: 'AdminAnna', email: 'adminana@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/100/100', role: 'admin', karma: 500, location: 'Control Room', aboutMe: 'Ensuring order and progress.' },
  // User 'founder1' from mockData.ts (FoundingFather) represents the 'founder' role
  'founder1': { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/100/100', role: 'founder', karma: 1000, location: 'The Genesis Block', aboutMe: 'Laid the first stone.' },
};


export function useMockAuth() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // The key stored in localStorage should be one of the keys from mockAuthUsers (e.g., 'user1', 'admin1')
    const storedUserKey = localStorage.getItem('mockUserKey') as string | null;

    let userToSet: MockUser | null = null;

    if (storedUserKey && mockAuthUsers[storedUserKey]) {
      userToSet = mockAuthUsers[storedUserKey];
    } else {
      // Default to visitor if no key is stored or key is invalid
      userToSet = mockAuthUsers['visitor'];
    }
    
    setCurrentUser(userToSet);
    setLoading(false);
  }, []);

  const login = (usernameOrEmail?: string, password?: string) => {
    // Simple login: if admin keyword, log in as admin, else as normal_user
    // In a real app, this would involve API calls
    let userKeyToLogin: string = 'user2'; // Default to Bob (normal_user)
    if (usernameOrEmail?.toLowerCase().includes('admin')) {
        userKeyToLogin = 'admin1';
    } else if (usernameOrEmail?.toLowerCase().includes('alice')) {
        userKeyToLogin = 'user1';
    } else if (usernameOrEmail?.toLowerCase().includes('founder')) {
        userKeyToLogin = 'founder1';
    }

    const userToLogin = mockAuthUsers[userKeyToLogin] || mockAuthUsers['guest'];
    setCurrentUser(userToLogin);
    localStorage.setItem('mockUserKey', userKeyToLogin); 
  };
  
  const signup = (username: string, email: string) => {
    // For mock purposes, signup might switch to a generic 'new user' state
    // or, for more advanced testing, you could dynamically add to mockAuthUsers
    // For now, let's assume signup makes them 'user1' (Alice) for simplicity of testing profile.
    const newUserKey = 'user1'; // New users default to Alice (quarantined user)
    setCurrentUser(mockAuthUsers[newUserKey]);
    localStorage.setItem('mockUserKey', newUserKey); 
  };

  const logout = () => {
    setCurrentUser(mockAuthUsers['visitor']);
    localStorage.removeItem('mockUserKey');
  };
  
  const switchToUser = (roleOrKey: UserRole | string) => {
    // This function is primarily for the dev switcher.
    // It tries to find a user in mockAuthUsers whose 'role' property matches roleOrKey,
    // OR whose key in mockAuthUsers matches roleOrKey.
    let userToSwitchTo: MockUser | undefined;

    // First, try if roleOrKey is a direct key in mockAuthUsers (e.g., 'user1', 'admin1')
    if (mockAuthUsers[roleOrKey]) {
        userToSwitchTo = mockAuthUsers[roleOrKey];
    } else {
      // If not a direct key, try if it's a role value (e.g., 'user', 'admin')
      // This maps roles from the dropdown to specific pre-defined users
      if (roleOrKey === 'user') userToSwitchTo = mockAuthUsers['user1']; // Alice
      else if (roleOrKey === 'normal_user') userToSwitchTo = mockAuthUsers['user2']; // Bob
      else if (roleOrKey === 'admin') userToSwitchTo = mockAuthUsers['admin1']; // AdminAnna
      else if (roleOrKey === 'founder') userToSwitchTo = mockAuthUsers['founder1']; // FoundingFather
      else if (roleOrKey === 'guest') userToSwitchTo = mockAuthUsers['guest'];
      else if (roleOrKey === 'visitor') userToSwitchTo = mockAuthUsers['visitor'];
    }

    if (userToSwitchTo) {
      setCurrentUser(userToSwitchTo);
      // Store the key that uniquely identifies this user in mockAuthUsers (e.g., 'admin1', not just 'admin')
      const userKey = Object.keys(mockAuthUsers).find(key => mockAuthUsers[key].id === userToSwitchTo!.id);
      localStorage.setItem('mockUserKey', userKey || 'visitor');
    } else {
      console.warn(\`Mock user for role/key "\${roleOrKey}" not found. Defaulting to visitor.\`);
      setCurrentUser(mockAuthUsers['visitor']);
      localStorage.setItem('mockUserKey', 'visitor');
    }
  };

  return { user: currentUser, loading, login, logout, signup, switchToUser };
}
