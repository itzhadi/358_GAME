import { Card, Suit, SUITS, RANK_VALUE, Rank, GameState, TrickResult } from './types';
import { getLegalCards, getRequiredReturnCard } from './rules';

// ============================================================
// PRO-LEVEL AI — Plays like a veteran 3-5-8 strategist
// ============================================================

const ALL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// ---- Low-level card helpers ----

function suitCards(hand: Card[], suit: Suit): Card[] {
  return hand.filter((c) => c.suit === suit);
}

function sortDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
}

function sortAsc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
}

function suitStrength(cards: Card[]): number {
  return cards.reduce((s, c) => s + RANK_VALUE[c.rank], 0);
}

function topSequenceLength(cards: Card[]): number {
  const sorted = sortDesc(cards);
  let expected = 14;
  let seq = 0;
  for (const c of sorted) {
    if (RANK_VALUE[c.rank] === expected) { seq++; expected--; }
    else break;
  }
  return seq;
}

// ============================================================
// GAME INTELLIGENCE — Card counting & opponent modeling
// ============================================================

interface GameIntel {
  mySeat: number;
  myTarget: number;
  myTricks: number;
  tricksNeeded: number;
  tricksLeft: number;
  overTarget: boolean;
  surplus: number; // how many tricks OVER target (negative = deficit)
  playedCards: Card[];
  allKnown: Card[]; // played + in my hand + on current trick
  opponentVoids: Set<string>; // "seat-suit" pairs where opponent is VOID
  cutterSuit: Suit | null;
  opponents: { seat: number; target: number; tricks: number; needed: number; over: boolean }[];
  cumulativeScores: number[];
  handNumber: number;
  victoryTarget: number;
  // Position in the current trick
  trickCards: { seatIndex: number; card: Card }[];
  isLeading: boolean;
  isLast: boolean; // 3rd to play
  isSecond: boolean;
}

function buildIntel(hand: Card[], gameState: GameState): GameIntel {
  const mySeat = gameState.currentPlayerIndex;
  const myTarget = gameState.targets[mySeat];
  const myTricks = gameState.tricksTakenCount[mySeat];
  const tricksLeft = 16 - (gameState.trickNumber - 1);
  const tricksNeeded = Math.max(0, myTarget - myTricks);
  const overTarget = myTricks >= myTarget;
  const surplus = myTricks - myTarget;

  const playedCards: Card[] = [];
  for (const t of gameState.tricksHistory)
    for (const cp of t.cardsPlayed)
      playedCards.push(cp.card);

  const trickCards = gameState.currentTrick?.cardsPlayed ?? [];
  const trickCardsList = trickCards.map((cp) => cp.card);
  const allKnown = [...playedCards, ...trickCardsList, ...hand];

  // Detect opponent voids from history
  const opponentVoids = new Set<string>();
  for (const trick of gameState.tricksHistory) {
    if (!trick.leadSuit) continue;
    for (const cp of trick.cardsPlayed) {
      if (cp.seatIndex === mySeat) continue;
      if (cp.card.suit !== trick.leadSuit) {
        opponentVoids.add(`${cp.seatIndex}-${trick.leadSuit}`);
      }
    }
  }
  // Also check current trick
  if (gameState.currentTrick?.leadSuit) {
    for (const cp of trickCards) {
      if (cp.seatIndex === mySeat) continue;
      if (cp.card.suit !== gameState.currentTrick.leadSuit) {
        opponentVoids.add(`${cp.seatIndex}-${gameState.currentTrick.leadSuit}`);
      }
    }
  }

  const opponents = [0, 1, 2]
    .filter((s) => s !== mySeat)
    .map((s) => ({
      seat: s,
      target: gameState.targets[s],
      tricks: gameState.tricksTakenCount[s],
      needed: Math.max(0, gameState.targets[s] - gameState.tricksTakenCount[s]),
      over: gameState.tricksTakenCount[s] >= gameState.targets[s],
    }));

  return {
    mySeat,
    myTarget,
    myTricks,
    tricksNeeded,
    tricksLeft,
    overTarget,
    surplus,
    playedCards,
    allKnown,
    opponentVoids,
    cutterSuit: gameState.cutterSuit,
    opponents,
    cumulativeScores: gameState.scoreTotal,
    handNumber: gameState.handNumber,
    victoryTarget: gameState.victoryTarget,
    trickCards,
    isLeading: trickCards.length === 0,
    isLast: trickCards.length === 2,
    isSecond: trickCards.length === 1,
  };
}

