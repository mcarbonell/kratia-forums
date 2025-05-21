
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    setEmailSent(false);

    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
      toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${email}, a password reset link has been sent. Please check your inbox (and spam folder).`,
      });
    } catch (err: any) {
      console.error("Error sending password reset email:", err);
      let specificError = "Failed to send password reset email. Please try again.";
      if (err.code === 'auth/user-not-found') {
        // We typically don't reveal if an email exists or not for security reasons,
        // so we can show a generic success message or a very generic error.
        // For this implementation, we'll still show a success-like toast to avoid email enumeration.
         setEmailSent(true); // Still set to true to not reveal user existence
         toast({
            title: "Password Reset Email Sent",
            description: `If an account exists for ${email}, a password reset link has been sent. Please check your inbox (and spam folder).`,
         });
         // setError("No user found with this email address."); // Or keep error generic
      } else if (err.code === 'auth/invalid-email') {
        setError("The email address is not valid.");
      } else {
        setError(specificError);
      }
       if (err.code !== 'auth/user-not-found') { // Only show destructive toast if not user-not-found
          toast({
            title: "Error",
            description: specificError,
            variant: "destructive",
          });
       }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
      <Card className="mx-auto max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="inline-block mx-auto mb-6 p-4 bg-primary/10 rounded-full">
            {emailSent ? <ShieldCheck className="h-16 w-16 text-green-500" /> : <Mail className="h-16 w-16 text-primary" />}
          </div>
          <CardTitle className="text-3xl font-bold">
            {emailSent ? "Check Your Email" : "Forgot Your Password?"}
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            {emailSent 
              ? `If an account associated with ${email} exists, we've sent a link to reset your password. Please check your inbox and spam folder.`
              : "No problem. Enter your email address below and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className={error ? "border-destructive" : ""}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-5 w-5" />
                )}
                {isSubmitting ? "Sending..." : "Send Password Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="text-center">
                <p className="text-sm text-muted-foreground">
                    If you don't receive an email within a few minutes, please ensure you entered the correct email address and check your spam folder.
                </p>
            </div>
          )}
          <div className="mt-6 text-center text-sm">
            <Button variant="link" asChild className="text-primary hover:underline">
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
