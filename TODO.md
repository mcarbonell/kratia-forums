
# Kratia Forums - Project TODO & Future Ideas

This document outlines potential future enhancements, features, and areas for improvement for the Kratia Forums project.

## I. Core Forum Functionality Enhancements
- **Rich Text Editor for Posts:** Implement a WYSIWYG editor (e.g., TipTap, Quill.js, Slate.js) for creating posts, allowing for more advanced formatting beyond current regex replacements.
- **Post Drafts:** Allow users to save drafts of their posts/threads before publishing.
- **Mentions:** Implement `@username` mentions in posts, potentially notifying the mentioned user.
- **Reporting Posts/Threads:** Allow users to report inappropriate content to administrators.
- **Thread Subscriptions:** Allow users to subscribe to threads to receive notifications for new replies.
- **Search Functionality:**
    - Basic search for thread titles.
    - Advanced search for post content (likely requires a dedicated search service like Algolia or Typesense for performance at scale).
- **Advanced Poll Features:**
    - Option for multiple choice votes in polls.
    - Poll end dates.

## II. Agora & Governance System Enhancements
- **Secret Voting (Current votes are public in DB):** Implement a mechanism where individual votes are not publicly visible in the votation document until the votation closes (more complex, might require backend logic/Cloud Functions).
- **More Votation Types:**
    - Proposing new site features or changes.
    - Electing moderators (if a mixed model is desired).
    - Amending specific `KRATIA_CONFIG` values via votation.
- **UI/UX for Votations:**
    - Clearer visual distinction between different votation types in the Agora list.
    - Filter votations by type or status.
    - More detailed display of votation parameters (e.g., proposed text diff for constitution changes).
- **Votation Delegation (Advanced):** Allow users to delegate their vote to another trusted user (liquid democracy concept).
- **Configurable Admission Process:** Allow founder/admins (or via votation) to toggle the "admission by community vote" requirement.

## III. User Management & Profiles
- **Private Messaging System:**
    - **Phase 1 (DONE):** Ability to send a private message from a user's profile. Notification for new PM.
    - **Phase 2 (DONE):** Dedicated `/messages` page to list conversations (grouped by user).
    - **Phase 3 (DONE):** View individual conversation threads. Mark messages as read when viewed.
    - **Phase 4 (TODO):** Reply input form within the individual conversation view.
    - **Phase 5 (TODO):** Real-time updates for new messages within an open conversation (e.g., using Firestore listeners).
- **User Badges/Achievements:** Award badges based on karma, activity, or roles.
- **Karma Enhancements:**
    - Consider karma decay for inactivity.
    - Display karma history or breakdown.
- **Enhanced User Activity Feed:** Show more detailed activity on user profiles (e.g., reactions given, votes cast on proposals).
- **"Follow User" Functionality:** Allow users to follow others to see their activity more easily.

## IV. Admin Panel Enhancements
- **Deleting Users:** Add functionality for admins to delete user accounts (with considerations for their content).
- **Deleting Categories:** Add functionality to delete categories (with warnings/logic for handling forums within that category).
- **Managing Site Settings:** Allow admins to modify some `KRATIA_CONFIG` values through the UI.
- **Viewing/Managing Reported Content:** Interface for admins to review reported posts/threads.
- **User Impersonation (Advanced/Careful):** For founders/super-admins to debug issues from a user's perspective.
- **Full CRUD for Forums:** Deletion of forums needs to consider orphaned threads/posts (e.g., option to reassign or truly delete content). Currently, only the forum document is deleted.

## V. Notifications System
- **More Notification Types:**
    - When a user is mentioned (`@username`).
    - When a post/thread a user subscribed to gets a new reply.
- **Granular Notification Settings:**
    - **DONE:** UI allows configuring web notifications for implemented types.
    - **TODO:** Add email/push notification channels in UI and backend.
    - **TODO:** System needs to respect these settings when creating *all* types of notifications (review if fully covered).

## VI. Technical & Performance
- **Full PWA Offline Support:** Implement a robust Service Worker for caching strategies, enabling better offline access. (Basic PWA for "Add to Home Screen" is DONE).
- **Performance Optimization for Large Lists:**
    - Implement list virtualization (e.g., `react-virtualized`, `@tanstack/react-virtual`) for thread lists, post lists, and message lists if they become very long.
- **Robust Server-Side Logic (Cloud Functions):**
    - **Automatic Votation Closing:** Use scheduled Cloud Functions (cron jobs) to close votations when their `deadline` is reached, instead of relying on user visits.
    - **Automatic Sanction Lifting:** Use server-side time checks (Cloud Functions) to lift sanctions when `sanctionEndDate` passes, independent of client-side clock.
    - **Aggregated Counts:** For very high traffic, consider using Cloud Functions to maintain aggregated counts (like forum post/thread counts, user total posts) to reduce client-side write contention or complexity.
- **Scalable Search Solution:** Integrate a dedicated search service if forum grows significantly.
- **Comprehensive Error Boundary Components:** Implement more specific error boundaries for different parts of the application.

## VII. Security & Moderation
- **Refine Firebase Security Rules:** Continuously review and tighten Firestore and Storage security rules as new features are added (CRITICAL for production).
- **Rate Limiting:** Implement rate limiting for actions like post creation, voting, etc., to prevent abuse (likely requires backend logic).
- **Audit Logs:** For admin actions.

## VIII. Internationalization (i18n)
- **Translate All UI (Ongoing):** Continue translating all static UI text across all components and pages.
    - **DONE (Most):** Header, Footer, Homepage, Auth pages, Admin pages, User Profile pages, Agora pages, Forum/Thread/Post UI, Notification page, Messages pages, Privacy Policy.
    - **Remaining Components (to review):** Specific dialogs, tooltips, less common alerts, dynamic parts of messages (e.g., "You: ...").
- **Translate Dynamic Content (Advanced):** Consider strategies for translating user-generated content (e.g., forum names/descriptions set by admins if they are not meant to be i18n keys) if multi-language dynamic content is desired. This would require data model changes.

## IX. AI Enhancements (Long-term)
- **AI as a Forum Participant:** Explore the advanced idea of an AI user that can post, reply, and potentially participate in governance.
- **AI for Content Moderation:** Suggestions for moderators, flagging potentially problematic content.
- **AI for Content Summarization:** Summarize long threads or debates.
- **AI for Welcome Message Translation:** Generate the personalized welcome message in the user's detected language.

This list provides a good roadmap for the continued development and enhancement of Kratia Forums!
