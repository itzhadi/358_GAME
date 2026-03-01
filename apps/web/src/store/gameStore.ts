import { create } from 'zustand';
import {
  GameState, GameAction, Card, Suit, GamePhase,
  CreateGamePayload, getLegalCards, getRequiredReturnCard,
  aiSelectDiscard, aiPlayCard,
  aiExchangeGive, aiExchangeReturn,
  aiShouldReshuffle, getReshuffleSide,
} from '@358/shared';
import { createGame, gameReducer } from '@358/shared';
import { socket } from '@/lib/socket';

interface GameStore {
  gameState: GameState | null;
  mode: 'local' | 'online';

  // AI players
  aiSeats: Set<number>;

  // Online state
  roomCode: string | null;
  playerId: string | null;
  playerSeat: number | null;
  isConnected: boolean;
  token: string | null;

  lobbyState: {
    code: string;
    maxPlayers?: 2 | 3;
    aiSeat?: number | null;
    players: { name: string; seatIndex: number; connected: boolean }[];
    status: string;
  } | null;

  activePlayerSeat: number;
  showPrivacyScreen: boolean;
  showTrickResult: boolean;
  lastTrickWinner: number | null;
  showReceivedCards: boolean;
  showDealerKupa: boolean;
  showDealerReturns: boolean;
  pendingTrickState: GameState | null;
  reshuffleNotification: string | null;
  reshuffleVoteStatus: { votedSeat: number; vote: 'accept' | 'decline' } | null;
  myReshuffleVote: 'accept' | 'decline' | null;

  // Actions
  startLocalGame: (players: { id: string; name: string }[], victoryTarget: number, aiSeats?: number[]) => void;
  connectSocket: () => void;
  createRoom: (hostName: string, victoryTarget: number, maxPlayers?: 2 | 3) => Promise<void>;
  joinRoom: (roomCode: string, playerName: string) => Promise<void>;
  startOnlineGame: () => void;
  leaveRoom: () => void;
  dispatch: (action: GameAction) => void;
  setActivePlayer: (seat: number) => void;
  showPrivacy: () => void;
  hidePrivacy: () => void;
  dismissTrickResult: () => void;
  dismissReceivedCards: () => void;
  dismissDealerKupa: () => void;
  dismissDealerReturns: () => void;
  resetGame: () => void;
  runAiTurn: () => void;

  // Helpers
  getLegalCardsForCurrentPlayer: () => Card[];
  isCurrentPlayerAI: () => boolean;
}

let reshuffleNotifTimer: ReturnType<typeof setTimeout> | null = null;
let trickDisplayTimer: ReturnType<typeof setTimeout> | null = null;
let cutterRevealTimer: ReturnType<typeof setTimeout> | null = null;

