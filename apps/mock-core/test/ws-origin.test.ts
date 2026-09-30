// M-3 (masterplan/01_specs.md §8): a foreign Origin is refused with HTTP 403 before the upgrade.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../src/app';

describe('WS origin allowlist', () => {
  const app = buildApp({ logger: false });
  let port = 0;

  beforeAll(async () => {
    await app.listen({ host: '127.0.0.1', port: 0 });
    port = (app.server.address() as AddressInfo).port;
  });
  afterAll(() => app.close());

  function statusFor(origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const client = new WebSocket(
        `ws://127.0.0.1:${port}/ws`,
        origin === undefined ? {} : { origin },
      );
      client.on('unexpected-response', (_req, res) => {
        resolve(res.statusCode ?? 0);
        client.terminate();
      });
      client.on('open', () => {
        resolve(101);
        client.close();
      });
      client.on('error', (error) => {
        if (!String(error.message).includes('Unexpected server response')) reject(error);
      });
    });
  }

  it('rejects http://evil.example with 403', async () => {
    expect(await statusFor('http://evil.example')).toBe(403);
  });

  it('accepts the web dev origin and a missing Origin', async () => {
    expect(await statusFor('http://127.0.0.1:5173')).toBe(101);
    expect(await statusFor()).toBe(101);
  });
});