// Cards in a suit that are NOT in my hand and NOT played yet = in opponents' hands
function unknownInSuit(suit: Suit, allKnown: Card[]): Card[] {
  const knownIds = new Set(allKnown.map((c) => c.id));
  return ALL_RANKS
    .map((r) => ({ suit, rank: r, id: `${suit}-${r}` } as Card))
    .filter((c) => !knownIds.has(c.id));
}

function isMaster(card: Card, allKnown: Card[]): boolean {
  const unknown = unknownInSuit(card.suit, allKnown);
  return unknown.every((c) => RANK_VALUE[c.rank] < RANK_VALUE[card.rank]);
}

function countMasters(suit: Suit, hand: Card[], allKnown: Card[]): number {
  const mySuit = sortDesc(suitCards(hand, suit));
  const unknown = unknownInSuit(suit, allKnown);
  const maxUnknown = unknown.length > 0 ? Math.max(...unknown.map((c) => RANK_VALUE[c.rank])) : 0;
  let count = 0;
  for (const c of mySuit) {
    if (RANK_VALUE[c.rank] > maxUnknown) count++;
    else break;
  }
  return count;
}

function isOpponentVoid(seat: number, suit: Suit, intel: GameIntel): boolean {
  return intel.opponentVoids.has(`${seat}-${suit}`);
}

function anyOpponentVoid(suit: Suit, intel: GameIntel): boolean {
  return intel.opponents.some((o) => isOpponentVoid(o.seat, suit, intel));
}

function remainingCuttersInOpponents(hand: Card[], intel: GameIntel): number {
  if (!intel.cutterSuit) return 0;
  return unknownInSuit(intel.cutterSuit, intel.allKnown).length;
}

function estimateTricksICanWin(hand: Card[], intel: GameIntel): number {
  if (!intel.cutterSuit) return 0;
  let est = 0;
  for (const suit of SUITS) {
    const cards = suitCards(hand, suit);
    if (cards.length === 0) continue;
    if (suit === intel.cutterSuit) {
      est += cards.length; // cutters usually win (simplified)
    } else {
      est += countMasters(suit, hand, intel.allKnown);
    }
  }
  return est;
}

// ============================================================
// CURRENT TRICK WINNER
// ============================================================

interface WinnerInfo { seatIndex: number; value: number; isCutter: boolean }

function getCurrentWinner(
  cards: { seatIndex: number; card: Card }[],
  leadSuit: Suit,
  cutterSuit: Suit | null,
): WinnerInfo {
  if (cards.length === 0) return { seatIndex: -1, value: 0, isCutter: false };

  const cutterPlayed = cutterSuit ? cards.filter((cp) => cp.card.suit === cutterSuit) : [];
  if (cutterPlayed.length > 0) {
    let best = cutterPlayed[0];
    for (const cp of cutterPlayed)
      if (RANK_VALUE[cp.card.rank] > RANK_VALUE[best.card.rank]) best = cp;
    return { seatIndex: best.seatIndex, value: RANK_VALUE[best.card.rank] + 100, isCutter: true };
  }

  const leadPlayed = cards.filter((cp) => cp.card.suit === leadSuit);
  if (leadPlayed.length === 0) return { seatIndex: cards[0].seatIndex, value: 0, isCutter: false };
  let best = leadPlayed[0];
  for (const cp of leadPlayed)
    if (RANK_VALUE[cp.card.rank] > RANK_VALUE[best.card.rank]) best = cp;
  return { seatIndex: best.seatIndex, value: RANK_VALUE[best.card.rank], isCutter: false };
}

// ============================================================
// CUTTER SELECTION — dealer's strategic choice
// ============================================================

export function aiPickCutter(hand: Card[]): Suit {
  let bestSuit: Suit = 'S';
  let bestScore = -Infinity;

  for (const suit of SUITS) {
    const suited = suitCards(hand, suit);
    if (suited.length === 0) continue;

    const len = suited.length;
    const topSeq = topSequenceLength(suited);
    const highCards = suited.filter((c) => RANK_VALUE[c.rank] >= 11).length;
    const hasAce = suited.some((c) => c.rank === 'A');
    const hasKing = suited.some((c) => c.rank === 'K');

    // Non-cutter suit analysis: how well can we do WITHOUT this suit as cutter
    const otherSuits = SUITS.filter((s) => s !== suit);
    let otherMasters = 0;
    for (const os of otherSuits) {
      const osCards = suitCards(hand, os);
      if (osCards.length > 0 && topSequenceLength(osCards) > 0) {
        otherMasters += topSequenceLength(osCards);
      }
    }

    // Void suits count — how many suits are we void in (good for cutting)
    const voidCount = otherSuits.filter((s) => suitCards(hand, s).length === 0).length;

    const score =
      len * 180 +           // Length is king
      topSeq * 250 +        // Sequential top cards are massive
      highCards * 100 +      // High cards are valuable
      (hasAce ? 200 : 0) +  // Ace is premium
      (hasKing && hasAce ? 150 : 0) + // A-K combo
      suitStrength(suited) +
      (len >= 5 ? 400 : 0) +
      (len >= 6 ? 500 : 0) +
      (len >= 7 ? 600 : 0) +
      otherMasters * 60 +   // Bonus for other strong suits
      voidCount * 150;       // Being void in other suits = cutting power

    if (score > bestScore) { bestScore = score; bestSuit = suit; }
  }
  return bestSuit;
}

