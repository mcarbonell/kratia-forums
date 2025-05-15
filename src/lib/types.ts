
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  registrationDate?: string; // ISO date string
  karma?: number;
  location?: string;
  aboutMe?: string;
  isQuarantined?: boolean; // True if user is new and hasn't met criteria
  canVote?: boolean; // True if user is a "Usuario Normal"
  totalPostsByUser?: number;
  totalReactionsReceived?: number;
  totalPostsInThreadsStartedByUser?: number;
  status?: 'active' | 'under_sanction_process' | 'sanctioned'; // New status field
  sanctionEndDate?: string; // ISO date string, if sanctioned
}

export interface Post {
  id: string;
  threadId: string;
  author: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  content: string; // Markdown or BBCode
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
  poll?: Poll; // For non-binding polls
  relatedVotationId?: string; // Link to a binding votation
}

export interface Forum {
  id: string;
  categoryId?: string; // Parent category
  parentId?: string; // Parent forum (for subforums)
  name: string;
  description: string;
  threadCount: number;
  postCount: number;
  isPublic?: boolean; // Visible to non-logged-in users
  isAgora?: boolean; // Special flag for Agora forum
  subForums?: Forum[];
}

export interface ForumCategory {
  id: string;
  name: string;
  description?: string;
  forums: Forum[];
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface Poll { // For non-binding polls within threads
  id: string;
  question: string;
  options: PollOption[];
  allowMultipleVotes?: boolean;
  endDate?: string; // ISO date string
  totalVotes: number;
  voters?: Record<string, string>; // Record<userId, optionId>
}

// For binding votations in Agora
export type VotationStatus = 'active' | 'closed_passed' | 'closed_failed_quorum' | 'closed_failed_vote' | 'closed_executed' | 'closed_rejected';

export interface VotationOptionTally {
  for: number;
  against: number;
  abstain: number;
}

export interface Votation {
  id: string;
  title: string;
  description: string; // Primary details of what's being voted on
  justification?: string; // Proposer's reasoning (can be first post in thread)
  proposerId: string;
  proposerUsername: string;
  type: 'sanction' | 'rule_change' | 'forum_management' | 'other'; // Type of votation
  createdAt: string; // ISO date string
  deadline: string; // ISO date string for when voting ends
  status: VotationStatus;
  
  // Specific to sanction votations
  targetUserId?: string;
  targetUsername?: string;
  sanctionDuration?: string; // e.g., "7 days", "permanent"
  
  // Vote tracking
  options: VotationOptionTally; // e.g., { for: 0, against: 0, abstain: 0 }
  voters: Record<string, 'for' | 'against' | 'abstain'>; // Record<userId, voteChoice>
  totalVotesCast: number;
  quorumRequired?: number;
  
  relatedThreadId: string; // ID of the discussion thread in Agora
  outcome?: string; // Text describing the result after closing
}


export interface PrivateMessage {
  id: string;
  sender: User;
  recipient: User;
  content: string;
  createdAt: string; // ISO date string
  isRead?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'reply' | 'mention' | 'pm' | 'votation_result';
  content: string;
  link?: string;
  createdAt: string; // ISO date string
  isRead?: boolean;
}
