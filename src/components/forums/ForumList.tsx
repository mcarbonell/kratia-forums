
import type { ForumCategory } from '@/lib/types';
import ForumListItem from './ForumListItem';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FolderOpen } from 'lucide-react';

interface ForumListProps {
  categories: ForumCategory[];
}

export default function ForumList({ categories }: ForumListProps) {
  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-10">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">No forum categories available.</p>
            <p className="text-muted-foreground">
              It looks like no categories have been set up yet. Check back later or contact an administrator.
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
                {category.name}
              </CardTitle>
              {category.description && <p className="text-sm text-muted-foreground mt-1">{category.description}</p>}
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
                  <p>No forums in this category yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
