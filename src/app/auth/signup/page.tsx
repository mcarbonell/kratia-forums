
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
import { db, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import type { User } from "@/lib/types";
import { KRATIA_CONFIG } from "@/lib/config";

// Note: Agora-related imports (Thread, Post, Votation, increment, writeBatch, collection, AGORA_FORUM_ID)
// are removed from here as admission request creation moves to login after email verification.

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
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const firebaseUserId = firebaseUser.uid;

      // 2. Send email verification
      await sendEmailVerification(firebaseUser);

      // 3. Create User document in Firestore with 'pending_email_verification' status
      const userDocRef = doc(db, "users", firebaseUserId);
      const now = Timestamp.now();
      const newUserFirestoreData: Omit<User, 'id'> = {
        username,
        email,
        avatarUrl: `https://placehold.co/100x100.png?text=${username?.[0]?.toUpperCase() || 'U'}`,
        registrationDate: now.toDate().toISOString(),
        karma: 0,
        presentation: presentation,
        canVote: false,
        isQuarantined: true, // New users start quarantined until admission
        status: 'pending_email_verification', // New status
        role: 'guest', // Initial role
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        totalThreadsStartedByUser: 0,
        onboardingAccepted: false,
      };
      await setDoc(userDocRef, newUserFirestoreData); // Using setDoc for clarity

      toast({
        title: "Registration Successful!",
        description: "Please check your email to verify your account. After verification, log in to complete your admission request.",
      });
      router.push(`/auth/confirm?status=email_verification_sent&email=${encodeURIComponent(email)}`); 
    } catch (err: any) {
      console.error("Error during signup:", err);
      let errorMessage = "Failed to sign up. Please try again.";
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = "This email address is already in use. Please use a different email or log in.";
            break;
          case 'auth/weak-password':
            errorMessage = "The password is too weak. Please use a stronger password (at least 6 characters).";
            break;
          case 'auth/invalid-email':
            errorMessage = "The email address is not valid.";
            break;
          default:
             errorMessage = `An error occurred: ${err.message || 'Unknown error'}`;
        }
      }
      setError(errorMessage);
      toast({
        title: "Signup Error",
        description: errorMessage,
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
                placeholder="At least 6 characters"
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
