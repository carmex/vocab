# Product Functionality Documentation

**Last Updated:** December 2025
**Version:** 2.5 (Implied)
**Status:** Live / Active Development

---

## 1. Product Overview

**LexiQuest** (formerly "Online Vocabulary Study Tool") is a cloud-native, multi-platform vocabulary application designed to help students master word lists through interactive functionality. Unlike simple flashcard apps, it leverages **advanced speech technology** (Text-to-Speech and Speech-to-Text) to support sight reading and pronunciation, not just definition recall.

It supports user-created lists, a community marketplace for sharing lists, and real-time progress tracking across devices.

---

## 2. Core User Experience

### 2.1. Authentication & User Profile
*   **Accounts:** Users can sign up via Email/Password or Google Sign-In.
*   **Cloud Sync:** All progress, lists, and settings are synced to the cloud (Supabase), allowing users to switch devices seamlessly.
*   **Guest Mode:** (Limited support as per v2.0 spec; app primarily forces login for functionality).

### 2.2. Main Navigation
The application uses a clean, mobile-first interface with three primary sections:
1.  **Dashboard ("My Lists"):** The home screen showing the user's active study lists.
2.  **Marketplace:** A public library to discover and download lists created by others.
3.  **Settings:** Global configuration for audio, visuals, and difficulty.

---

## 3. Key Features: Content Management

### 3.1. Word Lists & Types
The core unit of content is a **Word List**, which can be one of three types:
1.  **Word / Definition:** The standard vocabulary list (Text -> Text).
2.  **Image / Definition:** Uses an image as the "Question" and text as the "Answer" (or vice versa depending on quiz mode).
3.  **Sight Words:** Special lists designed for reading/pronunciation practice, typically single words without definitions.

*   **Creation:** Users can create lists from scratch in English or Spanish.
*   **Import:** Supports bulk importing words via JSON files.
*   **Image Import (AI):** Users can upload a photo of a physical list (e.g., a homework sheet). The app uses **Google Gemini AI** to automatically transcribe the image into a structured list.
    *   *Sight Words Mode:* Extracts a simple comma-separated list of words.
    *   *Vocabulary Mode:* Intelligently parses word/definition pairs from the image.
*   **Editing:** Owners can add, edit, or delete words.

### 3.2. Marketplace
*   **Discovery:** Users can browse "Public" lists.
*   **Subscription:** Users can "Add" a public list to their Dashboard. This creates a link—updates to the original list (by the author) are reflected for subscribers.

### 3.3. Sharing
*   **Direct Sharing:** Users can generate a unique **Share Link** or **QR Code** for any list (Private or Public). This allows easy sharing via messaging apps or by allowing a friend to scan the code directly from your screen.
*   **Public Access:** Creators can toggle a list to "Public" to make it appear in the Marketplace for anyone to discover.

### 3.4. Multi-lingual Support
The platform currently supports two languages for speech recognition and pronunciation:
*   **English (US)**
*   **Spanish (ES)**
*   *Note:* The UI itself is currently English-only, but list content and speech services adapt to the selected list language.

---

## 4. Key Features: Study Modes

### 4.1. Standard Quiz (Multiple Choice)
The classic vocabulary testing mode.
*   **Flow:** Displays a word -> User selects the correct definition from 4 options (1 correct, 3 distractors selected randomly from the list).
*   **Adaptive Logic:**
*   **Adaptive Logic:**
    *   **Start Quiz:** Test on all words.
    *   **Continue Quiz:** Resume where you left off in the current "pass".
    *   **Review Missed:** This mode is triggered via a dedicated "Review" button on the Dashboard. It appears *only* when a user has accumulated incorrect answers for a list. It creates a personalized quiz consisting ONLY of words the user has missed previously.
*   **Feedback:** Instant color-coded feedback (Green/Red) with an auto-advance timer.

### 4.2. Sight Words Quiz (Interactive Speech)
A highly interactive mode designed for reading practice, leveraging the **Speech Service**.
*   **Mode 1: Read Mode (Speech-to-Text)**
    *   App displays a word (e.g., "Enough").
    *   User taps "Record" and says the word.
    *   App utilizes **Whisper AI** (or native browser speech) to verify pronunciation.
    *   *Fallback:* If microphone fails, users can self-report "I said it correctly."
*   **Mode 2: Listen Mode (Text-to-Speech)**
    *   App speaks a word.
    *   User selects the written word from a grid of options (1 correct, 3 distractors selected randomly from the list).

### 4.3. Progress & Analytics
*   **Session Tracking:** Instant feedback on correct/incorrect answers.
*   **Persistent "Missed Words":** Determining which words a user struggles with across *all* sessions.
*   **Mastery Tracking:** When a user completes a "Review Missed" session, they are presented with a Summary Screen.
    *   **Clear Corrected Words:** If the user answered missed words correctly during the review, clicking this button removes them from their "Missed" pile, effectively marking them as "Re-mastered."
    *   **Keep for Later:** Users can choose to keep the words in the missed list to practice them again later.

---

## 5. Technical Capabilities & "Secret Sauce"

### 5.1. Hybrid Speech Engine (`SpeechService`)
This is a standout feature that differentiates the product.
*   **Native Support:** Prioritizes the browser's built-in `SpeechRecognition` and `SpeechSynthesis` for zero-latency performance.
*   **AI Fallback (Whisper):** If the browser lacks speech support (e.g., Firefox Desktop), the app seamlessly loads a **Web Worker running OpenAI's Whisper model (Tiny)** locally in the browser. This ensures speech features work everywhere.
*   **Enhanced TTS:** Configuration to use high-quality neural voices (if enabled in settings).
*   **Fuzzy Matching:** The engine handles homophones (e.g., "here" vs "hear") and slight mispronunciations intelligently.

### 5.2. Settings Management
*   **Dark Mode:** A first-class, high-contrast dark theme (toggled in Settings).
*   **Audio Config:** Users can select preferred TTS voices and pronunciation speeds.
*   **Timers:** Adjustable auto-advance timers for faster/slower study sessions.
*   **Sync:** Application settings are saved to the cloud, so your "Dark Mode" preference follows you to your phone.

### 5.3. Layout Consistency
*   **Responsive Design:** Optimized for mobile, tablet, and desktop.
*   **Stable Navigation:** Header elements (Profile, Back buttons) are rigidly anchored to prevent layout shifts during navigation.

---

## 6. Current Project Structure
*   `src/app/components/`: UI Screens (Dashboard, Quiz, Editor, Marketplace).
*   `src/app/services/`: Core logic (Supabase, Speech, Settings, State).
*   `src/app/workers/`: AI models (Whisper, TTS) running in background threads.
*   `supabase/`: Database migrations and backend functions (RPCs).
