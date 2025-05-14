
"use client";

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ThreadListItem from '@/components/forums/ThreadListItem';
import { mockForums, mockThreads } from '@/lib/mockData';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { MessageSquareText, PlusCircle, ListChecks, Frown } from 'lucide-react';
import type { Thread } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function ForumPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useMockAuth();
  const forumId = params.forumId as string;

  const [forum, setForum] = useState<typeof mockForums[0] | undefined>(undefined);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (forumId) {
      const currentForum = mockForums.find((f) => f.id === forumId);
      if (currentForum) {
        setForum(currentForum);
        const forumThreads = mockThreads.filter((t) => t.forumId === forumId).sort((a, b) => new Date(b.lastReplyAt || b.createdAt).getTime() - new Date(a.lastReplyAt || a.createdAt).getTime());
        setThreads(forumThreads);
      }
    }
    setIsLoading(false);
  }, [forumId]);

  const canCreateThread = user && user.role !== 'visitor' && user.role !== 'guest';

  if (authLoading || isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-3/4 bg-muted rounded animate-pulse mb-4"></div>
        <div className="h-8 w-1/4 bg-muted rounded animate-pulse mb-6"></div>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="mb-4">
            <CardHeader>
              <div className="h-6 w-1/2 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-1/3 bg-muted rounded animate-pulse mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-1/4 bg-muted rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subforums can be listed here if `forum.subForums` exists and is populated */}
       {forum.subForums && forum.subForums.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sub-Forums</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {forum.subForums.map(subForum => (
              <Link key={subForum.id} href={`/forums/${subForum.id}`} className="block p-3 rounded-md hover:bg-muted transition-colors">
                <h3 className="font-semibold text-primary">{subForum.name}</h3>
                <p className="text-sm text-muted-foreground">{subForum.description}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
