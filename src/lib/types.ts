

export type UserStatus = 'active' | 'under_sanction_process' | 'sanctioned' | 'pending_admission' | 'pending_email_verification';

export interface UserNotificationSetting {
  web: boolean;
  // email?: boolean; // Future
  // push?: boolean; // Future
}

export interface UserNotificationPreferences {
  newReplyToMyThread?: UserNotificationSetting;
  votationConcludedProposer?: UserNotificationSetting;
  postReaction?: UserNotificationSetting;
  votationConcludedParticipant?: UserNotificationSetting;
  newPrivateMessage?: UserNotificationSetting; // New
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null; 
  registrationDate?: string; 
  karma?: number;
  location?: string | null;
  aboutMe?: string | null;
  presentation?: string; 
  isQuarantined?: boolean; 
  canVote?: boolean; 
  totalPostsByUser?: number;
  totalReactionsReceived?: number;
  totalPostsInThreadsStartedByUser?: number;
  totalThreadsStartedByUser?: number;
  status?: UserStatus;
  sanctionEndDate?: string | null; 
  role?: 'guest' | 'user' | 'normal_user' | 'admin' | 'founder' | 'visitor';
  onboardingAccepted?: boolean;
  notificationPreferences?: UserNotificationPreferences;
}

export interface Post {
  id: string;
  threadId: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  content: string;
  createdAt: string; 
  updatedAt?: string | null; 
  reactions: Record<string, { userIds: string[] }>;
  isEdited?: boolean;
  lastEditedBy?: Pick<User, 'id' | 'username'> | null;
}

export interface Thread {
  id: string;
  forumId: string;
  title: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  createdAt: string; 
  lastReplyAt?: string | null; 
  postCount: number;
  isSticky?: boolean;
  isLocked?: boolean;
  isPublic?: boolean; 
  tags?: string[];
  poll?: Poll | null;
  relatedVotationId?: string | null;
}

export interface Forum {
  id: string;
  categoryId?: string;
  parentId?: string;
  name: string;
  description: string;
  threadCount: number;
  postCount: number;
  isPublic?: boolean;
  isAgora?: boolean;
  subForums?: Forum[];
}

export interface ForumCategory {
  id: string;
  name: string;
  description?: string;
  forums?: Forum[]; 
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  allowMultipleVotes?: boolean;
  endDate?: string;
  totalVotes: number;
  voters: Record<string, string>; 
}

export type VotationStatus = 'active' | 'closed_passed' | 'closed_failed_quorum' | 'closed_failed_vote' | 'closed_executed' | 'closed_rejected';

export type VotationType = 'sanction' | 'rule_change' | 'forum_management' | 'admission_request' | 'new_forum_proposal' | 'other';

export interface VotationOptionTally {
  for: number;
  against: number;
  abstain: number;
}

export interface Votation {
  id: string;
  title: string;
  description: string;
  justification?: string;
  proposerId: string;
  proposerUsername: string;
  type: VotationType;
  createdAt: string;
  deadline: string;
  status: VotationStatus;
  
  targetUserId?: string;
  targetUsername?: string;
  sanctionDuration?: string;
  
  proposedConstitutionText?: string;
  
  proposedForumName?: string;
  proposedForumDescription?: string;
  proposedForumCategoryId?: string;
  proposedForumCategoryName?: string;
  proposedForumIsPublic?: boolean;

  options: VotationOptionTally;
  voters: Record<string, 'for' | 'against' | 'abstain'>;
  totalVotesCast: number;
  quorumRequired?: number;
  
  relatedThreadId: string;
  outcome?: string;
}

export interface SiteSettings {
    constitutionText?: string;
    lastUpdated?: string; 
}

export interface PrivateMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderAvatarUrl?: string | null;
  recipientId: string;
  recipientUsername: string;
  recipientAvatarUrl?: string | null;
  content: string;
  createdAt: string; 
  isRead: boolean;
}

export type NotificationType = 
  | 'new_reply_to_your_thread' 
  | 'votation_concluded_proposer'
  | 'post_reaction'
  | 'votation_concluded_participant'
  | 'new_private_message'; // New

export interface Notification {
  id: string;
  recipientId: string; 
  actor: Pick<User, 'id' | 'username' | 'avatarUrl'>; 
  type: NotificationType;
  threadId?: string;
  threadTitle?: string; 
  postId?: string; 
  forumId?: string;
  votationId?: string; 
  votationTitle?: string; 
  votationOutcome?: VotationStatus; 
  reactionEmoji?: string;
  message: string; 
  link: string; 
  createdAt: string; 
  isRead: boolean;
  privateMessageId?: string; // New for PM notifications
}

    