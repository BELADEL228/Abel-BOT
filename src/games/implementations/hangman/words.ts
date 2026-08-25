/**
 * Hangman Word Database — Banque de mots français avec catégories et indices
 */

export interface HangmanWordEntry {
  word: string;
  category: string;
  hint: string;
}

export const HANGMAN_WORDS: HangmanWordEntry[] = [
  // Informatique & Tech
  { word: 'TYPESCRIPT', category: 'Informatique', hint: 'Langage typé superset de JavaScript' },
  { word: 'PYTHON', category: 'Informatique', hint: 'Langage très populaire pour l\'IA et les données' },
  { word: 'ALGORITHME', category: 'Informatique', hint: 'Suite finie d\'instructions pour résoudre un problème' },
  { word: 'SERVEUR', category: 'Informatique', hint: 'Machine exécutant des services réseau' },
  { word: 'DATABASE', category: 'Informatique', hint: 'Stockage structuré de données' },
  { word: 'TERMINAL', category: 'Informatique', hint: 'Interface en ligne de commande' },
  { word: 'NAVIGATEUR', category: 'Informatique', hint: 'Logiciel permettant de consulter le Web' },
  { word: 'FIREWALL', category: 'Informatique', hint: 'Système de protection et sécurité réseau' },
  { word: 'WHATSAPP', category: 'Informatique', hint: 'Application de messagerie instantanée' },
  { word: 'BLUETOOTH', category: 'Informatique', hint: 'Norme de communication sans fil courte distance' },

  // Animaux & Nature
  { word: 'CHIMPANZE', category: 'Animaux', hint: 'Grand singe très intelligent' },
  { word: 'CROCODILE', category: 'Animaux', hint: 'Grand reptile aquatique aux mâchoires puissantes' },
  { word: 'CAMELEON', category: 'Animaux', hint: 'Reptile capable de changer de couleur' },
  { word: 'GIRAFE', category: 'Animaux', hint: 'Animal terrestre avec le plus long cou' },
  { word: 'DAUPHIN', category: 'Animaux', hint: 'Mammifère marin réputé pour sa sociabilité' },
  { word: 'ORNITHORYNQUE', category: 'Animaux', hint: 'Mammifère semi-aquatique qui pond des œufs' },
  { word: 'GUEPARD', category: 'Animaux', hint: 'L\'animal terrestre le plus rapide du monde' },

  // Géographie & Pays
  { word: 'MADAGASCAR', category: 'Géographie', hint: 'Grande île au large de l\'Afrique australe' },
  { word: 'AUSTRALIE', category: 'Géographie', hint: 'Pays et continent des kangourous' },
  { word: 'PORTUGAL', category: 'Géographie', hint: 'Pays d\'Europe de l\'Ouest sur la péninsule ibérique' },
  { word: 'BRESIL', category: 'Géographie', hint: 'Le plus grand pays d\'Amérique du Sud' },
  { word: 'ARGENTINE', category: 'Géographie', hint: 'Pays du tango et des Andes' },
  { word: 'KILIMANDJARO', category: 'Géographie', hint: 'Le plus haut sommet d\'Afrique' },

  // Cinéma & Culture
  { word: 'GLADIATEUR', category: 'Cinéma', hint: 'Combattant dans les arènes de la Rome antique' },
  { word: 'HOLLYWOOD', category: 'Cinéma', hint: 'Le quartier emblématique de l\'industrie cinématographique' },
  { word: 'AVENGERS', category: 'Cinéma', hint: 'Équipe de super-héros Marvel' },
  { word: 'INTERSTELLAR', category: 'Cinéma', hint: 'Film de science-fiction sur les voyages spatiaux et les trous noirs' },
  { word: 'ASTRONAUTE', category: 'Espace', hint: 'Voyageur des étoiles et des stations spatiales' }
];

export function getRandomWord(): HangmanWordEntry {
  const idx = Math.floor(Math.random() * HANGMAN_WORDS.length);
  return HANGMAN_WORDS[idx];
}
