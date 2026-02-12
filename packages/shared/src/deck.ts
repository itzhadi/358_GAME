import { Card, Rank, RANKS, Suit, SUITS } from './types';

/**
 * Create a standard 52-card deck.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 * Optionally accepts a seeded random function for deterministic testing.
 */
export function shuffleDeck(deck: Card[], randomFn?: () => number): Card[] {
  const rng = randomFn ?? Math.random;
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deal cards: 16 per player (3 players) + 4 kupa.
 * Returns { hands: [16, 16, 16], kupa: [4] }
 */
export function dealCards(shuffledDeck: Card[]): {
  hands: [Card[], Card[], Card[]];
  kupa: Card[];
} {
  if (shuffledDeck.length !== 52) {
    throw new Error(`Deck must have 52 cards, got ${shuffledDeck.length}`);
  }
  const hands: [Card[], Card[], Card[]] = [[], [], []];
  // Deal 16 cards to each player
  for (let i = 0; i < 48; i++) {
    hands[i % 3].push(shuffledDeck[i]);
  }
  const kupa = shuffledDeck.slice(48, 52);
  return { hands, kupa };
}

/**
 * Simple seeded random number generator (mulberry32).
 * Returns a function () => number in [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sort a hand by suit then rank for display.
 */
export function sortHand(hand: Card[], cutterSuit?: Suit | null): Card[] {
  const suitOrder: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };
  // If cutter is set, put it first
  if (cutterSuit) {
    suitOrder[cutterSuit] = -1;
  }
  const rankOrder: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  return [...hand].sort((a, b) => {
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;
    return rankOrder[b.rank] - rankOrder[a.rank]; // descending rank
  });
}
