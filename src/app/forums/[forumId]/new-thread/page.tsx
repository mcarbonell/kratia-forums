
"use client";

import { useState, type FormEvent } from 'react';
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
import { mockThreads, mockPosts, mockForums } from '@/lib/mockData';
import type { Thread, Post } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Edit3, Send } from 'lucide-react';
import Link from 'next/link';

const newThreadSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters long.").max(150, "Title cannot exceed 150 characters."),
  content: z.string().min(10, "Your post content must be at least 10 characters long.").max(10000, "Post content is too long."),
});

type NewThreadFormData = z.infer<typeof newThreadSchema>;

export default function NewThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useMockAuth();
  const { toast } = useToast();
  const forumId = params.forumId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<NewThreadFormData>({
    resolver: zodResolver(newThreadSchema),
  });

  const forum = mockForums.find(f => f.id === forumId);

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!user || user.role === 'visitor' || user.role === 'guest') {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You must be logged in as a member to create a new thread.
        </AlertDescription>
        <div className="mt-4">
          <Button asChild variant="outline" className="mr-2">
            <Link href="/auth/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href={`/forums/${forumId}`}>Back to Forum</Link>
          </Button>
        </div>
      </Alert>
    );
  }
  
  if (!forum) {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Forum Not Found</AlertTitle>
        <AlertDescription>
          The forum you are trying to post in does not exist.
        </AlertDescription>
         <Button asChild className="mt-4">
            <Link href="/forums">Back to Forums List</Link>
          </Button>
      </Alert>
    );
  }


  const onSubmit: SubmitHandler<NewThreadFormData> = async (data) => {
    setIsSubmitting(true);
    if (!user) { // Should be caught by the check above, but good for TS
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newThreadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      const newPostId = `post-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      const now = new Date().toISOString();

      const newThread: Thread = {
        id: newThreadId,
        forumId: forumId,
        title: data.title,
        author: user, 
        createdAt: now,
        lastReplyAt: now,
        postCount: 1,
        isSticky: false,
        isLocked: false,
      };

      const initialPost: Post = {
        id: newPostId,
        threadId: newThreadId,
        author: user,
        content: data.content,
        createdAt: now,
        reactions: [],
      };

      // Add to mock data (this is client-side only for demo)
      mockThreads.unshift(newThread); // Add to beginning to show up first
      mockPosts.unshift(initialPost);
      
      // Update forum thread/post counts (client-side only for demo)
      const forumToUpdate = mockForums.find(f => f.id === forumId);
      if (forumToUpdate) {
          forumToUpdate.threadCount = (forumToUpdate.threadCount || 0) + 1;
          forumToUpdate.postCount = (forumToUpdate.postCount || 0) + 1;
          // Update category if it's part of one in mockCategories
      }


      toast({
        title: "Thread Created!",
        description: "Your new thread has been successfully posted.",
      });
      router.push(`/forums/${forumId}/threads/${newThreadId}`);

    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to create thread. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold flex items-center">
            <Edit3 className="mr-3 h-7 w-7 text-primary" />
            Create New Thread in {forum.name}
          </CardTitle>
          <CardDescription>
            Share your thoughts and start a new discussion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Thread Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="Enter a descriptive title for your thread"
                {...register("title")}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Your Post</Label>
              <Textarea
                id="content"
                placeholder="Write the content of your first post here..."
                rows={10}
                {...register("content")}
                className={errors.content ? "border-destructive" : ""}
              />
              {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Send className="mr-2 h-4 w-4" />
                )}
                Post Thread
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
