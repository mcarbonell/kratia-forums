
"use client";

import type { User, Thread, Post, Votation } from '@/lib/types';
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
}

// Prepare a record of mock users by their ID for easy lookup.
export const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    // Exclude special states 'visitor0' and 'guest1' from being treated as DB users
    if (user.id === 'visitor0' || user.id === 'guest1') return;
    preparedMockAuthUsers[user.id] = {
        ...user,
        role: user.role || 'user',
        status: user.status || 'active',
        onboardingAccepted: user.onboardingAccepted === undefined ? false : user.onboardingAccepted,
        isQuarantined: user.isQuarantined === undefined ? false : user.isQuarantined,
        sanctionEndDate: user.sanctionEndDate || undefined,
    };
});
// Add special visitor/guest states
preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active', onboardingAccepted: false, isQuarantined: false };
preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active', onboardingAccepted: false, isQuarantined: false };


let internalCurrentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const setInternalCurrentUser = (user: MockUser | null) => {
  internalCurrentUser = user;
  // console.log('[useMockAuth] setInternalCurrentUser, notifying listeners. New user:', user?.username, 'Status:', user?.status);
  listeners.forEach(listener => listener(user));
};


export interface LoginResult {
  success: boolean;
  user?: MockUser;
  reason?: 'not_found_in_firestore' | 'sanctioned' | 'pending_admission' | 'auth_error' | 'email_not_verified' | 'unknown_firestore_status';
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
      // console.log('[syncUserWithFirestore] Base user is visitor/guest or null, returning as is.');
      return baseUserToSync;
    }
    // console.log(`[syncUserWithFirestore] Syncing user ${baseUserToSync.id} (${baseUserToSync.username}) with Firestore.`);
    const userRef = doc(db, "users", baseUserToSync.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        // console.log(`[syncUserWithFirestore] Firestore data for ${baseUserToSync.id}:`, firestoreData);
        const updatedUser: MockUser = {
             ...baseUserToSync,
             ...firestoreData,
             role: (firestoreData.role || baseUserToSync.role || 'user') as UserRole,
             status: (firestoreData.status || baseUserToSync.status || 'active') as UserStatus,
             onboardingAccepted: typeof firestoreData.onboardingAccepted === 'boolean' ? firestoreData.onboardingAccepted : (typeof baseUserToSync.onboardingAccepted === 'boolean' ? baseUserToSync.onboardingAccepted : false),
             isQuarantined: typeof firestoreData.isQuarantined === 'boolean' ? firestoreData.isQuarantined : (typeof baseUserToSync.isQuarantined === 'boolean' ? baseUserToSync.isQuarantined : false),
             sanctionEndDate: firestoreData.sanctionEndDate || baseUserToSync.sanctionEndDate || undefined,
             karma: firestoreData.karma !== undefined ? firestoreData.karma : (baseUserToSync.karma || 0),
             presentation: firestoreData.presentation !== undefined ? firestoreData.presentation : baseUserToSync.presentation,
             canVote: typeof firestoreData.canVote === 'boolean' ? firestoreData.canVote : (baseUserToSync.canVote === undefined ? false : baseUserToSync.canVote),
             // Stats
             totalPostsByUser: firestoreData.totalPostsByUser !== undefined ? firestoreData.totalPostsByUser : (baseUserToSync.totalPostsByUser || 0),
             totalReactionsReceived: firestoreData.totalReactionsReceived !== undefined ? firestoreData.totalReactionsReceived : (baseUserToSync.totalReactionsReceived || 0),
             totalPostsInThreadsStartedByUser: firestoreData.totalPostsInThreadsStartedByUser !== undefined ? firestoreData.totalPostsInThreadsStartedByUser : (baseUserToSync.totalPostsInThreadsStartedByUser || 0),
             totalThreadsStartedByUser: firestoreData.totalThreadsStartedByUser !== undefined ? firestoreData.totalThreadsStartedByUser : (baseUserToSync.totalThreadsStartedByUser || 0),
        };
        // Auto-lift sanction if expired
        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        // console.log(`[syncUserWithFirestore] Synced user ${updatedUser.id} state:`, updatedUser);
        return updatedUser;
      } else {
        // console.log(`[syncUserWithFirestore] User ${baseUserToSync.id} not found in Firestore. Returning base user.`);
        return baseUserToSync;
      }
    } catch (error) {
      console.error(`[syncUserWithFirestore] Error syncing user ${baseUserToSync.id} with Firestore:`, error);
    }
    return baseUserToSync; // Return original baseUser if sync fails
  }, []);


  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      // console.log('[useMockAuth listener] Received new user state:', newUser?.username, newUser?.status);
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    setLoading(true);

    const initializeUser = async () => {
      let userToSet: MockUser | null = null;
      if (typeof window !== 'undefined') {
        const storedUserKey = localStorage.getItem('mockUserKey');
        // console.log('[initializeUser] Stored user key:', storedUserKey);
        if (storedUserKey) {
          if (preparedMockAuthUsers[storedUserKey]) {
            userToSet = await syncUserWithFirestore({ ...preparedMockAuthUsers[storedUserKey] });
          } else if (auth.currentUser && auth.currentUser.uid === storedUserKey) {
            // console.log(`[initializeUser] Found Firebase UID ${storedUserKey} in localStorage from active Firebase Auth session.`);
            const fbAuthUser = auth.currentUser;
            const baseUserForSync: MockUser = {
                id: fbAuthUser.uid,
                username: fbAuthUser.displayName || 'User',
                email: fbAuthUser.email || '',
                avatarUrl: fbAuthUser.photoURL || undefined,
                role: 'user', status: 'active' // Defaults, Firestore will override
            };
            userToSet = await syncUserWithFirestore(baseUserForSync);
            if (!userToSet || (userToSet.id === baseUserForSync.id && !userToSet.registrationDate) ) {
                 console.warn(`[initializeUser] User UID ${storedUserKey} from Firebase Auth not fully resolved from Firestore. Defaulting to visitor.`);
                 userToSet = preparedMockAuthUsers['visitor0'];
                 localStorage.setItem('mockUserKey', 'visitor0');
            }
          } else {
             console.warn(`[initializeUser] Stored user key ${storedUserKey} is unrecognized or stale. Defaulting to visitor.`);
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
      // console.log('[initializeUser] User initialized:', userToSet);
    };

    if (internalCurrentUser === null) { // Initialize only if not already set (e.g., by login)
        initializeUser();
    } else {
        setCurrentUserLocal(internalCurrentUser);
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
    photoURLFromProvider?: string | null,
    presentationFromForm?: string | null // Added presentation for Google Sign-Up
  ): Promise<LoginResult> => {
    const userRef = doc(db, "users", uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // New user from a provider (e.g., Google Sign-In/Sign-Up)
        // console.log(`[loginAndSetUserFromFirestore] New user (UID: ${uid}) from provider. Creating profile and admission request.`);
        const batch = writeBatch(db);
        const now = Timestamp.now();
        const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

        const newUsername = displayNameFromProvider || emailFromProvider?.split('@')[0] || `User_${uid.substring(0,6)}`;
        const newAvatarUrl = photoURLFromProvider || `https://placehold.co/100x100.png?text=${newUsername?.[0]?.toUpperCase() || 'U'}`;
        
        const newUserFirestoreData: Omit<User, 'id'> = {
          username: newUsername,
          email: emailFromProvider || `${uid}@kratia.example.com`,
          avatarUrl: newAvatarUrl,
          registrationDate: now.toDate().toISOString(),
          karma: 0,
          presentation: presentationFromForm || `Joined Kratia Forums via external provider.`,
          canVote: false,
          isQuarantined: true,
          status: 'pending_admission',
          role: 'guest',
          totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, totalThreadsStartedByUser: 0,
          onboardingAccepted: false,
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
          description: `Community vote to admit ${newUserFirestoreData.username}.`,
          proposerId: uid, proposerUsername: newUserFirestoreData.username, type: 'admission_request',
          createdAt: now.toDate().toISOString(), deadline: deadlineDate.toISOString(), status: 'active',
          targetUserId: uid, targetUsername: newUserFirestoreData.username,
          options: { for: 0, against: 0, abstain: 0 }, voters: {}, totalVotesCast: 0,
          quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS, relatedThreadId: admissionThreadRef.id,
        };
        batch.set(newVotationRef, votationData);
        await batch.commit();
        return { success: false, reason: 'pending_admission', username: newUserFirestoreData.username };
      }

      let firestoreUser = { id: userSnap.id, ...userSnap.data() } as MockUser;
      // console.log(`[loginAndSetUserFromFirestore] User ${uid} found in Firestore. Status: ${firestoreUser.status}`);

      if (firestoreUser.status === 'pending_email_verification') {
        // console.log(`[loginAndSetUserFromFirestore] User ${uid} is 'pending_email_verification'. Creating admission request as email is now verified.`);
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
        firestoreUser.status = 'pending_admission'; // Update local copy
        return { success: false, reason: 'pending_admission', username: firestoreUser.username };
      }
      
      if (firestoreUser.status === 'pending_admission') {
        return { success: false, reason: 'pending_admission', username: firestoreUser.username };
      }
      if (firestoreUser.status === 'sanctioned') {
        if (firestoreUser.sanctionEndDate && new Date() > new Date(firestoreUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          firestoreUser.status = 'active';
          firestoreUser.sanctionEndDate = undefined;
        } else {
          return { success: false, user: firestoreUser, reason: 'sanctioned', username: firestoreUser.username, sanctionEndDate: firestoreUser.sanctionEndDate };
        }
      }
      if (firestoreUser.status === 'active') {
        const fullySyncedUser = await syncUserWithFirestore(firestoreUser);
        setInternalCurrentUser(fullySyncedUser);
        if (typeof window !== 'undefined' && fullySyncedUser) {
          localStorage.setItem('mockUserKey', fullySyncedUser.id);
        }
        return { success: true, user: fullySyncedUser };
      }
      // console.warn(`[loginAndSetUserFromFirestore] User ${uid} has an unknown status: ${firestoreUser.status}`);
      return { success: false, reason: 'unknown_firestore_status', username: firestoreUser.username };

    } catch (error) {
      console.error(`[loginAndSetUserFromFirestore] Error fetching/processing user ${uid}:`, error);
      return { success: false, reason: 'auth_error' }; // Generic error if Firestore interaction fails
    }
  }, [syncUserWithFirestore]);


  const logout = useCallback(() => {
    const visitorUser = preparedMockAuthUsers['visitor0'];
    setInternalCurrentUser(visitorUser);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mockUserKey');
    }
    auth.signOut().catch(error => console.error("Error signing out from Firebase Auth:", error));
    // console.log('[logout] User logged out, set to visitor.');
  }, []);

  const switchToUser = useCallback(async (userKey: keyof typeof preparedMockAuthUsers | string) => {
    let userToSwitchTo: MockUser | null = preparedMockAuthUsers[userKey] ? { ...preparedMockAuthUsers[userKey] } : null;
    
    if (userToSwitchTo) {
        userToSwitchTo = await syncUserWithFirestore(userToSwitchTo);
        setInternalCurrentUser(userToSwitchTo);
        if (typeof window !== 'undefined' && userToSwitchTo) {
            localStorage.setItem('mockUserKey', userToSwitchTo.id);
        }
        // console.log(`[switchToUser] Switched to mock user: ${userToSwitchTo?.username}`);
    } else {
        // console.warn(`[switchToUser] User key "${userKey}" not found in preparedMockAuthUsers. Defaulting to visitor.`);
        const visitorUser = await syncUserWithFirestore({ ...preparedMockAuthUsers['visitor0'] });
        setInternalCurrentUser(visitorUser);
        if (typeof window !== 'undefined') {
            localStorage.setItem('mockUserKey', 'visitor0');
        }
    }
  }, [syncUserWithFirestore]);

  const checkAndLiftSanction = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId || userId === 'visitor0' || userId === 'guest1') return false;
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
          // console.log(`[checkAndLiftSanction] Sanction lifted for user ${userId}.`);
          return true;
        }
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error for user ${userId}:`, error);
    }
    return false;
  }, [syncUserWithFirestore]);


  return {
    user: currentUserLocal,
    loading,
    loginAndSetUserFromFirestore, // Primary login function now
    logout,
    switchToUser,
    checkAndLiftSanction,
    preparedMockAuthUsers,
    syncUserWithFirestore,
  };
}

