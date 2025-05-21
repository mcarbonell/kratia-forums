
"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserPlus, LogIn, Loader2, ShieldCheck, Vote, Sparkles, AlertTriangle, Database } from 'lucide-react'; // Kept some common icons
import { useMockAuth } from '@/hooks/use-mock-auth';
// import { useTranslation } from 'next-i18next'; // Temporarily commented out
// import { KRATIA_CONFIG } from '@/lib/config'; // Temporarily commented out

// Temporarily commented out these imports if not used in the simplified version
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import ForumList from '@/components/forums/ForumList';
// import OnboardingMessage from '@/components/onboarding/OnboardingMessage';
// import { useEffect, useState, useCallback } from 'react';
// import type { ForumCategory, Forum } from '@/lib/types';
// import { db } from '@/lib/firebase';
// import { collection, getDocs, query, orderBy } from 'firebase/firestore';
// import { seedDatabase } from '@/lib/seedDatabase';
// import { useToast } from '@/hooks/use-toast';


export default function HomePage() {
  const { user, loading: authLoading } = useMockAuth();
  // const { t } = useTranslation('common'); // Temporarily commented out

  // All state and effects related to categories, seeding, onboarding are commented out for this test
  // const [categories, setCategories] = useState<ForumCategory[]>([]);
  // const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  // const [categoriesError, setCategoriesError] = useState<string | null>(null);
  // const [isSeeding, setIsSeeding] = useState(false);
  // const [seedCompleted, setSeedCompleted] = useState(false);
  // const { toast } = useToast();
  // const showOnboarding = user && user.username &&
  //                        user.isQuarantined &&
  //                        (user.onboardingAccepted === undefined || user.onboardingAccepted === false);

  // const handleOnboardingAccepted = useCallback(async () => {
  //   // ...
  // }, [user]);

  // const fetchCategoriesAndForums = useCallback(async () => {
  //   // ...
  //   }, []); // Removed t from dependency

  // useEffect(() => {
  //   // ...
  //   setIsLoadingCategories(false);
  // }, []);

  // const handleSeedDatabase = async () => {
  //   // ...
  // };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Hardcoded English text for now */}
      <h1 className="text-3xl font-bold">Welcome to Kratia Forums! (Test)</h1>
      <p>This is a test to see if the page component itself renders.</p>

      {!authLoading && (!user || user.role === 'visitor') && (
         <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
            <Button size="md" asChild>
              <Link href="/auth/signup">
                <UserPlus className="mr-2 h-4 w-4" /> Join the Community
              </Link>
            </Button>
            <Button size="md" variant="outline" asChild>
              <Link href="/auth/login">
                <LogIn className="mr-2 h-4 w-4" /> Member Login
              </Link>
            </Button>
          </div>
      )}
      
      <div className="mt-8 p-4 border border-dashed border-amber-500 bg-amber-50">
        <h2 className="text-lg font-semibold text-amber-700">Test Section</h2>
        <p className="text-amber-600">If you see this, HomePage.tsx is rendering basic content.</p>
        <p className="text-amber-600">Current user: {user ? user.username : 'Visitor'}</p>
      </div>

      {/* Conditionally render Seed Database button based on NODE_ENV */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 border border-dashed border-red-500 bg-red-50">
            <h2 className="text-lg font-semibold text-red-700">Development Tools</h2>
            {/* <Button onClick={handleSeedDatabase} disabled={isSeeding || seedCompleted}>
                {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {seedCompleted ? "Database Seeded" : "Seed Database with Mock Data"}
            </Button>
            {isSeeding && <p className="text-sm text-red-600 mt-2">Seeding in progress...</p>}
            {seedCompleted && !isSeeding && <p className="text-sm text-green-600 mt-2">Database seeding completed. You might need to refresh.</p>} */}
            <p className="text-sm text-muted-foreground">Seed Database button would be here (functionality commented out for this test).</p>
        </div>
      )}
    </div>
  );
}
