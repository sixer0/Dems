// Shared-contract guard for the packaged web launcher (masterplan/06_packaging_spec.md §3.3; step 95).
// The launcher is a dependency-free .cjs that duplicates the mock-core health + heartbeat contract on
// purpose; these tests run it as a child process (exactly as packaged) against a fixture web root.
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  API_VERSION,
  HEALTH_PATH,
  HEARTBEAT_INTERVAL_MS,
  HealthResponseSchema,
  HeartbeatSchema,
  SERVICE_NAME,
  WS_PATH,
} from '@dems/shared/api';
import { packagedCsp } from '../../core-web/src/lib/packaged-csp';

const here = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = join(here, '..', 'standalone', 'dems-web-launcher.cjs');
const launcherModule = createRequire(import.meta.url)(LAUNCHER) as Record<string, unknown> & {
  cspHeader: (port: number) => string;
};

const FILES: Record<string, Buffer> = {
  'index.html': Buffer.from('<!doctype html><html><head><script type="module" src="/assets/app-abc123.js"></script></head><body><div id="root"></div></body></html>'),
  'assets/app-abc123.js': Buffer.from('console.log("dems");\n'),
  'assets/clip-1a2b.mp4': randomBytes(4096),
  'favicon.svg': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
};

function makeRoot(tamper = false): string {
  const root = mkdtempSync(join(tmpdir(), 'dems-launcher-'));
  copyFileSync(LAUNCHER, join(root, 'dems-web-launcher.cjs'));
  const files: Record<string, { size: number; sha256: string; type: string }> = {};
  for (const [rel, body] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, 'web', rel)), { recursive: true });
    const onDisk = tamper && rel === 'favicon.svg' ? Buffer.from(body.toString().replace('svg', 'SVG')) : body;
    writeFileSync(join(root, 'web', rel), onDisk);
    files[rel] = { size: body.length, sha256: createHash('sha256').update(body).digest('hex'), type: launcherModule.mimeFor ? (launcherModule.mimeFor as (p: string) => string)(rel) : '' };
  }
  writeFileSync(join(root, 'web-manifest.json'), JSON.stringify({ version: 1, files }));
  return root;
}

interface Running {
  child: ChildProcess;
  port: number;
  stdout: () => string;
}

function startLauncher(root: string, args: string[]): Promise<Running> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'dems-web-launcher.cjs'), '--no-open', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => reject(new Error(`launcher did not start: ${out}`)), 8000);
    child.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
      const m = /Open in Chrome or Edge:\s+http:\/\/127\.0\.0\.1:(\d+)\//.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({ child, port: Number(m[1]), stdout: () => out });
      }
    });
    child.stderr?.on('data', (d: Buffer) => (out += d.toString()));
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`launcher exited early (${String(code)}): ${out}`));
    });
  });
}

function runToExit(root: string, args: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, 'dems-web-launcher.cjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));
    child.on('exit', (code) => resolve({ code, out }));
  });
}

