
# Kratia Forums - Bug Tracking

Este documento rastrea los bugs encontrados durante el desarrollo de Kratia Forums, divididos en bugs abiertos y cerrados.

## I. Development Environment / Meta Issues

Esta sección cubre problemas relacionados con el entorno de desarrollo o la interacción con la IA que no son bugs intrínsecos del código de la aplicación Kratia Forums.

1.  **Issue:** `GoogleGenerativeAI Error: The input token count (e.g., 1298119) exceeds the maximum number of tokens allowed (e.g., 1048575).`
    *   **Description:** Este error ocurre cuando la conversación entre el usuario y el asistente de IA (Firebase Studio App Prototyper) se vuelve demasiado larga. El modelo de lenguaje tiene un límite en la cantidad de texto (tokens) que puede procesar en una sola interacción.
    *   **Cause:** Historial de chat extenso.
    *   **Impact:** El asistente de IA puede perder contexto de partes anteriores de la conversación, lo que podría llevar a respuestas menos precisas o a la incapacidad de procesar nuevas solicitudes.
    *   **Solution/Workaround:**
        *   Ser consciente de esta limitación.
        *   Documentar el progreso y las decisiones clave externamente (como estamos haciendo con `DONE.md`, `TODO.md`, y `BUGS.md`).
        *   Si el error es persistente, podría ser necesario iniciar una nueva sesión de chat con la IA, proporcionando un resumen del contexto actual del proyecto.
        *   El equipo de Firebase Studio/Google está trabajando continuamente en mejorar las capacidades de los modelos, incluyendo los límites de tokens.

2.  **Issue:** AI Assistant (Firebase Studio App Prototyper) repeatedly forgets to use the specified XML format for file changes, instead outputting "(Omitted from agent history: ...)".
    *   **Description:** When requested to make code changes, the AI acknowledges the request but provides a placeholder instead of the actual XML diff. This requires multiple reminders from the user.
    *   **Cause:** Potential internal model behavior or a "habit" from training data where this placeholder was common. Also, the context window limit might be contributing, making the AI "forget" earlier instructions about the XML format.
    *   **Impact:** Slows down development as changes are not applied, requiring repeated interactions.
    *   **Solution/Workaround:**
        *   User explicitly reminds the AI of the correct XML format and the instruction *not* to use the placeholder.
        *   User provides the correct XML format as a reminder if the AI struggles.
        *   User shortens prompts or breaks down requests if conversation history is very long to mitigate context window issues.
        *   AI assistant (internal): Ongoing effort to improve adherence to the specified output format and manage context better. User feedback is critical for this.

## II. Closed Bugs in Kratia Forums Application

Esta sección lista los bugs significativos que se han identificado y resuelto en el código de la aplicación Kratia Forums.

1.  **Bug:** Initial 404 errors on various pages (`/agora`, `/forums/[id]`, `/profile/[id]`) after basic page setup.
    *   **Description:** Clicking links to dynamic pages or specific static pages resulted in a 404 Not Found error.
    *   **Cause:** Placeholder content or missing page components for these routes. The routing structure was present, but the target pages were not yet implemented.
    *   **Solution:** Implemented the respective page components (`AgoraPage.tsx`, `ForumPage.tsx`, `UserProfilePage.tsx`, etc.) with basic data fetching and rendering logic.

2.  **Bug:** User cannot reply to threads; "Want to join the conversation? Log in or sign up" message shown despite being logged in.
    *   **Description:** Logged-in users saw a message to log in/sign up instead of a reply form or button.
    *   **Cause:** The `useMockAuth` hook's `currentUser` state was not being correctly initialized or propagated to components like `ThreadPage.tsx` immediately after login or page load.
    *   **Solution:** Refined `useMockAuth` to correctly set and provide `currentUser`. Ensured `ThreadPage.tsx` used the `currentUser` state to conditionally render the reply form.

3.  **Bug:** Firestore `Timestamp.increment` is not a function during database seed.
    *   **Description:** The `seedDatabase.ts` script failed with a TypeError.
    *   **Cause:** Incorrectly calling `Timestamp.increment(1)`. The correct function is `increment(1)` imported directly from `firebase/firestore`.
    *   **Solution:** Changed `Timestamp.increment(1)` to `increment(1)` in `seedDatabase.ts`.

4.  **Bug:** Firestore Security Rules preventing data reads, leading to "Failed to load forum details" in-app and "Error al cargar los documentos" in Firebase console.
    *   **Description:** Application could not fetch data from Firestore.
    *   **Cause:** Default Firestore security rules were too restrictive, denying read access.
    *   **Solution:** Advised user to update Firestore security rules for development to `allow read: if true; allow write: if true;` (with a strong warning about securing them for production).

