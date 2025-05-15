
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareText, CornerDownRight, Eye, Lock, Vote as VoteIconLucide } from 'lucide-react'; // Renamed Vote to avoid conflict
import type { Forum } from '@/lib/types';

interface ForumListItemProps {
  forum: Forum;
  isSubForum?: boolean; // This will be largely unused with flat Firestore structure for now
}

export default function ForumListItem({ forum, isSubForum = false }: ForumListItemProps) {
  return (
    <Card className={`hover:shadow-lg transition-shadow duration-200 ${isSubForum ? 'ml-6 bg-card/80' : 'bg-card'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          <Link href={`/forums/${forum.id}`} className="hover:text-primary transition-colors flex items-center">
            {isSubForum && <CornerDownRight className="mr-2 h-5 w-5 text-muted-foreground" />}
            {forum.name}
            {forum.isPublic === false && <Lock className="ml-2 h-4 w-4 text-amber-600" title="Private Forum (members only)" />}
            {forum.isPublic !== false && !forum.isAgora && <Eye className="ml-2 h-4 w-4 text-green-600" title="Public Forum" />}
            {forum.isAgora && <VoteIconLucide className="ml-2 h-4 w-4 text-blue-600" title="Agora - Votations Forum"/>}
          </Link>
        </CardTitle>
        <CardDescription>{forum.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground flex justify-between items-center">
        <div>
          <span>Threads: {forum.threadCount || 0}</span>
          <span className="mx-2">|</span>
          <span>Posts: {forum.postCount || 0}</span>
        </div>
        {/* Last post info can be added here later */}
      </CardContent>
      {/* 
        Subforum display logic is removed for now as Firestore fetching is flat.
        This can be re-added if hierarchical fetching/structuring is implemented.
        {forum.subForums && forum.subForums.length > 0 && (
          <div className="p-4 border-t">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Sub-forums:</h4>
            <div className="space-y-2">
              {forum.subForums.map(sub => <ForumListItem key={sub.id} forum={sub} isSubForum />)}
            </div>
          </div>
        )}
      */}
    </Card>
  );
}