function request(
  port: number,
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: init.method ?? 'GET', headers: { Host: `127.0.0.1:${port}`, ...init.headers }, agent: false },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Raw handshake, then one client frame written by the test; resolves the server's close code. */
function rawWsCloseCode(port: number, frame: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    let buf = Buffer.alloc(0);
    let upgraded = false;
    const timer = setTimeout(() => reject(new Error('no close frame')), 5000);
    sock.on('connect', () =>
      sock.write(
        `GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      ),
    );
    sock.on('data', (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      if (!upgraded) {
        const end = buf.indexOf('\r\n\r\n');
        if (end < 0) return;
        upgraded = true;
        buf = buf.subarray(end + 4);
        sock.write(frame);
      }
      // Walk server frames until the close frame (opcode 8).
      while (buf.length >= 2) {
        const opcode = buf[0]! & 0x0f;
        let len = buf[1]! & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2);
          off = 4;
        }
        if (buf.length < off + len) return;
        if (opcode === 0x8) {
          clearTimeout(timer);
          sock.destroy();
          resolve(buf.readUInt16BE(off));
          return;
        }
        buf = buf.subarray(off + len);
      }
    });
    sock.on('error', reject);
  });
}

describe('standalone launcher: shared contract constants', () => {
  it('equals @dems/shared/api and the packaged CSP of step 100', () => {
    expect(launcherModule.HEALTH_PATH).toBe(HEALTH_PATH);
    expect(launcherModule.WS_PATH).toBe(WS_PATH);
    expect(launcherModule.HEARTBEAT_INTERVAL_MS).toBe(HEARTBEAT_INTERVAL_MS);
    expect(launcherModule.SERVICE_NAME).toBe(SERVICE_NAME);
    expect(launcherModule.API_VERSION).toBe(API_VERSION);
    for (const port of [4410, 4419, 51234]) {
      expect(launcherModule.cspHeader(port)).toBe(packagedCsp({ delivery: 'header', port }));
    }
  });
});

describe('standalone launcher: HTTP + WS on one loopback origin', () => {
  let root: string;
  let run: Running;

  beforeAll(async () => {
    root = makeRoot();
    run = await startLauncher(root, ['--port', '0']);
  });
  afterAll(() => {
    run?.child.kill('SIGKILL');
    rmSync(root, { recursive: true, force: true });
  });

  it('serves schema-valid health with the launcher header and the security headers', async () => {
    const res = await request(run.port, HEALTH_PATH);
    expect(res.status).toBe(200);
    expect(res.headers['x-dems-launcher']).toBe('0.1.0');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toBe(packagedCsp({ delivery: 'header', port: run.port }));
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    const health = HealthResponseSchema.parse(JSON.parse(res.body.toString()));
    expect(health.version).toBe('0.1.0');
  });

  it('streams schema-valid heartbeats to a same-origin ws client (immediate + 1 Hz)', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${run.port}/ws`, { origin: `http://127.0.0.1:${run.port}` });
    const beats = await new Promise<unknown[]>((resolve, reject) => {
      const got: unknown[] = [];
      const timer = setTimeout(() => reject(new Error(`only ${got.length} heartbeats`)), 3500);
      client.on('message', (data) => {
        got.push(HeartbeatSchema.parse(JSON.parse(data.toString())));
        if (got.length >= 2) {
          clearTimeout(timer);
          resolve(got);
        }
      });
      client.on('error', reject);
    });
    expect(beats).toHaveLength(2);
    client.close();
  });

  it('rejects a foreign WS origin (403) and accepts http://localhost:<port>', async () => {
    const status = await new Promise<number>((resolve) => {
      const bad = new WebSocket(`ws://127.0.0.1:${run.port}/ws`, { origin: 'http://evil.example' });
      bad.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      bad.on('open', () => resolve(101));
      bad.on('error', () => undefined);
    });
    expect(status).toBe(403);
    const ok = new WebSocket(`ws://127.0.0.1:${run.port}/ws`, { origin: `http://localhost:${run.port}` });
    await new Promise<void>((resolve, reject) => {
      ok.on('message', () => resolve());
      ok.on('error', reject);
    });
    ok.close();
  });

  it('rejects a foreign Host (421) and other methods (405)', async () => {
    expect((await request(run.port, '/', { headers: { Host: `evil.example:${run.port}` } })).status).toBe(421);
    expect((await request(run.port, '/', { headers: { Host: `localhost:${run.port}` } })).status).toBe(200);
    const post = await request(run.port, '/', { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.allow).toBe('GET, HEAD');
  });

  it('serves ranges (206/416), revalidation (304) and immutable /assets caching', async () => {
    const full = await request(run.port, '/assets/clip-1a2b.mp4');
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toBe('video/mp4');
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const part = await request(run.port, '/assets/clip-1a2b.mp4', { headers: { Range: 'bytes=10-19' } });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 10-19/4096');
    expect(part.body.equals(FILES['assets/clip-1a2b.mp4']!.subarray(10, 20))).toBe(true);
    const tail = await request(run.port, '/assets/clip-1a2b.mp4', { headers: { Range: 'bytes=-6' } });
    expect(tail.headers['content-range']).toBe('bytes 4090-4095/4096');
    const bad = await request(run.port, '/assets/clip-1a2b.mp4', { headers: { Range: 'bytes=9999-' } });
    expect(bad.status).toBe(416);
    expect(bad.headers['content-range']).toBe('bytes */4096');
    const multi = await request(run.port, '/assets/clip-1a2b.mp4', { headers: { Range: 'bytes=0-1,5-6' } });
    expect(multi.status).toBe(200);
    const etag = String(full.headers.etag);
    expect((await request(run.port, '/assets/clip-1a2b.mp4', { headers: { 'If-None-Match': etag } })).status).toBe(304);
  });

  it('falls back to index.html for app routes, 404s for missing files, traversal and other /api', async () => {
    for (const route of ['/', '/dashboard', '/evidence/CASE-0001']) {
      const res = await request(run.port, route);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(res.body.equals(FILES['index.html']!)).toBe(true);
    }
    expect((await request(run.port, '/missing.png')).status).toBe(404);
    expect((await request(run.port, '/../web-manifest.json')).status).toBe(404);
    expect((await request(run.port, '/%2e%2e/web-manifest.json')).status).toBe(404);
    expect((await request(run.port, '/assets/%2e%2e/%2e%2e/dems-web-launcher.cjs')).status).toBe(404);
    expect((await request(run.port, '/web-manifest.json')).status).toBe(404);
    const api = await request(run.port, '/api/v1/sessions');
    expect(api.status).toBe(404);
    expect(JSON.parse(api.body.toString())).toEqual({ error: 'not_found' });
    expect((await request(run.port, '/ws')).status).toBe(426);
  });

  it('closes 1002 on an unmasked client frame and 1009 on an oversize message', async () => {
    const unmasked = Buffer.concat([Buffer.from([0x81, 0x02]), Buffer.from('hi')]);
    expect(await rawWsCloseCode(run.port, unmasked)).toBe(1002);
    const client = new WebSocket(`ws://127.0.0.1:${run.port}/ws`, { origin: `http://127.0.0.1:${run.port}` });
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });
    const code = await new Promise<number>((resolve) => {
      client.on('close', (c) => resolve(c));
      client.send(Buffer.alloc(70_000, 0x61));
    });
    expect(code).toBe(1009);
  });
});

