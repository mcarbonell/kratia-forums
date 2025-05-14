
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PostItem from '@/components/forums/PostItem';
import ReplyForm from '@/components/forums/ReplyForm'; // Import ReplyForm
import { mockThreads, mockPosts, mockForums } from '@/lib/mockData';
import type { Thread, Post as PostType } from '@/lib/types';
import { Loader2, MessageCircle, FileText, Frown, ChevronLeft, Edit, Reply } from 'lucide-react';
import { useMockAuth } from '@/hooks/use-mock-auth';

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useMockAuth();

  const threadId = params.threadId as string;
  const forumId = params.forumId as string;

  const [thread, setThread] = useState<Thread | undefined>(undefined);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [forumName, setForumName] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false); // State for reply form visibility

  useEffect(() => {
    if (threadId && forumId) {
      const currentThread = mockThreads.find((t) => t.id === threadId);
      const currentForum = mockForums.find(f => f.id === forumId);
      
      setThread(currentThread);
      setForumName(currentForum?.name);

      if (currentThread) {
        const threadPosts = mockPosts
          .filter((p) => p.threadId === threadId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setPosts(threadPosts);
      }
    }
    setIsLoading(false);
  }, [threadId, forumId]);

  const canReply = user && user.role !== 'visitor' && user.role !== 'guest';

  const handleNewReply = (newPost: PostType) => {
    setPosts(prevPosts => [...prevPosts, newPost]);
    // Optionally update thread details in local state if displayed directly
    if (thread) {
        setThread(prevThread => prevThread ? {
            ...prevThread,
            postCount: prevThread.postCount + 1,
            lastReplyAt: newPost.createdAt,
        } : undefined);
    }
    setShowReplyForm(false); // Hide form after successful reply
  };

  if (isLoading || authLoading) {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div className="h-8 w-1/4 bg-muted rounded animate-pulse"></div>
                <div className="h-10 w-32 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-3/4 bg-muted rounded animate-pulse mb-4"></div>
            <div className="h-6 w-1/2 bg-muted rounded animate-pulse mb-6"></div>
            {[...Array(2)].map((_, i) => (
                <Card key={i} className="mb-4">
                    <CardHeader className="flex flex-row items-center space-x-4 pb-2">
                        <div className="h-10 w-10 bg-muted rounded-full animate-pulse"></div>
                        <div className="space-y-1">
                            <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
                            <div className="h-3 w-32 bg-muted rounded animate-pulse"></div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-4 w-full bg-muted rounded animate-pulse mb-2"></div>
                        <div className="h-4 w-3/4 bg-muted rounded animate-pulse"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
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
        <Button onClick={() => router.push(`/forums/${forumId}`)} className="mt-4">
          Back to Forum
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
                <p className="text-sm text-muted-foreground">
                    This thread is empty. This might be an error.
                </p>
            </CardContent>
        </Card>
      )}

      {/* Reply Form */}
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
