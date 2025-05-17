
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MailCheck, ShieldCheck, LogIn, Hourglass } from "lucide-react";
import { useSearchParams } from 'next/navigation';
import { Suspense } from "react";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  if (status === 'application_submitted') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
        <Card className="mx-auto max-w-md w-full text-center shadow-xl">
          <CardHeader>
            <div className="inline-block mx-auto mb-6 p-4 bg-primary/10 rounded-full">
              <Hourglass className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Application Submitted!</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              Your application to join Kratia Forums has been successfully submitted. It is now pending review and votation by the community.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              You will be notified of the outcome. In the meantime, you can explore public content as a visitor.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/">
                <Home className="mr-2 h-5 w-5" /> Go to Homepage
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default confirmation message (e.g., for email, though we aren't using it yet)
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
      <Card className="mx-auto max-w-md w-full text-center shadow-xl">
        <CardHeader>
          <div className="inline-block mx-auto mb-6 p-4 bg-accent/10 rounded-full">
            <MailCheck className="h-16 w-16 text-accent" />
          </div>
          <CardTitle className="text-3xl font-bold">Confirm Your Email</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            We&apos;ve sent a confirmation link to your email address. Please check your inbox (and spam folder) to activate your Kratia account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive an email? You can request a new one from your account settings after logging in, or contact support if issues persist.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/auth/login">
              <LogIn className="mr-2 h-5 w-5" /> Back to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div>Loading confirmation...</div>}>
      <ConfirmContent />
    </Suspense>
  )
}
