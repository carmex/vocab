# Spec: Online Vocabulary Study Tool (Version 2.2)

## 1. Project Overview

This document outlines the migration of the Online Vocabulary Study Tool from a single-list, `localStorage`-based application to a full-stack, multi-user, cloud-native application. The new version will support multiple word lists, user-created lists, list sharing, and full progress-syncing across devices.

## 2. Core Technologies

* **Front-End:** Angular
* **UI Library:** Angular Material (for all UI components)
* **Back-End:** **Supabase**
    * **Authentication:** Supabase Auth (Email/Password and Google Sign-In)
    * **Database:** Supabase Postgres
    * **API:** All client-side logic will be handled by calling specific Postgres functions (via the Supabase client) rather than direct table queries.

---

## 3. Database Schema (Postgres)

The database will be structured with the following tables:

* **`users` (Supabase `auth.users`)**
    * This table is managed by Supabase Auth.
    * A `last_logged_in` timestamp will be updated on each login.

* **`word_lists`**
    * Stores the metadata for each vocabulary list.
    * `id` (uuid, primary key)
    * `name` (text)
    * `description` (text)
    * `creator` (uuid, foreign key to `auth.users.id`)
    * `is_public` (boolean, default: `false`): If `true`, list appears in the "Marketplace."
    * `created_at` (timestamp)

* **`list_words`**
    * Stores the individual words for all lists.
    * `id` (uuid, primary key)
    * `list_id` (uuid, foreign key to `word_lists.id`)
    * `word` (text)
    * `definition` (text)

* **`list_shares`**
    * Tracks which users have access to which lists. This table powers the "My Word Lists" screen.
    * `id` (uuid, primary key)
    * `word_list_id` (uuid, foreign key to `word_lists.id`)
    * `user_id` (uuid, foreign key to `auth.users.id`)
    * `last_accessed` (timestamp): Used to sort the "My Word Lists" screen.

* **`user_missed_words`**
    * A permanent record of every word a user has *ever* missed. Replaces the old `cumulative_missed` array.
    * `user_id` (uuid, foreign key to `auth.users.id`)
    * `word_id` (uuid, foreign key to `list_words.id`)
    * **(Primary Key: `(user_id, word_id)`)**

* **`session_answers`**
    * A **temporary** table that tracks answers for a single, in-progress quiz pass. This table is used to power the "Continue Quiz" and "Continue Missed Words" logic.
    * Rows are **inserted** on every answer and **deleted** when a pass is completed.
    * `id` (uuid, primary key)
    * `user_id` (uuid, foreign key to `auth.users.id`)
    * `word_id` (uuid, foreign key to `list_words.id`)
    * `list_id` (uuid, foreign key to `word_lists.id`)
    * `pass_type` (enum: `'main'`, `'review'`)
    * `was_correct` (boolean)
    * `timestamp` (timestamp)

---

## 4. Back-End API (Supabase Functions)

The Angular client will interact with the database by calling these defined Postgres functions.

### 4.1. List & User Data
* **`get_my_lists(user_id)`**
    * Fetches all lists a user has access to by querying `list_shares`.
    * Returns a list of `word_list` objects, joined with metadata, sorted by `list_shares.last_accessed` (descending).

* **`get_public_lists()`**
    * Fetches all lists where `word_lists.is_public = true` for the "Marketplace."

* **`get_list_details(user_id, list_id)`**
    * Gathers all data for the "List Details" screen.
    * Returns a single object containing:
        * List metadata (name, description, creator username).
        * Quiz stats (total words, % complete, missed word count).
        * Button states (`show_continue_main`, `show_review_button`, `show_continue_review`).

* **`add_list_to_user(user_id, list_id)`**
    * Creates a new entry in `list_shares`.
    * Used when a user adds a list from the Marketplace or a share link.

### 4.2. Quiz Logic
* **`get_quiz_questions(user_id, list_id, pass_type)`**
    * Calculates and returns the pool of `list_words` for the quiz.
    * If "Start": Returns all words in the list.
    * If "Continue": Returns all words in the list *except* those found in `session_answers` for that `user_id`, `list_id`, and `pass_type`.

* **`record_answer(user_id, word_id, list_id, pass_type, was_correct)`**
    * Called **immediately** after every user answer.
    * Inserts one row into `session_answers`.
    * If `was_correct = false`, it also inserts/upserts a row into `user_missed_words`.

* **`clear_main_pass(user_id, list_id)`**
    * Called from the Summary Screen after a 'main' quiz.
    * Deletes all rows from `session_answers` for that `user_id`, `list_id`, and `pass_type = 'main'`.

* **`commit_review_pass(user_id, list_id, clear_corrected_words)`**
    * Called from the Summary Screen after a 'review' quiz.
    * If `clear_corrected_words = true`, it finds all correct answers from the `session_answers` table (for this pass) and deletes them from the `user_missed_words` table.
    * In all cases, it deletes all rows from `session_answers` for that `user_id`, `list_id`, and `pass_type = 'review'`.

