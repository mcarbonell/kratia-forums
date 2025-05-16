
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ban, LogOut, Home } from "lucide-react";
import { format } from 'date-fns';

export default function SanctionedPage() {
  const { user: loggedInUser, logout } = useMockAuth();
  const router = useRouter();
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [sanctionEndDate, setSanctionEndDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (loggedInUser) {
      if (loggedInUser.status !== 'sanctioned') {
        // If user is somehow not sanctioned, redirect away
        router.replace('/');
      } else {
        setUsername(loggedInUser.username);
        setSanctionEndDate(loggedInUser.sanctionEndDate);
      }
    } else {
      // If no user is logged in, they shouldn't be here
      router.replace('/auth/login');
    }
  }, [loggedInUser, router]);

  const handleLogout = () => {
    logout();
    router.push('/'); // Redirect to homepage after logout
  };

  const handleContinueAsVisitor = () => {
    logout(); // Effectively logs out to visitor state
    router.push('/');
  };

  if (!loggedInUser || loggedInUser.status !== 'sanctioned') {
    // Still loading or redirecting
    return <div className="flex justify-center items-center min-h-screen"><Ban className="h-12 w-12 animate-pulse text-destructive" /></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <Card className="mx-auto max-w-md w-full text-center shadow-xl border-destructive">
        <CardHeader>
          <div className="inline-block mx-auto mb-6 p-4 bg-destructive/10 rounded-full">
            <Ban className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-bold">Access Restricted</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            Your account, {username || "User"}, is currently sanctioned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <Ban className="h-5 w-5" />
            <AlertTitle>Sanction Active</AlertTitle>
            <AlertDescription>
              You are unable to participate in the community until your sanction ends.
              {sanctionEndDate && (
                <p className="mt-1">
                  Sanction ends: <strong>{format(new Date(sanctionEndDate), "PPPp")}</strong>
                </p>
              )}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            You can view public content as a visitor or log out.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleContinueAsVisitor} variant="outline" className="w-full sm:w-auto">
              <Home className="mr-2 h-5 w-5" /> Continue as Visitor
            </Button>
            <Button onClick={handleLogout} variant="secondary" className="w-full sm:w-auto">
              <LogOut className="mr-2 h-5 w-5" /> Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
