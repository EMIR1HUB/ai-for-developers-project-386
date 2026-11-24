import type { EventType } from './generated/types.gen.ts';
import { ownerDateOf, ownerMoment } from './ownerTime.ts';

/** Окно записи: сегодня по поясу владельца и ещё 13 дней */
export const BOOKING_WINDOW_DAYS = 14;
/** Рабочие часы владельца 09:00–18:00 каждый день, в минутах от начала дня */
const WORKING_DAY_START_MINUTES = 9 * 60;
const WORKING_DAY_END_MINUTES = 18 * 60;
/** Шаг начала слотов одинаковый для всех типов встреч */
const SLOT_STEP_MINUTES = 15;

/** Полуоткрытый интервал времени `[start, end)` */
export interface TimeInterval {
  start: Date;
  end: Date;
}

/** Слот окна записи. `available: false` — слот пересекается с бронированием */
export interface Slot extends TimeInterval {
  available: boolean;
}

/**
 * Пересекаются ли интервалы `[start, end)`. Сравнение строгое: бронирование может начинаться
 * ровно в момент окончания другого, примыкание пересечением не считается.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Слоты окна записи для типа встречи. Слот целиком лежит в рабочих часах; слоты, которые уже
 * начались (начало не строго позже `now`), не предлагаются и в результат не попадают.
 * Слот занят, если пересекается с бронированием любого типа встречи.
 *
 * Эту же функцию использует проверка при создании бронирования: сервер принимает
 * только начало слота из этого списка.
 */
export function computeSlots(
  eventType: Pick<EventType, 'durationMinutes'>,
  bookings: readonly TimeInterval[],
  now: Date,
): Slot[] {
  const today = ownerDateOf(now);
  const slots: Slot[] = [];

  for (let dayOffset = 0; dayOffset < BOOKING_WINDOW_DAYS; dayOffset++) {
    const day = { ...today, day: today.day + dayOffset };
    for (
      let startMinutes = WORKING_DAY_START_MINUTES;
      startMinutes + eventType.durationMinutes <= WORKING_DAY_END_MINUTES;
      startMinutes += SLOT_STEP_MINUTES
    ) {
      const start = ownerMoment(day, startMinutes);
      if (start <= now) {
        continue;
      }
      const slot = { start, end: ownerMoment(day, startMinutes + eventType.durationMinutes) };
      slots.push({
        ...slot,
        available: !bookings.some((booking) => intervalsOverlap(slot, booking)),
      });
    }
  }

  return slots;
}

/** Почему начало не совпадает ни с одним предлагаемым слотом */
export type SlotRejection = 'started' | 'outsideWindow' | 'offGrid' | 'outsideWorkingHours';

const MINUTE_MS = 60 * 1000;

function rejectionOf(start: Date, now: Date): SlotRejection {
  if (start <= now) {
    return 'started';
  }
  const today = ownerDateOf(now);
  const windowEnd = ownerMoment({ ...today, day: today.day + BOOKING_WINDOW_DAYS }, 0);
  if (start >= windowEnd) {
    return 'outsideWindow';
  }
  const minutesOfDay = (start.getTime() - ownerMoment(ownerDateOf(start), 0).getTime()) / MINUTE_MS;
  if (minutesOfDay % SLOT_STEP_MINUTES !== 0) {
    return 'offGrid';
  }
  return 'outsideWorkingHours';
}

/**
 * Слот, который ручка слотов сейчас предлагает с этим началом, занятый или свободный, либо причина,
 * почему такого слота нет. Слот берётся из `computeSlots`, поэтому сервер принимает ровно
 * те начала, что показывает гостю; занятость проверяет вызывающий код.
 */
export function findOfferedSlot(
  eventType: Pick<EventType, 'durationMinutes'>,
  start: Date,
  now: Date,
): { slot: TimeInterval } | { rejection: SlotRejection } {
  // Набор предлагаемых начал от бронирований не зависит: занятые слоты тоже показываются
  const slot = computeSlots(eventType, [], now).find(
    (candidate) => candidate.start.getTime() === start.getTime(),
  );
  return slot
    ? { slot: { start: slot.start, end: slot.end } }
    : { rejection: rejectionOf(start, now) };
}
