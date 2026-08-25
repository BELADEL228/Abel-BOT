/**
 * Hangman Types (Pendu 🔤)
 */

export interface HangmanState {
  word: string;             // Mot secret en majuscules (ex: 'JAVASCRIPT')
  category: string;         // Catégorie (ex: 'Informatique', 'Animaux', 'Cinéma')
  guessedLetters: string[]; // Lettres déjà testées
  wrongGuessesCount: number;// Nombre d'erreurs (max 6)
  maxWrongGuesses: number;  // 6
  hint?: string;            // Indice optionnel
}

export interface HangmanAction {
  letterOrWord: string;     // Lettre unique ou mot complet proposé
}
