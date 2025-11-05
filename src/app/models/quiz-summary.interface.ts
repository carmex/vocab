export interface QuizSummary {
  total: number;
  correct: number;
  missed: number;
  score: number;
  quizMode: 'main' | 'review';
}