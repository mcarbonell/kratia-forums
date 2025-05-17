
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser } from './types';
import type { UserRole } from '@/hooks/use-mock-auth';

// Helper to find a user, ensuring we use the most up-to-date mockUsers array.
// This is critical. If a user is not found, it will throw an error,
// which should stop the seed process and alert you to an inconsistency.
const findUserById = (userId: string, usersArray: KratiaUser[]): KratiaUser => {
    const user = usersArray.find(u => u.id === userId);
    if (!user) {
        console.error(`Mock user with ID ${userId} not found in mockData.ts. This is a critical error during seeding setup.`);
        throw new Error(`Mock user with ID ${userId} not found. Seed data may be inconsistent.`);
    }
    return user;
};

// Define the base array of users first.
const MOCK_USERS_ARRAY: KratiaUser[] = [
  { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/200/200', registrationDate: '2023-01-15T10:00:00Z', karma: 0, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', canVote: true, isQuarantined: false, role: 'user', status: 'active' },
  { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 0, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', canVote: true, isQuarantined: false, role: 'normal_user', status: 'active' },
  { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/200/200', registrationDate: '2022-11-01T08:00:00Z', karma: 0, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', canVote: true, isQuarantined: false, role: 'normal_user', status: 'active' },
  { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', avatarUrl: 'https://picsum.photos/seed/diana/200/200', registrationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), karma: 0, location: 'New York', aboutMe: 'Learning the ropes.', canVote: false, isQuarantined: false, role: 'user', status: 'under_sanction_process' },
  { id: 'user5', username: 'SanctionedSam', email: 'sam@example.com', avatarUrl: 'https://picsum.photos/seed/sam/200/200', registrationDate: '2023-02-01T10:00:00Z', karma: 5, location: 'Penalty Box', aboutMe: 'Currently sanctioned.', canVote: false, isQuarantined: false, role: 'user', status: 'sanctioned', sanctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'admin1', username: 'AdminAnna', email: 'adminanna@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/200/200', registrationDate: '2022-10-01T08:00:00Z', karma: 0, location: 'Control Room', aboutMe: 'Ensuring order and progress.', canVote: true, isQuarantined: false, role: 'admin', status: 'active' },
  { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/200/200', registrationDate:  '2022-09-01T08:00:00Z', karma: 0, location: 'The Genesis Block', aboutMe: 'Laid the first stone.', canVote: true, isQuarantined: false, role: 'founder', status: 'active' },
  // These two are for mock auth state, not for Firestore 'users' collection
  // { id: 'visitor0', username: 'Visitor', email: '', role: 'visitor' as UserRole, status: 'active'},
  // { id: 'guest1', username: 'Guest User', email: 'guest@example.com', avatarUrl: 'https://picsum.photos/seed/guest/100/100', role: 'guest' as UserRole, status: 'active'},
];
export const mockUsers = MOCK_USERS_ARRAY; // Export for use in other parts of the app if needed, like useMockAuth

// Define authors using the helper to ensure they exist in MOCK_USERS_ARRAY
const alice = findUserById('user1', MOCK_USERS_ARRAY);
const bob = findUserById('user2', MOCK_USERS_ARRAY);
const charlie = findUserById('user3', MOCK_USERS_ARRAY);
const adminAnna = findUserById('admin1', MOCK_USERS_ARRAY);

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
    [bob.id]: 'opt2_summer',
    [charlie.id]: 'opt3_autumn'
  }
};

export const mockThreadsData: Omit<Thread, 'author'>[] = [
  { id: 'thread1_welcome', forumId: 'forum1', title: 'General Discussion Welcome Thread', createdAt: '2023-05-01T10:00:00Z', lastReplyAt: '2023-05-01T10:05:00Z', postCount: 0, isSticky: true, poll: thread1Poll, isPublic: true, authorId: alice.id },
  { id: 'thread2_tech', forumId: 'forum2', title: 'The Future of Technology', createdAt: '2023-05-02T11:00:00Z', postCount: 0, isSticky: false, isPublic: true, authorId: charlie.id },
  { id: 'thread3_books', forumId: 'forum1', title: 'Favorite Books of 2024', createdAt: '2023-05-03T12:00:00Z', postCount: 0, isSticky: false, isPublic: true, authorId: bob.id },
  { id: 'votation1_thread_sticky', forumId: 'agora', title: '[VOTATION] Make "Introductions" thread sticky', createdAt: '2023-06-01T09:00:00Z', postCount: 0, isLocked: false, isPublic: true, relatedVotationId: 'votation_example_1', authorId: adminAnna.id },
].map(t => ({...t, author: findUserById(t.authorId, MOCK_USERS_ARRAY)})) as Thread[];


export const mockPostsData: Omit<Post, 'author'>[] = [
  { id: 'post1_1_welcome', threadId: 'thread1_welcome', content: 'This is the first post in the general discussion thread. Welcome everyone! What is your favorite season? (Check out the poll above!)', createdAt: '2023-05-01T10:00:00Z', reactions: {'👍': { userIds: [bob.id, charlie.id] } }, authorId: alice.id },
  { id: 'post1_2_thanks', threadId: 'thread1_welcome', content: 'Thanks for the welcome, Alice! Glad to be here. I voted Summer!', createdAt: '2023-05-01T10:05:00Z', reactions: {'😊': { userIds: [alice.id] } }, authorId: bob.id },
  { id: 'post2_1_ai', threadId: 'thread2_tech', content: "Let's talk about the future of technology. What are your predictions for AI in the next 5 years?", createdAt: '2023-05-02T11:00:00Z', reactions: {}, authorId: charlie.id },
  { id: 'post3_1_placeholder', threadId: 'thread3_books', content: "What are everyone's favorite books this year?", createdAt: '2023-05-03T12:00:00Z', reactions: {}, authorId: bob.id },
  { id: 'post4_1_propose_sticky', threadId: 'votation1_thread_sticky', content: 'I propose we make the "Introductions" forum\'s main thread (or the forum itself) more prominent. It helps new users find where to post first.', createdAt: '2023-06-01T09:00:00Z', reactions: {}, authorId: adminAnna.id },
  { id: 'post4_2_agree_sticky', threadId: 'votation1_thread_sticky', content: 'I agree with AdminAnna. A prominent introductions area would be very beneficial.', createdAt: '2023-06-01T09:15:00Z', reactions: {}, authorId: charlie.id },
].map(p => ({...p, author: findUserById(p.authorId, MOCK_USERS_ARRAY)})) as Post[];


export const mockForumsData: Forum[] = [
  { id: 'forum1', categoryId: 'cat1', name: 'General Discussion', description: 'A place to discuss anything and everything.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum_intro', categoryId: 'cat1', name: 'Introductions', description: 'Introduce yourself to the community!', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum2', categoryId: 'cat1', name: 'Technology Hub', description: 'Discussions about software, hardware, and the future of tech.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'forum3', categoryId: 'cat2', name: 'Hobbies Corner', description: 'Share your hobbies and interests.', threadCount: 0, postCount: 0, isPublic: true },
  { id: 'agora', categoryId: 'cat_agora', name: 'Agora - Votations', description: 'Official proposals and community votations.', threadCount: 0, postCount: 0, isPublic: true, isAgora: true },
];

export const mockCategoriesData: Omit<ForumCategory, 'forums'>[] = [
  { id: 'cat1', name: 'Main Topics', description: "Discussions about primary subjects." },
  { id: 'cat2', name: 'Community Life', description: "Everything related to the community itself." },
  { id: 'cat_agora', name: 'Governance', description: "Official proposals and community votations." },
];
// Votations are created dynamically, so mockVotations can be empty or for reference.
export const mockVotationsData: Votation[] = [];
    

    