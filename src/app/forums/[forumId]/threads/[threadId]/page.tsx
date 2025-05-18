
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PostItem from '@/components/forums/PostItem';
import ReplyForm from '@/components/forums/ReplyForm';
import type { Thread, Post as PostType, User as KratiaUser, Poll, Votation, VotationStatus } from '@/lib/types';
import { Loader2, MessageCircle, FileText, Frown, ChevronLeft, Edit, Reply, Vote, Users, CalendarDays, UserX, ShieldCheck, ThumbsUp, ThumbsDown, MinusCircle, Ban, LogIn, Lock, Unlock, Pin, PinOff, PlusCircle } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs, runTransaction, increment, updateDoc, writeBatch, addDoc } from 'firebase/firestore';
import { format, formatDistanceToNow, isPast, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { KRATIA_CONFIG } from '@/lib/config';

// Helper function for timestamp conversion (ensure it's robust)
const formatFirestoreTimestamp = (timestamp: any): string | undefined => {
  if (!timestamp) return undefined;
  if (typeof timestamp === 'string') {
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/.test(timestamp)) {
      const d = new Date(timestamp);
      if (d.toISOString() === timestamp) return timestamp;
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

  useEffect(() => {
    console.log('[ThreadPage MAIN Effect] Running. threadId:', threadId, 'forumId:', forumId);
    if (!threadId || !forumId) {
      setError("Thread ID or Forum ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchDataAndProcessVotation = async () => {
      setIsLoading(true);
      setError(null);
      setVotation(null); 
      setUserVotationChoice(null);

      try {
        const threadRef = doc(db, "threads", threadId);
        const threadSnap = await getDoc(threadRef);

        if (!threadSnap.exists()) {
          setError("Thread not found.");
          setThread(null);
          setIsLoading(false);
          console.log('[ThreadPage MAIN Effect] Thread not found.');
          return;
        }
        let fetchedThreadData = threadSnap.data() as Omit<Thread, 'id'>; 
        let currentThreadState: Thread = {
          id: threadSnap.id,
          ...fetchedThreadData,
          createdAt: formatFirestoreTimestamp(fetchedThreadData.createdAt) || new Date(0).toISOString(),
          lastReplyAt: formatFirestoreTimestamp(fetchedThreadData.lastReplyAt),
          author: fetchedThreadData.author || { username: 'Unknown', id: '' },
          postCount: fetchedThreadData.postCount || 0,
          isLocked: fetchedThreadData.isLocked || false,
          isSticky: fetchedThreadData.isSticky || false,
          relatedVotationId: fetchedThreadData.relatedVotationId || undefined,
        };
        console.log('[ThreadPage MAIN Effect] Fetched thread:', JSON.parse(JSON.stringify(currentThreadState)));
        
        let fetchedVotationData: Votation | null = null;
        if (currentThreadState.relatedVotationId) {
          console.log('[ThreadPage MAIN Effect] Thread has relatedVotationId:', currentThreadState.relatedVotationId, 'Fetching votation...');
          const votationRef = doc(db, "votations", currentThreadState.relatedVotationId);
          const votationSnap = await getDoc(votationRef);
          if (votationSnap.exists()) {
            fetchedVotationData = { id: votationSnap.id, ...votationSnap.data() } as Votation;
            console.log('[ThreadPage MAIN Effect] Fetched votation for processing:', JSON.parse(JSON.stringify(fetchedVotationData)));
          } else {
            console.warn(`[ThreadPage MAIN Effect] Votation document with ID ${currentThreadState.relatedVotationId} not found.`);
          }
        } else {
            console.log('[ThreadPage MAIN Effect] Thread has no relatedVotationId.');
        }

        let batch: ReturnType<typeof writeBatch> | null = null;
        let votationNeedsFirestoreUpdate = false;
        let finalThreadState = currentThreadState;

        if (fetchedVotationData && fetchedVotationData.status === 'active' && fetchedVotationData.deadline && isPast(new Date(fetchedVotationData.deadline))) {
          console.log('[ThreadPage MAIN Effect] Votation deadline passed and status is active. Processing closure for votation ID:', fetchedVotationData.id);
          if (!batch) batch = writeBatch(db);

          let newStatus: VotationStatus = 'closed_failed_vote';
          let outcomeMessage = 'Outcome not yet determined.';
          const quorumMet = (fetchedVotationData.totalVotesCast || 0) >= (fetchedVotationData.quorumRequired || KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS);
          const forVotes = fetchedVotationData.options.for || 0;
          const againstVotes = fetchedVotationData.options.against || 0;
          const passed = forVotes > againstVotes;

          if (!quorumMet) newStatus = 'closed_failed_quorum';
          else if (passed) newStatus = 'closed_passed';
          else newStatus = 'closed_failed_vote';
          
          outcomeMessage = newStatus === 'closed_passed' ? 'Passed.' : (newStatus === 'closed_failed_quorum' ? `Failed - Quorum not met (${fetchedVotationData.totalVotesCast} of ${fetchedVotationData.quorumRequired || KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS} required).` : `Failed - Did not receive majority "For" votes.`);
          console.log(`[VotationCloseDebug] Determined newStatus: ${newStatus}, Outcome: ${outcomeMessage}`);

          const votationRef = doc(db, "votations", fetchedVotationData.id);
          batch.update(votationRef, { status: newStatus, outcome: outcomeMessage });
          votationNeedsFirestoreUpdate = true;
          fetchedVotationData.status = newStatus; 
          fetchedVotationData.outcome = outcomeMessage;

          if (newStatus === 'closed_passed') {
            if (fetchedVotationData.type === 'sanction' && fetchedVotationData.targetUserId && fetchedVotationData.targetUsername) {
              console.log(`[VotationCloseDebug] Sanction votation PASSED for ${fetchedVotationData.targetUsername}. Applying sanction.`);
              const targetUserRef = doc(db, "users", fetchedVotationData.targetUserId);
              const sanctionEndDate = addDays(new Date(), 1); // 1 day sanction for now
              batch.update(targetUserRef, { status: 'sanctioned', sanctionEndDate: sanctionEndDate.toISOString() });
              toast({ title: "Sanction Applied", description: `${fetchedVotationData.targetUsername} has been sanctioned for 1 day.`});
            }
            if (fetchedVotationData.type === 'rule_change' && fetchedVotationData.proposedConstitutionText) {
              console.log(`[VotationCloseDebug] Constitution change votation PASSED. Applying changes.`);
              batch.update(doc(db, "site_settings", "constitution"), { constitutionText: fetchedVotationData.proposedConstitutionText, lastUpdated: new Date().toISOString() });
              toast({ title: "Constitution Updated!"});
            }
            if (fetchedVotationData.type === 'admission_request' && fetchedVotationData.targetUserId && fetchedVotationData.targetUsername) {
              console.log('[VotationCloseDebug] Applying ADMISSION outcome for targetUserId:', fetchedVotationData.targetUserId, 'targetUsername:', fetchedVotationData.targetUsername);
              const targetUserRef = doc(db, "users", fetchedVotationData.targetUserId);
              batch.update(targetUserRef, { status: 'active', canVote: true, isQuarantined: false, role: 'user' });
              toast({ title: "Admission Approved!", description: `User ${fetchedVotationData.targetUsername} has been admitted.`});
            }
            if (fetchedVotationData.type === 'new_forum_proposal' && fetchedVotationData.proposedForumName && fetchedVotationData.proposedForumCategoryId && fetchedVotationData.proposedForumDescription) {
              console.log('[VotationCloseDebug] New Forum Proposal PASSED. Creating forum:', fetchedVotationData.proposedForumName);
              const newForumRef = doc(collection(db, "forums"));
              const newForumData = {
                name: fetchedVotationData.proposedForumName,
                description: fetchedVotationData.proposedForumDescription,
                categoryId: fetchedVotationData.proposedForumCategoryId,
                isPublic: fetchedVotationData.proposedForumIsPublic === undefined ? true : fetchedVotationData.proposedForumIsPublic,
                isAgora: false, // Cannot create an Agora forum this way
                threadCount: 0,
                postCount: 0,
              };
              batch.set(newForumRef, newForumData);
              toast({ title: "New Forum Created!", description: `Forum "${fetchedVotationData.proposedForumName}" has been created.`});
            }
          }

          if (finalThreadState && !finalThreadState.isLocked) {
            console.log(`[VotationCloseDebug] Votation closed. Locking Agora thread ${finalThreadState.id}.`);
            batch.update(threadRef, { isLocked: true });
            finalThreadState = { ...finalThreadState, isLocked: true };
            toast({ title: "Thread Locked", description: "This Agora thread has been automatically locked as the votation concluded."});
          }
        }

        if (batch && votationNeedsFirestoreUpdate) { // Check if batch has operations
          await batch.commit();
          console.log(`[ThreadPage MAIN Effect] Batch commit successful for votation processing.`);
          if (fetchedVotationData) { // Ensure fetchedVotationData is not null
            toast({ title: "Votation Processed", description: `Votation "${fetchedVotationData.title}" processed. Result: ${fetchedVotationData.outcome}`});
          }
        }
        
        setThread(finalThreadState);
        setVotation(fetchedVotationData);

        if (finalThreadState.forumId === forumId) {
            const forumRefDoc = doc(db, "forums", forumId);
            const forumSnap = await getDoc(forumRefDoc);
            if (forumSnap.exists()) {
                setForumName(forumSnap.data().name);
            }
        }

        const postsQuery = query(collection(db, "posts"), where("threadId", "==", threadId), orderBy("createdAt", "asc"));
        const postsSnapshot = await getDocs(postsQuery);
        const fetchedPosts = postsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id, ...data,
            createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
            updatedAt: formatFirestoreTimestamp(data.updatedAt),
            author: data.author || { username: 'Unknown', id: '' },
            reactions: data.reactions || {}, 
            lastEditedBy: data.lastEditedBy
          } as PostType;
        });
        setPosts(fetchedPosts);
        console.log('[ThreadPage MAIN Effect] Fetched posts count:', fetchedPosts.length);

      } catch (err: any) {
        console.error(`[ThreadPage MAIN Effect] Error in main effect:`, err);
        setError("Failed to load thread details or process votation. Please try again. " + err.message);
        setThread(null); setPosts([]); setVotation(null);
      } finally {
        setIsLoading(false);
        console.log('[ThreadPage MAIN Effect] Main effect finished. isLoading set to false.');
      }
    };

    fetchDataAndProcessVotation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, forumId, toast]); 

  useEffect(() => {
    console.log('[ThreadPage VotationChoice Effect] Running. Votation:', votation, 'Logged in user:', loggedInUser?.id);
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
        author: newPost.author || (loggedInUser as KratiaUser) || {username: 'Unknown', id: ''}
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
      toast({ title: "Cannot Vote", description: "You are not eligible to vote, have already voted, or cannot vote in this votation.", variant: "destructive"});
      return;
    }
    setIsSubmittingVotationVote(true);
    const votationRef = doc(db, "votations", votation.id);

    try {
      const updatedVotationData = await runTransaction(db, async (transaction) => {
        const votationDoc = await transaction.get(votationRef);
        if (!votationDoc.exists()) throw new Error("Votation not found.");
        
        const currentVotationData = votationDoc.data() as Votation;
        if (currentVotationData.status !== 'active') throw new Error("This votation is no longer active.");
        if (currentVotationData.voters && currentVotationData.voters[loggedInUser.id]) {
          throw new Error("User has already voted.");
        }
         if (currentVotationData.type === 'sanction' && currentVotationData.targetUserId === loggedInUser.id) {
           throw new Error("You cannot vote in your own sanction process.");
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
      toast({ title: "Vote Cast!", description: `Your vote for "${choice}" has been recorded.`});

    } catch (error: any) {
      console.error("Error casting votation vote:", error);
      toast({ title: "Error Voting", description: error.message || "Failed to cast your vote.", variant: "destructive"});
    } finally {
      setIsSubmittingVotationVote(false);
    }
  };

  const handleToggleLockThread = async () => {
    if (!thread || !isAdminOrFounder) {
      toast({ title: "Error", description: "Action not allowed or thread not found.", variant: "destructive" });
      return;
    }
    // Prevent unlocking an Agora thread that was locked due to votation conclusion, unless it's done by specific logic later
    if (thread.isLocked && thread.relatedVotationId && votation && votation.status !== 'active') {
        toast({ title: "Action Restricted", description: "This Agora thread was locked because its votation concluded. It cannot be unlocked from here.", variant: "default"});
        return;
    }
    setIsTogglingLock(true);
    const threadRef = doc(db, "threads", thread.id);
    const newLockState = !thread.isLocked;
    try {
      await updateDoc(threadRef, { isLocked: newLockState });
      setThread(prevThread => prevThread ? { ...prevThread, isLocked: newLockState } : null);
      toast({
        title: `Thread ${newLockState ? 'Locked' : 'Unlocked'}`,
        description: `The thread has been successfully ${newLockState ? 'locked' : 'unlocked'}.`,
      });
    } catch (err) {
      console.error("Error toggling thread lock state:", err);
      toast({ title: "Error", description: "Failed to update thread lock state.", variant: "destructive" });
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleToggleStickyThread = async () => {
    if (!thread || !isAdminOrFounder) {
      toast({ title: "Error", description: "Action not allowed or thread not found.", variant: "destructive" });
      return;
    }
    setIsTogglingSticky(true);
    const threadRef = doc(db, "threads", thread.id);
    const newStickyState = !thread.isSticky;
    try {
      await updateDoc(threadRef, { isSticky: newStickyState });
      setThread(prevThread => prevThread ? { ...prevThread, isSticky: newStickyState } : null);
      toast({
        title: `Thread ${newStickyState ? 'Made Sticky' : 'Removed Sticky'}`,
        description: `The thread has been successfully ${newStickyState ? 'made sticky' : 'removed from sticky'}.`,
      });
    } catch (err) {
      console.error("Error toggling thread sticky state:", err);
      toast({ title: "Error", description: "Failed to update thread sticky state.", variant: "destructive" });
    } finally {
      setIsTogglingSticky(false);
    }
  };


  if (authLoading || isLoading) {
    return (
        <div className="space-y-8 py-10 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading thread...</p>
        </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push(thread?.relatedVotationId ? '/agora' : (forumId ? `/forums/${forumId}` : '/forums'))} className="mt-4">
          Back to {thread?.relatedVotationId ? 'The Agora' : (forumName || 'Forum')}
        </Button>
      </Alert>
    );
  }

  if (!thread) {
    return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>Thread Not Found</AlertTitle>
        <AlertDescription>
          The thread you are looking for does not exist or could not be loaded.
        </AlertDescription>
        <Button onClick={() => router.push(thread?.relatedVotationId ? '/agora' : (forumId ? `/forums/${forumId}` : '/forums'))} className="mt-4">
           Back to {thread?.relatedVotationId ? 'The Agora' : (forumName || 'Forum')}
        </Button>
      </Alert>
    );
  }
  
  const backLinkHref = thread.relatedVotationId ? '/agora' : `/forums/${forumId}`;
  const backLinkText = (forumName || (thread.relatedVotationId ? 'The Agora' : 'Forum'));


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <Link href={backLinkHref} className="text-sm text-primary hover:underline flex items-center mb-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to {backLinkText}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-start">
                {thread.isSticky && <Pin className="mr-2 h-7 w-7 text-amber-500 flex-shrink-0 mt-1" title="Sticky Thread"/>}
                <FileText className="mr-3 h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <span className="break-all">{thread.title}</span>
                {thread.isLocked && <Lock className="ml-2 h-6 w-6 text-destructive flex-shrink-0 mt-1" title="Thread Locked" />}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
                Started by <Link href={`/profile/${thread.author.id}`} className="text-primary hover:underline font-medium">{thread.author.username}</Link> on {new Date(thread.createdAt).toLocaleDateString()}
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
                    {thread.isSticky ? 'Remove Sticky' : 'Make Sticky'}
                </Button>
                <Button 
                    variant={thread.isLocked ? "destructive" : "outline"} 
                    onClick={handleToggleLockThread}
                    disabled={isTogglingLock || (thread.isLocked && thread.relatedVotationId && votation && votation.status !== 'active')}
                    size="sm"
                    className="min-w-[130px]"
                    title={(thread.isLocked && thread.relatedVotationId && votation && votation.status !== 'active') ? "This Agora thread was locked because its votation concluded. It cannot be unlocked from here." : ""}
                >
                    {isTogglingLock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (thread.isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />)}
                    {thread.isLocked ? 'Unlock Thread' : 'Lock Thread'}
                </Button>
              </>
            )}
            {userCanReply && !thread.isLocked && (
              <Button onClick={() => setShowReplyForm(prev => !prev)} size="sm" className="min-w-[130px]">
                {showReplyForm ? <Edit className="mr-2 h-5 w-5" />  : <Reply className="mr-2 h-5 w-5" /> }
                {showReplyForm ? 'Cancel Reply' : 'Reply to Thread'}
              </Button>
            )}
        </div>
      </div>
      
      {votation && (
        <Card className="mb-6 border-blue-500 shadow-lg">
          <CardHeader className="bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-t-lg">
            <CardTitle className="flex items-center text-xl">
              <Vote className="mr-3 h-6 w-6" />
              Votation Details: {votation.title}
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-400">
              This thread is associated with a formal community votation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {votation.type === 'sanction' && votation.targetUsername && (
              <div className="flex items-center text-sm">
                <UserX className="mr-2 h-4 w-4 text-destructive" />
                <span>Proposed Sanction for: <strong>{votation.targetUsername}</strong> for <strong>{votation.sanctionDuration}</strong></span>
              </div>
            )}
            {votation.type === 'admission_request' && votation.targetUsername && (
              <div className="flex items-center text-sm">
                <Users className="mr-2 h-4 w-4 text-primary" />
                <span>Admission Request for: <strong>{votation.targetUsername}</strong></span>
              </div>
            )}
            {votation.type === 'rule_change' && (
              <div className="flex items-center text-sm">
                <FileText className="mr-2 h-4 w-4 text-primary" />
                <span>Proposal to change: <strong>Site Constitution/Rules</strong></span>
              </div>
            )}
            {votation.type === 'new_forum_proposal' && votation.proposedForumName && (
                 <div className="flex items-center text-sm">
                    <PlusCircle className="mr-2 h-4 w-4 text-green-600" />
                    <span>Proposal for New Forum: <strong>{votation.proposedForumName}</strong> in category <strong>{categories.find(c => c.id === votation.proposedForumCategoryId)?.name || 'Unknown'}</strong></span>
                </div>
            )}
            <div className="text-sm">
                <p><strong className="font-medium">Proposer:</strong> {votation.proposerUsername}</p>
                <p><strong className="font-medium">Status:</strong> <span className="font-semibold capitalize">{votation.status.replace(/_/g, ' ')}</span></p>
                {votation.deadline && <p><strong className="font-medium">Deadline:</strong> {format(new Date(votation.deadline), "PPPp")}</p>}
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-md">Current Tally:</h4>
              <ul className="list-disc list-inside pl-1 space-y-1 text-sm">
                <li>For: {votation.options.for || 0}</li>
                <li>Against: {votation.options.against || 0}</li>
                <li>Abstain: {votation.options.abstain || 0}</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-1">Total votes cast: {votation.totalVotesCast || 0}</p>
            </div>
            
            {votation.status === 'active' && loggedInUser && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold mb-2 text-md">Cast Your Vote:</h4>
                {votation.type === 'sanction' && loggedInUser.id === votation.targetUserId ? (
                   <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
                       <ShieldCheck className="h-5 w-5"/>
                       <AlertTitle>Your Sanction Process</AlertTitle>
                       <AlertDescription>You cannot vote in your own sanction process. You can reply in this thread to present your defense.</AlertDescription>
                   </Alert>
                ) : userVotationChoice ? ( 
                     <Alert variant="default" className="border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 [&>svg]:text-green-600">
                        <ShieldCheck className="h-5 w-5" />
                        <AlertTitle>Vote Recorded</AlertTitle>
                        <AlertDescription>
                        You voted: <span className="font-semibold capitalize">{userVotationChoice}</span>.
                        </AlertDescription>
                    </Alert>
                ) : !loggedInUser.canVote || loggedInUser.status !== 'active' ? ( 
                  <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
                    <ShieldCheck className="h-5 w-5" />
                    <AlertTitle>Not Eligible to Vote</AlertTitle>
                    <AlertDescription>
                      {loggedInUser.status === 'under_sanction_process' && 'Users under sanction process cannot vote.'}
                      {loggedInUser.status === 'sanctioned' && 'Sanctioned users cannot vote.'}
                      {loggedInUser.status === 'active' && !loggedInUser.canVote && 'You do not have voting rights.'}
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
                      {isSubmittingVotationVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ThumbsUp className="mr-2 h-4 w-4"/>} A Favor
                    </Button>
                    <Button 
                      onClick={() => handleVotationVote('against')} 
                      disabled={isSubmittingVotationVote} 
                      variant="destructive" 
                      className="flex-1"
                    >
                      {isSubmittingVotationVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ThumbsDown className="mr-2 h-4 w-4"/>} En Contra
                    </Button>
                    <Button 
                      onClick={() => handleVotationVote('abstain')} 
                      disabled={isSubmittingVotationVote} 
                      variant="outline" 
                      className="flex-1"
                    >
                      {isSubmittingVotationVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MinusCircle className="mr-2 h-4 w-4"/>} Abstenerse
                    </Button>
                  </div>
                )}
              </div>
            )}
            {votation.status === 'active' && !loggedInUser && (
                <Alert variant="default" className="mt-3">
                    <ShieldCheck className="h-5 w-5"/>
                    <AlertTitle>Login to Vote</AlertTitle>
                    <AlertDescription>
                       <Link href="/auth/login" className="text-primary hover:underline font-semibold">Log in</Link> to cast your vote on this proposal.
                    </AlertDescription>
                </Alert>
            )}

             {votation.status !== 'active' && (
                 <Alert variant="default" className="mt-3">
                    <ShieldCheck className="h-5 w-5"/>
                    <AlertTitle>Voting Closed</AlertTitle>
                    <AlertDescription>
                        This votation is no longer active. Result: <span className="font-semibold">{votation.outcome || "Pending finalization"}</span>
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
            />
          ))}
        </div>
      ) : (
        <Card>
            <CardContent className="py-10 text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No posts in this thread yet.</p>
                 {userCanReply && !thread.isLocked ? (
                     <p className="text-sm text-muted-foreground">Be the first to reply!</p>
                 ): (
                    <p className="text-sm text-muted-foreground">
                       {thread.isLocked && "This thread is locked. No new replies can be added."}
                       {!thread.isLocked && loggedInUser && loggedInUser.status === 'under_sanction_process' && !isOwnActiveSanctionThread && "You can only reply in your own sanction votation thread while your case is active."}
                       {!thread.isLocked && loggedInUser && loggedInUser.status === 'sanctioned' && "You are sanctioned and cannot reply."}
                       {!thread.isLocked && (!loggedInUser || loggedInUser.role === 'visitor' || loggedInUser.role === 'guest') && "Login or sign up to reply."}
                    </p>
                 )}
            </CardContent>
        </Card>
      )}

      {thread.isLocked && (
        <Alert variant="default" className="mt-6 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
          <Lock className="h-5 w-5" />
          <AlertTitle>Thread Locked</AlertTitle>
          <AlertDescription>
            This thread has been locked. No new replies can be added.
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
            <AlertTitle>Cannot Reply</AlertTitle>
            <AlertDescription>
                {loggedInUser.status === 'under_sanction_process' && !isOwnActiveSanctionThread && "You can only reply in your own sanction votation thread while your case is active."}
                {loggedInUser.status === 'sanctioned' && "You are sanctioned and cannot reply."}
            </AlertDescription>
        </Alert>
      )}
       {!thread.isLocked && !loggedInUser && (
         <Alert variant="default" className="mt-6">
            <LogIn className="h-5 w-5"/>
            <AlertTitle>Login to Reply</AlertTitle>
            <AlertDescription>
                Please <Link href="/auth/login" className="font-semibold text-primary hover:underline">Log in</Link> or <Link href="/auth/signup" className="font-semibold text-primary hover:underline">sign up</Link> to reply to this thread.
            </AlertDescription>
        </Alert>
       )}
    </div>
  );
}