### 4.3. List Creation & Management
* **`Notes(user_id, name, description)`**
    * Inserts a new row into `word_lists` with `creator = user_id`.
    * **Crucially,** also inserts a new row into `list_shares` to give the creator access to their own list.
    * Returns the `new_list_id`.

* **`add_word(list_id, word, definition)`**
    * Inserts a single new row into `list_words`.

* **`bulk_add_words(list_id, [array_of_word_objects])`**
    * Receives an array of words/definitions and performs a bulk insert into `list_words`. Used by the JSON import feature.

* **`update_word(word_id, word, definition)`**
    * Updates a specific word in `list_words`.

* **`delete_word(word_id)`**
    * Deletes a specific word from `list_words`.

---

## 5. User Flow & Screen Specifications

All screens require an active user login.

### 5.1. Authentication
* Users can sign up or log in via Google or Email/Password.
* All application routes are protected and require a valid session.

### 5.2. Main Menu
* This is the new landing page.
* Shows two large Angular Material buttons:
    1.  **"My Word Lists"** (Links to the list of user's active lists)
    2.  **"Marketplace"** (Links to the public list discovery screen)

### 5.3. "My Word Lists" Screen
* Displays a list or set of cards of all word lists the user has access to (by calling `get_my_lists`).
* Lists are sorted by `last_accessed` (most recent first).
* Tapping a list navigates to the "List Details" screen for that list.
* A "Create New List" (e.g., FAB or header button) is present on this screen.

### 5.4. "List Details" Screen
* This screen is the hub for a specific list. It calls `get_list_details` to populate.
* **Displays:**
    * List Name & Description.
    * Stats (Total Words: X, Progress: Y%, Missed: Z).
* **Displays Buttons (based on logic from `get_list_details`):**
    * **"Start Quiz" / "Continue Quiz" (Green):** Logic based on `session_answers` for `pass_type = 'main'`.
    * **"Review Missed Words" / "Continue Missed Words" (Yellow):**
        * Button is **hidden** if `user_missed_words` count for this list is 0.
        * "Continue" vs. "Review" logic is based on `session_answers` for `pass_type = 'review'`.
    * **"Share" Button:**
        * Visible to *any* user with access to this list.
        * Generates a unique, shareable URL.
    * **"Edit List" Button:**
        * Visible *only* to the user who is the `creator` of the list.
        * Links to the "Edit List" screen.

### 5.5. "Marketplace" Screen
* Calls `get_public_lists` and displays all word lists where `is_public = true`.
* Tapping any list navigates to the "Preview" screen.

### 5.6. "Preview" Screen (for Marketplace & Share Links)
* This screen is shown when a user clicks a list in the Marketplace OR opens a shareable URL.
* **Displays:**
    * Creator's Username
    * List Name & Description
    * A scrollable list of all words/definitions in the list.
* **Action Button:**
    * A single **"Add to My Lists"** button at the bottom.
    * Clicking this calls `add_list_to_user` and then navigates the user to their "My Word Lists" screen.

### 5.7. List Creation & Management
1.  **Creation:** User taps "Create New List" (on "My Word Lists" screen).
2.  **Form:** User sees a form to enter `Name` and `Description`.
3.  **On Submit:** Calls `Notes`. On success, navigates to the "Edit List" screen.
4.  **"Edit List" Screen:**
    * Displays list name/description.
    * **"Add Word" Button:** Opens a simple form to add one word/definition (calls `add_word`).
    * **"Import Words" Button:** Opens a file prompt for a `.json` file (in the original `words.json` format). On upload, parses the file and calls `bulk_add_words`.
    * Displays a list of all existing words in this list. Tapping a word allows the user to edit (calls `update_word`) or delete (calls `delete_word`).

### 5.8. Quiz Interface (Main & Review)
* The UI from the original spec remains **identical** (progress bars, word, 4 buttons, feedback controls).
* **New Back-End Logic:**
    * **On Load:** Calls `get_quiz_questions` to get the word pool.
    * **On Answer:** Instantly calls `record_answer` to save progress. The front-end UI updates immediately.

### 5.9. Summary Screen
* The UI from the original spec remains **identical** (stats, "Finish" button, etc.).
* **New Back-End Logic:**
    * **After Main Quiz:** "Finish" button calls `clear_main_pass` and returns to the "List Details" screen.
    * **After Review Quiz:**
        * "Clear Corrected Words" button calls `commit_review_pass(user_id, list_id, true)`.
        * "Leave List Unchanged" button calls `commit_review_pass(user_id, list_id, false)`.
        * Both buttons return the user to the "List Details" screen.

---

## 6. Removed Features (from Spec 1.0)

* **Export Progress:** This is no longer needed as all progress is saved to the user's account in the cloud.
* **Import Progress:** This is no longer needed. The "Import Words" feature is for creating new lists, not restoring user progress.