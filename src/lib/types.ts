
export type UserStatus = 'active' | 'under_sanction_process' | 'sanctioned' | 'pending_admission' | 'pending_email_verification';

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  registrationDate?: string; // ISO date string
  karma?: number;
  location?: string;
  aboutMe?: string;
  presentation?: string; // For admission requests
  isQuarantined?: boolean; // True if user is new and hasn't met criteria
  canVote?: boolean; // True if user is a "Usuario Normal"
  totalPostsByUser?: number;
  totalReactionsReceived?: number;
  totalPostsInThreadsStartedByUser?: number;
  totalThreadsStartedByUser?: number;
  status?: UserStatus;
  sanctionEndDate?: string; // ISO date string, if sanctioned
  role?: 'guest' | 'user' | 'normal_user' | 'admin' | 'founder' | 'visitor';
  onboardingAccepted?: boolean;
}

export interface Post {
  id: string;
  threadId: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  content: string;
  createdAt: string; // ISO date string
  updatedAt?: string; // ISO date string
  reactions: Record<string, { userIds: string[] }>;
  isEdited?: boolean;
  lastEditedBy?: Pick<User, 'id' | 'username'>;
}

export interface Thread {
  id: string;
  forumId: string;
  title: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  createdAt: string; // ISO date string
  lastReplyAt?: string; // ISO date string
  postCount: number;
  isSticky?: boolean;
  isLocked?: boolean;
  isPublic?: boolean; // Visible to non-logged-in users
  tags?: string[];
  poll?: Poll;
  relatedVotationId?: string;
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
  forums?: Forum[]; // Optional if forums are primarily linked by categoryId
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
  voters: Record<string, string>; // userId: optionId
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

  // For new forum proposals
  proposedForumName?: string;
  proposedForumDescription?: string;
  proposedForumCategoryId?: string;
  proposedForumCategoryName?: string; // Denormalized for display
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
    lastUpdated?: string; // ISO date string
}

export interface PrivateMessage {
  id: string;
  sender: User;
  recipient: User;
  content: string;
  createdAt: string;
  isRead?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'reply' | 'mention' | 'pm' | 'votation_result';
  content: string;
  link?: string;
  createdAt: string;
  isRead?: boolean;
}
