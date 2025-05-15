
"use client";

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Post, Poll, PollOption, User as KratiaUser } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MessageSquare, Edit2, Trash2, BarChartBig, Vote as VoteIcon, Loader2 } from 'lucide-react'; 
import UserAvatar from '../user/UserAvatar';
import { useState, useEffect } from 'react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface PostItemProps {
  post: Post;
  isFirstPost?: boolean;
}

export default function PostItem({ post, isFirstPost = false }: PostItemProps) {
  const { user } = useMockAuth();
  const { toast } = useToast();

  const [currentPoll, setCurrentPoll] = useState<Poll | undefined>(post.poll);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  // Tracks if user has voted on this poll *in this session*
  // Key: pollId, Value: true if voted
  const [userVotedPolls, setUserVotedPolls] = useState<Record<string, boolean>>({}); 

  useEffect(() => {
    setCurrentPoll(post.poll);
    // If a poll exists and we previously recorded a vote for it in this session, keep selection disabled
    if (post.poll && userVotedPolls[post.poll.id]) {
        // No need to reset selectedOptionId here as RadioGroup won't allow re-selection if disabled
    } else {
        setSelectedOptionId(null); // Reset selection if poll changes or no vote recorded
    }
  }, [post.poll, userVotedPolls]); // Rerun if userVotedPolls changes to ensure UI reflects vote status

  const timeAgo = (dateString: string) => {
    if (!dateString) return 'some time ago';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'an invalid date';
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        return 'a while back';
    }
  };

  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  const handleVote = async () => {
    if (!user || user.role === 'visitor' || user.role === 'guest') {
        toast({ title: "Login Required", description: "You must be logged in to vote.", variant: "destructive" });
        return;
    }
    if (!selectedOptionId || !currentPoll) {
        toast({ title: "No Option Selected", description: "Please select an option to vote.", variant: "destructive" });
        return;
    }
    if (userVotedPolls[currentPoll.id]) {
        toast({ title: "Already Voted", description: "You have already voted in this poll during this session.", variant: "destructive" });
        return;
    }

    setIsSubmittingVote(true);

    try {
        const postRef = doc(db, "posts", post.id);
        
        const updatedOptions = currentPoll.options.map(opt =>
            opt.id === selectedOptionId ? { ...opt, voteCount: (opt.voteCount || 0) + 1 } : opt
        );
        const updatedPollData: Poll = {
            ...currentPoll,
            options: updatedOptions,
            totalVotes: (currentPoll.totalVotes || 0) + 1,
        };

        await updateDoc(postRef, {
            poll: updatedPollData
        });

        setCurrentPoll(updatedPollData); // Update local state for immediate UI feedback
        setUserVotedPolls(prev => ({ ...prev, [currentPoll!.id]: true })); // Mark as voted in this session
        // selectedOptionId is kept to show the user's choice, but radio items will be disabled.
        
        toast({ title: "Vote Cast!", description: "Your vote has been recorded." });

    } catch (error) {
        console.error("Error casting vote:", error);
        toast({ title: "Error", description: "Failed to cast your vote. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmittingVote(false);
    }
  };
  
  const hasVotedThisSession = currentPoll ? userVotedPolls[currentPoll.id] : false;

  return (
    <Card className={`w-full ${isFirstPost ? 'border-primary/40 shadow-lg' : 'shadow-md'}`}>
      <CardHeader className="flex flex-row items-start space-x-4 p-4 bg-muted/30 rounded-t-lg">
        <Link href={`/profile/${post.author.id}`} className="flex-shrink-0">
          <UserAvatar user={post.author as User} size="md" />
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
      </CardHeader>
      <CardContent className="p-4 prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: formatContent(post.content) }} />
      
      {currentPoll && (
        <CardContent className="p-4 border-t">
          <Card className="bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center">
                <BarChartBig className="mr-2 h-5 w-5 text-primary" />
                Poll: {currentPoll.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup 
                value={selectedOptionId || ""} 
                onValueChange={(value) => {
                    if (!hasVotedThisSession) setSelectedOptionId(value);
                }}
                disabled={hasVotedThisSession}
                className="space-y-2"
              >
                {currentPoll.options.map(option => (
                  <div key={option.id} className={`p-3 rounded-md border ${selectedOptionId === option.id && !hasVotedThisSession ? 'border-primary ring-1 ring-primary' : 'bg-muted/50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem 
                                value={option.id} 
                                id={`${currentPoll.id}-${option.id}`} 
                                disabled={hasVotedThisSession}
                                className={hasVotedThisSession ? "cursor-not-allowed" : ""}
                            />
                            <Label 
                                htmlFor={`${currentPoll.id}-${option.id}`}
                                className={`text-sm ${hasVotedThisSession ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}
                            >
                                {option.text}
                            </Label>
                        </div>
                        <span className="text-sm font-medium text-primary">{option.voteCount || 0} vote(s)</span>
                    </div>
                    {currentPoll.totalVotes > 0 && (
                      <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-primary transition-all duration-300 ease-in-out" 
                              style={{ width: `${((option.voteCount || 0) / (currentPoll.totalVotes || 1)) * 100}%` }}
                          />
                      </div>
                    )}
                    {currentPoll.totalVotes === 0 && (
                       <div className="mt-2 h-2 w-full bg-secondary rounded-full" />
                     )}
                  </div>
                ))}
              </RadioGroup>
              
              <div className="text-xs text-muted-foreground pt-2 flex justify-between items-center">
                <span>Total Votes: {currentPoll.totalVotes || 0}</span>
                {currentPoll.endDate && <span>Poll ends: {new Date(currentPoll.endDate).toLocaleDateString()}</span>}
              </div>

              {!hasVotedThisSession && user && user.role !== 'visitor' && user.role !== 'guest' && (
                <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleVote}
                    disabled={!selectedOptionId || isSubmittingVote || hasVotedThisSession}
                    className="mt-3 w-full sm:w-auto"
                >
                  {isSubmittingVote ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <VoteIcon className="mr-2 h-4 w-4" />
                  )}
                  {isSubmittingVote ? 'Casting Vote...' : 'Cast Your Vote'}
                </Button>
              )}
              {hasVotedThisSession && (
                <p className="mt-3 text-sm text-green-600 font-medium">You've voted in this poll.</p>
              )}
               {(!user || user.role === 'visitor' || user.role === 'guest') && (
                <p className="mt-3 text-sm text-muted-foreground">
                    <Link href="/auth/login" className="text-primary hover:underline">Log in</Link> or <Link href="/auth/signup" className="text-primary hover:underline">sign up</Link> to vote.
                </p>
              )}
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

