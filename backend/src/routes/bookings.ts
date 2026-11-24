import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../app.ts';
import { sendError } from '../errors.ts';
import type {
  Booking,
  BookingsCreateResponse,
  BookingsListResponse,
} from '../generated/types.gen.ts';
import { formatOwnerTime } from '../ownerTime.ts';
import { findOfferedSlot, intervalsOverlap, type SlotRejection } from '../slots.ts';
import type { StoredBooking } from '../store.ts';
import { EVENT_TYPE_NOT_FOUND_MESSAGE } from './eventTypes.ts';
import { parseBody, type FieldReader } from '../validation.ts';

const SLOT_TAKEN_MESSAGE = 'Это время уже заняли. Выберите другой слот';

const SLOT_NOT_OFFERED_MESSAGES: Record<SlotRejection, string> = {
  started: 'Это время уже прошло. Выберите другой слот',
  outsideWindow:
    'Это время вне окна записи: бронировать можно на 14 дней вперёд. Выберите другой слот',
  offGrid: 'Встреча начинается только в начале слота, каждые 15 минут. Выберите другой слот',
  outsideWorkingHours: 'Это время вне рабочих часов 09:00–18:00. Выберите другой слот',
};

function readNewBooking(fields: FieldReader) {
  return {
    eventTypeId: fields.string('eventTypeId', { minLength: 1, maxLength: 50 }),
    start: fields.offsetDateTime('start'),
    guestName: fields.string('guestName', { minLength: 1, maxLength: 100 }),
    guestEmail: fields.email('guestEmail'),
    note: fields.optionalString('note', { maxLength: 1000 }),
  };
}

export function toBookingResponse(booking: StoredBooking): Booking {
  return {
    id: booking.id,
    eventType: booking.eventType,
    start: formatOwnerTime(booking.start),
    end: formatOwnerTime(booking.end),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    ...(booking.note === undefined ? {} : { note: booking.note }),
    createdAt: formatOwnerTime(booking.createdAt),
  };
}

export function registerBookingRoutes(app: FastifyInstance, { store, now }: AppContext): void {
  app.get('/api/bookings', async (): Promise<BookingsListResponse> =>
    store.listUpcomingBookings(now()).map(toBookingResponse),
  );

  app.post(
    '/api/bookings',
    async (request, reply): Promise<BookingsCreateResponse | FastifyReply> => {
      // Порядок проверок — спецификация #11, «Создание бронирования: порядок проверок».
      // От поиска слота до записи нет ни одного await (ADR-0002): Node выполняет этот участок
      // целиком, поэтому из двух одновременных запросов на одно время проходит ровно один
      const { eventTypeId, start, guestName, guestEmail, note } = parseBody(
        request.body,
        readNewBooking,
      );
      const eventType = store.findEventType(eventTypeId);
      if (!eventType) {
        return sendError(reply, 'EVENT_TYPE_NOT_FOUND', EVENT_TYPE_NOT_FOUND_MESSAGE);
      }

      const createdAt = now();
      const offered = findOfferedSlot(eventType, start, createdAt);
      if ('rejection' in offered) {
        return sendError(reply, 'SLOT_NOT_OFFERED', SLOT_NOT_OFFERED_MESSAGES[offered.rejection]);
      }
      // Пересечение с бронированием любого типа встречи, не только этого
      if (store.listBookings().some((booking) => intervalsOverlap(offered.slot, booking))) {
        return sendError(reply, 'SLOT_TAKEN', SLOT_TAKEN_MESSAGE);
      }

      const booking: StoredBooking = {
        id: randomUUID(),
        eventType: {
          id: eventType.id,
          title: eventType.title,
          durationMinutes: eventType.durationMinutes,
        },
        ...offered.slot,
        guestName,
        guestEmail,
        ...(note === undefined ? {} : { note }),
        createdAt,
      };
      store.addBooking(booking);
      reply.status(201);
      return toBookingResponse(booking);
    },
  );
}
