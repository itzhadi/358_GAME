import {
  GameState, GameAction, Card, Suit, GamePhase, RANK_VALUE,
  TrickCurrent, TrickResult, ExchangeInfo, HandRecord,
  CreateGamePayload,
} from './types';
import { createDeck, shuffleDeck, dealCards, seededRandom, sortHand } from './deck';
import {
  getTargetsForHand, getTarget5Seat, getLegalCards,
  determineTrickWinner, calculateExchangeGivings,
  getRequiredReturnCard, isLegalPlay, calculateHandDelta,
  checkVictory, applyTieBreaker, nextDealer, nextPlayerClockwise,
} from './rules';

// ============================================================
// Game Engine – Pure reducer: (state, action) => newState
// ============================================================

/**
 * Create initial game state from CREATE_GAME action.
 */
export function createGame(payload: CreateGamePayload): GameState {
  if (payload.players.length !== 3) {
    throw new Error('Exactly 3 players required');
  }

  const dealerIndex = payload.dealerIndex ?? Math.floor(Math.random() * 3);
  const targets = getTargetsForHand(dealerIndex);

  return {
    gameId: payload.gameId,
    mode: payload.mode,
    victoryTarget: payload.victoryTarget ?? 10,
    players: payload.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      seatIndex: i,
    })),
    handNumber: 0,
    dealerIndex,
    deck: [],
    kupa: [],
    playerHands: [[], [], []],
    dealerDiscarded: [],
    dealerReceivedKupa: [],
    dealerHiddenReturns: [],
    dealerPendingReceived: [],
    cutterSuit: null,
    exchangeInfo: null,
    currentTrick: null,
    trickNumber: 0,
    tricksHistory: [],
    tricksTakenCount: [0, 0, 0],
    scoreTotal: [0, 0, 0],
    lastHandDelta: [0, 0, 0],
    targets,
    phase: 'SETUP_DEAL',
    currentPlayerIndex: dealerIndex,
    winnerIndex: null,
    winnerReason: null,
    handHistory: [],
  };
}

