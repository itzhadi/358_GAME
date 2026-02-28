// ============================================================
// 3-5-8 Card Game – Core Types
// ============================================================

/** Card suits */
export type Suit = 'S' | 'H' | 'D' | 'C'; // Spades, Hearts, Diamonds, Clubs
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_NAMES: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAMES_HE: Record<Suit, string> = { S: 'עלה', H: 'לב', D: 'יהלום', C: 'תלתן' };

/** Card ranks – 2 lowest, A highest */
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/** A single card */
export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // e.g. "S-A" for Ace of Spades
}

/** Game mode */
export type GameMode = 'local' | 'online';

/** Game phase */
export type GamePhase =
  | 'SETUP_DEAL'
  | 'RESHUFFLE_WINDOW'
  | 'EXCHANGE_GIVE'
  | 'EXCHANGE_RETURN'
  | 'CUTTER_PICK'
  | 'DEALER_DISCARD'
  | 'KUPA_TAKE'
  | 'TRICK_PLAY'
  | 'HAND_SCORING'
  | 'GAME_OVER';

/** The 3-5-8 targets indexed by seat relative to dealer */
export const TARGETS = [8, 5, 3] as const;
// Index 0 = dealer (8), Index 1 = left of dealer (5), Index 2 = right of dealer (3)

/** Player info */
export interface Player {
  id: string;
  name: string;
  seatIndex: number; // 0, 1, 2 (clockwise)
}

/** Per-hand player state */
export interface PlayerHandState {
  hand: Card[];
  target: number; // 3, 5, or 8
  tricksTaken: number;
  isDealerThisHand: boolean;
}

/** A trick in progress */
export interface TrickCurrent {
  leaderIndex: number; // seat index of the trick leader
  leadSuit: Suit | null;
  cardsPlayed: { seatIndex: number; card: Card }[];
}

/** A completed trick */
export interface TrickResult {
  trickNumber: number;
  cardsPlayed: { seatIndex: number; card: Card }[];
  leadSuit: Suit;
  winnerIndex: number;
}

/** Exchange phase tracking */
export interface ExchangeInfo {
  /** Which player gives to which, and how many cards */
  givings: ExchangeGiving[];
  /** Cards given so far (face down) */
  givenCards: ExchangeTransfer[];
  /** Cards returned so far */
  returnedCards: ExchangeTransfer[];
  /** Current giver index (in givings order) */
  currentGiverIdx: number;
  /** Whether we're in give phase or return phase */
  subPhase: 'giving' | 'returning';
}

export interface ExchangeGiving {
  fromSeat: number; // seat of the "+" player
  toSeat: number; // seat of the "-" player
  count: number; // how many cards to give
}

export interface ExchangeTransfer {
  fromSeat: number;
  toSeat: number;
  card: Card;
}

/** Full game state (immutable – each action returns a new state) */
export interface GameState {
  // --- Meta ---
  gameId: string;
  mode: GameMode;
  victoryTarget: number; // default 10

  // --- Players ---
  players: Player[];

  // --- Hand tracking ---
  handNumber: number; // starts at 1
  dealerIndex: number; // seat index of current dealer

  // --- Card distribution ---
  deck: Card[]; // current shuffled deck (before deal)
  kupa: Card[]; // the 4 "קופה" cards
  playerHands: Card[][]; // playerHands[seatIndex]
  dealerDiscarded: Card[]; // 4 cards dealer discarded
  dealerReceivedKupa: Card[]; // 4 kupa cards dealer received after discarding
  dealerHiddenReturns: Card[]; // cards returned to dealer during exchange, hidden until after cutter pick
  dealerPendingReceived: Card[]; // cards given TO dealer during exchange, hidden until after cutter pick

  // --- Cutter ("חותך") ---
  cutterSuit: Suit | null;

  // --- Exchange ---
  exchangeInfo: ExchangeInfo | null;

  // --- Trick play ---
  currentTrick: TrickCurrent | null;
  trickNumber: number; // 1-16 within a hand
  tricksHistory: TrickResult[];
  tricksTakenCount: number[]; // [seat0, seat1, seat2]

  // --- Scoring ---
  scoreTotal: number[]; // cumulative score per seat [seat0, seat1, seat2]
  lastHandDelta: number[]; // delta from last completed hand per seat
  targets: number[]; // targets for current hand per seat [seat0, seat1, seat2]

  // --- Phase ---
  phase: GamePhase;

  // --- Turn ---
  currentPlayerIndex: number; // whose turn it is

  // --- Winner ---
  winnerIndex: number | null;
  winnerReason: string | null;

  // --- Hand history for export ---
  handHistory: HandRecord[];

  // --- Reshuffle (per hand) ---
  reshuffleUsedBy8: boolean;
  reshuffleUsedBy35: boolean;
  reshuffleWindowFor8: boolean;
  reshuffleWindowFor35: boolean;
}

/** Record of a completed hand for history/export */
export interface HandRecord {
  handNumber: number;
  dealerIndex: number;
  cutterSuit: Suit;
  tricksTaken: number[]; // per seat
  targets: number[]; // per seat
  deltas: number[]; // per seat
  tricks: TrickResult[];
}

// ============================================================
// Actions
// ============================================================

export type GameAction =
  | { type: 'CREATE_GAME'; payload: CreateGamePayload }
  | { type: 'SHUFFLE_DEAL' }
  | { type: 'RESHUFFLE_ACCEPT'; payload: { side: '8' | '35' } }
  | { type: 'RESHUFFLE_DECLINE'; payload: { side: '8' | '35' } }
  | { type: 'EXCHANGE_GIVE_CARD'; payload: { fromSeat: number; cardId: string } }
  | { type: 'EXCHANGE_RETURN_CARD'; payload: { fromSeat: number; cardId: string } }
  | { type: 'PICK_CUTTER'; payload: { suit: Suit } }
  | { type: 'DEALER_DISCARD_4'; payload: { cardIds: string[] } }
  | { type: 'PLAY_CARD'; payload: { seatIndex: number; cardId: string } }
  | { type: 'NEXT_HAND' };

export interface CreateGamePayload {
  gameId: string;
  mode: GameMode;
  players: { id: string; name: string }[];
  victoryTarget?: number;
  dealerIndex?: number; // random if not provided
  seed?: number; // for deterministic testing
}
