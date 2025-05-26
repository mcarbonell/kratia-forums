
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, AlertTriangle, Edit } from "lucide-react";
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { SiteSettings } from '@/lib/types';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useTranslation } from 'react-i18next';

export default function ConstitutionPage() {
  const [constitutionText, setConstitutionText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { user: loggedInUser, loading: authLoading } = useMockAuth();
  const { t } = useTranslation('common');

  useEffect(() => {
    const fetchConstitution = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const constitutionRef = doc(db, "site_settings", "constitution");
        const docSnap = await getDoc(constitutionRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as SiteSettings;
          setConstitutionText(data.constitutionText || t('constitutionPage.error.textNotAvailable'));
          if (data.lastUpdated) {
            setLastUpdated(new Date(data.lastUpdated).toLocaleString());
          }
        } else {
          setError(t('constitutionPage.error.notFound'));
          setConstitutionText(t('constitutionPage.unavailable'));
        }
      } catch (err) {
        console.error("Error fetching constitution:", err);
        setError(t('constitutionPage.error.loadFail'));
        setConstitutionText(t('constitutionPage.error.loadingError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchConstitution();
  }, [t]);

  const canProposeChange = loggedInUser && loggedInUser.canVote && loggedInUser.status === 'active';

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">{t('constitutionPage.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <FileText className="mr-3 h-8 w-8 text-primary" />
          {t('constitutionPage.title')}
        </h1>
        {canProposeChange && (
          <Button asChild>
            <Link href="/agora/propose-constitution-change">
              <Edit className="mr-2 h-5 w-5" /> {t('constitutionPage.proposeChangeButton')}
            </Link>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>{t('constitutionPage.error.errorTitle')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('constitutionPage.cardTitle')}</CardTitle>
          {lastUpdated && <p className="text-xs text-muted-foreground">{t('constitutionPage.lastUpdated')}: {lastUpdated}</p>}
        </CardHeader>
        <CardContent>
          {constitutionText ? (
            <ScrollArea className="h-[calc(100vh-25rem)] p-4 border rounded-md bg-background/50">
              <div
                className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none dark:prose-invert whitespace-pre-line"
                dangerouslySetInnerHTML={{
                  __html: constitutionText
                            .replace(/^## (.*?)$/gm, '<h2>$1</h2>') 
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                            .replace(/\*(.*?)\*/g, '<em>$1</em>') 
                }}
              />
            </ScrollArea>
          ) : (
            !error && <p>{t('constitutionPage.noTextAvailable')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    