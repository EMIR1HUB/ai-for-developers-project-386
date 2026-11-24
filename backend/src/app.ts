import Fastify, { type FastifyInstance } from 'fastify';
import { seedDemoData } from './demoData.ts';
import { sendError } from './errors.ts';
import type { Health } from './generated/types.gen.ts';
import { registerEventTypeRoutes } from './routes/eventTypes.ts';
import { registerOwnerRoutes } from './routes/owner.ts';
import { createStore, type Store } from './store.ts';

/** Часы приложения: «сейчас» берётся только из них, чтобы тесты могли зафиксировать время */
export type Clock = () => Date;

export interface AppOptions {
  /** По умолчанию системные часы */
  now?: Clock;
  /** Создать демо-типы встреч при старте. По умолчанию включено */
  demoData?: boolean;
  /** По умолчанию новое пустое хранилище в памяти */
  store?: Store;
}

/** Зависимости, которые получают маршруты */
export interface AppContext {
  store: Store;
  now: Clock;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const context: AppContext = {
    store: options.store ?? createStore(),
    now: options.now ?? (() => new Date()),
  };

  if (options.demoData ?? true) {
    seedDemoData(context.store);
  }

  // Встроенный формат ошибок Fastify наружу не выходит: любой ответ с ошибкой — в общей схеме
  app.setNotFoundHandler((_request, reply) => sendError(reply, 'NOT_FOUND', 'Адрес не найден'));
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'UNHANDLED_ERROR');
    return sendError(reply, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера. Попробуйте позже');
  });

  app.get('/api/health', async (): Promise<Health> => ({ status: 'ok' }));
  registerOwnerRoutes(app);
  registerEventTypeRoutes(app, context);

  return app;
}
