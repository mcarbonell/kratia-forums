
# Kratia Forums - Project TODO & Future Ideas

This document outlines potential future enhancements, features, and areas for improvement for the Kratia Forums project.

## I. Core Forum Functionality Enhancements
- **Rich Text Editor for Posts:** Implement a WYSIWYG editor (e.g., TipTap, Quill.js, Slate.js) for creating posts, allowing for more advanced formatting beyond current regex replacements.
- **Post Drafts:** Allow users to save drafts of their posts/threads before publishing.
- **Mentions:** Implement `@username` mentions in posts, potentially notifying the mentioned user.
- **Soft Deletion of Posts/Threads:** Allow users to "delete" their own content (within a time limit or if no replies) or admins to "soft delete" content, marking it as hidden rather than permanently removing it.
- **Reporting Posts/Threads:** Allow users to report inappropriate content to administrators.
- **Thread Subscriptions:** Allow users to subscribe to threads to receive notifications for new replies.
- **Search Functionality:**
    - Basic search for thread titles.
    - Advanced search for post content (likely requires a dedicated search service like Algolia or Typesense for performance at scale).

## II. Agora & Governance System Enhancements
- **Secret Voting:** Implement a mechanism where individual votes are not publicly visible in the votation document until the votation closes (more complex, might require backend logic/Cloud Functions).
- **More Votation Types:**
    - Proposing new site features or changes.
    - Electing moderators (if a mixed model is desired).
    - Amending specific `KRATIA_CONFIG` values via votation.
- **UI/UX for Votations:**
    - Clearer visual distinction between different votation types in the Agora list.
    - Filter votations by type or status.
    - More detailed display of votation parameters (e.g., proposed text diff for constitution changes).
- **Votation Delegation (Advanced):** Allow users to delegate their vote to another trusted user (liquid democracy concept).

## III. User Management & Profiles
- **Private Messaging:** Implement a system for users to send private messages to each other.
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

## V. Notifications System
- **More Notification Types:**
    - When a user is mentioned.
    - When a votation a user participated in concludes.
    - When a post/thread a user subscribed to gets a new reply.
- **Email Notifications:** Option for users to receive email notifications for important events.
- **Granular Notification Settings:** Allow users to customize which notifications they receive.

## VI. Technical & Performance
- **Full PWA Offline Support:** Implement a robust Service Worker for caching strategies, enabling better offline access.
- **Performance Optimization for Large Lists:**
    - Implement list virtualization (e.g., `react-virtualized`, `@tanstack/react-virtual`) for thread lists and post lists if they become very long.
- **Robust Server-Side Logic (Cloud Functions):**
    - **Automatic Votation Closing:** Use scheduled Cloud Functions (cron jobs) to close votations when their `deadline` is reached, instead of relying on user visits.
    - **Automatic Sanction Lifting:** Use server-side time checks (Cloud Functions) to lift sanctions when `sanctionEndDate` passes, independent of client-side clock.
    - **Aggregated Counts:** For very high traffic, consider using Cloud Functions to maintain aggregated counts (like forum post/thread counts, user total posts) to reduce client-side write contention or complexity.
- **Scalable Search Solution:** Integrate a dedicated search service if forum grows significantly.
- **Comprehensive Error Boundary Components:** Implement more specific error boundaries for different parts of the application.

## VII. Security & Moderation
- **Refine Firebase Security Rules:** Continuously review and tighten Firestore and Storage security rules as new features are added.
- **Rate Limiting:** Implement rate limiting for actions like post creation, voting, etc., to prevent abuse (likely requires backend logic).
- **Audit Logs:** For admin actions.

## VIII. Internationalization (i18n)
- **Translate All UI:** Continue translating all static UI text across all components and pages.
- **Translate Dynamic Content (Advanced):** Consider strategies for translating user-generated content (e.g., forum names/descriptions set by admins) if multi-language dynamic content is desired. This would require data model changes.

## IX. AI Enhancements (Long-term)
- **AI as a Forum Participant:** Explore the advanced idea of an AI user that can post, reply, and potentially participate in governance.
- **AI for Content Moderation:** Suggestions for moderators, flagging potentially problematic content.
- **AI for Content Summarization:** Summarize long threads or debates.

This list provides a good roadmap for the continued development and enhancement of Kratia Forums!
