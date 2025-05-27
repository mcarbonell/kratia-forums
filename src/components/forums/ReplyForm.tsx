
'use client';

import { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import type { Post as PostType, User as KratiaUser, Thread, Notification, UserNotificationPreferences } from '@/lib/types';
import { Loader2, Send, MessageSquare, XCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, Timestamp, writeBatch, increment, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { KRATIA_CONFIG } from '@/lib/config';

const replySchema = z.object({
  content: z.string().min(5, "Reply must be at least 5 characters long.").max(10000, "Reply content is too long."),
});

type ReplyFormData = z.infer<typeof replySchema>;

interface ReplyFormProps {
  threadId: string;
  forumId: string;
  onReplySuccess: (newPost: PostType) => void;
  onCancel?: () => void;
}

export default function ReplyForm({ threadId, forumId, onReplySuccess, onCancel }: ReplyFormProps) {
  const { user } = useMockAuth();
  const { toast } = useToast();
  const { t } = useTranslation('common');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
        content: "",
    }
  });

  if (!user || user.role === 'visitor' || user.role === 'guest') {
    return null;
  }

  const onSubmitHandler: SubmitHandler<ReplyFormData> = async (data) => {
    setIsSubmitting(true);
    if (!user) {
        toast({ title: t('common.error'), description: t('replyForm.toast.userNotLoggedIn'), variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    const authorInfo: Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl || "",
    };

    const now = Timestamp.fromDate(new Date());
    const newPostRef = doc(collection(db, "posts"));

    try {
      const batch = writeBatch(db);

      const newPostData: Omit<PostType, 'id'> = {
        threadId: threadId,
        author: authorInfo,
        content: data.content,
        createdAt: now.toDate().toISOString(),
        reactions: {},
      };
      batch.set(newPostRef, newPostData);

      const threadRef = doc(db, "threads", threadId);
      batch.update(threadRef, {
        postCount: increment(1),
        lastReplyAt: now.toDate().toISOString()
      });

      const forumRef = doc(db, "forums", forumId);
      batch.update(forumRef, {
        postCount: increment(1)
      });

      const replyAuthorUserRef = doc(db, "users", authorInfo.id);
      batch.update(replyAuthorUserRef, {
        karma: increment(1),
        totalPostsByUser: increment(1),
      });

      const threadDocSnap = await getDoc(threadRef);
      let threadData: Thread | null = null;
      if (threadDocSnap.exists()) {
        threadData = threadDocSnap.data() as Thread;
        const threadAuthorId = threadData.author.id;
        if (threadAuthorId && threadAuthorId !== authorInfo.id) {
            const threadAuthorUserRef = doc(db, "users", threadAuthorId);
            batch.update(threadAuthorUserRef, {
                karma: increment(1),
                totalPostsInThreadsStartedByUser: increment(1),
            });
        }
      } else {
        console.warn(`Thread ${threadId} not found when attempting to update thread author karma or send notification.`);
      }

      await batch.commit();

      // Notification logic
      if (threadData && threadData.author.id !== authorInfo.id) {
        const threadAuthorUserRef = doc(db, "users", threadData.author.id);
        const threadAuthorSnap = await getDoc(threadAuthorUserRef);
        if (threadAuthorSnap.exists()) {
          const threadAuthorData = threadAuthorSnap.data() as KratiaUser;
          const prefs = threadAuthorData.notificationPreferences;
          const shouldNotifyWeb = prefs?.newReplyToMyThread?.web ?? true; // Default to true if undefined

          if (shouldNotifyWeb) {
            const truncatedThreadTitle = threadData.title.length > 50
                ? `${threadData.title.substring(0, 47)}...`
                : threadData.title;

            const notificationData: Omit<Notification, 'id'> = {
                recipientId: threadData.author.id,
                actor: authorInfo,
                type: 'new_reply_to_your_thread',
                threadId: threadId,
                threadTitle: truncatedThreadTitle,
                postId: newPostRef.id,
                forumId: forumId,
                message: t('notifications.newReplyToYourThread', { actorName: authorInfo.username, threadTitle: truncatedThreadTitle }),
                link: `/forums/${forumId}/threads/${threadId}#post-${newPostRef.id}`,
                createdAt: now.toDate().toISOString(),
                isRead: false,
            };
            await addDoc(collection(db, "notifications"), notificationData);
          } else {
            console.log(`User ${threadData.author.username} has disabled web notifications for new replies.`);
          }
        }
      }

      toast({
        title: t('replyForm.toast.successTitle'),
        description: t('replyForm.toast.successDesc'),
      });

      onReplySuccess({ ...newPostData, id: newPostRef.id, createdAt: newPostData.createdAt });
      reset();

    } catch (error) {
      console.error("Error posting reply:", error);
      toast({
        title: t('common.error'),
        description: t('replyForm.toast.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const localizedReplySchema = z.object({
    content: z.string()
      .min(5, t('replyForm.validation.contentMinLength'))
      .max(10000, t('replyForm.validation.contentMaxLength')),
  });

  const { register: localizedRegister, handleSubmit: localizedHandleSubmit, formState: { errors: localizedErrors }, reset: localizedReset } = useForm<ReplyFormData>({
    resolver: zodResolver(localizedReplySchema),
    defaultValues: {
        content: "",
    }
  });


  return (
    <Card className="mt-8 shadow-lg border-t-2 border-primary/40">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
            <MessageSquare className="mr-3 h-6 w-6 text-primary"/>
            {t('replyForm.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={localizedHandleSubmit(onSubmitHandler)} className="space-y-6">
          <div>
            <Label htmlFor={`reply-content-${threadId}`} className="sr-only">{t('replyForm.contentLabel')}</Label>
            <Textarea
              id={`reply-content-${threadId}`}
              placeholder={t('replyForm.contentPlaceholder', { username: user.username })}
              rows={6}
              {...localizedRegister("content")}
              className={localizedErrors.content ? "border-destructive focus-visible:ring-destructive" : ""}
              disabled={isSubmitting}
            />
            {localizedErrors.content && <p className="text-sm text-muted-foreground mt-2">{localizedErrors.content.message}</p>}
          </div>
          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
            {onCancel && (
                 <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    <XCircle className="mr-2 h-4 w-4" />{t('common.cancelButton')}
                </Button>
            )}
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px] w-full sm:w-auto">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              {t('replyForm.submitButton')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
