import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame, gameReducer, getPlayerView,
} from './engine';
import {
  createDeck, shuffleDeck, dealCards, seededRandom, sortHand,
} from './deck';
import {
  getTargetsForHand, getTarget5Seat, getLegalCards,
  determineTrickWinner, calculateExchangeGivings,
  getRequiredReturnCard, isLegalPlay, calculateHandDelta,
  checkVictory, applyTieBreaker, nextDealer,
} from './rules';
import {
  Card, Suit, Rank, GameState, RANK_VALUE, TrickCurrent,
} from './types';

// ============================================================
// Helpers
// ============================================================

function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, id: `${suit}-${rank}` };
}

function makeBasicGame(dealerIndex = 0): GameState {
  return createGame({
    gameId: 'test-game',
    mode: 'local',
    players: [
      { id: 'p0', name: 'Alice' },
      { id: 'p1', name: 'Bob' },
      { id: 'p2', name: 'Charlie' },
    ],
    victoryTarget: 10,
    dealerIndex,
  });
}

function skipReshuffle(s: GameState): GameState {
  if (s.phase !== 'RESHUFFLE_WINDOW') return s;
  if (!s.reshuffleUsedBy8 && s.reshuffleWindowFor8) {
    s = gameReducer(s, { type: 'RESHUFFLE_DECLINE', payload: { side: '8' } });
  }
  if (s.phase === 'RESHUFFLE_WINDOW' && !s.reshuffleUsedBy35 && s.reshuffleWindowFor35) {
    s = gameReducer(s, { type: 'RESHUFFLE_DECLINE', payload: { side: '35' } });
  }
  return s;
}

// ============================================================
// Deck Tests
// ============================================================

