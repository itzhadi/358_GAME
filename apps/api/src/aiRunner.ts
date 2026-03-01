import { Server as SocketIOServer } from 'socket.io';
import {
  GameAction, GameState, getReshuffleSide,
  aiPlayCard, aiSelectDiscard, aiExchangeGive,
  aiExchangeReturn, aiPickCutter, aiShouldReshuffle,
  getPlayerView,
} from '@358/shared';
import { roomManager } from './roomManager.js';

const aiTimers = new Map<string, NodeJS.Timeout>();

function broadcastState(io: SocketIOServer, roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room?.gameState) return;
  for (const p of room.players) {
    if (p.socketId) {
      const view = getPlayerView(room.gameState, p.seatIndex);
      io.to(p.socketId).emit('game:privateHand', view);
    }
  }
}

function applyAndBroadcast(io: SocketIOServer, roomCode: string, action: GameAction): boolean {
  const result = roomManager.applyAction(roomCode, action);
  if ('error' in result) {
    console.error('AI action failed:', action.type, result.error);
    return false;
  }
  broadcastState(io, roomCode);
  return true;
}

function computeAiAction(state: GameState, aiSeat: number): GameAction | null {
  const hand = state.playerHands[aiSeat];

  switch (state.phase) {
    case 'CUTTER_PICK': {
      if (state.currentPlayerIndex !== aiSeat) return null;
      const suit = aiPickCutter(hand);
      return { type: 'PICK_CUTTER', payload: { suit } };
    }

    case 'DEALER_DISCARD': {
      if (state.currentPlayerIndex !== aiSeat) return null;
      const discardIds = aiSelectDiscard(hand, state.cutterSuit!);
      return { type: 'DEALER_DISCARD_4', payload: { cardIds: discardIds } };
    }

    case 'EXCHANGE_GIVE': {
      if (!state.exchangeInfo) return null;
      const giving = state.exchangeInfo.givings[state.exchangeInfo.currentGiverIdx];
      if (!giving || giving.fromSeat !== aiSeat) return null;
      const cardIds = aiExchangeGive(hand, 1);
      if (cardIds.length === 0) return null;
      return { type: 'EXCHANGE_GIVE_CARD', payload: { fromSeat: aiSeat, cardId: cardIds[0] } };
    }

    case 'EXCHANGE_RETURN': {
      if (!state.exchangeInfo) return null;
      const { givings, givenCards, returnedCards } = state.exchangeInfo;

      for (const giving of givings) {
        if (giving.toSeat !== aiSeat) continue;
        const givenForDir = givenCards.filter(
          (g) => g.fromSeat === giving.fromSeat && g.toSeat === aiSeat,
        );
        const returnedForDir = returnedCards.filter(
          (r) => r.fromSeat === aiSeat && r.toSeat === giving.fromSeat,
        );
        if (returnedForDir.length < givenForDir.length) {
          const receivedCard = givenForDir[returnedForDir.length]?.card;
          if (receivedCard) {
            const primaryId = aiExchangeReturn(hand, receivedCard);
            if (hand.some((c) => c.id === primaryId)) {
              return { type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: aiSeat, cardId: primaryId } };
            }
            if (hand.some((c) => c.id === receivedCard.id)) {
              return { type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: aiSeat, cardId: receivedCard.id } };
            }
            for (const c of hand) {
              return { type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: aiSeat, cardId: c.id } };
            }
          }
        }
      }
      return null;
    }

    case 'TRICK_PLAY': {
      if (state.currentPlayerIndex !== aiSeat) return null;
      const leadSuit = state.currentTrick?.leadSuit ?? null;
      const trickCards = state.currentTrick?.cardsPlayed ?? [];
      const cardId = aiPlayCard(hand, leadSuit, state.cutterSuit, trickCards, state);
      return { type: 'PLAY_CARD', payload: { seatIndex: aiSeat, cardId } };
    }

    default:
      return null;
  }
}

function getDelay(phase: string): number {
  switch (phase) {
    case 'TRICK_PLAY': return 1200;
    case 'CUTTER_PICK': return 2800;
    case 'EXCHANGE_GIVE':
    case 'EXCHANGE_RETURN': return 600;
    case 'DEALER_DISCARD': return 1000;
    case 'RESHUFFLE_WINDOW': return 1500;
    default: return 800;
  }
}