// ============================================================
// DISCARD STRATEGY — create voids for future cutting
// ============================================================

export function aiSelectDiscard(hand: Card[], cutterSuit: Suit): string[] {
  const nonCutter = hand.filter((c) => c.suit !== cutterSuit);
  const cutterCards = hand.filter((c) => c.suit === cutterSuit);

  // Analyze each non-cutter suit
  const analysis = SUITS
    .filter((s) => s !== cutterSuit)
    .map((suit) => {
      const cards = sortAsc(suitCards(nonCutter, suit));
      const topSeq = topSequenceLength(cards);
      const highCards = cards.filter((c) => RANK_VALUE[c.rank] >= 11).length;
      const hasAce = cards.some((c) => c.rank === 'A');
      const hasAK = hasAce && cards.some((c) => c.rank === 'K');

      // How valuable is keeping this suit?
      let keepScore = 0;
      keepScore += topSeq * 350;                            // A-K-Q sequence = extremely valuable
      keepScore += (hasAK ? 400 : hasAce ? 250 : 0);       // A or A-K = solid
      keepScore += highCards * 120;
      keepScore += (cards.length >= 4 ? 250 : 0);          // Length = control
      keepScore += (cards.length >= 3 && highCards >= 2 ? 200 : 0);
      keepScore += suitStrength(cards);

      // Short weak suits are great candidates for voiding
      if (cards.length <= 2 && highCards === 0) keepScore *= 0.3;

      return { suit, cards, keepScore };
    })
    .sort((a, b) => a.keepScore - b.keepScore); // weakest first

  const toDiscard: Card[] = [];
  const discardedIds = new Set<string>();

  // Phase 1: void entire weak suits (shortest first, weakest first)
  for (const a of analysis) {
    if (toDiscard.length >= 4) break;
    if (a.cards.length > 0 && a.cards.length <= 4 - toDiscard.length && a.keepScore < 500) {
      for (const c of a.cards) {
        toDiscard.push(c);
        discardedIds.add(c.id);
      }
    }
  }

  // Phase 2: discard weakest individual non-cutter cards
  if (toDiscard.length < 4) {
    const rest = sortAsc(nonCutter.filter((c) => !discardedIds.has(c.id)));
    for (const c of rest) {
      if (toDiscard.length >= 4) break;
      // Never discard A or K from a strong suit
      if (RANK_VALUE[c.rank] >= 13) {
        const suitLen = suitCards(nonCutter, c.suit).filter((x) => !discardedIds.has(x.id)).length;
        if (suitLen >= 3) continue; // keep K/A in long suits
      }
      toDiscard.push(c);
      discardedIds.add(c.id);
    }
  }

  // Phase 3: if still not enough, discard lowest remaining non-cutter
  if (toDiscard.length < 4) {
    const rest = sortAsc(nonCutter.filter((c) => !discardedIds.has(c.id)));
    for (const c of rest) {
      if (toDiscard.length >= 4) break;
      toDiscard.push(c);
      discardedIds.add(c.id);
    }
  }

  // Phase 4: forced to discard cutters
  if (toDiscard.length < 4) {
    for (const c of sortAsc(cutterCards)) {
      if (toDiscard.length >= 4) break;
      toDiscard.push(c);
    }
  }

  return toDiscard.slice(0, 4).map((c) => c.id);
}

// ============================================================
// MAIN PLAY ENTRY — dispatches to strategic lead or follow
// ============================================================

export function aiPlayCard(
  hand: Card[],
  leadSuit: Suit | null,
  cutterSuit: Suit | null,
  currentTrickCards: { seatIndex: number; card: Card }[],
  gameState?: GameState,
): string {
  const legal = getLegalCards(hand, leadSuit);
  if (legal.length === 1) return legal[0].id;
  if (!gameState) return sortAsc(legal)[0].id;

  const intel = buildIntel(hand, gameState);

  if (!leadSuit) {
    return proLead(legal, hand, intel);
  }
  return proFollow(legal, leadSuit, hand, intel);
}

