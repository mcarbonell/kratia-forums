
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
import { db, auth, GoogleAuthProvider } from "@/lib/firebase"; // Import GoogleAuthProvider
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup } from "firebase/auth"; // Import signInWithPopup
import { doc, setDoc, Timestamp } from "firebase/firestore";
import type { User } from "@/lib/types";
import { KRATIA_CONFIG } from "@/lib/config";
import { useMockAuth } from "@/hooks/use-mock-auth"; // Import useMockAuth

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { loginAndSetUserFromFirestore } = useMockAuth(); // Get the function from the hook

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [presentation, setPresentation] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleEmailPasswordSubmit = async (event: FormEvent) => {
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const firebaseUserId = firebaseUser.uid;

      await sendEmailVerification(firebaseUser);

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
        isQuarantined: true,
        status: 'pending_email_verification',
        role: 'guest',
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        totalThreadsStartedByUser: 0,
        onboardingAccepted: false,
      };
      await setDoc(userDocRef, newUserFirestoreData);

      toast({
        title: "Registration Step 1 Complete!",
        description: "Please check your email to verify your account. After verification, log in to complete your admission request.",
      });
      router.push(`/auth/confirm?status=email_verification_sent&email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      console.error("Error during email/password signup:", err);
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

  const handleGoogleSignUp = async () => {
    setError("");
    if (presentation.trim().length < 50) {
      setError("Your presentation must be at least 50 characters long to sign up with Google.");
      toast({ title: "Presentation Required", description: "Please provide a presentation of at least 50 characters.", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Normas y Condiciones to sign up with Google.");
      toast({ title: "Agreement Required", description: "Please agree to the Normas y Condiciones.", variant: "destructive" });
      return;
    }

    setIsGoogleSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        setError("Google Sign-Up failed. Please try again.");
        setIsGoogleSubmitting(false);
        return;
      }

      // Pass presentation to loginAndSetUserFromFirestore if available
      const result = await loginAndSetUserFromFirestore(
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.displayName,
        firebaseUser.photoURL,
        presentation // Pass presentation here
      );

      if (result.success) { // Should not happen for a new signup, as status will be pending_admission
        router.push('/');
      } else if (result.reason === 'pending_admission') {
        router.push(`/auth/confirm?status=application_submitted`);
      } else if (result.reason === 'sanctioned') {
         setError(`User ${result.username} is sanctioned. Cannot complete signup.`);
         // Optionally, redirect to login page to show the sanctioned message there
         router.push(`/auth/login?error=sanctioned&username=${result.username}&endDate=${result.sanctionEndDate}`);
      } else {
        setError(result.reason || "An unexpected error occurred after Google Sign-Up.");
      }
    } catch (error: any) {
      console.error("Google Sign-Up Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError("Google Sign-Up was cancelled.");
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with this email address using a different sign-in method. Please log in instead.");
         toast({ title: "Account Exists", description: "An account with this email already exists. Please log in.", variant: "default"});
      } else {
        setError("Failed to sign up with Google. Please try again.");
      }
    } finally {
      setIsGoogleSubmitting(false);
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
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="YourUniqueUsername"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting || isGoogleSubmitting}
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
                disabled={isSubmitting || isGoogleSubmitting}
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
                disabled={isSubmitting || isGoogleSubmitting}
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
                disabled={isSubmitting || isGoogleSubmitting}
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
                    disabled={isSubmitting || isGoogleSubmitting}
                />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                disabled={isSubmitting || isGoogleSubmitting}
              />
              <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
                I agree to the{" "}
                <Link href="/constitution" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                  Normas y Condiciones
                </Link>
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
              {isSubmitting ? "Submitting Application..." : "Submit Application with Email"}
            </Button>
          </form>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4" onClick={handleGoogleSignUp} disabled={isSubmitting || isGoogleSubmitting}>
            {isGoogleSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 399.9 0 256S110.3 0 244 0c76.3 0 141.2 30.3 191.5 78.4l-69.9 69.9C333.7 117.2 292.5 96 244 96c-89.6 0-162.8 72.1-162.8 160s73.2 160 162.8 160c98.1 0 137.5-60.3 142.9-92.2h-142.9v-90.1h244c2.7 14.7 4.2 30.3 4.2 46.1z"></path>
              </svg>
            }
            Sign up with Google
          </Button>

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
