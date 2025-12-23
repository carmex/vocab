Step 1: Sysadmin - Linux Mint & Docker Setup
Act as a Linux Sysadmin.

I have a VPS running Linux Mint 21.1 (Vanessa), which is based on Ubuntu 22.04 (Jammy).
- It is currently running Apache2 serving a website.
- I want to self-host Supabase on this server using Docker.

Task:
Provide a guide to:
1. Install Docker Engine and Docker Compose (v2) for Linux Mint 21.1 / Ubuntu Jammy.
2. Git clone the Supabase docker setup (`supabase/supabase`).
3. Configuration:
   - Edit `.env` and `docker-compose.yml`.
   - Ensure Supabase Studio runs on localhost:8085 and API on localhost:8081 (to avoid conflict with Apache ports 80/443).
   - Set strong DB passwords.
4. Apache Reverse Proxy:
   - Create a VirtualHost config to proxy `db.mydomain.com` -> localhost:8085 (Studio).
   - Create a VirtualHost config to proxy `api.mydomain.com` -> localhost:8081 (API/Kong).
5. Provide commands to start the stack and verify it is running.

Output:
- Bash commands.
- Config file snippets.


Step 2: Database Schema & RPCs (Spec 2.3)
Act as a Database Architect (PostgreSQL).

Task:
Create a single SQL script for a Supabase project based on "Spec 2.3".

1. Tables (Enable RLS on ALL):
   - `word_lists`: id (uuid), name, description, creator_id, is_public, created_at.
   - `list_words`: id, list_id, word, definition.
   - `list_shares`: id, word_list_id, user_id, last_accessed.
   - `user_missed_words`: user_id, word_id, list_id. PK(user_id, word_id).
   - `quiz_progress`: id, user_id, list_id, pass_type ('main', 'review'), state (JSONB), updated_at.
     - Constraint: Unique on (user_id, list_id, pass_type).
     - Default `state` should be `{"answered_ids": [], "incorrect_ids": []}`.

2. RLS Policies:
   - Users see their own data.
   - Users see `word_lists` if public OR in `list_shares`.

3. RPC Functions (Transactional Writes):
   - `create_new_list(name, description)`: Inserts list, adds creator to list_shares. Returns list_id.
   - `subscribe_to_list(list_id)`: Adds current user to list_shares.
   - `update_quiz_progress(p_list_id, p_pass_type, p_word_id, p_is_correct)`:
     - UPSERT into `quiz_progress`.
     - Appends `p_word_id` to `state->'answered_ids'`.
     - If `p_is_correct` is false: Append to `state->'incorrect_ids'` AND upsert `user_missed_words`.
   - `finish_quiz_pass(p_list_id, p_pass_type, p_clear_missed)`:
     - Logic to delete from `user_missed_words` if p_clear_missed is true.
     - Delete row from `quiz_progress`.

Output:
- Valid PostgreSQL/PLpgSQL.


Step 3: Angular Foundation & Hybrid Service
Act as a Senior Angular Developer.

Context:
- Existing V1 Angular App.
- Migration to V2.3 (Supabase Hybrid API).

Task:
1. Install `@supabase/supabase-js`.
2. Setup `SupabaseService` (Client initialization) and `AuthService`.
3. Create `ListService`.
   - **Crucial:** Per Spec 2.3, use DIRECT client queries for reading data.
   - Implement `getMyLists()`: Select from `list_shares` joined with `word_lists`, ordered by `last_accessed`.
   - Implement `getListDetails(id)`: Use `Promise.all` to fetch:
     - List Metadata.
     - Count of `list_words`.
     - Count of `user_missed_words` for this user/list.
     - Check if a `quiz_progress` row exists (returns boolean).
   - Implement `createList(name, description)`: Use the RPC `create_new_list`.

4. Create `DashboardComponent`:
   - Display "My Lists".
   - FAB to Create New List.
   - "Study" button navigates to `/list/:id`.

Output:
- TypeScript code for Services and Components.


Step 4: Data Migration (JSON to DB)
Act as a TypeScript Developer.

Task:
Write a migration function `seedLegacyData()` to be used in the Angular app (e.g., triggered by a temporary button).

Logic:
1. Load `assets/words.json`.
2. Call Supabase RPC `create_new_list('Legacy Import', 'Imported from V1')`.
3. Construct a large array of objects for the `list_words` table.
4. Perform a bulk insert: `supabase.from('list_words').insert(array)`.

Output:
- A clean TypeScript function.


Step 5: The Quiz Engine (JSONB & Optimistic UI)
Act as a Senior Angular Developer.

Task:
Refactor the V1 `QuizComponent` to Spec 2.3 standards.

Inputs:
- Route: `/quiz/:listId/:mode` ('main' or 'review').

Logic Changes:
1. **Initialization:**
   - Fetch ALL `list_words` for this list.
   - Fetch `quiz_progress` for this list/mode.
   - **Client-Side Filter:**
     - If `quiz_progress` exists, parse `state.answered_ids`.
     - Remove those IDs from the active word queue.

2. **Answering (Optimistic UI):**
   - User clicks Answer.
   - **Step A (UI):** IMMEDIATELY move to the next word. Do not wait for Network.
   - **Step B (Network):** Call RPC `update_quiz_progress(word_id, is_correct)` in the background.
   - Handle errors: If RPC fails, log it (for now, assume happy path).

3. **Refactor SummaryComponent:**
   - Buttons trigger RPC `finish_quiz_pass`.
   - Show a spinner while the RPC executes (database cleanup).
   - Navigate to List Details on success.

Output:
- Component Logic (TS) focusing on the "Client-Side Filter" and "Optimistic Update" patterns.


Step 6: Marketplace (Pagination)
Act as an Angular Developer.

Task:
Implement the Marketplace Feature (Spec 2.3).

1. Update `ListService`:
   - Add `getPublicLists(page: number, pageSize: number)`.
   - Use Supabase range query: `.select('*', { count: 'exact' }).range(start, end)`.

2. Create `MarketplaceComponent`:
   - Display public lists.
   - Implement "Load More" button (Basic pagination).
   - Click list -> Open Preview Dialog.

3. Create `PreviewDialog`:
   - Show words.
   - Button "Add to My Lists" -> Calls RPC `subscribe_to_list(id)`.

Output:
- Service methods and Component logic.