// ============================================================
// PRO LEADING — strategic opening
// ============================================================

function proLead(legal: Card[], hand: Card[], intel: GameIntel): string {
  const { cutterSuit, tricksNeeded, tricksLeft, overTarget, surplus, myTarget } = intel;
  const nonCutter = cutterSuit ? legal.filter((c) => c.suit !== cutterSuit) : legal;
  const cutters = cutterSuit ? sortDesc(legal.filter((c) => c.suit === cutterSuit)) : [];

  // ===== OVER TARGET — try to lose =====
  if (overTarget) return leadToLose(legal, hand, intel);

  // ===== ENDGAME (last 4–6 tricks): math-based =====
  if (tricksLeft <= 6 && tricksNeeded > 0) {
    return endgameLead(legal, hand, intel);
  }

  // ===== ROLE-SPECIFIC ADJUSTMENTS =====

  // --- TARGET 8 (The Captain): aggressive, take control early ---
  if (myTarget === 8) return captainLead(legal, hand, intel, nonCutter, cutters);

  // --- TARGET 5 (The Balancer): flexible, control the tempo ---
  if (myTarget === 5) return balancerLead(legal, hand, intel, nonCutter, cutters);

  // --- TARGET 3 (The Sergeant): careful, don't over-commit ---
  return sergeantLead(legal, hand, intel, nonCutter, cutters);
}

function captainLead(
  legal: Card[], hand: Card[], intel: GameIntel,
  nonCutter: Card[], cutters: Card[],
): string {
  // 1. Cash masters — guaranteed winners
  const masters = nonCutter.filter((c) => isMaster(c, intel.allKnown));
  if (masters.length > 0) {
    return pickBestMasterToLead(masters, hand, intel);
  }

  // 2. Lead high cutters to draw out opponents' cutters
  if (cutters.length > 0) {
    const cutterMasters = cutters.filter((c) => isMaster(c, intel.allKnown));
    if (cutterMasters.length > 0) return cutterMasters[0].id;
    if (cutters.length >= 4) return cutters[0].id; // draw out their cutters
  }

  // 3. Lead from long suits where we have high cards (establish winners)
  const probe = probeLeadForEstablishment(nonCutter, hand, intel);
  if (probe) return probe;

  // 4. Lead suits where opponent is VOID to draw cutters
  const voidLead = leadToDrawCutters(nonCutter, hand, intel);
  if (voidLead) return voidLead;

  // 5. Default: lowest from longest non-cutter suit
  return lowestFromLongest(nonCutter, hand, intel) || sortAsc(legal)[0].id;
}

function balancerLead(
  legal: Card[], hand: Card[], intel: GameIntel,
  nonCutter: Card[], cutters: Card[],
): string {
  // 1. Cash masters
  const masters = nonCutter.filter((c) => isMaster(c, intel.allKnown));
  if (masters.length > 0) return pickBestMasterToLead(masters, hand, intel);

  // 2. If dealer (target 8) is running away with tricks, try to disrupt
  const dealer8 = intel.opponents.find((o) => o.target === 8);
  if (dealer8 && dealer8.tricks >= 5 && dealer8.needed <= 3) {
    // Lead suits where dealer might be VOID — force them to cut high
    const disruptLead = leadToDisrupt(nonCutter, hand, intel, dealer8.seat);
    if (disruptLead) return disruptLead;
  }

  // 3. Lead from strong suits to establish control
  const probe = probeLeadForEstablishment(nonCutter, hand, intel);
  if (probe) return probe;

  // 4. Cutter masters
  if (cutters.length > 0) {
    const cutterMasters = cutters.filter((c) => isMaster(c, intel.allKnown));
    if (cutterMasters.length > 0) return cutterMasters[0].id;
  }

  return lowestFromLongest(nonCutter, hand, intel) || sortAsc(legal)[0].id;
}

function sergeantLead(
  legal: Card[], hand: Card[], intel: GameIntel,
  nonCutter: Card[], cutters: Card[],
): string {
  const { tricksNeeded } = intel;

  // Target 3 usually doesn't want to lead aggressively
  // If we still need tricks, lead masters only
  if (tricksNeeded > 0) {
    const masters = nonCutter.filter((c) => isMaster(c, intel.allKnown));
    if (masters.length > 0) return pickBestMasterToLead(masters, hand, intel);

    // If we have cutter masters and need tricks, use them
    if (cutters.length > 0) {
      const cutterMasters = cutters.filter((c) => isMaster(c, intel.allKnown));
      if (cutterMasters.length > 0) return cutterMasters[0].id;
    }
  }

  // Dump high cards from SHORT suits to avoid being forced to win later
  // This is a sergeant's trick: "shed" dangerous cards early
  const dangerCards = findDangerousHighCards(nonCutter, hand, intel);
  if (dangerCards.length > 0) return dangerCards[0].id;

  // Lead lowest card from weakest suit
  return lowestFromShortest(nonCutter, hand, intel) || sortAsc(legal)[0].id;
}