describe('Deck', () => {
  it('should create a 52-card deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it('should shuffle deterministically with seed', () => {
    const deck1 = shuffleDeck(createDeck(), seededRandom(42));
    const deck2 = shuffleDeck(createDeck(), seededRandom(42));
    expect(deck1.map((c) => c.id)).toEqual(deck2.map((c) => c.id));
  });

  it('should shuffle differently with different seeds', () => {
    const deck1 = shuffleDeck(createDeck(), seededRandom(42));
    const deck2 = shuffleDeck(createDeck(), seededRandom(99));
    expect(deck1.map((c) => c.id)).not.toEqual(deck2.map((c) => c.id));
  });

  it('should deal 16/16/16 + kupa 4', () => {
    const deck = shuffleDeck(createDeck(), seededRandom(1));
    const { hands, kupa } = dealCards(deck);
    expect(hands[0]).toHaveLength(16);
    expect(hands[1]).toHaveLength(16);
    expect(hands[2]).toHaveLength(16);
    expect(kupa).toHaveLength(4);

    // All 52 cards accounted for
    const allCards = [...hands[0], ...hands[1], ...hands[2], ...kupa];
    expect(allCards).toHaveLength(52);
    const ids = new Set(allCards.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it('should throw if deck is not 52 cards', () => {
    expect(() => dealCards([])).toThrow();
    expect(() => dealCards(createDeck().slice(0, 10))).toThrow();
  });

  it('should sort hand by suit then rank descending', () => {
    const hand = [
      makeCard('H', '3'),
      makeCard('S', 'A'),
      makeCard('H', 'K'),
      makeCard('S', '2'),
      makeCard('D', '10'),
    ];
    const sorted = sortHand(hand);
    expect(sorted.map((c) => c.id)).toEqual([
      'S-A', 'S-2', 'H-K', 'H-3', 'D-10',
    ]);
  });

  it('should put cutter suit first when sorting', () => {
    const hand = [
      makeCard('H', '3'),
      makeCard('S', 'A'),
      makeCard('D', 'K'),
    ];
    const sorted = sortHand(hand, 'D');
    expect(sorted[0].suit).toBe('D');
  });
});

// ============================================================
// Rules Tests
// ============================================================

describe('Rules', () => {
  describe('getTargetsForHand', () => {
    it('dealer=0: targets [8,5,3]', () => {
      expect(getTargetsForHand(0)).toEqual([8, 5, 3]);
    });

    it('dealer=1: targets [3,8,5]', () => {
      expect(getTargetsForHand(1)).toEqual([3, 8, 5]);
    });

    it('dealer=2: targets [5,3,8]', () => {
      expect(getTargetsForHand(2)).toEqual([5, 3, 8]);
    });
  });

  describe('getTarget5Seat (first trick leader)', () => {
    it('dealer=0 → seat 1 starts', () => {
      expect(getTarget5Seat(0)).toBe(1);
    });

    it('dealer=1 → seat 2 starts', () => {
      expect(getTarget5Seat(1)).toBe(2);
    });

    it('dealer=2 → seat 0 starts', () => {
      expect(getTarget5Seat(2)).toBe(0);
    });
  });

  describe('getLegalCards (must-follow-suit)', () => {
    const hand = [
      makeCard('S', 'A'),
      makeCard('S', '5'),
      makeCard('H', 'K'),
      makeCard('D', '3'),
    ];

    it('leader can play anything (null lead suit)', () => {
      const legal = getLegalCards(hand, null);
      expect(legal).toHaveLength(4);
    });

    it('must follow suit if has cards in suit', () => {
      const legal = getLegalCards(hand, 'S');
      expect(legal).toHaveLength(2);
      expect(legal.every((c) => c.suit === 'S')).toBe(true);
    });

    it('can play anything if no cards in lead suit', () => {
      const legal = getLegalCards(hand, 'C');
      expect(legal).toHaveLength(4);
    });
  });

  describe('determineTrickWinner', () => {
    it('highest in lead suit wins (no cutter)', () => {
      const trick: TrickCurrent = {
        leaderIndex: 0,
        leadSuit: 'S',
        cardsPlayed: [
          { seatIndex: 0, card: makeCard('S', '10') },
          { seatIndex: 1, card: makeCard('S', 'K') },
          { seatIndex: 2, card: makeCard('H', 'A') }, // off-suit, doesn't count
        ],
      };
      expect(determineTrickWinner(trick, null)).toBe(1);
    });

    it('cutter beats lead suit', () => {
      const trick: TrickCurrent = {
        leaderIndex: 0,
        leadSuit: 'S',
        cardsPlayed: [
          { seatIndex: 0, card: makeCard('S', 'A') },
          { seatIndex: 1, card: makeCard('H', '2') }, // cutter!
          { seatIndex: 2, card: makeCard('S', 'K') },
        ],
      };
      expect(determineTrickWinner(trick, 'H')).toBe(1);
    });

    it('highest cutter wins when multiple cutters', () => {
      const trick: TrickCurrent = {
        leaderIndex: 0,
        leadSuit: 'S',
        cardsPlayed: [
          { seatIndex: 0, card: makeCard('S', 'A') },
          { seatIndex: 1, card: makeCard('H', '5') },
          { seatIndex: 2, card: makeCard('H', 'K') },
        ],
      };
      expect(determineTrickWinner(trick, 'H')).toBe(2);
    });

    it('lead suit card beats off-suit non-cutter', () => {
      const trick: TrickCurrent = {
        leaderIndex: 0,
        leadSuit: 'D',
        cardsPlayed: [
          { seatIndex: 0, card: makeCard('D', '3') },
          { seatIndex: 1, card: makeCard('C', 'A') }, // off-suit
          { seatIndex: 2, card: makeCard('S', 'A') }, // off-suit
        ],
      };
      expect(determineTrickWinner(trick, null)).toBe(0);
    });
  });

  describe('calculateExchangeGivings', () => {
    it('one +, one -, one 0', () => {
      // Player 0: +2, Player 1: 0, Player 2: -2
      const givings = calculateExchangeGivings([2, 0, -2], [8, 5, 3]);
      expect(givings).toHaveLength(1);
      expect(givings[0].fromSeat).toBe(0);
      expect(givings[0].toSeat).toBe(2);
      expect(givings[0].count).toBe(2);
    });

    it('two + players, one - player', () => {
      // Player 0: +1, Player 1: +1, Player 2: -2
      const givings = calculateExchangeGivings([1, 1, -2], [8, 5, 3]);
      expect(givings).toHaveLength(2);
      // Higher target first: seat 0 (target 8) then seat 1 (target 5)
      expect(givings[0].fromSeat).toBe(0);
      expect(givings[0].count).toBe(1);
      expect(givings[1].fromSeat).toBe(1);
      expect(givings[1].count).toBe(1);
    });

    it('returns empty when all deltas are 0', () => {
      const givings = calculateExchangeGivings([0, 0, 0], [8, 5, 3]);
      expect(givings).toHaveLength(0);
    });
  });

  describe('getRequiredReturnCard', () => {
    it('returns highest in same suit if available', () => {
      const hand = [
        makeCard('S', 'K'),
        makeCard('S', '5'),
        makeCard('H', 'A'),
      ];
      const received = makeCard('S', '3');
      const result = getRequiredReturnCard(hand, received);
      expect(result.id).toBe('S-K');
    });

    it('returns received card if no higher in suit', () => {
      const hand = [
        makeCard('S', '2'),
        makeCard('H', 'A'),
        makeCard('S', '3'), // this is the received card in hand now
      ];
      const received = makeCard('S', '3');
      const result = getRequiredReturnCard(hand, received);
      // S-2 is lower than S-3, so no higher card → return received
      expect(result.id).toBe('S-3');
    });

    it('returns received card if no cards in that suit at all', () => {
      const hand = [
        makeCard('H', 'A'),
        makeCard('D', 'K'),
        makeCard('S', '7'), // the received card
      ];
      const received = makeCard('S', '7');
      // Only S-7 in spades, no higher → return received
      // Wait, S-7 IS the received card, no other spades
      // Actually hand contains S-7 which IS the received card
      // getRequiredReturnCard checks for cards higher than received
      // S-7 is the only spade and it's the received card itself
      const result = getRequiredReturnCard(hand, received);
      expect(result.id).toBe('S-7');
    });
  });

  describe('isLegalPlay', () => {
    const hand = [
      makeCard('S', 'A'),
      makeCard('S', '5'),
      makeCard('H', 'K'),
    ];

    it('allows any card when leading', () => {
      expect(isLegalPlay(hand, 'H-K', null)).toBe(true);
    });

    it('allows following suit', () => {
      expect(isLegalPlay(hand, 'S-A', 'S')).toBe(true);
    });

    it('blocks off-suit when suit available', () => {
      expect(isLegalPlay(hand, 'H-K', 'S')).toBe(false);
    });

    it('allows any card when void in lead suit', () => {
      expect(isLegalPlay(hand, 'S-A', 'D')).toBe(true);
    });
  });

  describe('calculateHandDelta', () => {
    it('positive when over target', () => {
      expect(calculateHandDelta(7, 5)).toBe(2);
    });

    it('negative when under target', () => {
      expect(calculateHandDelta(6, 8)).toBe(-2);
    });

    it('zero when exactly target', () => {
      expect(calculateHandDelta(5, 5)).toBe(0);
    });
  });

  describe('checkVictory', () => {
    it('returns winner when score >= target', () => {
      expect(checkVictory([10, 5, 3], 10)).toEqual([0]);
    });

    it('returns multiple when tied at top', () => {
      expect(checkVictory([10, 10, 3], 10)).toEqual([0, 1]);
    });

    it('returns empty when no one qualifies', () => {
      expect(checkVictory([9, 8, 3], 10)).toEqual([]);
    });

    it('returns highest scorer even if multiple above target', () => {
      expect(checkVictory([12, 10, 3], 10)).toEqual([0]);
    });
  });

  describe('applyTieBreaker', () => {
    it('single player: wins outright', () => {
      const result = applyTieBreaker([0], [3, -1, -2], []);
      expect(result.winnerSeat).toBe(0);
    });

    it('tie: higher last hand delta wins', () => {
      const result = applyTieBreaker(
        [0, 1],
        [3, 1, -4], // seat 0 had +3, seat 1 had +1
        [],
      );
      expect(result.winnerSeat).toBe(0);
    });

    it('tie with same delta: latest trick winner wins', () => {
      const tricks = [
        { trickNumber: 15, winnerIndex: 0 },
        { trickNumber: 16, winnerIndex: 1 },
      ];
      const result = applyTieBreaker([0, 1], [2, 2, -4], tricks);
      expect(result.winnerSeat).toBe(1); // took trick 16
    });

    it('three-way tie: trick 16 winner wins', () => {
      const tricks = [
        { trickNumber: 14, winnerIndex: 2 },
        { trickNumber: 15, winnerIndex: 0 },
        { trickNumber: 16, winnerIndex: 1 },
      ];
      const result = applyTieBreaker([0, 1, 2], [0, 0, 0], tricks);
      expect(result.winnerSeat).toBe(1);
    });
  });

  describe('nextDealer', () => {
    it('rotates clockwise', () => {
      expect(nextDealer(0)).toBe(1);
      expect(nextDealer(1)).toBe(2);
      expect(nextDealer(2)).toBe(0);
    });
  });
});

// ============================================================
// Engine Integration Tests
// ============================================================

describe('Game Engine', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeBasicGame(0);
  });

  it('should create game with correct initial state', () => {
    expect(state.players).toHaveLength(3);
    expect(state.phase).toBe('SETUP_DEAL');
    expect(state.handNumber).toBe(0);
    expect(state.dealerIndex).toBe(0);
    expect(state.targets).toEqual([8, 5, 3]);
    expect(state.victoryTarget).toBe(10);
    expect(state.scoreTotal).toEqual([0, 0, 0]);
  });

  it('should deal cards correctly', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    expect(state.handNumber).toBe(1);
    expect(state.playerHands[0]).toHaveLength(16);
    expect(state.playerHands[1]).toHaveLength(16);
    expect(state.playerHands[2]).toHaveLength(16);
    expect(state.kupa).toHaveLength(4);
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    state = skipReshuffle(state);
    expect(state.phase).toBe('CUTTER_PICK');
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('should not allow dealing in wrong phase', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    expect(() => gameReducer(state, { type: 'SHUFFLE_DEAL' })).toThrow();
  });

  it('should pick cutter suit', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = skipReshuffle(state);
    state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'H' } });
    expect(state.cutterSuit).toBe('H');
    expect(state.phase).toBe('DEALER_DISCARD');
  });

  it('should handle dealer discard + kupa', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = skipReshuffle(state);
    state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'H' } });

    // Dealer discards 4 cards
    const dealerHand = state.playerHands[0];
    const toDiscard = dealerHand.slice(0, 4).map((c) => c.id);
    state = gameReducer(state, { type: 'DEALER_DISCARD_4', payload: { cardIds: toDiscard } });

    // Dealer should still have 16 cards (16 - 4 + 4 from kupa)
    expect(state.playerHands[0]).toHaveLength(16);
    expect(state.kupa).toHaveLength(0);
    expect(state.dealerDiscarded).toHaveLength(4);
    expect(state.phase).toBe('TRICK_PLAY');
    // First trick leader is target-5 player (seat 1)
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('should reject discard of wrong number of cards', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = skipReshuffle(state);
    state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'H' } });
    const dealerHand = state.playerHands[0];
    expect(() =>
      gameReducer(state, {
        type: 'DEALER_DISCARD_4',
        payload: { cardIds: dealerHand.slice(0, 3).map((c) => c.id) },
      }),
    ).toThrow('Must discard exactly 4 cards');
  });

  describe('Full hand play-through', () => {
    it('should play 16 tricks and score correctly', () => {
      state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
      state = skipReshuffle(state);
      state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'S' } });
      // Discard 4
      const toDiscard = state.playerHands[0].slice(0, 4).map((c) => c.id);
      state = gameReducer(state, { type: 'DEALER_DISCARD_4', payload: { cardIds: toDiscard } });

      expect(state.phase).toBe('TRICK_PLAY');
      expect(state.trickNumber).toBe(1);

      // Play all 16 tricks
      for (let trick = 0; trick < 16; trick++) {
        for (let card = 0; card < 3; card++) {
          const seat = state.currentPlayerIndex;
          const hand = state.playerHands[seat];
          const leadSuit = state.currentTrick?.leadSuit ?? null;
          const legal = getLegalCards(hand, leadSuit);
          expect(legal.length).toBeGreaterThan(0);

          state = gameReducer(state, {
            type: 'PLAY_CARD',
            payload: { seatIndex: seat, cardId: legal[0].id },
          });
        }
      }

      // After 16 tricks
      expect(state.phase).toBe('HAND_SCORING');
      // Tricks taken should sum to 16
      const totalTricks = state.tricksTakenCount.reduce((a, b) => a + b, 0);
      expect(totalTricks).toBe(16);
      // Deltas should sum to 0
      const totalDelta = state.lastHandDelta.reduce((a, b) => a + b, 0);
      expect(totalDelta).toBe(0);
    });
  });

  describe('getPlayerView', () => {
    it('should hide other players hands', () => {
      state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
      state = skipReshuffle(state);
      const view = getPlayerView(state, 1);
      // Player 1 sees their own hand
      expect(view.playerHands[1]).toEqual(state.playerHands[1]);
      // Player 1 doesn't see player 0's or 2's actual cards
      expect(view.playerHands[0].every((c) => c.id === 'hidden')).toBe(true);
      expect(view.playerHands[2].every((c) => c.id === 'hidden')).toBe(true);
    });

    it('should show kupa only to dealer', () => {
      state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
      state = skipReshuffle(state);
      const dealerView = getPlayerView(state, 0);
      expect(dealerView.kupa.some((c) => c.id !== 'hidden')).toBe(true);
      const otherView = getPlayerView(state, 1);
      expect(otherView.kupa.every((c) => c.id === 'hidden')).toBe(true);
    });
  });

  describe('Must-follow-suit enforcement in play', () => {
    it('should reject off-suit play when suit is available', () => {
      state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
      state = skipReshuffle(state);
      state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'S' } });
      const toDiscard = state.playerHands[0].slice(0, 4).map((c) => c.id);
      state = gameReducer(state, { type: 'DEALER_DISCARD_4', payload: { cardIds: toDiscard } });

      // Player 1 leads first trick
      const leader = state.currentPlayerIndex; // seat 1
      const leaderHand = state.playerHands[leader];
      // Play first card
      state = gameReducer(state, {
        type: 'PLAY_CARD',
        payload: { seatIndex: leader, cardId: leaderHand[0].id },
      });

      const leadSuit = state.currentTrick!.leadSuit!;
      const nextSeat = state.currentPlayerIndex;
      const nextHand = state.playerHands[nextSeat];

      // Check if next player has cards in lead suit
      const hasSuit = nextHand.some((c) => c.suit === leadSuit);
      if (hasSuit) {
        // Try to play off-suit card
        const offSuitCard = nextHand.find((c) => c.suit !== leadSuit);
        if (offSuitCard) {
          expect(() =>
            gameReducer(state, {
              type: 'PLAY_CARD',
              payload: { seatIndex: nextSeat, cardId: offSuitCard.id },
            }),
          ).toThrow();
        }
      }
    });
  });

  describe('Wrong turn enforcement', () => {
    it('should reject play from wrong seat', () => {
      state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
      state = skipReshuffle(state);
      state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'H' } });
      const toDiscard = state.playerHands[0].slice(0, 4).map((c) => c.id);
      state = gameReducer(state, { type: 'DEALER_DISCARD_4', payload: { cardIds: toDiscard } });

      // Current player is seat 1 (target-5)
      expect(state.currentPlayerIndex).toBe(1);
      // Try to play from seat 0
      const card = state.playerHands[0][0];
      expect(() =>
        gameReducer(state, {
          type: 'PLAY_CARD',
          payload: { seatIndex: 0, cardId: card.id },
        }),
      ).toThrow();
    });
  });
});

