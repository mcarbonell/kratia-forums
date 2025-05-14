"use client";

import { useEffect, useState } from 'react';
import { generatePersonalizedOnboardingMessage, type PersonalizedOnboardingMessageInput, type PersonalizedOnboardingMessageOutput } from '@/ai/flows/personalized-onboarding-message';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Sparkles } from 'lucide-react';
import { KRATIA_CONFIG } from '@/lib/config';

interface OnboardingMessageProps {
  username: string;
}

export default function OnboardingMessage({ username }: OnboardingMessageProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setIsLoading(false);
      setError("Username not provided for onboarding message.");
      return;
    }

    const fetchOnboardingMessage = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const input: PersonalizedOnboardingMessageInput = {
          username,
          forumName: KRATIA_CONFIG.FORUM_NAME,
          daysToKarma: KRATIA_CONFIG.DAYS_TO_KARMA_ELIGIBILITY,
          karmaThreshold: KRATIA_CONFIG.KARMA_THRESHOLD_FOR_VOTING,
        };
        const output: PersonalizedOnboardingMessageOutput = await generatePersonalizedOnboardingMessage(input);
        setMessage(output.message);
      } catch (e) {
        console.error("Failed to generate onboarding message:", e);
        setError("Could not generate your personalized welcome message at this time. Please explore the forum!");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnboardingMessage();
  }, [username]);

  if (isLoading) {
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
        <AlertTitle>Welcome Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!message) {
    return null; // Or some fallback if message is null but no error
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
    </Card>
  );
}