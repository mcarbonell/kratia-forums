
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, UserCircle, Clock, Lock } from 'lucide-react';
import type { Thread } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface ThreadListItemProps {
  thread: Thread;
  forumId: string;
}

export default function ThreadListItem({ thread, forumId }: ThreadListItemProps) {
  const timeAgo = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start space-x-4">
        <Link href={`/profile/${thread.author.id}`} className="flex-shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={thread.author.avatarUrl} alt={thread.author.username} data-ai-hint="user avatar" />
            <AvatarFallback>{thread.author.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-grow min-w-0">
          <Link href={`/forums/${forumId}/threads/${thread.id}`} className="block">
            <h3 className="text-lg font-semibold text-primary hover:underline truncate flex items-center" title={thread.title}>
              {thread.isLocked && <Lock className="mr-2 h-4 w-4 text-destructive flex-shrink-0" />}
              {thread.title}
            </h3>
          </Link>
          <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-1 flex-wrap">
            <Link href={`/profile/${thread.author.id}`} className="hover:underline flex items-center">
              <UserCircle className="mr-1 h-3 w-3" />
              {thread.author.username}
            </Link>
            <span className="flex items-center">
              <Clock className="mr-1 h-3 w-3" />
              Created: {timeAgo(thread.createdAt)}
            </span>
            {thread.lastReplyAt && (
              <span className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                Last reply: {timeAgo(thread.lastReplyAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right text-sm text-muted-foreground ml-auto pl-4">
          <div className="flex items-center">
            <MessageSquare className="mr-1 h-4 w-4" />
            {thread.postCount} post{thread.postCount !== 1 ? 's' : ''}
          </div>
          {/* Views can be added later */}
        </div>
      </div>
    </div>
  );
}
