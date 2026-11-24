import type { EventType } from './generated/types.gen.ts';

/**
 * Хранилище в памяти одного процесса (ADR-0002). Методы синхронные: проверка и запись
 * выполняются без `await` между ними, поэтому одновременные запросы не могут оба пройти.
 */
export interface Store {
  /** Типы встреч в порядке создания */
  listEventTypes(): EventType[];
  findEventType(id: string): EventType | undefined;
  addEventType(eventType: EventType): void;
}

export function createStore(): Store {
  // Map сохраняет порядок вставки, он же порядок создания
  const eventTypes = new Map<string, EventType>();

  return {
    listEventTypes: () => [...eventTypes.values()],
    findEventType: (id) => eventTypes.get(id),
    addEventType: (eventType) => {
      eventTypes.set(eventType.id, eventType);
    },
  };
}
