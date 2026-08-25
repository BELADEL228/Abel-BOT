/**
 * Quiz Types (Trivia / Quiz Culture 🧠)
 */

export interface QuizQuestion {
  id: number;
  question: string;
  options: [string, string, string, string]; // A, B, C, D
  correctOptionIndex: number; // 0, 1, 2, 3
  explanation: string;
  category: string;
  difficulty?: 'FACILE' | 'MOYEN' | 'DIFFICILE';
}

export interface QuizState {
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  scores: Record<string, number>; // playerId -> score
  answeredThisTurn: Set<string>;  // playerIds having answered current question
  lastAnswerFeedback?: string;
  totalQuestions: number;
}

export interface QuizAction {
  optionChoice: number; // 0 (A), 1 (B), 2 (C), 3 (D)
}
