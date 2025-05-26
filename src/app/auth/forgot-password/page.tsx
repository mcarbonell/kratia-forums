
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
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('common');
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
        title: t('forgotPassword.toast.emailSentTitle'),
        description: t('forgotPassword.toast.emailSentDesc', { email }),
      });
    } catch (err: any) {
      console.error("Error sending password reset email:", err);
      let specificError = t('forgotPassword.error.genericFail');
      if (err.code === 'auth/user-not-found') {
         setEmailSent(true); 
         toast({
            title: t('forgotPassword.toast.emailSentTitle'),
            description: t('forgotPassword.toast.emailSentDesc', { email }),
         });
      } else if (err.code === 'auth/invalid-email') {
        setError(t('forgotPassword.error.invalidEmail'));
        specificError = t('forgotPassword.error.invalidEmail');
      }
       if (err.code !== 'auth/user-not-found') { 
          toast({
            title: t('forgotPassword.toast.errorTitle'),
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
            {emailSent ? t('forgotPassword.titleEmailSent') : t('forgotPassword.titleDefault')}
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            {emailSent 
              ? t('forgotPassword.descEmailSent', { email })
              : t('forgotPassword.descDefault')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">{t('forgotPassword.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('forgotPassword.emailPlaceholder')}
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
                {isSubmitting ? t('forgotPassword.sendingButton') : t('forgotPassword.sendLinkButton')}
              </Button>
            </form>
          ) : (
            <div className="text-center">
                <p className="text-sm text-muted-foreground">
                    {t('forgotPassword.checkSpamNote')}
                </p>
            </div>
          )}
          <div className="mt-6 text-center text-sm">
            <Button variant="link" asChild className="text-primary hover:underline">
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('forgotPassword.backToLoginLink')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    