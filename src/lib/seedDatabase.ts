
'use server'; // Or remove if not needed, but good practice for server-side logic files

import { db } from '@/lib/firebase';
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser } from '@/lib/types';
import { mockUsers } from '@/lib/mockData'; // We'll use mockUsers for author details
import { collection, doc, writeBatch, Timestamp, increment } from 'firebase/firestore'; // Added increment

// Helper to get author info in the denormalized structure
const getAuthorInfo = (user: KratiaUser) => {
  if (!user) return { id: 'unknown', username: 'Unknown User', avatarUrl: '' };
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl || '',
  };
};

const nowISO = () => new Date().toISOString();

export async function seedDatabase() {
  const batch = writeBatch(db);

  // --- USERS (from mockData, used for embedding) ---
  const alice = getAuthorInfo(mockUsers.find(u => u.id === 'user1')!);
  const bob = getAuthorInfo(mockUsers.find(u => u.id === 'user2')!);
  const charlie = getAuthorInfo(mockUsers.find(u => u.id === 'user3')!);

  // --- CATEGORIES ---
  const categories: Omit<ForumCategory, 'forums'>[] = [
    { id: 'cat1', name: 'Main Topics', description: "Discussions about primary subjects." },
    { id: 'cat2', name: 'Community Life', description: "Everything related to the community itself." },
    { id: 'cat_agora', name: 'Governance', description: "Official proposals and community votations." },
  ];

  categories.forEach(category => {
    const catRef = doc(db, "categories", category.id);
    batch.set(catRef, category);
  });

  // --- FORUMS ---
  // Note: threadCount and postCount will be updated by the threads/posts seeded below.
  const forums: Forum[] = [
    { id: 'forum1', categoryId: 'cat1', name: 'General Discussion', description: 'A place to discuss anything and everything.', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'forum_intro', categoryId: 'cat1', name: 'Introductions', description: 'Introduce yourself to the community!', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'forum2', categoryId: 'cat1', name: 'Technology Hub', description: 'Discussions about software, hardware, and the future of tech.', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'forum3', categoryId: 'cat2', name: 'Hobbies Corner', description: 'Share your hobbies and interests.', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'agora', categoryId: 'cat_agora', name: 'Agora - Votations', description: 'Official proposals and community votations.', threadCount: 0, postCount: 0, isPublic: true, isAgora: true },
  ];
  
  forums.forEach(forum => {
    const forumRef = doc(db, "forums", forum.id);
    // Initialize counts, will be updated by threads/posts
    batch.set(forumRef, { ...forum, threadCount: 0, postCount: 0 });
  });


  // --- THREADS & POSTS ---
  let forumPostCounts: Record<string, number> = {};
  forums.forEach(f => forumPostCounts[f.id] = 0);

  // Thread 1: General Discussion Welcome Thread (in forum1)
  const thread1Id = 'thread1_welcome';
  const thread1CreatedAt = '2023-05-01T10:00:00Z';
  let thread1PostCount = 0;
  let thread1LastReplyAt = thread1CreatedAt;

  const post1_1_Id = 'post1_1_welcome';
  const post1_1_CreatedAt = '2023-05-01T10:00:00Z';
  const post1_1_Content = 'This is the first post in the general discussion thread. Welcome everyone!';
  const post1_1_Poll = {
      id: 'poll1',
      question: 'What is your favorite season?',
      options: [
        { id: 'opt1', text: 'Spring', voteCount: 10 },
        { id: 'opt2', text: 'Summer', voteCount: 15 },
        { id: 'opt3', text: 'Autumn', voteCount: 20 },
        { id: 'opt4', text: 'Winter', voteCount: 5 },
      ],
      totalVotes: 50,
    };
  batch.set(doc(db, "posts", post1_1_Id), {
    threadId: thread1Id, author: alice, content: post1_1_Content, createdAt: post1_1_CreatedAt, reactions: [{ emoji: '👍', userId: 'user2', count: 1 }], poll: post1_1_Poll
  });
  thread1PostCount++;
  forumPostCounts['forum1'] = (forumPostCounts['forum1'] || 0) + 1;
  if (new Date(post1_1_CreatedAt) > new Date(thread1LastReplyAt)) thread1LastReplyAt = post1_1_CreatedAt;

  const post1_2_Id = 'post1_2_thanks';
  const post1_2_CreatedAt = '2023-05-01T10:05:00Z';
  batch.set(doc(db, "posts", post1_2_Id), {
    threadId: thread1Id, author: bob, content: 'Thanks for the welcome, Alice! Glad to be here.', createdAt: post1_2_CreatedAt, reactions: [{ emoji: '😊', userId: 'user1', count: 1 }]
  });
  thread1PostCount++;
  forumPostCounts['forum1'] = (forumPostCounts['forum1'] || 0) + 1;
  if (new Date(post1_2_CreatedAt) > new Date(thread1LastReplyAt)) thread1LastReplyAt = post1_2_CreatedAt;

  batch.set(doc(db, "threads", thread1Id), {
    forumId: 'forum1', title: 'General Discussion Welcome Thread', author: alice, createdAt: thread1CreatedAt, lastReplyAt: thread1LastReplyAt, postCount: thread1PostCount, isSticky: true, isLocked: false, isPublic: true
  });
  batch.update(doc(db, "forums", "forum1"), { threadCount: increment(1) }); // Increment thread count for forum1


  // Thread 2: The Future of Technology (in forum2)
  const thread2Id = 'thread2_tech';
  const thread2CreatedAt = '2023-05-02T11:00:00Z';
  let thread2PostCount = 0;
  let thread2LastReplyAt = thread2CreatedAt;

  const post2_1_Id = 'post2_1_ai';
  const post2_1_CreatedAt = '2023-05-02T11:00:00Z';
  batch.set(doc(db, "posts", post2_1_Id), {
    threadId: thread2Id, author: charlie, content: "Let's talk about the future of technology. What are your predictions for AI in the next 5 years?", createdAt: post2_1_CreatedAt, reactions: []
  });
  thread2PostCount++;
  forumPostCounts['forum2'] = (forumPostCounts['forum2'] || 0) + 1;
  if (new Date(post2_1_CreatedAt) > new Date(thread2LastReplyAt)) thread2LastReplyAt = post2_1_CreatedAt;

  batch.set(doc(db, "threads", thread2Id), {
    forumId: 'forum2', title: 'The Future of Technology', author: charlie, createdAt: thread2CreatedAt, lastReplyAt: thread2LastReplyAt, postCount: thread2PostCount, isSticky: false, isLocked: false, isPublic: true
  });
  batch.update(doc(db, "forums", "forum2"), { threadCount: increment(1) });


  // Thread 3: Favorite Books of 2024 (in forum1)
  const thread3Id = 'thread3_books';
  const thread3CreatedAt = '2023-05-03T12:00:00Z';
  let thread3PostCount = 0;
  let thread3LastReplyAt = thread3CreatedAt;
  
  const post3_1_Id = 'post3_1_placeholder';
  const post3_1_CreatedAt = '2023-05-03T12:00:00Z';
   batch.set(doc(db, "posts", post3_1_Id), {
    threadId: thread3Id, author: bob, content: "What are everyone's favorite books this year?", createdAt: post3_1_CreatedAt, reactions: []
  });
  thread3PostCount++;
  forumPostCounts['forum1'] = (forumPostCounts['forum1'] || 0) + 1;
   if (new Date(post3_1_CreatedAt) > new Date(thread3LastReplyAt)) thread3LastReplyAt = post3_1_CreatedAt;


  batch.set(doc(db, "threads", thread3Id), {
    forumId: 'forum1', title: 'Favorite Books of 2024', author: bob, createdAt: thread3CreatedAt, lastReplyAt: thread3LastReplyAt, postCount: thread3PostCount, isSticky: false, isLocked: false, isPublic: true
  });
  batch.update(doc(db, "forums", "forum1"), { threadCount: increment(1) }); // Increment thread count for forum1


  // Thread 4 (Agora): [VOTATION] Make "Introductions" thread sticky (in agora)
  const thread4Id = 'votation1_thread_sticky';
  const thread4CreatedAt = '2023-06-01T09:00:00Z';
  let thread4PostCount = 0;
  let thread4LastReplyAt = thread4CreatedAt;

  const post4_1_Id = 'post4_1_propose';
  const post4_1_CreatedAt = '2023-06-01T09:00:00Z';
  batch.set(doc(db, "posts", post4_1_Id), {
    threadId: thread4Id, author: alice, content: 'I propose we make the "Introductions" forum\'s main thread (or the forum itself) more prominent. It helps new users find where to post first.', createdAt: post4_1_CreatedAt, reactions: []
  });
  thread4PostCount++;
  forumPostCounts['agora'] = (forumPostCounts['agora'] || 0) + 1;
  if (new Date(post4_1_CreatedAt) > new Date(thread4LastReplyAt)) thread4LastReplyAt = post4_1_CreatedAt;

  const post4_2_Id = 'post4_2_agree';
  const post4_2_CreatedAt = '2023-06-01T09:15:00Z';
  batch.set(doc(db, "posts", post4_2_Id), {
    threadId: thread4Id, author: charlie, content: 'I agree with Alice. A prominent introductions area would be very beneficial.', createdAt: post4_2_CreatedAt, reactions: []
  });
  thread4PostCount++;
  forumPostCounts['agora'] = (forumPostCounts['agora'] || 0) + 1;
  if (new Date(post4_2_CreatedAt) > new Date(thread4LastReplyAt)) thread4LastReplyAt = post4_2_CreatedAt;
  
  batch.set(doc(db, "threads", thread4Id), {
    forumId: 'agora', title: '[VOTATION] Make "Introductions" area more prominent', author: alice, createdAt: thread4CreatedAt, lastReplyAt: thread4LastReplyAt, postCount: thread4PostCount, isSticky: false, isLocked: false, isPublic: true
  });
  batch.update(doc(db, "forums", "agora"), { threadCount: increment(1) });


  // Update forum post counts
  for (const forumId in forumPostCounts) {
    if (forumPostCounts[forumId] > 0) {
      // Ensure the forum document exists before trying to update its postCount
      // The initial batch.set for forums already creates them with postCount: 0
      batch.update(doc(db, "forums", forumId), { postCount: forumPostCounts[forumId] });
    }
  }

  // Commit the batch
  await batch.commit();
  console.log("Database seeded successfully with mock data!");
}

// Example of how to create a user with specific karma for testing, if needed
// export async function createTestUser(userId: string, username: string, karma: number) {
//   const userRef = doc(db, "users", userId); // Assuming a 'users' collection for user profiles
//   await setDoc(userRef, {
//     id: userId,
//     username: username,
//     karma: karma,
//     email: `${username.toLowerCase()}@example.com`,
//     avatarUrl: `https://placehold.co/100x100.png?text=${username[0]}`,
//     registrationDate: nowISO(),
//     canVote: karma >= KRATIA_CONFIG.KARMA_THRESHOLD_FOR_VOTING,
//     isQuarantined: karma < KRATIA_CONFIG.KARMA_THRESHOLD_FOR_VOTING,
//   });
//   console.log(`Test user ${username} created.`);
// }