5.  **Bug:** New thread creation does not redirect to the newly created thread page.
    *   **Description:** After submitting the "New Thread" form, the user remained on the form page.
    *   **Cause:** Potentially an error during Firestore `batch.commit()` or a missing/incorrect `router.push()` call.
    *   **Solution:** Added `reset()` for form fields and ensured `router.push()` was correctly called after successful submission in `src/app/forums/[forumId]/new-thread/page.tsx`.

6.  **Bug:** Admin/Founder users (admin1, founder1) not appearing in Firestore after seeding, leading to profile page errors.
    *   **Description:** When switching to mock users 'admin1' or 'founder1' via the header dev tool, their profile pages would show "User not found". Firestore inspection revealed these user documents were not being created.
    *   **Cause:** The `mockUsers` array in `src/lib/mockData.ts` did not correctly or consistently include 'admin1' and 'founder1', or the `seedDatabase.ts` script was not processing them correctly.
    *   **Solution:** Ensured `admin1` and `founder1` were explicitly defined in `src/lib/mockData.ts` with all necessary fields (ID, username, role, status). Verified and corrected `src/lib/seedDatabase.ts` to iterate over the complete `mockUsers` array and write all specified user fields to Firestore. Advised user to clear the `users` collection in Firestore before re-seeding to ensure a clean state.

7.  **Bug:** Build error: "Error: Configuring Next.js via 'next.config.ts' is not supported."
    *   **Description:** Next.js build failed due to the config file extension.
    *   **Cause:** `next.config.ts` used instead of `next.config.js`.
    *   **Solution:** Renamed `next.config.ts` to `next.config.js` and updated its content to CommonJS syntax. Added `placehold.co` to image domains.

8.  **Bug:** Build error: "Unknown font `Geist`" from `next/font`.
    *   **Description:** Build failed because `next/font` couldn't find the Geist font.
    *   **Cause:** Incorrect import path for `GeistSans` and `GeistMono`. They were being treated as Google Fonts instead of local package fonts.
    *   **Solution:** Changed import statements in `src/app/layout.tsx` to `import { GeistSans } from 'geist/font/sans';` and `import { GeistMono } from 'geist/font/mono';`.

9.  **Bug:** Runtime error: `(0 , geist_font_sans__WEBPACK_IMPORTED_MODULE_1__.GeistSans) is not a function`.
    *   **Description:** Application crashed on trying to use `GeistSans` as a function.
    *   **Cause:** `GeistSans` (from `geist/font/sans` v1.x) is an object providing a CSS variable, not a function to be called.
    *   **Solution:** Changed `className={\`\${GeistSans({ subsets: ['latin'] }).variable} \${GeistMono({ subsets: ['latin'] }).variable}\`}` to `className={\`\${GeistSans.variable} \${GeistMono.variable}\`}` in `src/app/layout.tsx`.

10. **Bug:** `DialogTrigger` must be used within `Dialog` error in Admin Panel for delete forum confirmation.
    *   **Description:** Attempting to show the delete forum confirmation dialog failed.
    *   **Cause:** `AlertDialogTrigger` was used outside the context of the `AlertDialog` component instance it was supposed to trigger.
    *   **Solution:** Replaced `AlertDialogTrigger` with a standard `Button` whose `onClick` handler sets the state to open the `AlertDialog` (controlled dialog pattern).

11. **Bug:** Login form showed "Failed to login" but header updated as if logged in.
    *   **Description:** Inconsistent UI state after attempting login with mock users.
    *   **Cause:** The `login` function in `useMockAuth` was `async` but not `await`ed in `LoginPage`, so UI updates based on its direct return value were incorrect.
    *   **Solution:** Added `await` to the `login()` call in `src/app/auth/login/page.tsx`.

12. **Bug:** 404 error on homepage content after i18n setup, with browser trying to fetch `/es`.
    *   **Description:** After integrating `next-i18next`, the homepage (`/`) would show a 404 error for the main content area, while Header/Footer might render. Browser console showed attempts to GET `/es`, resulting in 404.
    *   **Cause:** The `next.config.js` file included an `i18n` block (populated from `next-i18next.config.js`). This activated Next.js's path-based i18n routing (expecting routes like `/en/page` or `/es/page`), which conflicted with the desired client-side i18n approach without path-based locale prefixes.
    *   **Solution:** Removed the `i18n` block from `next.config.js`. Ensured `RootLayout.tsx` (as a Client Component) correctly initialized `i18next` and wrapped its children with `I18nextProvider` from `react-i18next`. Switched `useTranslation` imports in client components from `next-i18next` to `react-i18next`.

