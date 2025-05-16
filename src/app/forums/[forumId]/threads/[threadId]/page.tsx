
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PostItem from '@/components/forums/PostItem';
import ReplyForm from '@/components/forums/ReplyForm';
import type { Thread, Post as PostType, User as KratiaUser, Poll, Votation, VotationStatus } from '@/lib/types';
import { Loader2, MessageCircle, FileText, Frown, ChevronLeft, Edit, Reply, Vote, Users, CalendarDays, UserX, ShieldCheck, ThumbsUp, ThumbsDown, MinusCircle, Ban } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs, runTransaction, increment, updateDoc } from 'firebase/firestore';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { KRATIA_CONFIG } from '@/lib/config';

// Helper function for timestamp conversion
const formatFirestoreTimestamp = (timestamp: any): string | undefined => {
  if (!timestamp) {
    return undefined; 
  }
  if (typeof timestamp === 'string') {
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/.test(timestamp)) {
        const d = new Date(timestamp);
        if (d.toISOString() === timestamp) return timestamp;
    }
    const parsedDate = new Date(timestamp);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
    }
    console.warn('Unparseable string timestamp:', timestamp);
    return undefined;
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  console.warn('Unknown timestamp format:', timestamp);
  return undefined;
};

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();

  const threadId = params.threadId as string;
  const forumId = params.forumId as string;

  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [forumName, setForumName] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  
  const [votation, setVotation] = useState<Votation | null>(null);
  const [isSubmittingVotationVote, setIsSubmittingVotationVote] = useState(false);
  const [userVotationChoice, setUserVotationChoice] = useState<string | null>(null);


  useEffect(() => {
    if (!threadId || !forumId) {
      setError("Thread ID or Forum ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchThreadData = async () => {
      setIsLoading(true);
      setError(null);
      setVotation(null); 
      try {
        const threadRef = doc(db, "threads", threadId);
        const threadSnap = await getDoc(threadRef);

        if (!threadSnap.exists()) {
          setError("Thread not found.");
          setThread(null);
          setIsLoading(false);
          return;
        }
        const threadData = threadSnap.data();
        const fetchedThread = {
          id: threadSnap.id,
          ...threadData,
          createdAt: formatFirestoreTimestamp(threadData.createdAt) || new Date(0).toISOString(),
          lastReplyAt: formatFirestoreTimestamp(threadData.lastReplyAt),
          author: threadData.author || { username: 'Unknown', id: '' },
          postCount: threadData.postCount || 0,
          relatedVotationId: threadData.relatedVotationId || null,
        } as Thread;
        setThread(fetchedThread);
        
        if (fetchedThread.relatedVotationId) {
          const votationRef = doc(db, "votations", fetchedThread.relatedVotationId);
          const votationSnap = await getDoc(votationRef);
          if (votationSnap.exists()) {
            let votationData = votationSnap.data() as Votation;
            
            if (votationData.status === 'active' && isPast(new Date(votationData.deadline))) {
              let newStatus: VotationStatus;
              let outcomeMessage: string;

              const quorumMet = (votationData.totalVotesCast || 0) >= (votationData.quorumRequired || KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS);
              const forVotes = votationData.options.for || 0;
              const againstVotes = votationData.options.against || 0;
              const passed = forVotes > againstVotes;

              if (!quorumMet) {
                newStatus = 'closed_failed_quorum';
                outcomeMessage = `Failed - Quorum not met (${votationData.totalVotesCast} of ${votationData.quorumRequired || KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS} required).`;
              } else if (passed) {
                newStatus = 'closed_passed';
                outcomeMessage = 'Passed.';
              } else {
                newStatus = 'closed_failed_vote';
                outcomeMessage = 'Failed - Did not receive majority "For" votes.';
              }
              
              try {
                await updateDoc(votationRef, { status: newStatus, outcome: outcomeMessage });
                votationData.status = newStatus;
                votationData.outcome = outcomeMessage;
                toast({ title: "Votation Closed", description: `Votation "${votationData.title}" has been automatically closed. Result: ${outcomeMessage}`});

                // Apply sanction if votation passed and it's a sanction type
                if (newStatus === 'closed_passed' && votationData.type === 'sanction' && votationData.targetUserId) {
                  const targetUserRef = doc(db, "users", votationData.targetUserId);
                  const sanctionDurationDays = 1; // Hardcoded to 1 day for now, as agreed
                  const sanctionEndDate = new Date();
                  sanctionEndDate.setDate(sanctionEndDate.getDate() + sanctionDurationDays);

                  try {
                    await updateDoc(targetUserRef, {
                      status: 'sanctioned',
                      sanctionEndDate: sanctionEndDate.toISOString(),
                    });
                    toast({
                      title: "Sanction Applied",
                      description: `${votationData.targetUsername} has been sanctioned for ${sanctionDurationDays} day(s). Status updated.`,
                    });
                  } catch (sanctionError) {
                    console.error("Error applying sanction to user:", sanctionError);
                    toast({
                      title: "Error Applying Sanction",
                      description: `Could not update ${votationData.targetUsername}'s status. Please check manually.`,
                      variant: "destructive",
                    });
                  }
                }

              } catch (updateError) {
                console.error("Error updating votation status:", updateError);
                toast({ title: "Votation Update Error", description: "Could not automatically close the votation. Please try refreshing.", variant: "destructive"});
              }
            }
            
            setVotation({ id: votationSnap.id, ...votationData });
            if (loggedInUser && votationData.voters && votationData.voters[loggedInUser.id]) {
              setUserVotationChoice(votationData.voters[loggedInUser.id]);
            }
          } else {
            console.warn(`Votation document with ID ${fetchedThread.relatedVotationId} not found.`);
          }
        }


        if (fetchedThread.forumId === forumId) {
            const forumRefDoc = doc(db, "forums", forumId);
            const forumSnap = await getDoc(forumRefDoc);
            if (forumSnap.exists()) {
                setForumName(forumSnap.data().name);
            }
        } else {
             console.warn("Mismatch between URL forumId and thread's forumId");
        }

        const postsQuery = query(
          collection(db, "posts"),
          where("threadId", "==", threadId),
          orderBy("createdAt", "asc")
        );
        const postsSnapshot = await getDocs(postsQuery);
        const fetchedPosts = postsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
            updatedAt: formatFirestoreTimestamp(data.updatedAt),
            author: data.author || { username: 'Unknown', id: '' },
            reactions: data.reactions || {}, 
            lastEditedBy: data.lastEditedBy
          } as PostType;
        });
        setPosts(fetchedPosts);

      } catch (err) {
        console.error(`Error fetching thread ${threadId} data:`, err);
        setError("Failed to load thread details or posts. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchThreadData();
  }, [threadId, forumId, loggedInUser, toast]); 


  const isOwnActiveSanctionThread =
    loggedInUser &&
    thread && thread.relatedVotationId && 
    votation && 
    votation.type === 'sanction' && 
    votation.targetUserId === loggedInUser.id &&
    votation.status === 'active';

  let userCanReply = false;
  if (loggedInUser && loggedInUser.role !== 'visitor' && loggedInUser.role !== 'guest') {
    if (loggedInUser.status === 'active') {
      userCanReply = true;
    } else if (loggedInUser.status === 'under_sanction_process' && isOwnActiveSanctionThread) {
      userCanReply = true; 
    }
  }
  
  const canVoteInVotation = loggedInUser && loggedInUser.canVote && loggedInUser.status === 'active' && votation && votation.status === 'active' && !userVotationChoice;


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
    if (!loggedInUser || !votation || !canVoteInVotation || (votation.type === 'sanction' && loggedInUser.id === votation.targetUserId) ) {
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
        return { ...currentVotationData, ...dataToUpdate } as Votation;
      });

      setVotation(updatedVotationData);
      setUserVotationChoice(choice);
      toast({ title: "Vote Cast!", description: `Your vote for "${choice}" has been recorded.`});

    } catch (error: any) {
      console.error("Error casting votation vote:", error);
      toast({ title: "Error Voting", description: error.message || "Failed to cast your vote.", variant: "destructive"});
    } finally {
      setIsSubmittingVotationVote(false);
    }
  };


  if (isLoading || authLoading) {
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
        <Button onClick={() => router.push(forumId ? `/forums/${forumId}` : '/forums')} className="mt-4">
          Back to {forumName || 'Forum'}
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
        <Button onClick={() => router.push(forumId ? `/forums/${forumId}` : '/forums')} className="mt-4">
          Back to {forumName || 'Forum'}
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <Link href={`/forums/${forumId}`} className="text-sm text-primary hover:underline flex items-center mb-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to {forumName || 'Forum'}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-start">
                <FileText className="mr-3 h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <span className="break-all">{thread.title}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
                Started by <Link href={`/profile/${thread.author.id}`} className="text-primary hover:underline font-medium">{thread.author.username}</Link> on {new Date(thread.createdAt).toLocaleDateString()}
            </p>
        </div>
        {userCanReply && (
          <Button onClick={() => setShowReplyForm(prev => !prev)}>
            {showReplyForm ? <Edit className="mr-2 h-5 w-5" />  : <Reply className="mr-2 h-5 w-5" /> }
            {showReplyForm ? 'Cancel Reply' : 'Reply to Thread'}
          </Button>
        )}
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
            <div className="text-sm">
                <p><strong className="font-medium">Proposer:</strong> {votation.proposerUsername}</p>
                <p><strong className="font-medium">Status:</strong> <span className="font-semibold capitalize">{votation.status.replace(/_/g, ' ')}</span></p>
                <p><strong className="font-medium">Deadline:</strong> {format(new Date(votation.deadline), "PPPp")}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-md">Current Tally:</h4>
              <ul className="list-disc list-inside pl-1 space-y-1 text-sm">
                <li>For: {votation.options.for}</li>
                <li>Against: {votation.options.against}</li>
                <li>Abstain: {votation.options.abstain}</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-1">Total votes cast: {votation.totalVotesCast}</p>
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
                ) : !canVoteInVotation && userVotationChoice ? ( 
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
                      {loggedInUser.status !== 'active' ? `Your account status is '${loggedInUser.status}'. You cannot vote.` : 'You do not have voting rights.'}
                       {loggedInUser.status === 'under_sanction_process' && ' Users under sanction process cannot vote.'}
                       {loggedInUser.status === 'sanctioned' && ' Sanctioned users cannot vote.'}
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
                threadPoll={index === 0 && thread.poll ? thread.poll : undefined}
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
                 {userCanReply ? (
                     <p className="text-sm text-muted-foreground">Be the first to reply!</p>
                 ): (
                    <p className="text-sm text-muted-foreground">
                       {loggedInUser && loggedInUser.status === 'under_sanction_process' && !isOwnActiveSanctionThread && "You can only reply in your own sanction votation thread while your case is active."}
                       {loggedInUser && loggedInUser.status === 'sanctioned' && "You cannot reply to threads while sanctioned."}
                       {(!loggedInUser || loggedInUser.role === 'visitor' || loggedInUser.role === 'guest') && "Login or sign up to reply."}
                    </p>
                 )}
            </CardContent>
        </Card>
      )}

      {userCanReply && showReplyForm && thread && (
        <ReplyForm
            threadId={thread.id}
            forumId={forumId}
            onReplySuccess={handleNewReply}
            onCancel={() => setShowReplyForm(false)}
        />
      )}

       {!userCanReply && loggedInUser && (loggedInUser.role !== 'visitor' && loggedInUser.role !== 'guest') && (
        <Alert variant="default" className="mt-6">
            <Ban className="h-5 w-5"/>
            <AlertTitle>Cannot Reply</AlertTitle>
            <AlertDescription>
                {loggedInUser.status === 'under_sanction_process' && !isOwnActiveSanctionThread && "You can only reply in your own sanction votation thread while your case is active."}
                {loggedInUser.status === 'sanctioned' && "You are currently sanctioned and cannot reply."}
            </AlertDescription>
        </Alert>
      )}
       {!loggedInUser && (
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
