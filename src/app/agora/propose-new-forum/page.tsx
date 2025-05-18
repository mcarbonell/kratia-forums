
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
          setPageError("No categories found. Categories are required to propose a new forum.");
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setPageError("Failed to load categories. Please try again.");
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [canPropose]);

  if (authLoading || (canPropose && isLoadingCategories)) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canPropose) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to propose new forums. You must be logged in, have voting rights, and an active status.</AlertDescription>
        <Button asChild className="mt-4"><Link href="/forums"><CornerUpLeft className="mr-2 h-4 w-4" />Back to Forums</Link></Button>
      </Alert>
    );
  }

  if (pageError) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{pageError}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/forums"><CornerUpLeft className="mr-2 h-4 w-4" />Back to Forums</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<ProposeForumFormData> = async (data) => {
    if (!loggedInUser) {
      toast({ title: "Error", description: "User not logged in.", variant: "destructive" });
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
    const selectedCategoryName = selectedCategory?.name || 'Unknown Category';

    const agoraThreadTitle = `Votation: Proposal for New Forum - "${data.proposedForumName}"`;
    const votationTitle = `Vote on New Forum Proposal: "${data.proposedForumName}"`;
    const votationDescription = `Proposal to create a new forum: "${data.proposedForumName}" in category "${selectedCategoryName}". Justification: ${data.justification.substring(0,100)}...`;

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
**Forum Name Proposal:** ${data.proposedForumName}
**Proposed Category:** ${selectedCategoryName}
**Proposed Description:** ${data.proposedForumDescription}
**Proposed Public Status:** ${data.proposedForumIsPublic ? 'Public' : 'Private (Members Only)'}

**Justification by ${loggedInUser.username}:**
${data.justification}

---
This proposal is now subject to community votation.
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
        // Store proposed forum details
        proposedForumName: data.proposedForumName,
        proposedForumDescription: data.proposedForumDescription,
        proposedForumCategoryId: data.proposedForumCategoryId,
        proposedForumCategoryName: selectedCategoryName, // Store the name
        proposedForumIsPublic: data.proposedForumIsPublic,
      };
      batch.set(newVotationRef, votationData);

      await batch.commit();

      toast({
        title: "New Forum Proposed!",
        description: `The votation for "${data.proposedForumName}" has been created in the Agora.`,
      });
      reset();
      router.push(`/forums/${AGORA_FORUM_ID}/threads/${newAgoraThreadRef.id}`);

    } catch (error) {
      console.error("Error proposing new forum:", error);
      toast({
        title: "Error",
        description: "Failed to propose new forum. Please try again.",
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
            Propose New Forum
          </CardTitle>
          <CardDescription>
            Submit a proposal to create a new forum. Your proposal will create a public votation in the Agora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="proposedForumName">Proposed Forum Name</Label>
              <Input
                id="proposedForumName"
                placeholder="e.g., Quantum Physics Discussions"
                {...register("proposedForumName")}
                className={errors.proposedForumName ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.proposedForumName && <p className="text-sm text-destructive">{errors.proposedForumName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposedForumDescription">Proposed Description</Label>
              <Textarea
                id="proposedForumDescription"
                placeholder="A brief description of what this new forum will be about."
                rows={3}
                {...register("proposedForumDescription")}
                className={errors.proposedForumDescription ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.proposedForumDescription && <p className="text-sm text-destructive">{errors.proposedForumDescription.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposedForumCategoryId">Category</Label>
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
                      <SelectValue placeholder="Select a category for the new forum" />
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
                Publicly visible (guests can view threads and posts)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Justification for New Forum</Label>
              <Textarea
                id="justification"
                placeholder="Explain why this new forum is needed and how it will benefit the community."
                rows={5}
                {...register("justification")}
                className={errors.justification ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.justification && <p className="text-sm text-destructive">{errors.justification.message}</p>}
            </div>

            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Important Notice</AlertTitle>
              <AlertDescription>
                Submitting this proposal will create a public votation in the Agora.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                <CornerUpLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting || categories.length === 0} className="min-w-[200px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit New Forum Proposal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
