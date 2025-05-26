
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MailCheck, Hourglass, Home, BadgeInfo, LogIn } from "lucide-react"; // Added LogIn
import { useSearchParams } from 'next/navigation';
import { Suspense } from "react";
import { useTranslation } from 'react-i18next';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation('common');
  const status = searchParams.get('status');
  const email = searchParams.get('email');

  if (status === 'email_verification_sent') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
        <Card className="mx-auto max-w-md w-full text-center shadow-xl">
          <CardHeader>
            <div className="inline-block mx-auto mb-6 p-4 bg-primary/10 rounded-full">
              <MailCheck className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">{t('confirmPage.emailVerificationSent.title')}</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              {t('confirmPage.emailVerificationSent.description', { email: email || t('confirmPage.yourEmailAddress') })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {t('confirmPage.emailVerificationSent.afterVerification')}{" "}
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                {t('confirmPage.emailVerificationSent.loginLink')}
              </Link>{" "}
              {t('confirmPage.emailVerificationSent.toCompleteAdmission')}
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/">
                <Home className="mr-2 h-5 w-5" /> {t('confirmPage.goToHomepageButton')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'application_submitted') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
        <Card className="mx-auto max-w-md w-full text-center shadow-xl">
          <CardHeader>
            <div className="inline-block mx-auto mb-6 p-4 bg-primary/10 rounded-full">
              <Hourglass className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">{t('confirmPage.applicationSubmitted.title')}</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              {t('confirmPage.applicationSubmitted.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {t('confirmPage.applicationSubmitted.whatNext')}
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/">
                <Home className="mr-2 h-5 w-5" /> {t('confirmPage.goToHomepageButton')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
      <Card className="mx-auto max-w-md w-full text-center shadow-xl">
        <CardHeader>
          <div className="inline-block mx-auto mb-6 p-4 bg-accent/10 rounded-full">
            <BadgeInfo className="h-16 w-16 text-accent" />
          </div>
          <CardTitle className="text-3xl font-bold">{t('confirmPage.default.title')}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            {t('confirmPage.default.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/auth/login">
              <LogIn className="mr-2 h-5 w-5" /> {t('confirmPage.default.backToLoginButton')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Loading confirmation...</div>}>
      <ConfirmContent />
    </Suspense>
  )
}

    