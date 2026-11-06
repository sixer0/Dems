// M-2 (masterplan/01_specs.md §8): loopback bind, >= 3 schema-valid heartbeats in 3.5 s, close code 1001.
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { HeartbeatSchema, type Heartbeat } from '@dems/shared/api';
import { buildApp } from '../src/app';

describe('WS /ws heartbeat', () => {
  it('binds 127.0.0.1, streams increasing heartbeats and closes clients with 1001', async () => {
    const app = buildApp({ logger: false });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    const beats: Heartbeat[] = [];
    const closed = new Promise<number>((resolve) => client.on('close', (code) => resolve(code)));

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`only ${beats.length} heartbeats`)), 3500);
      client.on('message', (data) => {
        beats.push(HeartbeatSchema.parse(JSON.parse(data.toString())));
        if (beats.length >= 3) {
          clearTimeout(timer);
          resolve();
        }
      });
      client.on('error', reject);
    });

    const seqs = beats.map((b) => b.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(beats.at(-1)?.clients).toBe(1);

    await app.close();
    expect(await closed).toBe(1001);
  }, 10_000);
});
