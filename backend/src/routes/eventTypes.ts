import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app.ts';
import type { EventTypesListResponse } from '../generated/types.gen.ts';

export function registerEventTypeRoutes(app: FastifyInstance, { store }: AppContext): void {
  app.get('/api/event-types', async (): Promise<EventTypesListResponse> => store.listEventTypes());
}
