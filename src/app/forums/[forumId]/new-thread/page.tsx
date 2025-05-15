
"use client";

import { useState, type FormEvent, useEffect } from 'react';
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
import type { Forum, Thread, Post, User as KratiaUser } from '@/lib/types'; // Renamed User to KratiaUser to avoid conflict
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Edit3, Send, Frown } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, Timestamp, writeBatch, increment, serverTimestamp } from 'firebase/firestore';


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
  const [forum, setForum] = useState<Forum | null>(null);
  const [isLoadingForum, setIsLoadingForum] = useState(true);
  const [forumError, setForumError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<NewThreadFormData>({
    resolver: zodResolver(newThreadSchema),
  });

  useEffect(() => {
    if (!forumId) {
      setForumError("Forum ID is missing.");
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
          setForum({ id: forumSnap.id, ...forumSnap.data() } as Forum);
        } else {
          setForumError("The forum you are trying to post in does not exist.");
        }
      } catch (err) {
        console.error("Error fetching forum for new thread page:", err);
        setForumError("Could not load forum details.");
      } finally {
        setIsLoadingForum(false);
      }
    };
    fetchForum();
  }, [forumId]);


  if (authLoading || isLoadingForum) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (forumError || !forum) {
     return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>{forumError ? "Error" : "Forum Not Found"}</AlertTitle>
        <AlertDescription>
          {forumError || "The forum you are trying to post in does not exist."}
        </AlertDescription>
         <Button asChild className="mt-4">
            <Link href="/forums">Back to Forums List</Link>
          </Button>
      </Alert>
    );
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


  const onSubmit: SubmitHandler<NewThreadFormData> = async (data) => {
    setIsSubmitting(true);
    if (!user || !forum) {
        toast({ title: "Error", description: "User or Forum not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const authorInfo = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl || "", // Ensure avatarUrl is a string
    };

    const now = Timestamp.fromDate(new Date()); // Use Firestore Timestamp

    try {
      const batch = writeBatch(db);

      // 1. Create New Thread
      const newThreadRef = doc(collection(db, "threads")); // Auto-generate ID
      const newThreadData: Omit<Thread, 'id'> = { // Omit 'id' as Firestore generates it
        forumId: forum.id,
        title: data.title,
        author: authorInfo,
        createdAt: now.toDate().toISOString(), // Store as ISO string for consistency with type
        lastReplyAt: now.toDate().toISOString(),
        postCount: 1,
        isSticky: false,
        isLocked: false,
        isPublic: forum.isPublic === undefined ? true : forum.isPublic, // Inherit public status from forum
      };
      batch.set(newThreadRef, newThreadData);

      // 2. Create Initial Post
      const newPostRef = doc(collection(db, "posts")); // Auto-generate ID
      const initialPostData: Omit<Post, 'id'> = { // Omit 'id' as Firestore generates it
        threadId: newThreadRef.id, // Use the auto-generated ID of the new thread
        author: authorInfo,
        content: data.content,
        createdAt: now.toDate().toISOString(),
        reactions: [],
      };
      batch.set(newPostRef, initialPostData);
      
      // 3. Update Forum Counts
      const forumRef = doc(db, "forums", forum.id);
      batch.update(forumRef, {
        threadCount: increment(1),
        postCount: increment(1) // Initial post
      });

      await batch.commit();

      toast({
        title: "Thread Created!",
        description: "Your new thread has been successfully posted.",
      });
      reset(); // Reset form fields on successful submission
      router.push(`/forums/${forum.id}/threads/${newThreadRef.id}`);

    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to create thread. Please try again.",
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
              {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !user || !forum} className="min-w-[120px]">
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
