import Fastify, { type FastifyInstance } from 'fastify';
import type { Health } from './generated/types.gen.ts';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.get('/api/health', async (): Promise<Health> => ({ status: 'ok' }));

  return app;
}
