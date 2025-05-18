
"use client";

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ThreadListItem from '@/components/forums/ThreadListItem';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { MessageSquareText, PlusCircle, ListChecks, Frown, Loader2 } from 'lucide-react';
import type { Forum, Thread } from '@/lib/types';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, Timestamp, getDocs, QueryOrderByConstraint, limit, startAfter, type DocumentSnapshot } from 'firebase/firestore';
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
    // console.warn('[formatFirestoreTimestamp] Unparseable string timestamp:', timestamp);
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
  // console.warn('[formatFirestoreTimestamp] Unknown timestamp format:', timestamp);
  return undefined;
};


export default function ForumPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useMockAuth();
  const forumId = params.forumId as string;

  const [forum, setForum] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastVisibleThreadSnapshot, setLastVisibleThreadSnapshot] = useState<DocumentSnapshot | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreThreads, setHasMoreThreads] = useState(true);


  useEffect(() => {
    if (!forumId) {
      setError("Forum ID is missing.");
      setIsLoading(false);
      setHasMoreThreads(false);
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      setThreads([]); // Reset threads on initial load or forumId change
      setLastVisibleThreadSnapshot(null);
      setHasMoreThreads(true);

      try {
        // Fetch forum details
        const forumRef = doc(db, "forums", forumId);
        const forumSnap = await getDoc(forumRef);

        if (!forumSnap.exists()) {
          setError("Forum not found.");
          setForum(null);
          setHasMoreThreads(false);
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

        // Fetch first page of threads
        const orderByConstraints: QueryOrderByConstraint[] = [
          orderBy("isSticky", "desc"),
          orderBy("lastReplyAt", "desc")
        ];

        const threadsQuery = query(
          collection(db, "threads"),
          where("forumId", "==", forumId),
          ...orderByConstraints,
          limit(KRATIA_CONFIG.THREADS_PER_PAGE)
        );
        const threadsSnapshot = await getDocs(threadsQuery);
        const fetchedThreads = threadsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
            lastReplyAt: formatFirestoreTimestamp(data.lastReplyAt),
            author: data.author || { username: 'Unknown', id: '' },
            postCount: data.postCount || 0,
            isSticky: data.isSticky || false,
          } as Thread;
        });
        setThreads(fetchedThreads);

        if (threadsSnapshot.docs.length > 0) {
          setLastVisibleThreadSnapshot(threadsSnapshot.docs[threadsSnapshot.docs.length - 1]);
        } else {
          setHasMoreThreads(false);
        }
        if (fetchedThreads.length < KRATIA_CONFIG.THREADS_PER_PAGE) {
          setHasMoreThreads(false);
        }

      } catch (err: any) {
        console.error(`Error fetching forum ${forumId} and its threads:`, err);
        setError("Failed to load forum details or threads. Please try again. " + err.message);
        setHasMoreThreads(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [forumId]);

  const handleLoadMoreThreads = async () => {
    if (!lastVisibleThreadSnapshot || !hasMoreThreads || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const orderByConstraints: QueryOrderByConstraint[] = [
        orderBy("isSticky", "desc"),
        orderBy("lastReplyAt", "desc")
      ];
      const nextThreadsQuery = query(
        collection(db, "threads"),
        where("forumId", "==", forumId),
        ...orderByConstraints,
        startAfter(lastVisibleThreadSnapshot),
        limit(KRATIA_CONFIG.THREADS_PER_PAGE)
      );
      const threadsSnapshot = await getDocs(nextThreadsQuery);
      const newThreads = threadsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
          lastReplyAt: formatFirestoreTimestamp(data.lastReplyAt),
          author: data.author || { username: 'Unknown', id: '' },
          postCount: data.postCount || 0,
          isSticky: data.isSticky || false,
        } as Thread;
      });

      setThreads(prevThreads => [...prevThreads, ...newThreads]);
      if (threadsSnapshot.docs.length > 0) {
        setLastVisibleThreadSnapshot(threadsSnapshot.docs[threadsSnapshot.docs.length - 1]);
      }
      if (newThreads.length < KRATIA_CONFIG.THREADS_PER_PAGE) {
        setHasMoreThreads(false);
      }
    } catch (err) {
      console.error("Error loading more threads:", err);
      setError("Failed to load more threads. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const canCreateThread = user && user.role !== 'visitor' && user.role !== 'guest' && user.status === 'active';

  if (authLoading || (isLoading && threads.length === 0)) { // Show main loader only if no threads are displayed yet
    return (
      <div className="space-y-8 py-10 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading forum...</p>
      </div>
    );
  }

  if (error && threads.length === 0) { // Show main error only if no threads are displayed yet
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

  if (!forum && !isLoading) { // If not loading and forum is still null (e.g., not found)
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
      {forum && (
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
      )}

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
      ) : !isLoading && ( // Only show "No threads yet" if not loading and threads array is empty
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
              {forum && <p className="text-muted-foreground">Be the first to start a discussion in {forum.name}!</p>}
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

      {hasMoreThreads && (
        <div className="text-center mt-8">
          <Button onClick={handleLoadMoreThreads} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-5 w-5" />
            )}
            Load More Threads
          </Button>
        </div>
      )}
       {error && threads.length > 0 && ( // Display subsequent loading errors without hiding content
            <Alert variant="destructive" className="mt-4">
                <Frown className="h-5 w-5" />
                <AlertTitle>Error Loading More Threads</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
    </div>
  );
}

