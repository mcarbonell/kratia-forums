
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, ShieldCheck, UserX, Home, Clock, Loader2, AlertCircle } from "lucide-react";
import { useMockAuth, type LoginResult } from "@/hooks/use-mock-auth";
import { useState, type FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { auth, GoogleAuthProvider } from "@/lib/firebase";
import { signInWithEmailAndPassword, signInWithPopup, type UserCredential, type FirebaseError } from "firebase/auth";
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { loginAndSetUserFromFirestore, logout } = useMockAuth();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState<{type: 'sanctioned' | 'pending_admission' | 'email_not_verified', username?: string; endDate?: string; userEmail?: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        setError(t('login.error.authFailed'));
        setIsSubmitting(false);
        return;
      }

      if (!firebaseUser.emailVerified) {
        setAuthError({ type: 'email_not_verified', userEmail: firebaseUser.email || email });
        setIsSubmitting(false);
        return;
      }

      const firestoreCheckResult: LoginResult = await loginAndSetUserFromFirestore(firebaseUser.uid, firebaseUser.email || undefined);

      if (firestoreCheckResult.success) {
        router.push('/');
      } else {
        if (firestoreCheckResult.reason === 'sanctioned') {
          setAuthError({type: 'sanctioned', username: firestoreCheckResult.username, endDate: firestoreCheckResult.sanctionEndDate});
        } else if (firestoreCheckResult.reason === 'pending_admission') {
          setAuthError({type: 'pending_admission', username: firestoreCheckResult.username});
        } else if (firestoreCheckResult.reason === 'not_found_in_firestore') {
           setError(t('login.error.profileNotFound'));
        } else {
          setError(t('login.error.profileIssue'));
          console.error("Login failed (Firestore check), reason:", firestoreCheckResult.reason, "for UID:", firebaseUser.uid);
        }
      }
    } catch (err: any) {
      console.error("Firebase Auth Email/Password Login error:", err.code, err.message);
      let specificError = t('login.error.invalidCredentialsGeneric');
      switch (err.code) {
        case 'auth/user-not-found':
          specificError = t('login.error.userNotFound');
          break;
        case 'auth/wrong-password':
          specificError = t('login.error.wrongPassword');
          break;
        case 'auth/invalid-credential':
            specificError = t('login.error.invalidCredentials');
            break;
        case 'auth/invalid-email':
          specificError = t('login.error.invalidEmail');
          break;
        case 'auth/too-many-requests':
            specificError = t('login.error.tooManyRequests');
            break;
        default:
          specificError = t('login.error.genericFail');
      }
      setError(specificError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setAuthError(null);
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        setError(t('login.error.googleAuthFailed'));
        setIsSubmitting(false);
        return;
      }

      const firestoreCheckResult: LoginResult = await loginAndSetUserFromFirestore(
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.displayName,
        firebaseUser.photoURL
      );

      if (firestoreCheckResult.success) {
        router.push('/');
      } else {
        if (firestoreCheckResult.reason === 'sanctioned') {
          setAuthError({type: 'sanctioned', username: firestoreCheckResult.username, endDate: firestoreCheckResult.sanctionEndDate});
        } else if (firestoreCheckResult.reason === 'pending_admission') {
          setAuthError({type: 'pending_admission', username: firestoreCheckResult.username});
        } else {
          setError(t('login.error.googleProfileIssue', { reason: firestoreCheckResult.reason || 'Unknown' }));
          console.error("Google Sign-In: Firestore check failed, reason:", firestoreCheckResult.reason, "for UID:", firebaseUser.uid);
        }
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError(t('login.error.googleCancelled'));
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setError(t('login.error.googleAccountExists'));
      } else {
        setError(t('login.error.googleGenericFail'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleContinueAsVisitor = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block mx-auto mb-4">
            {authError?.type === 'sanctioned' ? <UserX className="h-16 w-16 text-destructive" />
             : authError?.type === 'pending_admission' ? <Clock className="h-16 w-16 text-amber-500" />
             : authError?.type === 'email_not_verified' ? <AlertCircle className="h-16 w-16 text-yellow-500" />
             : <ShieldCheck className="h-16 w-16 text-primary" />}
          </div>
          <CardTitle className="text-3xl font-bold">
            {authError?.type === 'sanctioned' ? t('login.titleSanctioned')
             : authError?.type === 'pending_admission' ? t('login.titlePendingAdmission')
             : authError?.type === 'email_not_verified' ? t('login.titleEmailNotVerified')
             : t('login.titleWelcomeBack')}
          </CardTitle>
          <CardDescription>
            {authError?.type === 'sanctioned'
              ? t('login.descSanctioned', { username: authError.username })
              : authError?.type === 'pending_admission'
              ? t('login.descPendingAdmission', { username: authError.username })
              : authError?.type === 'email_not_verified'
              ? t('login.descEmailNotVerified', { email: authError.userEmail })
              : t('login.descDefault')}
             {authError?.type === 'sanctioned' && authError.endDate && (
                <span className="block mt-1 text-sm text-destructive">
                  {t('login.sanctionEnds')}: {format(new Date(authError.endDate), "PPPp")}
                </span>
              )}
          </CardDescription>
        </CardHeader>
        {!authError && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('login.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">{t('login.passwordLabel')}</Label>
                  <Link href="/auth/forgot-password" className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                    {t('login.forgotPasswordLink')}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              {error && !authError && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                {isSubmitting ? t('login.loggingInButton') : t('login.loginButton')}
              </Button>
            </form>
            <div className="mt-4 relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('login.orContinueWith')}
                </span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={handleGoogleSignIn} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 399.9 0 256S110.3 0 244 0c76.3 0 141.2 30.3 191.5 78.4l-69.9 69.9C333.7 117.2 292.5 96 244 96c-89.6 0-162.8 72.1-162.8 160s73.2 160 162.8 160c98.1 0 137.5-60.3 142.9-92.2h-142.9v-90.1h244c2.7 14.7 4.2 30.3 4.2 46.1z"></path>
                </svg>
              }
              {t('login.googleSignInButton')}
            </Button>
            <div className="mt-6 text-center text-sm">
              {t('login.noAccount')}{" "}
              <Link href="/auth/signup" className="underline font-medium text-primary hover:text-primary/80">
                {t('login.applyToJoinLink')}
              </Link>
            </div>
          </CardContent>
        )}
        {authError && (
            <CardContent className="text-center">
                 <Button onClick={handleContinueAsVisitor} variant="outline" className="mt-4 w-full">
                    <Home className="mr-2 h-5 w-5" /> {t('login.continueAsVisitorButton')}
                </Button>
            </CardContent>
        )}
      </Card>
    </div>
  );
}

    