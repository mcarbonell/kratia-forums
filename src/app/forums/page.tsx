
"use client";

import ForumList from '@/components/forums/ForumList';
import { MessageSquare, Loader2, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ForumCategory, Forum } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForumsPage() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategoriesAndForums = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const categoriesQuery = query(collection(db, "categories"), orderBy("name"));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const fetchedCategories: ForumCategory[] = [];

        // Fetch all forums once
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
          // Filter forums for the current category client-side
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
        console.error("Error fetching categories and forums:", err);
        setError("Failed to load forum categories. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategoriesAndForums();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <MessageSquare className="mr-3 h-8 w-8 text-primary" />
          Forums
        </h1>
      </div>
      <section aria-labelledby="forum-categories-title">
        <h2 id="forum-categories-title" className="sr-only">
          Forum Categories
        </h2>
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Loading forum categories...</p>
          </div>
        )}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="mr-2 h-5 w-5" /> Error Loading Forums
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