export function scheduleAiTurn(io: SocketIOServer, roomCode: string) {
  const prev = aiTimers.get(roomCode);
  if (prev) clearTimeout(prev);

  const room = roomManager.getRoom(roomCode);
  if (!room?.gameState || room.aiSeat === null) return;

  const state = room.gameState;
  const aiSeat = room.aiSeat;

  if (state.phase === 'RESHUFFLE_WINDOW') {
    const can8 = !state.reshuffleUsedBy8 && state.reshuffleWindowFor8;
    const can35 = !state.reshuffleUsedBy35 && state.reshuffleWindowFor35;

    if (!can8 && !can35) {
      const timer = setTimeout(() => {
        aiTimers.delete(roomCode);
        if (state.reshuffleWindowFor8) {
          applyAndBroadcast(io, roomCode, { type: 'RESHUFFLE_DECLINE', payload: { side: '8' } });
        }
        if (state.reshuffleWindowFor35) {
          applyAndBroadcast(io, roomCode, { type: 'RESHUFFLE_DECLINE', payload: { side: '35' } });
        }
        scheduleAiTurn(io, roomCode);
      }, 500);
      aiTimers.set(roomCode, timer);
      return;
    }

    const aiSide = getReshuffleSide(aiSeat, state.dealerIndex);

    if (aiSide === '8' && can8) {
      const wants = aiShouldReshuffle(state.playerHands[aiSeat], 8);
      const timer = setTimeout(() => {
        aiTimers.delete(roomCode);
        applyAndBroadcast(io, roomCode, {
          type: wants ? 'RESHUFFLE_ACCEPT' : 'RESHUFFLE_DECLINE',
          payload: { side: '8' },
        });
        scheduleAiTurn(io, roomCode);
      }, getDelay('RESHUFFLE_WINDOW'));
      aiTimers.set(roomCode, timer);
      return;
    }

    // AI is on side 35 — don't auto-act; the human partner decides first
    // and socket.ts will consult aiEvaluateSide35 when the human votes
    return;
  }

  if (state.phase === 'GAME_OVER') return;

  if (state.phase === 'HAND_SCORING' && state.dealerIndex === aiSeat) {
    const timer = setTimeout(() => {
      aiTimers.delete(roomCode);
      const ok = applyAndBroadcast(io, roomCode, { type: 'NEXT_HAND' });
      if (ok) scheduleAiTurn(io, roomCode);
    }, 4000);
    aiTimers.set(roomCode, timer);
    return;
  }
  if (state.phase === 'HAND_SCORING') return;

  if (state.phase === 'SETUP_DEAL' && state.dealerIndex === aiSeat) {
    const timer = setTimeout(() => {
      aiTimers.delete(roomCode);
      const ok = applyAndBroadcast(io, roomCode, { type: 'SHUFFLE_DEAL' });
      if (ok) scheduleAiTurn(io, roomCode);
    }, 1500);
    aiTimers.set(roomCode, timer);
    return;
  }
  if (state.phase === 'SETUP_DEAL') return;

  const action = computeAiAction(state, aiSeat);
  if (!action) {
    // Safety net: if AI should act but computeAiAction returned null, retry after delay
    if (state.currentPlayerIndex === aiSeat) {
      console.warn(`[aiRunner] computeAiAction returned null but AI is current player. phase=${state.phase}`);
      const retryTimer = setTimeout(() => {
        aiTimers.delete(roomCode);
        scheduleAiTurn(io, roomCode);
      }, 2000);
      aiTimers.set(roomCode, retryTimer);
    }
    return;
  }

  const timer = setTimeout(() => {
    aiTimers.delete(roomCode);
    const ok = applyAndBroadcast(io, roomCode, action);
    if (ok) {
      scheduleAiTurn(io, roomCode);
    } else {
      // Action failed — re-read state and retry once
      console.warn(`[aiRunner] action ${action.type} failed, retrying with fresh state`);
      const freshRoom = roomManager.getRoom(roomCode);
      if (freshRoom?.gameState && freshRoom.aiSeat !== null) {
        const freshAction = computeAiAction(freshRoom.gameState, freshRoom.aiSeat);
        if (freshAction) {
          const retryOk = applyAndBroadcast(io, roomCode, freshAction);
          if (retryOk) {
            scheduleAiTurn(io, roomCode);
            return;
          }
        }
      }
      // Still failed — schedule another full retry after a delay
      const retryTimer = setTimeout(() => {
        aiTimers.delete(roomCode);
        scheduleAiTurn(io, roomCode);
      }, 3000);
      aiTimers.set(roomCode, retryTimer);
    }
  }, getDelay(state.phase));
  aiTimers.set(roomCode, timer);
}

export function aiEvaluateSide35(roomCode: string): boolean {
  const room = roomManager.getRoom(roomCode);
  if (!room?.gameState || room.aiSeat === null) return false;
  const aiSeat = room.aiSeat;
  const hand = room.gameState.playerHands[aiSeat];
  const target = room.gameState.targets[aiSeat];
  return aiShouldReshuffle(hand, target);
}

export function cancelAiTimer(roomCode: string) {
  const timer = aiTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    aiTimers.delete(roomCode);
  }
}
