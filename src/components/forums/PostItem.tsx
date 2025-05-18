
"use client";

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Post, Poll, PollOption, User as KratiaUser, Thread } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MessageSquare, Edit2, Trash2, BarChartBig, Vote as VoteIcon, Loader2, Save, XCircle } from 'lucide-react';
import UserAvatar from '../user/UserAvatar';
import { useState, useEffect, type ChangeEvent } from 'react';
import { useMockAuth } from '@/hooks/use-mock-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, runTransaction, increment, getDoc } from 'firebase/firestore';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';
import { KRATIA_CONFIG } from '@/lib/config';

interface PostItemProps {
  post: Post;
  isFirstPost?: boolean;
  threadPoll?: Poll;
  onPollUpdate?: (updatedPoll: Poll) => void;
  threadId?: string;
}

export default function PostItem({ post: initialPost, isFirstPost = false, threadPoll, onPollUpdate, threadId }: PostItemProps) {
  const { user } = useMockAuth();
  const { toast } = useToast();

  const [post, setPost] = useState<Post>(initialPost);
  const [currentPoll, setCurrentPoll] = useState<Poll | undefined>(threadPoll);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [currentReactions, setCurrentReactions] = useState<Record<string, { userIds: string[] }>>(initialPost.reactions || {});
  const [isLiking, setIsLiking] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(initialPost.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);


  const hasUserVotedInPoll = !!(user && currentPoll?.voters && currentPoll.voters[user.id]);
  const userVoteOptionId = user && currentPoll?.voters ? currentPoll.voters[user.id] : null;

  useEffect(() => {
    setPost(initialPost);
    setCurrentReactions(initialPost.reactions || {});
    setEditedContent(initialPost.content);
  }, [initialPost]);


  useEffect(() => {
    setCurrentPoll(threadPoll);
    if (user && threadPoll?.voters?.[user.id]) {
      setSelectedOptionId(threadPoll.voters[user.id]);
    } else {
      setSelectedOptionId(null);
    }
  }, [threadPoll, user]);


  const timeAgo = (dateString?: string) => {
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
    let processedContent = content;
    // Image embedding
    processedContent = processedContent.replace(
      /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(\?[^\s]*)?)/gi,
      (match) => `<div class="my-4"><img src="${match}" alt="User embedded image" class="max-w-full h-auto rounded-md shadow-md border" data-ai-hint="forum image" /></div>`
    );
    // YouTube video embedding
    processedContent = processedContent.replace(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi,
      (match, videoId) => {
        if (!videoId || videoId.length !== 11) return match;
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        const iframeTagHtml = `<iframe title="YouTube video player" src="${embedUrl}" width="100%" height="100%" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen class="absolute top-0 left-0 w-full h-full"></iframe>`;
        return `<div class="my-4 relative rounded-md shadow-md border overflow-hidden" style="padding-bottom: 56.25%; height: 0; max-width: 100%;">${iframeTagHtml}</div>`;
      }
    );
    // Basic markdown-like formatting (only if no HTML tags are present, to avoid messing up embeds)
    let finalContent = processedContent;
    if (!finalContent.match(/<[^>]+>/)) {
        finalContent = finalContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }
    finalContent = finalContent.replace(/\n/g, '<br />');
    return finalContent;
  };

  const handlePollVote = async () => {
    if (!user || user.role === 'visitor' || user.role === 'guest') {
        toast({ title: "Login Required", description: "You must be logged in to vote.", variant: "destructive" });
        return;
    }
    if (!selectedOptionId || !currentPoll || !threadId) {
        toast({ title: "Error", description: "Poll data or thread ID is missing.", variant: "destructive" });
        return;
    }
    if (hasUserVotedInPoll) {
        toast({ title: "Already Voted", description: "You have already voted in this poll.", variant: "destructive" });
        return;
    }
    setIsSubmittingVote(true);
    const threadRef = doc(db, "threads", threadId);
    try {
      const updatedPollData = await runTransaction(db, async (transaction) => {
        const threadDoc = await transaction.get(threadRef);
        if (!threadDoc.exists()) throw new Error("Thread not found, cannot update poll.");
        const currentThreadData = threadDoc.data() as Thread;
        const pollFromDb = currentThreadData.poll;
        if (!pollFromDb) throw new Error("Poll not found in thread, cannot update.");
        if (pollFromDb.voters && pollFromDb.voters[user.id]) return pollFromDb; // Already voted check in transaction
        const optionIndex = pollFromDb.options.findIndex(opt => opt.id === selectedOptionId);
        if (optionIndex === -1) throw new Error("Selected option not found in poll.");
        const newOptions = [...pollFromDb.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], voteCount: (newOptions[optionIndex].voteCount || 0) + 1 };
        const newVoters = { ...(pollFromDb.voters || {}), [user.id]: selectedOptionId };
        const updatedPoll: Poll = { ...pollFromDb, options: newOptions, totalVotes: (pollFromDb.totalVotes || 0) + 1, voters: newVoters };
        transaction.update(threadRef, { poll: updatedPoll });
        return updatedPoll;
      });
      if (updatedPollData) {
        setCurrentPoll(updatedPollData);
        if (onPollUpdate) onPollUpdate(updatedPollData);
        if (updatedPollData.voters?.[user.id] === selectedOptionId) toast({ title: "Vote Cast!", description: "Your vote has been recorded." });
        else if (updatedPollData.voters?.[user.id]) toast({ title: "Already Voted", description: "You had already cast your vote in this poll.", variant: "default" });
        else toast({ title: "Vote Not Recorded", description: "Could not confirm your vote. Please check and try again.", variant: "destructive"});
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
    if (user.id === post.author.id) {
      toast({ title: "Cannot Like Own Post", description: "You cannot react to your own posts.", variant: "default" });
      return;
    }
    setIsLiking(true);
    const postRef = doc(db, "posts", post.id);
    const postAuthorUserRef = doc(db, "users", post.author.id);
    const emoji = '👍';
    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) throw new Error("Post document does not exist!");
        const serverReactions = postDoc.data().reactions || {};
        const emojiReactionData = serverReactions[emoji] || { userIds: [] };
        const userHasReacted = emojiReactionData.userIds.includes(user.id);
        let newEmojiUserIds;
        let karmaChangeForAuthor = 0;
        let reactionChangeForAuthor = 0;
        if (userHasReacted) {
          newEmojiUserIds = emojiReactionData.userIds.filter((id: string) => id !== user.id);
          karmaChangeForAuthor = -1; reactionChangeForAuthor = -1;
        } else {
          newEmojiUserIds = [...emojiReactionData.userIds, user.id];
          karmaChangeForAuthor = 1; reactionChangeForAuthor = 1;
        }
        const updatedReactionsForEmoji = { userIds: newEmojiUserIds };
        const newReactionsField = { ...serverReactions };
        if (newEmojiUserIds.length === 0) delete newReactionsField[emoji];
        else newReactionsField[emoji] = updatedReactionsForEmoji;
        transaction.update(postRef, { reactions: newReactionsField });
        
        // Ensure we don't update karma for 'unknown' author or if liker is the author (already handled)
        if (post.author.id && post.author.id !== 'unknown' && post.author.id !== user.id) {
            transaction.update(postAuthorUserRef, {
                karma: increment(karmaChangeForAuthor),
                totalReactionsReceived: increment(reactionChangeForAuthor),
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

  const handleEditToggle = () => {
    if (isEditing) {
        setEditedContent(post.content);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    if (!user) return;
    if (editedContent.trim() === post.content.trim()) {
        setIsEditing(false);
        return;
    }
    if (editedContent.trim().length < 5) {
      toast({ title: "Content too short", description: "Post content must be at least 5 characters.", variant: "destructive"});
      return;
    }

    setIsSavingEdit(true);
    const postRef = doc(db, "posts", post.id);
    const newUpdatedAt = new Date().toISOString();
    const editorInfo: Pick<KratiaUser, 'id' | 'username'> = {
      id: user.id,
      username: user.username,
    };

    try {
        await updateDoc(postRef, {
            content: editedContent,
            updatedAt: newUpdatedAt,
            isEdited: true,
            lastEditedBy: editorInfo,
        });
        setPost(prevPost => ({
            ...prevPost,
            content: editedContent,
            updatedAt: newUpdatedAt,
            isEdited: true,
            lastEditedBy: editorInfo,
        }));
        setIsEditing(false);
        toast({ title: "Post Updated", description: "Your post has been successfully updated."});
    } catch (error) {
        console.error("Error updating post:", error);
        toast({ title: "Error", description: "Failed to update post. Please try again.", variant: "destructive"});
    } finally {
        setIsSavingEdit(false);
    }
  };

  const likeCount = currentReactions['👍']?.userIds?.length || 0;
  const hasUserLiked = user ? currentReactions['👍']?.userIds?.includes(user.id) : false;
  const isOwnPost = user?.id === post.author.id;

  const isAdminOrFounder = user?.role === 'admin' || user?.role === 'founder';
  const postCreatedAtDate = new Date(post.createdAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - postCreatedAtDate.getTime()) / (1000 * 60);
  const isWithinEditLimit = diffMinutes < KRATIA_CONFIG.EDIT_TIME_LIMIT_MINUTES;
  
  const canEditPost = user && (isAdminOrFounder || (isOwnPost && isWithinEditLimit));
  
  const canAuthorDelete = isOwnPost && isWithinEditLimit;
  const canAdminDelete = isAdminOrFounder;
  const canDeletePost = user && (canAdminDelete || canAuthorDelete);


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
            {post.isEdited && post.updatedAt && (
              <span className="italic">
                {' '}(edited {timeAgo(post.updatedAt)}
                {post.lastEditedBy ? ` by ${post.lastEditedBy.username}` : ''})
              </span>
            )}
          </p>
        </div>
      </CardHeader>

      {!isEditing && currentPoll && isFirstPost && (
         <CardContent className="p-4 border-b">
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
                onValueChange={(value) => { if (!hasUserVotedInPoll) setSelectedOptionId(value); }}
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
                            <RadioGroupItem value={option.id} id={`${currentPoll.id}-${option.id}`} disabled={hasUserVotedInPoll} className={cn(hasUserVotedInPoll ? "cursor-not-allowed" : "", "border-primary text-primary focus:ring-primary")} checked={userVoteOptionId === option.id || selectedOptionId === option.id} />
                            <Label htmlFor={`${currentPoll.id}-${option.id}`} className={cn("text-sm", hasUserVotedInPoll ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer")}>{option.text}</Label>
                        </div>
                        <span className="text-sm font-medium text-primary">{option.voteCount || 0} vote(s)</span>
                    </div>
                    {currentPoll.totalVotes > 0 && (<div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${((option.voteCount || 0) / (currentPoll.totalVotes || 1)) * 100}%` }} /></div>)}
                    {currentPoll.totalVotes === 0 && (<div className="mt-2 h-2 w-full bg-secondary rounded-full" />)}
                  </div>
                ))}
              </RadioGroup>
              <div className="text-xs text-muted-foreground pt-2 flex justify-between items-center">
                <span>Total Votes: {currentPoll.totalVotes || 0}</span>
                {currentPoll.endDate && <span>Poll ends: {new Date(currentPoll.endDate).toLocaleDateString()}</span>}
              </div>
              {!hasUserVotedInPoll && user && user.role !== 'visitor' && user.role !== 'guest' && (
                <Button variant="default" size="sm" onClick={handlePollVote} disabled={!selectedOptionId || isSubmittingVote || hasUserVotedInPoll || !threadId} className="mt-3 w-full sm:w-auto">
                  {isSubmittingVote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <VoteIcon className="mr-2 h-4 w-4" />}
                  {isSubmittingVote ? 'Casting Vote...' : 'Cast Your Vote'}
                </Button>
              )}
              {hasUserVotedInPoll && (<p className="mt-3 text-sm text-green-600 font-medium">You've voted in this poll.</p>)}
               {(!user || user.role === 'visitor' || user.role === 'guest') && !hasUserVotedInPoll && (
                <p className="mt-3 text-sm text-muted-foreground">
                    <Link href="/auth/login" className="text-primary hover:underline">Log in</Link> or <Link href="/auth/signup" className="text-primary hover:underline">sign up</Link> to vote.
                </p>
              )}
            </CardContent>
          </Card>
        </CardContent>
      )}


      <CardContent className="p-4">
        {isEditing ? (
            <div className="space-y-3">
                <Label htmlFor={`edit-content-${post.id}`} className="sr-only">Edit Content</Label>
                <Textarea
                    id={`edit-content-${post.id}`}
                    value={editedContent}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditedContent(e.target.value)}
                    rows={5}
                    className="w-full text-sm"
                    disabled={isSavingEdit}
                />
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm" onClick={handleEditToggle} disabled={isSavingEdit}>
                        <XCircle className="mr-1 h-4 w-4" />Cancel
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSaveEdit} disabled={isSavingEdit || editedContent.trim().length < 5}>
                        {isSavingEdit ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </div>
        ) : (
             <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: formatContent(post.content) }} />
        )}
      </CardContent>

      {!isEditing && (
          <CardFooter className="p-4 flex justify-between items-center border-t">
            <div className="flex space-x-2">
            <Button variant={hasUserLiked ? "secondary" : "outline"} size="sm" onClick={handleLike} disabled={isLiking || !user || user.role === 'visitor' || user.role === 'guest' || isOwnPost} className="min-w-[80px]" title={isOwnPost ? "You cannot like your own post" : (hasUserLiked ? "Unlike" : "Like")}>
                {isLiking ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ThumbsUp className={cn("mr-1 h-4 w-4", hasUserLiked ? "text-primary fill-primary" : "")} />} Like ({likeCount})
            </Button>
            <Button variant="outline" size="sm" disabled>
                <MessageSquare className="mr-1 h-4 w-4" /> Quote
            </Button>
            </div>
            <div className="flex space-x-2">
            {canEditPost && (
                <Button variant="ghost" size="sm" onClick={handleEditToggle} title="Edit Post">
                    <Edit2 className="h-4 w-4" /> <span className="sr-only">Edit</span>
                </Button>
            )}
            {canDeletePost && (
                <Button variant="ghost" size="sm" disabled title="Delete Post (functionality to be implemented)" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete</span>
                </Button>
            )}
            </div>
        </CardFooter>
      )}
    </Card>
  );
}


    