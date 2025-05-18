
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MailCheck, ShieldCheck, LogIn, Hourglass, Home, BadgeInfo } from "lucide-react";
import { useSearchParams } from 'next/navigation';
import { Suspense } from "react";

function ConfirmContent() {
  const searchParams = useSearchParams();
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
            <CardTitle className="text-3xl font-bold">Verify Your Email</CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
              A verification link has been sent to <strong>{email || "your email address"}</strong>.
              Please check your inbox (and spam folder) to activate your Kratia account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              After verifying your email, please <Link href="/auth/login" className="font-medium text-primary hover:underline">log in</Link> to complete your admission request to the community.
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

  // Default fallback (though should ideally not be reached with current flows)
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-15rem)] py-12">
      <Card className="mx-auto max-w-md w-full text-center shadow-xl">
        <CardHeader>
          <div className="inline-block mx-auto mb-6 p-4 bg-accent/10 rounded-full">
            <BadgeInfo className="h-16 w-16 text-accent" />
          </div>
          <CardTitle className="text-3xl font-bold">Confirmation Page</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            Please follow the instructions provided.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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


export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Loading confirmation...</div>}>
      <ConfirmContent />
    </Suspense>
  )
}
