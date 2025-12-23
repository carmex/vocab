Step 1: Sysadmin - VPS & Supabase Setup

Act as a Linux Sysadmin and DevOps Engineer.

I have a VPS running Ubuntu 20.04.6 LTS.
- It is currently running Apache2 with virtual hosts to serve several websites.
- I want to self-host Supabase on this same server using Docker.

Task:
Provide a step-by-step guide to:
1. Install Docker and Docker Compose on Ubuntu 20.04 if missing.
2. Git clone the Supabase docker setup (`supabase/supabase`).
3. Modify the `.env` and `docker-compose.yml` to ensure Supabase does NOT conflict with ports 80/443 (Apache). Run Supabase Studio on port 8085 and the API on 8081 (or similar safe ports).
4. Configure an Apache VirtualHost to Reverse Proxy a subdomain (e.g., `db.mydomain.com`) to the Supabase Studio port, and `api.mydomain.com` to the Supabase Kong/API port.
5. Provide the commands to start the containers and verify connectivity.

Output format:
- Bash commands.
- Configuration file snippets (Apache .conf, Supabase .env).


Step 2: Angular - Dependencies & Auth Refactor
Act as a Senior Angular Developer. We are upgrading an existing Angular Application (Version 1) to Version 2.

Current Context:
- The app uses Angular Material.
- The app currently relies on `localStorage` and a static `words.json` file.
- We are moving to a Self-Hosted Supabase backend.

Task:
1. Install the supabase client: `npm install @supabase/supabase-js`.
2. Create `src/environments/environment.ts` entries for `supabaseUrl` and `supabaseKey`.
3. Create a `SupabaseService` to initialize the client.
4. Create an `AuthService` handling Login/Signup/Logout.
5. Create a `LoginComponent` (Material Card, Email/Password form).
6. Create an `AuthGuard` that checks `AuthService.session`.
7. UPDATE the `app-routing.module.ts`:
   - Set `LoginComponent` as the default route (`''`).
   - Create a new generic layout or landing component called `DashboardComponent` (leave empty for now) protected by the Guard.
   - Move the existing V1 "Main Menu" route to a sub-route (we will refactor it later).

Output Requirements:
- Code for the Services, Guard, and Routing updates.
- Do not remove the V1 `QuizComponent` or existing logic yet.


Step 3: Database Schema & Migration Script
Act as a Database Architect and TypeScript Developer.

Task Part 1: SQL Schema
Generate a SQL script for Supabase Postgres that creates:
1. `word_lists` (id, name, description, creator_id, is_public).
2. `list_words` (id, list_id, word, definition).
3. `list_shares` (id, list_id, user_id, last_accessed).
4. `user_missed_words` (user_id, word_id).
5. `session_answers` (id, user_id, word_id, list_id, pass_type, was_correct, timestamp).
Enable RLS on all tables.

Task Part 2: Seed Script (TypeScript)
We have an existing file `src/assets/words.json` containing an array of objects `{word, definition}`.
Write a standalone TypeScript function (or an Angular Service method) called `seedLegacyData()` that:
1. Reads the local `words.json`.
2. Calls Supabase to create a new `word_list` named "Legacy Word List".
3. Iterates through the JSON and inserts all items into `list_words` linked to that new list.
4. Inserts a row into `list_shares` so the current user can see it.
*Note: This is a one-time utility for the user to migrate their static file to the DB.*

Output:
- SQL Script.
- TypeScript method for data migration.


Step 4: Building the "Dashboard" (New UI)
Act as an Angular Developer.

Task:
Implement the `DashboardComponent` and `ListService`.

1. `ListService`:
   - Implement `getMyLists()` which calls a Supabase RPC function (assume the RPC `get_my_lists` exists, mapping to the `list_shares` table).
   - Implement `createList(name, description)`.

2. `DashboardComponent` (The new Landing Page):
   - Fetch lists via `ListService`.
   - Display lists as Angular Material Cards.
   - Card Actions: "Study" (Navigates to List Details), "Share".
   - Add a "Migrate Legacy Data" button that triggers the `seedLegacyData()` function created in the previous step.

3. `ListDetailsComponent` (New Screen):
   - Route: `/list/:id`.
   - Display List metadata.
   - We need buttons for "Start Quiz", "Review Missed", etc.
   - *Crucial:* Do NOT implement the quiz logic here yet. Just layout the buttons matching the V2 spec.

Output:
- Angular Component logic and Templates.


Step 5: Refactoring the Quiz Engine
Act as a Senior Angular Developer. We are performing a major refactor of the `QuizComponent`.

Current V1 Logic:
- Loads `words.json`.
- Filters words based on `localStorage` arrays (`current_pass_answered`, etc).
- Updates `localStorage` on every answer.

Target V2 Logic:
- Accepts a `listId` from the route.
- Fetches words via Supabase RPC `get_quiz_questions(list_id, pass_type)`.
- Records answers via Supabase RPC `record_answer(...)`.

Task:
Refactor `QuizComponent` and its Service:
1. **Remove** all `localStorage` logic.
2. **Remove** direct `words.json` imports.
3. **Keep** the UI interaction: The Progress Bars (Green/Red), the Answer Buttons, the Timer, and the Feedback logic (Green/Red styling on click) MUST remain exactly as they are in V1.
4. **Integration:**
   - On `ngOnInit`, call the API to get the word queue.
   - On `handleAnswer(isCorrect)`, fire the `record_answer` API call. *Fire and forget* (don't await it to block the UI).
   - When the queue is empty, navigate to the Summary screen.

5. Refactor `SummaryComponent`:
   - Remove LocalStorage clearing logic.
   - Add buttons to call `clear_main_pass` or `commit_review_pass` RPCs.

Output:
- The updated TypeScript logic for `QuizComponent` and `SummaryComponent`.
- Highlight exactly where the API calls replace the old LocalStorage calls.


Step 6: Backend RPCs (The logic behind the refactor)
Act as a Database Expert.

Task:
Write the PostgreSQL Functions (RPCs) to support the Angular refactor.

1. `get_quiz_questions(p_list_id uuid, p_pass_type text)`:
   - Returns words from `list_words` minus those in `session_answers`.
2. `record_answer(...)`:
   - Inserts into `session_answers`.
   - Updates `user_missed_words` if incorrect.
3. `clear_main_pass(...)` and `commit_review_pass(...)`:
   - Logic to clean up `session_answers` and update `user_missed_words`.

Output:
- SQL code compatible with Supabase.