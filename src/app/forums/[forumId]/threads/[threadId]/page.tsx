
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Removed CardDescription
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PostItem from '@/components/forums/PostItem';
import ReplyForm from '@/components/forums/ReplyForm';
import type { Thread, Post as PostType, Forum } from '@/lib/types';
import { Loader2, MessageCircle, FileText, Frown, ChevronLeft, Edit, Reply } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs } from 'firebase/firestore';

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

  useEffect(() => {
    if (!threadId || !forumId) {
      setError("Thread ID or Forum ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchThreadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch Thread
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
          createdAt: (threadData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          lastReplyAt: (threadData.lastReplyAt as Timestamp)?.toDate().toISOString(),
          author: threadData.author || { username: 'Unknown', id: '' },
          postCount: threadData.postCount || 0,
        } as Thread;
        setThread(fetchedThread);

        // Fetch Forum Name (if forumId matches thread's forumId for consistency)
        if (fetchedThread.forumId === forumId) {
            const forumRef = doc(db, "forums", forumId);
            const forumSnap = await getDoc(forumRef);
            if (forumSnap.exists()) {
                setForumName(forumSnap.data().name);
            }
        } else {
             console.warn("Mismatch between URL forumId and thread's forumId");
             // Optionally fetch forum based on threadData.forumId
        }


        // Fetch Posts
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
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString(),
            author: data.author || { username: 'Unknown', id: '' },
            reactions: data.reactions || [],
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
    // Convert Firestore Timestamp to ISO string if it's not already
    const formattedNewPost = {
        ...newPost,
        createdAt: typeof newPost.createdAt === 'string' ? newPost.createdAt : (newPost.createdAt as unknown as Timestamp).toDate().toISOString(),
        author: newPost.author || (user as User) || {username: 'Unknown', id: ''} // Ensure author object is complete
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
      
      {posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((post, index) => (
            <PostItem key={post.id} post={post} isFirstPost={index === 0} />
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
