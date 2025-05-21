
"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserPlus, LogIn, Loader2, FileText, Info, RotateCcw } from 'lucide-react';
import { useMockAuth, type MockUser, type UserRole } from '@/hooks/use-mock-auth'; // Ensure UserRole is imported
// import { useTranslation } from 'next-i18next'; // REMOVED
import { useTranslation } from 'react-i18next'; // ADDED
import { KRATIA_CONFIG } from '@/lib/config';
import ForumList from '@/components/forums/ForumList';
import type { ForumCategory, Forum } from '@/lib/types';
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import OnboardingMessage from '@/components/onboarding/OnboardingMessage';
import { useToast } from '@/hooks/use-toast';
// Removed seedDatabase and related Firebase imports as seeding is now done via a button

export default function HomePage() {
  const { user, loading: authLoading, syncUserWithFirestore } = useMockAuth();
  const { t } = useTranslation('common');

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [errorCategories, setErrorCategories] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedCompleted, setSeedCompleted] = useState(false);

  // Helper function to log and set error
  const logAndSetError = (message: string, error?: any) => {
    console.error(message, error || '');
    setErrorCategories(message);
  };

  const fetchCategoriesAndForums = useCallback(async () => {
    if (!user) { // Wait for user to be determined
        // console.log('[HomePage] Fetching categories deferred: user object not yet available.');
        // setIsLoadingCategories(false); // Potentially stop loading if no user to prevent infinite load on auth issues
        return;
    }
    // console.log('[HomePage] Starting to fetch categories and forums. Current user role:', user?.role);
    setIsLoadingCategories(true);
    setErrorCategories(null);

    try {
      const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const fetchedCategoriesData: ForumCategory[] = [];

      const forumsSnapshot = await getDocs(collection(db, "forums"));
      const allForums: Forum[] = forumsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          threadCount: data.threadCount || 0,
          postCount: data.postCount || 0,
          isPublic: data.isPublic === undefined ? true : data.isPublic, // Default to true
        } as Forum;
      });
      // console.log(`[HomePage] Fetched ${allForums.length} total forums.`);

      for (const categoryDoc of categoriesSnapshot.docs) {
        const categoryData = categoryDoc.data();
        let categoryForums = allForums.filter(forum => forum.categoryId === categoryDoc.id);

        if (user.role === 'visitor' || user.role === 'guest') {
          categoryForums = categoryForums.filter(forum => forum.isPublic);
        }
        // console.log(`[HomePage] Category '${categoryData.name}' (ID: ${categoryDoc.id}) has ${categoryForums.length} visible forums for current user.`);
        
        fetchedCategoriesData.push({
          id: categoryDoc.id,
          name: categoryData.name,
          description: categoryData.description,
          forums: categoryForums,
        });
      }
      setCategories(fetchedCategoriesData);
      // console.log('[HomePage] Successfully fetched and processed categories and forums:', fetchedCategoriesData);
    } catch (err) {
      logAndSetError("Failed to load forum categories. Please try again later.", err);
    } finally {
      setIsLoadingCategories(false);
      // console.log('[HomePage] Finished fetching categories and forums.');
    }
  }, [user]); // Depend on user object

  useEffect(() => {
    // console.log('[HomePage] User or authLoading state changed. User:', user, 'AuthLoading:', authLoading);
    if (!authLoading && user) { // Ensure user is loaded before fetching or deciding onboarding
      fetchCategoriesAndForums();
      if (user.username && !user.onboardingAccepted && user.isQuarantined) {
        // console.log('[HomePage] Conditions met for showing onboarding.');
        setShowOnboarding(true);
      } else {
        // console.log('[HomePage] Conditions NOT met for showing onboarding. Onboarding accepted:', user.onboardingAccepted, 'Is quarantined:', user.isQuarantined);
        setShowOnboarding(false);
      }
    } else if (!authLoading && !user) { // Case where loading is done, but no user (e.g., initial visitor state before sync)
        // console.log('[HomePage] Auth loading finished, but no user object yet. Possibly initial visitor state.');
        // This might be where we need to ensure fetchCategoriesAndForums is called for visitors too
        // Or, if `user` is guaranteed to be at least 'visitor0', this branch might not be common.
        // Let's assume `user` will eventually be set to 'visitor0' by useMockAuth if no one is logged in.
        // If categories should be shown to visitors by default, fetchCategoriesAndForums might need to be called
        // outside the `if (user)` check or `useMockAuth` should always provide a non-null user object.
        // For now, let's ensure it runs if user is visitor0
         if (user === null || user?.id === 'visitor0') { // Explicitly check for visitor0 if user is null initially
             fetchCategoriesAndForums();
         }
        setShowOnboarding(false); // No onboarding for null user or visitor0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [user, authLoading, fetchCategoriesAndForums]); // fetchCategoriesAndForums is memoized with useCallback

  const handleOnboardingAccepted = async () => {
    setShowOnboarding(false);
    if (user && syncUserWithFirestore) { // Ensure user and sync function exist
      await syncUserWithFirestore(user as MockUser); // Perform sync after accepting
    }
  };
  
  // console.log('[HomePage] Rendering. AuthLoading:', authLoading, 'User:', JSON.stringify(user, null, 2));
  // console.log('[HomePage] Show onboarding state:', showOnboarding);

  // This is the seeding logic previously in page.tsx, moved here
  const handleSeedDatabase = async () => {
    // Dynamic import for seedDatabase to avoid including it in main bundle if not used
    setIsSeeding(true);
    try {
      const { seedDatabase } = await import('@/lib/seedDatabase');
      await seedDatabase();
      toast({
        title: "Database Seeded!",
        description: "Mock data has been added to your Firestore. You might need to refresh.",
      });
      setSeedCompleted(true);
      // After seeding, re-fetch categories and forums
      if (user) { // Check if user object is available
        fetchCategoriesAndForums();
      }
    } catch (error: any) {
      console.error("Error seeding database:", error);
      toast({
        title: "Error Seeding Database",
        description: error.message || "Could not seed the database.",
        variant: "destructive",
      });
      setSeedCompleted(false); // Reset on error
    } finally {
      setIsSeeding(false);
    }
  };


  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // const showDevTools = process.env.NODE_ENV === 'development';
  // Temporary always true for testing
  const showDevTools = true;


  return (
    <div className="space-y-12">
      <Card className="text-center bg-gradient-to-r from-primary/10 via-background to-accent/10 shadow-xl border-0 py-10 md:py-16">
        <CardHeader>
          <CardTitle className="text-4xl md:text-5xl font-bold tracking-tight">
            {t('welcomeTitle', { forumName: KRATIA_CONFIG.FORUM_NAME })}
          </CardTitle>
          <CardDescription className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mt-4">
            {t('welcomeMessage')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!authLoading && (!user || user.role === 'visitor') && (
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button size="lg" asChild>
                <Link href="/auth/signup">
                  <UserPlus className="mr-2 h-5 w-5" /> {t('joinCommunityButton')}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">
                  <LogIn className="mr-2 h-5 w-5" /> {t('memberLoginButton')}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* {user && user.username && !user.onboardingAccepted && user.isQuarantined && ( */}
      {showOnboarding && user && user.username && (
        <OnboardingMessage username={user.username} onAccepted={handleOnboardingAccepted} />
      )}

      <section aria-labelledby="forum-categories-title">
        <h2 id="forum-categories-title" className="text-3xl font-semibold tracking-tight mb-6 flex items-center">
          <FileText className="mr-3 h-7 w-7 text-accent" />
          {t('forumListTitle')}
        </h2>
        {isLoadingCategories && !errorCategories && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">{t('loadingCategories')}</p>
          </div>
        )}
        {errorCategories && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <Info className="mr-2 h-5 w-5" /> {t('errorLoadingForumsTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{errorCategories}</p>
            </CardContent>
          </Card>
        )}
        {!isLoadingCategories && !errorCategories && (
          <ForumList categories={categories} />
        )}
      </section>
      
      {/* Developer Tools Section - Conditionally Rendered */}
      {showDevTools && (
        <div className="mt-12 p-6 border-2 border-dashed border-destructive/50 bg-destructive/5 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-destructive flex items-center mb-4">
            <RotateCcw className="mr-2 h-6 w-6" />
            {t('devToolsTitle')}
          </h2>
          <Button onClick={handleSeedDatabase} disabled={isSeeding || seedCompleted} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {seedCompleted ? t('seedCompletedButton') : t('seedDatabaseButton')}
          </Button>
          {isSeeding && <p className="text-sm text-destructive/80 mt-2">{t('seedInProgress')}</p>}
          {seedCompleted && !isSeeding && <p className="text-sm text-green-600 mt-2">{t('seedSuccessDescRefresh')}</p>}
           <p className="text-xs text-muted-foreground mt-3">
            Current User (for debugging): {user ? `${user.username} (Role: ${user.role}, Status: ${user.status}, Onboarding: ${user.onboardingAccepted}, Quarantined: ${user.isQuarantined})` : 'Visitor/Loading'}
          </p>
        </div>
      )}
      
      {/* Test Section for basic rendering confirmation */}
      <div className="bg-sky-100 p-4 rounded-md border border-sky-300 mt-8">
        <h2 className="text-xl font-semibold text-sky-700">Homepage Content Test Area</h2>
        <p className="text-sky-600">If you see this text, the HomePage component itself is rendering.</p>
        <p className="text-sky-600">Current translated welcome title (should be above): "{t('welcomeTitle', { forumName: "Kratia Forums" })}"</p>
        <p className="text-amber-600">Current user: {user ? user.username : 'Visitor'}</p>
      </div>
    </div>
  );
}
