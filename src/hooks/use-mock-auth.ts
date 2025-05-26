
"use client";

import type { User, Thread, Post, Votation, UserNotificationPreferences, UserNotificationSetting } from '@/lib/types'; // Added UserNotificationPreferences
import { UserStatus } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, Timestamp, increment, setDoc } from 'firebase/firestore';
import { mockUsers as initialMockAuthUsersData } from '@/lib/mockData';
import { KRATIA_CONFIG } from '@/lib/config';

const AGORA_FORUM_ID = 'agora';

export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  status: UserStatus;
  isQuarantined?: boolean;
  onboardingAccepted?: boolean;
  notificationPreferences?: UserNotificationPreferences; // Added
}

const defaultUserNotificationPreferences: UserNotificationPreferences = {
  newReplyToMyThread: { web: true },
  votationConcludedProposer: { web: true },
};

export const preparedMockAuthUsers: Record<string, MockUser> = {
  'visitor0': { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active', onboardingAccepted: false, isQuarantined: false, notificationPreferences: defaultUserNotificationPreferences },
  'guest1': { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active', onboardingAccepted: false, isQuarantined: false, notificationPreferences: defaultUserNotificationPreferences }
};

initialMockAuthUsersData.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return;
    preparedMockAuthUsers[user.id] = {
        ...user,
        role: user.role || 'user',
        status: user.status || 'active',
        onboardingAccepted: user.onboardingAccepted === undefined ? false : user.onboardingAccepted,
        isQuarantined: user.isQuarantined === undefined ? (user.role === 'user' && user.status === 'pending_admission') : user.isQuarantined, // Adjusted default for pending_admission
        sanctionEndDate: user.sanctionEndDate || undefined,
        notificationPreferences: user.notificationPreferences || defaultUserNotificationPreferences,
    };
});


let internalCurrentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const setInternalCurrentUser = (user: MockUser | null) => {
  internalCurrentUser = user;
  listeners.forEach(listener => listener(user));
};


export interface LoginResult {
  success: boolean;
  user?: MockUser;
  reason?: 'not_found_in_firestore' | 'sanctioned' | 'pending_admission' | 'auth_error' | 'email_not_verified' | 'unknown_firestore_status' | 'not_found';
  username?: string;
  sanctionEndDate?: string;
  authErrorCode?: string;
  userEmail?: string;
}

