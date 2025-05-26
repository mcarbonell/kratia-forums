
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

## II. Closed Bugs in Kratia Forums Application

Esta sección lista los bugs significativos que se han identificado y resuelto en el código de la aplicación Kratia Forums.

1.  **Bug:** 404 error on homepage content after i18n setup, with browser trying to fetch `/es`.
    *   **Description:** After integrating `next-i18next`, the homepage (`/`) would show a 404 error for the main content area, while Header/Footer might render. Browser console showed attempts to GET `/es`, resulting in 404.
    *   **Cause:** The `next.config.js` file included an `i18n` block (populated from `next-i18next.config.js`). This activated Next.js's path-based i18n routing (expecting routes like `/en/page` or `/es/page`), which conflicted with the desired client-side i18n approach without path-based locale prefixes.
    *   **Solution:** Removed the `i18n` block from `next.config.js`. Ensured `RootLayout.tsx` (as a Client Component) correctly initialized `i18next` and wrapped its children with `I18nextProvider` from `react-i18next`. Switched `useTranslation` imports in client components from `next-i18next` to `react-i18next`.

2.  **Bug:** Admin/Founder users (admin1, founder1) not appearing in Firestore after seeding, leading to profile page errors.
    *   **Description:** When switching to mock users 'admin1' or 'founder1' via the header dev tool, their profile pages would show "User not found". Firestore inspection revealed these user documents were not being created.
    *   **Cause:** The `mockUsers` array in `src/lib/mockData.ts` did not correctly or consistently include 'admin1' and 'founder1', or the `seedDatabase.ts` script was not processing them correctly.
    *   **Solution:** Ensured `admin1` and `founder1` were explicitly defined in `src/lib/mockData.ts` with all necessary fields (ID, username, role, status). Verified and corrected `src/lib/seedDatabase.ts` to iterate over the complete `mockUsers` array and write all specified user fields to Firestore. Advised user to clear the `users` collection in Firestore before re-seeding to ensure a clean state.

3.  **Bug:** Redirect loop when a user's sanction status changed or when navigating to threads.
    *   **Description:** After a sanction was lifted, or sometimes when navigating to any thread, the page would get stuck in a reload/redirect loop. Browser console showed "Demasiadas llamadas a las API de ubicación o historial".
    *   **Cause:** Multiple components (`ThreadPage.tsx` and `SanctionCheckWrapper.tsx`) were trying to manage routing based on user status, sometimes conflictingly. Also, `useEffect` dependency arrays in `SanctionCheckWrapper` or `ThreadPage` might have been too sensitive, causing re-runs and repeated navigations.
    *   **Solution:**
        *   Centralized sanction-related redirection logic primarily within `SanctionCheckWrapper.tsx`.
        *   Removed direct `router.replace()` calls related to sanction status from `ThreadPage.tsx`.
        *   Refactored `useEffect` hooks in `ThreadPage.tsx` to separate data fetching from votation processing, stabilizing dependencies.
        *   Removed `isProcessingSanction` from `SanctionCheckWrapper`'s main `useEffect` dependency array.

4.  **Bug:** Header not updating immediately after user login.
    *   **Description:** After successful login, the header would still show "Login/Sign Up" links until a page reload.
    *   **Cause:** The state update for `currentUser` in `useMockAuth` was not reliably propagating to the `Header` component immediately after client-side navigation triggered by `router.push('/')` in the `LoginPage`.
    *   **Solution:** Refactored `useMockAuth` to use a module-scoped `internalCurrentUser` and a listener pattern to notify subscribed components (like `Header`) of state changes, ensuring more immediate UI updates.

5.  **Bug:** Votation for user admission marked as "Passed" but user status not updated in Firestore.
    *   **Description:** Admission votations would correctly close and show "Passed", but the target user's document in Firestore remained `status: "pending_admission"`.
    *   **Cause:** The conditional block `if (newStatus === 'closed_passed' && votation.type === 'admission_request' ...)` in `ThreadPage.tsx`'s votation closing logic was not being entered. This was due to issues correctly identifying `votation.type` or other conditions within the `useEffect`.
    *   **Solution:** Consolidated votation closing and outcome application logic into a single flow within the main data-fetching `useEffect` in `ThreadPage.tsx`. Added detailed logging to trace execution, which helped confirm conditions and ensure the user update batch was correctly prepared and committed.

