
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
import { doc, updateDoc, runTransaction, increment, getDoc } from 'firebase/firestore';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

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
  
  const [currentReactions, setCurrentReactions] = useState<Record<string, { userIds: string[] }>>(post.reactions || {});
  const [isLiking, setIsLiking] = useState(false);

  // Derived state to check if the current user has voted in this poll
  const hasUserVotedInPoll = !!(user && currentPoll?.voters && currentPoll.voters[user.id]);
  // Get the option ID the user voted for, if any
  const userVoteOptionId = user && currentPoll?.voters ? currentPoll.voters[user.id] : null;


  useEffect(() => {
    setCurrentPoll(post.poll);
    // If user has already voted, pre-select their option (though it will be disabled)
    if (user && post.poll?.voters?.[user.id]) {
      setSelectedOptionId(post.poll.voters[user.id]);
    } else {
      setSelectedOptionId(null);
    }
  }, [post.poll, user]);

  useEffect(() => {
    setCurrentReactions(post.reactions || {});
  }, [post.reactions]);

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

  const handlePollVote = async () => {
    if (!user || user.role === 'visitor' || user.role === 'guest') {
        toast({ title: "Login Required", description: "You must be logged in to vote.", variant: "destructive" });
        return;
    }
    if (!selectedOptionId || !currentPoll) {
        toast({ title: "No Option Selected", description: "Please select an option to vote.", variant: "destructive" });
        return;
    }
    if (hasUserVotedInPoll) {
        toast({ title: "Already Voted", description: "You have already voted in this poll.", variant: "destructive" });
        return;
    }

    setIsSubmittingVote(true);
    const postRef = doc(db, "posts", post.id);

    try {
      const updatedPollData = await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists() || !postDoc.data()?.poll) {
          throw new Error("Poll not found or post does not exist.");
        }
        
        const pollFromDb = postDoc.data()?.poll as Poll;

        if (pollFromDb.voters && pollFromDb.voters[user.id]) {
          // This check inside transaction is crucial for race conditions
          toast({ title: "Already Voted", description: "It seems you've already cast your vote.", variant: "destructive" });
          setIsSubmittingVote(false); // Early exit
          return pollFromDb; // Return current poll data without changes
        }

        const optionIndex = pollFromDb.options.findIndex(opt => opt.id === selectedOptionId);
        if (optionIndex === -1) {
          throw new Error("Selected option not found in poll.");
        }

        const newOptions = [...pollFromDb.options];
        newOptions[optionIndex] = {
          ...newOptions[optionIndex],
          voteCount: (newOptions[optionIndex].voteCount || 0) + 1,
        };

        const newVoters = { ...(pollFromDb.voters || {}), [user.id]: selectedOptionId };
        
        const updatedPoll: Poll = {
          ...pollFromDb,
          options: newOptions,
          totalVotes: (pollFromDb.totalVotes || 0) + 1,
          voters: newVoters,
        };
        
        transaction.update(postRef, { poll: updatedPoll });
        return updatedPoll;
      });

      if (updatedPollData) { // Check if transaction returned data (wasn't an early exit due to already voted)
        setCurrentPoll(updatedPollData); // Update local state with the version from the transaction
        if (!updatedPollData.voters?.[user.id] || updatedPollData.voters[user.id] !== selectedOptionId ) {
           // This means vote wasn't successful from DB check, but handlePollVote logic continued
           // This case should be rare now with the check inside transaction
        } else {
           toast({ title: "Vote Cast!", description: "Your vote has been recorded." });
        }
      }
    } catch (error: any) {
        console.error("Error casting vote:", error);
        toast({ title: "Error", description: error.message || "Failed to cast your vote. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmittingVote(false);
    }
  };
  

  const handleLike = async () => {
    if (!user || user.role === 'visitor' || user.role === 'guest') {
      toast({ title: "Login Required", description: "You must be logged in to react.", variant: "destructive" });
      return;
    }
    setIsLiking(true);
    const postRef = doc(db, "posts", post.id);
    const postAuthorUserRef = doc(db, "users", post.author.id);
    const emoji = '👍';

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
          throw new Error("Post document does not exist!");
        }

        const serverReactions = postDoc.data().reactions || {};
        const emojiReactionData = serverReactions[emoji] || { userIds: [] };
        const userHasReacted = emojiReactionData.userIds.includes(user.id);

        let newEmojiUserIds;
        let karmaChange = 0;
        let reactionChange = 0;

        if (userHasReacted) { // User is unliking
          newEmojiUserIds = emojiReactionData.userIds.filter((id: string) => id !== user.id);
          karmaChange = -1;
          reactionChange = -1;
        } else { // User is liking
          newEmojiUserIds = [...emojiReactionData.userIds, user.id];
          karmaChange = 1;
          reactionChange = 1;
        }
        
        const updatedReactionsForEmoji = { userIds: newEmojiUserIds };
        const newReactionsField = { ...serverReactions };

        if (newEmojiUserIds.length === 0) {
          delete newReactionsField[emoji]; 
        } else {
          newReactionsField[emoji] = updatedReactionsForEmoji;
        }
        
        transaction.update(postRef, { reactions: newReactionsField });
        
        // Update post author's karma and totalReactionsReceived
        if (post.author.id !== 'unknown' && reactionChange !==0) { // only update if author is known
            transaction.update(postAuthorUserRef, {
                karma: increment(karmaChange),
                totalReactionsReceived: increment(reactionChange),
            });
        }
        
        setCurrentReactions(newReactionsField); 
      });
    } catch (error) {
      console.error("Error updating reaction:", error);
      toast({ title: "Error", description: "Could not update reaction.", variant: "destructive" });
    } finally {
      setIsLiking(false);
    }
  };

  const likeCount = currentReactions['👍']?.userIds?.length || 0;
  const hasUserLiked = user ? currentReactions['👍']?.userIds?.includes(user.id) : false;

  return (
    <Card className={`w-full ${isFirstPost ? 'border-primary/40 shadow-lg' : 'shadow-md'}`}>
      <CardHeader className="flex flex-row items-start space-x-4 p-4 bg-muted/30 rounded-t-lg">
        <Link href={`/profile/${post.author.id}`} className="flex-shrink-0">
          <UserAvatar user={post.author as KratiaUser} size="md" />
        </Link>
        <div className="flex-grow">
          <Link href={`/profile/${post.author.id}`} className="font-semibold text-primary hover:underline">
            {post.author.username || 'Unknown User'}
          </Link>
          <p className="text-xs text-muted-foreground">
            Posted {timeAgo(post.createdAt)}
            {post.isEdited && post.updatedAt && <span className="italic"> (edited {timeAgo(post.updatedAt)})</span>}
          </p>
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
                value={selectedOptionId || userVoteOptionId || ""} 
                onValueChange={(value) => {
                    if (!hasUserVotedInPoll) setSelectedOptionId(value);
                }}
                disabled={hasUserVotedInPoll}
                className="space-y-2"
              >
                {currentPoll.options.map(option => (
                  <div key={option.id} className={cn(
                      "p-3 rounded-md border",
                      hasUserVotedInPoll && userVoteOptionId === option.id && "border-primary ring-2 ring-primary bg-primary/10",
                      hasUserVotedInPoll && userVoteOptionId !== option.id && "bg-muted/30 border-muted/50",
                      !hasUserVotedInPoll && selectedOptionId === option.id && "border-primary ring-1 ring-primary",
                      !hasUserVotedInPoll && "bg-muted/50 hover:border-primary/50"
                    )}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem 
                                value={option.id} 
                                id={`${currentPoll.id}-${option.id}`} 
                                disabled={hasUserVotedInPoll}
                                className={cn(hasUserVotedInPoll ? "cursor-not-allowed" : "", 
                                             "border-primary text-primary focus:ring-primary")}
                                checked={userVoteOptionId === option.id || selectedOptionId === option.id}
                            />
                            <Label 
                                htmlFor={`${currentPoll.id}-${option.id}`}
                                className={cn("text-sm", hasUserVotedInPoll ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer")}
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

              {!hasUserVotedInPoll && user && user.role !== 'visitor' && user.role !== 'guest' && (
                <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handlePollVote}
                    disabled={!selectedOptionId || isSubmittingVote || hasUserVotedInPoll}
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
              {hasUserVotedInPoll && (
                <p className="mt-3 text-sm text-green-600 font-medium">You've voted in this poll.</p>
              )}
               {(!user || user.role === 'visitor' || user.role === 'guest') && !hasUserVotedInPoll && (
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
          <Button 
            variant={hasUserLiked ? "secondary" : "outline"} 
            size="sm" 
            onClick={handleLike}
            disabled={isLiking || !user || user.role === 'visitor' || user.role === 'guest'}
            className="min-w-[80px]"
          >
            {isLiking ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> :
            <ThumbsUp className={cn("mr-1 h-4 w-4", hasUserLiked ? "text-primary fill-primary" : "")} />
            }
            Like ({likeCount})
          </Button>
          <Button variant="outline" size="sm" disabled> {/* Quote button still disabled */}
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