/**
 * Main reducer: apply an action to the game state and return new state.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'CREATE_GAME':
      return createGame(action.payload);

    case 'SHUFFLE_DEAL':
      return handleShuffleDeal(state);

    case 'EXCHANGE_GIVE_CARD':
      return handleExchangeGive(state, action.payload.fromSeat, action.payload.cardId);

    case 'EXCHANGE_RETURN_CARD':
      return handleExchangeReturn(state, action.payload.fromSeat, action.payload.cardId);

    case 'PICK_CUTTER':
      return handlePickCutter(state, action.payload.suit);

    case 'DEALER_DISCARD_4':
      return handleDealerDiscard(state, action.payload.cardIds);

    case 'PLAY_CARD':
      return handlePlayCard(state, action.payload.seatIndex, action.payload.cardId);

    case 'NEXT_HAND':
      return handleNextHand(state);

    default:
      return state;
  }
}

// ============================================================
// Action Handlers
// ============================================================

function handleShuffleDeal(state: GameState): GameState {
  if (state.phase !== 'SETUP_DEAL') {
    throw new Error(`Cannot deal in phase ${state.phase}`);
  }

  const deck = shuffleDeck(createDeck());
  const { hands, kupa } = dealCards(deck);

  const targets = getTargetsForHand(state.dealerIndex);
  const handNumber = state.handNumber + 1;

  // Determine if exchange is needed (hand 2+)
  const needsExchange = handNumber > 1;

  let phase: GamePhase;
  let exchangeInfo: ExchangeInfo | null = null;
  let currentPlayerIndex: number;

  if (needsExchange) {
    // Calculate exchange givings based on last hand deltas
    const givings = calculateExchangeGivings(state.lastHandDelta, targets);
    if (givings.length > 0) {
      exchangeInfo = {
        givings,
        givenCards: [],
        returnedCards: [],
        currentGiverIdx: 0,
        subPhase: 'giving',
      };
      phase = 'EXCHANGE_GIVE';
      currentPlayerIndex = givings[0].fromSeat;
    } else {
      // All zeros, skip to cutter
      phase = 'CUTTER_PICK';
      currentPlayerIndex = state.dealerIndex;
    }
  } else {
    // First hand: go straight to cutter pick
    phase = 'CUTTER_PICK';
    currentPlayerIndex = state.dealerIndex;
  }

  return {
    ...state,
    handNumber,
    deck,
    kupa,
    playerHands: hands,
    dealerDiscarded: [],
    dealerReceivedKupa: [],
    dealerHiddenReturns: [],
    dealerPendingReceived: [],
    cutterSuit: null,
    exchangeInfo,
    currentTrick: null,
    trickNumber: 0,
    tricksHistory: [],
    tricksTakenCount: [0, 0, 0],
    targets,
    phase,
    currentPlayerIndex,
  };
}

function handleExchangeGive(
  state: GameState,
  fromSeat: number,
  cardId: string,
): GameState {
  if (state.phase !== 'EXCHANGE_GIVE') {
    throw new Error(`Cannot give card in phase ${state.phase}`);
  }
  if (!state.exchangeInfo) {
    throw new Error('No exchange info');
  }

  const { givings, givenCards, currentGiverIdx } = state.exchangeInfo;
  const currentGiving = givings[currentGiverIdx];
  if (fromSeat !== currentGiving.fromSeat) {
    throw new Error(`Not ${fromSeat}'s turn to give, expected ${currentGiving.fromSeat}`);
  }

  // Find the card in the giver's hand
  const giverHand = [...state.playerHands[fromSeat]];
  const cardIndex = giverHand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} not in player ${fromSeat}'s hand`);
  }

  const card = giverHand[cardIndex];
  giverHand.splice(cardIndex, 1);

  const newHands = [...state.playerHands];
  newHands[fromSeat] = giverHand;

  // If giving TO the dealer, hide the card until after cutter pick
  let newDealerPendingReceived = [...state.dealerPendingReceived];
  if (currentGiving.toSeat === state.dealerIndex) {
    newDealerPendingReceived.push(card);
  } else {
    const receiverHand = [...state.playerHands[currentGiving.toSeat], card];
    newHands[currentGiving.toSeat] = receiverHand;
  }

  const newGivenCards = [...givenCards, {
    fromSeat,
    toSeat: currentGiving.toSeat,
    card,
  }];

  const givenForThis = newGivenCards.filter(
    (g) => g.fromSeat === currentGiving.fromSeat && g.toSeat === currentGiving.toSeat,
  ).length;

  let newGiverIdx = currentGiverIdx;
  let newPhase: GamePhase = 'EXCHANGE_GIVE';
  let newSubPhase: 'giving' | 'returning' = 'giving';
  let newCurrentPlayer = fromSeat;

  if (givenForThis >= currentGiving.count) {
    newGiverIdx = currentGiverIdx + 1;
    if (newGiverIdx >= givings.length) {
      // All givings complete → check if any non-dealer receiver needs to return
      const hasNonDealerReturn = givings.some((g) => g.toSeat !== state.dealerIndex);
      if (hasNonDealerReturn) {
        newPhase = 'EXCHANGE_RETURN';
        newSubPhase = 'returning';
        const firstReceiver = givings.find((g) => g.toSeat !== state.dealerIndex);
        newCurrentPlayer = firstReceiver!.toSeat;
      } else {
        // Only dealer needs to return → defer, skip to CUTTER_PICK
        newPhase = 'CUTTER_PICK';
        newCurrentPlayer = state.dealerIndex;
      }
    } else {
      newCurrentPlayer = givings[newGiverIdx].fromSeat;
    }
  }

  return {
    ...state,
    playerHands: newHands,
    dealerPendingReceived: newDealerPendingReceived,
    exchangeInfo: {
      ...state.exchangeInfo,
      givenCards: newGivenCards,
      currentGiverIdx: newGiverIdx,
      subPhase: newSubPhase,
    },
    phase: newPhase,
    currentPlayerIndex: newCurrentPlayer,
  };
}

function handleExchangeReturn(
  state: GameState,
  fromSeat: number,
  cardId: string,
): GameState {
  if (state.phase !== 'EXCHANGE_RETURN') {
    throw new Error(`Cannot return card in phase ${state.phase}`);
  }
  if (!state.exchangeInfo) {
    throw new Error('No exchange info');
  }

  const { givings, givenCards, returnedCards } = state.exchangeInfo;

  // Find which giving this return belongs to (from fromSeat perspective as receiver)
  const pendingReturns = givenCards.filter(
    (g) => g.toSeat === fromSeat &&
      !returnedCards.some(
        (r) => r.fromSeat === fromSeat && r.toSeat === g.fromSeat &&
          returnedCards.filter(
            (rr) => rr.fromSeat === fromSeat && rr.toSeat === g.fromSeat,
          ).length > givenCards.filter(
            (gg) => gg.toSeat === fromSeat && gg.fromSeat === g.fromSeat,
          ).indexOf(g),
      ),
  );

  // Simpler approach: count returns per direction
  const getReturnCount = (from: number, to: number) =>
    returnedCards.filter((r) => r.fromSeat === from && r.toSeat === to).length;

  const getGivenCount = (from: number, to: number) =>
    givenCards.filter((g) => g.fromSeat === from && g.toSeat === to).length;

  // Find the giving direction that still needs returns from this seat
  let targetGiving: { fromSeat: number; toSeat: number } | null = null;
  for (const giving of givings) {
    if (giving.toSeat === fromSeat) {
      const given = getGivenCount(giving.fromSeat, fromSeat);
      const returned = getReturnCount(fromSeat, giving.fromSeat);
      if (returned < given) {
        targetGiving = { fromSeat: giving.fromSeat, toSeat: fromSeat };
        break;
      }
    }
  }

  if (!targetGiving) {
    throw new Error(`No pending returns for seat ${fromSeat}`);
  }

  // Find the received card that needs a return
  const receivedForDirection = givenCards.filter(
    (g) => g.fromSeat === targetGiving!.fromSeat && g.toSeat === fromSeat,
  );
  const returnedForDirection = returnedCards.filter(
    (r) => r.fromSeat === fromSeat && r.toSeat === targetGiving!.fromSeat,
  );
  const receivedCard = receivedForDirection[returnedForDirection.length]?.card;

  if (!receivedCard) {
    throw new Error('Could not find received card to match return');
  }

  // Validate the return: must return highest in same suit if possible
  const hand = state.playerHands[fromSeat];
  const requiredReturn = getRequiredReturnCard(hand, receivedCard);

  const returnedCardObj = hand.find((c) => c.id === cardId);
  if (!returnedCardObj) {
    throw new Error(`Card ${cardId} not in player ${fromSeat}'s hand`);
  }

  // Enforce: if there's a required return (highest in suit), must play that
  if (requiredReturn.id !== receivedCard.id && returnedCardObj.id !== requiredReturn.id) {
    throw new Error(
      `Must return highest card in suit ${receivedCard.suit}. Required: ${requiredReturn.id}, got: ${cardId}`,
    );
  }

  // If required return is the received card itself, player can return any card
  // (Actually per rules: if no higher card in same suit, return the received card)
  if (requiredReturn.id === receivedCard.id && returnedCardObj.id !== receivedCard.id) {
    // They have no higher card in the suit, so they should return the received card
    const sameSuitCards = hand.filter((c) => c.suit === receivedCard.suit);
    const higherCards = sameSuitCards.filter(
      (c) => RANK_VALUE[c.rank] > RANK_VALUE[receivedCard.rank],
    );

    if (higherCards.length === 0) {
      // They must return the received card itself
      if (returnedCardObj.id !== receivedCard.id) {
        throw new Error(`Must return the received card ${receivedCard.id}`);
      }
    }
  }

  // Execute the return
  const newHand = hand.filter((c) => c.id !== cardId);
  const newHands = [...state.playerHands];
  newHands[fromSeat] = newHand;

  // If returning to the dealer, hide the card until after cutter pick
  let newDealerHiddenReturns = [...state.dealerHiddenReturns];
  if (targetGiving.fromSeat === state.dealerIndex) {
    newDealerHiddenReturns.push(returnedCardObj);
  } else {
    const receiverHand = [...state.playerHands[targetGiving.fromSeat], returnedCardObj];
    newHands[targetGiving.fromSeat] = receiverHand;
  }

  const newReturnedCards = [...returnedCards, {
    fromSeat,
    toSeat: targetGiving.fromSeat,
    card: returnedCardObj,
  }];

  const totalReturnsNeeded = givenCards.length;
  const totalReturnsDone = newReturnedCards.length;

  // Count deferred dealer returns (before cutter pick)
  let deferredDealerReturns = 0;
  if (!state.cutterSuit) {
    for (const giving of givings) {
      if (giving.toSeat === state.dealerIndex) {
        const given = givenCards.filter(
          (g) => g.fromSeat === giving.fromSeat && g.toSeat === state.dealerIndex,
        ).length;
        const returned = newReturnedCards.filter(
          (r) => r.fromSeat === state.dealerIndex && r.toSeat === giving.fromSeat,
        ).length;
        deferredDealerReturns += given - returned;
      }
    }
  }

  let newPhase: GamePhase = 'EXCHANGE_RETURN';
  let newCurrentPlayer = fromSeat;

  if (totalReturnsDone + deferredDealerReturns >= totalReturnsNeeded) {
    if (state.cutterSuit) {
      // Post-cutter dealer returns done → go to DEALER_DISCARD
      newPhase = 'DEALER_DISCARD';
    } else {
      newPhase = 'CUTTER_PICK';
    }
    newCurrentPlayer = state.dealerIndex;
  } else {
    // Find next seat that needs to return (skip dealer before cutter pick)
    for (const giving of givings) {
      if (!state.cutterSuit && giving.toSeat === state.dealerIndex) continue;

      const given = givenCards.filter(
        (g) => g.fromSeat === giving.fromSeat && g.toSeat === giving.toSeat,
      ).length;
      const returned = newReturnedCards.filter(
        (r) => r.fromSeat === giving.toSeat && r.toSeat === giving.fromSeat,
      ).length;
      if (returned < given) {
        newCurrentPlayer = giving.toSeat;
        break;
      }
    }
  }

  return {
    ...state,
    playerHands: newHands,
    dealerHiddenReturns: newDealerHiddenReturns,
    exchangeInfo: {
      ...state.exchangeInfo!,
      returnedCards: newReturnedCards,
    },
    phase: newPhase,
    currentPlayerIndex: newCurrentPlayer,
  };
}

function handlePickCutter(state: GameState, suit: Suit): GameState {
  if (state.phase !== 'CUTTER_PICK') {
    throw new Error(`Cannot pick cutter in phase ${state.phase}`);
  }

  const newHands = [...state.playerHands];

  // Reveal hidden exchange returns to dealer's hand (dealer was positive)
  if (state.dealerHiddenReturns.length > 0) {
    newHands[state.dealerIndex] = sortHand([
      ...newHands[state.dealerIndex],
      ...state.dealerHiddenReturns,
    ]);
  }

  // Reveal pending received cards to dealer's hand (dealer was negative)
  if (state.dealerPendingReceived.length > 0) {
    newHands[state.dealerIndex] = sortHand([
      ...newHands[state.dealerIndex],
      ...state.dealerPendingReceived,
    ]);
  }

  // Determine next phase:
  // If dealer received cards (negative delta), they must return → EXCHANGE_RETURN
  // Otherwise → DEALER_DISCARD
  const nextPhase: GamePhase = state.dealerPendingReceived.length > 0
    ? 'EXCHANGE_RETURN'
    : 'DEALER_DISCARD';

  return {
    ...state,
    playerHands: newHands,
    cutterSuit: suit,
    phase: nextPhase,
    currentPlayerIndex: state.dealerIndex,
  };
}

function handleDealerDiscard(state: GameState, cardIds: string[]): GameState {
  if (state.phase !== 'DEALER_DISCARD') {
    throw new Error(`Cannot discard in phase ${state.phase}`);
  }
  if (cardIds.length !== 4) {
    throw new Error('Must discard exactly 4 cards');
  }

  // Dealer discards 4 from their 16 cards, then receives 4 kupa cards
  const dealerHand = [...state.playerHands[state.dealerIndex]];
  const discarded: Card[] = [];

  for (const id of cardIds) {
    const idx = dealerHand.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Card ${id} not in dealer's hand`);
    }
    discarded.push(dealerHand[idx]);
    dealerHand.splice(idx, 1);
  }

  // Now dealer has 12 cards; add the 4 kupa cards → back to 16
  const kupaCards = [...state.kupa];
  const finalHand = sortHand([...dealerHand, ...kupaCards]);

  const newHands = [...state.playerHands];
  newHands[state.dealerIndex] = finalHand;

  // First trick starts with target-5 player
  const firstLeader = getTarget5Seat(state.dealerIndex);

  return {
    ...state,
    playerHands: newHands,
    dealerDiscarded: discarded,
    dealerReceivedKupa: kupaCards,
    kupa: [],
    phase: 'TRICK_PLAY',
    trickNumber: 1,
    currentTrick: {
      leaderIndex: firstLeader,
      leadSuit: null,
      cardsPlayed: [],
    },
    currentPlayerIndex: firstLeader,
  };
}

function handlePlayCard(
  state: GameState,
  seatIndex: number,
  cardId: string,
): GameState {
  if (state.phase !== 'TRICK_PLAY') {
    throw new Error(`Cannot play card in phase ${state.phase}`);
  }
  if (seatIndex !== state.currentPlayerIndex) {
    throw new Error(`Not seat ${seatIndex}'s turn, expected ${state.currentPlayerIndex}`);
  }
  if (!state.currentTrick) {
    throw new Error('No current trick');
  }

  const hand = state.playerHands[seatIndex];
  const card = hand.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not in seat ${seatIndex}'s hand`);
  }

  // Validate legal play
  if (!isLegalPlay(hand, cardId, state.currentTrick.leadSuit)) {
    throw new Error(
      `Illegal play: must follow suit ${state.currentTrick.leadSuit}`,
    );
  }

  // Remove card from hand
  const newHand = hand.filter((c) => c.id !== cardId);
  const newHands = [...state.playerHands];
  newHands[seatIndex] = newHand;

  // Add card to trick
  const newCardsPlayed = [...state.currentTrick.cardsPlayed, { seatIndex, card }];
  const leadSuit = state.currentTrick.leadSuit ?? card.suit;

  // Check if trick is complete (3 cards played)
  if (newCardsPlayed.length === 3) {
    // Determine trick winner
    const completeTrick: TrickCurrent = {
      leaderIndex: state.currentTrick.leaderIndex,
      leadSuit,
      cardsPlayed: newCardsPlayed,
    };
    const winnerIndex = determineTrickWinner(completeTrick, state.cutterSuit);

    const trickResult: TrickResult = {
      trickNumber: state.trickNumber,
      cardsPlayed: newCardsPlayed,
      leadSuit,
      winnerIndex,
    };

    const newTricksHistory = [...state.tricksHistory, trickResult];
    const newTricksTaken = [...state.tricksTakenCount];
    newTricksTaken[winnerIndex]++;

    // Check if hand is complete (16 tricks)
    if (state.trickNumber >= 16) {
      // Hand complete → scoring
      const deltas = state.targets.map(
        (target, i) => calculateHandDelta(newTricksTaken[i], target),
      );
      const newScoreTotal = state.scoreTotal.map((s, i) => s + deltas[i]);

      const handRecord: HandRecord = {
        handNumber: state.handNumber,
        dealerIndex: state.dealerIndex,
        cutterSuit: state.cutterSuit!,
        tricksTaken: newTricksTaken,
        targets: state.targets,
        deltas,
        tricks: newTricksHistory,
      };

      // Check for victory
      const victoryCandidates = checkVictory(newScoreTotal, state.victoryTarget);
      if (victoryCandidates.length > 0) {
        // Game over - apply tie-breaking if needed
        const trickSummaries = newTricksHistory.map((t) => ({
          trickNumber: t.trickNumber,
          winnerIndex: t.winnerIndex,
        }));
        const { winnerSeat, reason } = applyTieBreaker(
          victoryCandidates,
          deltas,
          trickSummaries,
        );

        return {
          ...state,
          playerHands: newHands,
          currentTrick: null,
          tricksHistory: newTricksHistory,
          tricksTakenCount: newTricksTaken,
          scoreTotal: newScoreTotal,
          lastHandDelta: deltas,
          handHistory: [...state.handHistory, handRecord],
          phase: 'GAME_OVER',
          winnerIndex: winnerSeat,
          winnerReason: reason,
          currentPlayerIndex: -1,
        };
      }

      // Hand complete but game continues
      return {
        ...state,
        playerHands: newHands,
        currentTrick: null,
        tricksHistory: newTricksHistory,
        tricksTakenCount: newTricksTaken,
        scoreTotal: newScoreTotal,
        lastHandDelta: deltas,
        handHistory: [...state.handHistory, handRecord],
        phase: 'HAND_SCORING',
        currentPlayerIndex: -1,
      };
    }

    // More tricks to play - winner leads next trick
    return {
      ...state,
      playerHands: newHands,
      trickNumber: state.trickNumber + 1,
      currentTrick: {
        leaderIndex: winnerIndex,
        leadSuit: null,
        cardsPlayed: [],
      },
      tricksHistory: newTricksHistory,
      tricksTakenCount: newTricksTaken,
      currentPlayerIndex: winnerIndex,
    };
  }

  // Trick not complete - next player clockwise
  const nextPlayer = nextPlayerClockwise(seatIndex);

  return {
    ...state,
    playerHands: newHands,
    currentTrick: {
      ...state.currentTrick,
      leadSuit,
      cardsPlayed: newCardsPlayed,
    },
    currentPlayerIndex: nextPlayer,
  };
}

function handleNextHand(state: GameState): GameState {
  if (state.phase !== 'HAND_SCORING') {
    throw new Error(`Cannot start next hand in phase ${state.phase}`);
  }

  const newDealerIndex = nextDealer(state.dealerIndex);
  const newTargets = getTargetsForHand(newDealerIndex);

  return {
    ...state,
    dealerIndex: newDealerIndex,
    targets: newTargets,
    phase: 'SETUP_DEAL',
    currentPlayerIndex: newDealerIndex,
    cutterSuit: null,
    exchangeInfo: null,
    currentTrick: null,
    trickNumber: 0,
    tricksHistory: [],
    tricksTakenCount: [0, 0, 0],
    deck: [],
    kupa: [],
    playerHands: [[], [], []],
    dealerDiscarded: [],
    dealerReceivedKupa: [],
    dealerHiddenReturns: [],
    dealerPendingReceived: [],
  };
}

// ============================================================
// View helpers (for UI / online — hide private info)
// ============================================================

/**
 * Create a sanitized view of the game state for a specific player.
 * Hides other players' hands and kupa (unless dealer during kupa phase).
 */
