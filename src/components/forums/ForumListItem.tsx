
"use client";

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareText, CornerDownRight, Eye, Lock, Vote as VoteIconLucide } from 'lucide-react';
import type { Forum } from '@/lib/types';
import { useTranslation } from 'react-i18next';

interface ForumListItemProps {
  forum: Forum;
  isSubForum?: boolean;
}

export default function ForumListItem({ forum, isSubForum = false }: ForumListItemProps) {
  const { t } = useTranslation('common');
  return (
    <Card className={`hover:shadow-lg transition-shadow duration-200 ${isSubForum ? 'ml-6 bg-card/80' : 'bg-card'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          <Link href={`/forums/${forum.id}`} className="hover:text-primary transition-colors flex items-center">
            {isSubForum && <CornerDownRight className="mr-2 h-5 w-5 text-muted-foreground" />}
            {t(forum.name)} {/* Assuming forum.name might be a key if names are translated, otherwise use forum.name directly */}
            {forum.isPublic === false && <Lock className="ml-2 h-4 w-4 text-amber-600" title={t('forumListItem.tooltips.private')} />}
            {forum.isPublic !== false && !forum.isAgora && <Eye className="ml-2 h-4 w-4 text-green-600" title={t('forumListItem.tooltips.public')} />}
            {forum.isAgora && <VoteIconLucide className="ml-2 h-4 w-4 text-blue-600" title={t('forumListItem.tooltips.agora')}/>}
          </Link>
        </CardTitle>
        <CardDescription>{t(forum.description)}</CardDescription> {/* Assuming forum.description might be a key */}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground flex justify-between items-center">
        <div>
          <span>{t('forumListItem.threads')}: {forum.threadCount || 0}</span>
          <span className="mx-2">|</span>
          <span>{t('forumListItem.posts')}: {forum.postCount || 0}</span>
        </div>
      </CardContent>
    </Card>
  );
}
