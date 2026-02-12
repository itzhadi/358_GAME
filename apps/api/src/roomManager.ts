import { createGame, gameReducer, getPlayerView, GameState, GameAction } from '@358/shared';

export interface RoomPlayer {
  id: string;
  name: string;
  seatIndex: number;
  socketId: string | null;
  connected: boolean;
  isHost: boolean;
}

export interface Room {
  code: string;
  name: string;
  victoryTarget: number;
  status: 'waiting' | 'playing' | 'finished';
  players: RoomPlayer[];
  gameState: GameState | null;
}

class RoomManager {
  private rooms = new Map<string, Room>();

  generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure unique
    if (this.rooms.has(code)) return this.generateCode();
    return code;
  }

  createRoom(name: string, hostName: string, victoryTarget: number, hostSocketId: string): Room {
    const code = this.generateCode();
    const room: Room = {
      code,
      name,
      victoryTarget,
      status: 'waiting',
      players: [{
        id: `p-${Date.now()}-0`,
        name: hostName,
        seatIndex: 0,
        socketId: hostSocketId,
        connected: true,
        isHost: true,
      }],
      gameState: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinRoom(code: string, playerName: string, socketId: string): { room: Room; player: RoomPlayer } | { error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { error: 'חדר לא נמצא — בדוק את הקוד' };
    if (room.status !== 'waiting') return { error: 'המשחק כבר התחיל' };
    if (room.players.length >= 3) return { error: 'החדר מלא (3 שחקנים)' };

    const seatIndex = room.players.length;
    const player: RoomPlayer = {
      id: `p-${Date.now()}-${seatIndex}`,
      name: playerName,
      seatIndex,
      socketId,
      connected: true,
      isHost: false,
    };
    room.players.push(player);
    return { room, player };
  }

  startGame(code: string): GameState | null {
    const room = this.rooms.get(code);
    if (!room || room.players.length !== 3 || room.status !== 'waiting') return null;

    room.status = 'playing';
    const state = createGame({
      gameId: `online-${code}`,
      mode: 'online',
      players: room.players.map((p) => ({ id: p.id, name: p.name })),
      victoryTarget: room.victoryTarget,
    });
    room.gameState = state;
    return state;
  }

  applyAction(code: string, action: GameAction): GameState | { error: string } {
    const room = this.rooms.get(code) || this.rooms.get(code.toUpperCase());
    if (!room) {
      console.error(`Room not found: ${code}`);
      return { error: 'Room not found — please create a new game' };
    }
    if (!room.gameState) {
      console.error(`Game not started in room: ${code}`);
      return { error: 'Game not started' };
    }

    try {
      room.gameState = gameReducer(room.gameState, action);
      if (room.gameState.phase === 'GAME_OVER') {
        room.status = 'finished';
      }
      return room.gameState;
    } catch (err: any) {
      console.error('Action error:', action.type, err?.message ?? err);
      return { error: err?.message ?? 'Unknown error' };
    }
  }

  getPlayerView(code: string, seatIndex: number): GameState | null {
    const room = this.rooms.get(code);
    if (!room || !room.gameState) return null;
    return getPlayerView(room.gameState, seatIndex);
  }

  reconnectPlayer(code: string, playerId: string, socketId: string): RoomPlayer | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    player.socketId = socketId;
    player.connected = true;
    return player;
  }

  disconnectPlayer(socketId: string): { code: string; player: RoomPlayer } | null {
    for (const [code, room] of this.rooms) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (player) {
        player.connected = false;
        player.socketId = null;
        return { code, player };
      }
    }
    return null;
  }

  removeRoom(code: string) {
    this.rooms.delete(code.toUpperCase());
  }
}

export const roomManager = new RoomManager();
