import type { ForumCategory } from '@/lib/types';
import ForumListItem from './ForumListItem';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface ForumListProps {
  categories: ForumCategory[];
}

export default function ForumList({ categories }: ForumListProps) {
  if (!categories || categories.length === 0) {
    return <p>No forum categories available at the moment.</p>;
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
                <p className="p-6 text-muted-foreground">No forums in this category yet.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}