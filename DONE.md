
# Kratia Forums - Project Progress (DONE)

This document outlines the major features, functionalities, and fixes implemented in the Kratia Forums project.

## I. Core Forum Functionality
- **Basic Structure:** Setup of pages for homepage, forums, threads, user profiles, and Agora.
- **Data Persistence:** Migration from initial mock data to **Firebase Firestore** for all core entities (categories, forums, threads, posts, users, votations, notifications, site_settings).
- **Database Seeding:** Implemented a script to seed the Firestore database with initial mock data for testing. Includes users, categories, forums, threads, posts, and initial constitution.
- **Content Display:**
    - Listing forum categories and forums within them.
    - Displaying threads within forums, with author information.
    - Displaying posts within threads, with author information.
    - Embedded image URLs and YouTube video URLs in posts are rendered as embedded content.
- **Content Creation & Interaction:**
    - Users can create new threads in forums.
    - Users can reply to existing threads.
    - Implemented "Like" reactions on posts (toggle like/unlike, prevents self-like, updates karma).
    - Users can add non-binding polls to the first post of a new thread.
    - Users can vote once per poll, with results displayed.
- **Pagination:**
    - Implemented "Load More" pagination for thread lists on forum pages.
    - Implemented "Load More" pagination for post lists on thread pages.

## II. User Authentication & Profiles
- **Firebase Authentication:**
    - User registration via Email/Password with **email verification**.
    - User login via Email/Password (handles pending admission, sanctioned status).
    - User login and registration via **Google Sign-In** (handles new user admission flow).
    - "Forgot Password" functionality using Firebase.
- **User Profile Management:**
    - Display dynamic user profiles with details fetched from Firestore (username, avatar, karma, member since, location, about me, total posts, total threads started, total reactions received).
    - Display of recent activity (last 5 threads started, last 5 posts made).
    - Users can edit their own profiles (username, location, about me, notification preferences).
    - Users can **upload profile pictures** (stored in Firebase Storage).
- **User States & Onboarding:**
    - Handled user statuses: `pending_email_verification`, `pending_admission`, `active`, `under_sanction_process`, `sanctioned`.
    - Personalized onboarding message (using Genkit AI) for newly admitted/quarantined users.
    - Functionality for users to "accept" the onboarding message, gain karma, and hide the message.
- **Karma System:**
    - Karma calculated based on: total posts, total reactions received, total posts in threads started by the user.
    - Karma updates automatically upon relevant actions (new post, new reply, like received/removed, new thread).

## III. Agora & Democratic Governance System
- **Votation Lifecycle:**
    - Creation of various votation types:
        - **Admission Requests:** New users (after email verification and first login) trigger an admission request votation.
        - **Sanction Proposals:** Eligible users can propose sanctions against other users.
        - **Constitution Changes:** Eligible users can propose modifications to the site's "Normas y Condiciones".
        - **New Forum Proposals:** Eligible users can propose the creation of new forums.
    - Votations are linked to threads in a dedicated "Agora" forum.
    - Users can vote (For, Against, Abstain) on active proposals.
    - Implemented "vote once per user per votation" logic.
- **Votation Outcomes & Execution:**
    - Automatic closing of votations when their deadline passes (checked on thread view).
    - Display of votation results (Passed, Failed Quorum, Failed Vote).
    - **Automatic execution of passed votations:**
        - Sanctions: Target user's status updated to `sanctioned` with an `sanctionEndDate`.
        - Constitution Changes: The main constitution text in Firestore is updated.
        - New Forums: New forum document is created in Firestore.
        - Admissions: Applicant user's status updated to `active`, `canVote` set to true, `role` set to 'user', `isQuarantined` set to `false`.
- **User Restrictions based on Status:**
    - Users `'under_sanction_process'` can only reply in their own sanction votation thread; other creation/reply actions are blocked.
    - Users `'sanctioned'` are redirected to a sanctioned info page and cannot participate.
    - Automatic lifting of sanctions when `sanctionEndDate` passes (checked by `SanctionCheckWrapper`).
- **Agora UI:**
    - Dedicated `/agora` page listing votation threads, sorted by active then closed.
    - Distinction and sorting of active vs. closed votations.
    - Consistent navigation links for Agora-related threads.

## IV. Admin Panel & Moderation
- **Access Control:** Admin Panel restricted to users with 'admin' or 'founder' roles.
- **Management Features:**
    - **User Management:** List all users; Admins can edit user details (username, email, role, karma, status, sanction end date, canVote, isQuarantined).
    - **Category Management:** Admins can create, list, and edit forum categories (name, description).
    - **Forum Management:** Admins can create, list, edit (name, description, category, public status), and delete forums (forum document only).
- **Moderation Tools:**
    - Admins can lock/unlock threads to prevent/allow further replies.
    - Threads associated with concluded votations are automatically locked.
    - Admins can delete posts (post author can also delete within a time limit).

## V. Notifications System
- **Types of Notifications:**
    - When a user replies to another user's thread.
    - When a votation proposed by a user is concluded.
    - When a user receives a "Like" on their post.
    - When a votation a user participated in (but didn't propose) concludes.
- **Functionality:**
    - Real-time unread notification count in the site header.
    - Dedicated `/notifications` page to view all notifications.
    - "Mark all as read" functionality on the notifications page.
    - Visual distinction for unread notifications.
- **User Preferences:** Users can configure (enable/disable web notifications) for implemented notification types via their profile edit page. The system respects these preferences when creating notifications.

## VI. Internationalization (i18n)
- **Setup:** Integrated `i18next` and `react-i18next` for multi-language support.
- **Languages:** Translation files (`common.json`) for English (`en`) and Spanish (`es`).
- **Translated Components:** Header, Footer, Homepage, Authentication pages (Login, Signup, Forgot Password, Confirm, Sanctioned), Admin Panel pages (main, create/edit for categories, forums, users), User Profile pages (view, edit), Agora pages (main, propose constitution, propose new forum), Forum/Thread/Post pages (UI elements, buttons, titles, messages, tooltips, toasts), Notification page.
- **Language Switcher:** Implemented a dropdown in the Header to allow users to switch between English and Spanish.
- **Date Formatting:** Dates are localized (e.g., "hace 2 horas" vs "about 2 hours ago").

## VII. Technical Enhancements & Fixes
- **PWA (Progressive Web App):** Added `manifest.json` and necessary meta tags for "Add to Home Screen" functionality.
- **Production Readiness:**
    - Conditional rendering of developer tools (Seed Database button, Switch Role) to hide them in production.
    - Configuration for Firebase App Hosting via `firebase.json` and `apphosting.yaml`.
- **Bug Fixing & Refinements:**
    *   Resolved numerous routing issues (404s, dynamic route conflicts).
    *   Fixed Next.js build errors (font loading, SWC issues, module not found).
    *   Addressed React hook rule violations.
    *   Corrected data consistency issues in Firestore seeding and updates (e.g., user roles, status, poll data location).
    *   Fixed UI inconsistencies (e.g., login header update, back button navigation, duplicated post counts).
    *   Improved error handling and user feedback with toast notifications.
    *   Resolved issues with duplicate notification creation.
    *   Optimized data fetching and state management in various components to prevent loops.
    *   Ensured Firebase Storage rules and Firestore security rules were considered and iterated upon.
    *   Handled i18n setup complexities with App Router.

This list represents the significant milestones. Many smaller fixes and UI polishes were also implemented along the way.

    