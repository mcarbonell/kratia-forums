
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

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
  proposedConstitutionText: z.string().min(100, "Proposed constitution text must be substantial."), // Basic check for non-empty
});

type ConstitutionProposalFormData = z.infer<typeof constitutionProposalSchema>;

export default function ProposeConstitutionChangePage() {
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const router = useRouter();
  const { toast } = useToast();

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
          setValue("proposedConstitutionText", text); // Pre-fill the textarea
        } else {
          setPageError("Current constitution not found. Cannot propose changes.");
          setCurrentConstitution("");
        }
      } catch (err) {
        console.error("Error fetching current constitution:", err);
        setPageError("Failed to load current constitution. Please try again.");
        setCurrentConstitution("");
      } finally {
        setIsLoadingConstitution(false);
      }
    };
    fetchCurrentConstitution();
  }, [setValue]);

  const canPropose = loggedInUser && loggedInUser.canVote && loggedInUser.status === 'active';

  if (authLoading || isLoadingConstitution) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canPropose) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to propose constitution changes. You must be logged in, have voting rights, and an active status.</AlertDescription>
        <Button asChild className="mt-4"><Link href="/agora"><CornerUpLeft className="mr-2 h-4 w-4" />Back to Agora</Link></Button>
      </Alert>
    );
  }

  if (pageError) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Frown className="h-5 w-5" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{pageError}</AlertDescription>
        <Button asChild className="mt-4"><Link href="/agora"><CornerUpLeft className="mr-2 h-4 w-4" />Back to Agora</Link></Button>
      </Alert>
    );
  }

  const onSubmit: SubmitHandler<ConstitutionProposalFormData> = async (data) => {
    if (!loggedInUser) {
      toast({ title: "Error", description: "User not logged in.", variant: "destructive" });
      return;
    }
    if (data.proposedConstitutionText.trim() === (currentConstitution || "").trim()) {
      toast({ title: "No Changes Detected", description: "Your proposed constitution text is identical to the current one.", variant: "default" });
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
    const agoraThreadTitle = `Votation: ${data.proposalTitle}`;

    try {
      const batch = writeBatch(db);
      const newVotationRef = doc(collection(db, "votations"));
      const newAgoraThreadRef = doc(collection(db, "threads"));

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
**Proposal Title:** ${data.proposalTitle}

**Justification for Changes:**
${data.justification}

---
**Full Proposed Constitution Text:**
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
      batch.update(doc(db, "users", loggedInUser.id), { karma: increment(2), totalPostsByUser: increment(1), totalPostsInThreadsStartedByUser: increment(1), totalThreadsStartedByUser: increment(1) });

      const votationData: Votation = {
        id: newVotationRef.id,
        title: agoraThreadTitle,
        description: `Proposal to change the site constitution. Justification: ${data.justification.substring(0, 100)}...`,
        justification: data.justification,
        proposerId: loggedInUser.id,
        proposerUsername: loggedInUser.username,
        type: 'rule_change', // Using 'rule_change' as discussed
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
        title: "Constitution Change Proposed!",
        description: `The votation for "${data.proposalTitle}" has been created in the Agora.`,
      });
      reset();
      router.push(`/forums/${AGORA_FORUM_ID}/threads/${newAgoraThreadRef.id}`);

    } catch (error) {
      console.error("Error proposing constitution change:", error);
      toast({
        title: "Error",
        description: "Failed to propose constitution change. Please try again.",
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
            Propose Constitution Change
          </CardTitle>
          <CardDescription>
            Propose modifications to the Kratia Forums "Normas y Condiciones". Your proposal will create a public votation in the Agora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="proposalTitle">Proposal Title</Label>
              <Input
                id="proposalTitle"
                placeholder="e.g., Update Article 3 on Karma Calculation"
                {...register("proposalTitle")}
                className={errors.proposalTitle ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.proposalTitle && <p className="text-sm text-destructive">{errors.proposalTitle.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Justification for Changes</Label>
              <Textarea
                id="justification"
                placeholder="Explain why these changes are needed and what their impact will be."
                rows={5}
                {...register("justification")}
                className={errors.justification ? "border-destructive" : ""}
                disabled={isSubmitting}
              />
              {errors.justification && <p className="text-sm text-destructive">{errors.justification.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposedConstitutionText">Proposed New Constitution Text</Label>
              <Textarea
                id="proposedConstitutionText"
                placeholder="Paste the entire constitution text here, with your proposed modifications."
                rows={20}
                {...register("proposedConstitutionText")}
                className={errors.proposedConstitutionText ? "border-destructive" : ""}
                disabled={isSubmitting || isLoadingConstitution}
              />
              {errors.proposedConstitutionText && <p className="text-sm text-destructive">{errors.proposedConstitutionText.message}</p>}
              <p className="text-xs text-muted-foreground">
                Tip: Copy the current constitution text, paste it here, and then make your edits.
              </p>
            </div>

            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Important Notice</AlertTitle>
              <AlertDescription>
                Submitting this proposal will create a public votation in the Agora. Ensure your proposed text is complete and accurately reflects all intended changes.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                <CornerUpLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting || isLoadingConstitution} className="min-w-[200px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Constitution Proposal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