export function getPlayerView(state: GameState, seatIndex: number): GameState {
  const sanitizedHands: Card[][] = state.playerHands.map((hand, i) => {
    if (i === seatIndex) return hand;
    // Other players' hands: return empty placeholder cards
    return hand.map(() => ({ suit: 'S' as Suit, rank: '2' as any, id: 'hidden' }));
  });

  // Kupa: only visible to dealer during DEALER_DISCARD phase (after they take it)
  // Actually kupa is visible only to dealer
  const sanitizedKupa =
    seatIndex === state.dealerIndex
      ? state.kupa
      : state.kupa.map(() => ({ suit: 'S' as Suit, rank: '2' as any, id: 'hidden' }));

  // Sanitize exchange info
  let sanitizedExchangeInfo = state.exchangeInfo;
  if (state.exchangeInfo) {
    sanitizedExchangeInfo = {
      ...state.exchangeInfo,
      givenCards: state.exchangeInfo.givenCards.map((g) => {
        if (g.fromSeat === seatIndex || g.toSeat === seatIndex) {
          return g;
        }
        return { ...g, card: { suit: 'S' as Suit, rank: '2' as any, id: 'hidden' } };
      }),
      returnedCards: state.exchangeInfo.returnedCards.map((r) => {
        if (r.fromSeat === seatIndex || r.toSeat === seatIndex) {
          return r;
        }
        return { ...r, card: { suit: 'S' as Suit, rank: '2' as any, id: 'hidden' } };
      }),
    };
  }

  return {
    ...state,
    playerHands: sanitizedHands,
    kupa: sanitizedKupa,
    exchangeInfo: sanitizedExchangeInfo,
  };
}
