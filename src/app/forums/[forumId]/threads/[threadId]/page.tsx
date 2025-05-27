
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PostItem from '@/components/forums/PostItem';
import ReplyForm from '@/components/forums/ReplyForm';
import type { Thread, Post as PostType, User as KratiaUser, Poll, Votation, VotationStatus, ForumCategory, Notification, UserNotificationPreferences } from '@/lib/types';
import { Loader2, MessageCircle, FileText, Frown, ChevronLeft, Edit, Reply, Vote, Users, CalendarDays, UserX, ShieldCheck, ThumbsUp, ThumbsDown, MinusCircle, Ban, LogIn, Lock, Unlock, Pin, PinOff, PlusCircle } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs, runTransaction, increment, updateDoc, writeBatch, addDoc, limit, startAfter, type DocumentSnapshot } from 'firebase/firestore';
import { format, formatDistanceToNow, isPast, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { KRATIA_CONFIG } from '@/lib/config';
import { useTranslation } from 'react-i18next';
import { es as esLocale } from 'date-fns/locale/es';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';


const formatFirestoreTimestamp = (timestamp: any): string | undefined => {
  if (!timestamp) return undefined;
  if (typeof timestamp === 'string') {
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/.test(timestamp)) {
      const d = new Date(timestamp);
      if (d.toISOString() === timestamp) return d.toISOString();
    }
    const parsedDate = new Date(timestamp);
    if (!isNaN(parsedDate.getTime())) return parsedDate.toISOString();
    return undefined;
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString();
  return undefined;
};

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading, syncUserWithFirestore } = useMockAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation('common');

  const threadId = params.threadId as string;
  const forumId = params.forumId as string;

  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [forumName, setForumName] = useState<string | undefined>(undefined);
  const [votation, setVotation] = useState<Votation | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const [isSubmittingVotationVote, setIsSubmittingVotationVote] = useState(false);
  const [userVotationChoice, setUserVotationChoice] = useState<string | null>(null);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [isTogglingSticky, setIsTogglingSticky] = useState(false);

  const [lastVisiblePostSnapshot, setLastVisiblePostSnapshot] = useState<DocumentSnapshot | null>(null);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const handlePostDeleted = useCallback((deletedPostId: string) => {
    setPosts(prevPosts => prevPosts.filter(p => p.id !== deletedPostId));
    setThread(prevThread => {
      if (prevThread) {
        return { ...prevThread, postCount: Math.max(0, (prevThread.postCount || 0) - 1) };
      }
      return null;
    });
  }, []);


  useEffect(() => {
    console.log('[ThreadPage MAIN Effect] Running. threadId:', threadId, 'forumId:', forumId);
    if (!threadId || !forumId) {
      setError(t('threadPage.error.missingIds'));
      setIsLoading(false);
      setHasMorePosts(false);
      return;
    }

    const fetchDataAndProcess = async () => {
      setIsLoading(true);
      setError(null);
      setPosts([]);
      setLastVisiblePostSnapshot(null);
      setHasMorePosts(true);

      try {
        console.log('[ThreadPage MAIN Effect] Fetching threadRef...');
        const threadRef = doc(db, "threads", threadId);
        const threadSnap = await getDoc(threadRef);

        if (!threadSnap.exists()) {
          console.log('[ThreadPage MAIN Effect] Thread not found.');
          setError(t('threadPage.error.threadNotFound'));
          setThread(null); setVotation(null); setHasMorePosts(false);
          setIsLoading(false);
          return;
        }

        let fetchedThreadDataRaw = threadSnap.data() as Omit<Thread, 'id'>;
        let currentThreadState: Thread = {
          id: threadSnap.id, ...fetchedThreadDataRaw,
          createdAt: formatFirestoreTimestamp(fetchedThreadDataRaw.createdAt) || new Date(0).toISOString(),
          lastReplyAt: formatFirestoreTimestamp(fetchedThreadDataRaw.lastReplyAt),
          author: fetchedThreadDataRaw.author || { username: t('common.unknownUser'), id: '' },
          postCount: fetchedThreadDataRaw.postCount || 0,
          isLocked: fetchedThreadDataRaw.isLocked || false,
          isSticky: fetchedThreadDataRaw.isSticky || false,
          relatedVotationId: fetchedThreadDataRaw.relatedVotationId || undefined,
          poll: fetchedThreadDataRaw.poll || undefined,
        };
        console.log('[ThreadPage MAIN Effect] Thread data fetched:', currentThreadState);

        let fetchedVotationData: Votation | null = null;
        if (currentThreadState.relatedVotationId) {
          console.log('[ThreadPage MAIN Effect] Fetching votation data for ID:', currentThreadState.relatedVotationId);
          const votationRef = doc(db, "votations", currentThreadState.relatedVotationId);
          const votationSnap = await getDoc(votationRef);
          if (votationSnap.exists()) {
            fetchedVotationData = { id: votationSnap.id, ...votationSnap.data() } as Votation;
            console.log('[ThreadPage MAIN Effect] Votation data fetched:', fetchedVotationData);
          } else {
            console.warn('[ThreadPage MAIN Effect] Votation document not found for ID:', currentThreadState.relatedVotationId);
          }
        }

        let batch: ReturnType<typeof writeBatch> | null = null;
        let outcomeMessage = t('threadPage.votation.outcomeUndetermined');
        let newStatus: VotationStatus | null = null;

        if (fetchedVotationData && fetchedVotationData.status === 'active' && fetchedVotationData.deadline && isPast(new Date(fetchedVotationData.deadline))) {
          console.log('[ThreadPage MAIN Effect] Votation deadline passed. Processing closure for votation ID:', fetchedVotationData.id, 'Type:', fetchedVotationData.type);
          batch = writeBatch(db);

          const quorumMet = (fetchedVotationData.totalVotesCast || 0) >= (fetchedVotationData.quorumRequired || KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS);
          const forVotes = fetchedVotationData.options.for || 0;
          const againstVotes = fetchedVotationData.options.against || 0;
          const passed = forVotes > againstVotes;

          if (!quorumMet) {
            newStatus = 'closed_failed_quorum';
            outcomeMessage = t('threadPage.votation.outcome.failedQuorum', { votesCast: fetchedVotationData.totalVotesCast, votesRequired: (fetchedVotationData.quorumRequired || KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS) });
          } else if (passed) {
            newStatus = 'closed_passed';
            outcomeMessage = t('threadPage.votation.outcome.passed');
          } else {
            newStatus = 'closed_failed_vote';
            outcomeMessage = t('threadPage.votation.outcome.failedVote');
          }
          console.log('[ThreadPage MAIN Effect] Determined newStatus:', newStatus, 'Outcome:', outcomeMessage);

          const votationRefToUpdate = doc(db, "votations", fetchedVotationData.id);
          batch.update(votationRefToUpdate, { status: newStatus, outcome: outcomeMessage });

          if (newStatus === 'closed_passed') {
            console.log('[ThreadPage MAIN Effect] Votation passed. Checking type:', fetchedVotationData.type);
            if (fetchedVotationData.type === 'sanction' && fetchedVotationData.targetUserId && fetchedVotationData.targetUsername) {
              console.log('[ThreadPage MAIN Effect] Applying sanction outcome for targetUserId:', fetchedVotationData.targetUserId);
              const targetUserRef = doc(db, "users", fetchedVotationData.targetUserId);
              const sanctionEndDate = addDays(new Date(), 1); 
              batch.update(targetUserRef, { status: 'sanctioned', sanctionEndDate: sanctionEndDate.toISOString() });
              toast({ title: t('threadPage.toast.sanctionApplied.title'), description: t('threadPage.toast.sanctionApplied.desc', { username: fetchedVotationData.targetUsername })});
            }
            if (fetchedVotationData.type === 'rule_change' && fetchedVotationData.proposedConstitutionText) {
              console.log('[ThreadPage MAIN Effect] Applying rule_change (constitution) outcome.');
              batch.update(doc(db, "site_settings", "constitution"), {
                constitutionText: fetchedVotationData.proposedConstitutionText,
                lastUpdated: new Date().toISOString()
              });
              toast({ title: t('threadPage.toast.constitutionUpdated.title'), description: t('threadPage.toast.constitutionUpdated.desc')});
            }
            if (fetchedVotationData.type === 'admission_request' && fetchedVotationData.targetUserId && fetchedVotationData.targetUsername) {
                console.log('[ThreadPage MAIN Effect] Applying ADMISSION outcome for targetUserId:', fetchedVotationData.targetUserId);
                const targetUserRef = doc(db, "users", fetchedVotationData.targetUserId);
                batch.update(targetUserRef, { status: 'active', canVote: true, isQuarantined: false, role: 'user' });
                toast({ title: t('threadPage.toast.admissionApproved.title'), description: t('threadPage.toast.admissionApproved.desc', { username: fetchedVotationData.targetUsername })});
            }
            if (fetchedVotationData.type === 'new_forum_proposal' && fetchedVotationData.proposedForumName && fetchedVotationData.proposedForumCategoryId && fetchedVotationData.proposedForumDescription) {
                console.log('[ThreadPage MAIN Effect] Applying NEW FORUM PROPOSAL outcome for forum:', fetchedVotationData.proposedForumName);
                const newForumRef = doc(collection(db, "forums"));
                const newForumData: Omit<ForumCategory, 'id' | 'forums'> & { categoryId: string, isPublic: boolean, isAgora: boolean, threadCount: number, postCount: number } = {
                    name: fetchedVotationData.proposedForumName,
                    description: fetchedVotationData.proposedForumDescription,
                    categoryId: fetchedVotationData.proposedForumCategoryId,
                    isPublic: fetchedVotationData.proposedForumIsPublic === undefined ? true : fetchedVotationData.proposedForumIsPublic,
                    isAgora: false,
                    threadCount: 0,
                    postCount: 0,
                };
                batch.set(newForumRef, newForumData);
                toast({ title: t('threadPage.toast.newForumCreated.title'), description: t('threadPage.toast.newForumCreated.desc', { forumName: fetchedVotationData.proposedForumName })});
            }
          } else {
             console.log('[ThreadPage MAIN Effect] Votation did not pass or other status. No user/site updates applied.');
          }

          if (currentThreadState && !currentThreadState.isLocked) {
            console.log('[ThreadPage MAIN Effect] Locking Agora thread automatically:', currentThreadState.id);
            batch.update(threadRef, { isLocked: true });
            currentThreadState = { ...currentThreadState, isLocked: true }; // Update local state preview
            toast({ title: t('threadPage.toast.agoraThreadLocked.title'), description: t('threadPage.toast.agoraThreadLocked.desc') });
          }
        }

        if (batch) {
          console.log('[ThreadPage MAIN Effect] Committing Firestore batch...');
          await batch.commit();
          console.log('[ThreadPage MAIN Effect] Firestore batch committed.');
          if (fetchedVotationData && outcomeMessage && newStatus) {
            toast({ title: t('threadPage.toast.votationProcessed.title'), description: t('threadPage.toast.votationProcessed.desc', { title: fetchedVotationData.title, outcome: outcomeMessage })});
            
            // Proposer Notification
            if (fetchedVotationData.proposerId) {
              const proposerUserRef = doc(db, "users", fetchedVotationData.proposerId);
              const proposerSnap = await getDoc(proposerUserRef);
              if (proposerSnap.exists()) {
                const proposerData = proposerSnap.data() as KratiaUser;
                const prefs = proposerData.notificationPreferences;
                const shouldNotifyWebProposer = prefs?.votationConcludedProposer?.web ?? true;

                if (shouldNotifyWebProposer) {
                  const truncatedVotationTitle = fetchedVotationData.title.length > 50
                    ? `${fetchedVotationData.title.substring(0, 47)}...`
                    : fetchedVotationData.title;
                  const notificationData: Omit<Notification, 'id'> = {
                    recipientId: fetchedVotationData.proposerId,
                    actor: { id: 'system', username: t(KRATIA_CONFIG.FORUM_NAME), avatarUrl: '/kratia-logo.png' },
                    type: 'votation_concluded_proposer', // Corrected type
                    threadId: threadId,
                    votationTitle: truncatedVotationTitle,
                    votationOutcome: newStatus,
                    message: t('notifications.votationConcluded', { title: truncatedVotationTitle, outcome: outcomeMessage }),
                    link: `/forums/${forumId}/threads/${threadId}`,
                    createdAt: new Date().toISOString(),
                    isRead: false,
                  };
                  try {
                    await addDoc(collection(db, "notifications"), notificationData);
                    console.log('[ThreadPage MAIN Effect] Notification created for proposer:', fetchedVotationData.proposerId);
                  } catch (notificationError) {
                    console.error(`[ThreadPage MAIN Effect] Error creating notification for votation conclusion (proposer):`, notificationError);
                  }
                }
              }
            }
            // Participant Notifications
            if (fetchedVotationData.voters) {
              for (const voterId in fetchedVotationData.voters) {
                if (voterId !== fetchedVotationData.proposerId) { // Don't notify proposer twice
                  const voterUserRef = doc(db, "users", voterId);
                  const voterSnap = await getDoc(voterUserRef);
                  if (voterSnap.exists()) {
                    const voterData = voterSnap.data() as KratiaUser;
                    const prefs = voterData.notificationPreferences;
                    const shouldNotifyWebParticipant = prefs?.votationConcludedParticipant?.web ?? true;
                    if (shouldNotifyWebParticipant) {
                       const truncatedVotationTitle = fetchedVotationData.title.length > 50
                        ? `${fetchedVotationData.title.substring(0, 47)}...`
                        : fetchedVotationData.title;
                      const participantNotification: Omit<Notification, 'id'> = {
                        recipientId: voterId,
                        actor: { id: 'system', username: t(KRATIA_CONFIG.FORUM_NAME), avatarUrl: '/kratia-logo.png' },
                        type: 'votation_concluded_participant',
                        threadId: threadId,
                        votationTitle: truncatedVotationTitle,
                        votationOutcome: newStatus,
                        message: t('notifications.votationConcludedParticipant', { title: truncatedVotationTitle, outcome: outcomeMessage }),
                        link: `/forums/${forumId}/threads/${threadId}`,
                        createdAt: new Date().toISOString(),
                        isRead: false,
                      };
                       try {
                        await addDoc(collection(db, "notifications"), participantNotification);
                        console.log(`[ThreadPage MAIN Effect] Notification created for participant: ${voterId}`);
                      } catch (notificationError) {
                        console.error(`[ThreadPage MAIN Effect] Error creating notification for votation conclusion (participant ${voterId}):`, notificationError);
                      }
                    }
                  }
                }
              }
            }
          }
          if (newStatus && fetchedVotationData) {
            fetchedVotationData = { ...fetchedVotationData, status: newStatus, outcome: outcomeMessage };
          }
        }

        setThread(currentThreadState);
        setVotation(fetchedVotationData);

        if (currentThreadState.forumId === forumId) {
            const forumRefDoc = doc(db, "forums", forumId);
            const forumSnap = await getDoc(forumRefDoc);
            if (forumSnap.exists()) {
                setForumName(forumSnap.data().name);
            }
        }

        const postsQuery = query(
            collection(db, "posts"),
            where("threadId", "==", threadId),
            orderBy("createdAt", "asc"),
            limit(KRATIA_CONFIG.MESSAGES_PER_PAGE)
        );
        const postsSnapshot = await getDocs(postsQuery);
        const fetchedPosts = postsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id, ...data,
            createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
            updatedAt: formatFirestoreTimestamp(data.updatedAt),
            author: data.author || { username: t('common.unknownUser'), id: '' },
            reactions: data.reactions || {},
            lastEditedBy: data.lastEditedBy
          } as PostType;
        });
        setPosts(fetchedPosts);
        if (postsSnapshot.docs.length > 0) {
          setLastVisiblePostSnapshot(postsSnapshot.docs[postsSnapshot.docs.length - 1]);
        } else {
          setHasMorePosts(false);
        }
        if (fetchedPosts.length < KRATIA_CONFIG.MESSAGES_PER_PAGE) {
          setHasMorePosts(false);
        }
        console.log('[ThreadPage MAIN Effect] Fetched posts count:', fetchedPosts.length);

      } catch (err: any) {
        console.error(`[ThreadPage MAIN Effect] Error in main effect:`, err);
        setError(t('threadPage.error.loadFail', { message: err.message }));
        setThread(null); setPosts([]); setVotation(null); setHasMorePosts(false);
      } finally {
        setIsLoading(false);
        console.log('[ThreadPage MAIN Effect] Main effect finished. isLoading set to false.');
      }
    };

    fetchDataAndProcess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, forumId, t]); // Removed loggedInUser for stability

  useEffect(() => {
    console.log('[ThreadPage VotationChoice Effect] Running. Votation ID:', votation?.id, 'Logged in user:', loggedInUser?.id);
    if (loggedInUser && votation && votation.voters && votation.voters[loggedInUser.id]) {
      setUserVotationChoice(votation.voters[loggedInUser.id]);
      console.log('[ThreadPage VotationChoice Effect] User has voted. Choice:', votation.voters[loggedInUser.id]);
    } else {
      setUserVotationChoice(null);
      console.log('[ThreadPage VotationChoice Effect] User has not voted or no relevant data.');
    }
  }, [votation, loggedInUser]);


  const isOwnActiveSanctionThread =
    loggedInUser &&
    thread && thread.relatedVotationId &&
    votation &&
    votation.type === 'sanction' &&
    votation.targetUserId === loggedInUser.id &&
    votation.status === 'active';

  let userCanReply = false;
  if (loggedInUser && loggedInUser.role !== 'visitor' && loggedInUser.role !== 'guest') {
    if (thread && thread.isLocked) {
        userCanReply = false;
    } else if (loggedInUser.status === 'active') {
      userCanReply = true;
    } else if (loggedInUser.status === 'under_sanction_process' && isOwnActiveSanctionThread) {
      userCanReply = true;
    } else if (loggedInUser.status === 'sanctioned'){
      userCanReply = false;
    }
  }

  const canVoteInVotation = loggedInUser && loggedInUser.canVote && loggedInUser.status === 'active' && votation && votation.status === 'active' && !userVotationChoice && !(votation.type === 'sanction' && loggedInUser.id === votation.targetUserId);
  const isAdminOrFounder = loggedInUser && (loggedInUser.role === 'admin' || loggedInUser.role === 'founder');


  const handleNewReply = (newPost: PostType) => {
    const formattedNewPost = {
        ...newPost,
        createdAt: formatFirestoreTimestamp(newPost.createdAt) || new Date(0).toISOString(),
        author: newPost.author || (loggedInUser as KratiaUser) || {username: t('common.unknownUser'), id: ''}
    };
    setPosts(prevPosts => [...prevPosts, formattedNewPost]);

    if (thread) {
        setThread(prevThread => prevThread ? {
            ...prevThread,
            postCount: (prevThread.postCount || 0) + 1,
            lastReplyAt: formattedNewPost.createdAt,
        } : null);
    }
    setShowReplyForm(false);
  };

  const handlePollUpdate = (updatedPoll: Poll) => {
    if (thread) {
      setThread(prevThread => prevThread ? {...prevThread, poll: updatedPoll} : null);
    }
  };

  const handleVotationVote = async (choice: 'for' | 'against' | 'abstain') => {
    if (!loggedInUser || !votation || !canVoteInVotation) {
      toast({ title: t('threadPage.toast.cannotVote.title'), description: t('threadPage.toast.cannotVote.desc'), variant: "destructive"});
      return;
    }
    setIsSubmittingVotationVote(true);
    const votationRef = doc(db, "votations", votation.id);

    try {
      const updatedVotationData = await runTransaction(db, async (transaction) => {
        const votationDoc = await transaction.get(votationRef);
        if (!votationDoc.exists()) throw new Error(t('threadPage.error.votationNotFound'));

        const currentVotationData = votationDoc.data() as Votation;
        if (currentVotationData.status !== 'active') throw new Error(t('threadPage.error.votationNotActive'));
        if (currentVotationData.voters && currentVotationData.voters[loggedInUser.id]) {
          throw new Error(t('threadPage.error.alreadyVoted'));
        }
         if (currentVotationData.type === 'sanction' && currentVotationData.targetUserId === loggedInUser.id) {
           throw new Error(t('threadPage.error.cannotVoteOwnSanction'));
        }

        const newOptions = { ...currentVotationData.options };
        newOptions[choice] = (newOptions[choice] || 0) + 1;

        const newVoters = { ...(currentVotationData.voters || {}), [loggedInUser.id]: choice };
        const newTotalVotesCast = (currentVotationData.totalVotesCast || 0) + 1;

        const dataToUpdate: Partial<Votation> = {
          options: newOptions,
          voters: newVoters,
          totalVotesCast: newTotalVotesCast,
        };
        transaction.update(votationRef, dataToUpdate);
        return { ...currentVotationData, ...dataToUpdate };
      });

      setVotation(updatedVotationData);
      toast({ title: t('threadPage.toast.voteCast.title'), description: t('threadPage.toast.voteCast.desc', { choice: t(`threadPage.votation.choices.${choice}`) })});

    } catch (error: any) {
      console.error("Error casting votation vote:", error);
      toast({ title: t('common.error'), description: error.message || t('threadPage.toast.voteError'), variant: "destructive"});
    } finally {
      setIsSubmittingVotationVote(false);
    }
  };

  const handleToggleLockThread = async () => {
    if (!thread || !isAdminOrFounder) {
      toast({ title: t('common.error'), description: t('threadPage.toast.toggleLock.notAllowed'), variant: "destructive" });
      return;
    }
    if (thread.isLocked && thread.relatedVotationId && votation && votation.status !== 'active') {
        toast({ title: t('threadPage.toast.toggleLock.agoraLockedTitle'), description: t('threadPage.toast.toggleLock.agoraLockedDesc'), variant: "default"});
        return;
    }
    setIsTogglingLock(true);
    const threadRef = doc(db, "threads", thread.id);
    const newLockState = !thread.isLocked;
    try {
      await updateDoc(threadRef, { isLocked: newLockState });
      setThread(prevThread => prevThread ? { ...prevThread, isLocked: newLockState } : null);
      toast({
        title: newLockState ? t('threadPage.toast.toggleLock.lockedTitle') : t('threadPage.toast.toggleLock.unlockedTitle'),
        description: newLockState ? t('threadPage.toast.toggleLock.lockedDesc') : t('threadPage.toast.toggleLock.unlockedDesc'),
      });
    } catch (err) {
      console.error("Error toggling thread lock state:", err);
      toast({ title: t('common.error'), description: t('threadPage.toast.toggleLock.error'), variant: "destructive" });
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleToggleStickyThread = async () => {
    if (!thread || !isAdminOrFounder) {
      toast({ title: t('common.error'), description: t('threadPage.toast.toggleSticky.notAllowed'), variant: "destructive" });
      return;
    }
    setIsTogglingSticky(true);
    const threadRef = doc(db, "threads", thread.id);
    const newStickyState = !thread.isSticky;
    try {
      await updateDoc(threadRef, { isSticky: newStickyState });
      setThread(prevThread => prevThread ? { ...prevThread, isSticky: newStickyState } : null);
      toast({
        title: newStickyState ? t('threadPage.toast.toggleSticky.stickiedTitle') : t('threadPage.toast.toggleSticky.unstickiedTitle'),
        description: newStickyState ? t('threadPage.toast.toggleSticky.stickiedDesc') : t('threadPage.toast.toggleSticky.unstickiedDesc'),
      });
    } catch (err) {
      console.error("Error toggling thread sticky state:", err);
      toast({ title: t('common.error'), description: t('threadPage.toast.toggleSticky.error'), variant: "destructive" });
    } finally {
      setIsTogglingSticky(false);
    }
  };

  const handleLoadMorePosts = async () => {
    if (!lastVisiblePostSnapshot || !hasMorePosts || isLoadingMorePosts) {
      return;
    }
    setIsLoadingMorePosts(true);
    try {
      const nextPostsQuery = query(
        collection(db, "posts"),
        where("threadId", "==", threadId),
        orderBy("createdAt", "asc"),
        startAfter(lastVisiblePostSnapshot),
        limit(KRATIA_CONFIG.MESSAGES_PER_PAGE)
      );
      const postsSnapshot = await getDocs(nextPostsQuery);
      const newPosts = postsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
          updatedAt: formatFirestoreTimestamp(data.updatedAt),
          author: data.author || { username: t('common.unknownUser'), id: '' },
          reactions: data.reactions || {},
          lastEditedBy: data.lastEditedBy
        } as PostType;
      });

      setPosts(prevPosts => [...prevPosts, ...newPosts]);
      if (postsSnapshot.docs.length > 0) {
        setLastVisiblePostSnapshot(postsSnapshot.docs[postsSnapshot.docs.length - 1]);
      }
      if (newPosts.length < KRATIA_CONFIG.MESSAGES_PER_PAGE) {
        setHasMorePosts(false);
      }
    } catch (err) {
      console.error("Error loading more posts:", err);
      setError(t('threadPage.error.loadMorePostsFail'));
    } finally {
      setIsLoadingMorePosts(false);
    }
  };


  if (authLoading || isLoading) {
    return (
        <div className="space-y-8 py-10 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">{t('threadPage.loadingThread')}</p>
        </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>{t('common.error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push(thread?.relatedVotationId ? '/agora' : (forumId ? `/forums/${forumId}` : '/forums'))} className="mt-4">
          {t('threadPage.backTo', { location: thread?.relatedVotationId ? t('common.agora') : (forumName || t('common.forum'))})}
        </Button>
      </Alert>
    );
  }

  if (!thread) {
    return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>{t('threadPage.error.threadNotFoundTitle')}</AlertTitle>
        <AlertDescription>
          {t('threadPage.error.threadNotFoundDesc')}
        </AlertDescription>
        <Button onClick={() => router.push(forumId === 'agora' ? '/agora' : (forumId ? `/forums/${forumId}` : '/forums'))} className="mt-4">
           {t('threadPage.backTo', { location: forumId === 'agora' ? t('common.agora') : (forumName || t('common.forum'))})}
        </Button>
      </Alert>
    );
  }

  const backLinkHref = forumId === 'agora' ? '/agora' : `/forums/${forumId}`;
  const backLinkText = (forumName || (forumId === 'agora' ? t('common.agora') : t('common.forum')));


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <Link href={backLinkHref} className="text-sm text-primary hover:underline flex items-center mb-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('threadPage.backTo', { location: backLinkText })}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-start">
                {thread.isSticky && <Pin className="mr-2 h-7 w-7 text-amber-500 flex-shrink-0 mt-1" title={t('threadPage.tooltips.sticky')}/>}
                <FileText className="mr-3 h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <span className="break-all">{thread.title}</span>
                {thread.isLocked && <Lock className="ml-2 h-6 w-6 text-destructive flex-shrink-0 mt-1" title={t('threadPage.tooltips.locked')} />}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
                {t('threadPage.startedBy')} <Link href={`/profile/${thread.author.id}`} className="text-primary hover:underline font-medium">{thread.author.username}</Link> {t('common.on')} {new Date(thread.createdAt).toLocaleDateString(i18n.language)}
            </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end self-start sm:self-center">
            {isAdminOrFounder && (
              <>
                <Button
                    variant={thread.isSticky ? "destructive" : "outline"}
                    onClick={handleToggleStickyThread}
                    disabled={isTogglingSticky}
                    size="sm"
                    className="min-w-[130px]"
                >
                    {isTogglingSticky ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (thread.isSticky ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />)}
                    {thread.isSticky ? t('threadPage.actions.removeSticky') : t('threadPage.actions.makeSticky')}
                </Button>
                <Button
                    variant={thread.isLocked ? "destructive" : "outline"}
                    onClick={handleToggleLockThread}
                    disabled={isTogglingLock || (thread.isLocked && thread.relatedVotationId && votation && votation.status !== 'active')}
                    size="sm"
                    className="min-w-[130px]"
                    title={(thread.isLocked && thread.relatedVotationId && votation && votation.status !== 'active') ? t('threadPage.tooltips.agoraThreadLocked') : ""}
                >
                    {isTogglingLock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (thread.isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />)}
                    {thread.isLocked ? t('threadPage.actions.unlockThread') : t('threadPage.actions.lockThread')}
                </Button>
              </>
            )}
            {userCanReply && !thread.isLocked && (
              <Button onClick={() => setShowReplyForm(prev => !prev)} size="sm" className="min-w-[130px]">
                {showReplyForm ? <Edit className="mr-2 h-5 w-5" />  : <Reply className="mr-2 h-5 w-5" /> }
                {showReplyForm ? t('threadPage.actions.cancelReply') : t('threadPage.actions.replyToThread')}
              </Button>
            )}
        </div>
      </div>

      {votation && (
        <Card className="mb-6 border-blue-500 shadow-lg">
          <CardHeader className="bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-t-lg">
            <CardTitle className="flex items-center text-xl">
              <Vote className="mr-3 h-6 w-6" />
              {t('threadPage.votation.titlePrefix')}: {votation.title}
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-400">
              {t('threadPage.votation.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {votation.type === 'sanction' && votation.targetUsername && (
              <div className="flex items-center text-sm">
                <UserX className="mr-2 h-4 w-4 text-destructive" />
                <span>{t('threadPage.votation.sanctionFor', { username: votation.targetUsername, duration: votation.sanctionDuration })}</span>
              </div>
            )}
            {votation.type === 'admission_request' && votation.targetUsername && (
              <div className="flex items-center text-sm">
                <Users className="mr-2 h-4 w-4 text-primary" />
                <span>{t('threadPage.votation.admissionFor', { username: votation.targetUsername })}</span>
              </div>
            )}
            {votation.type === 'rule_change' && (
              <div className="flex items-center text-sm">
                <FileText className="mr-2 h-4 w-4 text-primary" />
                <span>{t('threadPage.votation.ruleChangeFor')}</span>
              </div>
            )}
            {votation.type === 'new_forum_proposal' && votation.proposedForumName && (
                 <div className="flex items-center text-sm">
                    <PlusCircle className="mr-2 h-4 w-4 text-green-600" />
                    <span>{t('threadPage.votation.newForumProposalFor', { forumName: votation.proposedForumName, categoryName: votation.proposedForumCategoryName || votation.proposedForumCategoryId || t('common.unknown')})}</span>
                </div>
            )}
            <div className="text-sm">
                <p><strong className="font-medium">{t('threadPage.votation.proposer')}:</strong> {votation.proposerUsername}</p>
                <p><strong className="font-medium">{t('threadPage.votation.status')}:</strong> <span className="font-semibold capitalize">{t(`votationStatus.${votation.status.replace(/_/g, '')}`, votation.status.replace(/_/g, ' '))}</span></p>
                {votation.deadline && <p><strong className="font-medium">{t('threadPage.votation.deadline')}:</strong> {format(new Date(votation.deadline), "PPPp", { locale: i18n.language.startsWith('es') ? esLocale : enUSLocale })}</p>}
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-md">{t('threadPage.votation.currentTally')}:</h4>
              <ul className="list-disc list-inside pl-1 space-y-1 text-sm">
                <li>{t('threadPage.votation.choices.for')}: {votation.options.for || 0}</li>
                <li>{t('threadPage.votation.choices.against')}: {votation.options.against || 0}</li>
                <li>{t('threadPage.votation.choices.abstain')}: {votation.options.abstain || 0}</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-1">{t('threadPage.votation.totalVotesCast')}: {votation.totalVotesCast || 0}</p>
            </div>

            {votation.status === 'active' && loggedInUser && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold mb-2 text-md">{t('threadPage.votation.castYourVote')}:</h4>
                {votation.type === 'sanction' && loggedInUser.id === votation.targetUserId ? (
                   <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
                       <ShieldCheck className="h-5 w-5"/>
                       <AlertTitle>{t('threadPage.votation.yourSanctionProcessTitle')}</AlertTitle>
                       <AlertDescription>{t('threadPage.votation.yourSanctionProcessDesc')}</AlertDescription>
                   </Alert>
                ) : userVotationChoice ? (
                     <Alert variant="default" className="border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 [&>svg]:text-green-600">
                        <ShieldCheck className="h-5 w-5" />
                        <AlertTitle>{t('threadPage.votation.voteRecordedTitle')}</AlertTitle>
                        <AlertDescription>
                        {t('threadPage.votation.youVoted')}: <span className="font-semibold capitalize">{t(`threadPage.votation.choices.${userVotationChoice}`)}</span>.
                        </AlertDescription>
                    </Alert>
                ) : !loggedInUser.canVote || loggedInUser.status !== 'active' ? (
                  <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
                    <ShieldCheck className="h-5 w-5" />
                    <AlertTitle>{t('threadPage.votation.notEligibleToVoteTitle')}</AlertTitle>
                    <AlertDescription>
                      {loggedInUser.status === 'under_sanction_process' && t('threadPage.votation.notEligible.underSanction')}
                      {loggedInUser.status === 'sanctioned' && t('threadPage.votation.notEligible.sanctioned')}
                      {loggedInUser.status === 'active' && !loggedInUser.canVote && t('threadPage.votation.notEligible.noVotingRights')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => handleVotationVote('for')}
                      disabled={isSubmittingVotationVote}
                      variant="default"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isSubmittingVotationVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ThumbsUp className="mr-2 h-4 w-4"/>} {t('threadPage.votation.choices.for')}
                    </Button>
                    <Button
                      onClick={() => handleVotationVote('against')}
                      disabled={isSubmittingVotationVote}
                      variant="destructive"
                      className="flex-1"
                    >
                      {isSubmittingVotationVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ThumbsDown className="mr-2 h-4 w-4"/>} {t('threadPage.votation.choices.against')}
                    </Button>
                    <Button
                      onClick={() => handleVotationVote('abstain')}
                      disabled={isSubmittingVotationVote}
                      variant="outline"
                      className="flex-1"
                    >
                      {isSubmittingVotationVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MinusCircle className="mr-2 h-4 w-4"/>} {t('threadPage.votation.choices.abstain')}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {votation.status === 'active' && !loggedInUser && (
                <Alert variant="default" className="mt-3">
                    <ShieldCheck className="h-5 w-5"/>
                    <AlertTitle>{t('threadPage.votation.loginToVoteTitle')}</AlertTitle>
                    <AlertDescription>
                       <Link href="/auth/login" className="text-primary hover:underline font-semibold">{t('login.loginButton')}</Link> {t('threadPage.votation.loginToVoteDesc')}
                    </AlertDescription>
                </Alert>
            )}

             {votation.status !== 'active' && (
                 <Alert variant="default" className="mt-3">
                    <ShieldCheck className="h-5 w-5"/>
                    <AlertTitle>{t('threadPage.votation.votingClosedTitle')}</AlertTitle>
                    <AlertDescription>
                        {t('threadPage.votation.votingClosedDesc')} <span className="font-semibold">{votation.outcome || t('threadPage.votation.outcomePending')}</span>
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>
      )}


      {posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((post, index) => (
            <PostItem
                key={post.id}
                post={post}
                isFirstPost={index === 0}
                threadPoll={thread?.poll}
                onPollUpdate={handlePollUpdate}
                threadId={thread.id}
                forumId={forumId}
                onPostDeleted={handlePostDeleted}
            />
          ))}
        </div>
      ) : (
        <Card>
            <CardContent className="py-10 text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">{t('threadPage.noPostsYet')}</p>
                 {userCanReply && !thread.isLocked ? (
                     <p className="text-sm text-muted-foreground">{t('threadPage.beTheFirstToReply')}</p>
                 ): (
                    <p className="text-sm text-muted-foreground">
                       {thread.isLocked && t('threadPage.threadLockedNoReplies')}
                       {!thread.isLocked && loggedInUser && loggedInUser.status === 'under_sanction_process' && !isOwnActiveSanctionThread && t('threadPage.cannotReply.underSanctionOtherThread')}
                       {!thread.isLocked && loggedInUser && loggedInUser.status === 'sanctioned' && t('threadPage.cannotReply.sanctioned')}
                       {!thread.isLocked && (!loggedInUser || loggedInUser.role === 'visitor' || loggedInUser.role === 'guest') && t('threadPage.cannotReply.notLoggedIn')}
                    </p>
                 )}
            </CardContent>
        </Card>
      )}

      {hasMorePosts && posts.length > 0 && (
        <div className="text-center mt-8">
          <Button onClick={handleLoadMorePosts} disabled={isLoadingMorePosts}>
            {isLoadingMorePosts ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-5 w-5" />
            )}
            {t('threadPage.loadMorePostsButton')}
          </Button>
        </div>
      )}
      {!hasMorePosts && posts.length >= KRATIA_CONFIG.MESSAGES_PER_PAGE && (
        <p className="text-center text-muted-foreground mt-8">{t('threadPage.noMorePosts')}</p>
      )}


      {thread.isLocked && (
        <Alert variant="default" className="mt-6 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
          <Lock className="h-5 w-5" />
          <AlertTitle>{t('threadPage.threadLockedTitle')}</AlertTitle>
          <AlertDescription>
            {t('threadPage.threadLockedDesc')}
          </AlertDescription>
        </Alert>
      )}

      {userCanReply && !thread.isLocked && showReplyForm && thread && (
        <ReplyForm
            threadId={thread.id}
            forumId={forumId}
            onReplySuccess={handleNewReply}
            onCancel={() => setShowReplyForm(false)}
        />
      )}

       {!userCanReply && !thread.isLocked && loggedInUser && (loggedInUser.role !== 'visitor' && loggedInUser.role !== 'guest') && (
        <Alert variant="default" className="mt-6">
            <Ban className="h-5 w-5"/>
            <AlertTitle>{t('threadPage.cannotReply.title')}</AlertTitle>
            <AlertDescription>
                {loggedInUser.status === 'under_sanction_process' && !isOwnActiveSanctionThread && t('threadPage.cannotReply.underSanctionOtherThread')}
                {loggedInUser.status === 'sanctioned' && t('threadPage.cannotReply.sanctioned')}
            </AlertDescription>
        </Alert>
      )}
       {!thread.isLocked && !loggedInUser && (
         <Alert variant="default" className="mt-6">
            <LogIn className="h-5 w-5"/>
            <AlertTitle>{t('threadPage.loginToReplyTitle')}</AlertTitle>
            <AlertDescription>
                {t('threadPage.loginToReplyDesc.prefix')} <Link href="/auth/login" className="font-semibold text-primary hover:underline">{t('login.loginButton')}</Link> {t('threadPage.loginToReplyDesc.or')} <Link href="/auth/signup" className="font-semibold text-primary hover:underline">{t('signup.signupButton')}</Link> {t('threadPage.loginToReplyDesc.suffix')}
            </AlertDescription>
        </Alert>
       )}
    </div>
  );
}
