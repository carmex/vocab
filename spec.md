# Spec: Online Vocabulary Study Tool

## 1. Project Overview

A mobile-first web application built in Angular that allows users to study a pre-defined list of vocabulary words. The tool presents words in a randomized order with multiple-choice definitions. It tracks user progress (correct/missed) in browser `localStorage` and allows this progress to be imported and exported.

## 2. Core Technologies

* **Framework:** Angular
* **UI Library:** Angular Material (for all UI components: buttons, progress bars, alerts, etc.)
* **State Management:** Angular services using RxJS (BehaviorSubjects) for in-memory state.
* **Persistence:** Browser `localStorage`.

## 3. Data Structure

### 3.1. Baked-in Word List (Source)

The application will include a `words.json` file in its assets. This file is an array of objects. The `type` field will be ignored.

**Example Structure:**
```json
[
  {
    "word": "abase",
    "type": "v.",
    "definition": "To lower in position, estimation, or the like; degrade."
  },
  {
    "word": "abbess",
    "type": "n.",
    "definition": "The lady superior of a nunnery."
  }
]
```

### 3.2. Application State (Local Storage & Export)

The app's state will be saved in `localStorage` as a JSON object. This *same object structure* will be used for the import/export file (`vocab_progress.json`).

The state consists of three string arrays:
* **`current_pass_answered`**: An array of words (strings) that the user has answered in their *current* main quiz pass. This is used to calculate the "Continue Quiz" pool.
* **`cumulative_missed`**: An array of words (strings) that the user has *ever* missed. This list is only modified by (1) answering a word incorrectly in any quiz or (2) clearing words via the review quiz summary.
* **`review_pass_answered`**: An array of words (strings) that the user has answered (correctly or incorrectly) in their *current* "Review Missed Words" quiz pass.
* **`review_pass_correct`**: An array of words (string) that the user has answered CORRECTLY in their *current* "Review Missed Words" quiz pass.

**Example `vocab_progress.json` / `localStorage` value:**
```json
{
  "current_pass_answered": ["abase", "abbey"],
  "cumulative_missed": ["abase", "abbess"],
  "review_pass_answered": ["abase"]
  "review_pass_correct": ["abase"]
}
```

**Persistence Rule:** The entire state object must be saved to `localStorage` immediately after every user answer (at the same time the progress bars update).

## 4. Screen: Main Menu

This is the landing page of the app. It displays a vertical, centered list of large, full-width Angular Material buttons with rounded corners. The buttons displayed depend on the user's state.

### 4.1. Button Colors

* **Start/Continue Quiz:** Green
* **Review/Continue Missed Words:** Yellow
* **Import Progress:** Blue
* **Export Progress:** Gray

### 4.2. Button Visibility Logic

The menu will show a combination of the following buttons based on these conditions:

1.  **"Start Quiz" / "Continue Quiz" (Green)**
    * **"Start Quiz"** appears if `current_pass_answered` is empty.
    * **"Continue Quiz"** appears if a quiz is in progress (`current_pass_answered` is not empty).

2.  **"Review Missed Words" / "Continue Missed Words" (Yellow)**
    * This button *only* appears if `cumulative_missed` is *not* empty.
    * **"Review Missed Words"** appears if `review_pass_answered` is empty.
    * **"Continue Missed Words"** appears if `review_pass_answered` is *not* empty.

3.  **"Import Progress" (Blue)**
    * Always shown.

4.  **"Export Progress" (Gray)**
    * Only shown for returning users (i.e., if `localStorage` state is not empty).

## 5. Screen: Quiz Interface (Main & Review)

This screen is used for both the Main Quiz and the Review Quiz, with minor logic changes.

### 5.1. UI Layout

1.  **Top Bar (Green):** Angular Material Progress Bar.
    * Shows percentage and count (X/Y) of words completed in the *current pass*.
    * **Main Quiz:** Y = Total words in `words.json`.
    * **Review Quiz:** Y = Total words in `cumulative_missed` list.
2.  **Second Bar (Red):** Angular Material Progress Bar.
    * Shows number and percentage of words missed *so far in this session*.
3.  **Word Display:** The word to be quizzed (e.g., "**abase**") is shown in a large, bold font.
4.  **Answer Buttons:** Four large, full-width Angular Material buttons with rounded corners, positioned below the word.
    * One button contains the correct definition.
    * The other three buttons contain random definitions from *other* words in the *entire* `words.json` list.
    * The position of the correct answer (A, B, C, or D) must be randomized.
