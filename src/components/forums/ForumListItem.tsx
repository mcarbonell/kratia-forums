import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareText, CornerDownRight, Eye, Lock } from 'lucide-react';
import type { Forum } from '@/lib/types';

interface ForumListItemProps {
  forum: Forum;
  isSubForum?: boolean;
}

export default function ForumListItem({ forum, isSubForum = false }: ForumListItemProps) {
  return (
    <Card className={`hover:shadow-lg transition-shadow duration-200 ${isSubForum ? 'ml-6 bg-card/80' : 'bg-card'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          <Link href={`/forums/${forum.id}`} className="hover:text-primary transition-colors flex items-center">
            {isSubForum && <CornerDownRight className="mr-2 h-5 w-5 text-muted-foreground" />}
            {forum.name}
            {forum.isPublic === false && <Lock className="ml-2 h-4 w-4 text-amber-600" titleAccess="Private Forum (members only)" />}
            {forum.isPublic !== false && !forum.isAgora && <Eye className="ml-2 h-4 w-4 text-green-600" titleAccess="Public Forum" />}
            {forum.isAgora && <Vote className="ml-2 h-4 w-4 text-blue-600" titleAccess="Agora - Votations Forum"/>}
          </Link>
        </CardTitle>
        <CardDescription>{forum.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground flex justify-between items-center">
        <div>
          <span>Threads: {forum.threadCount}</span>
          <span className="mx-2">|</span>
          <span>Posts: {forum.postCount}</span>
        </div>
        {/* Last post info can be added here later */}
      </CardContent>
      {forum.subForums && forum.subForums.length > 0 && (
        <div className="p-4 border-t">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Sub-forums:</h4>
          <div className="space-y-2">
            {forum.subForums.map(sub => <ForumListItem key={sub.id} forum={sub} isSubForum />)}
          </div>
        </div>
      )}
    </Card>
  );
}

// Placeholder Vote icon, replace with actual if available or use a more generic one like ShieldCheck
const Vote = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z"/>
  </svg>
);