function showReshuffleNotif(setFn: (state: Partial<GameStore>) => void, msg: string, duration: number) {
  if (reshuffleNotifTimer) clearTimeout(reshuffleNotifTimer);
  setFn({ reshuffleNotification: msg });
  reshuffleNotifTimer = setTimeout(() => {
    setFn({ reshuffleNotification: null });
    reshuffleNotifTimer = null;
  }, duration);
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  mode: 'local',
  aiSeats: new Set(),
  activePlayerSeat: 0,
  showPrivacyScreen: false,
  showTrickResult: false,
  lastTrickWinner: null,
  showReceivedCards: false,
  showDealerKupa: false,
  showDealerReturns: false,
  pendingTrickState: null,
  reshuffleNotification: null,
  reshuffleVoteStatus: null,
  myReshuffleVote: null,
  roomCode: null,
  playerId: null,
  playerSeat: null,
  isConnected: false,
  token: null,
  lobbyState: null,

  startLocalGame: (players, victoryTarget, aiSeatsList = []) => {
    const dealerIndex = Math.floor(Math.random() * 3);
    const state = createGame({
      gameId: `local-${Date.now()}`,
      mode: 'local',
      players,
      victoryTarget,
      dealerIndex,
    });
    set({
      gameState: state,
      mode: 'local',
      aiSeats: new Set(aiSeatsList),
      activePlayerSeat: 0,
      showPrivacyScreen: false,
      roomCode: null,
      playerId: null,
      playerSeat: null,
    });
  },

  connectSocket: () => {
    // Remove old listeners to prevent duplicates
    socket.off('connect');
    socket.off('disconnect');
    socket.off('room:created');
    socket.off('room:joined');
    socket.off('room:state');
    socket.off('room:closed');
    socket.off('room:playerDisconnected');
    socket.off('room:playerReconnected');
    socket.off('game:privateHand');
    socket.off('error');
    socket.off('reshuffle:voteStatus');

    socket.on('connect', () => {
      set({ isConnected: true });
      const { token, roomCode } = get();
      if (token && roomCode) {
        socket.emit('room:reconnect', { token });
      }
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('room:playerDisconnected', ({ playerName }: { playerName: string }) => {
      console.log(`${playerName} disconnected temporarily`);
    });

    socket.on('room:playerReconnected', ({ playerName }: { playerName: string }) => {
      console.log(`${playerName} reconnected`);
    });

    socket.on('room:created', ({ code, token, seatIndex }) => {
      set({ roomCode: code, token, playerSeat: seatIndex, activePlayerSeat: seatIndex, mode: 'online' });
    });

    socket.on('room:joined', ({ code, token, seatIndex }) => {
      set({ roomCode: code, token, playerSeat: seatIndex, activePlayerSeat: seatIndex, mode: 'online' });
    });

    socket.on('room:state', (data) => {
      set({ lobbyState: data });
    });

    socket.on('room:closed', ({ reason }: { reason: string }) => {
      alert(reason);
      set({
        gameState: null,
        mode: 'local',
        roomCode: null,
        token: null,
        playerSeat: null,
        lobbyState: null,
        showTrickResult: false,
        showReceivedCards: false,
        showDealerKupa: false,
        showDealerReturns: false,
      });
    });

    socket.on('game:privateHand', (serverState) => {
      const newState = serverState as GameState;
      const prev = get();
      const prevState = prev.gameState;
      const mySeat = prev.playerSeat ?? 0;

      if (!prevState && prev.lobbyState?.aiSeat != null) {
        set({ aiSeats: new Set([prev.lobbyState.aiSeat]) });
      }

      // If a cutter reveal timer is pending and new state arrives, cancel it and use latest
      if (cutterRevealTimer) {
        clearTimeout(cutterRevealTimer);
        cutterRevealTimer = null;
      }

      // If a trick display timer is pending and new state arrives, cancel it and apply both
      if (trickDisplayTimer && prev.pendingTrickState) {
        clearTimeout(trickDisplayTimer);
        trickDisplayTimer = null;
        set({ gameState: newState, showTrickResult: true, pendingTrickState: null });
        return;
      }

      // Detect exchange cards returned TO me (I was the giver, someone returned cards to me)
      if (prevState?.exchangeInfo && newState.exchangeInfo) {
        const prevReturnedToMe = prevState.exchangeInfo.returnedCards.filter(r => r.toSeat === mySeat).length;
        const newReturnedToMe = newState.exchangeInfo.returnedCards.filter(r => r.toSeat === mySeat).length;
        if (newReturnedToMe > prevReturnedToMe) {
          set({ gameState: newState, showReceivedCards: true });
          return;
        }
      }

      // Detect phase transition from exchange to CUTTER_PICK — show what was returned to me
      if (
        prevState?.phase === 'EXCHANGE_RETURN' &&
        newState.phase === 'CUTTER_PICK' &&
        newState.exchangeInfo
      ) {
        const returnedToMe = newState.exchangeInfo.returnedCards.filter(r => r.toSeat === mySeat);
        if (returnedToMe.length > 0 && mySeat !== newState.dealerIndex) {
          set({ gameState: newState, showReceivedCards: true });
          return;
        }
      }

      // AI picked cutter — show reveal briefly before moving on
      // Guard: currentPlayerIndex !== -1 prevents re-triggering from a displayState
      if (
        prevState?.phase === 'CUTTER_PICK' &&
        prevState.currentPlayerIndex !== -1 &&
        newState.phase !== 'CUTTER_PICK' &&
        newState.cutterSuit &&
        prev.aiSeats.size > 0 &&
        prev.aiSeats.has(newState.dealerIndex)
      ) {
        const displayState: GameState = {
          ...prevState,
          cutterSuit: newState.cutterSuit,
          phase: 'CUTTER_PICK',
          currentPlayerIndex: -1,
        };
        set({ gameState: displayState });
        cutterRevealTimer = setTimeout(() => {
          cutterRevealTimer = null;
          set({ gameState: newState });
        }, 1800);
        return;
      }

      // Show kupa cards to dealer after discarding in online mode
      if (
        prevState?.phase === 'DEALER_DISCARD' &&
        newState.phase === 'TRICK_PLAY' &&
        mySeat === newState.dealerIndex &&
        newState.dealerReceivedKupa.length > 0
      ) {
        set({ gameState: newState, showDealerKupa: true });
        return;
      }

      // Show dealer returns screen when transitioning from exchange to cutter pick
      if (
        prevState?.phase === 'EXCHANGE_RETURN' &&
        (newState.phase === 'CUTTER_PICK' || newState.phase === 'TRICK_PLAY') &&
        mySeat === newState.dealerIndex &&
        (newState.dealerHiddenReturns.length > 0 || newState.dealerPendingReceived.length > 0)
      ) {
        set({ gameState: newState, showDealerReturns: true });
        return;
      }

      // Trick just completed — show all 3 cards briefly before moving on
      if (
        prevState?.phase === 'TRICK_PLAY' &&
        prevState.currentTrick &&
        prevState.currentTrick.cardsPlayed.length === 2 &&
        newState.tricksHistory.length > prevState.tricksHistory.length
      ) {
        const completedTrick = newState.tricksHistory[newState.tricksHistory.length - 1];
        const displayState: GameState = {
          ...prevState,
          playerHands: newState.playerHands,
          currentPlayerIndex: -1,
          currentTrick: {
            leaderIndex: completedTrick.cardsPlayed[0].seatIndex,
            leadSuit: completedTrick.leadSuit,
            cardsPlayed: completedTrick.cardsPlayed,
          },
        };
        set({
          gameState: displayState,
          lastTrickWinner: completedTrick.winnerIndex,
          pendingTrickState: newState,
        });
        trickDisplayTimer = setTimeout(() => {
          trickDisplayTimer = null;
          set({
            gameState: newState,
            showTrickResult: true,
            pendingTrickState: null,
          });
        }, 1200);
        return;
      }

      // Reshuffle notifications in online mode
      if (prevState?.phase === 'RESHUFFLE_WINDOW' && newState.phase === 'RESHUFFLE_WINDOW') {
        if (!prevState.reshuffleUsedBy8 && newState.reshuffleUsedBy8) {
          const dealerName = newState.players[newState.dealerIndex].name;
          showReshuffleNotif(set, `${dealerName} (8) ביקש חלוקה מחדש — הקלפים חולקו מחדש!`, 2500);
        } else if (!prevState.reshuffleUsedBy35 && newState.reshuffleUsedBy35) {
          showReshuffleNotif(set, `צד 3+5 ביקש חלוקה מחדש — הקלפים חולקו מחדש!`, 2500);
        }
      }

      set({ gameState: newState, reshuffleVoteStatus: null, myReshuffleVote: null });
    });

    socket.on('reshuffle:voteStatus', (status: { votedSeat: number; vote: 'accept' | 'decline' } | null) => {
      set({ reshuffleVoteStatus: status });
    });

    socket.on('error', ({ code, message }: { code: string; message: string }) => {
      console.error('Socket error:', code, message);
      if (message.includes('Room not found') || message.includes('Game not started')) {
        alert('החדר לא נמצא — ייתכן שהשרת אותחל מחדש. יש ליצור משחק חדש.');
        set({ gameState: null, roomCode: null, token: null, lobbyState: null });
      } else if (message.includes("'s turn")) {
        // Turn-order timing issue — ignore silently, state will sync
      } else {
        alert(`שגיאה: ${message}`);
      }
    });

    if (!socket.connected) {
      socket.connect();
    }
  },

  createRoom: async (hostName, victoryTarget, maxPlayers = 3) => {
    get().connectSocket();
    if (!socket.connected) {
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
          socket.once('connect', () => { clearTimeout(timeout); resolve(); });
          socket.once('connect_error', (err) => { clearTimeout(timeout); reject(err); });
        });
      } catch {
        alert('לא ניתן להתחבר לשרת. ודא שהשרת רץ.');
        return;
      }
    }
    socket.emit('room:create', { roomName: `${hostName}'s Room`, hostName, victoryTarget, maxPlayers });
  },

  joinRoom: async (roomCode, playerName) => {
    get().connectSocket();
    if (!socket.connected) {
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
          socket.once('connect', () => { clearTimeout(timeout); resolve(); });
          socket.once('connect_error', (err) => { clearTimeout(timeout); reject(err); });
        });
      } catch {
        alert('לא ניתן להתחבר לשרת. ודא שהשרת רץ.');
        return;
      }
    }
    socket.emit('room:join', { roomCode, playerName });
  },

  startOnlineGame: () => {
    const { token } = get();
    if (!token) return;
    socket.emit('game:start', { token });
  },

  leaveRoom: () => {
    const { token } = get();
    if (token) {
      socket.emit('room:leave', { token });
    }
    socket.disconnect();
    set({
      gameState: null,
      mode: 'local',
      roomCode: null,
      token: null,
      playerId: null,
      playerSeat: null,
      isConnected: false,
      lobbyState: null,
    });
  },

  dispatch: (action) => {
    const { gameState, mode, token } = get();
    if (!gameState) return;

    if (mode === 'online') {
      if (!token) return;
      switch (action.type) {
        case 'EXCHANGE_GIVE_CARD':
          socket.emit('exchange:give', { token, cardId: action.payload.cardId });
          break;
        case 'EXCHANGE_RETURN_CARD':
          socket.emit('exchange:return', { token, cardId: action.payload.cardId });
          break;
        case 'PICK_CUTTER':
          socket.emit('cutter:pick', { token, suit: action.payload.suit });
          break;
        case 'DEALER_DISCARD_4':
          socket.emit('dealer:discard', { token, cardIds: action.payload.cardIds });
          break;
        case 'PLAY_CARD':
          if (gameState.currentPlayerIndex !== (get().playerSeat ?? -1)) return;
          socket.emit('play:card', { token, cardId: action.payload.cardId });
          break;
        case 'NEXT_HAND':
          socket.emit('game:nextHand', { token });
          break;
        case 'SHUFFLE_DEAL':
          socket.emit('game:deal', { token });
          break;
        case 'RESHUFFLE_ACCEPT':
          socket.emit('reshuffle:accept', { token, side: action.payload.side });
          if (action.payload.side === '35') set({ myReshuffleVote: 'accept' });
          break;
        case 'RESHUFFLE_DECLINE':
          socket.emit('reshuffle:decline', { token, side: action.payload.side });
          if (action.payload.side === '35') set({ myReshuffleVote: 'decline' });
          break;
      }
      return;
    }

    try {
      const { aiSeats: aiSeatsEarly } = get();
      if (
        action.type === 'RESHUFFLE_ACCEPT' &&
        action.payload.side === '35' &&
        aiSeatsEarly.size > 0
      ) {
        const humanSeat = 0;
        const humanSide = getReshuffleSide(humanSeat, gameState.dealerIndex);
        if (humanSide === '35') {
          const nonDealers = [0, 1, 2].filter(s => s !== gameState.dealerIndex);
          const partnerSeat = nonDealers.find(s => s !== humanSeat);
          if (partnerSeat !== undefined && aiSeatsEarly.has(partnerSeat)) {
            const partnerWants = aiShouldReshuffle(
              gameState.playerHands[partnerSeat],
              gameState.targets[partnerSeat],
            );
            if (!partnerWants) {
              const pName = gameState.players[partnerSeat].name;
              const pTarget = gameState.targets[partnerSeat];
              const declineState = gameReducer(gameState, { type: 'RESHUFFLE_DECLINE', payload: { side: '35' } });
              const msg = `${pName} (${pTarget}) לא מסכים — ממשיכים לשחק`;
              set({ gameState: declineState, activePlayerSeat: 0, reshuffleNotification: msg });
              showReshuffleNotif(set, msg, 2500);
              return;
            }
          }
        }
      }

      const newState = gameReducer(gameState, action);

      if (
        action.type === 'PLAY_CARD' &&
        newState.tricksHistory.length > gameState.tricksHistory.length
      ) {
        const lastTrick = newState.tricksHistory[newState.tricksHistory.length - 1];
        const playedCard = gameState.playerHands[action.payload.seatIndex].find(
          (c) => c.id === action.payload.cardId,
        );
        // Show all 3 cards on the table for 1s before opening trick result
        const displayState: GameState = {
          ...gameState,
          playerHands: newState.playerHands,
          currentPlayerIndex: -1,
          currentTrick: {
            leaderIndex: gameState.currentTrick!.leaderIndex,
            leadSuit: gameState.currentTrick!.leadSuit ?? playedCard!.suit,
            cardsPlayed: [
              ...gameState.currentTrick!.cardsPlayed,
              { seatIndex: action.payload.seatIndex, card: playedCard! },
            ],
          },
        };
        set({
          gameState: displayState,
          lastTrickWinner: lastTrick.winnerIndex,
          pendingTrickState: newState,
        });
        setTimeout(() => {
          set({
            gameState: newState,
            showTrickResult: true,
            pendingTrickState: null,
          });
        }, 1000);
        return;
      }

      const { aiSeats } = get();
      const hasAI = aiSeats.size > 0;

      // Show exchange summary when exchange return completes → phase moves to CUTTER_PICK
      // Skip for dealer — their cards are handled via DealerReturnsScreen
      if (
        action.type === 'EXCHANGE_RETURN_CARD' &&
        newState.phase === 'CUTTER_PICK' &&
        newState.exchangeInfo
      ) {
        const humanSeat = hasAI ? 0 : get().activePlayerSeat;
        const isDealer = humanSeat === newState.dealerIndex;

        if (!isDealer) {
          const returnedToHuman = newState.exchangeInfo.returnedCards.filter(
            (r) => r.toSeat === humanSeat,
          );
          const returnedByHuman = newState.exchangeInfo.returnedCards.filter(
            (r) => r.fromSeat === humanSeat,
          );
          if (returnedToHuman.length > 0 || returnedByHuman.length > 0) {
            set({
              gameState: newState,
              showReceivedCards: true,
              activePlayerSeat: hasAI ? 0 : newState.currentPlayerIndex,
            });
            return;
          }
        }
      }

      // Show received cards after dealer's post-cutter returns complete → phase moves to DEALER_DISCARD
      if (
        action.type === 'EXCHANGE_RETURN_CARD' &&
        newState.phase === 'DEALER_DISCARD' &&
        newState.exchangeInfo
      ) {
        const humanSeat = hasAI ? 0 : get().activePlayerSeat;
        // Show returns that were made to the human (who was positive, gave to dealer)
        if (humanSeat !== newState.dealerIndex) {
          const returnedToHuman = newState.exchangeInfo.returnedCards.filter(
            (r) => r.toSeat === humanSeat,
          );
          if (returnedToHuman.length > 0) {
            set({
              gameState: newState,
              showReceivedCards: true,
              activePlayerSeat: hasAI ? 0 : newState.currentPlayerIndex,
            });
            return;
          }
        }
      }

      // Show hidden cards to dealer after cutter pick
      // Case 1: dealer was positive → dealerHiddenReturns (returns hidden), next = DEALER_DISCARD
      // Case 2: dealer was negative → dealerPendingReceived (given cards hidden), next = EXCHANGE_RETURN
      if (
        action.type === 'PICK_CUTTER' &&
        (gameState.dealerHiddenReturns.length > 0 || gameState.dealerPendingReceived.length > 0)
      ) {
        const humanSeat = hasAI ? 0 : get().activePlayerSeat;
        if (gameState.dealerIndex === humanSeat) {
          set({
            gameState: newState,
            showDealerReturns: true,
            activePlayerSeat: hasAI ? 0 : newState.currentPlayerIndex,
          });
          return;
        }
      }

      // Show kupa cards to dealer after discarding
      if (
        action.type === 'DEALER_DISCARD_4' &&
        newState.phase === 'TRICK_PLAY' &&
        newState.dealerReceivedKupa.length > 0
      ) {
        const humanSeat = hasAI ? 0 : get().activePlayerSeat;
        if (gameState.dealerIndex === humanSeat) {
          set({
            gameState: newState,
            showDealerKupa: true,
            activePlayerSeat: hasAI ? 0 : newState.currentPlayerIndex,
          });
          return;
        }
      }

      if ((action.type === 'RESHUFFLE_ACCEPT' || action.type === 'RESHUFFLE_DECLINE') && hasAI) {
        const side = action.payload.side;
        const isAccept = action.type === 'RESHUFFLE_ACCEPT';
        const humanSeat = 0;
        const humanSide = getReshuffleSide(humanSeat, gameState.dealerIndex);
        let msg: string | null = null;
        let duration = 2500;

        if (isAccept) {
          if (side === humanSide && side === '35') {
            const nonDealers = [0, 1, 2].filter(s => s !== gameState.dealerIndex);
            const partner = nonDealers.find(s => s !== humanSeat);
            if (partner !== undefined) {
              const pTarget = gameState.targets[partner];
              msg = `שחקן ${pTarget} מסכים — הקלפים מחולקים מחדש!`;
            }
          } else if (side !== humanSide) {
            const label = side === '8' ? '8' : '3+5';
            msg = `צד ${label} ביקש חלוקה מחדש — הקלפים מחולקים מחדש!`;
          }
        } else {
          if (side !== humanSide) {
            const label = side === '8' ? '8' : '3+5';
            msg = `צד ${label} ויתר על חלוקה מחדש`;
            duration = 2000;
          }
        }

        if (msg) {
          set({ gameState: newState, activePlayerSeat: 0, reshuffleNotification: msg });
          showReshuffleNotif(set, msg, duration);
          return;
        }
      }

      // For local mode without AI: show privacy screen between turns
      if (!hasAI && action.type === 'PLAY_CARD' && newState.phase === 'TRICK_PLAY' && newState.mode === 'local') {
        const sameTrick = newState.currentTrick && newState.currentTrick.cardsPlayed.length > 0;
        if (!sameTrick) {
          set({
            gameState: newState,
            activePlayerSeat: newState.currentPlayerIndex,
            showPrivacyScreen: true,
          });
          return;
        }
      }

      set({
        gameState: newState,
        activePlayerSeat: hasAI ? 0 : (newState.currentPlayerIndex >= 0 ? newState.currentPlayerIndex : get().activePlayerSeat),
      });
    } catch (err) {
      console.error('Game action error:', action.type, err);
    }
  },

  runAiTurn: () => {
    const { gameState, aiSeats, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns } = get();
    if (!gameState || aiSeats.size === 0 || showTrickResult || showReceivedCards || showDealerKupa || showDealerReturns) return;

    const seat = gameState.currentPlayerIndex;

    if (gameState.phase === 'RESHUFFLE_WINDOW') {
      const side8Eligible = !gameState.reshuffleUsedBy8 && gameState.reshuffleWindowFor8;
      const side35Eligible = !gameState.reshuffleUsedBy35 && gameState.reshuffleWindowFor35;

      if (side8Eligible && aiSeats.has(gameState.dealerIndex)) {
        const dealerHand = gameState.playerHands[gameState.dealerIndex];
        const wants = aiShouldReshuffle(dealerHand, 8);
        get().dispatch({
          type: wants ? 'RESHUFFLE_ACCEPT' : 'RESHUFFLE_DECLINE',
          payload: { side: '8' },
        });
        return;
      }
      if (side35Eligible) {
        const nonDealerSeats = [0, 1, 2].filter((s) => s !== gameState.dealerIndex);
        const aiNonDealers = nonDealerSeats.filter((s) => aiSeats.has(s));
        if (aiNonDealers.length === nonDealerSeats.length) {
          const bothWant = aiNonDealers.every((s) =>
            aiShouldReshuffle(gameState.playerHands[s], gameState.targets[s]),
          );
          get().dispatch({
            type: bothWant ? 'RESHUFFLE_ACCEPT' : 'RESHUFFLE_DECLINE',
            payload: { side: '35' },
          });
        }
      }
      return;
    }

    if (seat < 0 || !aiSeats.has(seat)) return;

    const hand = gameState.playerHands[seat];

    switch (gameState.phase) {
      case 'SETUP_DEAL': {
        break;
      }

      case 'CUTTER_PICK': {
        // CutterPickScreen handles AI cutter pick with animation + dispatch
        break;
      }

      case 'DEALER_DISCARD': {
        const discardIds = aiSelectDiscard(hand, gameState.cutterSuit!);
        get().dispatch({ type: 'DEALER_DISCARD_4', payload: { cardIds: discardIds } });
        break;
      }

      case 'EXCHANGE_GIVE': {
        if (!gameState.exchangeInfo) break;
        const giving = gameState.exchangeInfo.givings[gameState.exchangeInfo.currentGiverIdx];
        if (!giving || giving.fromSeat !== seat) break;
        // Give ONE card per tick – the useEffect will re-fire for the next card
        const cardIds = aiExchangeGive(hand, 1);
        if (cardIds.length > 0) {
          get().dispatch({ type: 'EXCHANGE_GIVE_CARD', payload: { fromSeat: seat, cardId: cardIds[0] } });
        }
        break;
      }

      case 'EXCHANGE_RETURN': {
        if (!gameState.exchangeInfo) break;
        const { givings, givenCards, returnedCards } = gameState.exchangeInfo;

        for (const giving of givings) {
          if (giving.toSeat === seat) {
            const givenForDir = givenCards.filter(
              (g) => g.fromSeat === giving.fromSeat && g.toSeat === seat,
            );
            const returnedForDir = returnedCards.filter(
              (r) => r.fromSeat === seat && r.toSeat === giving.fromSeat,
            );
            if (returnedForDir.length < givenForDir.length) {
              const receivedCard = givenForDir[returnedForDir.length]?.card;
              if (receivedCard) {
                const primaryId = aiExchangeReturn(hand, receivedCard);
                const prevState = get().gameState;
                get().dispatch({ type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: seat, cardId: primaryId } });

                // If dispatch failed (state unchanged), try fallbacks
                if (get().gameState === prevState) {
                  console.warn(`AI return failed for card ${primaryId}, trying fallbacks...`);
                  // Try the received card itself
                  if (primaryId !== receivedCard.id && hand.some((c) => c.id === receivedCard.id)) {
                    get().dispatch({ type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: seat, cardId: receivedCard.id } });
                  }
                  // If still stuck, try every card in hand
                  if (get().gameState === prevState) {
                    for (const c of hand) {
                      get().dispatch({ type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: seat, cardId: c.id } });
                      if (get().gameState !== prevState) break;
                    }
                  }
                }
              }
              break;
            }
          }
        }
        break;
      }

      case 'TRICK_PLAY': {
        const leadSuit = gameState.currentTrick?.leadSuit ?? null;
        const trickCards = gameState.currentTrick?.cardsPlayed ?? [];
        const cardId = aiPlayCard(hand, leadSuit, gameState.cutterSuit, trickCards, gameState);
        get().dispatch({ type: 'PLAY_CARD', payload: { seatIndex: seat, cardId } });
        break;
      }

      case 'HAND_SCORING': {
        // Human player controls when to advance to next hand
        break;
      }
    }
  },

  setActivePlayer: (seat) => {
    if (get().mode === 'local') {
      set({ activePlayerSeat: seat });
    }
  },
  showPrivacy: () => set({ showPrivacyScreen: true }),
  hidePrivacy: () => set({ showPrivacyScreen: false }),
  dismissTrickResult: () => {
    const { gameState, aiSeats } = get();
    if (!gameState) return;

    const hasAI = aiSeats.size > 0;

    if (!hasAI && gameState.mode === 'local' && gameState.phase === 'TRICK_PLAY') {
      set({
        showTrickResult: false,
        activePlayerSeat: gameState.currentPlayerIndex,
        showPrivacyScreen: true,
      });
    } else {
      set({ showTrickResult: false });
    }
  },
  dismissReceivedCards: () => set({ showReceivedCards: false }),
  dismissDealerKupa: () => set({ showDealerKupa: false }),
  dismissDealerReturns: () => set({ showDealerReturns: false }),
  resetGame: () => {
    if (get().mode === 'online') {
      get().leaveRoom();
    }
    if (reshuffleNotifTimer) { clearTimeout(reshuffleNotifTimer); reshuffleNotifTimer = null; }
    if (trickDisplayTimer) { clearTimeout(trickDisplayTimer); trickDisplayTimer = null; }
    if (cutterRevealTimer) { clearTimeout(cutterRevealTimer); cutterRevealTimer = null; }
    set({ gameState: null, activePlayerSeat: 0, showPrivacyScreen: false, showTrickResult: false, showReceivedCards: false, showDealerKupa: false, showDealerReturns: false, pendingTrickState: null, reshuffleNotification: null, reshuffleVoteStatus: null, myReshuffleVote: null, mode: 'local', aiSeats: new Set() });
  },

  getLegalCardsForCurrentPlayer: () => {
    const { gameState, activePlayerSeat } = get();
    if (!gameState || gameState.phase !== 'TRICK_PLAY') return [];
    const hand = gameState.playerHands[activePlayerSeat];
    const leadSuit = gameState.currentTrick?.leadSuit ?? null;
    return getLegalCards(hand, leadSuit);
  },

  isCurrentPlayerAI: () => {
    const { gameState, aiSeats } = get();
    if (!gameState) return false;
    return aiSeats.has(gameState.currentPlayerIndex);
  },
}));
