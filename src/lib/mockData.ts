
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser, Poll } from './types';
import type { UserRole } from '@/hooks/use-mock-auth';

// Helper to find a user, ensuring we use the most up-to-date mockUsers array.
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
  { id: 'user1', username: 'Alice', email: 'alice@example.com', avatarUrl: 'https://picsum.photos/seed/alice/200/200', registrationDate: '2023-01-15T10:00:00Z', karma: 0, location: 'Wonderland', aboutMe: 'Curiouser and curiouser!', canVote: true, isQuarantined: false, role: 'user', status: 'active', onboardingAccepted: true },
  { id: 'user2', username: 'BobTheBuilder', email: 'bob@example.com', avatarUrl: 'https://picsum.photos/seed/bob/200/200', registrationDate: '2023-03-20T14:30:00Z', karma: 0, location: 'Construction Site', aboutMe: 'Can we fix it? Yes, we can!', canVote: true, isQuarantined: false, role: 'normal_user', status: 'active', onboardingAccepted: true },
  { id: 'user3', username: 'CharlieComm', email: 'charlie@example.com', avatarUrl: 'https://picsum.photos/seed/charlie/200/200', registrationDate: '2022-11-01T08:00:00Z', karma: 0, location: 'The Internet', aboutMe: 'Loves to discuss and debate.', canVote: true, isQuarantined: false, role: 'normal_user', status: 'active', onboardingAccepted: true },
  { id: 'user4', username: 'DianaNewbie', email: 'diana@example.com', avatarUrl: 'https://picsum.photos/seed/diana/200/200', registrationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), karma: 0, location: 'New York', aboutMe: 'Learning the ropes.', canVote: false, isQuarantined: true, role: 'user', status: 'pending_admission', onboardingAccepted: false },
  { id: 'user5', username: 'SanctionedSam', email: 'sam@example.com', avatarUrl: 'https://picsum.photos/seed/sam/200/200', registrationDate: '2023-02-01T10:00:00Z', karma: 5, location: 'Penalty Box', aboutMe: 'Currently sanctioned.', canVote: false, isQuarantined: false, role: 'user', status: 'sanctioned', sanctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), onboardingAccepted: true },
  { id: 'admin1', username: 'AdminAnna', email: 'adminanna@example.com', avatarUrl: 'https://picsum.photos/seed/adminana/200/200', registrationDate: '2022-10-01T08:00:00Z', karma: 0, location: 'Control Room', aboutMe: 'Ensuring order and progress.', canVote: true, isQuarantined: false, role: 'admin', status: 'active', onboardingAccepted: true },
  { id: 'founder1', username: 'FoundingFather', email: 'founder@example.com', avatarUrl: 'https://picsum.photos/seed/founder/200/200', registrationDate:  '2022-09-01T08:00:00Z', karma: 0, location: 'The Genesis Block', aboutMe: 'Laid the first stone.', canVote: true, isQuarantined: false, role: 'founder', status: 'active', onboardingAccepted: true },
];
export const mockUsers = MOCK_USERS_ARRAY;

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

const rawMockThreadsDataWithAuthorId: Array<Omit<Thread, 'author'> & {authorId: string}> = [
  { id: 'thread1_welcome', forumId: 'forum1', title: 'General Discussion Welcome Thread', createdAt: '2023-05-01T10:00:00Z', lastReplyAt: '2023-05-01T10:05:00Z', postCount: 0, isSticky: true, poll: thread1Poll, isPublic: true, authorId: alice.id },
  { id: 'thread2_tech', forumId: 'forum2', title: 'The Future of Technology', createdAt: '2023-05-02T11:00:00Z', postCount: 0, isSticky: false, isPublic: true, authorId: charlie.id, lastReplyAt: '2023-05-02T11:00:00Z' },
  { id: 'thread3_books', forumId: 'forum1', title: 'Favorite Books of 2024', createdAt: '2023-05-03T12:00:00Z', postCount: 0, isSticky: false, isPublic: true, authorId: bob.id, lastReplyAt: '2023-05-03T12:00:00Z' },
  { id: 'votation1_thread_sticky', forumId: 'agora', title: '[VOTATION] Make "Introductions" thread sticky', createdAt: '2023-06-01T09:00:00Z', postCount: 0, isLocked: false, isPublic: true, relatedVotationId: 'votation_example_1', authorId: adminAnna.id, lastReplyAt: '2023-06-01T09:15:00Z' },
];

