
"use client";

import ForumList from '@/components/forums/ForumList';
import { MessageSquare, Loader2, AlertTriangle, PlusCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import type { ForumCategory, Forum } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useTranslation } from 'react-i18next';

export default function ForumsPage() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useMockAuth();
  const { t } = useTranslation('common');

  useEffect(() => {
    const fetchCategoriesAndForums = async () => {
      setIsLoading(true);
      setError(null);
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
            isPublic: data.isPublic === undefined ? true : data.isPublic,
          } as Forum;
        });

        for (const categoryDoc of categoriesSnapshot.docs) {
          const categoryData = categoryDoc.data();
          let categoryForums = allForums.filter(forum => forum.categoryId === categoryDoc.id);
          
          if (user && (user.role === 'visitor' || user.role === 'guest')) {
            categoryForums = categoryForums.filter(forum => forum.isPublic);
          }
          
          fetchedCategories.push({
            id: categoryDoc.id,
            name: categoryData.name,
            description: categoryData.description,
            forums: categoryForums,
          });
        }
        setCategories(fetchedCategories);
      } catch (err) {
        console.error("Error fetching categories and forums:", err);
        setError(t('forumsPage.error.loadFail'));
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) { // Fetch data once auth state is resolved
        fetchCategoriesAndForums();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, t]); // Added t to dependencies

  const canProposeForum = user && user.canVote && user.status === 'active';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center">
          <MessageSquare className="mr-3 h-8 w-8 text-primary" />
          {t('forumsPage.title')}
        </h1>
        {!authLoading && canProposeForum && (
          <Button asChild>
            <Link href="/agora/propose-new-forum/">
              <PlusCircle className="mr-2 h-5 w-5" /> {t('forumsPage.proposeNewForumButton')}
            </Link>
          </Button>
        )}
      </div>
      <section aria-labelledby="forum-categories-title">
        <h2 id="forum-categories-title" className="sr-only">
          {t('forumsPage.categoriesTitle')}
        </h2>
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">{t('forumsPage.loadingCategories')}</p>
          </div>
        )}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="mr-2 h-5 w-5" /> {t('common.error')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}
        {!isLoading && !error && (
          <ForumList categories={categories} />
        )}
      </section>
    </div>
  );
}
    
