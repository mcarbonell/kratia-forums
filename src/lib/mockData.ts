import type { ForumCategory, Forum, Thread, Post, User, Poll, Votation } from './types';
import { KRATIA_CONFIG } from './config';

export const mockUsers: User[] = [
  { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/200/200', registrationDate: '2023-01-15T10:00:00Z', karma: 125, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', canVote: true, isQuarantined: false },
  { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 80, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', canVote: false, isQuarantined: true },
  { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/200/200', registrationDate: '2022-11-01T08:00:00Z', karma: 500, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', canVote: true, isQuarantined: false },
  { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', registrationDate: new Date().toISOString(), karma: 5, location: 'New York', aboutMe: 'Just joined, excited to learn!', canVote: false, isQuarantined: true },
];

export const mockPosts: Post[] = [
  {
    id: 'post1', threadId: 'thread1', author: mockUsers[0], content: 'This is the first post in the general discussion thread. Welcome everyone!', createdAt: '2023-05-01T10:00:00Z', reactions: [{ emoji: '👍', userId: 'user2', count: 1 }],
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
  { id: 'post2', threadId: 'thread1', author: mockUsers[1], content: 'Thanks for the welcome, Alice! Glad to be here.', createdAt: '2023-05-01T10:05:00Z', reactions: [{ emoji: '😊', userId: 'user1', count: 1 }] },
  { id: 'post3', threadId: 'thread2', author: mockUsers[2], content: 'Let\'s talk about the future of technology. What are your predictions for AI in the next 5 years?', createdAt: '2023-05-02T11:00:00Z', reactions: [] },
  { id: 'post4', threadId: 'votation1_thread', author: mockUsers[0], content: 'I propose we make "Introductions" a sticky thread. It helps new users find where to post first.', createdAt: '2023-06-01T09:00:00Z', reactions: []},
  { id: 'post5', threadId: 'votation1_thread', author: mockUsers[2], content: 'I agree with Alice. A sticky introductions thread would be very beneficial.', createdAt: '2023-06-01T09:15:00Z', reactions: []},
];

export const mockThreads: Thread[] = [
  { id: 'thread1', forumId: 'forum1', title: 'General Discussion Welcome Thread', author: mockUsers[0], createdAt: '2023-05-01T10:00:00Z', lastReplyAt: '2023-05-01T10:05:00Z', postCount: 2, isSticky: true },
  { id: 'thread2', forumId: 'forum2', title: 'The Future of Technology', author: mockUsers[2], createdAt: '2023-05-02T11:00:00Z', postCount: 1 },
  { id: 'thread3', forumId: 'forum1', title: 'Favorite Books of 2024', author: mockUsers[1], createdAt: '2023-05-03T12:00:00Z', postCount: 0 },
];

export const mockAgoraThreads: Thread[] = [
   { id: 'votation1_thread', forumId: 'agora', title: '[VOTATION] Make "Introductions" thread sticky', author: mockUsers[0], createdAt: '2023-06-01T09:00:00Z', postCount: 2, isLocked: false},
];

export const mockForums: Forum[] = [
  { id: 'forum1', categoryId: 'cat1', name: 'General Discussion', description: 'A place to discuss anything and everything.', threadCount: 2, postCount: 2, isPublic: true, subForums: [
    { id: 'subforum1-1', parentId: 'forum1', name: 'Introductions', description: 'Introduce yourself to the community!', threadCount: 0, postCount: 0, isPublic: true },
  ]},
  { id: 'forum2', categoryId: 'cat1', name: 'Technology Hub', description: 'Discussions about software, hardware, and the future of tech.', threadCount: 1, postCount: 1, isPublic: true },
  { id: 'forum3', categoryId: 'cat2', name: 'Hobbies Corner', description: 'Share your hobbies and interests.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'agora', categoryId: 'cat_agora', name: 'Agora - Votations', description: 'Official proposals and community votations.', threadCount: mockAgoraThreads.length, postCount: mockPosts.filter(p => p.threadId.startsWith('votation')).length, isPublic: true, isAgora: true },
];

export const mockCategories: ForumCategory[] = [
  { id: 'cat1', name: 'Main Topics', forums: mockForums.filter(f => f.categoryId === 'cat1') },
  { id: 'cat2', name: 'Community Life', forums: mockForums.filter(f => f.categoryId === 'cat2') },
  { id: 'cat_agora', name: 'Governance', forums: mockForums.filter(f => f.isAgora) },
];

export const mockVotations: Votation[] = [
  {
    id: 'votation1',
    title: 'Make "Introductions" thread sticky in General Discussion',
    description: 'This proposal is to set the "Introductions" thread in the "General Discussion" forum as a sticky thread to improve visibility for new members.',
    justification: 'Having the introductions thread always at the top will help new users find it easily and encourage them to introduce themselves, fostering a more welcoming community.',
    proposer: mockUsers[0],
    createdAt: '2023-06-01T09:00:00Z',
    endDate: new Date(Date.now() + KRATIA_CONFIG.VOTATION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
    votesFor: 5,
    votesAgainst: 1,
    totalVotesCast: 6,
    relatedThreadId: 'votation1_thread',
  },
  {
    id: 'votation2',
    title: 'Create a new subforum "Gaming" under "Hobbies Corner"',
    description: 'Proposal to create a new subforum titled "Gaming" within the "Hobbies Corner" category. Description: "Discussions about video games, board games, and all things gaming."',
    proposer: mockUsers[2],
    createdAt: '2023-05-28T14:00:00Z',
    endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Ended 2 days ago
    status: 'closed_passed',
    quorumRequired: KRATIA_CONFIG.VOTATION_QUORUM_MIN_PARTICIPANTS,
    votesFor: 12,
    votesAgainst: 2,
    totalVotesCast: 14,
  }
];