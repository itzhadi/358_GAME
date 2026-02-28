import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { roomManager } from './roomManager.js';
import { GameAction, Suit, getReshuffleSide } from '@358/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-358';

interface JWTPayload {
  roomCode: string;
  playerId: string;
  seatIndex: number;
}

function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

const RECONNECT_GRACE_MS = 45_000;
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const reshuffleVotes = new Map<string, Map<number, 'accept' | 'decline'>>();

function getSide35Seats(roomCode: string): number[] {
  const room = roomManager.getRoom(roomCode);
  if (!room?.gameState) return [];
  const dealer = room.gameState.dealerIndex;
  return [0, 1, 2].filter((s) => getReshuffleSide(s, dealer) === '35');
}

function handleSide35Vote(
  io: SocketIOServer,
  token: string,
  vote: 'accept' | 'decline',
) {
  const payload = verifyToken(token);
  if (!payload) return;

  const room = roomManager.getRoom(payload.roomCode);
  if (!room?.gameState) return;

  const seats35 = getSide35Seats(payload.roomCode);
  if (!seats35.includes(payload.seatIndex)) return;

  let votes = reshuffleVotes.get(payload.roomCode);
  if (!votes) {
    votes = new Map();
    reshuffleVotes.set(payload.roomCode, votes);
  }
  votes.set(payload.seatIndex, vote);

  if (vote === 'decline') {
    reshuffleVotes.delete(payload.roomCode);
    broadcastSide35VoteStatus(io, payload.roomCode, null);
    applyAndBroadcast(io, payload.roomCode, {
      type: 'RESHUFFLE_DECLINE',
      payload: { side: '35' },
    });
    return;
  }

  const otherSeat = seats35.find((s) => s !== payload.seatIndex)!;
  const otherVote = votes.get(otherSeat);

  if (otherVote === undefined) {
    broadcastSide35VoteStatus(io, payload.roomCode, {
      votedSeat: payload.seatIndex,
      vote: 'accept',
    });
    return;
  }

  reshuffleVotes.delete(payload.roomCode);
  broadcastSide35VoteStatus(io, payload.roomCode, null);

  if (otherVote === 'accept') {
    applyAndBroadcast(io, payload.roomCode, {
      type: 'RESHUFFLE_ACCEPT',
      payload: { side: '35' },
    });
  } else {
    applyAndBroadcast(io, payload.roomCode, {
      type: 'RESHUFFLE_DECLINE',
      payload: { side: '35' },
    });
  }
}

function broadcastSide35VoteStatus(
  io: SocketIOServer,
  roomCode: string,
  status: { votedSeat: number; vote: 'accept' | 'decline' } | null,
) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;
  for (const p of room.players) {
    if (p.socketId) {
      io.to(p.socketId).emit('reshuffle:voteStatus', status);
    }
  }
}

