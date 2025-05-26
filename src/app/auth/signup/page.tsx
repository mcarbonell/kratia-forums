
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
import { db, auth, GoogleAuthProvider } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import type { User } from "@/lib/types";
import { KRATIA_CONFIG } from "@/lib/config";
import { useMockAuth } from "@/hooks/use-mock-auth";
import { useTranslation } from 'react-i18next';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { loginAndSetUserFromFirestore } = useMockAuth();
  const { t } = useTranslation('common');

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
      setError(t('signup.error.passwordsDontMatch'));
      setIsSubmitting(false);
      return;
    }
    if (presentation.trim().length < 50) {
      setError(t('signup.error.presentationTooShort'));
      setIsSubmitting(false);
      return;
    }
    if (!agreedToTerms) {
      setError(t('signup.error.mustAgreeToTerms'));
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
        isQuarantined: true, // New users start quarantined until admission process or other criteria
        status: 'pending_email_verification', // NEW STATUS
        role: 'guest', // Initial role until admitted
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        totalThreadsStartedByUser: 0,
        onboardingAccepted: false,
      };
      await setDoc(userDocRef, newUserFirestoreData);

      toast({
        title: t('signup.toast.step1CompleteTitle'),
        description: t('signup.toast.step1CompleteDesc'),
      });
      router.push(`/auth/confirm?status=email_verification_sent&email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      console.error("Error during email/password signup:", err);
      let errorMessage = t('signup.error.genericFail');
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = t('signup.error.emailInUse');
            break;
          case 'auth/weak-password':
            errorMessage = t('signup.error.weakPassword');
            break;
          case 'auth/invalid-email':
            errorMessage = t('signup.error.invalidEmail');
            break;
          default:
             errorMessage = t('signup.error.default', { message: err.message || 'Unknown error' });
        }
      }
      setError(errorMessage);
      toast({
        title: t('signup.toast.errorTitle'),
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
      setError(t('signup.error.presentationTooShortGoogle'));
      toast({ title: t('signup.toast.presentationRequiredTitle'), description: t('signup.toast.presentationRequiredDesc'), variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      setError(t('signup.error.mustAgreeToTermsGoogle'));
      toast({ title: t('signup.toast.agreementRequiredTitle'), description: t('signup.toast.agreementRequiredDesc'), variant: "destructive" });
      return;
    }

    setIsGoogleSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        setError(t('signup.error.googleSignupFailed'));
        setIsGoogleSubmitting(false);
        return;
      }

      const result = await loginAndSetUserFromFirestore(
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.displayName,
        firebaseUser.photoURL,
        presentation 
      );

      if (result.success) { 
        router.push('/');
      } else if (result.reason === 'pending_admission') {
        router.push(`/auth/confirm?status=application_submitted`);
      } else if (result.reason === 'sanctioned') {
         setError(t('signup.error.userSanctioned', { username: result.username }));
         router.push(`/auth/login?error=sanctioned&username=${result.username}&endDate=${result.sanctionEndDate}`);
      } else {
        setError(result.reason || t('signup.error.googleUnexpected'));
      }
    } catch (error: any) {
      console.error("Google Sign-Up Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError(t('signup.error.googleCancelled'));
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setError(t('signup.error.googleAccountExists'));
         toast({ title: t('signup.toast.accountExistsTitle'), description: t('signup.toast.accountExistsDesc'), variant: "default"});
      } else {
        setError(t('signup.error.googleGenericFail'));
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
          <CardTitle className="text-3xl font-bold">{t('signup.title')}</CardTitle>
          <CardDescription>{t('signup.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">{t('signup.usernameLabel')}</Label>
              <Input
                id="username"
                placeholder={t('signup.usernamePlaceholder')}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting || isGoogleSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('signup.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('signup.emailPlaceholder')}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || isGoogleSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('signup.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || isGoogleSubmitting}
                placeholder={t('signup.passwordPlaceholder')}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('signup.confirmPasswordLabel')}</Label>
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
                <Label htmlFor="presentation">{t('signup.presentationLabel')}</Label>
                <Textarea
                    id="presentation"
                    placeholder={t('signup.presentationPlaceholder')}
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
                {t('signup.agreeToTermsPrefix')}{" "}
                <Link href="/constitution" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                  {t('signup.termsLink')}
                </Link>
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
              {isSubmitting ? t('signup.submittingButton') : t('signup.submitButtonEmail')}
            </Button>
          </form>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('signup.or')}
              </span>
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4" onClick={handleGoogleSignUp} disabled={isSubmitting || isGoogleSubmitting}>
            {isGoogleSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 399.9 0 256S110.3 0 244 0c76.3 0 141.2 30.3 191.5 78.4l-69.9 69.9C333.7 117.2 292.5 96 244 96c-89.6 0-162.8 72.1-162.8 160s73.2 160 162.8 160c98.1 0 137.5-60.3 142.9-92.2h-142.9v-90.1h244c2.7 14.7 4.2 30.3 4.2 46.1z"></path>
              </svg>
            }
            {t('signup.submitButtonGoogle')}
          </Button>

          <div className="mt-6 text-center text-sm">
            {t('signup.alreadyHaveAccount')}{" "}
            <Link href="/auth/login" className="underline font-medium text-primary hover:text-primary/80">
              {t('signup.loginLink')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    