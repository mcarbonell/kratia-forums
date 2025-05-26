
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useMockAuth } from '@/hooks/use-mock-auth';
import type { Forum, Thread, Post, User as KratiaUser, Poll, PollOption } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Edit3, Send, Frown, ListPlus, Ban } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, Timestamp, writeBatch, increment } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';


const newThreadSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters long.").max(150, "Title cannot exceed 150 characters."),
  content: z.string().min(10, "Your post content must be at least 10 characters long.").max(10000, "Post content is too long."),
  addPoll: z.boolean().optional(),
  pollQuestion: z.string().max(250, "Poll question cannot exceed 250 characters.").optional(),
  pollOption1: z.string().max(100, "Poll option cannot exceed 100 characters.").optional(),
  pollOption2: z.string().max(100, "Poll option cannot exceed 100 characters.").optional(),
  pollOption3: z.string().max(100, "Poll option cannot exceed 100 characters.").optional(),
  pollOption4: z.string().max(100, "Poll option cannot exceed 100 characters.").optional(),
}).superRefine((data, ctx) => {
  if (data.addPoll) {
    if (!data.pollQuestion || data.pollQuestion.trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Poll question must be at least 5 characters long.",
        path: ["pollQuestion"],
      });
    }
    const options = [data.pollOption1, data.pollOption2, data.pollOption3, data.pollOption4]
      .map(opt => opt?.trim())
      .filter(opt => opt && opt.length > 0);
    if (options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A poll must have at least 2 valid options.",
        path: ["pollOption1"], 
      });
    }
    options.forEach((opt, index) => {
      if (opt && opt.length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Option ${index + 1} cannot exceed 100 characters.`,
          path: [`pollOption${index + 1}` as keyof typeof data],
        });
      }
    });
  }
});

type NewThreadFormData = z.infer<typeof newThreadSchema>;

export default function NewThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  const forumId = params.forumId as string;
  const { t } = useTranslation('common');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forum, setForum] = useState<Forum | null>(null);
  const [isLoadingForum, setIsLoadingForum] = useState(true);
  const [forumError, setForumError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, watch, control } = useForm<NewThreadFormData>({
    resolver: zodResolver(newThreadSchema),
    defaultValues: {
      addPoll: false,
      pollQuestion: "",
      pollOption1: "",
      pollOption2: "",
      pollOption3: "",
      pollOption4: "",
    }
  });

  const addPollWatched = watch("addPoll");

  useEffect(() => {
    if (!forumId) {
      setForumError(t('newThreadPage.error.missingForumId'));
      setIsLoadingForum(false);
      return;
    }
    const fetchForum = async () => {
      setIsLoadingForum(true);
      setForumError(null);
      try {
        const forumRef = doc(db, "forums", forumId);
        const forumSnap = await getDoc(forumRef);
        if (forumSnap.exists()) {
          setForum({ id: forumSnap.id, ...forumSnap.data(), isPublic: forumSnap.data().isPublic === undefined ? true : forumSnap.data().isPublic } as Forum);
        } else {
          setForumError(t('newThreadPage.error.forumNotFound'));
        }
      } catch (err) {
        console.error("Error fetching forum for new thread page:", err);
        setForumError(t('newThreadPage.error.loadFail'));
      } finally {
        setIsLoadingForum(false);
      }
    };
    fetchForum();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forumId, t]); // Added t to dependencies


  if (authLoading || isLoadingForum) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!loggedInUser || loggedInUser.role === 'visitor' || loggedInUser.role === 'guest') {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>{t('newThreadPage.accessDenied.title')}</AlertTitle>
        <AlertDescription>
          {t('newThreadPage.accessDenied.mustBeLoggedIn')}
        </AlertDescription>
        <div className="mt-4">
          <Button asChild variant="outline" className="mr-2">
            <Link href="/auth/login">{t('login.loginButton')}</Link>
          </Button>
          <Button asChild>
            <Link href={`/forums/${forumId}`}>{t('newThreadPage.backToForumButton')}</Link>
          </Button>
        </div>
      </Alert>
    );
  }
  
  if (loggedInUser.status === 'under_sanction_process') {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Ban className="h-5 w-5" />
        <AlertTitle>{t('newThreadPage.restricted.title')}</AlertTitle>
        <AlertDescription>
          {t('newThreadPage.restricted.underSanction')}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href={`/forums/${forumId}`}>{t('newThreadPage.backToForumButton')}</Link>
        </Button>
      </Alert>
    );
  }

  if (loggedInUser.status === 'sanctioned') {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Ban className="h-5 w-5" />
        <AlertTitle>{t('newThreadPage.restricted.title')}</AlertTitle>
        <AlertDescription>
           {t('newThreadPage.restricted.sanctioned')}
        </AlertDescription>
        <Button asChild className="mt-4">
          <Link href={`/forums/${forumId}`}>{t('newThreadPage.backToForumButton')}</Link>
        </Button>
      </Alert>
    );
  }
  
  if (forumError || !forum) {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{forumError ? t('common.error') : t('newThreadPage.error.forumNotFoundTitle')}</AlertTitle>
        <AlertDescription>
          {forumError || t('newThreadPage.error.forumNotFoundDesc')}
        </AlertDescription>
         <Button asChild className="mt-4">
            <Link href="/forums">{t('newThreadPage.backToForumsListButton')}</Link>
          </Button>
      </Alert>
    );
  }


  const onSubmit: SubmitHandler<NewThreadFormData> = async (data) => {
    setIsSubmitting(true);
    if (!loggedInUser || !forum) { 
        toast({ title: t('common.error'), description: t('newThreadPage.toast.userOrForumNotFound'), variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const authorInfo: Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> = {
      id: loggedInUser.id,
      username: loggedInUser.username,
      avatarUrl: loggedInUser.avatarUrl || "",
    };

    const now = Timestamp.fromDate(new Date());

    let pollToSave: Poll | undefined = undefined;
    if (data.addPoll && data.pollQuestion) {
      const pollOptions: PollOption[] = [
        data.pollOption1,
        data.pollOption2,
        data.pollOption3,
        data.pollOption4,
      ]
      .map((optText, index) => ({
        id: `opt${index + 1}_${Date.now()}`, 
        text: optText?.trim() || '',
        voteCount: 0,
      }))
      .filter(opt => opt.text.length > 0);

      if (pollOptions.length >= 2) {
        pollToSave = {
          id: `poll_${Date.now()}`, 
          question: data.pollQuestion.trim(),
          options: pollOptions,
          totalVotes: 0,
          voters: {},
        };
      }
    }


    try {
      const batch = writeBatch(db);

      const newThreadRef = doc(collection(db, "threads"));
      const newThreadData: Omit<Thread, 'id'> = {
        forumId: forum.id,
        title: data.title,
        author: authorInfo,
        createdAt: now.toDate().toISOString(),
        lastReplyAt: now.toDate().toISOString(),
        postCount: 1,
        isSticky: false, 
        isLocked: false,
        isPublic: forum.isPublic === undefined ? true : forum.isPublic, 
        ...(pollToSave && { poll: pollToSave }), 
      };
      batch.set(newThreadRef, newThreadData);

      const newPostRef = doc(collection(db, "posts"));
      const initialPostData: Omit<Post, 'id'> = {
        threadId: newThreadRef.id,
        author: authorInfo,
        content: data.content,
        createdAt: now.toDate().toISOString(),
        reactions: {},
      };
      batch.set(newPostRef, initialPostData);

      const forumRef = doc(db, "forums", forum.id);
      batch.update(forumRef, {
        threadCount: increment(1),
        postCount: increment(1)
      });

      const userRef = doc(db, "users", authorInfo.id);
      batch.update(userRef, {
        karma: increment(2), 
        totalPostsByUser: increment(1),
        totalPostsInThreadsStartedByUser: increment(1),
        totalThreadsStartedByUser: increment(1) 
      });

      await batch.commit();

      toast({
        title: t('newThreadPage.toast.successTitle'),
        description: t('newThreadPage.toast.successDesc'),
      });
      reset();
      router.push(`/forums/${forum.id}/threads/${newThreadRef.id}`);

    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: t('common.error'),
        description: t('newThreadPage.toast.errorDesc'),
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
            <Edit3 className="mr-3 h-7 w-7 text-primary" />
            {t('newThreadPage.title', { forumName: forum.name })}
          </CardTitle>
          <CardDescription>
            {t('newThreadPage.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t('newThreadPage.form.titleLabel')}</Label>
              <Input
                id="title"
                type="text"
                placeholder={t('newThreadPage.form.titlePlaceholder')}
                {...register("title")}
                className={errors.title ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">{t('newThreadPage.form.postLabel')}</Label>
              <Textarea
                id="content"
                placeholder={t('newThreadPage.form.postPlaceholder')}
                rows={10}
                {...register("content")}
                className={errors.content ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
            </div>

            <Card className="bg-muted/30">
              <CardHeader className="p-4">
                <div className="flex items-center space-x-2">
                  <Controller
                    name="addPoll"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="addPoll"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                        ref={field.ref}
                      />
                    )}
                  />
                  <Label htmlFor="addPoll" className="font-medium text-base flex items-center">
                     <ListPlus className="mr-2 h-5 w-5 text-primary" /> {t('newThreadPage.form.addPollLabel')}
                  </Label>
                </div>
                <CardDescription className="pl-6 text-xs">{t('newThreadPage.form.addPollDesc')}</CardDescription>
              </CardHeader>
              {addPollWatched && (
                <CardContent className="space-y-4 p-4 pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="pollQuestion">{t('newThreadPage.form.pollQuestionLabel')}</Label>
                    <Input
                      id="pollQuestion"
                      placeholder={t('newThreadPage.form.pollQuestionPlaceholder')}
                      {...register("pollQuestion")}
                      className={errors.pollQuestion ? "border-destructive" : ""}
                      disabled={isSubmitting}
                    />
                    {errors.pollQuestion && <p className="text-sm text-destructive">{errors.pollQuestion.message}</p>}
                  </div>

                  {[1, 2, 3, 4].map(i => (
                    <div key={`pollOpt${i}`} className="space-y-1">
                      <Label htmlFor={`pollOption${i}`}>{t('newThreadPage.form.pollOptionLabel', { number: i })}{i > 2 ? ` (${t('common.optional')})` : ""}</Label>
                      <Input
                        id={`pollOption${i}`}
                        placeholder={t('newThreadPage.form.pollOptionPlaceholder', { number: i })}
                        {...register(`pollOption${i}` as keyof NewThreadFormData)}
                        className={errors?.[`pollOption${i}` as keyof typeof errors] ? "border-destructive" : ""}
                        disabled={isSubmitting}
                      />
                      {errors?.[`pollOption${i}` as keyof typeof errors] && <p className="text-sm text-destructive">{errors?.[`pollOption${i}` as keyof typeof errors]?.message}</p>}
                    </div>
                  ))}
                   {errors.pollOption1 && errors.pollOption1.message?.includes("at least 2 valid options") && <p className="text-sm text-destructive">{errors.pollOption1.message}</p>}
                </CardContent>
              )}
            </Card>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    {t('common.cancelButton')}
                </Button>
                <Button type="submit" disabled={isSubmitting || !loggedInUser || !forum} className="min-w-[120px]">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Send className="mr-2 h-4 w-4" />
                )}
                {t('newThreadPage.postThreadButton')}
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
    