export function useMockAuth() {
  const [currentUserLocal, setCurrentUserLocal] = useState<MockUser | null>(internalCurrentUser);
  const [loading, setLoading] = useState(true);

  const syncUserWithFirestore = useCallback(async (baseUserToSync: MockUser | null): Promise<MockUser | null> => {
    if (!baseUserToSync || !baseUserToSync.id || baseUserToSync.id === 'visitor0' || baseUserToSync.id === 'guest1') {
      return baseUserToSync;
    }
    const userRef = doc(db, "users", baseUserToSync.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        const updatedUser: MockUser = {
             ...baseUserToSync,
             ...firestoreData,
             username: firestoreData.username || baseUserToSync.username,
             email: firestoreData.email || baseUserToSync.email,
             avatarUrl: firestoreData.avatarUrl || baseUserToSync.avatarUrl,
             role: (firestoreData.role || baseUserToSync.role || 'user') as UserRole,
             status: (firestoreData.status || baseUserToSync.status || 'active') as UserStatus,
             onboardingAccepted: typeof firestoreData.onboardingAccepted === 'boolean' ? firestoreData.onboardingAccepted : (baseUserToSync.onboardingAccepted === undefined ? false : baseUserToSync.onboardingAccepted),
             isQuarantined: typeof firestoreData.isQuarantined === 'boolean' ? firestoreData.isQuarantined : (baseUserToSync.isQuarantined === undefined ? (firestoreData.status === 'pending_admission') : baseUserToSync.isQuarantined),
             sanctionEndDate: firestoreData.sanctionEndDate || baseUserToSync.sanctionEndDate || undefined,
             karma: firestoreData.karma !== undefined ? firestoreData.karma : (baseUserToSync.karma || 0),
             presentation: firestoreData.presentation !== undefined ? firestoreData.presentation : baseUserToSync.presentation,
             canVote: typeof firestoreData.canVote === 'boolean' ? firestoreData.canVote : (baseUserToSync.canVote === undefined ? false : baseUserToSync.canVote),
             totalPostsByUser: firestoreData.totalPostsByUser !== undefined ? firestoreData.totalPostsByUser : (baseUserToSync.totalPostsByUser || 0),
             totalReactionsReceived: firestoreData.totalReactionsReceived !== undefined ? firestoreData.totalReactionsReceived : (baseUserToSync.totalReactionsReceived || 0),
             totalPostsInThreadsStartedByUser: firestoreData.totalPostsInThreadsStartedByUser !== undefined ? firestoreData.totalPostsInThreadsStartedByUser : (baseUserToSync.totalPostsInThreadsStartedByUser || 0),
             totalThreadsStartedByUser: firestoreData.totalThreadsStartedByUser !== undefined ? firestoreData.totalThreadsStartedByUser : (baseUserToSync.totalThreadsStartedByUser || 0),
             notificationPreferences: firestoreData.notificationPreferences || baseUserToSync.notificationPreferences || defaultUserNotificationPreferences,
        };
        
        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          // Sanction has expired, update in Firestore and reflect locally
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = null;
        }
        return updatedUser;
      } else {
        // User exists in auth/localStorage but not Firestore (should be rare after first signup)
        // Potentially re-seed this user if they are one of the mock users
        const mockEntry = initialMockAuthUsersData.find(u => u.id === baseUserToSync.id);
        if (mockEntry) {
            console.warn(`User ${baseUserToSync.id} found in mocks but not Firestore. Re-seeding this user.`);
            const userToSeed: Omit<User, 'id'> & { id: string } = {
                ...mockEntry,
                notificationPreferences: mockEntry.notificationPreferences || defaultUserNotificationPreferences,
            };
            await setDoc(userRef, userToSeed);
            return userToSeed as MockUser;
        }
        return baseUserToSync; // Or null if we consider this an error state
      }
    } catch (error) {
      console.error(`[syncUserWithFirestore] Error syncing user ${baseUserToSync.id} with Firestore:`, error);
    }
    return baseUserToSync;
  }, []);


  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    
    const initializeUser = async () => {
      setLoading(true);
      let userToSet: MockUser | null = null;
      if (typeof window !== 'undefined') {
        const storedUserKey = localStorage.getItem('mockUserKey');
        if (storedUserKey) {
            let baseUserForSync: MockUser | undefined = preparedMockAuthUsers[storedUserKey];
            if (!baseUserForSync && auth.currentUser && auth.currentUser.uid === storedUserKey) {
                // User might be logged in via Firebase Auth but not in preparedMockAuthUsers
                baseUserForSync = {
                    id: auth.currentUser.uid,
                    username: auth.currentUser.displayName || 'User',
                    email: auth.currentUser.email || '',
                    avatarUrl: auth.currentUser.photoURL || undefined,
                    role: 'user', // Default, Firestore will override
                    status: 'active', // Default
                    notificationPreferences: defaultUserNotificationPreferences,
                };
            } else if (!baseUserForSync) {
                 console.warn(`Stored user key ${storedUserKey} not found in prepared mocks or Firebase auth session. Defaulting to visitor.`);
            }

            if (baseUserForSync) {
                userToSet = await syncUserWithFirestore(baseUserForSync);
            } else {
                userToSet = preparedMockAuthUsers['visitor0'];
                localStorage.setItem('mockUserKey', 'visitor0');
            }
        } else {
          userToSet = preparedMockAuthUsers['visitor0'];
        }
      } else {
        userToSet = preparedMockAuthUsers['visitor0'];
      }
      setInternalCurrentUser(userToSet);
      setLoading(false);
    };

    if (internalCurrentUser === null || (internalCurrentUser.id === 'visitor0' && auth.currentUser)) {
        // Initialize if no user is set, or if current is visitor but Firebase Auth has a user (e.g. page reload)
        initializeUser();
    } else {
        setCurrentUserLocal(internalCurrentUser); // Ensure local state is in sync
        setLoading(false);
    }

    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore]);


  const loginAndSetUserFromFirestore = useCallback(async (
    uid: string,
    emailFromProvider?: string | null,
    displayNameFromProvider?: string | null,
    photoURLFromProvider?: string | null
  ): Promise<LoginResult> => {
    setLoading(true);
    const userRef = doc(db, "users", uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // New user from a provider (e.g., Google Sign-In/Sign-Up)
        const batch = writeBatch(db);
        const now = Timestamp.now();
        const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

        const newUsername = displayNameFromProvider || emailFromProvider?.split('@')[0] || `User_${uid.substring(0,6)}`;
        const newAvatarUrl = photoURLFromProvider || `https://placehold.co/100x100.png?text=${newUsername?.[0]?.toUpperCase() || 'U'}`;
        
        const newUserFirestoreData: Omit<User, 'id'> = {
          username: newUsername,
          email: emailFromProvider || `${uid}@kratia.example.com`, // Fallback email
          avatarUrl: newAvatarUrl,
          registrationDate: now.toDate().toISOString(),
          karma: 0,
          presentation: `Joined Kratia Forums via external provider.`,
          canVote: false,
          isQuarantined: true,
          status: 'pending_admission',
          role: 'guest',
          totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, totalThreadsStartedByUser: 0,
          onboardingAccepted: false,
          notificationPreferences: defaultUserNotificationPreferences,
        };
        batch.set(userRef, newUserFirestoreData);

        const admissionThreadRef = doc(collection(db, "threads"));
        const admissionThreadTitle = `Admission Request: ${newUserFirestoreData.username}`;
        const authorInfoForThread = { id: uid, username: newUserFirestoreData.username, avatarUrl: newUserFirestoreData.avatarUrl };
        
        const newVotationRef = doc(collection(db, "votations"));
        const admissionThreadData: Omit<Thread, 'id'> & { relatedVotationId: string } = {
          forumId: AGORA_FORUM_ID, title: admissionThreadTitle, author: authorInfoForThread,
          createdAt: now.toDate().toISOString(), lastReplyAt: now.toDate().toISOString(),
          postCount: 1, isPublic: true, relatedVotationId: newVotationRef.id,
        };
        batch.set(admissionThreadRef, admissionThreadData);

        const initialPostRef = doc(collection(db, "posts"));
        const initialPostData: Omit<Post, 'id'> = {
          threadId: admissionThreadRef.id, author: authorInfoForThread,
          content: `**Applicant:** ${newUserFirestoreData.username}\n\n**Presentation:**\n${newUserFirestoreData.presentation}`,
          createdAt: now.toDate().toISOString(), reactions: {},
        };
        batch.set(initialPostRef, initialPostData);
        
        const agoraForumRef = doc(db, "forums", AGORA_FORUM_ID);
        batch.update(agoraForumRef, { threadCount: increment(1), postCount: increment(1) });
        
        const votationData: Votation = {
          id: newVotationRef.id, title: `Vote on admission for ${newUserFirestoreData.username}`,
          description: `Community vote to admit ${newUserFirestoreData.username}. Their presentation is in the linked thread.`,
          proposerId: uid, proposerUsername: newUserFirestoreData.username, type: 'admission_request',
          createdAt: now.toDate().toISOString(), deadline: deadlineDate.toISOString(), status: 'active',
          targetUserId: uid, targetUsername: newUserFirestoreData.username,
          options: { for: 0, against: 0, abstain: 0 }, voters: {}, totalVotesCast: 0,
          quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS, relatedThreadId: admissionThreadRef.id,
        };
        batch.set(newVotationRef, votationData);
        await batch.commit();
        setLoading(false);
        return { success: false, reason: 'pending_admission', username: newUserFirestoreData.username };
      }

      let firestoreUser = { id: userSnap.id, ...userSnap.data() } as MockUser;
      
      if (firestoreUser.status === 'pending_email_verification') {
        const batch = writeBatch(db);
        batch.update(userRef, { status: 'pending_admission' });

        const now = Timestamp.now();
        const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);
        const admissionThreadRef = doc(collection(db, "threads"));
        const admissionThreadTitle = `Admission Request: ${firestoreUser.username}`;
        const authorInfoForThread = { id: uid, username: firestoreUser.username, avatarUrl: firestoreUser.avatarUrl };
        
        const newVotationRef = doc(collection(db, "votations"));
        const admissionThreadData: Omit<Thread, 'id'> & { relatedVotationId: string } = {
            forumId: AGORA_FORUM_ID, title: admissionThreadTitle, author: authorInfoForThread,
            createdAt: now.toDate().toISOString(), lastReplyAt: now.toDate().toISOString(),
            postCount: 1, isPublic: true, relatedVotationId: newVotationRef.id,
        };
        batch.set(admissionThreadRef, admissionThreadData);

        const initialPostRef = doc(collection(db, "posts"));
        const initialPostData: Omit<Post, 'id'> = {
            threadId: admissionThreadRef.id, author: authorInfoForThread,
            content: `**Applicant:** ${firestoreUser.username}\n\n**Reason for Joining / Presentation:**\n\n${firestoreUser.presentation || "No presentation provided."}`,
            createdAt: now.toDate().toISOString(), reactions: {},
        };
        batch.set(initialPostRef, initialPostData);
        
        const agoraForumRef = doc(db, "forums", AGORA_FORUM_ID);
        batch.update(agoraForumRef, { threadCount: increment(1), postCount: increment(1) });
        
        const votationData: Votation = {
            id: newVotationRef.id, title: `Vote on admission for ${firestoreUser.username}`,
            description: `Community vote to admit ${firestoreUser.username}. Their presentation is in the linked thread.`,
            proposerId: uid, proposerUsername: firestoreUser.username, type: 'admission_request',
            createdAt: now.toDate().toISOString(), deadline: deadlineDate.toISOString(), status: 'active',
            targetUserId: uid, targetUsername: firestoreUser.username,
            options: { for: 0, against: 0, abstain: 0 }, voters: {}, totalVotesCast: 0,
            quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS, relatedThreadId: admissionThreadRef.id,
        };
        batch.set(newVotationRef, votationData);
        await batch.commit();
        firestoreUser.status = 'pending_admission';
        setLoading(false);
        return { success: false, reason: 'pending_admission', username: firestoreUser.username };
      }
      
      if (firestoreUser.status === 'pending_admission') {
        setLoading(false);
        return { success: false, reason: 'pending_admission', username: firestoreUser.username };
      }
      if (firestoreUser.status === 'sanctioned') {
        if (firestoreUser.sanctionEndDate && new Date() > new Date(firestoreUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          firestoreUser.status = 'active';
          firestoreUser.sanctionEndDate = null;
        } else {
          setLoading(false);
          return { success: false, user: firestoreUser, reason: 'sanctioned', username: firestoreUser.username, sanctionEndDate: firestoreUser.sanctionEndDate };
        }
      }
      if (firestoreUser.status === 'active') {
        const fullySyncedUser = await syncUserWithFirestore(firestoreUser);
        setInternalCurrentUser(fullySyncedUser);
        if (typeof window !== 'undefined' && fullySyncedUser) {
          localStorage.setItem('mockUserKey', fullySyncedUser.id);
        }
        setLoading(false);
        return { success: true, user: fullySyncedUser };
      }
      setLoading(false);
      return { success: false, reason: 'unknown_firestore_status', username: firestoreUser.username };

    } catch (error) {
      console.error(`[loginAndSetUserFromFirestore] Error fetching/processing user ${uid}:`, error);
      setLoading(false);
      return { success: false, reason: 'auth_error' };
    }
  }, [syncUserWithFirestore]);


  const logout = useCallback(() => {
    const visitorUser = preparedMockAuthUsers['visitor0'];
    setInternalCurrentUser(visitorUser);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mockUserKey');
      localStorage.setItem('mockUserKey', 'visitor0'); // Ensure visitor state on logout
    }
    auth.signOut().catch(error => console.error("Error signing out from Firebase Auth:", error));
  }, []);

  const switchToUser = useCallback(async (userKey: keyof typeof preparedMockAuthUsers | string) => {
    setLoading(true);
    let userToSwitchTo: MockUser | null = preparedMockAuthUsers[userKey] ? { ...preparedMockAuthUsers[userKey] } : null;
    
    if (userToSwitchTo) {
        userToSwitchTo = await syncUserWithFirestore(userToSwitchTo);
        setInternalCurrentUser(userToSwitchTo);
        if (typeof window !== 'undefined' && userToSwitchTo) {
            localStorage.setItem('mockUserKey', userToSwitchTo.id);
        }
    } else {
        const visitorUser = await syncUserWithFirestore({ ...preparedMockAuthUsers['visitor0'] });
        setInternalCurrentUser(visitorUser);
        if (typeof window !== 'undefined') {
            localStorage.setItem('mockUserKey', 'visitor0');
        }
    }
    setLoading(false);
  }, [syncUserWithFirestore]);

  const checkAndLiftSanction = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId || userId === 'visitor0' || userId === 'guest1') return false;
    setLoading(true);
    const userRef = doc(db, "users", userId);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userDataFromFirestore = userSnap.data() as User;
        if (userDataFromFirestore.status === 'sanctioned' && userDataFromFirestore.sanctionEndDate && new Date() > new Date(userDataFromFirestore.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          if (internalCurrentUser && internalCurrentUser.id === userId) {
             const freshlySyncedUser = await syncUserWithFirestore({ ...internalCurrentUser, status: 'active', sanctionEndDate: undefined });
             setInternalCurrentUser(freshlySyncedUser);
          }
          setLoading(false);
          return true;
        }
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error for user ${userId}:`, error);
    }
    setLoading(false);
    return false;
  }, [syncUserWithFirestore]);


  return {
    user: currentUserLocal,
    loading,
    loginAndSetUserFromFirestore,
    logout,
    switchToUser,
    checkAndLiftSanction,
    preparedMockAuthUsers,
    syncUserWithFirestore, // Exported for use in OnboardingMessage
  };
}
