import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MailCheck, LogIn } from "lucide-react";

export default function ConfirmEmailPage() {
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