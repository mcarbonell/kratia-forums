
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ForumList from '@/components/forums/ForumList';
import OnboardingMessage from '@/components/onboarding/OnboardingMessage';
import Link from 'next/link';
import { ShieldCheck, LogIn, UserPlus, Vote, Sparkles, Loader2, AlertTriangle, Database } from 'lucide-react';
import { KRATIA_CONFIG } from '@/lib/config';
import { useMockAuth, type MockUser, type UserRole } from '@/hooks/use-mock-auth'; 
import { useEffect, useState, useCallback } from 'react';
import type { ForumCategory, Forum } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { seedDatabase } from '@/lib/seedDatabase';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'next-i18next'; // Import useTranslation

export default function HomePage() {
  const { user, loading: authLoading, syncUserWithFirestore } = useMockAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedCompleted, setSeedCompleted] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('common'); // Initialize useTranslation

  const showOnboarding = user && user.username &&
                         user.isQuarantined &&
                         (user.onboardingAccepted === undefined || user.onboardingAccepted === false);

  const handleOnboardingAccepted = useCallback(async () => {
    if (user && syncUserWithFirestore) {
      await syncUserWithFirestore(user as MockUser); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, syncUserWithFirestore]);
  
  const fetchCategoriesAndForums = useCallback(async () => {
      setIsLoadingCategories(true);
      setCategoriesError(null);
      try {
        const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const fetchedCategories: ForumCategory[] = [];

        const forumsSnapshot = await getDocs(collection(db, "forums"));
        const allForums: Forum[] = forumsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            threadCount: data.threadCount || 0,
            postCount: data.postCount || 0,
          } as Forum;
        });

        for (const categoryDoc of categoriesSnapshot.docs) {
          const categoryData = categoryDoc.data();
          const categoryForums = allForums.filter(forum => forum.categoryId === categoryDoc.id);
          fetchedCategories.push({
            id: categoryDoc.id,
            name: categoryData.name,
            description: categoryData.description,
            forums: categoryForums,
          });
        }
        setCategories(fetchedCategories);
      } catch (error) {
        console.error("Error fetching categories for homepage:", error);
        setCategoriesError(t('errorLoadingForumsMessage'));
      } finally {
        setIsLoadingCategories(false);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]); 
  
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('db_seeded_kratia') === 'true') {
      setSeedCompleted(true);
    }
    fetchCategoriesAndForums();
  }, [fetchCategoriesAndForums]);


  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
      toast({
        title: t('databaseSeededButton'),
        description: t('databaseSeededMessage'),
      });
      setSeedCompleted(true);
      if (typeof window !== 'undefined') {
          localStorage.setItem('db_seeded_kratia', 'true');
      }
      fetchCategoriesAndForums(); 
    } catch (error) {
      console.error("Error seeding database:", error);
      toast({
        title: "Seeding Failed", // This could be translated too
        description: (error as Error).message || "Could not seed the database. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };
  // console.log(JSON.stringify(user, null, 2));

  return (
    <div className="space-y-12">
      <Card className="text-center bg-gradient-to-r from-primary/10 via-background to-accent/10 shadow-xl border-0 py-10 md:py-16">
        <CardHeader>
          <div className="flex justify-center mb-6">
            <ShieldCheck className="h-20 w-20 text-primary" />
          </div>
          <CardTitle className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {t('homepageWelcomeTitle', { forumName: KRATIA_CONFIG.FORUM_NAME })}
          </CardTitle>
          <CardDescription className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('homepageWelcomeDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!authLoading && (!user || user.role === 'visitor') && (
             <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/auth/signup">
                    <UserPlus className="mr-2 h-5 w-5" /> {t('homepageJoinCommunity')}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/login">
                    <LogIn className="mr-2 h-5 w-5" /> {t('homepageMemberLogin')}
                  </Link>
                </Button>
              </div>
          )}
        </CardContent>
      </Card>

      {process.env.NODE_ENV === 'development' && !seedCompleted && (
        <Card className="shadow-md border-dashed border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-6 w-6 text-primary"/>
              {t('seedDatabaseTitle')}
            </CardTitle>
            <CardDescription>
              {t('seedDatabaseDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSeedDatabase}
              disabled={isSeeding || seedCompleted}
              className="w-full sm:w-auto"
            >
              {isSeeding ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Database className="mr-2 h-5 w-5" />
              )}
              {isSeeding ? t('seedingButton') : seedCompleted ? t('databaseSeededButton') : t('seedDatabaseButton')}
            </Button>
            {seedCompleted && <p className="text-sm text-green-600 mt-2">{t('databaseSeededMessage')}</p>}
          </CardContent>
        </Card>
      )}

      {!authLoading && showOnboarding && user?.username && (
        <section aria-labelledby="onboarding-title">
          <h2 id="onboarding-title" className="sr-only">Personalized Onboarding</h2>
          <OnboardingMessage username={user.username} onAccepted={handleOnboardingAccepted} />
        </section>
      )}
      
      <Card className="shadow-lg border-accent/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold flex items-center text-accent">
            <Vote className="mr-3 h-7 w-7"/> {t('homepageAgoraTitle')}
          </CardTitle>
          <Button asChild variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/agora">
              {t('homepageEnterAgora')} <Sparkles className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t('homepageAgoraDescription')}
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="forum-categories-title">
        <h2 id="forum-categories-title" className="text-3xl font-bold mb-6 text-center md:text-left">
          {t('homepageExploreCommunitiesTitle')}
        </h2>
        {isLoadingCategories && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">{t('loadingForums')}</p>
          </div>
        )}
        {categoriesError && !isLoadingCategories && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="mr-2 h-5 w-5" /> {t('errorLoadingForums')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{categoriesError}</p>
            </CardContent>
          </Card>
        )}
        {!isLoadingCategories && !categoriesError && (
          <ForumList categories={categories} />
        )}
        {!isLoadingCategories && !categoriesError && categories.length === 0 && !seedCompleted && (
             <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <p>{t('noForumCategoriesAvailable')}</p>
                </CardContent>
            </Card>
        )}
         {!isLoadingCategories && !categoriesError && categories.length === 0 && seedCompleted && (
             <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <p>{t('noForumCategoriesInfo')}</p>
                </CardContent>
            </Card>
        )}
      </section>
    </div>
  );
}
