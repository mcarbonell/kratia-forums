
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
  // poll?: Poll; // Removed from Post
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
  poll?: Poll; // Added to Thread
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

export interface Poll { // Traditional, non-binding poll
  id: string;
  question: string;
  options: PollOption[];
  allowMultipleVotes?: boolean; // Currently not implemented, defaults to single vote
  endDate?: string; // ISO date string
  totalVotes: number;
  voters?: Record<string, string>; // Record<userId, optionId>
}

export type VotationStatus = 'active' | 'closed_passed' | 'closed_failed_quorum' | 'closed_failed_vote';

export interface Votation { // Binding Agora votation
  id: string;
  title: string;
  description: string; // Formal proposal
  justification?: string; // Proposer's message
  proposer: User;
  createdAt: string; // ISO date string
  endDate: string; // ISO date string
  status: VotationStatus;
  quorumRequired: number;
  votesFor: number;
  votesAgainst: number;
  totalVotesCast: number;
  // type: 'sticky' | 'create_subforum' | 'delete_subforum' | 'set_subforum_privacy' | 'sanction_user' | 'modify_constitution';
  // actionDetails: any; // Specifics for the action
  relatedThreadId?: string; // For debate
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
  userId: string; // User to notify
  type: 'reply' | 'mention' | 'pm' | 'votation_result';
  content: string;
  link?: string; // Link to the relevant content
  createdAt: string; // ISO date string
  isRead?: boolean;
}
