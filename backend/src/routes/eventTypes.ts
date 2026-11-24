import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../app.ts';
import { sendError } from '../errors.ts';
import type {
  EventTypesGetData,
  EventTypesGetResponse,
  EventTypesListResponse,
  EventTypesListSlotsData,
  EventTypesListSlotsResponse,
} from '../generated/types.gen.ts';
import { formatOwnerTime } from '../ownerTime.ts';
import { computeSlots } from '../slots.ts';

const EVENT_TYPE_NOT_FOUND_MESSAGE = 'Тип встречи не найден';

export function registerEventTypeRoutes(app: FastifyInstance, { store, now }: AppContext): void {
  app.get('/api/event-types', async (): Promise<EventTypesListResponse> => store.listEventTypes());

  app.get<{ Params: EventTypesGetData['path'] }>(
    '/api/event-types/:id',
    async (request, reply): Promise<EventTypesGetResponse | FastifyReply> => {
      const eventType = store.findEventType(request.params.id);
      if (!eventType) {
        return sendError(reply, 'EVENT_TYPE_NOT_FOUND', EVENT_TYPE_NOT_FOUND_MESSAGE);
      }
      return eventType;
    },
  );

  app.get<{ Params: EventTypesListSlotsData['path'] }>(
    '/api/event-types/:id/slots',
    async (request, reply): Promise<EventTypesListSlotsResponse | FastifyReply> => {
      const eventType = store.findEventType(request.params.id);
      if (!eventType) {
        return sendError(reply, 'EVENT_TYPE_NOT_FOUND', EVENT_TYPE_NOT_FOUND_MESSAGE);
      }
      return computeSlots(eventType, store.listBookings(), now()).map((slot) => ({
        start: formatOwnerTime(slot.start),
        end: formatOwnerTime(slot.end),
        available: slot.available,
      }));
    },
  );
}
