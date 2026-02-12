import { z } from 'zod';

// ============================================================
// Zod Schemas for validation
// ============================================================

export const SuitSchema = z.enum(['S', 'H', 'D', 'C']);
export const RankSchema = z.enum(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);

export const CardSchema = z.object({
  suit: SuitSchema,
  rank: RankSchema,
  id: z.string(),
});

export const CreateGameSchema = z.object({
  gameId: z.string().min(1),
  mode: z.enum(['local', 'online']),
  players: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  })).length(3),
  victoryTarget: z.number().int().min(1).optional().default(10),
  dealerIndex: z.number().int().min(0).max(2).optional(),
  seed: z.number().optional(),
});

export const RoomCreateSchema = z.object({
  roomName: z.string().min(1).max(50),
  hostName: z.string().min(1).max(30),
  victoryTarget: z.number().int().min(1).max(100).optional().default(10),
});

export const RoomJoinSchema = z.object({
  roomCode: z.string().length(6),
  playerName: z.string().min(1).max(30),
});

export const PlayCardSchema = z.object({
  cardId: z.string(),
});

export const PickCutterSchema = z.object({
  suit: SuitSchema,
});

export const DealerDiscardSchema = z.object({
  cardIds: z.array(z.string()).length(4),
});

export const ExchangeGiveSchema = z.object({
  cardId: z.string(),
});

export const ExchangeReturnSchema = z.object({
  cardId: z.string(),
});