function applyAndBroadcast(io: SocketIOServer, roomCode: string, action: GameAction) {
  const result = roomManager.applyAction(roomCode, action);
  if ('error' in result) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  for (const p of room.players) {
    const view = roomManager.getPlayerView(roomCode, p.seatIndex);
    if (view && p.socketId) {
      io.to(p.socketId).emit('game:privateHand', view);
    }
  }
}

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Create room
    socket.on('room:create', (data: { roomName: string; hostName: string; victoryTarget: number }) => {
      try {
        const room = roomManager.createRoom(data.roomName, data.hostName, data.victoryTarget, socket.id);
        const token = signToken({ roomCode: room.code, playerId: room.players[0].id, seatIndex: 0 });

        socket.join(room.code);
        socket.emit('room:created', { code: room.code, token, seatIndex: 0 });
        io.to(room.code).emit('room:state', {
          code: room.code,
          name: room.name,
          players: room.players.map((p) => ({ name: p.name, seatIndex: p.seatIndex, connected: p.connected })),
          status: room.status,
        });
      } catch (err: any) {
        socket.emit('error', { code: 'CREATE_FAILED', message: err.message });
      }
    });

    // Join room
    socket.on('room:join', (data: { roomCode: string; playerName: string }) => {
      try {
        const result = roomManager.joinRoom(data.roomCode, data.playerName, socket.id);
        if ('error' in result) {
          socket.emit('error', { code: 'JOIN_FAILED', message: result.error });
          return;
        }

        const { room, player } = result;
        const token = signToken({ roomCode: room.code, playerId: player.id, seatIndex: player.seatIndex });

        socket.join(room.code);
        socket.emit('room:joined', { code: room.code, token, seatIndex: player.seatIndex });
        io.to(room.code).emit('room:state', {
          code: room.code,
          name: room.name,
          players: room.players.map((p) => ({ name: p.name, seatIndex: p.seatIndex, connected: p.connected })),
          status: room.status,
        });
      } catch (err: any) {
        socket.emit('error', { code: 'JOIN_FAILED', message: err.message });
      }
    });

    // Start game (host only)
    socket.on('game:start', (data: { token: string }) => {
      const payload = verifyToken(data.token);
      if (!payload) {
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Invalid token' });
        return;
      }

      const room = roomManager.getRoom(payload.roomCode);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }

      const player = room.players.find((p) => p.id === payload.playerId);
      if (!player?.isHost) {
        socket.emit('error', { code: 'NOT_HOST', message: 'Only host can start' });
        return;
      }

      const state = roomManager.startGame(payload.roomCode);
      if (!state) {
        socket.emit('error', { code: 'START_FAILED', message: 'Cannot start game' });
        return;
      }

      for (const p of room.players) {
        const view = roomManager.getPlayerView(payload.roomCode, p.seatIndex);
        if (view && p.socketId) {
          io.to(p.socketId).emit('game:privateHand', view);
        }
      }
    });

    // Game actions with auth
    const handleGameAction = (action: GameAction, token: string) => {
      const payload = verifyToken(token);
      if (!payload) {
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Invalid token' });
        return;
      }

      const result = roomManager.applyAction(payload.roomCode, action);
      if ('error' in result) {
        socket.emit('error', { code: 'ACTION_FAILED', message: result.error });
        return;
      }

      const room = roomManager.getRoom(payload.roomCode);
      if (!room) return;

      for (const p of room.players) {
        const view = roomManager.getPlayerView(payload.roomCode, p.seatIndex);
        if (view && p.socketId) {
          io.to(p.socketId).emit('game:privateHand', view);
        }
      }
    };

    socket.on('exchange:give', (data: { token: string; cardId: string }) => {
      const payload = verifyToken(data.token);
      if (!payload) return;
      handleGameAction(
        { type: 'EXCHANGE_GIVE_CARD', payload: { fromSeat: payload.seatIndex, cardId: data.cardId } },
        data.token,
      );
    });

    socket.on('exchange:return', (data: { token: string; cardId: string }) => {
      const payload = verifyToken(data.token);
      if (!payload) return;
      handleGameAction(
        { type: 'EXCHANGE_RETURN_CARD', payload: { fromSeat: payload.seatIndex, cardId: data.cardId } },
        data.token,
      );
    });

    socket.on('cutter:pick', (data: { token: string; suit: Suit }) => {
      handleGameAction(
        { type: 'PICK_CUTTER', payload: { suit: data.suit } },
        data.token,
      );
    });

    socket.on('dealer:discard', (data: { token: string; cardIds: string[] }) => {
      handleGameAction(
        { type: 'DEALER_DISCARD_4', payload: { cardIds: data.cardIds } },
        data.token,
      );
    });

    socket.on('play:card', (data: { token: string; cardId: string }) => {
      const payload = verifyToken(data.token);
      if (!payload) return;
      handleGameAction(
        { type: 'PLAY_CARD', payload: { seatIndex: payload.seatIndex, cardId: data.cardId } },
        data.token,
      );
    });

    socket.on('game:deal', (data: { token: string }) => {
      handleGameAction({ type: 'SHUFFLE_DEAL' }, data.token);
    });

    socket.on('reshuffle:accept', (data: { token: string; side: '8' | '35' }) => {
      if (data.side === '8') {
        handleGameAction({ type: 'RESHUFFLE_ACCEPT', payload: { side: '8' } }, data.token);
        return;
      }
      handleSide35Vote(io, data.token, 'accept');
    });

    socket.on('reshuffle:decline', (data: { token: string; side: '8' | '35' }) => {
      if (data.side === '8') {
        handleGameAction({ type: 'RESHUFFLE_DECLINE', payload: { side: '8' } }, data.token);
        return;
      }
      handleSide35Vote(io, data.token, 'decline');
    });

    socket.on('game:nextHand', (data: { token: string }) => {
      handleGameAction({ type: 'NEXT_HAND' }, data.token);
    });

    // Player explicitly leaves room
    socket.on('room:leave', (data: { token: string }) => {
      const payload = verifyToken(data.token);
      if (!payload) return;

      const room = roomManager.getRoom(payload.roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === payload.playerId);
      const playerName = player?.name ?? 'שחקן';

      io.to(payload.roomCode).emit('room:closed', {
        reason: `${playerName} עזב/ה את החדר`,
      });

      // Disconnect all sockets from the room
      for (const p of room.players) {
        if (p.socketId) {
          const pSocket = io.sockets.sockets.get(p.socketId);
          pSocket?.leave(payload.roomCode);
        }
      }

      reshuffleVotes.delete(payload.roomCode);
      roomManager.removeRoom(payload.roomCode);
    });

    socket.on('disconnect', () => {
      const result = roomManager.disconnectPlayer(socket.id);
      if (!result) return;

      const room = roomManager.getRoom(result.code);
      if (!room) return;

      io.to(result.code).emit('room:playerDisconnected', {
        playerName: result.player.name,
        seatIndex: result.player.seatIndex,
      });
      io.to(result.code).emit('room:state', {
        code: room.code,
        name: room.name,
        players: room.players.map((p) => ({ name: p.name, seatIndex: p.seatIndex, connected: p.connected })),
        status: room.status,
      });

      const timerKey = `${result.code}:${result.player.id}`;
      const timer = setTimeout(() => {
        disconnectTimers.delete(timerKey);
        const currentRoom = roomManager.getRoom(result.code);
        if (!currentRoom) return;

        const player = currentRoom.players.find((p) => p.id === result.player.id);
        if (player && !player.connected) {
          io.to(result.code).emit('room:closed', {
            reason: `${result.player.name} התנתק/ה מהחדר`,
          });
          for (const p of currentRoom.players) {
            if (p.socketId) {
              io.sockets.sockets.get(p.socketId)?.leave(result.code);
            }
          }
          reshuffleVotes.delete(result.code);
          roomManager.removeRoom(result.code);
        }
      }, RECONNECT_GRACE_MS);

      disconnectTimers.set(timerKey, timer);
    });

    socket.on('room:reconnect', (data: { token: string }) => {
      const payload = verifyToken(data.token);
      if (!payload) {
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Invalid token' });
        return;
      }

      const player = roomManager.reconnectPlayer(payload.roomCode, payload.playerId, socket.id);
      if (!player) {
        socket.emit('error', { code: 'RECONNECT_FAILED', message: 'Cannot reconnect' });
        return;
      }

      const timerKey = `${payload.roomCode}:${payload.playerId}`;
      const pending = disconnectTimers.get(timerKey);
      if (pending) {
        clearTimeout(pending);
        disconnectTimers.delete(timerKey);
      }

      socket.join(payload.roomCode);

      const room = roomManager.getRoom(payload.roomCode);
      if (room) {
        socket.emit('room:state', {
          code: room.code,
          name: room.name,
          players: room.players.map((p) => ({ name: p.name, seatIndex: p.seatIndex, connected: p.connected })),
          status: room.status,
        });
        io.to(payload.roomCode).emit('room:playerReconnected', {
          playerName: player.name,
          seatIndex: player.seatIndex,
        });
      }

      const view = roomManager.getPlayerView(payload.roomCode, payload.seatIndex);
      if (view) {
        socket.emit('game:privateHand', view);
      }
    });
  });
}
