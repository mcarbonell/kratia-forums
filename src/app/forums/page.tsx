
"use client";

import ForumList from '@/components/forums/ForumList';
import { mockCategories } from '@/lib/mockData';
import { MessageSquare } from 'lucide-react';

export default function ForumsPage() {
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
        <ForumList categories={mockCategories} />
      </section>
    </div>
  );
}
