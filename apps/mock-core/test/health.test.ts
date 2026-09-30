// M-1 (masterplan/01_specs.md §8): health route, schema, version and CORS allowlist via inject().
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@dems/shared/api';
import { buildApp } from '../src/app';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

describe('GET /api/v1/health', () => {
  const app = buildApp({ logger: false });
  afterAll(() => app.close());

  it('returns 200 JSON matching HealthResponseSchema with an allowed-origin ACAO header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://127.0.0.1:5173' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    const body = HealthResponseSchema.parse(res.json());
    expect(body.version).toBe(pkg.version);
    expect(body.ws).toEqual({ path: '/ws', heartbeatIntervalMs: 1000, clients: 0 });
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });

  it('sends no ACAO header to a foreign origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://evil.example' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the default JSON 404 for other paths', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ statusCode: 404 });
  });
});
