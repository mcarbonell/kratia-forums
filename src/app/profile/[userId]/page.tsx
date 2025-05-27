
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { User as UserIcon, CalendarDays, Award, MapPin, FileText, Loader2, Frown, Edit, ShieldAlert, Ban, MessageSquare, ListChecks, Send } from "lucide-react"; // Added Send
import UserAvatar from "@/components/user/UserAvatar";
import type { User as KratiaUser, Thread, Post } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { es as esLocale } from 'date-fns/locale/es';
import { enUS as enUSLocale } from 'date-fns/locale/en-US';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { KRATIA_CONFIG } from '@/lib/config';
import { useTranslation } from 'react-i18next';
import SendMessageDialog from '@/components/messages/SendMessageDialog'; // New

const formatFirestoreTimestampToReadable = (timestamp: any, currentLang: string): string | undefined => {
  if (!timestamp) return undefined;
  const locale = currentLang.startsWith('es') ? esLocale : enUSLocale;
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return format(d, "PPPp", { locale });
    return undefined;
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return format(timestamp.toDate(), "PPPp", { locale });
  }
  if (timestamp instanceof Date) {
    return format(timestamp, "PPPp", { locale });
  }
  return undefined;
};

type PostWithForumId = Post & { forumId?: string };

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const userId = params.userId as string;
  const { t, i18n } = useTranslation('common');

  const [profileUser, setProfileUser] = useState<KratiaUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recentThreads, setRecentThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  
  const [recentPosts, setRecentPosts] = useState<PostWithForumId[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  const [isSendMessageDialogOpen, setIsSendMessageDialogOpen] = useState(false); // New


  useEffect(() => {
    if (!userId) {
      setError(t('profileView.error.missingId'));
      setIsLoading(false);
      return;
    }

    const fetchUserProfileAndActivity = async () => {
      setIsLoading(true);
      setError(null);
      setRecentThreads([]);
      setRecentPosts([]);
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = { id: userSnap.id, ...userSnap.data(), status: userSnap.data().status || 'active' } as KratiaUser;
          setProfileUser(userData);

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

          setIsLoadingPosts(true);
          const postsQuery = query(
            collection(db, "posts"),
            where("author.id", "==", userId),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const postsSnapshot = await getDocs(postsQuery);
          const fetchedPosts = postsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Post));
          
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
              return { ...p, forumId: fetchedForumId };
            })
          );
          setRecentPosts(postsWithForumData);
          setIsLoadingPosts(false);

        } else {
          setError(t('profileView.error.userNotFound'));
          setProfileUser(null);
        }
      } catch (err) {
        console.error("Error fetching user profile or activity:", err);
        setError(t('profileView.error.loadFail'));
        setProfileUser(null);
        setIsLoadingThreads(false);
        setIsLoadingPosts(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfileAndActivity();
  }, [userId, t]);

  const timeAgo = (dateString?: string) => {
    if (!dateString) return t('common.time.someTimeAgo');
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return t('common.time.invalidDate');
        return formatDistanceToNow(date, { 
            addSuffix: true,
            locale: i18n.language.startsWith('es') ? esLocale : enUSLocale
        });
    } catch (e) {
        return t('common.time.aWhileBack');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('profileView.loadingProfile')}</p>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{error ? t('profileView.error.errorTitle') : t('profileView.error.notFoundTitle')}</AlertTitle>
        <AlertDescription>
          {error || t('profileView.error.genericNotFound')}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href="/">{t('profileView.goToHomepageButton')}</Link>
        </Button>
      </Alert>
    );
  }
  
  const registrationDateFormatted = profileUser.registrationDate 
    ? timeAgo(profileUser.registrationDate)
    : t('profileView.unknown');

  const sanctionEndDateFormatted = profileUser.sanctionEndDate
    ? formatFirestoreTimestampToReadable(profileUser.sanctionEndDate, i18n.language)
    : t('profileView.notApplicable');

  const isOwnProfile = loggedInUser?.id === profileUser.id;
  const canProposeSanction = loggedInUser && 
                            loggedInUser.id !== profileUser.id &&
                            loggedInUser.canVote &&
                            loggedInUser.status === 'active' &&
                            profileUser.status !== 'sanctioned' &&
                            profileUser.status !== 'under_sanction_process';
  const canSendMessage = loggedInUser && loggedInUser.id !== profileUser.id && loggedInUser.role !== 'visitor' && loggedInUser.role !== 'guest'; // New


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <UserIcon className="mr-3 h-8 w-8 text-primary" />
          {t('profileView.title', { username: profileUser.username })}
        </h1>
        <div className="flex flex-wrap gap-2"> {/* Changed to flex-wrap */}
          {isOwnProfile && (
            <Button variant="outline" asChild>
              <Link href={`/profile/edit`}> 
                <Edit className="mr-2 h-4 w-4" /> {t('profileView.editProfileButton')}
              </Link>
            </Button>
          )}
          {canProposeSanction && (
            <Button variant="destructive" asChild>
              <Link href={`/users/${profileUser.id}/propose-sanction`}>
                <ShieldAlert className="mr-2 h-4 w-4" /> {t('profileView.proposeSanctionButton')}
              </Link>
            </Button>
          )}
          {canSendMessage && ( // New Send Message Button
            <Button variant="default" onClick={() => setIsSendMessageDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" /> {t('profileView.sendMessageButton')}
            </Button>
          )}
        </div>
      </div>

      {profileUser.status === 'under_sanction_process' && (
        <Alert variant="destructive">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>{t('profileView.status.underSanctionTitle')}</AlertTitle>
          <AlertDescription>
            {t('profileView.status.underSanctionDesc')}
          </AlertDescription>
        </Alert>
      )}
       {profileUser.status === 'sanctioned' && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
          <Ban className="h-5 w-5" />
          <AlertTitle>{t('profileView.status.sanctionedTitle')}</AlertTitle>
          <AlertDescription>
            {t('profileView.status.sanctionedDesc')}
            {profileUser.sanctionEndDate && ` ${t('profileView.status.sanctionEnds')}: ${sanctionEndDateFormatted}`}
          </AlertDescription>
        </Alert>
      )}


      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 p-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <UserAvatar user={profileUser} size="lg" className="flex-shrink-0 border-2 border-primary shadow-md" />
          <div className="flex-grow">
            <CardTitle className="text-3xl font-semibold">{profileUser.username}</CardTitle>
            <CardDescription className="text-md mt-1">
              {profileUser.email} {profileUser.role && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2 capitalize">{t(`roles.${profileUser.role.replace('_', '')}` as any, profileUser.role.replace('_', ' '))}</span>}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <CalendarDays className="mr-2 h-5 w-5 text-primary" /> {t('profileView.memberSince')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{registrationDateFormatted}</p>
              </CardContent>
            </Card>

            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Award className="mr-2 h-5 w-5 text-primary" /> {t('profileView.karma')}
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
                    <MapPin className="mr-2 h-5 w-5 text-primary" /> {t('profileView.location')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{profileUser.location}</p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-background/50">
                <CardHeader><CardTitle className="text-lg flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary" />{t('profileView.totalPosts')}</CardTitle></CardHeader>
                <CardContent><p className="font-semibold text-lg">{profileUser.totalPostsByUser || 0}</p></CardContent>
            </Card>
            <Card className="bg-background/50">
                <CardHeader><CardTitle className="text-lg flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />{t('profileView.threadsStarted')}</CardTitle></CardHeader>
                <CardContent><p className="font-semibold text-lg">{profileUser.totalThreadsStartedByUser || 0}</p></CardContent>
            </Card>
             <Card className="bg-background/50">
                <CardHeader><CardTitle className="text-lg flex items-center"><Award className="mr-2 h-5 w-5 text-primary" />{t('profileView.reactionsReceived')}</CardTitle></CardHeader>
                <CardContent><p className="font-semibold text-lg">{profileUser.totalReactionsReceived || 0}</p></CardContent>
            </Card>
            
            {profileUser.aboutMe && (
              <Card className="md:col-span-2 lg:col-span-3 bg-background/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="mr-2 h-5 w-5 text-primary" /> {t('profileView.aboutMe')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{profileUser.aboutMe}</p>
                </CardContent>
              </Card>
            )}
          </div>
          
          <div className="mt-8 border-t pt-6">
            <h3 className="text-xl font-semibold mb-4">{t('profileView.recentActivity.title')}</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-medium mb-3 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>{t('profileView.recentActivity.threadsTitle')}</h4>
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
                          {t('profileView.recentActivity.created')} {timeAgo(thread.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t('profileView.recentActivity.noThreads')}</p>
                )}
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3 flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary"/>{t('profileView.recentActivity.postsTitle')}</h4>
                {isLoadingPosts ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : recentPosts.length > 0 ? (
                  <ul className="space-y-3">
                    {recentPosts.map(post => {
                      const postLink = (post.forumId && post.forumId !== 'unknown' && post.threadId) 
                        ? `/forums/${post.forumId}/threads/${post.threadId}#post-${post.id}`
                        : (post.threadId ? `/forums/unknown/threads/${post.threadId}#post-${post.id}` : '#'); 

                      return (
                        <li key={post.id} className="p-3 border rounded-md hover:bg-muted/30 transition-colors">
                          <Link href={postLink} className="text-sm text-primary hover:underline block truncate" title={post.content.substring(0, 100) + "..."}>
                            "{post.content.substring(0, 70)}{post.content.length > 70 ? '...' : ''}"
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('profileView.recentActivity.posted')} {timeAgo(post.createdAt)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t('profileView.recentActivity.noPosts')}</p>
                )}
              </div>
            </div>

          </div>

        </CardContent>
      </Card>

      {profileUser && loggedInUser && ( // New SendMessageDialog integration
        <SendMessageDialog
          isOpen={isSendMessageDialogOpen}
          onOpenChange={setIsSendMessageDialogOpen}
          recipient={{ id: profileUser.id, username: profileUser.username, avatarUrl: profileUser.avatarUrl }}
          sender={{ id: loggedInUser.id, username: loggedInUser.username, avatarUrl: loggedInUser.avatarUrl }}
        />
      )}
    </div>
  );
}

    