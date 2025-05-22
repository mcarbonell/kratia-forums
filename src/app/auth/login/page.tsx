
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

export default function LoginPage() {
  const { loginAndSetUserFromFirestore, logout } = useMockAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState<{type: 'sanctioned' | 'pending_admission' | 'email_not_verified', username?: string; endDate?: string; userEmail?: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Corrected line

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        setError("Authentication failed. Please try again.");
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
           setError("Login failed. User profile not found after authentication. Please contact support.");
        } else {
          setError("Login failed after authentication. User profile issue.");
          console.error("Login failed (Firestore check), reason:", firestoreCheckResult.reason, "for UID:", firebaseUser.uid);
        }
      }
    } catch (err: any) {
      console.error("Firebase Auth Email/Password Login error:", err.code, err.message);
      let specificError = "Login failed. Please check your credentials.";
      switch (err.code) {
        case 'auth/user-not-found':
          specificError = "No user found with this email.";
          break;
        case 'auth/wrong-password':
          specificError = "Incorrect password. Please try again.";
          break;
        case 'auth/invalid-credential':
            specificError = "Invalid credentials. Please check your email and password.";
            break;
        case 'auth/invalid-email':
          specificError = "The email address is not valid.";
          break;
        case 'auth/too-many-requests':
            specificError = "Too many login attempts. Please try again later or reset your password.";
            break;
        default:
          specificError = "Failed to login. Please check your credentials and try again.";
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
        setError("Google Sign-In failed. Please try again.");
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
          setError("Google Sign-In completed, but user profile has an issue. Reason: " + (firestoreCheckResult.reason || 'Unknown'));
          console.error("Google Sign-In: Firestore check failed, reason:", firestoreCheckResult.reason, "for UID:", firebaseUser.uid);
        }
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError("Google Sign-In was cancelled.");
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setError("An account already exists with this email address using a different sign-in method.");
      } else {
        setError("Failed to sign in with Google. Please try again.");
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
            {authError?.type === 'sanctioned' ? "Access Denied"
             : authError?.type === 'pending_admission' ? "Application Pending"
             : authError?.type === 'email_not_verified' ? "Email Not Verified"
             : "Welcome Back!"}
          </CardTitle>
          <CardDescription>
            {authError?.type === 'sanctioned'
              ? `User ${authError.username} is currently sanctioned.`
              : authError?.type === 'pending_admission'
              ? `The admission application for ${authError.username} is currently under review by the community. You will be notified of the outcome.`
              : authError?.type === 'email_not_verified'
              ? `Please verify your email address (${authError.userEmail}) by clicking the link sent to your inbox. Check your spam folder if you can't find it.`
              : "Enter your email to access your Kratia account."}
             {authError?.type === 'sanctioned' && authError.endDate && (
                <span className="block mt-1 text-sm text-destructive">
                  Sanction ends: {format(new Date(authError.endDate), "PPPp")}
                </span>
              )}
          </CardDescription>
        </CardHeader>
        {!authError && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/auth/forgot-password" className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                    Forgot your password?
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
                {isSubmitting ? "Logging in..." : "Login"}
              </Button>
            </form>
            <div className="mt-4 relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={handleGoogleSignIn} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 399.9 0 256S110.3 0 244 0c76.3 0 141.2 30.3 191.5 78.4l-69.9 69.9C333.7 117.2 292.5 96 244 96c-89.6 0-162.8 72.1-162.8 160s73.2 160 162.8 160c98.1 0 137.5-60.3 142.9-92.2h-142.9v-90.1h244c2.7 14.7 4.2 30.3 4.2 46.1z"></path>
                </svg>
              }
              Sign in with Google
            </Button>
            <div className="mt-6 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="underline font-medium text-primary hover:text-primary/80">
                Apply to Join
              </Link>
            </div>
          </CardContent>
        )}
        {authError && (
            <CardContent className="text-center">
                 <Button onClick={handleContinueAsVisitor} variant="outline" className="mt-4 w-full">
                    <Home className="mr-2 h-5 w-5" /> Continue as Visitor
                </Button>
            </CardContent>
        )}
      </Card>
    </div>
  );
}
