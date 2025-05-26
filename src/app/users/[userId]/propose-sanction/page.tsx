
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMockAuth } from '@/hooks/use-mock-auth';
import type { User as KratiaUser, Thread, Post, Votation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Frown, CornerUpLeft, Send, Ban } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, Timestamp, writeBatch, increment } from 'firebase/firestore';
import { KRATIA_CONFIG } from '@/lib/config';
import { useTranslation } from 'react-i18next';

const AGORA_FORUM_ID = 'agora';

const sanctionProposalSchema = z.object({
  duration: z.string().min(3, "Sanction duration must be specified (e.g., '7 days', '1 month').").max(50),
  justification: z.string().min(50, "Justification must be at least 50 characters long.").max(5000, "Justification is too long."),
});

type SanctionProposalFormData = z.infer<typeof sanctionProposalSchema>;

export default function ProposeSanctionPage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  const { t } = useTranslation('common');
  const targetUserId = params.userId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetUser, setTargetUser] = useState<KratiaUser | null>(null);
  const [isLoadingTargetUser, setIsLoadingTargetUser] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SanctionProposalFormData>({
    resolver: zodResolver(sanctionProposalSchema),
  });

  useEffect(() => {
    if (!targetUserId) {
      setPageError(t('proposeSanction.error.missingTargetId'));
      setIsLoadingTargetUser(false);
      return;
    }
    const fetchTargetUser = async () => {
      setIsLoadingTargetUser(true);
      setPageError(null);
      try {
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setTargetUser({ id: userSnap.id, ...userSnap.data() } as KratiaUser);
        } else {
          setPageError(t('proposeSanction.error.targetUserNotFound'));
        }
      } catch (err) {
        console.error("Error fetching target user for sanction proposal:", err);
        setPageError(t('proposeSanction.error.loadTargetUserFail'));
      } finally {
        setIsLoadingTargetUser(false);
      }
    };
    fetchTargetUser();
  }, [targetUserId, t]);

  if (authLoading || isLoadingTargetUser) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (pageError || !targetUser) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{pageError ? t('common.error') : t('proposeSanction.error.targetUserNotFoundTitle')}</AlertTitle>
        <AlertDescription>{pageError || t('proposeSanction.error.targetUserNotFoundDesc')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/"><CornerUpLeft className="mr-2 h-4 w-4" />{t('common.backToHomepageButton')}</Link></Button>
      </Alert>
    );
  }

  if (!loggedInUser || loggedInUser.role === 'visitor' || loggedInUser.role === 'guest' || !loggedInUser.canVote || (loggedInUser.status !== 'active')) {
    let description = t('proposeSanction.accessDenied.generic');
    if (loggedInUser) {
        if (loggedInUser.status === 'under_sanction_process') {
        description = t('proposeSanction.accessDenied.underSanction');
        } else if (loggedInUser.status === 'sanctioned') {
        description = t('proposeSanction.accessDenied.sanctioned');
        } else if (!loggedInUser.canVote) {
        description = t('proposeSanction.accessDenied.noVotingRights');
        }
    }

    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('proposeSanction.accessDenied.title')}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
        <Button asChild className="mt-4"><Link href={`/profile/${targetUserId}`}><CornerUpLeft className="mr-2 h-4 w-4" />{t('profileView.backToProfileButton')}</Link></Button>
      </Alert>
    );
  }

  if (loggedInUser.id === targetUser.id) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('proposeSanction.error.cannotSanctionSelfTitle')}</AlertTitle>
        <AlertDescription>{t('proposeSanction.error.cannotSanctionSelfDesc')}</AlertDescription>
         <Button asChild className="mt-4"><Link href="/"><CornerUpLeft className="mr-2 h-4 w-4" />{t('common.backToHomepageButton')}</Link></Button>
      </Alert>
    );
  }
  
  if (targetUser.status === 'sanctioned' || targetUser.status === 'under_sanction_process') {
     return (
      <Alert variant="default" className="max-w-lg mx-auto border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 [&>svg]:text-amber-600">
        <Ban className="h-5 w-5" />
        <AlertTitle>{t('proposeSanction.error.userStatusTitle')}</AlertTitle>
        <AlertDescription>
          {targetUser.status === 'sanctioned' ? t('proposeSanction.error.userAlreadySanctioned') : t('proposeSanction.error.userUnderSanctionProcess')}
        </AlertDescription>
        <Button asChild className="mt-4"><Link href={`/profile/${targetUserId}`}><CornerUpLeft className="mr-2 h-4 w-4" />{t('profileView.backToProfileButton')}</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<SanctionProposalFormData> = async (data) => {
    setIsSubmitting(true);
    if (!loggedInUser || !targetUser) {
      toast({ title: t('common.error'), description: t('proposeSanction.toast.userNotFoundOnSubmit'), variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const proposerAuthorInfo = { id: loggedInUser.id, username: loggedInUser.username, avatarUrl: loggedInUser.avatarUrl || "" };
    const now = Timestamp.now();
    const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const votationTitle = t('proposeSanction.votationTitle', { duration: data.duration, username: targetUser.username });
    
    try {
      const batch = writeBatch(db);
      
      const newVotationRef = doc(collection(db, "votations"));

      const newAgoraThreadRef = doc(collection(db, "threads"));
      const agoraThreadData: Omit<Thread, 'id'> & { relatedVotationId: string } = {
        forumId: AGORA_FORUM_ID,
        title: votationTitle,
        author: proposerAuthorInfo,
        createdAt: now.toDate().toISOString(),
        lastReplyAt: now.toDate().toISOString(),
        postCount: 1,
        isPublic: true, 
        relatedVotationId: newVotationRef.id, 
      };
      batch.set(newAgoraThreadRef, agoraThreadData);

      const newPostRef = doc(collection(db, "posts"));
      const initialPostData: Omit<Post, 'id'> = {
        threadId: newAgoraThreadRef.id,
        author: proposerAuthorInfo,
        content: t('proposeSanction.initialPostContent', { username: targetUser.username, duration: data.duration, justification: data.justification }),
        createdAt: now.toDate().toISOString(),
        reactions: {},
      };
      batch.set(newPostRef, initialPostData);
      
      const agoraForumRef = doc(db, "forums", AGORA_FORUM_ID);
      batch.update(agoraForumRef, {
        threadCount: increment(1),
        postCount: increment(1),
      });
       batch.update(doc(db, "users", loggedInUser.id), {
        karma: increment(2), 
        totalPostsByUser: increment(1),
        totalPostsInThreadsStartedByUser: increment(1),
        totalThreadsStartedByUser: increment(1)
      });

      const votationData: Votation = {
        id: newVotationRef.id,
        title: votationTitle,
        description: t('proposeSanction.votationDescription', { username: targetUser.username, duration: data.duration }),
        justification: data.justification,
        proposerId: loggedInUser.id,
        proposerUsername: loggedInUser.username,
        type: 'sanction',
        createdAt: now.toDate().toISOString(),
        deadline: deadlineDate.toISOString(),
        status: 'active',
        targetUserId: targetUser.id,
        targetUsername: targetUser.username,
        sanctionDuration: data.duration,
        options: { for: 0, against: 0, abstain: 0 },
        voters: {},
        totalVotesCast: 0,
        quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
        relatedThreadId: newAgoraThreadRef.id, 
      };
      batch.set(newVotationRef, votationData);
      
      const targetUserRef = doc(db, "users", targetUser.id);
      batch.update(targetUserRef, { status: 'under_sanction_process' });

      await batch.commit();

      toast({
        title: t('proposeSanction.toast.successTitle'),
        description: t('proposeSanction.toast.successDesc', { username: targetUser.username }),
      });
      reset();
      router.push(`/forums/${AGORA_FORUM_ID}/threads/${newAgoraThreadRef.id}`);

    } catch (error) {
      console.error("Error proposing sanction:", error);
      toast({
        title: t('common.error'),
        description: t('proposeSanction.toast.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
            <Ban className="mr-3 h-7 w-7 text-destructive" />
            {t('proposeSanction.pageTitle', { username: targetUser.username })}
          </CardTitle>
          <CardDescription>
            {t('proposeSanction.pageDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="duration">{t('proposeSanction.form.durationLabel')}</Label>
              <Input
                id="duration"
                type="text"
                placeholder={t('proposeSanction.form.durationPlaceholder')}
                {...register("duration")}
                className={errors.duration ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.duration && <p className="text-sm text-destructive">{errors.duration.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">{t('proposeSanction.form.justificationLabel')}</Label>
              <Textarea
                id="justification"
                placeholder={t('proposeSanction.form.justificationPlaceholder')}
                rows={10}
                {...register("justification")}
                className={errors.justification ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.justification && <p className="text-sm text-destructive">{errors.justification.message}</p>}
            </div>
            
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{t('proposeSanction.importantNotice.title')}</AlertTitle>
              <AlertDescription>
                {t('proposeSanction.importantNotice.description', { username: targetUser.username })}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    {t('common.cancelButton')}
                </Button>
                <Button type="submit" variant="destructive" disabled={isSubmitting} className="min-w-[180px]">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Send className="mr-2 h-4 w-4" />
                )}
                {t('proposeSanction.submitButton')}
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

    