import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';

describe('GET /api/health', () => {
  const app = buildApp();

  afterAll(() => app.close());

  it('should respond 200 with status ok when app is started', async () => {
    // when
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    // then
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
