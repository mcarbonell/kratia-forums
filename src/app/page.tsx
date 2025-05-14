"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ForumList from '@/components/forums/ForumList';
import OnboardingMessage from '@/components/onboarding/OnboardingMessage';
import { mockCategories, mockUsers } from '@/lib/mockData'; // Assuming mockUsers for onboarding example
import Link from 'next/link';
import { ShieldCheck, LogIn, UserPlus, Vote, Sparkles } from 'lucide-react';
import { KRATIA_CONFIG } from '@/lib/config';
import { useMockAuth } from '@/hooks/use-mock-auth';

export default function HomePage() {
  const { user, loading } = useMockAuth();
  
  // For onboarding, we'd typically get the current user.
  // If a new user just signed up, their details would be available.
  // For this mock, let's show onboarding for a specific mock user if they are "new" or based on some condition.
  // Or, if no user is logged in, we could show a generic welcome.
  // Let's show onboarding for DianaNewbie (user4) if she's the current user.
  const showOnboarding = user?.id === 'user4' && user.isQuarantined;

  return (
    <div className="space-y-12">
      <Card className="text-center bg-gradient-to-r from-primary/10 via-background to-accent/10 shadow-xl border-0 py-10 md:py-16">
        <CardHeader>
          <div className="flex justify-center mb-6">
            <ShieldCheck className="h-20 w-20 text-primary" />
          </div>
          <CardTitle className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Welcome to <span className="text-primary">{KRATIA_CONFIG.FORUM_NAME}</span>!
          </CardTitle>
          <CardDescription className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            A new era of community-driven forums with direct democracy. Your voice shapes our space.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && (!user || user.role === 'visitor') && (
             <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/auth/signup">
                    <UserPlus className="mr-2 h-5 w-5" /> Join the Community
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/login">
                    <LogIn className="mr-2 h-5 w-5" /> Member Login
                  </Link>
                </Button>
              </div>
          )}
        </CardContent>
      </Card>

      {/* Personalized Onboarding Message Section */}
      {!loading && showOnboarding && user?.username && (
        <section aria-labelledby="onboarding-title">
          <h2 id="onboarding-title" className="sr-only">Personalized Onboarding</h2>
          <OnboardingMessage username={user.username} />
        </section>
      )}
      
      {/* Agora Highlight */}
      <Card className="shadow-lg border-accent/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold flex items-center text-accent">
            <Vote className="mr-3 h-7 w-7"/> The Agora: Shape Our Future
          </CardTitle>
          <Button asChild variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/agora">
              Enter Agora <Sparkles className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Participate in binding votations, propose new initiatives, and contribute to the governance of Kratia. 
            Your vote matters here.
          </p>
        </CardContent>
      </Card>

      {/* Forum Listings */}
      <section aria-labelledby="forum-categories-title">
        <h2 id="forum-categories-title" className="text-3xl font-bold mb-6 text-center md:text-left">
          Explore Our Communities
        </h2>
        <ForumList categories={mockCategories} />
      </section>

    </div>
  );
}