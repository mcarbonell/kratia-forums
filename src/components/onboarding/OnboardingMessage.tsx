
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

interface OnboardingMessageProps {
  username: string;
  onAccepted?: () => void; // Callback to notify parent
}

export default function OnboardingMessage({ username, onAccepted }: OnboardingMessageProps) {
  const { user, syncUserWithFirestore } = useMockAuth(); // Get user and sync function
  const { toast } = useToast();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingMessage, setIsLoadingMessage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasAcceptedLocally, setHasAcceptedLocally] = useState(false); // To hide immediately

  useEffect(() => {
    if (!username) {
      setIsLoadingMessage(false);
      setError("Username not provided for onboarding message.");
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
          setError("The welcome message is taking too long to generate. Please try again later or explore the forum!");
          setIsLoadingMessage(false);
        }
      }, 20000);

      try {
        const input: PersonalizedOnboardingMessageInput = {
          username,
          forumName: KRATIA_CONFIG.FORUM_NAME,
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
        
        let displayError = "Could not generate your personalized welcome message at this time. Please explore the forum!";
        if (e.message?.toLowerCase().includes('api key') || e.message?.toLowerCase().includes('permission denied') || e.message?.toLowerCase().includes('quota')) {
          displayError = "Could not generate the welcome message due to an AI service configuration issue. The site administrator has been notified.";
        } else if (e.message?.toLowerCase().includes('aborted')) {
          displayError = "Welcome message generation timed out. Please explore the forum!";
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
  }, [username]);

  const handleAcceptWelcome = async () => {
    if (!user || user.id === 'visitor0' || user.id === 'guest1') {
      toast({ title: "Error", description: "User not properly identified.", variant: "destructive" });
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
        title: "Welcome Accepted!",
        description: "You've earned +1 karma! Enjoy Kratia Forums.",
        action: <CheckCircle className="text-green-500" />
      });
      setHasAcceptedLocally(true); // Hide component immediately
      if (onAccepted) onAccepted(); // Notify parent
      
      // Attempt to re-sync user data in useMockAuth for immediate reflection if possible
      // This relies on useMockAuth's internal re-syncing mechanism after a Firestore update
      if (user && syncUserWithFirestore) {
        await syncUserWithFirestore(user);
      }

    } catch (err) {
      console.error("Error accepting welcome:", err);
      toast({ title: "Error", description: "Could not save your acceptance. Please try again.", variant: "destructive" });
    } finally {
      setIsAccepting(false);
    }
  };

  if (hasAcceptedLocally) {
    return null; // Don't render if accepted locally
  }

  if (isLoadingMessage) {
    return (
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-6 w-6 text-primary" />
            Generating Your Welcome...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Crafting a special message just for you!</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-5 w-5"/>
        <AlertTitle>Welcome Message Error</AlertTitle>
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
          A Special Welcome, {username}!
        </CardTitle>
        <CardDescription>Here's a personalized message to help you get started in {KRATIA_CONFIG.FORUM_NAME}:</CardDescription>
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
          {isAccepting ? "Accepting..." : "Accept Welcome & Get +1 Karma!"}
        </Button>
      </CardFooter>
    </Card>
  );
}
