
'use server';

import { db } from '@/lib/firebase';
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser, Poll, Votation } from '@/lib/types';
import { 
    mockUsers as usersToSeed, 
    mockCategoriesData,
    mockForumsData,
    mockThreadsData,
    mockPostsData,
    mockVotationsData
} from '@/lib/mockData'; // Import consistently named arrays
import { collection, doc, writeBatch, increment, Timestamp } from 'firebase/firestore';

// Helper to get author info for denormalization
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

  // 1. Seed Users
  console.log(`Processing ${usersToSeed.length} users...`);
  usersToSeed.forEach(user => {
    if (user.id === 'visitor0' || user.id === 'guest1') return; // Skip special mock auth states

    const userRef = doc(db, "users", user.id);
    const userData: KratiaUser = {
        ...user, // Spread all properties from mockUser
        // Ensure all optional fields from KratiaUser have defaults if not in mock
        avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username?.[0]?.toUpperCase() || 'U'}`,
        registrationDate: user.registrationDate || new Date().toISOString(),
        karma: 0, // Will be recalculated
        location: user.location || null,
        aboutMe: user.aboutMe || null,
        canVote: user.canVote === undefined ? false : user.canVote,
        isQuarantined: user.isQuarantined === undefined ? false : user.isQuarantined,
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        status: user.status || 'active',
        sanctionEndDate: user.sanctionEndDate || null,
    };
    batch.set(userRef, userData);
  });
  console.log("Users prepared.");

  // 2. Seed Categories
  console.log(`Processing ${mockCategoriesData.length} categories...`);
  mockCategoriesData.forEach(category => {
    const catRef = doc(db, "categories", category.id);
    // Forums are not embedded in category docs, they link via categoryId
    const { ...categoryData } = category; 
    batch.set(catRef, categoryData);
  });
  console.log("Categories prepared.");

  // 3. Seed Forums
  console.log(`Processing ${mockForumsData.length} forums...`);
  mockForumsData.forEach(forum => {
    const forumRef = doc(db, "forums", forum.id);
    batch.set(forumRef, { ...forum, threadCount: 0, postCount: 0 }); // Initialize counts
  });
  console.log("Forums prepared.");

  // 4. Seed Threads
  console.log(`Processing ${mockThreadsData.length} threads...`);
  mockThreadsData.forEach(thread => {
    const threadRef = doc(db, "threads", thread.id);
    // Author is already part of mockThreadsData objects from the mapping in mockData.ts
    batch.set(threadRef, { ...thread, postCount: 0 }); // Initialize postCount
  });
  console.log("Threads prepared.");
  
  // 5. Seed Votations (if any)
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

  // Initialize karma update records for all users being seeded
  usersToSeed.forEach(u => {
    if (u.id !== 'visitor0' && u.id !== 'guest1') {
      userKarmaUpdates[u.id] = { posts: 0, reactions: 0, threadPosts: 0 };
    }
  });

  mockPostsData.forEach(post => {
    const postRef = doc(db, "posts", post.id);
    const postAuthor = post.author; // Author is already a Pick<...> object
    
    batch.set(postRef, { 
        ...post, 
        author: postAuthor, // Use the already processed author object
        isEdited: post.isEdited || false, 
        // poll field removed from Post type
    });

    // Track post counts for threads and forums
    threadPostCounts[post.threadId] = (threadPostCounts[post.threadId] || 0) + 1;
    const parentThread = mockThreadsData.find(t => t.id === post.threadId);
    if (parentThread) {
      forumPostCounts[parentThread.forumId] = (forumPostCounts[parentThread.forumId] || 0) + 1;
      // Karma for thread author due to new post in their thread
      if (parentThread.author.id !== postAuthor.id && userKarmaUpdates[parentThread.author.id]) {
        userKarmaUpdates[parentThread.author.id].threadPosts += 1;
      }
    }

    // Karma for post author
    if (userKarmaUpdates[postAuthor.id]) {
      userKarmaUpdates[postAuthor.id].posts += 1;
      // Karma for reactions received by post author
      if (post.reactions) {
        Object.values(post.reactions).forEach(reaction => {
          userKarmaUpdates[postAuthor.id]!.reactions += reaction.userIds.length;
        });
      }
    }
  });
  console.log("Posts prepared, count/karma aggregation started.");

  // Apply aggregated counts to threads
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

  // Apply aggregated counts to forums
  for (const forumId in forumPostCounts) {
    const forumRef = doc(db, "forums", forumId);
    batch.update(forumRef, { postCount: increment(forumPostCounts[forumId]) }); // Increment as forums already have postCount from threads
  }
   // Update thread counts for forums based on mockThreadsData
  const forumThreadCounts: Record<string, number> = {};
  mockThreadsData.forEach(thread => {
    forumThreadCounts[thread.forumId] = (forumThreadCounts[thread.forumId] || 0) + 1;
  });
  for (const forumId in forumThreadCounts) {
    const forumRef = doc(db, "forums", forumId);
    batch.update(forumRef, { threadCount: forumThreadCounts[forumId] });
  }
  console.log("Forum counts updated.");


  // Apply aggregated karma updates to users
  for (const userId in userKarmaUpdates) {
    const userRef = doc(db, "users", userId);
    const updates = userKarmaUpdates[userId];
    const totalKarmaDelta = updates.posts + updates.reactions + updates.threadPosts;
    
    // If initial post, author gets +1 for content, +1 for starting thread post
    // If reply, author gets +1 for content. Thread starter gets +1 for thread post.
    // For simplicity here, we'll assign karma based on direct actions:
    // 1 karma per post, 1 karma per reaction received, 1 karma per post in own thread.
    // This seed sets values directly based on these, rather than incremental logic.
    // This might differ slightly from live increment logic if not careful.
    // Let's use increments for actual karma components.
    
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
    throw error; // Re-throw to be caught by the calling function in page.tsx
  }
}


    