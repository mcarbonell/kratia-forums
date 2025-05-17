
'use server';

import { db } from '@/lib/firebase';
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser, Poll, Votation } from '@/lib/types';
import { 
    mockUsers as usersToSeed, 
    mockCategoriesData,
    mockForumsData,
    mockThreadsData as rawMockThreadsData, // Renamed to avoid confusion
    mockPostsData as rawMockPostsData,     // Renamed to avoid confusion
    mockVotationsData
} from '@/lib/mockData';
import { collection, doc, writeBatch, increment, Timestamp } from 'firebase/firestore';

// Helper to find user safely (already in mockData.ts but good for clarity here too)
const findUserByIdForSeed = (userId: string, usersArray: KratiaUser[]): KratiaUser => {
    const user = usersArray.find(u => u.id === userId);
    if (!user) throw new Error(`Seed Error: User with ID ${userId} not found in usersToSeed array.`);
    return user;
};

const getAuthorPick = (user: KratiaUser): Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> => {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username?.[0]?.toUpperCase() || 'U'}`,
  };
};

export async function seedDatabase() {
  const batch = writeBatch(db);
  console.log("Starting database seed...");

  // Prepare author objects for threads and posts
  const mockThreadsData = rawMockThreadsData.map(t => ({
    ...t,
    author: getAuthorPick(findUserByIdForSeed(t.authorId, usersToSeed))
  }));

  const mockPostsData = rawMockPostsData.map(p => ({
    ...p,
    author: getAuthorPick(findUserByIdForSeed(p.authorId, usersToSeed))
  }));
  
  // Calculate totalThreadsStartedByUser for each user
  const threadsStartedCounts: Record<string, number> = {};
  mockThreadsData.forEach(thread => {
    threadsStartedCounts[thread.author.id] = (threadsStartedCounts[thread.author.id] || 0) + 1;
  });


  // 1. Seed Users
  console.log(`Processing ${usersToSeed.length} users...`);
  usersToSeed.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return;

    const userRef = doc(db, "users", user.id);
    const userData: KratiaUser = {
        ...user,
        avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username?.[0]?.toUpperCase() || 'U'}`,
        registrationDate: user.registrationDate || new Date().toISOString(),
        karma: 0,
        location: user.location || null,
        aboutMe: user.aboutMe || null,
        canVote: user.canVote === undefined ? false : user.canVote,
        isQuarantined: user.isQuarantined === undefined ? false : user.isQuarantined,
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        totalThreadsStartedByUser: threadsStartedCounts[user.id] || 0, // Use pre-calculated count
        status: user.status || 'active',
        role: user.role || 'user',
        sanctionEndDate: user.sanctionEndDate || null,
    };
    batch.set(userRef, userData);
  });
  console.log("Users prepared.");

  // 2. Seed Categories
  console.log(`Processing ${mockCategoriesData.length} categories...`);
  mockCategoriesData.forEach(category => {
    const catRef = doc(db, "categories", category.id);
    batch.set(catRef, category);
  });
  console.log("Categories prepared.");

  // 3. Seed Forums
  console.log(`Processing ${mockForumsData.length} forums...`);
  mockForumsData.forEach(forum => {
    const forumRef = doc(db, "forums", forum.id);
    batch.set(forumRef, { ...forum, threadCount: 0, postCount: 0 });
  });
  console.log("Forums prepared.");

  // 4. Seed Threads
  console.log(`Processing ${mockThreadsData.length} threads...`);
  mockThreadsData.forEach(thread => {
    const threadRef = doc(db, "threads", thread.id);
    const { authorId, ...threadDataToSave } = thread; // Exclude authorId as author object is already embedded
    batch.set(threadRef, { ...threadDataToSave, postCount: 0 });
  });
  console.log("Threads prepared.");
  
  // 5. Seed Votations
  if (mockVotationsData.length > 0) {
    console.log(`Processing ${mockVotationsData.length} votations...`);
    mockVotationsData.forEach(votation => {
        const votationRef = doc(db, "votations", votation.id);
        batch.set(votationRef, votation);
    });
    console.log("Votations prepared.");
  }

  // 6. Seed Posts and Update Counts/Karma
  console.log(`Processing ${mockPostsData.length} posts and updating counts/karma...`);
  const threadPostCounts: Record<string, number> = {};
  const forumPostCounts: Record<string, number> = {};
  const userKarmaUpdates: Record<string, { posts: number; reactions: number; threadPosts: number }> = {};

  usersToSeed.forEach(u => {
    if (u.id !== 'visitor0' && u.id !== 'guest1') {
      userKarmaUpdates[u.id] = { posts: 0, reactions: 0, threadPosts: 0 };
    }
  });

  mockPostsData.forEach(post => {
    const postRef = doc(db, "posts", post.id);
    const { authorId, ...postDataToSave } = post; // Exclude authorId
    batch.set(postRef, { 
        ...postDataToSave, 
        isEdited: post.isEdited || false, 
    });

    threadPostCounts[post.threadId] = (threadPostCounts[post.threadId] || 0) + 1;
    const parentThread = mockThreadsData.find(t => t.id === post.threadId);
    if (parentThread) {
      forumPostCounts[parentThread.forumId] = (forumPostCounts[parentThread.forumId] || 0) + 1;
      if (parentThread.author.id !== post.author.id && userKarmaUpdates[parentThread.author.id]) {
        userKarmaUpdates[parentThread.author.id].threadPosts += 1;
      }
    }

    if (userKarmaUpdates[post.author.id]) {
      userKarmaUpdates[post.author.id].posts += 1;
      if (post.reactions) {
        Object.values(post.reactions).forEach(reaction => {
          userKarmaUpdates[post.author.id]!.reactions += reaction.userIds.length;
        });
      }
    }
  });
  console.log("Posts prepared, count/karma aggregation started.");

  for (const threadId in threadPostCounts) {
    const threadRef = doc(db, "threads", threadId);
    const lastPostInThread = mockPostsData
        .filter(p => p.threadId === threadId)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    batch.update(threadRef, { 
        postCount: threadPostCounts[threadId],
        lastReplyAt: lastPostInThread ? lastPostInThread.createdAt : mockThreadsData.find(t=>t.id === threadId)?.createdAt 
    });
  }
  console.log("Thread post counts updated.");

  const forumThreadCounts: Record<string, number> = {};
  mockThreadsData.forEach(thread => {
    forumThreadCounts[thread.forumId] = (forumThreadCounts[thread.forumId] || 0) + 1;
  });
  for (const forumId in forumThreadCounts) {
    const forumRef = doc(db, "forums", forumId);
    batch.update(forumRef, { 
      threadCount: forumThreadCounts[forumId],
      postCount: forumPostCounts[forumId] || 0 // Ensure postCount is also updated
    });
  }
  console.log("Forum counts updated.");

  for (const userId in userKarmaUpdates) {
    const userRef = doc(db, "users", userId);
    const updates = userKarmaUpdates[userId];
    const totalKarmaDelta = updates.posts + updates.reactions + updates.threadPosts;
    
    batch.update(userRef, {
        totalPostsByUser: increment(updates.posts),
        totalReactionsReceived: increment(updates.reactions),
        totalPostsInThreadsStartedByUser: increment(updates.threadPosts),
        karma: increment(totalKarmaDelta)
    });
  }
  console.log("User karma updated.");

  try {
    await batch.commit();
    console.log("Database seeded successfully with mock data!");
  } catch (error) {
    console.error("Error committing seed batch to Firestore:", error);
    throw error;
  }
}

