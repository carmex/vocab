# Spec: Online Vocabulary Study Tool (Version 2.3)

## 1. Project Overview

This document outlines the migration of the Online Vocabulary Study Tool to a full-stack, cloud-native application. This version is optimized for Supabase/Postgres performance, utilizing a hybrid API approach to leverage Supabase's auto-generated REST endpoints for reading data and custom Postgres functions (RPCs) for transactional updates.

## 2. Core Technologies

* **Front-End:** Angular
* **UI Library:** Angular Material
* **Back-End:** **Supabase**
    * **Authentication:** Supabase Auth (Email/Password, Google).
    * **Database:** Supabase Postgres.
    * **API Strategy:** **Hybrid.**
        * **Reads:** Standard Supabase JS Client (`.select()`, `.filter()`) for fetching lists and details.
        * **Writes:** RPCs (Remote Procedure Calls) for complex transactional logic (e.g., finishing a quiz, creating linked lists).

---

## 3. Database Schema (Postgres)

**Global Requirement:** **Row Level Security (RLS)** must be enabled on all tables. Policies should restrict access based on `auth.uid()`.

* **`users`**
    * No custom table required. We will utilize the built-in `auth.users` table provided by Supabase.
    * *Note:* `last_sign_in_at` is automatically tracked by Supabase Auth.

* **`word_lists`**
    * Stores metadata for vocabulary lists.
    * `id` (uuid, primary key)
    * `name` (text)
    * `description` (text)
    * `creator_id` (uuid, foreign key to `auth.users.id`)
    * `is_public` (boolean, default: `false`)
    * `created_at` (timestamp, default: `now()`)

* **`list_words`**
    * Stores individual words.
    * `id` (uuid, primary key)
    * `list_id` (uuid, foreign key to `word_lists.id`)
    * `word` (text)
    * `definition` (text)
    * *Index:* `list_id`

* **`list_shares`**
    * Join table tracking user access to lists.
    * `id` (uuid, primary key)
    * `word_list_id` (uuid, foreign key to `word_lists.id`)
    * `user_id` (uuid, foreign key to `auth.users.id`)
    * `last_accessed` (timestamp)
    * *Index:* `(user_id, last_accessed)` for sorting.

* **`user_missed_words`**
    * **Purpose:** Persistent tracking of words requiring remediation (the "To-Do" list of missed words).
    * **Lifecycle:** Rows are added when a user misses a word in a Main Quiz. Rows are deleted when a user masters the word in a Review Quiz and chooses to "Clear Corrected."
    * `user_id` (uuid, foreign key to `auth.users.id`)
    * `word_id` (uuid, foreign key to `list_words.id`)
    * `list_id` (uuid, foreign key to `word_lists.id`) — *Added for faster querying of "Missed counts per list".*
    * **Primary Key:** `(user_id, word_id)`

* **`quiz_progress` (Optimized for JSONB)**
    * Tracks the state of an *active* quiz session. Only one row exists per user/list/type combo.
    * `id` (uuid, primary key)
    * `user_id` (uuid, foreign key to `auth.users.id`)
    * `list_id` (uuid, foreign key to `word_lists.id`)
    * `pass_type` (enum: `'main'`, `'review'`)
    * `state` (jsonb): Stores the session data to avoid high-churn row inserts.
        * *Schema:* `{"answered_ids": [uuid, uuid], "incorrect_ids": [uuid, uuid]}`
    * `updated_at` (timestamp)
    * *Constraint:* Unique on `(user_id, list_id, pass_type)`

---

## 4. Back-End Interaction (Hybrid)

### 4.1. Data Fetching (Standard Supabase Client)
*The Front-End will directly query tables using the Supabase SDK. RLS policies ensure users only see what they are allowed to see.*

* **"My Word Lists" Query:**
    * Query `list_shares` joined with `word_lists`.
    * Order by `last_accessed` descending.
* **"Marketplace" Query:**
    * Query `word_lists` where `is_public` is `true`.
    * **Pagination Required:** Query must use `.range(start, end)` to fetch lists in batches (e.g., 20 at a time).
* **"List Details" Query:**
    * Fetch `word_list` metadata.
    * Fetch count of related `list_words`.
    * Fetch count of related `user_missed_words` (filtered by `user_id`).
    * Fetch existence of `quiz_progress` row (to determine "Start" vs "Continue" button state).
