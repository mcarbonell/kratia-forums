
"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UserPlus, LogIn, Loader2, ShieldCheck, Vote, Sparkles, AlertTriangle, Database, MessageSquare, User, FolderOpen } from 'lucide-react';
import { useMockAuth, type MockUser, type UserRole } from '@/hooks/use-mock-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ForumList from '@/components/forums/ForumList';
import OnboardingMessage from '@/components/onboarding/OnboardingMessage';
import { useEffect, useState, useCallback } from 'react';
import type { ForumCategory, Forum } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { seedDatabase } from '@/lib/seedDatabase';
import { useToast } from '@/hooks/use-toast';
import { KRATIA_CONFIG } from '@/lib/config'; // Re-added for forum name
import { useTranslation } from 'next-i18next';


export default function HomePage() {
  const { user, loading: authLoading, syncUserWithFirestore } = useMockAuth();
  const { t } = useTranslation('common'); // Re-enabled

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedCompleted, setSeedCompleted] = useState(false);
  const { toast } = useToast();

  const showOnboarding = user && user.username &&
                         user.isQuarantined &&
                         (user.onboardingAccepted === undefined || user.onboardingAccepted === false);

  const handleOnboardingAccepted = useCallback(async () => {
    if (user && syncUserWithFirestore) {
        await syncUserWithFirestore(user);
    }
  }, [user, syncUserWithFirestore]);


  const fetchCategoriesAndForums = useCallback(async () => {
    setIsLoadingCategories(true);
    setCategoriesError(null);
    try {
      const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const fetchedCategories: ForumCategory[] = [];

      const forumsSnapshot = await getDocs(collection(db, "forums"));
      const allForums: Forum[] = forumsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
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
    } catch (err) {
      console.error("Error fetching categories and forums for homepage:", err);
      setCategoriesError(t('errorFetchingCategories'));
    } finally {
      setIsLoadingCategories(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]); // Added t as dependency

  useEffect(() => {
    fetchCategoriesAndForums();
  }, [fetchCategoriesAndForums]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('dbSeedCompleted');
      if (completed === 'true') {
        setSeedCompleted(true);
      }
    }
  }, []);

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
      toast({
        title: t('seedSuccessTitle'),
        description: t('seedSuccessDesc'),
      });
      localStorage.setItem('dbSeedCompleted', 'true');
      setSeedCompleted(true);
      // Re-fetch categories after seeding
      await fetchCategoriesAndForums();
    } catch (error) {
      console.error("Error seeding database:", error);
      toast({
        title: t('seedErrorTitle'),
        description: t('seedErrorDesc'),
        variant: "destructive",
      });
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

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-3xl font-bold">{t('welcomeTitle', { forumName: KRATIA_CONFIG.FORUM_NAME })}</h1>
      <p>{t('welcomeMessage')}</p>

      {!authLoading && (!user || user.role === 'visitor') && (
         <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
            <Button size="md" asChild>
              <Link href="/auth/signup">
                <UserPlus className="mr-2 h-4 w-4" /> {t('joinCommunityButton')}
              </Link>
            </Button>
            <Button size="md" variant="outline" asChild>
              <Link href="/auth/login">
                <LogIn className="mr-2 h-4 w-4" /> {t('memberLoginButton')}
              </Link>
            </Button>
          </div>
      )}
      
      {/* Conditionally render Seed Database button based on NODE_ENV */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 border border-dashed border-red-500 bg-red-50">
            <h2 className="text-lg font-semibold text-red-700">{t('devToolsTitle')}</h2>
            <Button onClick={handleSeedDatabase} disabled={isSeeding || seedCompleted}>
                {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {seedCompleted ? t('seedCompletedButton') : t('seedDatabaseButton')}
            </Button>
            {isSeeding && <p className="text-sm text-red-600 mt-2">{t('seedInProgress')}</p>}
            {seedCompleted && !isSeeding && <p className="text-sm text-green-600 mt-2">{t('seedSuccessDescRefresh')}</p>}
        </div>
      )}
      
      {showOnboarding && user && (
        <div className="my-8">
            <OnboardingMessage username={user.username} onAccepted={handleOnboardingAccepted} />
        </div>
      )}

      {isLoadingCategories && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">{t('loadingCategories')}</p>
        </div>
      )}
      {categoriesError && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="flex items-center text-destructive"><AlertTriangle className="mr-2 h-5 w-5" />{t('errorLoadingForums')}</CardTitle></CardHeader>
          <CardContent><p className="text-destructive">{categoriesError}</p></CardContent>
        </Card>
      )}
      {!isLoadingCategories && !categoriesError && categories.length > 0 && (
        <ForumList categories={categories} />
      )}
      {!isLoadingCategories && !categoriesError && categories.length === 0 && (
         <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">{t('noForumCategories')}</p>
              <p className="text-muted-foreground">{t('noForumCategoriesDesc')}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
