import { Word } from "./word.interface";

export interface QuizQuestion {
  wordToQuiz: Word;
  options: string[]; // Just the definition strings
  correctAnswer: string; // The correct definition string
}