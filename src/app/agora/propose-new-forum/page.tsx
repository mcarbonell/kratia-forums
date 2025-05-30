
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import type { ForumCategory, Forum, Votation, Thread, Post, User as KratiaUser } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, Timestamp, writeBatch, increment } from 'firebase/firestore';
import { Loader2, ShieldAlert, PlusCircle, CornerUpLeft, Frown, Send } from 'lucide-react';
import { KRATIA_CONFIG } from '@/lib/config';

const AGORA_FORUM_ID = 'agora';

const proposeForumSchema = z.object({
  proposedForumName: z.string().min(3, "Forum name must be at least 3 characters.").max(100),
  proposedForumDescription: z.string().min(10, "Description must be at least 10 characters.").max(500),
  proposedForumCategoryId: z.string().min(1, "You must select a category."),
  proposedForumIsPublic: z.boolean().default(true),
  justification: z.string().min(20, "Justification must be at least 20 characters.").max(2000),
});

type ProposeForumFormData = z.infer<typeof proposeForumSchema>;

export default function ProposeNewForumPage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('common');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, control, reset } = useForm<ProposeForumFormData>({
    resolver: zodResolver(proposeForumSchema),
    defaultValues: {
      proposedForumIsPublic: true,
    },
  });

  const canPropose = loggedInUser && loggedInUser.canVote && loggedInUser.status === 'active';

  useEffect(() => {
    if (!canPropose) {
      setIsLoadingCategories(false);
      return;
    }
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const fetchedCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumCategory));
        setCategories(fetchedCategories);
        if (fetchedCategories.length === 0) {
          setPageError(t('proposeNewForum.error.noCategories'));
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setPageError(t('proposeNewForum.error.fetchCategoriesFail'));
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [canPropose, t]);

  if (authLoading || (canPropose && isLoadingCategories)) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canPropose) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('proposeNewForum.accessDenied.title')}</AlertTitle>
        <AlertDescription>{t('proposeNewForum.accessDenied.description')}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/forums"><CornerUpLeft className="mr-2 h-4 w-4" />{t('proposeNewForum.backToForumsButton')}</Link></Button>
      </Alert>
    );
  }

  if (pageError) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{t('common.error')}</AlertTitle>
        <AlertDescription>{pageError}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/forums"><CornerUpLeft className="mr-2 h-4 w-4" />{t('proposeNewForum.backToForumsButton')}</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<ProposeForumFormData> = async (data) => {
    if (!loggedInUser) {
      toast({ title: t('common.error'), description: t('proposeNewForum.toast.notLoggedIn'), variant: "destructive" });
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
    
    const selectedCategory = categories.find(c => c.id === data.proposedForumCategoryId);
    const selectedCategoryName = selectedCategory?.name || t('common.unknownCategory');

    const agoraThreadTitle = t('proposeNewForum.votationThreadTitlePrefix', { forumName: data.proposedForumName });
    const votationTitle = t('proposeNewForum.votationTitlePrefix', { forumName: data.proposedForumName });
    const votationDescription = t('proposeNewForum.votationDescription', { forumName: data.proposedForumName, categoryName: selectedCategoryName, justification: data.justification.substring(0,100) });

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
**${t('proposeNewForum.post.nameLabel')}:** ${data.proposedForumName}
**${t('proposeNewForum.post.categoryLabel')}:** ${selectedCategoryName}
**${t('proposeNewForum.post.descriptionLabel')}:** ${data.proposedForumDescription}
**${t('proposeNewForum.post.publicStatusLabel')}:** ${data.proposedForumIsPublic ? t('common.public') : t('common.private')}

**${t('proposeNewForum.post.justificationLabel', { username: loggedInUser.username })}:**
${data.justification}

---
${t('proposeNewForum.post.subjectToVote')}
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
        title: votationTitle,
        description: votationDescription,
        justification: data.justification,
        proposerId: loggedInUser.id,
        proposerUsername: loggedInUser.username,
        type: 'new_forum_proposal',
        createdAt: now.toDate().toISOString(),
        deadline: deadlineDate.toISOString(),
        status: 'active',
        options: { for: 0, against: 0, abstain: 0 },
        voters: {},
        totalVotesCast: 0,
        quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
        relatedThreadId: newAgoraThreadRef.id,
        proposedForumName: data.proposedForumName,
        proposedForumDescription: data.proposedForumDescription,
        proposedForumCategoryId: data.proposedForumCategoryId,
        proposedForumCategoryName: selectedCategoryName,
        proposedForumIsPublic: data.proposedForumIsPublic,
      };
      batch.set(newVotationRef, votationData);

      await batch.commit();

      toast({
        title: t('proposeNewForum.toast.success.title'),
        description: t('proposeNewForum.toast.success.description', { forumName: data.proposedForumName }),
      });
      reset();
      router.push(`/forums/${AGORA_FORUM_ID}/threads/${newAgoraThreadRef.id}`);

    } catch (error) {
      console.error("Error proposing new forum:", error);
      toast({
        title: t('common.error'),
        description: t('proposeNewForum.toast.error.description'),
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
            <PlusCircle className="mr-3 h-7 w-7 text-primary" />
            {t('proposeNewForum.pageTitle')}
          </CardTitle>
          <CardDescription>
            {t('proposeNewForum.pageDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="proposedForumName">{t('proposeNewForum.form.nameLabel')}</Label>
              <Input
                id="proposedForumName"
                placeholder={t('proposeNewForum.form.namePlaceholder')}
                {...register("proposedForumName")}
                className={errors.proposedForumName ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.proposedForumName && <p className="text-sm text-destructive">{errors.proposedForumName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposedForumDescription">{t('proposeNewForum.form.descriptionLabel')}</Label>
              <Textarea
                id="proposedForumDescription"
                placeholder={t('proposeNewForum.form.descriptionPlaceholder')}
                rows={3}
                {...register("proposedForumDescription")}
                className={errors.proposedForumDescription ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.proposedForumDescription && <p className="text-sm text-destructive">{errors.proposedForumDescription.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposedForumCategoryId">{t('proposeNewForum.form.categoryLabel')}</Label>
              <Controller
                name="proposedForumCategoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting || categories.length === 0}
                  >
                    <SelectTrigger className={errors.proposedForumCategoryId ? "border-destructive" : ""}>
                      <SelectValue placeholder={t('proposeNewForum.form.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.proposedForumCategoryId && <p className="text-sm text-destructive">{errors.proposedForumCategoryId.message}</p>}
            </div>
            
            <div className="flex items-center space-x-2">
              <Controller
                name="proposedForumIsPublic"
                control={control}
                render={({ field }) => (
                    <Checkbox
                        id="proposedForumIsPublic"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                        ref={field.ref}
                    />
                )}
               />
              <Label htmlFor="proposedForumIsPublic" className="font-normal">
                {t('proposeNewForum.form.publicLabel')}
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">{t('proposeNewForum.form.justificationLabel')}</Label>
              <Textarea
                id="justification"
                placeholder={t('proposeNewForum.form.justificationPlaceholder')}
                rows={5}
                {...register("justification")}
                className={errors.justification ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.justification && <p className="text-sm text-destructive">{errors.justification.message}</p>}
            </div>

            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{t('proposeNewForum.importantNotice.title')}</AlertTitle>
              <AlertDescription>
                {t('proposeNewForum.importantNotice.description')}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                <CornerUpLeft className="mr-2 h-4 w-4" /> {t('common.cancelButton')}
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting || categories.length === 0} className="min-w-[200px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isSubmitting ? t('proposeNewForum.submittingButton') : t('proposeNewForum.submitButton')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

