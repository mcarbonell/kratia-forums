
"use client";

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ThreadListItem from '@/components/forums/ThreadListItem';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { Vote, PlusCircle, ListChecks, Frown, Loader2 } from 'lucide-react';
import type { Forum, Thread, Votation, VotationStatus } from '@/lib/types';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

// Helper function for timestamp conversion (copied from ForumPage)
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

interface ThreadWithVotationStatus extends Thread {
  votationStatus?: VotationStatus;
}

export default function AgoraPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useMockAuth();
  const agoraForumId = 'agora'; // Hardcoded forumId for Agora

  const [forum, setForum] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<ThreadWithVotationStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgoraData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch Agora forum details
        const forumRef = doc(db, "forums", agoraForumId);
        const forumSnap = await getDoc(forumRef);

        if (!forumSnap.exists()) {
          setError("Agora forum not found. Please ensure it exists in Firestore with ID 'agora'.");
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

        // Fetch votation threads for Agora
        const threadsQuery = query(
          collection(db, "threads"),
          where("forumId", "==", agoraForumId)
          // We will sort client-side after fetching votation statuses
        );
        const threadsSnapshot = await getDocs(threadsQuery);
        let fetchedThreads: ThreadWithVotationStatus[] = threadsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: formatFirestoreTimestamp(data.createdAt) || new Date(0).toISOString(),
            lastReplyAt: formatFirestoreTimestamp(data.lastReplyAt),
            author: data.author || { username: 'Unknown', id: '' },
            postCount: data.postCount || 0,
            isLocked: data.isLocked || false,
          } as ThreadWithVotationStatus;
        });

        // Fetch votation statuses for threads that have a relatedVotationId
        const votationPromises = fetchedThreads
          .filter(thread => thread.relatedVotationId)
          .map(async (thread) => {
            const votationRef = doc(db, "votations", thread.relatedVotationId!);
            const votationSnap = await getDoc(votationRef);
            if (votationSnap.exists()) {
              return { threadId: thread.id, status: votationSnap.data().status as VotationStatus };
            }
            return { threadId: thread.id, status: undefined };
          });

        const votationStatusesResults = await Promise.all(votationPromises);
        const votationStatusMap = new Map<string, VotationStatus | undefined>();
        votationStatusesResults.forEach(result => {
          votationStatusMap.set(result.threadId, result.status);
        });

        fetchedThreads = fetchedThreads.map(thread => ({
          ...thread,
          votationStatus: thread.relatedVotationId ? votationStatusMap.get(thread.id) : undefined,
        }));

        // Sort threads: active votations first, then by lastReplyAt
        fetchedThreads.sort((a, b) => {
          const aIsActive = a.votationStatus === 'active';
          const bIsActive = b.votationStatus === 'active';

          if (aIsActive && !bIsActive) return -1; // a comes first
          if (!aIsActive && bIsActive) return 1;  // b comes first

          // If both are active or both are not (or one/both don't have votation status), sort by lastReplyAt
          const dateA = a.lastReplyAt ? new Date(a.lastReplyAt).getTime() : 0;
          const dateB = b.lastReplyAt ? new Date(b.lastReplyAt).getTime() : 0;
          return dateB - dateA; // Descending
        });
        
        setThreads(fetchedThreads);

      } catch (err) {
        console.error(`Error fetching Agora (${agoraForumId}) data:`, err);
        setError("Failed to load Agora details or votations. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgoraData();
  }, []); // agoraForumId is constant

  const canProposeVotation = user && user.role !== 'visitor' && user.role !== 'guest' && user.status === 'active';

  if (authLoading || isLoading) {
    return (
      <div className="space-y-8 py-10 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading Agora...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => router.push('/')} className="mt-4">
          Back to Homepage
        </Button>
      </Alert>
    );
  }

  if (!forum) {
     return (
      <Alert variant="destructive">
        <Frown className="h-5 w-5" />
        <AlertTitle>Agora Not Found</AlertTitle>
        <AlertDescription>
          The Agora forum could not be loaded. It might not be configured correctly.
        </AlertDescription>
        <Button onClick={() => router.push('/')} className="mt-4">
          Back to Homepage
        </Button>
      </Alert>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Vote className="mr-3 h-8 w-8 text-primary" />
            The Agora - Community Votations
          </h1>
          {forum.description && <p className="text-muted-foreground mt-1">{forum.description}</p>}
        </div>
        {canProposeVotation && (
          <Button asChild>
            <Link href={`/forums/${agoraForumId}/new-thread`}>
              <PlusCircle className="mr-2 h-5 w-5" /> Propose New Votation
            </Link>
          </Button>
        )}
         {!canProposeVotation && user && (user.role !== 'visitor' && user.role !== 'guest') && (
            <Alert variant="default" className="mt-2 text-sm">
                <Vote className="h-4 w-4" />
                <AlertTitle>Voting Rights Required</AlertTitle>
                <AlertDescription>
                {user.status === 'under_sanction_process' && "You cannot propose votations while under a sanction process."}
                {user.status === 'sanctioned' && "You cannot propose votations while sanctioned."}
                {user.status === 'active' && (!user.canVote) && "You need voting rights to propose new votations. Continue participating to earn them!"}
                </AlertDescription>
            </Alert>
        )}
      </div>

      {threads.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListChecks className="mr-2 h-6 w-6" />
              Active & Past Votations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {threads.map((thread) => (
                <ThreadListItem key={thread.id} thread={thread} forumId={agoraForumId} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
             <CardTitle className="flex items-center">
                <ListChecks className="mr-2 h-6 w-6" />
                Votations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-10">
              <Frown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No votations yet.</p>
              <p className="text-muted-foreground">
                Be the first to propose a votation in the Agora!
              </p>
              {!canProposeVotation && user && (user.role === 'visitor' || user.role === 'guest') && (
                 <p className="mt-2 text-sm text-amber-600">You need to be a registered member with voting rights to propose votations.</p>
              )}
               {canProposeVotation && (
                 <Button asChild className="mt-6">
                    <Link href={`/forums/${agoraForumId}/new-thread`}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Propose First Votation
                    </Link>
                 </Button>
                )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