describe('standalone launcher: lifecycle', () => {
  it('SIGTERM closes WS clients with 1001 and exits 0', async () => {
    const root = makeRoot();
    const run = await startLauncher(root, ['--port', '0']);
    const client = new WebSocket(`ws://127.0.0.1:${run.port}/ws`, { origin: `http://127.0.0.1:${run.port}` });
    await new Promise<void>((resolve, reject) => {
      client.on('message', () => resolve());
      client.on('error', reject);
    });
    const closed = new Promise<number>((resolve) => client.on('close', (c) => resolve(c)));
    const exited = new Promise<number | null>((resolve) => run.child.on('exit', (c) => resolve(c)));
    run.child.kill('SIGTERM');
    expect(await closed).toBe(1001);
    expect(await exited).toBe(0);
    rmSync(root, { recursive: true, force: true });
  }, 10_000);

  it('--self-test exits 0 and reports every asset hash; a tampered file exits 1', async () => {
    const root = makeRoot();
    const ok = await runToExit(root, ['--self-test']);
    expect(ok.code).toBe(0);
    const summary = JSON.parse(ok.out) as { ok: boolean; assets: { files: number; hashMismatches: number } };
    expect(summary.ok).toBe(true);
    expect(summary.assets.files).toBe(Object.keys(FILES).length);
    expect(summary.assets.hashMismatches).toBe(0);
    const bad = makeRoot(true);
    const fail = await runToExit(bad, ['--self-test']);
    expect(fail.code).toBe(1);
    rmSync(root, { recursive: true, force: true });
    rmSync(bad, { recursive: true, force: true });
  }, 15_000);

  it('--version prints the product line', async () => {
    const root = makeRoot();
    const res = await runToExit(root, ['--version']);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/^DEMS Web Demo 0\.1\.0 \(node v\d+\.\d+\.\d+, runtime, \w+-\w+\)/);
    rmSync(root, { recursive: true, force: true });
  });

  it('--port is strict when the port is busy', async () => {
    const root = makeRoot();
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', () => resolve()));
    const port = (blocker.address() as net.AddressInfo).port;
    const res = await runToExit(root, ['--no-open', '--port', String(port)]);
    expect(res.code).toBe(1);
    expect(res.out).toContain('already in use');
    blocker.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('falls back from a busy 4410 to 4411 and a second launch exits 0 (single instance)', async (ctx) => {
    const free = async (p: number) =>
      new Promise<boolean>((resolve) => {
        const s = net.createServer();
        s.once('error', () => resolve(false));
        s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)));
      });
    if (!(await free(4410)) || !(await free(4411))) ctx.skip();
    const root = makeRoot();
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(4410, '127.0.0.1', () => resolve()));
    const first = await startLauncher(root, []);
    expect(first.port).toBe(4411);
    const second = await runToExit(root, ['--no-open']);
    expect(second.code).toBe(0);
    expect(second.out).toContain('already running: http://127.0.0.1:4411/');
    first.child.kill('SIGTERM');
    blocker.close();
    rmSync(root, { recursive: true, force: true });
  }, 15_000);
});