13. **Bug:** Module not found errors for `next-i18next.config.js` or translation JSON files.
    *   **Description:** Build errors or runtime errors indicating config/JSON files couldn't be resolved.
    *   **Cause:** Incorrect relative paths in `import` or `require` statements within `src/app/layout.tsx` or other files. Using `require` for JSON in client components can also be problematic.
    *   **Solution:** Corrected import paths (e.g., `../../public/locales/...` from `src/app/layout.tsx`). Switched to ES module `import` for JSON files, leveraging `resolveJsonModule: true` in `tsconfig.json`. Removed direct import of `next-i18next.config.js` from `layout.tsx`.

14. **Bug:** Syntax errors in `useState` declaration or `console.warn` calls.
    *   **Description:** Build errors like "Expected ',' got '('" or "Expected unicode escape".
    *   **Cause:** Typos, such as `setIsSubmitting(true);` instead of `useState(false);`, or extra backslashes in template literals.
    *   **Solution:** Corrected the JavaScript syntax.

15. **Bug:** YouTube videos not embedding correctly (blank rectangle or attributes shown as text).
    *   **Description:** Image embeds worked, but YouTube videos failed.
    *   **Cause:** Initially, incorrect Tailwind aspect-ratio classes were used without the plugin. Later, a very subtle issue where the iframe HTML string might have been misinterpreted by `dangerouslySetInnerHTML` or by surrounding CSS.
    *   **Solution:** Switched to CSS padding-bottom trick for aspect ratio. Ensured iframe HTML string was correctly constructed and that `videoId` was properly extracted. The final fix involved ensuring the complete `<iframe>...</iframe>` tag was being generated and inserted.

16. **Bug:** Firebase Storage upload failures for avatars.
    *   **Description:** Profile picture uploads failed with "Update Failed" message.
    *   **Cause:** Firebase Storage security rules (`allow write: if request.auth != null && request.auth.uid == userId;`) were not evaluating correctly with the mock authentication system, as `request.auth` would be null from Storage's perspective.
    *   **Solution:** Advised user to temporarily relax Storage rules for the avatar path to `allow write: if true;` for development with mock auth, with a strong warning to secure them for production. Improved client-side error feedback for Storage/Firestore errors.

