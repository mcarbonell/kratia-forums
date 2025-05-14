"use client";

import type { User } from '@/lib/types';
import { useState, useEffect } from 'react';

// Define more specific user types based on roles for Kratia
export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  // Add other Kratia specific fields if necessary for mock
  isQuarantined?: boolean; 
}

const mockUsers: Record<string, MockUser> = {
  'visitor': { id: '', username: '', email: '', role: 'visitor' },
  'guest': { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://picsum.photos/seed/guest/100/100', role: 'guest' },
  'user1': { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/100/100', role: 'user', isQuarantined: true, karma: 10, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!' },
  'user2': { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/100/100', role: 'normal_user', karma: 150, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!' },
  'admin1': { id: 'admin1', username: 'AdminAnna', email: 'admin@example.com', avatarUrl: 'https://picsum.photos/seed/admin/100/100', role: 'admin', karma: 500, location: 'Server Room', aboutMe: 'Keeping things running smoothly.' },
  'founder1': { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/100/100', role: 'founder', karma: 1000, location: 'The Agora', aboutMe: 'Started it all.' },
};

export function useMockAuth() {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const storedRoleIdentifier = localStorage.getItem('mockUserRole') as UserRole | string | null;

    let userToSet: MockUser | null = null;

    if (storedRoleIdentifier) {
      // First, check if storedRoleIdentifier is a direct key in mockUsers (e.g., 'user1', 'admin1')
      if (mockUsers[storedRoleIdentifier]) {
        userToSet = mockUsers[storedRoleIdentifier];
      } else {
        // If not a direct key, check if it's a role value (e.g. 'user', 'admin')
        // This ensures roles like 'user' (which is not a key in mockUsers) correctly map to a user like Alice (user1)
        const userByRoleValue = Object.values(mockUsers).find(u => u.role === storedRoleIdentifier);
        if (userByRoleValue) {
          userToSet = userByRoleValue;
        }
      }
    }

    if (userToSet) {
      setCurrentUser(userToSet);
    } else {
      // Default to visitor if no role is stored or user not found by key/role
      setCurrentUser(mockUsers['visitor']);
    }
    setLoading(false);
  }, []);

  const login = (role: UserRole = 'user') => {
    const userToLogin = Object.values(mockUsers).find(u => u.role === role) || mockUsers['guest'];
    setCurrentUser(userToLogin);
    localStorage.setItem('mockUserRole', userToLogin.role); 
  };
  
  const signup = (username: string, email: string) => {
    const newUser: MockUser = { 
      id: `new-${Date.now()}`, 
      username, 
      email, 
      role: 'user', // New users start with 'user' role
      isQuarantined: true, 
      karma: 0,
      avatarUrl: `https://picsum.photos/seed/${username}/100/100` // Generic avatar for new user
    };
    setCurrentUser(newUser);
    localStorage.setItem('mockUserRole', 'user'); 
  };

  const logout = () => {
    setCurrentUser(mockUsers['visitor']);
    localStorage.removeItem('mockUserRole');
  };
  
  const switchToUser = (roleOrKey: UserRole | string) => {
    let userToSwitchTo: MockUser | undefined = mockUsers[roleOrKey]; // Try as key first

    if (!userToSwitchTo) { // If not a key, try as a role value
        userToSwitchTo = Object.values(mockUsers).find(u => u.role === roleOrKey);
    }

    if (userToSwitchTo) {
      setCurrentUser(userToSwitchTo);
      localStorage.setItem('mockUserRole', userToSwitchTo.role); // Always store the role property
    } else {
      console.warn(`Mock user for role/key "${roleOrKey}" not found. Defaulting to visitor.`);
      setCurrentUser(mockUsers['visitor']);
      localStorage.setItem('mockUserRole', 'visitor');
    }
  };


  return { user: currentUser, loading, login, logout, signup, switchToUser };
}