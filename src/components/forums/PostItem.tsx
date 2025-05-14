
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Post } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MessageSquare, Edit2, Trash2, UserCircle } from 'lucide-react'; // Edit2 for edit icon

interface PostItemProps {
  post: Post;
  isFirstPost?: boolean;
}

export default function PostItem({ post, isFirstPost = false }: PostItemProps) {
  const timeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  // Basic markdown-like formatting for bold and italics for now
  // In a real app, use a proper markdown parser library
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
          <Avatar className="h-12 w-12">
            <AvatarImage src={post.author.avatarUrl} alt={post.author.username} data-ai-hint="user avatar" />
            <AvatarFallback>{post.author.username?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-grow">
          <Link href={`/profile/${post.author.id}`} className="font-semibold text-primary hover:underline">
            {post.author.username}
          </Link>
          <p className="text-xs text-muted-foreground">
            Posted {timeAgo(post.createdAt)}
            {post.isEdited && <span className="italic"> (edited {timeAgo(post.updatedAt!)})</span>}
          </p>
           {post.author.karma !== undefined && (
             <p className="text-xs text-muted-foreground mt-1">Karma: {post.author.karma}</p>
           )}
        </div>
        <div className="text-xs text-muted-foreground">
          #{/* Placeholder for post number, can be added later */}
        </div>
      </CardHeader>
      <CardContent className="p-4 prose prose-sm sm:prose-base dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatContent(post.content) }} />
      {post.poll && (
        <CardContent className="p-4 border-t">
            <h4 className="font-semibold mb-2">{post.poll.question}</h4>
            <ul className="space-y-1">
                {post.poll.options.map(option => (
                    <li key={option.id} className="text-sm text-muted-foreground">
                        {option.text} ({option.voteCount} votes)
                    </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">Total Votes: {post.poll.totalVotes}</p>
        </CardContent>
      )}
      <CardFooter className="p-4 flex justify-between items-center border-t">
        <div className="flex space-x-2">
          {/* Reaction buttons (non-functional for now) */}
          <Button variant="outline" size="sm" disabled>
            <ThumbsUp className="mr-1 h-4 w-4" /> Like ({post.reactions.find(r => r.emoji === '👍')?.count || 0})
          </Button>
          <Button variant="outline" size="sm" disabled>
            <MessageSquare className="mr-1 h-4 w-4" /> Quote
          </Button>
        </div>
        <div className="flex space-x-2">
          {/* Edit/Delete buttons (non-functional for now, permissions would apply) */}
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
