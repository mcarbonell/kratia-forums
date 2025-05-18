
"use client";

import type { User, Thread, Post, Votation } from '@/lib/types'; // Added Thread, Post, Votation
import { UserStatus } from '@/lib/types'; // Import UserStatus
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, Timestamp, increment } from 'firebase/firestore';
import { mockUsers as initialMockAuthUsersData } from '@/lib/mockData';
import { KRATIA_CONFIG } from '@/lib/config'; // Added KRATIA_CONFIG

const AGORA_FORUM_ID = 'agora';

export type UserRole = 'visitor' | 'guest' | 'user' | 'normal_user' | 'admin' | 'founder';

export interface MockUser extends User {
  role: UserRole;
  status: UserStatus; // Ensure status is always UserStatus
  isQuarantined?: boolean;
  onboardingAccepted?: boolean;
}

const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
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

preparedMockAuthUsers['visitor0'] = { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor', status: 'active', onboardingAccepted: false, isQuarantined: false };
preparedMockAuthUsers['guest1'] = { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://placehold.co/100x100.png?text=G', role: 'guest', status: 'active', onboardingAccepted: false, isQuarantined: false };

if (preparedMockAuthUsers['user4']) { // DianaNewbie
    preparedMockAuthUsers['user4'].status = 'sanctioned';
    preparedMockAuthUsers['user4'].sanctionEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    preparedMockAuthUsers['user4'].isQuarantined = false;
    preparedMockAuthUsers['user4'].onboardingAccepted = true;
}
if (preparedMockAuthUsers['user5']) { // SanctionedSam
    preparedMockAuthUsers['user5'].status = 'sanctioned';
    preparedMockAuthUsers['user5'].sanctionEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

let internalCurrentUser: MockUser | null = null;
const listeners = new Set<(user: MockUser | null) => void>();

const setInternalCurrentUser = (user: MockUser | null) => {
  internalCurrentUser = user;
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

  const syncUserWithFirestore = useCallback(async (baseUser: MockUser | null): Promise<MockUser | null> => {
    if (!baseUser || !baseUser.id || baseUser.id === 'visitor0' || baseUser.id === 'guest1') {
      return baseUser;
    }
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        const updatedUser: MockUser = {
             ...baseUser,
             ...firestoreData,
             role: (firestoreData.role || baseUser.role || 'user') as UserRole,
             status: (firestoreData.status || baseUser.status || 'active') as UserStatus,
             onboardingAccepted: typeof firestoreData.onboardingAccepted === 'boolean' ? firestoreData.onboardingAccepted : (typeof baseUser.onboardingAccepted === 'boolean' ? baseUser.onboardingAccepted : false),
             isQuarantined: typeof firestoreData.isQuarantined === 'boolean' ? firestoreData.isQuarantined : (typeof baseUser.isQuarantined === 'boolean' ? baseUser.isQuarantined : false),
             sanctionEndDate: firestoreData.sanctionEndDate || baseUser.sanctionEndDate || undefined,
             karma: firestoreData.karma !== undefined ? firestoreData.karma : (baseUser.karma || 0),
             location: firestoreData.location !== undefined ? firestoreData.location : baseUser.location,
             aboutMe: firestoreData.aboutMe !== undefined ? firestoreData.aboutMe : baseUser.aboutMe,
             presentation: firestoreData.presentation !== undefined ? firestoreData.presentation : baseUser.presentation,
             canVote: typeof firestoreData.canVote === 'boolean' ? firestoreData.canVote : (baseUser.canVote === undefined ? false : baseUser.canVote),
             totalPostsByUser: firestoreData.totalPostsByUser !== undefined ? firestoreData.totalPostsByUser : (baseUser.totalPostsByUser || 0),
             totalReactionsReceived: firestoreData.totalReactionsReceived !== undefined ? firestoreData.totalReactionsReceived : (baseUser.totalReactionsReceived || 0),
             totalPostsInThreadsStartedByUser: firestoreData.totalPostsInThreadsStartedByUser !== undefined ? firestoreData.totalPostsInThreadsStartedByUser : (baseUser.totalPostsInThreadsStartedByUser || 0),
             totalThreadsStartedByUser: firestoreData.totalThreadsStartedByUser !== undefined ? firestoreData.totalThreadsStartedByUser : (baseUser.totalThreadsStartedByUser || 0),
        };

        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
        }
        return updatedUser;
      } else {
        return baseUser;
      }
    } catch (error) {
      console.error(`[syncUserWithFirestore] Error syncing user ${baseUser.id} with Firestore:`, error);
    }
    return baseUser;
  }, []);

  const loginAndSetUserFromFirestore = useCallback(async (uid: string, email?: string): Promise<LoginResult> => {
    const userRef = doc(db, "users", uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.warn(`[loginAndSetUserFromFirestore] User UID ${uid} not found in Firestore users collection.`);
        return { success: false, reason: 'not_found_in_firestore' };
      }
      let firestoreUser = { id: userSnap.id, ...userSnap.data() } as MockUser;

      if (firestoreUser.status === 'pending_email_verification') {
        // This block is now responsible for creating the admission request
        const batch = writeBatch(db);
        const now = Timestamp.now();
        const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

        // 1. Update User document to 'pending_admission'
        const userDocRefForUpdate = doc(db, "users", firestoreUser.id);
        batch.update(userDocRefForUpdate, { status: 'pending_admission' });

        // 2. Create Agora Thread for admission request
        const admissionThreadRef = doc(collection(db, "threads"));
        const admissionThreadTitle = `Admission Request: ${firestoreUser.username}`;
        const authorInfoForThread = {
          id: firestoreUser.id,
          username: firestoreUser.username,
          avatarUrl: firestoreUser.avatarUrl || `https://placehold.co/100x100.png?text=${firestoreUser.username?.[0]?.toUpperCase() || 'U'}`
        };
        
        const newVotationRef = doc(collection(db, "votations")); // Define votation ref first
        const admissionThreadData: Omit<Thread, 'id'> & { relatedVotationId: string } = {
          forumId: AGORA_FORUM_ID,
          title: admissionThreadTitle,
          author: authorInfoForThread,
          createdAt: now.toDate().toISOString(),
          lastReplyAt: now.toDate().toISOString(),
          postCount: 1,
          isPublic: true,
          relatedVotationId: newVotationRef.id, // Use the ID of the votation to be created
        };
        batch.set(admissionThreadRef, admissionThreadData);

        // 3. Create Initial Post in the Admission Thread (Applicant's Presentation)
        const initialPostRef = doc(collection(db, "posts"));
        const initialPostData: Omit<Post, 'id'> = {
          threadId: admissionThreadRef.id,
          author: authorInfoForThread,
          content: `**Applicant:** ${firestoreUser.username}\n\n**Reason for Joining / Presentation:**\n\n${firestoreUser.presentation || "No presentation provided."}`,
          createdAt: now.toDate().toISOString(),
          reactions: {},
        };
        batch.set(initialPostRef, initialPostData);
        
        // 4. Update Agora forum counts
        const agoraForumRef = doc(db, "forums", AGORA_FORUM_ID);
        batch.update(agoraForumRef, {
          threadCount: increment(1),
          postCount: increment(1),
        });
        
        // 5. Create Votation document for admission
        const votationData: Votation = {
          id: newVotationRef.id,
          title: `Vote on admission for ${firestoreUser.username}`,
          description: `Community vote to admit ${firestoreUser.username} to ${KRATIA_CONFIG.FORUM_NAME}. Their presentation is in the linked thread.`,
          proposerId: firestoreUser.id, 
          proposerUsername: firestoreUser.username,
          type: 'admission_request',
          createdAt: now.toDate().toISOString(),
          deadline: deadlineDate.toISOString(),
          status: 'active',
          targetUserId: firestoreUser.id, 
          targetUsername: firestoreUser.username,
          options: { for: 0, against: 0, abstain: 0 },
          voters: {},
          totalVotesCast: 0,
          quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
          relatedThreadId: admissionThreadRef.id,
        };
        batch.set(newVotationRef, votationData);

        await batch.commit();
        console.log(`[loginAndSetUserFromFirestore] Admission request created for ${firestoreUser.username}. Status updated to pending_admission.`);
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
        setInternalCurrentUser(firestoreUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mockUserKey', firestoreUser.id);
        }
        return { success: true, user: firestoreUser };
      }
      // Handle other unknown statuses
      console.warn(`[loginAndSetUserFromFirestore] User ${uid} has an unknown status in Firestore: ${firestoreUser.status}`);
      return { success: false, reason: 'unknown_firestore_status', username: firestoreUser.username };

    } catch (error) {
      console.error(`[loginAndSetUserFromFirestore] Error fetching/processing user ${uid} from Firestore:`, error);
      return { success: false, reason: 'auth_error' }; 
    }
  }, []);

  useEffect(() => {
    const listener = (newUser: MockUser | null) => {
      setCurrentUserLocal(newUser);
    };
    listeners.add(listener);
    setLoading(true);

    const initializeUser = async () => {
      let userToSet: MockUser | null = null;
      if (typeof window !== 'undefined') {
        const storedUserKey = localStorage.getItem('mockUserKey');
        if (storedUserKey) {
          if (preparedMockAuthUsers[storedUserKey]) { 
            userToSet = await syncUserWithFirestore({ ...preparedMockAuthUsers[storedUserKey] });
          } else { 
            // Assume it's a Firebase UID
            const baseUserForSync: MockUser = { id: storedUserKey, username: 'Loading...', email: '', role: 'user', status: 'active' }; // Minimal base
            const firestoreUserDoc = await getDoc(doc(db, "users", storedUserKey));
            if (firestoreUserDoc.exists()) {
                let fetchedFirestoreUser = { id: firestoreUserDoc.id, ...firestoreUserDoc.data() } as MockUser;
                 // Check for expired sanction on load
                if (fetchedFirestoreUser.status === 'sanctioned' && fetchedFirestoreUser.sanctionEndDate && new Date() > new Date(fetchedFirestoreUser.sanctionEndDate)) {
                    await updateDoc(doc(db, "users", storedUserKey), { status: 'active', sanctionEndDate: null });
                    fetchedFirestoreUser.status = 'active';
                    fetchedFirestoreUser.sanctionEndDate = undefined;
                }
                userToSet = fetchedFirestoreUser; // Directly use the fetched user
            } else {
                console.warn(`[useMockAuth initializeUser] User UID ${storedUserKey} not found in Firestore on init. Defaulting to visitor.`);
                userToSet = { ...preparedMockAuthUsers['visitor0'] };
                localStorage.setItem('mockUserKey', 'visitor0');
            }
          }
        } else {
          userToSet = { ...preparedMockAuthUsers['visitor0'] };
        }
      } else { 
        userToSet = { ...preparedMockAuthUsers['visitor0'] };
      }
      setInternalCurrentUser(userToSet);
      setLoading(false);
    };

    if (internalCurrentUser === null) {
      initializeUser();
    } else {
      setCurrentUserLocal(internalCurrentUser);
      setLoading(false);
    }
    
    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore]);


  const logout = useCallback(() => {
    const visitorUser = preparedMockAuthUsers['visitor0'];
    setInternalCurrentUser(visitorUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mockUserKey', 'visitor0');
    }
  }, []);

  const switchToUser = useCallback(async (userKey: string) => {
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
          return true;
        }
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error checking/lifting sanction for user ${userId}:`, error);
    }
    return false;
  }, [syncUserWithFirestore]);

  // Mock login for dev switcher, not for Firebase Auth based login
  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    if (!usernameOrEmail) {
        return { success: false, reason: 'auth_error' };
    }
    const lowerInput = usernameOrEmail.toLowerCase();
    const userKeyToLogin = Object.keys(preparedMockAuthUsers).find(
        key => key.toLowerCase() === lowerInput ||
               (preparedMockAuthUsers[key]?.username && preparedMockAuthUsers[key]?.username.toLowerCase() === lowerInput) ||
               (preparedMockAuthUsers[key]?.email && preparedMockAuthUsers[key]?.email!.toLowerCase().startsWith(lowerInput))
    );
    
    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in mockAuthUsers.`);
        return { success: false, reason: 'not_found_in_firestore' };
    }

    let userToLogin = await syncUserWithFirestore({ ...preparedMockAuthUsers[userKeyToLogin] });
    if (!userToLogin) {
        return { success: false, reason: 'not_found_in_firestore' };
    }

    if (userToLogin.status === 'pending_email_verification') {
        return { success: false, reason: 'email_not_verified', userEmail: userToLogin.email, username: userToLogin.username };
    }
    if (userToLogin.status === 'pending_admission') {
        return { success: false, reason: 'pending_admission', username: userToLogin.username };
    }
    if (userToLogin.status === 'sanctioned') {
      return { success: false, user: userToLogin, reason: 'sanctioned', username: userToLogin.username, sanctionEndDate: userToLogin.sanctionEndDate };
    }
    if (userToLogin.status === 'active') {
        setInternalCurrentUser(userToLogin);
        if (typeof window !== 'undefined') {
            localStorage.setItem('mockUserKey', userToLogin.id);
        }
        return { success: true, user: userToLogin };
    }
    return { success: false, reason: 'unknown_firestore_status', username: userToLogin.username };
  }, [syncUserWithFirestore]);

  return {
    user: currentUserLocal,
    loading,
    login,
    loginAndSetUserFromFirestore,
    logout,
    switchToUser,
    checkAndLiftSanction,
    mockAuthUsers: preparedMockAuthUsers,
    syncUserWithFirestore
  };
}
