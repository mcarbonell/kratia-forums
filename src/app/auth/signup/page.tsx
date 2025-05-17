
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, ShieldCheck, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, Timestamp, increment } from "firebase/firestore";
import type { User, Thread, Post, Votation } from "@/lib/types";
import { KRATIA_CONFIG } from "@/lib/config";

const AGORA_FORUM_ID = 'agora';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [presentation, setPresentation] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }
    if (presentation.trim().length < 50) {
      setError("Your presentation must be at least 50 characters long.");
      setIsSubmitting(false);
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Normas y Condiciones to sign up.");
      setIsSubmitting(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      const now = Timestamp.now();
      const deadlineDate = new Date(now.toDate().getTime() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // 1. Create User document with 'pending_admission' status
      const newUserRef = doc(collection(db, "users"));
      const newUserData: Omit<User, 'id'> = {
        username,
        email,
        // In a real app, password would be hashed securely on the backend
        // For this mock, we're not storing it or handling real auth
        avatarUrl: `https://placehold.co/100x100.png?text=${username?.[0]?.toUpperCase() || 'U'}`,
        registrationDate: now.toDate().toISOString(),
        karma: 0,
        presentation: presentation,
        canVote: false,
        isQuarantined: true, // New users start quarantined until criteria met (after admission)
        status: 'pending_admission',
        role: 'guest', // Initial role, will be updated upon admission
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        totalThreadsStartedByUser: 0,
      };
      batch.set(newUserRef, { ...newUserData, id: newUserRef.id });


      // 2. Create Agora Thread for admission request
      const admissionThreadRef = doc(collection(db, "threads"));
      const admissionThreadTitle = `Admission Request: ${username}`;
      const admissionThreadData: Omit<Thread, 'id' | 'author'> & { authorId: string, relatedVotationId: string } = {
        forumId: AGORA_FORUM_ID,
        title: admissionThreadTitle,
        authorId: newUserRef.id, // Applicant is the author
        createdAt: now.toDate().toISOString(),
        lastReplyAt: now.toDate().toISOString(),
        postCount: 1,
        isPublic: true,
        relatedVotationId: '', // Will be set after votation is created
      };

      // 3. Create Votation document for admission
      const newVotationRef = doc(collection(db, "votations"));
      (admissionThreadData as any).relatedVotationId = newVotationRef.id; // Link thread to votation

      batch.set(admissionThreadRef, {
        ...admissionThreadData,
        author: { id: newUserRef.id, username, avatarUrl: newUserData.avatarUrl }
      });

      const votationData: Votation = {
        id: newVotationRef.id,
        title: `Vote on admission for ${username}`,
        description: `Community vote to admit ${username} to ${KRATIA_CONFIG.FORUM_NAME}. Their presentation is in the linked thread.`,
        proposerId: newUserRef.id, // The applicant is the 'proposer' of their own admission
        proposerUsername: username,
        type: 'admission_request',
        createdAt: now.toDate().toISOString(),
        deadline: deadlineDate.toISOString(),
        status: 'active',
        targetUserId: newUserRef.id, // The applicant is the target
        targetUsername: username,
        options: { for: 0, against: 0, abstain: 0 },
        voters: {},
        totalVotesCast: 0,
        quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
        relatedThreadId: admissionThreadRef.id,
      };
      batch.set(newVotationRef, votationData);

      // 4. Create Initial Post in the Admission Thread (Applicant's Presentation)
      const initialPostRef = doc(collection(db, "posts"));
      const initialPostData: Omit<Post, 'id' | 'author'> & { authorId: string } = {
        threadId: admissionThreadRef.id,
        authorId: newUserRef.id,
        content: `**Applicant:** ${username}\n\n**Reason for Joining / Presentation:**\n\n${presentation}`,
        createdAt: now.toDate().toISOString(),
        reactions: {},
      };
      batch.set(initialPostRef, {
          ...initialPostData,
          author: { id: newUserRef.id, username, avatarUrl: newUserData.avatarUrl }
      });
      
      // 5. Update Agora forum counts (one new thread, one new post)
      const agoraForumRef = doc(db, "forums", AGORA_FORUM_ID);
      batch.update(agoraForumRef, {
        threadCount: increment(1),
        postCount: increment(1),
      });


      await batch.commit();

      toast({
        title: "Application Submitted!",
        description: "Your application to join Kratia Forums is now pending community review. You'll be notified of the outcome.",
      });
      router.push('/auth/confirm?status=application_submitted'); 
    } catch (err) {
      console.error("Error submitting application:", err);
      setError("Failed to submit application. Please try again. " + (err as Error).message);
      toast({
        title: "Application Error",
        description: "Could not submit your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block mx-auto mb-4">
             <ShieldCheck className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Apply to Join Kratia</CardTitle>
          <CardDescription>Submit your application to become a member of our community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="YourUniqueUsername" 
                required 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="presentation">Presentation / Reason for Joining (min. 50 characters)</Label>
                <Textarea
                    id="presentation"
                    placeholder="Tell us a bit about yourself and why you'd like to join Kratia Forums..."
                    rows={5}
                    value={presentation}
                    onChange={(e) => setPresentation(e.target.value)}
                    required
                    minLength={50}
                    disabled={isSubmitting}
                />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                disabled={isSubmitting}
              />
              <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
                I agree to the{" "}
                <Link href="/constitution" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                  Normas y Condiciones
                </Link>
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
              {isSubmitting ? "Submitting Application..." : "Submit Application"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="underline font-medium text-primary hover:text-primary/80">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
