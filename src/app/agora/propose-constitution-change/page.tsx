
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import type { User as KratiaUser, Thread, Post, Votation, SiteSettings } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, Timestamp, writeBatch, increment } from 'firebase/firestore';
import { Loader2, ShieldAlert, FileText, CornerUpLeft, Send, Frown } from 'lucide-react';
import { KRATIA_CONFIG } from '@/lib/config';

const AGORA_FORUM_ID = 'agora';

const constitutionProposalSchema = z.object({
  proposalTitle: z.string().min(10, "Proposal title must be at least 10 characters.").max(150, "Proposal title cannot exceed 150 characters."),
  justification: z.string().min(50, "Justification must be at least 50 characters long.").max(5000, "Justification is too long."),
  proposedConstitutionText: z.string().min(100, "Proposed constitution text must be substantial."), 
});

type ConstitutionProposalFormData = z.infer<typeof constitutionProposalSchema>;

export default function ProposeConstitutionChangePage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('common');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentConstitution, setCurrentConstitution] = useState<string | null>(null);
  const [isLoadingConstitution, setIsLoadingConstitution] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ConstitutionProposalFormData>({
    resolver: zodResolver(constitutionProposalSchema),
  });

  useEffect(() => {
    const fetchCurrentConstitution = async () => {
      setIsLoadingConstitution(true);
      try {
        const constitutionRef = doc(db, "site_settings", "constitution");
        const docSnap = await getDoc(constitutionRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as SiteSettings;
          const text = data.constitutionText || "";
          setCurrentConstitution(text);
          setValue("proposedConstitutionText", text); 
        } else {
          setPageError(t('proposeConstitution.error.notFound'));
          setCurrentConstitution("");
        }
      } catch (err) {
        console.error("Error fetching current constitution:", err);
        setPageError(t('proposeConstitution.error.loadFail'));
        setCurrentConstitution("");
      } finally {
        setIsLoadingConstitution(false);
      }
    };
    fetchCurrentConstitution();
  }, [setValue, t]);

  const canPropose = loggedInUser && loggedInUser.canVote && loggedInUser.status === 'active';

  if (authLoading || isLoadingConstitution) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canPropose) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('proposeConstitution.accessDenied.title')}</AlertTitle>
        <AlertDescription>{t('proposeConstitution.accessDenied.description')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/agora"><CornerUpLeft className="mr-2 h-4 w-4" />{t('proposeConstitution.backToAgoraButton')}</Link></Button>
      </Alert>
    );
  }

  if (pageError) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{t('common.error')}</AlertTitle>
        <AlertDescription>{pageError}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/agora"><CornerUpLeft className="mr-2 h-4 w-4" />{t('proposeConstitution.backToAgoraButton')}</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<ConstitutionProposalFormData> = async (data) => {
    if (!loggedInUser) {
      toast({ title: t('common.error'), description: t('proposeConstitution.toast.notLoggedIn'), variant: "destructive" });
      return;
    }
    if (data.proposedConstitutionText.trim() === (currentConstitution || "").trim()) {
      toast({ title: t('proposeConstitution.toast.noChanges.title'), description: t('proposeConstitution.toast.noChanges.description'), variant: "default" });
      return;
    }
    setIsSubmitting(true);

    const proposerAuthorInfo: Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> = {
      id: loggedInUser.id,
      username: loggedInUser.username,
      avatarUrl: loggedInUser.avatarUrl || "",
    };
    const now = Timestamp.now();
    const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const agoraThreadTitle = t('proposeConstitution.votationThreadTitlePrefix') + data.proposalTitle;

    try {
      const batch = writeBatch(db);
      const newVotationRef = doc(collection(db, "votations"));
      const newAgoraThreadRef = doc(collection(db, "threads"));
      const newPostRef = doc(collection(db, "posts")); 

      const agoraThreadData: Omit<Thread, 'id'> & { relatedVotationId: string } = {
        forumId: AGORA_FORUM_ID,
        title: agoraThreadTitle,
        author: proposerAuthorInfo,
        createdAt: now.toDate().toISOString(),
        lastReplyAt: now.toDate().toISOString(),
        postCount: 1,
        isPublic: true,
        relatedVotationId: newVotationRef.id,
      };
      batch.set(newAgoraThreadRef, agoraThreadData);

      const initialPostContent = `
**${t('proposeConstitution.post.proposalTitleLabel')}:** ${data.proposalTitle}

**${t('proposeConstitution.post.justificationLabel')}:**
${data.justification}

---
**${t('proposeConstitution.post.proposedTextLabel')}:**
*(Please review the complete text below for the proposed changes)*
\n\n
${data.proposedConstitutionText}
      `;
      const initialPostData: Omit<Post, 'id'> = {
        threadId: newAgoraThreadRef.id,
        author: proposerAuthorInfo,
        content: initialPostContent.trim(),
        createdAt: now.toDate().toISOString(),
        reactions: {},
      };
      batch.set(newPostRef, initialPostData); 

      const agoraForumRef = doc(db, "forums", AGORA_FORUM_ID);
      batch.update(agoraForumRef, { threadCount: increment(1), postCount: increment(1) });
      batch.update(doc(db, "users", loggedInUser.id), { 
        karma: increment(2), 
        totalPostsByUser: increment(1),
        totalPostsInThreadsStartedByUser: increment(1),
        totalThreadsStartedByUser: increment(1) 
      });

      const votationData: Votation = {
        id: newVotationRef.id,
        title: agoraThreadTitle,
        description: t('proposeConstitution.votationDescription', {justification: data.justification.substring(0, 100)}),
        justification: data.justification,
        proposerId: loggedInUser.id,
        proposerUsername: loggedInUser.username,
        type: 'rule_change', 
        createdAt: now.toDate().toISOString(),
        deadline: deadlineDate.toISOString(),
        status: 'active',
        options: { for: 0, against: 0, abstain: 0 },
        voters: {},
        totalVotesCast: 0,
        quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
        relatedThreadId: newAgoraThreadRef.id,
        proposedConstitutionText: data.proposedConstitutionText,
      };
      batch.set(newVotationRef, votationData);

      await batch.commit();

      toast({
        title: t('proposeConstitution.toast.success.title'),
        description: t('proposeConstitution.toast.success.description', { proposalTitle: data.proposalTitle }),
      });
      reset();
      router.push(`/forums/${AGORA_FORUM_ID}/threads/${newAgoraThreadRef.id}`);

    } catch (error) {
      console.error("Error proposing constitution change:", error);
      toast({
        title: t('common.error'),
        description: t('proposeConstitution.toast.error.description'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
            <FileText className="mr-3 h-7 w-7 text-primary" />
            {t('proposeConstitution.pageTitle')}
          </CardTitle>
          <CardDescription>
            {t('proposeConstitution.pageDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="proposalTitle">{t('proposeConstitution.form.proposalTitleLabel')}</Label>
              <Input
                id="proposalTitle"
                placeholder={t('proposeConstitution.form.proposalTitlePlaceholder')}
                {...register("proposalTitle")}
                className={errors.proposalTitle ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.proposalTitle && <p className="text-sm text-destructive">{errors.proposalTitle.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">{t('proposeConstitution.form.justificationLabel')}</Label>
              <Textarea
                id="justification"
                placeholder={t('proposeConstitution.form.justificationPlaceholder')}
                rows={5}
                {...register("justification")}
                className={errors.justification ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.justification && <p className="text-sm text-destructive">{errors.justification.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposedConstitutionText">{t('proposeConstitution.form.proposedTextLabel')}</Label>
              <Textarea
                id="proposedConstitutionText"
                placeholder={t('proposeConstitution.form.proposedTextPlaceholder')}
                rows={20}
                {...register("proposedConstitutionText")}
                className={errors.proposedConstitutionText ? "border-destructive" : ""}
                disabled={isSubmitting || isLoadingConstitution}
              />
              {errors.proposedConstitutionText && <p className="text-sm text-destructive">{errors.proposedConstitutionText.message}</p>}
              <p className="text-xs text-muted-foreground">
                {t('proposeConstitution.form.proposedTextHelp')}
              </p>
            </div>

            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{t('proposeConstitution.importantNotice.title')}</AlertTitle>
              <AlertDescription>
                {t('proposeConstitution.importantNotice.description')}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                <CornerUpLeft className="mr-2 h-4 w-4" /> {t('common.cancelButton')}
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting || isLoadingConstitution} className="min-w-[200px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isSubmitting ? t('proposeConstitution.submittingButton') : t('proposeConstitution.submitButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
    