// Add 15 more threads to forum1 for pagination testing
for (let i = 1; i <= 15; i++) {
  const author = [alice, bob, charlie][i % 3];
  const date = new Date(2023, 4, 3 + i, 10 + (i % 5), i * 3); // Vary dates
  rawMockThreadsDataWithAuthorId.push({
    id: `forum1_test_thread_${i}`,
    forumId: 'forum1',
    title: `Forum 1 Test Thread for Pagination ${i}`,
    authorId: author.id,
    createdAt: date.toISOString(),
    lastReplyAt: new Date(date.getTime() + (i * 1000 * 60 * 5)).toISOString(), // last reply 5*i minutes later
    postCount: 1, // Assume at least one post
    isSticky: false,
    isPublic: true,
  });
}

export const mockThreadsData = rawMockThreadsDataWithAuthorId.map(t => {
    const author = findUserById(t.authorId, MOCK_USERS_ARRAY);
    return { ...t, author: {id: author.id, username: author.username, avatarUrl: author.avatarUrl }};
});


const rawMockPostsDataWithAuthorId: Array<Omit<Post, 'author'> & {authorId: string}> = [
  { id: 'post1_1_welcome', threadId: 'thread1_welcome', content: 'This is the first post in the general discussion thread. Welcome everyone! What is your favorite season? (Check out the poll above!)', createdAt: '2023-05-01T10:00:00Z', reactions: {'👍': { userIds: [bob.id, charlie.id] } }, authorId: alice.id },
  { id: 'post1_2_thanks', threadId: 'thread1_welcome', content: 'Thanks for the welcome, Alice! Glad to be here. I voted Summer!', createdAt: '2023-05-01T10:05:00Z', reactions: {'😊': { userIds: [alice.id] } }, authorId: bob.id },
  { id: 'post2_1_ai', threadId: 'thread2_tech', content: "Let's talk about the future of technology. What are your predictions for AI in the next 5 years?", createdAt: '2023-05-02T11:00:00Z', reactions: {}, authorId: charlie.id },
  { id: 'post3_1_placeholder', threadId: 'thread3_books', content: "What are everyone's favorite books this year?", createdAt: '2023-05-03T12:00:00Z', reactions: {}, authorId: bob.id },
  { id: 'post4_1_propose_sticky', threadId: 'votation1_thread_sticky', content: 'I propose we make the "Introductions" forum\'s main thread (or the forum itself) more prominent. It helps new users find where to post first.', createdAt: '2023-06-01T09:00:00Z', reactions: {}, authorId: adminAnna.id },
  { id: 'post4_2_agree_sticky', threadId: 'votation1_thread_sticky', content: 'I agree with AdminAnna. A prominent introductions area would be very beneficial.', createdAt: '2023-06-01T09:15:00Z', reactions: {}, authorId: charlie.id },
];

// Add 15 more posts to thread1_welcome for pagination testing (if we implement post pagination later)
for (let i = 1; i <= 15; i++) {
  const author = [alice, bob, charlie][i % 3];
  const date = new Date(2023, 4, 1, 10, 5 + (i * 2)); // Vary post times
  rawMockPostsDataWithAuthorId.push({
    id: `thread1_test_post_${i}`,
    threadId: 'thread1_welcome',
    authorId: author.id,
    content: `This is test post number ${i} in the welcome thread for pagination testing.`,
    createdAt: date.toISOString(),
    reactions: {},
  });
}
// Add posts for the new threads in forum1
rawMockThreadsDataWithAuthorId.forEach(thread => {
  if (thread.forumId === 'forum1' && thread.id.startsWith('forum1_test_thread_')) {
    // Add one initial post for each test thread
    const author = findUserById(thread.authorId, MOCK_USERS_ARRAY);
    const initialPostDate = new Date(thread.createdAt); // Use thread creation time for its first post
    rawMockPostsDataWithAuthorId.push({
      id: `${thread.id}_initial_post`,
      threadId: thread.id,
      authorId: author.id,
      content: `This is the first post for the thread: "${thread.title}".`,
      createdAt: initialPostDate.toISOString(),
      reactions: {},
    });
  }
});


export const mockPostsData = rawMockPostsDataWithAuthorId.map(p => {
    const author = findUserById(p.authorId, MOCK_USERS_ARRAY);
    return { ...p, author: {id: author.id, username: author.username, avatarUrl: author.avatarUrl }};
});


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
    