17. **Bug:** "Rendered more hooks than during the previous render" error in Header.
    *   **Description:** React error due to calling `useMockAuth` inside a loop (`.map()`) within the `UserRoleSwitcher` component in `Header.tsx`.
    *   **Cause:** Violation of Rules of Hooks.
    *   **Solution:** Moved `mockAuthUsers` (now `preparedMockAuthUsers`) to be a top-level export from `useMockAuth.ts` (later refined to be part of the hook's return object for stability) and imported/accessed it directly in `Header.tsx`, ensuring `useMockAuth` was called only once at the top level.

18. **Bug:** `ReferenceError: Loader2 is not defined` in Login page.
    *   **Description:** Runtime error when submitting login form.
    *   **Cause:** `Loader2` icon from `lucide-react` was used in JSX but not imported.
    *   **Solution:** Added `Loader2` to the `lucide-react` import statement in `src/app/auth/login/page.tsx`.

19. **Bug:** `TypeError: loginAndSetUserFromFirestore is not a function` during login.
    *   **Description:** Attempting to log in after Firebase Auth success resulted in a TypeError.
    *   **Cause:** The `loginAndSetUserFromFirestore` function was not being correctly defined within or returned by the `useMockAuth` hook.
    *   **Solution:** Comprehensively rewrote `useMockAuth.ts` to ensure proper scoping, definition, and return of `loginAndSetUserFromFirestore` and other auth-related functions, and refined user initialization logic.

20. **Bug:** `ReferenceError: newPostRef is not defined` when proposing constitution changes.
    *   **Description:** Submitting a constitution change proposal resulted in a runtime error.
    *   **Cause:** The `newPostRef` variable was used in a Firestore batch operation before it was declared and initialized.
    *   **Solution:** Ensured `const newPostRef = doc(collection(db, "posts"));` was placed before its use in `src/app/agora/propose-constitution-change/page.tsx`.

21. **Bug:** Routing conflict: `/forums/propose-new-forum` caught by dynamic route `/forums/[forumId]`.
    *   **Description:** Clicking "Propose New Forum" (initially linked to `/forums/propose-new-forum`) loaded the generic forum page with "propose-new-forum" as the ID, resulting in "Forum not found".
    *   **Cause:** Next.js routing precedence favored the dynamic route.
    *   **Solution:** Moved the "Propose New Forum" page to a distinct path: `/agora/propose-new-forum/page.tsx` and updated the link accordingly.

22. **Bug:** `ReferenceError: categories is not defined` on Agora thread page when displaying new forum proposal details.
    *   **Description:** Thread page crashed when trying to display the category name for a new forum proposal.
    *   **Cause:** The thread page attempted to find the category name from a `categories` array that was not available in its scope.
    *   **Solution:** Denormalized `proposedForumCategoryName` into the `Votation` document when a new forum proposal is created. The thread page now uses this field directly.

23. **Bug:** Votation for user admission marked as "Passed" but user status not updated in Firestore.
    *   **Description:** Admission votations would correctly close and show "Passed", but the target user's document in Firestore remained `status: "pending_admission"`.
    *   **Cause:** The conditional block `if (newStatus === 'closed_passed' && votation.type === 'admission_request' ...)` in `ThreadPage.tsx`'s votation closing logic was not being entered or the batch commit was failing silently.
    *   **Solution:** Consolidated votation closing and outcome application logic into a single flow within the main data-fetching `useEffect` in `ThreadPage.tsx`. Added detailed logging to trace execution, which helped confirm conditions and ensure the user update batch was correctly prepared and committed.

24. **Bug:** Redirect loop when a user's sanction status changed or when navigating to threads.
    *   **Description:** After a sanction was lifted, or sometimes when navigating to any thread, the page would get stuck in a reload/redirect loop. Browser console showed "Demasiadas llamadas a las API de ubicación o historial".
    *   **Cause:** Multiple components (`ThreadPage.tsx` and `SanctionCheckWrapper.tsx`) were trying to manage routing based on user status, sometimes conflictingly. Also, `useEffect` dependency arrays in `SanctionCheckWrapper` or `ThreadPage` might have been too sensitive, causing re-runs and repeated navigations.
    *   **Solution:**
        *   Centralized sanction-related redirection logic primarily within `SanctionCheckWrapper.tsx`.
        *   Removed direct `router.replace()` calls related to sanction status from `ThreadPage.tsx`.
        *   Refactored `useEffect` hooks in `ThreadPage.tsx` to separate data fetching from votation processing, stabilizing dependencies.
        *   Removed `isProcessingSanction` from `SanctionCheckWrapper`'s main `useEffect` dependency array.

25. **Bug:** Header not updating immediately after user login.
    *   **Description:** After successful login, the header would still show "Login/Sign Up" links until a page reload.
    *   **Cause:** The state update for `currentUser` in `useMockAuth` was not reliably propagating to the `Header` component immediately after client-side navigation triggered by `router.push('/')` in the `LoginPage`.
    *   **Solution:** Refactored `useMockAuth` to use a module-scoped `internalCurrentUser` and a listener pattern to notify subscribed components (like `Header`) of state changes, ensuring more immediate UI updates.

26. **Bug:** Firestore transaction error: "Firestore transactions require all reads to be executed before all writes." when liking a post.
    *   **Description:** Liking a post failed with a transaction error.
    *   **Cause:** Incorrect ordering of read (`transaction.get()`) and write (`transaction.update()`) operations within the Firestore transaction in `PostItem.tsx`.
    *   **Solution:** Refactored the transaction block in `handleLike` to ensure all read operations are performed before any write operations.

27. **Bug:** `ReferenceError: newReactionsField is not defined` (and subsequent `justLiked` logic issues) in `PostItem.tsx` when creating like notification.
    *   **Description:** Liking a post succeeded in DB but failed to create notification due to JS error.
    *   **Cause:** Notification logic used `newReactionsField` (a variable local to the transaction scope) instead of the updated component state `currentReactions` or the more direct `newReactionsStateForPost` variable from the transaction. `useState` updates are async.
    *   **Solution:** Used `newReactionsStateForPost` (the data prepared for/committed by the transaction) to determine `userHasLikedNow` for notification logic. Moved `setCurrentReactions` to after notification logic.

## III. Open Bugs in Kratia Forums Application

*   None known at this time that haven't been addressed or are part of planned future work in `TODO.md`.

---
*This document should be updated as new bugs are found or old ones are revisited.*
