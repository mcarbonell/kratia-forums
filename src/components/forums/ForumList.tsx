
"use client";

import type { ForumCategory } from '@/lib/types';
import ForumListItem from './ForumListItem';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ForumListProps {
  categories: ForumCategory[];
}

export default function ForumList({ categories }: ForumListProps) {
  const { t } = useTranslation('common');

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-10">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">{t('forumList.noCategories')}</p>
            <p className="text-muted-foreground">
              {t('forumList.noCategoriesDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category.id} aria-labelledby={`category-title-${category.id}`}>
          <Card className="overflow-hidden shadow-md">
            <CardHeader className="bg-muted/30">
              <CardTitle id={`category-title-${category.id}`} className="text-xl md:text-2xl font-semibold text-primary">
                {t(category.name)}
              </CardTitle>
              {category.description && <p className="text-sm text-muted-foreground mt-1">{t(category.description)}</p>}
            </CardHeader>
            <CardContent className="p-0">
              {category.forums && category.forums.length > 0 ? (
                <div className="divide-y">
                  {category.forums.map((forum) => (
                    <div key={forum.id} className="p-4">
                       <ForumListItem forum={forum} />
                    </div>
                  ))}
                </div>
              ) : (
                 <div className="p-6 text-center text-muted-foreground">
                  <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/70 mb-2" />
                  <p>{t('forumList.noForumsInCategory')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