// ============================================================
// ENDGAME LEADING — mathematical precision
// ============================================================

function endgameLead(legal: Card[], hand: Card[], intel: GameIntel): string {
  const { cutterSuit, tricksNeeded, allKnown } = intel;
  const nonCutter = cutterSuit ? legal.filter((c) => c.suit !== cutterSuit) : legal;
  const cutters = cutterSuit ? sortDesc(legal.filter((c) => c.suit === cutterSuit)) : [];

  // Count how many guaranteed wins I have
  let guaranteedWins = 0;
  const masterCards: Card[] = [];
  for (const suit of SUITS) {
    const mySuit = suitCards(hand, suit);
    for (const c of mySuit) {
      if (isMaster(c, allKnown)) { guaranteedWins++; masterCards.push(c); }
    }
  }

  // If guaranteed wins >= needed → cash them out
  if (guaranteedWins >= tricksNeeded && masterCards.length > 0) {
    // Play masters from the suit with the most masters (cash out sequence)
    return pickBestMasterToLead(masterCards, hand, intel);
  }

  // Not enough guaranteed wins → need to gamble strategically
  // Lead low from a suit where one more round will promote our high card to master
  for (const suit of SUITS) {
    if (suit === cutterSuit) continue;
    const mySuit = sortDesc(suitCards(nonCutter, suit));
    if (mySuit.length < 2) continue;
    const unknown = unknownInSuit(suit, allKnown);
    const higherThanMyBest = unknown.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[mySuit[0].rank]);
    if (higherThanMyBest.length === 1) {
      // Only ONE card higher is out — lead low to flush it, then our card becomes master
      return mySuit[mySuit.length - 1].id;
    }
  }

  // Lead cutters to clear remaining opponent cutters if I need non-cutter tricks
  if (cutters.length > 0) {
    const oppCutters = remainingCuttersInOpponents(hand, intel);
    if (oppCutters > 0 && oppCutters <= cutters.length) {
      return cutters[0].id; // draw out their last cutters
    }
  }

  // Default: master or lowest
  if (masterCards.length > 0) return masterCards[0].id;
  return sortAsc(nonCutter.length > 0 ? nonCutter : legal)[0].id;
}

// ============================================================
// LEAD TO LOSE — when over target
// ============================================================

function leadToLose(legal: Card[], hand: Card[], intel: GameIntel): string {
  const { cutterSuit, allKnown } = intel;
  const nonCutter = cutterSuit ? legal.filter((c) => c.suit !== cutterSuit) : legal;

  if (nonCutter.length > 0) {
    // Lead the LOWEST card from a suit where opponents have higher cards
    let best: Card | null = null;
    let bestScore = -Infinity;
    for (const c of nonCutter) {
      const unknown = unknownInSuit(c.suit, allKnown);
      const higherOut = unknown.filter((u) => RANK_VALUE[u.rank] > RANK_VALUE[c.rank]).length;
      // More higher cards = safer to lose. Lower rank = better dump.
      const score = higherOut * 40 - RANK_VALUE[c.rank] * 15;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best) return best.id;
  }
  return sortAsc(legal)[0].id;
}

// ============================================================
// LEAD HELPERS
// ============================================================

function pickBestMasterToLead(masters: Card[], hand: Card[], intel: GameIntel): string {
  // Prefer suit where we have the most sequential masters → cash them all
  const bySuit: Record<string, Card[]> = {};
  for (const m of masters) {
    if (!bySuit[m.suit]) bySuit[m.suit] = [];
    bySuit[m.suit].push(m);
  }
  let bestMaster = masters[0];
  let bestMasterCount = 0;
  for (const [, cards] of Object.entries(bySuit)) {
    if (cards.length > bestMasterCount) {
      bestMasterCount = cards.length;
      bestMaster = sortDesc(cards)[0]; // lead highest master in that suit
    }
  }
  return bestMaster.id;
}

