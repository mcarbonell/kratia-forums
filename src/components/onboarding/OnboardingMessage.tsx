
"use client";

import { useEffect, useState } from 'react';
import { generatePersonalizedOnboardingMessage, type PersonalizedOnboardingMessageInput, type PersonalizedOnboardingMessageOutput } from '@/ai/flows/personalized-onboarding-message';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, AlertTriangle, CheckCircle, Gift } from 'lucide-react';
import { KRATIA_CONFIG } from '@/lib/config';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

interface OnboardingMessageProps {
  username: string;
  onAccepted?: () => void;
}

export default function OnboardingMessage({ username, onAccepted }: OnboardingMessageProps) {
  const { user, syncUserWithFirestore } = useMockAuth();
  const { toast } = useToast();
  const { t } = useTranslation('common');

  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingMessage, setIsLoadingMessage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasAcceptedLocally, setHasAcceptedLocally] = useState(false);

  useEffect(() => {
    if (!username) {
      setIsLoadingMessage(false);
      setError(t('onboarding.error.noUsername'));
      return;
    }

    const cacheKey = `onboardingMessage_${username}`;
    const cachedMessage = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;

    if (cachedMessage) {
      setMessage(cachedMessage);
      setIsLoadingMessage(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    let timeoutId: NodeJS.Timeout;

    const fetchOnboardingMessage = async () => {
      setIsLoadingMessage(true);
      setError(null);

      timeoutId = setTimeout(() => {
        if (!signal.aborted) {
          controller.abort();
          setError(t('onboarding.error.timeout'));
          setIsLoadingMessage(false);
        }
      }, 20000);

      try {
        const input: PersonalizedOnboardingMessageInput = {
          username,
          forumName: t(KRATIA_CONFIG.FORUM_NAME), // Assuming FORUM_NAME might be a key
          daysToKarma: KRATIA_CONFIG.DAYS_TO_KARMA_ELIGIBILITY,
          karmaThreshold: KRATIA_CONFIG.KARMA_THRESHOLD_FOR_VOTING,
        };
        
        const output: PersonalizedOnboardingMessageOutput = await generatePersonalizedOnboardingMessage(input);
        
        if (signal.aborted) return; 

        clearTimeout(timeoutId);
        setMessage(output.message);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, output.message);
        }
      } catch (e: any) {
        if (signal.aborted) return; 
        clearTimeout(timeoutId);
        console.error("Failed to generate onboarding message:", e);
        
        let displayError = t('onboarding.error.genericFail');
        if (e.message?.toLowerCase().includes('api key') || e.message?.toLowerCase().includes('permission denied') || e.message?.toLowerCase().includes('quota')) {
          displayError = t('onboarding.error.aiServiceConfig');
        } else if (e.message?.toLowerCase().includes('aborted')) {
          displayError = t('onboarding.error.timeout');
        }
        setError(displayError);
      } finally {
        if (!signal.aborted) {
          setIsLoadingMessage(false);
        }
      }
    };

    fetchOnboardingMessage();

    return () => {
      clearTimeout(timeoutId);
      if (!signal.aborted) {
        controller.abort();
      }
    };
  }, [username, t]);

  const handleAcceptWelcome = async () => {
    if (!user || user.id === 'visitor0' || user.id === 'guest1') {
      toast({ title: t('common.error'), description: t('onboarding.error.userNotIdentified'), variant: "destructive" });
      return;
    }
    setIsAccepting(true);
    try {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        onboardingAccepted: true,
        karma: increment(1)
      });
      toast({
        title: t('onboarding.toast.acceptedTitle'),
        description: t('onboarding.toast.acceptedDesc'),
        action: <CheckCircle className="text-green-500" />
      });
      setHasAcceptedLocally(true);
      if (onAccepted) onAccepted();
      
      if (user && syncUserWithFirestore) {
        await syncUserWithFirestore(user);
      }

    } catch (err) {
      console.error("Error accepting welcome:", err);
      toast({ title: t('common.error'), description: t('onboarding.toast.acceptanceError'), variant: "destructive" });
    } finally {
      setIsAccepting(false);
    }
  };

  if (hasAcceptedLocally) {
    return null;
  }

  if (isLoadingMessage) {
    return (
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-6 w-6 text-primary" />
            {t('onboarding.loadingTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">{t('onboarding.loadingDesc')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-5 w-5"/>
        <AlertTitle>{t('onboarding.error.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!message) {
    return null; 
  }

  return (
    <Card className="shadow-xl border-2 border-accent/50 bg-gradient-to-br from-background to-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center text-2xl">
          <Sparkles className="mr-3 h-7 w-7 text-accent animate-pulse" />
          {t('onboarding.welcomeTitle', { username })}
        </CardTitle>
        <CardDescription>{t('onboarding.welcomeDesc', { forumName: t(KRATIA_CONFIG.FORUM_NAME) })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none p-4 bg-background/50 rounded-md shadow-inner">
          {message.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0">{paragraph.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</p>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <Button onClick={handleAcceptWelcome} disabled={isAccepting} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
          {isAccepting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gift className="mr-2 h-5 w-5" />}
          {isAccepting ? t('onboarding.acceptingButton') : t('onboarding.acceptButton')}
        </Button>
      </CardFooter>
    </Card>
  );
}
