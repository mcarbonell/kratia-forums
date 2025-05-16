
import type { ForumCategory, Forum, Thread, Post, User, Poll, Votation } from './types';
import { KRATIA_CONFIG } from './config';

export const mockUsers: User[] = [
  { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/200/200', registrationDate: '2023-01-15T10:00:00Z', karma: 0, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'active' },
  { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 0, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'active' },
  { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/200/200', registrationDate: '2022-11-01T08:00:00Z', karma: 0, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'active' },
  { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', avatarUrl: 'https://picsum.photos/seed/diana/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 0, location: 'New York', aboutMe: 'Just joined, excited to learn!', canVote: false, isQuarantined: true, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'under_sanction_process' },
  { id: 'user5', username: 'SanctionedSam', email: 'sam@example.com', avatarUrl: 'https://picsum.photos/seed/sam/200/200', registrationDate: '2023-02-01T10:00:00Z', karma: 5, location: 'Penalty Box', aboutMe: 'Currently sanctioned.', canVote: false, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'sanctioned', sanctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }, // Sanctioned for 7 days from now
  { id: 'admin1', username: 'AdminAnna', email: 'adminana@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/200/200', registrationDate: '2022-10-01T08:00:00Z', karma: 0, location: 'Control Room', aboutMe: 'Ensuring order and progress.', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'active' },
  { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/200/200', registrationDate:  '2022-09-01T08:00:00Z', karma: 0, location: 'The Genesis Block', aboutMe: 'Laid the first stone.', canVote: true, isQuarantined: false, totalPostsByUser: 0, totalReactionsReceived: 0, totalPostsInThreadsStartedByUser: 0, status: 'active' },
];

// Helper to find a user, ensuring we use the most up-to-date mockUsers array.
const findUser = (userId: string): User => {
    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
        console.error(`Mock user with ID ${userId} not found in mockData.ts. This is a critical error.`);
        // Fallback to a generic unknown user to prevent crashes, but this indicates a data setup issue.
        throw new Error(`Mock user with ID ${userId} not found. Seed data may be inconsistent.`);
    }
    return user;
};


export const mockPosts: Post[] = [
  {
    id: 'post1', threadId: 'thread1_welcome', author: findUser('user1'), content: 'This is the first post in the general discussion thread. Welcome everyone!', createdAt: '2023-05-01T10:00:00Z', reactions: {'👍': { userIds: [findUser('user2').id, findUser('user3').id] } }
  },
  { id: 'post2', threadId: 'thread1_welcome', author: findUser('user2'), content: 'Thanks for the welcome, Alice! Glad to be here.', createdAt: '2023-05-01T10:05:00Z', reactions: {'😊': { userIds: [findUser('user1').id] } } },
  { id: 'post3', threadId: 'thread2_tech', author: findUser('user3'), content: 'Let\'s talk about the future of technology. What are your predictions for AI in the next 5 years?', createdAt: '2023-05-02T11:00:00Z', reactions: {} },
  { id: 'post4', threadId: 'votation1_thread_sticky', author: findUser('user1'), content: 'I propose we make "Introductions" a sticky thread. It helps new users find where to post first.', createdAt: '2023-06-01T09:00:00Z', reactions: {}},
  { id: 'post5', threadId: 'votation1_thread_sticky', author: findUser('user3'), content: 'I agree with Alice. A sticky introductions thread would be very beneficial.', createdAt: '2023-06-01T09:15:00Z', reactions: {}},
];

const thread1Poll: Poll = {
  id: 'poll_thread1_favseason',
  question: 'What is your favorite season?',
  options: [
    { id: 'opt1_spring', text: 'Spring', voteCount: 10 },
    { id: 'opt2_summer', text: 'Summer', voteCount: 15 },
    { id: 'opt3_autumn', text: 'Autumn', voteCount: 20 },
    { id: 'opt4_winter', text: 'Winter', voteCount: 5 },
  ],
  totalVotes: 50,
  voters: {
    [findUser('user2').id]: 'opt2_summer',
    [findUser('user3').id]: 'opt3_autumn'
  }
};

export const mockThreads: Thread[] = [
  { id: 'thread1_welcome', forumId: 'forum1', title: 'General Discussion Welcome Thread', author: findUser('user1'), createdAt: '2023-05-01T10:00:00Z', lastReplyAt: '2023-05-01T10:05:00Z', postCount: 2, isSticky: true, poll: thread1Poll },
  { id: 'thread2_tech', forumId: 'forum2', title: 'The Future of Technology', author: findUser('user3'), createdAt: '2023-05-02T11:00:00Z', postCount: 1 },
  { id: 'thread3_books', forumId: 'forum1', title: 'Favorite Books of 2024', author: findUser('user2'), createdAt: '2023-05-03T12:00:00Z', postCount: 0 },
  { id: 'votation1_thread_sticky', forumId: 'agora', title: '[VOTATION] Make "Introductions" thread sticky', author: findUser('user1'), createdAt: '2023-06-01T09:00:00Z', postCount: 2, isLocked: false },
];


export const mockForums: Forum[] = [
  { id: 'forum1', categoryId: 'cat1', name: 'General Discussion', description: 'A place to discuss anything and everything.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum_intro', categoryId: 'cat1', name: 'Introductions', description: 'Introduce yourself to the community!', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum2', categoryId: 'cat1', name: 'Technology Hub', description: 'Discussions about software, hardware, and the future of tech.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum3', categoryId: 'cat2', name: 'Hobbies Corner', description: 'Share your hobbies and interests.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'agora', categoryId: 'cat_agora', name: 'Agora - Votations', description: 'Official proposals and community votations.', threadCount: 0, postCount: 0, isPublic: true, isAgora: true },
];

export const mockCategories: ForumCategory[] = [
  { id: 'cat1', name: 'Main Topics', forums: mockForums.filter(f => f.categoryId === 'cat1' && !f.isAgora) },
  { id: 'cat2', name: 'Community Life', forums: mockForums.filter(f => f.categoryId === 'cat2' && !f.isAgora) },
  { id: 'cat_agora', name: 'Governance', forums: mockForums.filter(f => f.isAgora) },
];

export const mockVotations: Votation[] = [
  // Votations are now created dynamically by the "Propose Sanction" feature
  // Keeping this empty for now to avoid conflicts with dynamic creation.
];
    
