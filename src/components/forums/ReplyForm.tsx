
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
import { mockPosts, mockThreads, mockForums } from '@/lib/mockData';
import type { Post as PostType } from '@/lib/types';
import { Loader2, Send, MessageSquare } from 'lucide-react';

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
    return <p className="text-sm text-destructive p-4">You must be logged in to reply.</p>;
  }

  const onSubmitHandler: SubmitHandler<ReplyFormData> = async (data) => {
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 700));

      const newPostId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const newPost: PostType = {
        id: newPostId,
        threadId: threadId,
        author: user, // Full user object from useMockAuth
        content: data.content,
        createdAt: now,
        reactions: [],
      };

      // Add to mock data (client-side only for demo)
      mockPosts.push(newPost); // Add to end, assuming chronological order in display

      // Update thread details
      const threadToUpdate = mockThreads.find(t => t.id === threadId);
      if (threadToUpdate) {
        threadToUpdate.postCount = (threadToUpdate.postCount || 0) + 1;
        threadToUpdate.lastReplyAt = now;
      }

      // Update forum details
      const forumToUpdate = mockForums.find(f => f.id === forumId);
      if (forumToUpdate) {
        forumToUpdate.postCount = (forumToUpdate.postCount || 0) + 1;
      }
      
      // Update category if forum is part of one (more complex, simplified for now)
      // This would involve finding the category and updating its aggregated post count if stored.

      toast({
        title: "Reply Posted!",
        description: "Your reply has been added to the thread.",
      });

      onReplySuccess(newPost); // Callback to update parent component's state
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
