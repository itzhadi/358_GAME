import {
  Card, Suit, RANK_VALUE, GameState, TrickCurrent,
  ExchangeGiving, PlayerHandState,
} from './types';

// ============================================================
// Rule enforcement helpers
// ============================================================

/**
 * Get the target for a seat given the dealer index.
 * Dealer = 8, left of dealer (clockwise +1) = 5, right of dealer (clockwise +2) = 3
 */
export function getTargetsForHand(dealerIndex: number): [number, number, number] {
  const targets: [number, number, number] = [0, 0, 0];
  targets[dealerIndex] = 8;
  targets[(dealerIndex + 1) % 3] = 5;
  targets[(dealerIndex + 2) % 3] = 3;
  return targets;
}

/**
 * Get the seat index of the player with target 5 (starts first trick).
 */
export function getTarget5Seat(dealerIndex: number): number {
  return (dealerIndex + 1) % 3;
}

/**
 * Which cards in a hand are legal to play given the lead suit?
 * - If player has lead suit cards → must play one of them
 * - Otherwise → any card is legal
 */
export function getLegalCards(hand: Card[], leadSuit: Suit | null): Card[] {
  if (!leadSuit) return hand; // Leader can play anything
  const sameSuit = hand.filter((c) => c.suit === leadSuit);
  return sameSuit.length > 0 ? sameSuit : hand;
}

/**
 * Determine the winner of a trick.
 * - If any cutter cards were played, highest cutter wins.
 * - Otherwise, highest card of the lead suit wins.
 */
export function determineTrickWinner(
  trick: TrickCurrent,
  cutterSuit: Suit | null,
): number {
  if (trick.cardsPlayed.length !== 3) {
    throw new Error('Trick must have exactly 3 cards');
  }
  if (!trick.leadSuit) {
    throw new Error('Lead suit must be set');
  }

  // Check for cutter cards
  const cutterCards = cutterSuit
    ? trick.cardsPlayed.filter((cp) => cp.card.suit === cutterSuit)
    : [];

  if (cutterCards.length > 0) {
    // Highest cutter wins
    let best = cutterCards[0];
    for (const cp of cutterCards) {
      if (RANK_VALUE[cp.card.rank] > RANK_VALUE[best.card.rank]) {
        best = cp;
      }
    }
    return best.seatIndex;
  }

  // No cutter → highest in lead suit wins
  const leadCards = trick.cardsPlayed.filter((cp) => cp.card.suit === trick.leadSuit);
  let best = leadCards[0];
  for (const cp of leadCards) {
    if (RANK_VALUE[cp.card.rank] > RANK_VALUE[best.card.rank]) {
      best = cp;
    }
  }
  return best.seatIndex;
}

/**
 * Calculate exchange givings based on previous hand deltas.
 * Players with positive delta give cards to players with negative delta.
 * Order: giver with highest target in the NEW hand goes first.
 */
export function calculateExchangeGivings(
  prevDeltas: number[],
  newTargets: number[],
): ExchangeGiving[] {
  // The implementation logic was duplicated below. We use the proper one directly.
  return calculateExchangeGivingsProper(prevDeltas, newTargets);
}

function calculateExchangeGivingsProper(
  prevDeltas: number[],
  newTargets: number[],
): ExchangeGiving[] {
  const plusPlayers = prevDeltas
    .map((d, i) => ({ seat: i, delta: d, remaining: d }))
    .filter((p) => p.delta > 0)
    .sort((a, b) => newTargets[b.seat] - newTargets[a.seat]); // highest new target first

  const minusPlayers = prevDeltas
    .map((d, i) => ({ seat: i, delta: d, remaining: Math.abs(d) }))
    .filter((p) => p.delta < 0);

  const givings: ExchangeGiving[] = [];

  for (const giver of plusPlayers) {
    for (const receiver of minusPlayers) {
      if (giver.remaining <= 0 || receiver.remaining <= 0) continue;
      const count = Math.min(giver.remaining, receiver.remaining);
      givings.push({
        fromSeat: giver.seat,
        toSeat: receiver.seat,
        count,
      });
      giver.remaining -= count;
      receiver.remaining -= count;
    }
  }

  return givings;
}

/**
 * For the exchange return: given a received card, determine what the receiver
 * MUST return. If they have a higher card in the same suit, they must return
 * the highest in that suit. Otherwise, they return the received card back.
 */