function probeLeadForEstablishment(nonCutter: Card[], hand: Card[], intel: GameIntel): string | null {
  // Lead LOW from a suit where we have high cards that are ALMOST masters
  // (e.g., we have K and only A is higher in opponents → lead low to flush the A)
  let bestProbe: Card | null = null;
  let bestScore = -Infinity;

  for (const suit of SUITS) {
    if (suit === intel.cutterSuit) continue;
    const mySuit = sortDesc(suitCards(nonCutter, suit));
    if (mySuit.length < 2) continue; // need at least 2 cards to "establish"

    const unknown = unknownInSuit(suit, intel.allKnown);
    const myHighest = mySuit[0];
    const higherOut = unknown.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[myHighest.rank]).length;

    let score = 0;
    score += mySuit.length * 50;           // Length is power
    if (higherOut === 1 && RANK_VALUE[myHighest.rank] >= 12) score += 300; // Almost master!
    if (higherOut === 0) score += 400;      // Already master
    score += (13 - unknown.length) * 20;    // Fewer unknowns = more control

    // Bonus if no opponent is VOID in this suit (won't get cut)
    if (!anyOpponentVoid(suit, intel)) score += 100;

    if (score > bestScore) {
      bestScore = score;
      bestProbe = mySuit[mySuit.length - 1]; // lead LOWEST to probe
    }
  }

  return bestProbe && bestScore > 200 ? bestProbe.id : null;
}

function leadToDrawCutters(nonCutter: Card[], hand: Card[], intel: GameIntel): string | null {
  // Lead a suit where an opponent is VOID → forces them to cut or dump
  for (const opp of intel.opponents) {
    for (const suit of SUITS) {
      if (suit === intel.cutterSuit) continue;
      if (!isOpponentVoid(opp.seat, suit, intel)) continue;

      // Opponent is VOID here → leading this suit forces them to cut or dump
      const mySuit = sortAsc(suitCards(nonCutter, suit));
      if (mySuit.length > 0) {
        // If opponent needs tricks, they'll be forced to cut = wastes their cutter
        if (opp.needed > 0) return mySuit[0].id; // lead low, they must cut
      }
    }
  }
  return null;
}

function leadToDisrupt(nonCutter: Card[], hand: Card[], intel: GameIntel, targetSeat: number): string | null {
  // Lead a suit where the target player is VOID → force them to cut
  for (const suit of SUITS) {
    if (suit === intel.cutterSuit) continue;
    if (!isOpponentVoid(targetSeat, suit, intel)) continue;
    const mySuit = sortAsc(suitCards(nonCutter, suit));
    if (mySuit.length > 0) return mySuit[0].id;
  }
  return null;
}

function lowestFromLongest(cards: Card[], hand: Card[], intel: GameIntel): string | null {
  if (cards.length === 0) return null;
  const suitLens: Record<string, number> = {};
  for (const c of cards) suitLens[c.suit] = (suitLens[c.suit] || 0) + 1;

  const maxLen = Math.max(...Object.values(suitLens));
  const bestSuits = Object.entries(suitLens).filter(([, len]) => len === maxLen).map(([s]) => s);
  const best = sortAsc(cards.filter((c) => bestSuits.includes(c.suit)));
  return best.length > 0 ? best[0].id : null;
}

function lowestFromShortest(cards: Card[], hand: Card[], intel: GameIntel): string | null {
  if (cards.length === 0) return null;
  const suitLens: Record<string, number> = {};
  for (const c of cards) suitLens[c.suit] = (suitLens[c.suit] || 0) + 1;

  const minLen = Math.min(...Object.values(suitLens));
  const shortSuits = Object.entries(suitLens).filter(([, len]) => len === minLen).map(([s]) => s);
  const candidates = sortAsc(cards.filter((c) => shortSuits.includes(c.suit)));
  return candidates.length > 0 ? candidates[0].id : null;
}

function findDangerousHighCards(nonCutter: Card[], hand: Card[], intel: GameIntel): Card[] {
  // High cards in short suits that could force us to win unwanted tricks
  const dangerous: { card: Card; danger: number }[] = [];

  for (const c of nonCutter) {
    if (RANK_VALUE[c.rank] < 11) continue; // only J+ are dangerous
    const suitLen = suitCards(hand, c.suit).length;
    if (suitLen >= 4) continue; // long suit = manageable

    const unknown = unknownInSuit(c.suit, intel.allKnown);
    const higherOut = unknown.filter((u) => RANK_VALUE[u.rank] > RANK_VALUE[c.rank]).length;

    // If it's NOT a master and in a short suit → dangerous
    if (higherOut > 0 && suitLen <= 2) {
      dangerous.push({
        card: c,
        danger: RANK_VALUE[c.rank] * 10 - suitLen * 50, // higher and shorter = more dangerous
      });
    }
  }

  return dangerous.sort((a, b) => b.danger - a.danger).map((d) => d.card);
}

