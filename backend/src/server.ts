import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
// DEMO_DATA=false запускает сервер без демо-типов встреч (браузерные тесты, чистый старт)
const demoData = process.env.DEMO_DATA !== 'false';

const app = buildApp({ demoData });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
