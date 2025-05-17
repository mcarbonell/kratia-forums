
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { User as UserIcon, CalendarDays, Award, MapPin, FileText, Loader2, Frown, Edit, ShieldAlert, Ban, MessageSquare, ListChecks } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar";
import type { User as KratiaUser, Thread, Post } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { KRATIA_CONFIG } from '@/lib/config';

// Helper function for timestamp conversion
const formatFirestoreTimestampToReadable = (timestamp: any): string | undefined => {
  if (!timestamp) return undefined;
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return format(d, "PPPp");
    return undefined;
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return format(timestamp.toDate(), "PPPp");
  }
  if (timestamp instanceof Date) {
    return format(timestamp, "PPPp");
  }
  return undefined;
};

// Define a more specific type for posts that will include forumId
type PostWithForumId = Post & { forumId?: string };

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const userId = params.userId as string;

  const [profileUser, setProfileUser] = useState<KratiaUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recentThreads, setRecentThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  
  const [recentPosts, setRecentPosts] = useState<PostWithForumId[]>([]); // Use the new type
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);


  useEffect(() => {
    if (!userId) {
      setError("User ID is missing from the URL.");
      setIsLoading(false);
      return;
    }

    const fetchUserProfileAndActivity = async () => {
      setIsLoading(true);
      setError(null);
      setRecentThreads([]);
      setRecentPosts([]); // Initialize recentPosts
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = { id: userSnap.id, ...userSnap.data(), status: userSnap.data().status || 'active' } as KratiaUser;
          setProfileUser(userData);

          // Fetch recent threads
          setIsLoadingThreads(true);
          const threadsQuery = query(
            collection(db, "threads"),
            where("author.id", "==", userId),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const threadsSnapshot = await getDocs(threadsQuery);
          setRecentThreads(threadsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Thread)));
          setIsLoadingThreads(false);

          // Fetch recent posts
          setIsLoadingPosts(true);
          const postsQuery = query(
            collection(db, "posts"),
            where("author.id", "==", userId),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const postsSnapshot = await getDocs(postsQuery);
          const fetchedPosts = postsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Post));
          
          // Now, augment posts with forumId
          const postsWithForumData = await Promise.all(
            fetchedPosts.map(async (p) => {
              let fetchedForumId: string | undefined = undefined;
              if (p.threadId) {
                const threadRef = doc(db, "threads", p.threadId);
                const threadSnap = await getDoc(threadRef);
                if (threadSnap.exists()) {
                  const threadData = threadSnap.data();
                  if (threadData && threadData.forumId) {
                    fetchedForumId = threadData.forumId as string;
                  } else {
                    console.warn(`Profile Page: Thread ${p.threadId} exists but has no forumId field for post ${p.id}.`);
                  }
                } else {
                  console.warn(`Profile Page: Thread ${p.threadId} not found for post ${p.id}.`);
                }
              }
              return { ...p, forumId: fetchedForumId }; // Ensure forumId is part of the object
            })
          );
          setRecentPosts(postsWithForumData); // Update state with augmented posts
          setIsLoadingPosts(false);

        } else {
          setError("User not found. This profile does not exist or could not be loaded.");
          setProfileUser(null);
        }
      } catch (err) {
        console.error("Error fetching user profile or activity:", err);
        setError("Failed to load user profile or activity. Please try again later.");
        setProfileUser(null);
        // Ensure loading states are false on error
        setIsLoadingThreads(false);
        setIsLoadingPosts(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfileAndActivity();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{error ? "Error Loading Profile" : "Profile Not Found"}</AlertTitle>
        <AlertDescription>
          {error || "The user profile you are looking for could not be displayed."}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/">Go to Homepage</Link>
        </Button>
      </Alert>
    );
  }
  
  const registrationDateFormatted = profileUser.registrationDate 
    ? formatDistanceToNow(new Date(profileUser.registrationDate), { addSuffix: true }) 
    : 'Unknown';

  const sanctionEndDateFormatted = profileUser.sanctionEndDate
    ? formatFirestoreTimestampToReadable(profileUser.sanctionEndDate)
    : 'N/A';

  const isOwnProfile = loggedInUser?.id === profileUser.id;
  const canProposeSanction = loggedInUser && 
                            loggedInUser.id !== profileUser.id &&
                            loggedInUser.canVote &&
                            loggedInUser.status === 'active' &&
                            profileUser.status !== 'sanctioned' &&
                            profileUser.status !== 'under_sanction_process';


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <UserIcon className="mr-3 h-8 w-8 text-primary" />
          {profileUser.username}'s Profile
        </h1>
        <div className="flex gap-2">
          {isOwnProfile && (
            <Button variant="outline" asChild>
              <Link href={`/profile/edit`}> 
                <Edit className="mr-2 h-4 w-4" /> Edit Profile
              </Link>
            </Button>
          )}
          {canProposeSanction && (
            <Button variant="destructive" asChild>
              <Link href={`/users/${profileUser.id}/propose-sanction`}>
                <ShieldAlert className="mr-2 h-4 w-4" /> Propose Sanction
              </Link>
            </Button>
          )}
        </div>
      </div>

      {profileUser.status === 'under_sanction_process' && (
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>User Under Sanction Process</AlertTitle>
          <AlertDescription>
            This user is currently undergoing a community sanction votation process. Some actions might be restricted.
          </AlertDescription>
        </Alert>
      )}
       {profileUser.status === 'sanctioned' && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
          <Ban className="h-5 w-5" />
          <AlertTitle>User Sanctioned</AlertTitle>
          <AlertDescription>
            This user is currently sanctioned. 
            {profileUser.sanctionEndDate && ` Sanction ends: ${sanctionEndDateFormatted}`}
          </AlertDescription>
        </Alert>
      )}


      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <UserAvatar user={profileUser} size="lg" className="flex-shrink-0 border-2 border-primary shadow-md" />
          <div className="flex-grow">
            <CardTitle className="text-3xl font-semibold">{profileUser.username}</CardTitle>
            <CardDescription className="text-md mt-1">
              {profileUser.email} {profileUser.role && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2 capitalize">{profileUser.role.replace('_', ' ')}</span>}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <CalendarDays className="mr-2 h-5 w-5 text-primary" /> Member Since
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{registrationDateFormatted}</p>
              </CardContent>
            </Card>

            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Award className="mr-2 h-5 w-5 text-primary" /> Karma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-accent">{profileUser.karma || 0}</p>
              </CardContent>
            </Card>

            {profileUser.location && (
              <Card className="bg-background/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <MapPin className="mr-2 h-5 w-5 text-primary" /> Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{profileUser.location}</p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-background/50">
                <CardHeader><CardTitle className="text-lg flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" />Total Posts</CardTitle></CardHeader>
                <CardContent><p className="font-semibold text-lg">{profileUser.totalPostsByUser || 0}</p></CardContent>
            </Card>
            <Card className="bg-background/50">
                <CardHeader><CardTitle className="text-lg flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Threads Started</CardTitle></CardHeader>
                <CardContent><p className="font-semibold text-lg">{profileUser.totalThreadsStartedByUser || 0}</p></CardContent>
            </Card>
             <Card className="bg-background/50">
                <CardHeader><CardTitle className="text-lg flex items-center"><Award className="mr-2 h-5 w-5 text-primary" />Reactions Received</CardTitle></CardHeader>
                <CardContent><p className="font-semibold text-lg">{profileUser.totalReactionsReceived || 0}</p></CardContent>
            </Card>
            
            {profileUser.aboutMe && (
              <Card className="md:col-span-2 lg:col-span-3 bg-background/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="mr-2 h-5 w-5 text-primary" /> About Me
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{profileUser.aboutMe}</p>
                </CardContent>
              </Card>
            )}
          </div>
          
          <div className="mt-8 border-t pt-6">
            <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium mb-3 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Recent Threads Started</h4>
                {isLoadingThreads ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : recentThreads.length > 0 ? (
                  <ul className="space-y-3">
                    {recentThreads.map(thread => (
                      <li key={thread.id} className="p-3 border rounded-md hover:bg-muted/30 transition-colors">
                        <Link href={`/forums/${thread.forumId}/threads/${thread.id}`} className="font-medium text-primary hover:underline block truncate" title={thread.title}>
                          {thread.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No recent threads started by this user.</p>
                )}
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3 flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary"/>Recent Posts</h4>
                {isLoadingPosts ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : recentPosts.length > 0 ? (
                  <ul className="space-y-3">
                    {recentPosts.map(post => {
                      // Construct the link using the fetched forumId for the post
                      const postLink = (post.forumId && post.forumId !== 'unknown')
                        ? `/forums/${post.forumId}/threads/${post.threadId}#post-${post.id}`
                        : `/forums/unknown/threads/${post.threadId}#post-${post.id}`; // Fallback if forumId still not found

                      return (
                        <li key={post.id} className="p-3 border rounded-md hover:bg-muted/30 transition-colors">
                          <Link href={postLink} className="text-sm text-primary hover:underline block truncate" title={post.content.substring(0, 100) + "..."}>
                            "{post.content.substring(0, 70)}{post.content.length > 70 ? '...' : ''}"
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Posted {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No recent posts by this user.</p>
                )}
              </div>
            </div>

          </div>

        </CardContent>
      </Card>
    </div>
  );
}