// ============================================================
// PRO FOLLOWING — card economy & position awareness
// ============================================================

function proFollow(legal: Card[], leadSuit: Suit, hand: Card[], intel: GameIntel): string {
  const canFollow = legal.some((c) => c.suit === leadSuit);
  const winner = getCurrentWinner(intel.trickCards, leadSuit, intel.cutterSuit);

  if (canFollow) {
    return followSuit(legal, leadSuit, hand, intel, winner);
  }
  return cantFollowSuit(legal, leadSuit, hand, intel, winner);
}

function followSuit(
  legal: Card[], leadSuit: Suit, hand: Card[], intel: GameIntel, winner: WinnerInfo,
): string {
  const { cutterSuit, overTarget, tricksNeeded, isLast, isSecond, allKnown, myTarget, trickCards } = intel;
  const mySuit = sortDesc(legal.filter((c) => c.suit === leadSuit));

  // Cutter already played & we're following non-cutter → can't win → dump lowest
  if (cutterSuit && leadSuit !== cutterSuit && trickCards.some((cp) => cp.card.suit === cutterSuit)) {
    return mySuit[mySuit.length - 1].id;
  }

  // ===== OVER TARGET → play lowest, try to lose =====
  if (overTarget) {
    // Exception for target-3: if only 1 over and it's early, small surplus is OK
    return mySuit[mySuit.length - 1].id;
  }

  const beaters = mySuit.filter((c) => RANK_VALUE[c.rank] > winner.value);

  // ========= LAST TO PLAY (3rd player) — perfect information =========
  if (isLast) {
    if (beaters.length > 0 && tricksNeeded > 0) {
      // Win with the CHEAPEST card that wins
      return beaters[beaters.length - 1].id;
    }
    // Can't win or don't need to → dump lowest
    return mySuit[mySuit.length - 1].id;
  }

  // ========= SECOND TO PLAY — card economy is CRUCIAL =========
  if (isSecond) {
    if (beaters.length > 0 && tricksNeeded > 0) {
      const unknown = unknownInSuit(leadSuit, allKnown);
      const higherUnknown = unknown.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[beaters[0].rank]);

      // Our best beater is a MASTER → safe to play cheapest beater
      if (higherUnknown.length === 0) {
        return beaters[beaters.length - 1].id;
      }

      // Ace is always the master of the suit → play it
      if (RANK_VALUE[beaters[0].rank] === 14) {
        return beaters[0].id;
      }

      // NOT a master — 3rd player might have higher
      // KEY: Don't waste K/Q unnecessarily. Play LOW to conserve.
      // Exception: if the 3rd player is likely VOID and will dump or cut
      const thirdPlayer = [0, 1, 2].find(
        (s) => s !== intel.mySeat && !trickCards.some((cp) => cp.seatIndex === s),
      );

      if (thirdPlayer !== undefined && isOpponentVoid(thirdPlayer, leadSuit, intel)) {
        // 3rd player is VOID — they'll cut or dump. Our high card wins lead suit battle.
        if (beaters.length > 0) return beaters[beaters.length - 1].id; // cheapest winner
      }

      // 3rd player has cards in this suit → they might beat us
      // Conserve: play lowest
      return mySuit[mySuit.length - 1].id;
    }

    return mySuit[mySuit.length - 1].id;
  }

  // Shouldn't reach here, but fallback
  return mySuit[mySuit.length - 1].id;
}

// ============================================================
// CAN'T FOLLOW SUIT — cut or dump strategically
// ============================================================

