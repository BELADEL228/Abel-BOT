/**
 * Quiz Game (Trivia Culture & Tech 🧠)
 */

import { IGame } from '../../core/game.interface.js';
import { GamePlayer, GameResult, ActionValidationResult, GameView } from '../../core/types.js';
import { GameSession } from '../../core/game-session.js';
import { QuizState, QuizAction, QuizQuestion } from './quiz.types.js';
import { getRandomQuestions } from './questions.js';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_EMOJIS = ['🇦', '🇧', '🇨', '🇩'];

export class QuizGame implements IGame<QuizState, QuizAction> {
  public readonly id = 'quiz';
  public readonly name = 'Quiz Culture & Tech';
  public readonly aliases = ['quiz', 'trivia', 'culture'];
  public readonly description = 'Testez vos connaissances sur 5 questions et marquez le plus de points !';
  public readonly icon = '🧠';
  public readonly minPlayers = 1;
  public readonly maxPlayers = 6;
  public readonly isTurnBased = false; // Tout le monde peut répondre
  public readonly defaultTimeoutSeconds = 240; // 4 min

  public createInitialState(players: GamePlayer[], options?: Record<string, any>): QuizState {
    const questions = getRandomQuestions(5);
    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.id] = 0;
    }

    return {
      questions,
      currentQuestionIndex: 0,
      scores,
      answeredThisTurn: new Set<string>(),
      totalQuestions: questions.length
    };
  }

  public parseAction(rawText: string, state: QuizState, player: GamePlayer): QuizAction | null {
    const clean = rawText.replace(/^\.play\s+/i, '').replace(/^\.quiz\s+/i, '').trim().toUpperCase();

    if (clean === 'A' || clean === '1') return { optionChoice: 0 };
    if (clean === 'B' || clean === '2') return { optionChoice: 1 };
    if (clean === 'C' || clean === '3') return { optionChoice: 2 };
    if (clean === 'D' || clean === '4') return { optionChoice: 3 };

    return null;
  }

  public validateAction(state: QuizState, player: GamePlayer, action: QuizAction): ActionValidationResult {
    if (action.optionChoice < 0 || action.optionChoice > 3) {
      return { valid: false, reason: '❌ Répondez avec A, B, C ou D.' };
    }

    if (state.answeredThisTurn.has(player.id)) {
      return { valid: false, reason: '⚠️ Vous avez déjà répondu à cette question !' };
    }

    return { valid: true };
  }

  public applyAction(state: QuizState, player: GamePlayer, action: QuizAction): QuizState {
    const currentQ = state.questions[state.currentQuestionIndex];
    const isCorrect = action.optionChoice === currentQ.correctOptionIndex;

    const newScores = { ...state.scores };
    if (isCorrect) {
      newScores[player.id] = (newScores[player.id] || 0) + 1;
    }

    const newAnswered = new Set(state.answeredThisTurn);
    newAnswered.add(player.id);

    const letterChosen = OPTION_LETTERS[action.optionChoice];
    const correctLetter = OPTION_LETTERS[currentQ.correctOptionIndex];
    const correctText = currentQ.options[currentQ.correctOptionIndex];

    const feedback = isCorrect
      ? `✅ *Bravo ${player.name} !* Bonne réponse (${letterChosen} : ${correctText}).\n💡 _${currentQ.explanation}_`
      : `❌ *Dommage ${player.name} !* Mauvaise réponse (${letterChosen}).\n👉 La bonne réponse était *${correctLetter} : ${correctText}*.\n💡 _${currentQ.explanation}_`;

    // Passer à la question suivante
    const nextIndex = state.currentQuestionIndex + 1;

    return {
      ...state,
      scores: newScores,
      currentQuestionIndex: nextIndex,
      answeredThisTurn: new Set<string>(),
      lastAnswerFeedback: feedback
    };
  }

  public checkResult(state: QuizState, lastPlayer?: GamePlayer): GameResult {
    // Si toutes les questions ont été posées
    if (state.currentQuestionIndex >= state.totalQuestions) {
      // Trouver le joueur avec le score maximal
      let highestScore = -1;
      let winnerId = '';

      for (const [pId, score] of Object.entries(state.scores)) {
        if (score > highestScore) {
          highestScore = score;
          winnerId = pId;
        }
      }

      const winner = winnerId === lastPlayer?.id ? lastPlayer : undefined;

      return {
        type: 'WIN',
        winner,
        reason: `🏁 *FIN DU QUIZ !*\nScore final : *${highestScore}/${state.totalQuestions}* bonnes réponses.`
      };
    }

    return { type: 'IN_PROGRESS' };
  }

  public renderView(state: QuizState, session: GameSession, viewer?: GamePlayer): GameView {
    if (state.currentQuestionIndex >= state.totalQuestions) {
      // Écran de fin
      const scoreLines = session.players.map(p => {
        const sc = state.scores[p.id] || 0;
        return `• *${p.name}* : ${sc}/${state.totalQuestions} pts`;
      }).join('\n');

      return {
        title: '🧠 QUIZ CULTURE & TECH — FIN DE PARTIE',
        boardText: `📊 *TABLEAU DES SCORES :*\n${scoreLines}`,
        statusText: session.result?.reason || 'Quiz terminé !',
        mentions: session.players.map(p => p.id).filter(id => id.includes('@'))
      };
    }

    const q = state.questions[state.currentQuestionIndex];
    const qNum = state.currentQuestionIndex + 1;

    const optionsText = q.options
      .map((opt, idx) => `${OPTION_EMOJIS[idx]} *${OPTION_LETTERS[idx]}* — ${opt}`)
      .join('\n');

    let boardText =
      `📋 *QUESTION ${qNum}/${state.totalQuestions}* [ ${q.category} ]\n\n` +
      `❓ *${q.question}*\n\n` +
      `${optionsText}`;

    if (state.lastAnswerFeedback) {
      boardText = `${state.lastAnswerFeedback}\n\n━━━━━━━━━━━━━━━━━━━━\n\n` + boardText;
    }

    const currentScores = session.players.map(p => `${p.name}: ${state.scores[p.id] || 0} pt(s)`).join(' · ');

    return {
      title: `🧠 QUIZ CULTURE & TECH (${qNum}/${state.totalQuestions})`,
      subtitle: `Thème : ${q.category} · Difficulté : ${q.difficulty || 'MOYEN'}`,
      boardText,
      statusText: `📊 Scores : ${currentScores}`,
      instructionText: 'Répondez avec A, B, C ou D (ou 1, 2, 3, 4) !',
      mentions: session.players.map(p => p.id).filter(id => id.includes('@'))
    };
  }
}

export default QuizGame;
