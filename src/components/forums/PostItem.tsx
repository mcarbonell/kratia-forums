
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Post } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MessageSquare, Edit2, Trash2, BarChartBig, CheckSquare, MinusSquare } from 'lucide-react'; 
import UserAvatar from '../user/UserAvatar';

interface PostItemProps {
  post: Post;
  isFirstPost?: boolean;
}

export default function PostItem({ post, isFirstPost = false }: PostItemProps) {
  const timeAgo = (dateString: string) => {
    if (!dateString) return 'some time ago';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'an invalid date'; // Handle invalid date strings
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        return 'a while back'; // Fallback for unexpected errors
    }
  };

  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  return (
    <Card className={`w-full ${isFirstPost ? 'border-primary/40 shadow-lg' : 'shadow-md'}`}>
      <CardHeader className="flex flex-row items-start space-x-4 p-4 bg-muted/30 rounded-t-lg">
        <Link href={`/profile/${post.author.id}`} className="flex-shrink-0">
          <UserAvatar user={post.author} size="md" />
        </Link>
        <div className="flex-grow">
          <Link href={`/profile/${post.author.id}`} className="font-semibold text-primary hover:underline">
            {post.author.username || 'Unknown User'}
          </Link>
          <p className="text-xs text-muted-foreground">
            Posted {timeAgo(post.createdAt)}
            {post.isEdited && post.updatedAt && <span className="italic"> (edited {timeAgo(post.updatedAt)})</span>}
          </p>
           {post.author.karma !== undefined && (
             <p className="text-xs text-muted-foreground mt-1">Karma: {post.author.karma}</p>
           )}
        </div>
        {/* Placeholder for post number, can be added later if thread items are numbered */}
      </CardHeader>
      <CardContent className="p-4 prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: formatContent(post.content) }} />
      
      {/* Poll Display Section */}
      {post.poll && (
        <CardContent className="p-4 border-t">
          <Card className="bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center">
                <BarChartBig className="mr-2 h-5 w-5 text-primary" />
                Poll: {post.poll.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {post.poll.options.map(option => (
                <div key={option.id} className="p-2 rounded-md border bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{option.text}</span>
                    <span className="text-sm font-medium text-primary">{option.voteCount} vote(s)</span>
                  </div>
                  {/* Progress bar for votes (visual only for now) */}
                  {post.poll && post.poll.totalVotes > 0 && (
                    <div className="mt-1 h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary transition-all duration-500" 
                            style={{ width: `${(option.voteCount / (post.poll.totalVotes || 1)) * 100}%` }}
                        />
                    </div>
                  )}
                   {post.poll && post.poll.totalVotes === 0 && (
                     <div className="mt-1 h-2 w-full bg-secondary rounded-full" />
                   )}
                </div>
              ))}
              <div className="text-xs text-muted-foreground pt-2 flex justify-between">
                <span>Total Votes: {post.poll.totalVotes}</span>
                {post.poll.endDate && <span>Poll ends: {new Date(post.poll.endDate).toLocaleDateString()}</span>}
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" disabled>
                  <CheckSquare className="mr-2 h-4 w-4" /> Vote (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}

      <CardFooter className="p-4 flex justify-between items-center border-t">
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" disabled>
            <ThumbsUp className="mr-1 h-4 w-4" /> Like ({post.reactions?.find(r => r.emoji === '👍')?.count || 0})
          </Button>
          <Button variant="outline" size="sm" disabled>
            <MessageSquare className="mr-1 h-4 w-4" /> Quote
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" disabled title="Edit Post">
            <Edit2 className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button variant="ghost" size="sm" disabled title="Delete Post" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
