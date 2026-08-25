/**
 * Quiz Question Database — Banque de questions à choix multiples
 */

import { QuizQuestion } from './quiz.types.js';

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Quel langage est utilisé pour typer statiquement JavaScript ?',
    options: ['Python', 'TypeScript', 'PHP', 'Ruby'],
    correctOptionIndex: 1,
    explanation: 'TypeScript est un sur-ensemble typé de JavaScript développé par Microsoft.',
    category: 'Informatique',
    difficulty: 'FACILE'
  },
  {
    id: 2,
    question: 'Quelle est la planète la plus proche du Soleil ?',
    options: ['Vénus', 'Mars', 'Mercure', 'Jupiter'],
    correctOptionIndex: 2,
    explanation: 'Mercure est la planète la plus proche du Soleil dans notre système solaire.',
    category: 'Sciences',
    difficulty: 'FACILE'
  },
  {
    id: 3,
    question: 'En quelle année le premier iPhone est-il sorti ?',
    options: ['2005', '2007', '2009', '2010'],
    correctOptionIndex: 1,
    explanation: 'Steve Jobs a présenté le tout premier iPhone en janvier 2007.',
    category: 'Tech',
    difficulty: 'MOYEN'
  },
  {
    id: 4,
    question: 'Quelle est la capitale du Togo ?',
    options: ['Lomé', 'Accra', 'Cotonou', 'Ouagadougou'],
    correctOptionIndex: 0,
    explanation: 'Lomé est la capitale et la plus grande ville du Togo.',
    category: 'Géographie',
    difficulty: 'FACILE'
  },
  {
    id: 5,
    question: 'Qui a créé le protocole Git et le noyau Linux ?',
    options: ['Bill Gates', 'Linus Torvalds', 'Dennis Ritchie', 'Ken Thompson'],
    correctOptionIndex: 1,
    explanation: 'Linus Torvalds a créé Linux en 1991 et Git en 2005.',
    category: 'Informatique',
    difficulty: 'MOYEN'
  },
  {
    id: 6,
    question: 'Quel est le plus grand océan du monde ?',
    options: ['Océan Atlantique', 'Océan Indien', 'Océan Pacifique', 'Océan Arctique'],
    correctOptionIndex: 2,
    explanation: 'L\'océan Pacifique couvre environ un tiers de la surface de la Terre.',
    category: 'Géographie',
    difficulty: 'FACILE'
  },
  {
    id: 7,
    question: 'Quel élément chimique a pour symbole "Au" ?',
    options: ['Argent', 'Aluminium', 'Or', 'Azote'],
    correctOptionIndex: 2,
    explanation: 'Au vient du latin "Aurum", qui désigne l\'Or.',
    category: 'Sciences',
    difficulty: 'FACILE'
  },
  {
    id: 8,
    question: 'Quelle entreprise a développé le framework Angular ?',
    options: ['Facebook', 'Google', 'Amazon', 'Twitter'],
    correctOptionIndex: 1,
    explanation: 'Google maintient et développe le framework Angular.',
    category: 'Informatique',
    difficulty: 'FACILE'
  },
  {
    id: 9,
    question: 'Quel pays a remporté la Coupe du Monde de Football en 2018 ?',
    options: ['Brésil', 'Croatie', 'France', 'Allemagne'],
    correctOptionIndex: 2,
    explanation: 'La France a battu la Croatie 4-2 en finale de la Coupe du Monde 2018.',
    category: 'Sport',
    difficulty: 'FACILE'
  },
  {
    id: 10,
    question: 'Combien d\'octets y a-t-il dans un kilooctet (Ko) selon la norme binaire stricte (Kio) ?',
    options: ['1000', '1024', '1048', '512'],
    correctOptionIndex: 1,
    explanation: 'Un kibioctet (Kio) correspond exactement à 2^10 = 1024 octets.',
    category: 'Informatique',
    difficulty: 'MOYEN'
  }
];

export function getRandomQuestions(count: number = 5): QuizQuestion[] {
  const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
