
import type { ForumCategory, Forum, Thread, Post, User, Poll, Votation } from './types';
import { KRATIA_CONFIG } from './config';

export const mockUsers: User[] = [
  { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/200/200', registrationDate: '2023-01-15T10:00:00Z', karma: 0, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0 },
  { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 0, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', canVote: false, isQuarantined: true, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0 },
  { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/200/200', registrationDate: '2022-11-01T08:00:00Z', karma: 0, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0 },
  { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', avatarUrl: 'https://picsum.photos/seed/diana/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 0, location: 'New York', aboutMe: 'Just joined, excited to learn!', canVote: false, isQuarantined: true, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0 },
  { id: 'admin1', username: 'AdminAnna', email: 'adminana@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/200/200', registrationDate: '2022-10-01T08:00:00Z', karma: 0, location: 'Control Room', aboutMe: 'Ensuring order and progress.', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0 },
  { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/200/200', registrationDate:  '2022-09-01T08:00:00Z', karma: 0, location: 'The Genesis Block', aboutMe: 'Laid the first stone.', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0 },
];

// Helper to find a user, ensuring we use the most up-to-date mockUsers array.
const findUser = (userId: string) => {
    const user = mockUsers.find(u => u.id === userId);
    if (!user) throw new Error(`Mock user with ID ${userId} not found.`);
    return user;
};


export const mockPosts: Post[] = [
  {
    id: 'post1', threadId: 'thread1_welcome', author: findUser('user1'), content: 'This is the first post in the general discussion thread. Welcome everyone!', createdAt: '2023-05-01T10:00:00Z', reactions: {'👍': { userIds: ['user2', 'user3'] } },
    poll: {
      id: 'poll1',
      question: 'What is your favorite season?',
      options: [
        { id: 'opt1', text: 'Spring', voteCount: 10 },
        { id: 'opt2', text: 'Summer', voteCount: 15 },
        { id: 'opt3', text: 'Autumn', voteCount: 20 },
        { id: 'opt4', text: 'Winter', voteCount: 5 },
      ],
      totalVotes: 50,
    }
  },
  { id: 'post2', threadId: 'thread1_welcome', author: findUser('user2'), content: 'Thanks for the welcome, Alice! Glad to be here.', createdAt: '2023-05-01T10:05:00Z', reactions: {'😊': { userIds: ['user1'] } } },
  { id: 'post3', threadId: 'thread2_tech', author: findUser('user3'), content: 'Let\'s talk about the future of technology. What are your predictions for AI in the next 5 years?', createdAt: '2023-05-02T11:00:00Z', reactions: {} },
  { id: 'post4', threadId: 'votation1_thread_sticky', author: findUser('user1'), content: 'I propose we make "Introductions" a sticky thread. It helps new users find where to post first.', createdAt: '2023-06-01T09:00:00Z', reactions: {}},
  { id: 'post5', threadId: 'votation1_thread_sticky', author: findUser('user3'), content: 'I agree with Alice. A sticky introductions thread would be very beneficial.', createdAt: '2023-06-01T09:15:00Z', reactions: {}},
];

export const mockThreads: Thread[] = [
  { id: 'thread1_welcome', forumId: 'forum1', title: 'General Discussion Welcome Thread', author: findUser('user1'), createdAt: '2023-05-01T10:00:00Z', lastReplyAt: '2023-05-01T10:05:00Z', postCount: 2, isSticky: true },
  { id: 'thread2_tech', forumId: 'forum2', title: 'The Future of Technology', author: findUser('user3'), createdAt: '2023-05-02T11:00:00Z', postCount: 1 },
  { id: 'thread3_books', forumId: 'forum1', title: 'Favorite Books of 2024', author: findUser('user2'), createdAt: '2023-05-03T12:00:00Z', postCount: 0 },
];

export const mockAgoraThreads: Thread[] = [
   { id: 'votation1_thread_sticky', forumId: 'agora', title: '[VOTATION] Make "Introductions" thread sticky', author: findUser('user1'), createdAt: '2023-06-01T09:00:00Z', postCount: 2, isLocked: false},
];

export const mockForums: Forum[] = [
  { id: 'forum1', categoryId: 'cat1', name: 'General Discussion', description: 'A place to discuss anything and everything.', threadCount: 2, postCount: 2, isPublic: true },
  { id: 'forum_intro', categoryId: 'cat1', name: 'Introductions', description: 'Introduce yourself to the community!', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum2', categoryId: 'cat1', name: 'Technology Hub', description: 'Discussions about software, hardware, and the future of tech.', threadCount: 1, postCount: 1, isPublic: true },
  { id: 'forum3', categoryId: 'cat2', name: 'Hobbies Corner', description: 'Share your hobbies and interests.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'agora', categoryId: 'cat_agora', name: 'Agora - Votations', description: 'Official proposals and community votations.', threadCount: mockAgoraThreads.length, postCount: mockPosts.filter(p => p.threadId.startsWith('votation')).length, isPublic: true, isAgora: true },
];

export const mockCategories: ForumCategory[] = [
  { id: 'cat1', name: 'Main Topics', forums: mockForums.filter(f => f.categoryId === 'cat1' && !f.isAgora) },
  { id: 'cat2', name: 'Community Life', forums: mockForums.filter(f => f.categoryId === 'cat2' && !f.isAgora) },
  { id: 'cat_agora', name: 'Governance', forums: mockForums.filter(f => f.isAgora) },
];

export const mockVotations: Votation[] = [
  {
    id: 'votation1',
    title: 'Make "Introductions" thread sticky in General Discussion',
    description: 'This proposal is to set the "Introductions" thread in the "General Discussion" forum as a sticky thread to improve visibility for new members.',
    justification: 'Having the introductions thread always at the top will help new users find it easily and encourage them to introduce themselves, fostering a more welcoming community.',
    proposer: findUser('user1'),
    createdAt: '2023-06-01T09:00:00Z',
    endDate: new Date(Date.now() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
    votesFor: 5,
    votesAgainst: 1,
    totalVotesCast: 6,
    relatedThreadId: 'votation1_thread_sticky',
  },
  {
    id: 'votation2',
    title: 'Create a new subforum "Gaming" under "Hobbies Corner"',
    description: 'Proposal to create a new subforum titled "Gaming" within the "Hobbies Corner" category. Description: "Discussions about video games, board games, and all things gaming."',
    proposer: findUser('user3'),
    createdAt: '2023-05-28T14:00:00Z',
    endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Ended 2 days ago
    status: 'closed_passed',
    quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
    votesFor: 12,
    votesAgainst: 2,
    totalVotesCast: 14,
  }
];
