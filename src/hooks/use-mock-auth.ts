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
    // Simulate fetching user data
    const storedUserRole = localStorage.getItem('mockUserRole') as UserRole | null;
    if (storedUserRole && mockUsers[storedUserRole]) {
      setCurrentUser(mockUsers[storedUserRole]);
    } else {
      // Default to visitor if no role is stored or if trying to set to a user that doesn't exist as a key
      setCurrentUser(mockUsers['visitor']); 
    }
    setLoading(false);
  }, []);

  const login = (role: UserRole = 'user') => {
    // Allow specific user login by username if needed, for now, role based.
    const userToLogin = Object.values(mockUsers).find(u => u.role === role) || mockUsers['guest'];
    setCurrentUser(userToLogin);
    localStorage.setItem('mockUserRole', userToLogin.role); // Store role key
  };
  
  const signup = (username: string, email: string) => {
    // Simulate signup, logs in as a new 'user' (quarantined)
    const newUser: MockUser = { id: `new-${Date.now()}`, username, email, role: 'user', isQuarantined: true, karma: 0 };
    setCurrentUser(newUser);
    // In a real app, this would go to backend and then you'd probably set a token
    // For mock, let's assume they become 'user1' for simplicity of state persistence or a generic 'user'
    localStorage.setItem('mockUserRole', 'user'); 
  };

  const logout = () => {
    setCurrentUser(mockUsers['visitor']);
    localStorage.removeItem('mockUserRole');
  };
  
  // Function to allow test-switching users
  const switchToUser = (role: UserRole) => {
    if (mockUsers[role]) {
      setCurrentUser(mockUsers[role]);
      localStorage.setItem('mockUserRole', role);
    } else if (Object.values(mockUsers).find(u => u.role === role)) {
        const userByRole = Object.values(mockUsers).find(u => u.role === role)!;
        setCurrentUser(userByRole);
        localStorage.setItem('mockUserRole', userByRole.role);
    }
     else {
      console.warn(`Mock user for role "${role}" not found. Defaulting to visitor.`);
      setCurrentUser(mockUsers['visitor']);
      localStorage.setItem('mockUserRole', 'visitor');
    }
  };


  return { user: currentUser, loading, login, logout, signup, switchToUser };
}