function cantFollowSuit(
  legal: Card[], leadSuit: Suit, hand: Card[], intel: GameIntel, winner: WinnerInfo,
): string {
  const { cutterSuit, overTarget, tricksNeeded, isLast, isSecond, allKnown, myTarget, trickCards } = intel;
  const myCutters = cutterSuit ? sortAsc(legal.filter((c) => c.suit === cutterSuit)) : [];

  // ===== OVER TARGET → dump, never cut =====
  if (overTarget) return strategicDump(legal, hand, intel);

  // ===== NEED TRICKS → consider cutting =====
  if (myCutters.length > 0 && tricksNeeded > 0) {
    const existingCutters = trickCards.filter(
      (cp) => cutterSuit && cp.card.suit === cutterSuit,
    );

    if (existingCutters.length > 0) {
      // Someone already cut — need to OVERCUT
      const maxExisting = Math.max(...existingCutters.map((cp) => RANK_VALUE[cp.card.rank]));
      const overCutters = myCutters.filter((c) => RANK_VALUE[c.rank] > maxExisting);

      if (overCutters.length > 0) {
        if (isLast) return overCutters[0].id; // cheapest overcut — perfect info

        // 2nd player overcut — check if 3rd can over-overcut
        const unknownCutters = unknownInSuit(cutterSuit!, allKnown);
        const higherUnknown = unknownCutters.filter(
          (c) => RANK_VALUE[c.rank] > RANK_VALUE[overCutters[0].rank],
        );

        if (higherUnknown.length === 0) return overCutters[0].id; // safe

        // 3rd player might have higher cutter
        // For target 8: aggressive, still try
        if (myTarget === 8 && tricksNeeded >= 3) return overCutters[0].id;
        // For others: dump instead — don't waste cutters
        return strategicDump(legal, hand, intel);
      }
      // Can't overcut → dump
      return strategicDump(legal, hand, intel);
    }

    // No cutter in play → we can cut
    if (isLast) return myCutters[0].id; // cheapest cut — guaranteed win

    // 2nd player cutting
    const unknownCutters = unknownInSuit(cutterSuit!, allKnown);
    const thirdPlayer = [0, 1, 2].find(
      (s) => s !== intel.mySeat && !trickCards.some((cp) => cp.seatIndex === s),
    );

    // If 3rd player is VOID in lead suit too → they might also cut (overcut risk)
    const thirdMightCut = thirdPlayer !== undefined &&
      isOpponentVoid(thirdPlayer, leadSuit, intel);

    if (thirdMightCut) {
      const higherUnknown = unknownCutters.filter(
        (c) => RANK_VALUE[c.rank] > RANK_VALUE[myCutters[0].rank],
      );
      if (higherUnknown.length === 0) return myCutters[0].id; // our lowest cut is safe

      // Risk of overcut. For target 8, gamble with lowest cutter.
      if (myTarget === 8) return myCutters[0].id;

      // Target 5: cut if we have many cutters. Target 3: rarely cut.
      if (myTarget === 5 && myCutters.length >= 3) return myCutters[0].id;
      return strategicDump(legal, hand, intel);
    }

    // 3rd player follows suit → our cut wins
    return myCutters[0].id;
  }

  return strategicDump(legal, hand, intel);
}

// ============================================================
// STRATEGIC DUMP — discard to maximize future position
// ============================================================

function strategicDump(legal: Card[], hand: Card[], intel: GameIntel): string {
  const { cutterSuit, allKnown } = intel;
  const nonCutter = cutterSuit ? legal.filter((c) => c.suit !== cutterSuit) : legal;
  const candidates = nonCutter.length > 0 ? nonCutter : legal;

  // Priority 1: dump from shortest non-cutter suit to CREATE a VOID
  // (future cutting opportunity)
  const suitLens: Record<string, number> = {};
  for (const c of hand) {
    if (cutterSuit && c.suit === cutterSuit) continue;
    suitLens[c.suit] = (suitLens[c.suit] || 0) + 1;
  }

  const scored = candidates.map((c) => {
    let score = 0;
    const len = suitLens[c.suit] || 0;

    // Shorter suit = better dump (closer to void)
    score += len * 100;

    // Lower rank = less waste
    score += RANK_VALUE[c.rank];

    // If dumping this card creates a void → massive bonus
    if (len === 1) score -= 500;

    // Never dump aces/kings unless forced (they're future masters)
    if (RANK_VALUE[c.rank] >= 13 && len >= 2) score += 800;

    return { card: c, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].card.id;
}

// ============================================================
// EXCHANGE — smart card selection
// ============================================================

export function aiExchangeGive(hand: Card[], count: number): string[] {
  // Give cards that weaken us the LEAST
  // Prefer: low cards, from SHORT suits, NOT aces or kings
  const scored = hand.map((c) => {
    const suitLen = hand.filter((h) => h.suit === c.suit).length;
    let score = 0;

    // Higher cards = more valuable = higher score (want to keep)
    score += RANK_VALUE[c.rank] * 25;

    // A/K are extremely valuable — almost never give
    if (RANK_VALUE[c.rank] >= 13) score += 600;
    if (RANK_VALUE[c.rank] >= 14) score += 400; // A is even more precious

    // Short suits: giving from them weakens us less (fewer cards lost)
    if (suitLen <= 2) score -= 100;

    // Cards from long suits are more valuable (we have control there)
    score += suitLen * 30;

    return { card: c, score };
  });

  // Sort: lowest score first = best to give away
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.card.id);
}

export function aiExchangeReturn(hand: Card[], receivedCard: Card): string {
  return getRequiredReturnCard(hand, receivedCard).id;
}
