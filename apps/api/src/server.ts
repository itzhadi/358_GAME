import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocketHandlers } from './socket.js';
import { setupRoutes } from './routes.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());
  if (allowed.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  });

  setupRoutes(fastify);

  await fastify.listen({ port: PORT, host: '0.0.0.0' });

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: (_origin, cb) => cb(null, isAllowedOrigin(_origin as string)),
      credentials: true,
    },
  });

  setupSocketHandlers(io);

  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
