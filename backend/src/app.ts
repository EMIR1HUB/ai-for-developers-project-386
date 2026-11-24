import Fastify, { type FastifyInstance } from 'fastify';
import { seedDemoData } from './demoData.ts';
import { ApiFailure, sendError } from './errors.ts';
import type { Health } from './generated/types.gen.ts';
import { registerEventTypeRoutes } from './routes/eventTypes.ts';
import { createStore, type Store } from './store.ts';
import { MALFORMED_BODY_MESSAGE } from './validation.ts';

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

function isClientError(error: unknown): boolean {
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
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
    if (error instanceof ApiFailure) {
      return sendError(reply, error.code, error.message, error.fields);
    }
    // Ошибки клиента со статусом 4xx бросает только сам Fastify, когда не может прочитать тело
    // (битый или пустой JSON, неизвестный Content-Type, слишком большое тело)
    if (isClientError(error)) {
      request.log.warn({ err: error }, 'MALFORMED_REQUEST');
      return sendError(reply, 'MALFORMED_REQUEST', MALFORMED_BODY_MESSAGE);
    }
    request.log.error({ err: error }, 'UNHANDLED_ERROR');
    return sendError(reply, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера. Попробуйте позже');
  });

  app.get('/api/health', async (): Promise<Health> => ({ status: 'ok' }));
  registerEventTypeRoutes(app, context);

  return app;
}
