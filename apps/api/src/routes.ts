import { FastifyInstance } from 'fastify';
import { roomManager } from './roomManager.js';

export function setupRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Get room state (public safe)
  fastify.get('/api/rooms/:code/state', async (request, reply) => {
    const { code } = request.params as { code: string };
    const room = roomManager.getRoom(code);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    // Return public state (no private hands)
    return {
      code: room.code,
      name: room.name,
      players: room.players.map((p) => ({ name: p.name, seatIndex: p.seatIndex, connected: p.connected })),
      status: room.status,
      phase: room.gameState?.phase ?? null,
      handNumber: room.gameState?.handNumber ?? 0,
      scoreTotal: room.gameState?.scoreTotal ?? [0, 0, 0],
    };
  });

  // Export JSON
  fastify.get('/api/rooms/:code/export.json', async (request, reply) => {
    const { code } = request.params as { code: string };
    const room = roomManager.getRoom(code);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    reply.header('Content-Disposition', `attachment; filename="358-${code}.json"`);
    return {
      room: {
        code: room.code,
        name: room.name,
        victoryTarget: room.victoryTarget,
        players: room.players.map((p) => ({ name: p.name, seatIndex: p.seatIndex })),
      },
      handHistory: room.gameState?.handHistory ?? [],
      scoreTotal: room.gameState?.scoreTotal ?? [0, 0, 0],
      winner: room.gameState?.winnerIndex !== null && room.gameState?.winnerIndex !== undefined
        ? room.players[room.gameState.winnerIndex]?.name
        : null,
    };
  });

  // Export CSV
  fastify.get('/api/rooms/:code/export.csv', async (request, reply) => {
    const { code } = request.params as { code: string };
    const room = roomManager.getRoom(code);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const players = room.players;
    const headers = [
      'handNumber', 'dealerName', 'cutter',
      `tricks_${players[0]?.name}`, `tricks_${players[1]?.name}`, `tricks_${players[2]?.name}`,
      `delta_${players[0]?.name}`, `delta_${players[1]?.name}`, `delta_${players[2]?.name}`,
      `total_${players[0]?.name}`, `total_${players[1]?.name}`, `total_${players[2]?.name}`,
    ];

    const rows = (room.gameState?.handHistory ?? []).map((h) => {
      const dealerName = players[h.dealerIndex]?.name ?? '';
      const cutter = h.cutterSuit;
      // Calculate running total
      return [
        h.handNumber, dealerName, cutter,
        h.tricksTaken[0], h.tricksTaken[1], h.tricksTaken[2],
        h.deltas[0], h.deltas[1], h.deltas[2],
        // Running total: sum deltas up to this hand
        ...players.map((_, i) =>
          (room.gameState?.handHistory ?? [])
            .filter((hh) => hh.handNumber <= h.handNumber)
            .reduce((sum, hh) => sum + hh.deltas[i], 0)
        ),
      ];
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="358-${code}.csv"`);
    return csv;
  });
}
