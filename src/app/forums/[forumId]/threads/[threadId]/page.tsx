
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PostItem from '@/components/forums/PostItem';
import ReplyForm from '@/components/forums/ReplyForm';
import type { Thread, Post as PostType, User as KratiaUser, Poll, Votation } from '@/lib/types'; // Renamed User
import { Loader2, MessageCircle, FileText, Frown, ChevronLeft, Edit, Reply, Vote, Users, CalendarDays, UserX, ShieldCheck } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

// Helper function for timestamp conversion
const formatFirestoreTimestamp = (timestamp: any): string | undefined => {
  if (!timestamp) {
    return undefined; // Field might be optional
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
  const { user, loading: authLoading } = useMockAuth();

  const threadId = params.threadId as string;
  const forumId = params.forumId as string;

  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [forumName, setForumName] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [votation, setVotation] = useState<Votation | null>(null); // State for fetched votation

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
        } as Thread;
        setThread(fetchedThread);
        
        if (fetchedThread.relatedVotationId) {
          const votationRef = doc(db, "votations", fetchedThread.relatedVotationId);
          const votationSnap = await getDoc(votationRef);
          if (votationSnap.exists()) {
            setVotation({ id: votationSnap.id, ...votationSnap.data() } as Votation);
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
            reactions: data.reactions || {}, // Ensure reactions is an object
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
  }, [threadId, forumId]);

  const canReply = user && user.role !== 'visitor' && user.role !== 'guest';

  const handleNewReply = (newPost: PostType) => {
    const formattedNewPost = {
        ...newPost,
        createdAt: formatFirestoreTimestamp(newPost.createdAt) || new Date(0).toISOString(),
        author: newPost.author || (user as KratiaUser) || {username: 'Unknown', id: ''}
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
        {canReply && (
          <Button onClick={() => setShowReplyForm(prev => !prev)}>
            {showReplyForm ? <Edit className="mr-2 h-5 w-5" />  : <Reply className="mr-2 h-5 w-5" /> }
            {showReplyForm ? 'Cancel Reply' : 'Reply to Thread'}
          </Button>
        )}
      </div>
      
      {/* Votation Details Display */}
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
                <p><strong className="font-medium">Status:</strong> <span className="font-semibold capitalize">{votation.status}</span></p>
                <p><strong className="font-medium">Deadline:</strong> {new Date(votation.deadline).toLocaleString()}</p>
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
            {/* Voting UI will be added here in the next step */}
            {votation.status === 'active' && (
                 <Alert variant="default" className="mt-3">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <AlertTitle>Voting is Active</AlertTitle>
                    <AlertDescription>
                        You can cast your vote on this proposal. Voting interface coming soon.
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
                threadPoll={index === 0 ? thread.poll : undefined}
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
                 {canReply ? (
                     <p className="text-sm text-muted-foreground">Be the first to reply!</p>
                 ): (
                    <p className="text-sm text-muted-foreground">
                        This thread is empty. This might be an error.
                    </p>
                 )}
            </CardContent>
        </Card>
      )}

      {canReply && showReplyForm && thread && (
        <ReplyForm
            threadId={thread.id}
            forumId={forumId}
            onReplySuccess={handleNewReply}
            onCancel={() => setShowReplyForm(false)}
        />
      )}

       {!canReply && user && (user.role === 'visitor' || user.role === 'guest') && (
        <Alert variant="default" className="mt-6">
            <MessageCircle className="h-5 w-5"/>
            <AlertTitle>Want to join the conversation?</AlertTitle>
            <AlertDescription>
                <Link href="/auth/login" className="font-semibold text-primary hover:underline">Log in</Link> or <Link href="/auth/signup" className="font-semibold text-primary hover:underline">sign up</Link> to reply to this thread.
            </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

