
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
import type { Post as PostType, User as KratiaUser } from '@/lib/types'; // Renamed User
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, Timestamp, writeBatch, increment, serverTimestamp } from 'firebase/firestore';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
        content: "",
    }
  });

  if (!user || user.role === 'visitor' || user.role === 'guest') {
    // This state should ideally be handled by the parent component hiding this form
    return null; 
  }

  const onSubmitHandler: SubmitHandler<ReplyFormData> = async (data) => {
    setIsSubmitting(true);
    if (!user) { // Should be caught, but for TS safety
        toast({ title: "Error", description: "User not logged in.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    const authorInfo = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl || "",
    };
    
    const now = Timestamp.fromDate(new Date()); // Use Firestore Timestamp

    try {
      const batch = writeBatch(db);

      // 1. Create New Post
      const newPostRef = doc(collection(db, "posts")); // Auto-generate ID
      const newPostData: Omit<PostType, 'id'> = { // Omit id as Firestore generates it
        threadId: threadId,
        author: authorInfo,
        content: data.content,
        createdAt: now.toDate().toISOString(), // Store as ISO string for consistency with type
        reactions: [],
      };
      batch.set(newPostRef, newPostData);

      // 2. Update Thread (postCount, lastReplyAt)
      const threadRef = doc(db, "threads", threadId);
      batch.update(threadRef, {
        postCount: increment(1),
        lastReplyAt: now // Firestore will convert this to its Timestamp type
      });

      // 3. Update Forum (postCount)
      const forumRef = doc(db, "forums", forumId);
      batch.update(forumRef, {
        postCount: increment(1)
      });

      await batch.commit();
      
      toast({
        title: "Reply Posted!",
        description: "Your reply has been added to the thread.",
      });
      
      // Pass the full new post data (with generated ID) to the callback
      onReplySuccess({ ...newPostData, id: newPostRef.id, createdAt: newPostData.createdAt });
      reset(); // Clear the form

    } catch (error) {
      console.error("Error posting reply:", error);
      toast({
        title: "Error",
        description: "Failed to post reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-8 shadow-lg border-t-2 border-primary/40">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
            <MessageSquare className="mr-3 h-6 w-6 text-primary"/>
            Post Your Reply
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-6">
          <div>
            <Label htmlFor={`reply-content-${threadId}`} className="sr-only">Your Reply</Label>
            <Textarea
              id={`reply-content-${threadId}`}
              placeholder={`Share your thoughts, ${user.username}...`}
              rows={6}
              {...register("content")}
              className={errors.content ? "border-destructive focus-visible:ring-destructive" : ""}
              disabled={isSubmitting}
            />
            {errors.content && <p className="text-sm text-destructive mt-2">{errors.content.message}</p>}
          </div>
          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
            {onCancel && (
                 <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
            )}
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px] w-full sm:w-auto">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              Post Reply
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
