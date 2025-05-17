
'use server';

import { db } from '@/lib/firebase';
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser, Poll } from '@/lib/types';
import { mockUsers as mockUsersData } from '@/lib/mockData';
import { collection, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/hooks/use-mock-auth';

const getAuthorInfo = (user: KratiaUser | undefined) => {
  if (!user || user.id === 'unknown') {
    console.warn("Attempted to get author info for undefined or 'unknown' user. Returning 'Unknown User'.");
    return { id: 'unknown', username: 'Unknown User', avatarUrl: '' };
  }
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username[0]}`,
  };
};

export async function seedDatabase() {
  const batch = writeBatch(db);
  console.log("Starting database seed...");

  console.log(`Processing ${mockUsersData.length} users from mockData for seeding...`);
  mockUsersData.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') {
        console.log(`Skipping seed for special mock user: ${user.id}`);
        return; 
    }

    console.log(`Preparing user for seed: ${user.id} - ${user.username} with role: ${user.role}, status: ${user.status}`);
    const userRef = doc(db, "users", user.id);
    const userData: KratiaUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username[0]}`,
        registrationDate: user.registrationDate || new Date().toISOString(),
        karma: user.karma || 0,
        location: user.location || null,
        aboutMe: user.aboutMe || null,
        canVote: user.canVote === undefined ? false : user.canVote,
        isQuarantined: user.isQuarantined === undefined ? false : user.isQuarantined,
        totalPostsByUser: user.totalPostsByUser || 0,
        totalReactionsReceived: user.totalReactionsReceived || 0,
        totalPostsInThreadsStartedByUser: user.totalPostsInThreadsStartedByUser || 0,
        role: user.role || 'user',
        status: user.status || 'active',
        sanctionEndDate: user.sanctionEndDate || null,
    };
    batch.set(userRef, userData);
  });
  console.log("User data prepared for batch.");

  const alice = mockUsersData.find(u => u.id === 'user1')!;
  const bob = mockUsersData.find(u => u.id === 'user2')!;
  const charlie = mockUsersData.find(u => u.id === 'user3')!;

  const aliceAuthorInfo = getAuthorInfo(alice);
  const bobAuthorInfo = getAuthorInfo(bob);
  const charlieAuthorInfo = getAuthorInfo(charlie);

  const categories: Omit<ForumCategory, 'forums'>[] = [
    { id: 'cat1', name: 'Main Topics', description: "Discussions about primary subjects." },
    { id: 'cat2', name: 'Community Life', description: "Everything related to the community itself." },
    { id: 'cat_agora', name: 'Governance', description: "Official proposals and community votations." },
  ];

  categories.forEach(category => {
    const catRef = doc(db, "categories", category.id);
    batch.set(catRef, category);
  });
  console.log("Categories prepared for batch.");

  const forums: Forum[] = [
    { id: 'forum1', categoryId: 'cat1', name: 'General Discussion', description: 'A place to discuss anything and everything.', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'forum_intro', categoryId: 'cat1', name: 'Introductions', description: 'Introduce yourself to the community!', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'forum2', categoryId: 'cat1', name: 'Technology Hub', description: 'Discussions about software, hardware, and the future of tech.', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'forum3', categoryId: 'cat2', name: 'Hobbies Corner', description: 'Share your hobbies and interests.', threadCount: 0, postCount: 0, isPublic: true },
    { id: 'agora', categoryId: 'cat_agora', name: 'Agora - Votations', description: 'Official proposals and community votations.', threadCount: 0, postCount: 0, isPublic: true, isAgora: true },
  ];

  forums.forEach(forum => {
    const forumRef = doc(db, "forums", forum.id);
    batch.set(forumRef, { ...forum, threadCount: 0, postCount: 0 }); 
  });
  console.log("Forums prepared for batch.");

  let forumPostCounts: Record<string, number> = {};
  forums.forEach(f => forumPostCounts[f.id] = 0);

  mockUsersData.forEach(user => {
    if (user.id !== 'unknown' && user.id !== 'visitor0' && user.id !== 'guest1') {
        batch.update(doc(db, "users", user.id), {
            karma: 0,
            totalPostsByUser: 0,
            totalReactionsReceived: 0,
            totalPostsInThreadsStartedByUser: 0,
        });
    }
  });
  console.log("User karma components reset for calculation.");

  const thread1Id = 'thread1_welcome';
  const thread1CreatedAt = '2023-05-01T10:00:00Z';
  let thread1PostCount = 0;
  let thread1LastReplyAt = thread1CreatedAt;

  const thread1PollData: Poll = {
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

  const post1_1_Id = 'post1_1_welcome';
  const post1_1_CreatedAt = '2023-05-01T10:00:00Z';
  const post1_1_Content = 'This is the first post in the general discussion thread. Welcome everyone! What is your favorite season? (Check out the poll above!)';
  const post1_1_Reactions = {
    '👍': { userIds: [bob.id, charlie.id] }
  };
  batch.set(doc(db, "posts", post1_1_Id), {
    threadId: thread1Id, author: aliceAuthorInfo, content: post1_1_Content, createdAt: post1_1_CreatedAt, reactions: post1_1_Reactions
  });
  thread1PostCount++;
  forumPostCounts['forum1'] = (forumPostCounts['forum1'] || 0) + 1;
  if (new Date(post1_1_CreatedAt) > new Date(thread1LastReplyAt)) thread1LastReplyAt = post1_1_CreatedAt;

  if (aliceAuthorInfo.id !== 'unknown') {
    batch.update(doc(db, "users", aliceAuthorInfo.id), {
      karma: increment(2 + Object.values(post1_1_Reactions).reduce((sum, r) => sum + r.userIds.length, 0)),
      totalPostsByUser: increment(1),
      totalPostsInThreadsStartedByUser: increment(1),
      totalReactionsReceived: increment(Object.values(post1_1_Reactions).reduce((sum, r) => sum + r.userIds.length, 0))
    });
  }

  const post1_2_Id = 'post1_2_thanks';
  const post1_2_CreatedAt = '2023-05-01T10:05:00Z';
  const post1_2_Reactions = { '😊': { userIds: [alice.id] } };
  batch.set(doc(db, "posts", post1_2_Id), {
    threadId: thread1Id, author: bobAuthorInfo, content: 'Thanks for the welcome, Alice! Glad to be here. I voted Summer!', createdAt: post1_2_CreatedAt, reactions: post1_2_Reactions
  });
  thread1PostCount++;
  forumPostCounts['forum1'] = (forumPostCounts['forum1'] || 0) + 1;
  if (new Date(post1_2_CreatedAt) > new Date(thread1LastReplyAt)) thread1LastReplyAt = post1_2_CreatedAt;

  if (bobAuthorInfo.id !== 'unknown') {
    batch.update(doc(db, "users", bobAuthorInfo.id), {
      karma: increment(1 + Object.values(post1_2_Reactions).reduce((sum, r) => sum + r.userIds.length, 0)),
      totalPostsByUser: increment(1),
      totalReactionsReceived: increment(Object.values(post1_2_Reactions).reduce((sum, r) => sum + r.userIds.length, 0))
    });
  }
  if (aliceAuthorInfo.id !== 'unknown') { 
    batch.update(doc(db, "users", aliceAuthorInfo.id), { karma: increment(1), totalPostsInThreadsStartedByUser: increment(1) });
  }

  batch.set(doc(db, "threads", thread1Id), {
    forumId: 'forum1', title: 'General Discussion Welcome Thread', author: aliceAuthorInfo, createdAt: thread1CreatedAt, lastReplyAt: thread1LastReplyAt, postCount: thread1PostCount, isSticky: true, isLocked: false, isPublic: true, poll: thread1PollData
  });
  batch.update(doc(db, "forums", "forum1"), { threadCount: increment(1) });
  console.log("Thread 1 (with poll and sticky) and its posts prepared.");

  const thread2Id = 'thread2_tech';
  const thread2CreatedAt = '2023-05-02T11:00:00Z';
  let thread2PostCount = 0;
  let thread2LastReplyAt = thread2CreatedAt;

  const post2_1_Id = 'post2_1_ai';
  const post2_1_CreatedAt = '2023-05-02T11:00:00Z';
  batch.set(doc(db, "posts", post2_1_Id), {
    threadId: thread2Id, author: charlieAuthorInfo, content: "Let's talk about the future of technology. What are your predictions for AI in the next 5 years?", createdAt: post2_1_CreatedAt, reactions: {}
  });
  thread2PostCount++;
  forumPostCounts['forum2'] = (forumPostCounts['forum2'] || 0) + 1;
  if (new Date(post2_1_CreatedAt) > new Date(thread2LastReplyAt)) thread2LastReplyAt = post2_1_CreatedAt;

  if (charlieAuthorInfo.id !== 'unknown') {
    batch.update(doc(db, "users", charlieAuthorInfo.id), {
      karma: increment(2), 
      totalPostsByUser: increment(1),
      totalPostsInThreadsStartedByUser: increment(1)
    });
  }

  batch.set(doc(db, "threads", thread2Id), {
    forumId: 'forum2', title: 'The Future of Technology', author: charlieAuthorInfo, createdAt: thread2CreatedAt, lastReplyAt: thread2LastReplyAt, postCount: thread2PostCount, isSticky: false, isLocked: false, isPublic: true
  });
  batch.update(doc(db, "forums", "forum2"), { threadCount: increment(1) });
  console.log("Thread 2 and its posts prepared.");

  const thread3Id = 'thread3_books';
  const thread3CreatedAt = '2023-05-03T12:00:00Z';
  let thread3PostCount = 0;
  let thread3LastReplyAt = thread3CreatedAt;

  const post3_1_Id = 'post3_1_placeholder';
  const post3_1_CreatedAt = '2023-05-03T12:00:00Z';
   batch.set(doc(db, "posts", post3_1_Id), {
    threadId: thread3Id, author: bobAuthorInfo, content: "What are everyone's favorite books this year?", createdAt: post3_1_CreatedAt, reactions: {}
  });
  thread3PostCount++;
  forumPostCounts['forum1'] = (forumPostCounts['forum1'] || 0) + 1;
   if (new Date(post3_1_CreatedAt) > new Date(thread3LastReplyAt)) thread3LastReplyAt = post3_1_CreatedAt;

   if (bobAuthorInfo.id !== 'unknown') {
     batch.update(doc(db, "users", bobAuthorInfo.id), {
      karma: increment(2), 
      totalPostsByUser: increment(1),
      totalPostsInThreadsStartedByUser: increment(1)
    });
   }

  batch.set(doc(db, "threads", thread3Id), {
    forumId: 'forum1', title: 'Favorite Books of 2024', author: bobAuthorInfo, createdAt: thread3CreatedAt, lastReplyAt: thread3LastReplyAt, postCount: thread3PostCount, isSticky: false, isLocked: false, isPublic: true
  });
  batch.update(doc(db, "forums", "forum1"), { threadCount: increment(1) }); 
  console.log("Thread 3 and its posts prepared.");

  const thread4Id = 'votation1_thread_sticky';
  const thread4CreatedAt = '2023-06-01T09:00:00Z';
  let thread4PostCount = 0;
  let thread4LastReplyAt = thread4CreatedAt;

  const post4_1_Id = 'post4_1_propose';
  const post4_1_CreatedAt = '2023-06-01T09:00:00Z';
  batch.set(doc(db, "posts", post4_1_Id), {
    threadId: thread4Id, author: aliceAuthorInfo, content: 'I propose we make the "Introductions" forum\'s main thread (or the forum itself) more prominent. It helps new users find where to post first.', createdAt: post4_1_CreatedAt, reactions: {}
  });
  thread4PostCount++;
  forumPostCounts['agora'] = (forumPostCounts['agora'] || 0) + 1;
  if (new Date(post4_1_CreatedAt) > new Date(thread4LastReplyAt)) thread4LastReplyAt = post4_1_CreatedAt;

  if (aliceAuthorInfo.id !== 'unknown') {
    batch.update(doc(db, "users", aliceAuthorInfo.id), {
      karma: increment(2), 
      totalPostsByUser: increment(1),
      totalPostsInThreadsStartedByUser: increment(1)
    });
  }

  const post4_2_Id = 'post4_2_agree';
  const post4_2_CreatedAt = '2023-06-01T09:15:00Z';
  batch.set(doc(db, "posts", post4_2_Id), {
    threadId: thread4Id, author: charlieAuthorInfo, content: 'I agree with Alice. A prominent introductions area would be very beneficial.', createdAt: post4_2_CreatedAt, reactions: {}
  });
  thread4PostCount++;
  forumPostCounts['agora'] = (forumPostCounts['agora'] || 0) + 1;
  if (new Date(post4_2_CreatedAt) > new Date(thread4LastReplyAt)) thread4LastReplyAt = post4_2_CreatedAt;

  if (charlieAuthorInfo.id !== 'unknown') {
    batch.update(doc(db, "users", charlieAuthorInfo.id), { karma: increment(1), totalPostsByUser: increment(1) });
  }
  if (aliceAuthorInfo.id !== 'unknown') { 
    batch.update(doc(db, "users", aliceAuthorInfo.id), { karma: increment(1), totalPostsInThreadsStartedByUser: increment(1) });
  }

  batch.set(doc(db, "threads", thread4Id), {
    forumId: 'agora', title: '[VOTATION] Make "Introductions" area more prominent', author: aliceAuthorInfo, createdAt: thread4CreatedAt, lastReplyAt: thread4LastReplyAt, postCount: thread4PostCount, isSticky: false, isLocked: false, isPublic: true, relatedVotationId: 'votation_example_1' // Example, actual votation might be created by another process
  });
  batch.update(doc(db, "forums", "agora"), { threadCount: increment(1) });
  console.log("Thread 4 (Agora) and its posts prepared.");

  for (const forumId in forumPostCounts) {
    if (forumPostCounts[forumId] > 0) {
      batch.update(doc(db, "forums", forumId), { postCount: increment(forumPostCounts[forumId]) });
    }
  }
  console.log("Forum post counts updated.");

  try {
    await batch.commit();
    console.log("Database seeded successfully with mock data, including all users, categories, forums, threads, posts, and initial karma components!");
  } catch (error) {
    console.error("Error committing seed batch to Firestore:", error);
    throw error;
  }
}
