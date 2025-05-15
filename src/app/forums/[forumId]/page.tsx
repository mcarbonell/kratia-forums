
"use client";

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Removed CardDescription as it's not used here
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ThreadListItem from '@/components/forums/ThreadListItem';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { MessageSquareText, PlusCircle, ListChecks, Frown, Loader2 } from 'lucide-react';
import type { Forum, Thread } from '@/lib/types';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs } from 'firebase/firestore';

export default function ForumPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useMockAuth();
  const forumId = params.forumId as string;

  const [forum, setForum] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!forumId) {
      setError("Forum ID is missing.");
      setIsLoading(false);
      return;
    }

    const fetchForumAndThreads = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch forum details
        const forumRef = doc(db, "forums", forumId);
        const forumSnap = await getDoc(forumRef);

        if (!forumSnap.exists()) {
          setError("Forum not found.");
          setForum(null);
          setIsLoading(false);
          return;
        }
        const forumData = forumSnap.data();
        setForum({ 
            id: forumSnap.id, 
            ...forumData,
            threadCount: forumData.threadCount || 0,
            postCount: forumData.postCount || 0,
        } as Forum);

        // Fetch threads for this forum
        const threadsQuery = query(
          collection(db, "threads"),
          where("forumId", "==", forumId),
          orderBy("lastReplyAt", "desc") // Assuming 'lastReplyAt' is a Timestamp or comparable value
        );
        const threadsSnapshot = await getDocs(threadsQuery);
        const fetchedThreads = threadsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            lastReplyAt: (data.lastReplyAt as Timestamp)?.toDate().toISOString(),
            author: data.author || { username: 'Unknown', id: '' }, // Ensure author is at least an empty object
            postCount: data.postCount || 0,
          } as Thread;
        });
        setThreads(fetchedThreads);

      } catch (err) {
        console.error(`Error fetching forum ${forumId} and its threads:`, err);
        setError("Failed to load forum details or threads. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchForumAndThreads();
  }, [forumId]);

  const canCreateThread = user && user.role !== 'visitor' && user.role !== 'guest';

  if (authLoading || isLoading) {
    return (
      <div className="space-y-8 py-10 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading forum...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push('/forums')} className="mt-4">
          Back to Forums List
        </Button>
      </Alert>
    );
  }
  
  if (!forum) {
     return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>Forum Not Found</AlertTitle>
        <AlertDescription>
          The forum you are looking for does not exist or could not be loaded.
        </AlertDescription>
        <Button onClick={() => router.push('/forums')} className="mt-4">
          Back to Forums List
        </Button>
      </Alert>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <MessageSquareText className="mr-3 h-8 w-8 text-primary" />
            {forum.name}
          </h1>
          {forum.description && <p className="text-muted-foreground mt-1">{forum.description}</p>}
        </div>
        {canCreateThread && (
          <Button asChild>
            <Link href={`/forums/${forumId}/new-thread`}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Thread
            </Link>
          </Button>
        )}
      </div>

      {threads.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListChecks className="mr-2 h-6 w-6" />
              Threads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {threads.map((thread) => (
                <ThreadListItem key={thread.id} thread={thread} forumId={forumId} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
             <CardTitle className="flex items-center">
                <ListChecks className="mr-2 h-6 w-6" />
                Threads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-10">
              <Frown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No threads yet.</p>
              <p className="text-muted-foreground">
                Be the first to start a discussion in {forum.name}!
              </p>
              {!canCreateThread && user && (user.role === 'visitor' || user.role === 'guest') && (
                 <p className="mt-2 text-sm text-amber-600">You need to be a registered member to create threads.</p>
              )}
               {canCreateThread && (
                 <Button asChild className="mt-6">
                    <Link href={`/forums/${forumId}/new-thread`}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Create First Thread
                    </Link>
                 </Button>
                )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Subforums are not handled in this Firestore version for simplicity */}
    </div>
  );
}
