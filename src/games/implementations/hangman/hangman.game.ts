/**
 * Hangman Game (Pendu 🔤)
 */

import { IGame } from '../../core/game.interface.js';
import { GamePlayer, GameResult, ActionValidationResult, GameView } from '../../core/types.js';
import { GameSession } from '../../core/game-session.js';
import { HangmanState, HangmanAction } from './hangman.types.js';
import { getRandomWord } from './words.js';

const GALLOWS_STAGES = [
  `  ┌───┐\n  │   \n  │   \n  │   \n  ┴──────`,
  `  ┌───┐\n  │   😵\n  │   \n  │   \n  ┴──────`,
  `  ┌───┐\n  │   😵\n  │   │ \n  │   \n  ┴──────`,
  `  ┌───┐\n  │   😵\n  │  /│ \n  │   \n  ┴──────`,
  `  ┌───┐\n  │   😵\n  │  /│\\\n  │   \n  ┴──────`,
  `  ┌───┐\n  │   😵\n  │  /│\\\n  │  / \n  ┴──────`,
  `  ┌───┐\n  │   💀\n  │  /│\\\n  │  / \\\n  ┴────── (Pendu !)`
];

export class HangmanGame implements IGame<HangmanState, HangmanAction> {
  public readonly id = 'hangman';
  public readonly name = 'Le Pendu (Hangman)';
  public readonly aliases = ['pendu', 'hangman', 'mot'];
  public readonly description = 'Devinez le mot secret lettre par lettre avant d\'être pendu !';
  public readonly icon = '🔤';
  public readonly minPlayers = 1;
  public readonly maxPlayers = 4; // Solo ou coopératif
  public readonly isTurnBased = false; // Tout le monde peut proposer une lettre
  public readonly defaultTimeoutSeconds = 240; // 4 min

  public createInitialState(players: GamePlayer[], options?: Record<string, any>): HangmanState {
    const entry = getRandomWord();
    return {
      word: entry.word.toUpperCase(),
      category: entry.category,
      hint: entry.hint,
      guessedLetters: [],
      wrongGuessesCount: 0,
      maxWrongGuesses: 6
    };
  }

  public parseAction(rawText: string, state: HangmanState, player: GamePlayer): HangmanAction | null {
    const clean = rawText.replace(/^\.play\s+/i, '').replace(/^\.pendu\s+/i, '').trim().toUpperCase();
    if (!clean || !/^[A-ZÀ-ÿ]+$/.test(clean)) return null;

    // Normaliser les accents (ex: É -> E)
    const normalized = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return { letterOrWord: normalized };
  }

  public validateAction(state: HangmanState, player: GamePlayer, action: HangmanAction): ActionValidationResult {
    const input = action.letterOrWord;

    if (input.length === 1) {
      if (state.guessedLetters.includes(input)) {
        return { valid: false, reason: `⚠️ La lettre *${input}* a déjà été proposée !` };
      }
    }

    return { valid: true };
  }

  public applyAction(state: HangmanState, player: GamePlayer, action: HangmanAction): HangmanState {
    const input = action.letterOrWord;
    const newGuessed = [...state.guessedLetters];
    let newWrong = state.wrongGuessesCount;

    if (input.length === 1) {
      newGuessed.push(input);
      if (!state.word.includes(input)) {
        newWrong++;
      }
    } else {
      // Proposition du mot complet
      if (input === state.word) {
        // Ajouter toutes les lettres du mot aux lettres trouvées
        for (const ch of state.word) {
          if (!newGuessed.includes(ch)) newGuessed.push(ch);
        }
      } else {
        newWrong++;
      }
    }

    return {
      ...state,
      guessedLetters: newGuessed,
      wrongGuessesCount: newWrong
    };
  }

  public checkResult(state: HangmanState, lastPlayer?: GamePlayer): GameResult {
    // Vérifier si toutes les lettres du mot ont été découvertes
    const isWordGuessed = state.word.split('').every(ch => state.guessedLetters.includes(ch));
    if (isWordGuessed) {
      return {
        type: 'WIN',
        winner: lastPlayer,
        reason: `🎉 VICTOIRE ! Le mot était bien *${state.word}* ! Bravo à *${lastPlayer?.name || 'l\'équipe'}* !`
      };
    }

    // Vérifier si le nombre maximal d'erreurs est atteint
    if (state.wrongGuessesCount >= state.maxWrongGuesses) {
      return {
        type: 'WIN', // Game over, les joueurs ont perdu
        reason: `💀 PENDU ! Le mot secret était : *${state.word}*.\n💡 Indice : _${state.hint}_`
      };
    }

    return { type: 'IN_PROGRESS' };
  }

  public renderView(state: HangmanState, session: GameSession, viewer?: GamePlayer): GameView {
    // Affichage du mot masqué
    const maskedWord = state.word
      .split('')
      .map(ch => state.guessedLetters.includes(ch) ? `*${ch}*` : '＿')
      .join(' ');

    const gallows = GALLOWS_STAGES[Math.min(state.wrongGuessesCount, GALLOWS_STAGES.length - 1)];
    const testedStr = state.guessedLetters.length > 0
      ? state.guessedLetters.join(', ')
      : 'Aucune';

    const remainingErrors = state.maxWrongGuesses - state.wrongGuessesCount;

    const boardText =
      `\`\`\`\n${gallows}\n\`\`\`\n` +
      `🔤 *Mot à deviner :*\n${maskedWord}\n\n` +
      `📁 *Thème :* ${state.category}\n` +
      `💡 *Indice :* _${state.hint || 'Aucun'}_`;

    let statusText = '';
    if (session.result) {
      statusText = session.result.reason || 'Partie terminée.';
    } else {
      statusText =
        `❤️ *Erreurs restantes :* ${remainingErrors}/${state.maxWrongGuesses}\n` +
        `📝 *Lettres testées :* [ ${testedStr} ]`;
    }

    return {
      title: '🔤 JEU DU PENDU (HANGMAN)',
      subtitle: `Thème : ${state.category}`,
      boardText,
      statusText,
      instructionText: session.status === 'IN_PROGRESS' ? 'Envoyez une lettre (ex: A) ou le mot entier pour tenter votre chance !' : undefined,
      mentions: session.players.map(p => p.id).filter(id => id.includes('@'))
    };
  }
}

export default HangmanGame;
