/**
 * Row C1D (D149): the two reads a gated end-to-end test prints when the sources of its session do not
 * open (`capture-open-causes.ts`). DB-free: a temporary error log file and loopback sockets only.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OPEN_FAILURE_CODES, openFailuresOf, probeLoopbackReach } from './capture-open-causes';

const dirs: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
});

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address !== null ? resolve(address.port) : reject(new Error('no port'))));
    });
  });

describe('openFailuresOf: the recorded cause of an open that failed', () => {
  it('reads the camera and microphone open failures of the error log, with device, cause, error names and the first frames; nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rc1d-'));
    dirs.push(dir);
    const file = join(dir, 'error.log');
    const rows = [
      { level: 'warn', source: 'captureSession', message: 'a camera of the session could not be opened', errorName: 'LocalSourceError', stackTrace: 'at open (src/capture/adapters/local/camera-helper.ts:331:17)\nat async x (a.ts:1:1)\nat y (b.ts:2:2)', code: 'CAPTURE_CAMERA_NOT_OPENED', context: { sessionId: 'SES-20261106-0001', deviceId: 'CAM-01' } },
      { level: 'warn', source: 'captureSession', message: 'a camera of the session could not be opened', code: 'CAPTURE_CAMERA_NOT_OPENED', context: { sessionId: 'SES-20261106-0001', deviceId: 'CAM-02', cause: 'CAMERA_OPEN_BOUND' } },
      { level: 'warn', source: 'captureSession', message: 'a microphone of the session could not be opened', errorName: 'Error', causeName: 'MicError', code: 'CAPTURE_MIC_NOT_OPENED', context: { sessionId: 'SES-20261106-0001', deviceId: 'MIC-02', channel: 'MIC-02' } },
      { level: 'error', source: 'captureSession', message: 'other', code: 'CAPTURE_SOURCE_NOT_CLOSED', context: { deviceId: 'CAM-03' } },
    ];
    writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\nnot json\n\n`);
    expect(OPEN_FAILURE_CODES).toEqual(['CAPTURE_CAMERA_NOT_OPENED', 'CAPTURE_MIC_NOT_OPENED']);
    expect(openFailuresOf(file)).toEqual([
      { code: 'CAPTURE_CAMERA_NOT_OPENED', deviceId: 'CAM-01', cause: null, errorName: 'LocalSourceError', causeName: null, frames: ['at open (src/capture/adapters/local/camera-helper.ts:331:17)', 'at async x (a.ts:1:1)'] },
      { code: 'CAPTURE_CAMERA_NOT_OPENED', deviceId: 'CAM-02', cause: 'CAMERA_OPEN_BOUND', errorName: null, causeName: null, frames: [] },
      { code: 'CAPTURE_MIC_NOT_OPENED', deviceId: 'MIC-02', cause: null, errorName: 'Error', causeName: 'MicError', frames: [] },
    ]);
  });

  it('gives nothing for no file, a missing file, or a file without open failures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rc1d-'));
    dirs.push(dir);
    expect(openFailuresOf(null)).toEqual([]);
    expect(openFailuresOf(undefined)).toEqual([]);
    expect(openFailuresOf(join(dir, 'absent.log'))).toEqual([]);
    writeFileSync(join(dir, 'other.log'), `${JSON.stringify({ code: 'SEALING_COMPLETE', context: {} })}\n`);
    expect(openFailuresOf(join(dir, 'other.log'))).toEqual([]);
  });
});

describe('probeLoopbackReach: may this process connect to a loopback port at all', () => {
  it('OPEN on a free port this host lets the process reach; the probe leaves the port free', async () => {
    const port = await freePort();
    expect(await probeLoopbackReach(port)).toBe('OPEN');
    expect(await probeLoopbackReach(port)).toBe('OPEN');
  });

  it('PORT_BUSY when another listener holds the port: nothing is connected to it', async () => {
    let connected = 0;
    const holder = createServer((socket) => {
      connected += 1;
      socket.destroy();
    });
    servers.push(holder);
    const port = await new Promise<number>((resolve) => holder.listen({ port: 0, host: '127.0.0.1' }, () => resolve((holder.address() as { port: number }).port)));
    expect(await probeLoopbackReach(port)).toBe('PORT_BUSY');
    expect(connected).toBe(0);
  });
});