* **"Start Quiz" Word Fetch:**
    * Fetch all `list_words` for the given `list_id`.
    * If "Continue" mode: Front-end fetches the `quiz_progress` row, parses the JSON `answered_ids`, and filters the word list client-side.

### 4.2. Transactional Logic (RPCs / Postgres Functions)
*Complex writes are encapsulated in Postgres functions to ensure data integrity.*

* **`create_new_list(name, description)`**
    * Inserts into `word_lists`.
    * Inserts into `list_shares` (granting creator access).
    * Returns the new `list_id`.

* **`subscribe_to_list(list_id)`**
    * Inserts into `list_shares` for the current user.
    * Used for "Add to My Lists" from Marketplace.

* **`update_quiz_progress(list_id, pass_type, word_id, is_correct)`**
    * **Logic:**
        1.  Upserts into `quiz_progress` for the `(user_id, list_id, pass_type)`.
        2.  Appends `word_id` to the `state->'answered_ids'` JSON array.
        3.  If `is_correct` is false, appends `word_id` to `state->'incorrect_ids'` JSON array AND inserts/upserts into `user_missed_words`.
    * *Benefit:* Updates a single row/index, preventing index thrashing.

* **`finish_quiz_pass(list_id, pass_type, clear_missed_words)`**
    * **Logic:**
        1.  If `pass_type == 'review'` AND `clear_missed_words == true`:
            * Reads `state->'answered_ids'` from `quiz_progress`.
            * Reads `state->'incorrect_ids'` from `quiz_progress`.
            * Calculates `Corrected Words` (Answered minus Incorrect).
            * Deletes those IDs from `user_missed_words`.
        2.  Deletes the row from `quiz_progress`.

---

## 5. User Flow & Screen Specifications

### 5.1. "My Word Lists" Screen
* **Data Source:** `supabase.from('list_shares').select('*, word_lists(*)')`
* **Sorting:** `last_accessed` desc.
* **UI:** List of cards. Tap to navigate to details.

### 5.2. "Marketplace" Screen
* **Data Source:** `supabase.from('word_lists').select('*').eq('is_public', true)`
* **Pagination:** Infinite scroll or "Load More" button. Fetches 20 records at a time.
* **Performance Note:** Do not fetch word counts or deep associations on this list view to keep it fast.

### 5.3. "List Details" Screen
* **Logic:**
    * Use `Promise.all` to fetch List Metadata, Total Word Count, and User Missed Count in parallel.
    * Check for active session: `supabase.from('quiz_progress').select('id')` to toggle "Start" vs "Continue".

### 5.4. Quiz Interface
* **Initialization:**
    * Fetch all words for the list.
    * If "Continue": Fetch `quiz_progress`. Filter out `answered_ids` locally in JavaScript.
* **Answer Interaction (Optimistic UI):**
    * User clicks answer.
    * **Immediately:** UI moves to next card (no spinner).
    * **Background:** Angular calls `rpc('update_quiz_progress', ...)` .
    * **Error Handling:** If the RPC fails (network drop), prompt user to retry or queue the request.

### 5.5. Summary Screen
* Displays stats calculated locally by the Angular app (based on the session just finished).
* **"Finish" / "Clear Corrected" Buttons:**
    * Trigger `rpc('finish_quiz_pass')`.
    * Show a loading spinner during this call as it involves deletions and cleanup.
    * On success, navigate back to "List Details".

### 5.6. List Management (Edit/Create)
* **Add/Edit Word:** Direct Supabase Client calls (`.insert()`, `.update()`, `.delete()`) on the `list_words` table.
* **JSON Import:**
    * Parse JSON in Angular.
    * Use `supabase.from('list_words').insert([array_of_objects])` for efficient bulk insertion.

---

## 6. Security Checklist

1.  **Enable RLS:** Run `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;` on all tables.
2.  **Define Policies:**
    * `list_shares`: Users can see rows where `user_id = auth.uid()`.
    * `word_lists`: Users can see lists if they are public OR if they have a matching entry in `list_shares`.
    * `quiz_progress` / `user_missed_words`: Users can only full access rows where `user_id = auth.uid()`.