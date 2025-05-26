
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ban, LogOut, Home, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export default function SanctionedPage() {
  const { user: loggedInUser, logout, loading: authLoading } = useMockAuth();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [sanctionEndDate, setSanctionEndDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (loggedInUser && loggedInUser.status === 'sanctioned') {
      setUsername(loggedInUser.username);
      setSanctionEndDate(loggedInUser.sanctionEndDate);
    }
  }, [loggedInUser]);

  const handleLogout = () => {
    logout();
    router.push('/'); 
  };

  const handleContinueAsVisitor = () => {
    logout(); 
    router.push('/');
  };

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t('sanctionedPage.loadingStatus')}</p>
      </div>
    );
  }

  if (!loggedInUser || loggedInUser.status !== 'sanctioned') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>{t('sanctionedPage.verifyingStatus')}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <Card className="mx-auto max-w-md w-full text-center shadow-xl border-destructive">
        <CardHeader>
          <div className="inline-block mx-auto mb-6 p-4 bg-destructive/10 rounded-full">
            <Ban className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-bold">{t('sanctionedPage.title')}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            {t('sanctionedPage.description', { username: username || t('sanctionedPage.userPlaceholder') })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <Ban className="h-5 w-5" />
            <AlertTitle>{t('sanctionedPage.alertTitle')}</AlertTitle>
            <AlertDescription>
              {t('sanctionedPage.alertDescription')}
              {sanctionEndDate && (
                <p className="mt-1">
                  {t('sanctionedPage.sanctionEnds')}: <strong>{format(new Date(sanctionEndDate), "PPPp")}</strong>
                </p>
              )}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            {t('sanctionedPage.optionsInfo')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleContinueAsVisitor} variant="outline" className="w-full sm:w-auto">
              <Home className="mr-2 h-5 w-5" /> {t('sanctionedPage.continueAsVisitorButton')}
            </Button>
            <Button onClick={handleLogout} variant="secondary" className="w-full sm:w-auto">
              <LogOut className="mr-2 h-5 w-5" /> {t('sanctionedPage.logoutButton')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    