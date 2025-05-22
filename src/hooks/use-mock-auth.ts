
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

const preparedMockAuthUsers: Record<string, MockUser> = {};
initialMockAuthUsersData.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return; // these are special, not in DB
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
    preparedMockAuthUsers['user4'].status = 'sanctioned'; // Default for testing sanctioned state
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
      // console.log('[syncUserWithFirestore] Base user is visitor/guest or null, returning as is.');
      return baseUser;
    }
    // console.log(`[syncUserWithFirestore] Syncing user ${baseUser.id} with Firestore.`);
    const userRef = doc(db, "users", baseUser.id);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data() as User;
        // console.log(`[syncUserWithFirestore] Firestore data for ${baseUser.id}:`, firestoreData);
        const updatedUser: MockUser = {
             ...baseUser, // Start with base (e.g., from mockAuthUsers or Firebase Auth)
             ...firestoreData, // Override with Firestore data
             role: (firestoreData.role || baseUser.role || 'user') as UserRole,
             status: (firestoreData.status || baseUser.status || 'active') as UserStatus,
             onboardingAccepted: typeof firestoreData.onboardingAccepted === 'boolean' ? firestoreData.onboardingAccepted : (typeof baseUser.onboardingAccepted === 'boolean' ? baseUser.onboardingAccepted : false),
             isQuarantined: typeof firestoreData.isQuarantined === 'boolean' ? firestoreData.isQuarantined : (typeof baseUser.isQuarantined === 'boolean' ? baseUser.isQuarantined : false),
             sanctionEndDate: firestoreData.sanctionEndDate || baseUser.sanctionEndDate || undefined,
             // Ensure other fields are also correctly merged/defaulted
             karma: firestoreData.karma !== undefined ? firestoreData.karma : (baseUser.karma || 0),
             location: firestoreData.location !== undefined ? firestoreData.location : baseUser.location,
             aboutMe: firestoreData.aboutMe !== undefined ? firestoreData.aboutMe : baseUser.aboutMe,
             presentation: firestoreData.presentation !== undefined ? firestoreData.presentation : baseUser.presentation,
             canVote: typeof firestoreData.canVote === 'boolean' ? firestoreData.canVote : (baseUser.canVote === undefined ? false : baseUser.canVote),
             // Stats from Firestore or default to 0
             totalPostsByUser: firestoreData.totalPostsByUser !== undefined ? firestoreData.totalPostsByUser : (baseUser.totalPostsByUser || 0),
             totalReactionsReceived: firestoreData.totalReactionsReceived !== undefined ? firestoreData.totalReactionsReceived : (baseUser.totalReactionsReceived || 0),
             totalPostsInThreadsStartedByUser: firestoreData.totalPostsInThreadsStartedByUser !== undefined ? firestoreData.totalPostsInThreadsStartedByUser : (baseUser.totalPostsInThreadsStartedByUser || 0),
             totalThreadsStartedByUser: firestoreData.totalThreadsStartedByUser !== undefined ? firestoreData.totalThreadsStartedByUser : (baseUser.totalThreadsStartedByUser || 0),
        };

        // Auto-lift sanction if expired (idempotent check)
        if (updatedUser.status === 'sanctioned' && updatedUser.sanctionEndDate && new Date() > new Date(updatedUser.sanctionEndDate)) {
          // console.log(`[syncUserWithFirestore] Sanction expired for ${updatedUser.username}. Attempting to lift.`);
          await updateDoc(userRef, { status: 'active', sanctionEndDate: null });
          updatedUser.status = 'active';
          updatedUser.sanctionEndDate = undefined;
          // console.log(`[syncUserWithFirestore] Sanction lifted for ${updatedUser.username} during sync.`);
        }
        // console.log(`[syncUserWithFirestore] Synced user ${updatedUser.id}:`, updatedUser);
        return updatedUser;
      } else {
        // console.log(`[syncUserWithFirestore] User ${baseUser.id} not found in Firestore. Returning base user.`);
        return baseUser; // Or null if we decide users not in Firestore shouldn't be considered valid
      }
    } catch (error) {
      console.error(`[syncUserWithFirestore] Error syncing user ${baseUser.id} with Firestore:`, error);
    }
    return baseUser;
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
        // console.log('[initializeUser] Stored user key:', storedUserKey);
        if (storedUserKey) {
          if (preparedMockAuthUsers[storedUserKey]) { 
            userToSet = await syncUserWithFirestore({ ...preparedMockAuthUsers[storedUserKey] });
          } else if (auth.currentUser && auth.currentUser.uid === storedUserKey) {
            // User was likely authenticated via Firebase Auth (e.g. Google), try to fetch from Firestore
            // console.log(`[initializeUser] Found Firebase UID ${storedUserKey} in localStorage, current Firebase auth user:`, auth.currentUser.displayName);
            const baseUserForSync: MockUser = { 
                id: auth.currentUser.uid, 
                username: auth.currentUser.displayName || 'User', 
                email: auth.currentUser.email || '', 
                avatarUrl: auth.currentUser.photoURL || undefined,
                role: 'user', // Default role, Firestore will override
                status: 'active' // Default status, Firestore will override
            };
            userToSet = await syncUserWithFirestore(baseUserForSync);
            if (!userToSet || (userToSet.id === baseUserForSync.id && !userToSet.registrationDate) ) { // Heuristic: if sync didn't find it in Firestore
                console.warn(`[initializeUser] User UID ${storedUserKey} from Firebase Auth not fully resolved from Firestore. Defaulting to visitor.`);
                userToSet = preparedMockAuthUsers['visitor0'];
                localStorage.setItem('mockUserKey', 'visitor0');
            }
          } else {
             // Stored key is not a mock key and not the current Firebase auth user, likely a stale UID
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
    
    if (internalCurrentUser === null) {
      initializeUser();
    } else {
      setCurrentUserLocal(internalCurrentUser); // Ensure local state is in sync if internalCurrentUser was set by e.g. login
      setLoading(false);
    }
    
    return () => {
      listeners.delete(listener);
    };
  }, [syncUserWithFirestore]); // syncUserWithFirestore is stable due to useCallback


  const loginAndSetUserFromFirestore = useCallback(async (
    uid: string, 
    email?: string | null,
    displayNameFromProvider?: string | null,
    photoURLFromProvider?: string | null
  ): Promise<LoginResult> => {
    const userRef = doc(db, "users", uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // This is a new user, likely from Google Sign-In, who isn't in Firestore yet.
        // Create their profile and admission request.
        console.log(`[loginAndSetUserFromFirestore] New user (UID: ${uid}) from provider. Creating profile and admission request.`);
        const batch = writeBatch(db);
        const now = Timestamp.now();
        const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

        const newUsername = displayNameFromProvider || email?.split('@')[0] || `User_${uid.substring(0,6)}`;
        const newAvatarUrl = photoURLFromProvider || `https://placehold.co/100x100.png?text=${newUsername?.[0]?.toUpperCase() || 'U'}`;
        
        const newUserFirestoreData: Omit<User, 'id'> = {
          username: newUsername,
          email: email || `${uid}@kratia.example.com`, // Fallback email if not provided
          avatarUrl: newAvatarUrl,
          registrationDate: now.toDate().toISOString(),
          karma: 0,
          presentation: `Joined Kratia Forums via external provider (e.g., Google). Looking forward to participating!`,
          canVote: false,
          isQuarantined: true,
          status: 'pending_admission', // Start with pending_admission after social sign-up
          role: 'guest',
          totalPostsByUser: 0,
          totalReactionsReceived: 0,
          totalPostsInThreadsStartedByUser: 0,
          totalThreadsStartedByUser: 0,
          onboardingAccepted: false, // New users haven't accepted onboarding
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
        console.log(`[loginAndSetUserFromFirestore] New user profile and admission request created for UID ${uid}.`);
        return { success: false, reason: 'pending_admission', username: newUserFirestoreData.username };
      }

      // User exists in Firestore, proceed with status checks
      let firestoreUser = { id: userSnap.id, ...userSnap.data() } as MockUser;
      console.log(`[loginAndSetUserFromFirestore] User ${uid} found in Firestore. Status: ${firestoreUser.status}`);

      if (firestoreUser.status === 'pending_email_verification') {
        // This state implies they signed up with email/pass but haven't verified & logged in yet.
        // If they somehow got here after verifying email (e.g., direct Firebase Auth session),
        // we need to trigger the admission request creation.
        // The LoginPage should have already checked firebaseUser.emailVerified.
        console.log(`[loginAndSetUserFromFirestore] User ${uid} is 'pending_email_verification'. Creating admission request.`);
        const batch = writeBatch(db);
        batch.update(userRef, { status: 'pending_admission' });
        // ... (Logic to create Agora thread and Votation for admission as in signup/page.tsx) ...
        // For brevity, this part is similar to what's in signup/page.tsx's handleSubmit
        // Ensure to use `firestoreUser.presentation` etc.
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
        const fullySyncedUser = await syncUserWithFirestore(firestoreUser); // Ensure latest state
        setInternalCurrentUser(fullySyncedUser);
        if (typeof window !== 'undefined' && fullySyncedUser) {
          localStorage.setItem('mockUserKey', fullySyncedUser.id);
        }
        return { success: true, user: fullySyncedUser };
      }
      console.warn(`[loginAndSetUserFromFirestore] User ${uid} has an unknown status: ${firestoreUser.status}`);
      return { success: false, reason: 'unknown_firestore_status', username: firestoreUser.username };

    } catch (error) {
      console.error(`[loginAndSetUserFromFirestore] Error fetching/processing user ${uid}:`, error);
      return { success: false, reason: 'auth_error' }; 
    }
  }, [syncUserWithFirestore]);


  const logout = useCallback(() => {
    const visitorUser = preparedMockAuthUsers['visitor0'];
    setInternalCurrentUser(visitorUser);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mockUserKey'); // Use removeItem for clarity
    }
    auth.signOut().catch(error => console.error("Error signing out from Firebase Auth:", error));
    console.log('[logout] User logged out, set to visitor.');
  }, []);

  const switchToUser = useCallback(async (userKey: keyof typeof preparedMockAuthUsers | string) => {
    let userToSwitchTo: MockUser | null = preparedMockAuthUsers[userKey] ? { ...preparedMockAuthUsers[userKey] } : null;
    
    if (userToSwitchTo) {
        userToSwitchTo = await syncUserWithFirestore(userToSwitchTo); // Sync with Firestore
        setInternalCurrentUser(userToSwitchTo);
        if (typeof window !== 'undefined' && userToSwitchTo) {
            localStorage.setItem('mockUserKey', userToSwitchTo.id);
        }
        console.log(`[switchToUser] Switched to mock user: ${userToSwitchTo?.username}`);
    } else {
        // Fallback if key not found, though UI should prevent this for prepared keys
        console.warn(`[switchToUser] User key "${userKey}" not found in preparedMockAuthUsers. Defaulting to visitor.`);
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
          // If this is the current user, re-sync them
          if (internalCurrentUser && internalCurrentUser.id === userId) {
             const freshlySyncedUser = await syncUserWithFirestore({ ...internalCurrentUser, status: 'active', sanctionEndDate: undefined });
             setInternalCurrentUser(freshlySyncedUser);
          }
          console.log(`[checkAndLiftSanction] Sanction lifted for user ${userId}.`);
          return true;
        }
      }
    } catch (error) {
      console.error(`[checkAndLiftSanction] Error for user ${userId}:`, error);
    }
    return false;
  }, [syncUserWithFirestore]);


  const login = useCallback(async (usernameOrEmail?: string, password?: string): Promise<LoginResult> => {
    // This mock login is primarily for the dev switcher now.
    // Real login goes through Firebase Auth then loginAndSetUserFromFirestore.
    if (!usernameOrEmail) {
        return { success: false, reason: 'auth_error' };
    }
    const lowerInput = usernameOrEmail.toLowerCase();
    const userKeyToLogin = Object.keys(preparedMockAuthUsers).find(
        key => key.toLowerCase() === lowerInput ||
               (preparedMockAuthUsers[key]?.username?.toLowerCase() === lowerInput) ||
               (preparedMockAuthUsers[key]?.email?.toLowerCase().startsWith(lowerInput))
    );
    
    if (!userKeyToLogin || !preparedMockAuthUsers[userKeyToLogin]) {
        console.warn(`Mock login attempt for "${usernameOrEmail}" - user not found in preparedMockAuthUsers.`);
        return { success: false, reason: 'not_found_in_firestore' };
    }

    let userToLogin = await syncUserWithFirestore({ ...preparedMockAuthUsers[userKeyToLogin] });
    if (!userToLogin) { // Should not happen if key exists, but for safety
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
    login, // Still expose for dev switcher compatibility if needed
    loginAndSetUserFromFirestore,
    logout,
    switchToUser,
    checkAndLiftSanction,
    preparedMockAuthUsers, // Expose for the dev switcher in Header
    syncUserWithFirestore,
  };
}