export function getRequiredReturnCard(
  receiverHand: Card[],
  receivedCard: Card,
): Card {
  const sameSuit = receiverHand.filter((c) => c.suit === receivedCard.suit);
  const higherCards = sameSuit.filter(
    (c) => RANK_VALUE[c.rank] > RANK_VALUE[receivedCard.rank],
  );

  if (higherCards.length > 0) {
    // Must return the highest in that suit
    let highest = higherCards[0];
    for (const c of higherCards) {
      if (RANK_VALUE[c.rank] > RANK_VALUE[highest.rank]) {
        highest = c;
      }
    }
    return highest;
  }

  // No higher card in same suit → return the received card itself
  return receivedCard;
}

/**
 * Check if a card play is legal.
 */
export function isLegalPlay(
  hand: Card[],
  cardId: string,
  leadSuit: Suit | null,
): boolean {
  const card = hand.find((c) => c.id === cardId);
  if (!card) return false;
  const legal = getLegalCards(hand, leadSuit);
  return legal.some((c) => c.id === cardId);
}

/**
 * Calculate score delta for a hand.
 */
export function calculateHandDelta(tricksTaken: number, target: number): number {
  return tricksTaken - target;
}

/**
 * Apply tie-breaking rules.
 * Returns winner seat index and reason.
 */
export function applyTieBreaker(
  tiedSeats: number[],
  lastHandDeltas: number[],
  lastHandTricks: { trickNumber: number; winnerIndex: number }[],
): { winnerSeat: number; reason: string } {
  if (tiedSeats.length === 1) {
    return { winnerSeat: tiedSeats[0], reason: 'ניקוד גבוה ביותר' };
  }

  // Rule 1: Who earned more points in the last hand
  const maxDelta = Math.max(...tiedSeats.map((s) => lastHandDeltas[s]));
  const bestByDelta = tiedSeats.filter((s) => lastHandDeltas[s] === maxDelta);
  if (bestByDelta.length === 1) {
    return {
      winnerSeat: bestByDelta[0],
      reason: `הרוויח הכי הרבה ביד האחרונה (+${maxDelta})`,
    };
  }

  // Rule 2/3: Who took the latest trick in the last hand
  // Check from trick 16 backwards
  const sortedTricks = [...lastHandTricks].sort(
    (a, b) => b.trickNumber - a.trickNumber,
  );

  // If all three tied: who took trick 16
  if (bestByDelta.length === 3) {
    const lastTrick = sortedTricks[0];
    if (bestByDelta.includes(lastTrick.winnerIndex)) {
      return {
        winnerSeat: lastTrick.winnerIndex,
        reason: 'לקח את הלקיחה האחרונה ביד האחרונה',
      };
    }
  }

  // Check from latest trick backwards for any of the tied players
  for (const trick of sortedTricks) {
    if (bestByDelta.includes(trick.winnerIndex)) {
      return {
        winnerSeat: trick.winnerIndex,
        reason: `לקח את הלקיחה המאוחרת ביותר (לקיחה ${trick.trickNumber}) ביד האחרונה`,
      };
    }
  }

  // Fallback (should not happen with proper rules)
  return { winnerSeat: bestByDelta[0], reason: 'שובר שוויון' };
}

/**
 * Check if any player has reached or exceeded the victory target.
 * Returns the winning seats (could be multiple for tie-breaking).
 */
export function checkVictory(
  scoreTotal: number[],
  victoryTarget: number,
): number[] {
  const winners = scoreTotal
    .map((s, i) => ({ seat: i, score: s }))
    .filter((p) => p.score >= victoryTarget);

  if (winners.length === 0) return [];

  const maxScore = Math.max(...winners.map((w) => w.score));
  return winners.filter((w) => w.score === maxScore).map((w) => w.seat);
}

/**
 * Which reshuffle "side" does a seat belong to?
 * Dealer (target 8) = '8', the other two (targets 3+5) = '35'.
 */
export function getReshuffleSide(seatIndex: number, dealerIndex: number): '8' | '35' {
  return seatIndex === dealerIndex ? '8' : '35';
}

/**
 * Rotate dealer clockwise.
 */
export function nextDealer(currentDealer: number): number {
  return (currentDealer + 1) % 3;
}

/**
 * Get next player clockwise.
 */
export function nextPlayerClockwise(currentSeat: number): number {
  return (currentSeat + 2) % 3;
}