// ============================================================
// Reshuffle Tests (per hand)
// ============================================================

describe('Reshuffle', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeBasicGame(0);
  });

  it('every hand enters RESHUFFLE_WINDOW after deal', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    expect(state.reshuffleWindowFor8).toBe(true);
    expect(state.reshuffleWindowFor35).toBe(true);
    expect(state.reshuffleUsedBy8).toBe(false);
    expect(state.reshuffleUsedBy35).toBe(false);
  });

  it('both sides decline → advance to CUTTER_PICK', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = gameReducer(state, { type: 'RESHUFFLE_DECLINE', payload: { side: '8' } });
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    state = gameReducer(state, { type: 'RESHUFFLE_DECLINE', payload: { side: '35' } });
    expect(state.phase).toBe('CUTTER_PICK');
  });

  it('side 8 accepts → re-deal + response window for 35 in SAME hand', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } });

    expect(state.reshuffleUsedBy8).toBe(true);
    expect(state.reshuffleUsedBy35).toBe(false);
    expect(state.reshuffleWindowFor8).toBe(false);
    expect(state.reshuffleWindowFor35).toBe(true);
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    expect(state.playerHands[0]).toHaveLength(16);
  });

  it('side 35 accepts → re-deal + response window for 8 in SAME hand', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '35' } });

    expect(state.reshuffleUsedBy35).toBe(true);
    expect(state.reshuffleUsedBy8).toBe(false);
    expect(state.reshuffleWindowFor35).toBe(false);
    expect(state.reshuffleWindowFor8).toBe(true);
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
  });

  it('both sides reshuffle in same hand → max 2 re-deals, then advance', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    // Side 35 reshuffles first
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '35' } });
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    // Side 8 responds with reshuffle
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } });
    expect(state.reshuffleUsedBy8).toBe(true);
    expect(state.reshuffleUsedBy35).toBe(true);
    expect(state.phase).toBe('CUTTER_PICK');
  });

  it('one side accepts, other declines response → advance', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } });
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    state = gameReducer(state, { type: 'RESHUFFLE_DECLINE', payload: { side: '35' } });
    expect(state.phase).toBe('CUTTER_PICK');
  });

  it('side cannot reshuffle twice in the same hand', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } });
    // Side 8 already used, window is closed
    expect(() =>
      gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } }),
    ).toThrow();
  });

  it('rejects reshuffle outside RESHUFFLE_WINDOW phase', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = skipReshuffle(state);
    expect(state.phase).toBe('CUTTER_PICK');
    expect(() =>
      gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } }),
    ).toThrow();
  });

  it('reshuffle resets every hand — both sides can reshuffle again in hand 2', () => {
    // Hand 1: both reshuffle
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } });
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '35' } });
    expect(state.phase).toBe('CUTTER_PICK');

    // Play through hand 1
    state = gameReducer(state, { type: 'PICK_CUTTER', payload: { suit: 'S' } });
    const toDiscard = state.playerHands[state.dealerIndex].slice(0, 4).map((c) => c.id);
    state = gameReducer(state, { type: 'DEALER_DISCARD_4', payload: { cardIds: toDiscard } });
    for (let trick = 0; trick < 16; trick++) {
      for (let card = 0; card < 3; card++) {
        const seat = state.currentPlayerIndex;
        const hand = state.playerHands[seat];
        const leadSuit = state.currentTrick?.leadSuit ?? null;
        const legal = getLegalCards(hand, leadSuit);
        state = gameReducer(state, {
          type: 'PLAY_CARD',
          payload: { seatIndex: seat, cardId: legal[0].id },
        });
      }
    }
    expect(state.phase).toBe('HAND_SCORING');

    // Go to hand 2
    state = gameReducer(state, { type: 'NEXT_HAND' });
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });

    // Both sides can reshuffle again in the new hand
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    expect(state.reshuffleUsedBy8).toBe(false);
    expect(state.reshuffleUsedBy35).toBe(false);
    expect(state.reshuffleWindowFor8).toBe(true);
    expect(state.reshuffleWindowFor35).toBe(true);
  });

  it('35 declines initially, 8 accepts → 35 gets response with new cards', () => {
    state = gameReducer(state, { type: 'SHUFFLE_DEAL' });
    // 35 declines first
    state = gameReducer(state, { type: 'RESHUFFLE_DECLINE', payload: { side: '35' } });
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    // 8 accepts → re-deal
    state = gameReducer(state, { type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } });
    // 35 should get a response window (they haven't USED their reshuffle)
    expect(state.phase).toBe('RESHUFFLE_WINDOW');
    expect(state.reshuffleWindowFor35).toBe(true);
    expect(state.reshuffleWindowFor8).toBe(false);
  });
});