5.  **Feedback Controls (Bottom of Screen):** These are *hidden* until an answer is tapped.
    * A visual timer bar (Angular Material Progress Bar).
    * "Next" button (Angular Material Button).
    * "Pause" button (Angular Material Button).

### 5.2. Quiz Logic

* **Main "Start Quiz"**: Presents a randomized quiz from the *entire* `words.json` list.
* **Main "Continue Quiz"**: Presents a randomized quiz from the pool of words in `words.json` that are *not* in the `current_pass_answered` list.
* **Review "Review Missed Words"**: Presents a randomized quiz from the `cumulative_missed` list.
* **Review "Continue Missed Words"**: Presents a randomized quiz from the pool of words in `cumulative_missed` that are *not* in the `review_pass_answered` list.

### 5.3. Answer & Feedback Flow

1.  User taps one of the four definition buttons.
2.  **Instantly:**
    * The two progress bars at the top update.
    * The app state (`localStorage`) is saved.
    * If the answer is **correct**:
        * The tapped button turns **green**.
        * The `current_pass_answered` (or `review_pass_answered`) list is updated.
    * If the answer is **incorrect**:
        * The tapped button turns **red**.
        * The correct answer button simultaneously turns **green**.
        * The `current_pass_answered` (or `review_pass_answered`) list is updated.
        * The `cumulative_missed` list is updated with this word (if not already present).
3.  **Simultaneously**, the Feedback Controls appear at the bottom of the screen.
4.  A timer starts:
    * **1 second** for a correct answer.
    * **5 seconds** for an incorrect answer.
5.  If the user does nothing, the app auto-advances to the next word when the timer finishes.
6.  **User Controls:**
    * If user taps **"Next"**: Auto-advance timer stops, app advances immediately.
    * If user taps **"Pause"**: The timer bar and "Pause" button disappear. The screen is now frozen for review until the user taps "Next" to continue.

## 6. Screen: Summary Screen

This screen appears after the last word in a quiz pass (Main or Review) is answered.

### 6.1. Layout

* Vertically centered text displaying:
    * "Total Words: [Y]"
    * "Correct: [N]"
    * "Missed: [M]"
    * "Final Score: [P]%"
* Button(s) at the bottom of the screen.

### 6.2. Button Logic

The buttons shown depend on which quiz was just completed.

* **After Main Quiz:**
    * A single "Finish" button.
    * **Action:** Returns user to the Main Menu.
	
**Note:** The `current_pass_answered` list is cleared as soon as the last quiz question is answered (before the summary screen loads).

* **After Review Quiz (if 0 words correct):**
    * A single "Finish" button.
    * **Action:** Returns user to the Main Menu.

* **After Review Quiz (if > 0 words correct):**
    * Two buttons are shown:
        1.  "Clear Corrected Words"
        2.  "Leave List Unchanged"
    * **Action (Clear Corrected Words):** Removes the words the user got correct (`review_pass_correct` list) in this session* from the `cumulative_missed` list, then returns to the Main Menu. The 
    * **Action (Leave List Unchanged):** Returns to the Main Menu without modifying the `cumulative_missed` list.

**Note:** The `review_pass_answered` list is cleared as soon as the last review question is answered (before the summary screen loads). The `review_pass_correct` is cleared when either button is pressed, before returning to the main menu.

## 7. Features: Import / Export

### 7.1. Export Progress

1.  User taps "Export Progress" on the Main Menu.
2.  The browser immediately triggers a download of a file named `vocab_progress.json`.
3.  This file contains the JSON-stringified state object (e.g., `{ "current_pass_answered": [...], "cumulative_missed": [...], "review_pass_answered": [...], "review_pass_correct": [...] }`).

### 7.2. Import Progress

1.  User taps "Import Progress" on the Main Menu.
2.  The browser's standard file selection dialog opens (prompting for `.json` files).
3.  **On file selection:**
    * **Success:** If the file is a valid JSON structure matching the app's state, the app *overwrites* any existing `localStorage` data with the file's content. An Angular Material alert dialog (modal) appears confirming "Import Successful." Clicking "OK" dismisses the alert and returns the user to the Main Menu (which will now be updated to reflect the new state).
    * **Failure:** If the file is invalid, an alert dialog appears with an error message (e.g., "Invalid file format"). Clicking "OK" dismisses the alert and returns the user to the Main Menu.