6.  **Bug:** "ReferenceError: newPostRef is not defined" when proposing constitution changes.
    *   **Description:** Submitting a constitution change proposal resulted in a runtime error.
    *   **Cause:** The `newPostRef` variable was used in a Firestore batch operation before it was declared and initialized.
    *   **Solution:** Ensured `const newPostRef = doc(collection(db, "posts"));` was placed before its use in `src/app/agora/propose-constitution-change/page.tsx`.

7.  **Bug:** Routing conflict: `/forums/propose-new-forum` caught by dynamic route `/forums/[forumId]`.
    *   **Description:** Clicking "Propose New Forum" (initially linked to `/forums/propose-new-forum`) loaded the generic forum page with "propose-new-forum" as the ID, resulting in "Forum not found".
    *   **Cause:** Next.js routing precedence favored the dynamic route.
    *   **Solution:** Moved the "Propose New Forum" page to a distinct path: `/agora/propose-new-forum/page.tsx` and updated the link accordingly.

8.  **Bug:** `TypeError: loginAndSetUserFromFirestore is not a function` during login.
    *   **Description:** Attempting to log in after Firebase Auth success resulted in a TypeError.
    *   **Cause:** The `loginAndSetUserFromFirestore` function was not being correctly defined within or returned by the `useMockAuth` hook.
    *   **Solution:** Comprehensively rewrote `useMockAuth.ts` to ensure proper scoping, definition, and return of `loginAndSetUserFromFirestore` and other auth-related functions, and refined user initialization logic.

9.  **Bug:** Various `Module not found` errors for `next-i18next.config.js` or translation JSON files.
    *   **Description:** Build errors or runtime errors indicating config/JSON files couldn't be resolved.
    *   **Cause:** Incorrect relative paths in `import` or `require` statements within `src/app/layout.tsx` or other files. Using `require` for JSON in client components can also be problematic.
    *   **Solution:** Corrected import paths (e.g., `../../public/locales/...` from `src/app/layout.tsx`). Switched to ES module `import` for JSON files, leveraging `resolveJsonModule: true` in `tsconfig.json`. Removed direct import of `next-i18next.config.js` from `layout.tsx`.

10. **Bug:** Syntax errors in `useState` declaration or `console.warn` calls.
    *   **Description:** Build errors like "Expected ',' got '('" or "Expected unicode escape".
    *   **Cause:** Typos, such as `setIsSubmitting(true);` instead of `useState(false);`, or extra backslashes in template literals.
    *   **Solution:** Corrected the JavaScript syntax.

11. **Bug:** YouTube videos not embedding correctly (blank rectangle or attributes shown as text).
    *   **Description:** Image embeds worked, but YouTube videos failed.
    *   **Cause:** Initially, incorrect Tailwind aspect-ratio classes were used without the plugin. Later, a very subtle issue where the iframe HTML string might have been misinterpreted by `dangerouslySetInnerHTML` or by surrounding CSS.
    *   **Solution:** Switched to CSS padding-bottom trick for aspect ratio. Ensured iframe HTML string was correctly constructed and that `videoId` was properly extracted. The final fix involved ensuring the complete `<iframe>...</iframe>` tag was being generated and inserted.

12. **Bug:** Firebase Storage upload failures for avatars.
    *   **Description:** Profile picture uploads failed with "Update Failed" message.
    *   **Cause:** Firebase Storage security rules (`allow write: if request.auth != null && request.auth.uid == userId;`) were not evaluating correctly with the mock authentication system, as `request.auth` would be null from Storage's perspective.
    *   **Solution:** Advised user to temporarily relax Storage rules for the avatar path to `allow write: if true;` for development with mock auth, with a strong warning to secure them for production. Improved client-side error feedback for Storage/Firestore errors.

## III. Open Bugs in Kratia Forums Application

*   None known at this time that haven't been addressed or are part of planned future work in `TODO.md`.

---
*This document should be updated as new bugs are found or old ones are revisited.*
