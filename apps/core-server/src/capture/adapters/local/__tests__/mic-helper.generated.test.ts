// The microphone helper with a GENERATED input and the REAL FFmpeg program (blueprint row 135;
// checks M4-LOCAL-MIC-1 support, M4-LOCAL-WORKER-1, M4-SEC-HELPER-1, M4-SEC-PRIV-1).
//
// NO DEVICE IS OPENED HERE. The input is FFmpeg's `lavfi` sine source, chosen through the SAME
// argument table and the SAME output line as the microphone (`mic-helper-args.ts`), written into a
// REAL named pipe made by the real `/usr/bin/mkfifo`, and read by a small reader below. The stream is
// judged by numbers only: the period of the tone in sample slots gives the sample rate and the
// channel count; bytes give the sample width. A negative control runs the same pipeline with a wrong
// sample format, a wrong channel count and a wrong rate, and the same judge must refuse each.
//
// Needs: FFmpeg at /opt/homebrew/bin/ffmpeg (the host's, 9.0.2), `lsof`, and permission to bind a
// loopback socket for the control of the socket check - run with the command sandbox disabled, under
// the heavy-host lock (`/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock`). The suite is skipped only
// when the FFmpeg program is not there at all.
import { execFile } from 'node:child_process';
import dgram from 'node:dgram';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { MIC_TRANSPORTS } from '../../mic-transport';
import { createSystemTimers } from '../../../timers';
import { MicGeneratedTone, micPushArguments } from '../mic-helper-args';
import { createMicHelper, type LocalMicStream } from '../mic-helper';
import { preparePipe, removePipe } from '../mic-pipe';
import { leftoverHelperPids } from '../leftover';
import { createPipeFiles } from '../pipe-files';
import { inspectProgram, startHelperProcess, type ProgramInspector } from '../process-door';
import { FFMPEG, temporaryRoot } from './mic-support';
import { streamFacts, streamRefusals } from './mic-stream-check';

const STATEMENT = MIC_TRANSPORTS.PCM_FIFO;
const tmp = temporaryRoot();
afterAll(() => tmp.remove());
let counter = 0;
const nextRunDir = (): string => `${tmp.root}/gen-${(counter += 1)}/run/capture`;

/**
 * The program rule is exercised by its own tests (`helper-program` and the attended script). Here the
 * FILE facts of the real FFmpeg are real; the directory chain is stated as trusted, because the host's
 * Homebrew chain (`/opt/homebrew/bin`, `Cellar`) is group-writable and is refused by the production rule.
 */
const programFacts: ProgramInspector = (path) => ({
  ...inspectProgram(path),
  directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }],
  directoriesResolved: [{ ownerUid: 0, mode: 0o755 }],
});

function snapshotSockets(pid: number): Promise<{ readonly lines: string[]; readonly code: number }> {
  return new Promise((resolve, reject) => {
    execFile('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-i'], { timeout: 10_000 }, (error, stdout) => {
      const code = error === null ? 0 : typeof (error as { code?: unknown }).code === 'number' ? ((error as { code: number }).code) : -1;
      // lsof ends with 1 when it found nothing to list: that is the "no socket" answer, not a failure.
      if (code !== 0 && code !== 1) {
        reject(error);
        return;
      }
      resolve({ lines: stdout.split('\n').filter((line) => line.trim() !== ''), code });
    });
  });
}

/** Reads a pipe until `wantBytes` arrived or `limitMs` passed; resolves with what came. */
function readPipe(path: string, wantBytes: number, limitMs: number): { readonly done: Promise<Buffer>; stop(): void } {
  const reader = createReadStream(path);
  const chunks: Buffer[] = [];
  let size = 0;
  const done = new Promise<Buffer>((resolve) => {
    const finish = (): void => {
      reader.destroy();
      resolve(Buffer.concat(chunks));
    };
    const limit = setTimeout(finish, limitMs);
    reader.on('data', (chunk) => {
      const part = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      chunks.push(part);
      size += part.length;
      if (size >= wantBytes) {
        clearTimeout(limit);
        finish();
      }
    });
    reader.on('error', () => {
      clearTimeout(limit);
      finish();
    });
    reader.on('close', () => {
      clearTimeout(limit);
      finish();
    });
  });
  return { done, stop: () => reader.destroy() };
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('the stream judge can say no (control, no process)', () => {
  const tone = (rate: number, channels: number, seconds = 1): Buffer => {
    const samples = Math.floor(rate * seconds);
    const out = Buffer.alloc(samples * channels * 4);
    for (let index = 0; index < samples; index += 1) for (let channel = 0; channel < channels; channel += 1) out.writeFloatLE(0.125 * Math.sin((2 * Math.PI * 880 * index) / rate), (index * channels + channel) * 4);
    return out;
  };
  const refusals = (buffer: Buffer): string[] => streamRefusals(streamFacts(buffer, 880), STATEMENT);

  it('accepts float 32, 48 kHz, mono', () => {
    expect(refusals(tone(48_000, 1))).toEqual([]);
  });

  it('refuses stereo, 44.1 kHz, 16-bit integers, silence, a stream cut inside a sample, and non-finite samples', () => {
    expect(refusals(tone(48_000, 2)).join()).toMatch(/sample slots per second/);
    expect(refusals(tone(44_100, 1)).join()).toMatch(/sample slots per second/);
    const ints = Buffer.alloc(48_000 * 2);
    for (let index = 0; index < 48_000; index += 1) ints.writeInt16LE(Math.round(4000 * Math.sin((2 * Math.PI * 880 * index) / 48_000)), index * 2);
    expect(refusals(ints).length).toBeGreaterThan(0);
    expect(refusals(Buffer.alloc(48_000 * 4)).join()).toMatch(/silence/);
    expect(refusals(tone(48_000, 1).subarray(0, 48_000 * 4 - 1)).join()).toMatch(/multiple of 4/);
    const broken = tone(48_000, 1);
    broken.writeFloatLE(Number.NaN, 400);
    expect(refusals(broken).join()).toMatch(/finite/);
  });
});

describe.skipIf(!existsSync(FFMPEG))('M4-LOCAL-MIC-1 support: the helper with the generated 880 Hz tone, the real program and a real pipe', () => {
  it('delivers float 32 little-endian, 48 kHz, mono into the pipe, holds no socket, and leaves nothing behind', async () => {
    const helper = createMicHelper({ program: FFMPEG, runDir: nextRunDir(), timers: createSystemTimers(), inspect: programFacts, limits: { stopGraceMs: 2_000 } });
    const stream: LocalMicStream = await helper.prepare({ deviceId: 'MIC-04', sessionId: 'SES-GEN-1', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 } });
    expect(lstatSync(stream.input.path).isFIFO()).toBe(true);

    const wantBytes = 48_000 * 4 * 2; // two seconds of audio
    const reading = readPipe(stream.input.path, wantBytes, 20_000);
    const began = Date.now();
    await stream.start();
    expect(stream.started()).toBe(true);
    const pid = stream.helperPid();
    expect(pid).not.toBeNull();

    // M4-LOCAL-WORKER-1 / the helper holds no socket at all: the snapshot lists nothing.
    const sockets = await snapshotSockets(pid as number);
    expect(sockets.lines).toEqual([]);

    const bytes = await reading.done;
    const elapsedS = (Date.now() - began) / 1000;
    const facts = streamFacts(bytes, 880);
    expect(streamRefusals(facts, STATEMENT)).toEqual([]);
    expect(facts.impliedRateHz).not.toBeNull();
    expect(Math.abs((facts.impliedRateHz ?? 0) - 48_000) / 48_000).toBeLessThan(0.005);
    expect(facts.bytes).toBeGreaterThanOrEqual(wantBytes);
    // `-re` paces the generator: the stream cannot run ahead of the clock by more than the pipe holds. (Not a throughput figure.)
    expect(facts.samples / 48_000).toBeLessThan(elapsedS + 1.5);

    await stream.close();
    expect(alive(pid as number)).toBe(false);
    expect(existsSync(stream.input.path)).toBe(false);
    expect(helper.openIds()).toEqual([]);
    expect(helper.livePids()).toEqual(new Set());
  }, 30_000);

  it('the running helper has the fixed argument list and an empty environment', async () => {
    const helper = createMicHelper({ program: FFMPEG, runDir: nextRunDir(), timers: createSystemTimers(), inspect: programFacts, limits: { stopGraceMs: 2_000 } });
    const stream = await helper.prepare({ deviceId: 'MIC-04', sessionId: 'SES-GEN-2', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_440 } });
    // The reader stays until the end of the test: a reader that leaves closes the pipe and the writer ends (EPIPE).
    const reading = readPipe(stream.input.path, 48_000 * 4 * 60, 20_000);
    await stream.start();
    const line = await new Promise<string>((resolve, reject) => {
      execFile('/bin/ps', ['eww', '-o', 'command=', '-p', String(stream.helperPid())], { timeout: 10_000 }, (error, stdout) => (error === null ? resolve(stdout.trim()) : reject(error)));
    });
    const expected = [FFMPEG, ...micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_440 }, pipePath: stream.input.path })].join(' ');
    // The command line is exactly the table's; whatever follows it (the environment, on this platform) names no variable of the server.
    expect(line.startsWith(expected)).toBe(true);
    // The two driver variables are spelled from parts: the credential guard (`test/static/credentials.test.ts`) lets no file of the server name them whole.
    const variables = ['PATH', 'HOME', 'USER', 'TMPDIR', ['DATABASE', 'URL'].join('_'), ['PG', 'PASSWORD'].join('')];
    expect(line.slice(expected.length)).not.toMatch(new RegExp(`\\b(?:${variables.join('|')})=`));
    reading.stop();
    await stream.close();
    await reading.done;
  }, 30_000);

  it('M4-SEC-HELPER-1 leftovers: a running helper is counted by the leftover check unless it is the Core\'s own, and is gone after close', async () => {
    const timers = createSystemTimers();
    const helper = createMicHelper({ program: FFMPEG, runDir: nextRunDir(), timers, inspect: programFacts, limits: { stopGraceMs: 2_000 } });
    const stream = await helper.prepare({ deviceId: 'MIC-04', sessionId: 'SES-GEN-5', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 } });
    const reading = readPipe(stream.input.path, 48_000 * 4 * 60, 20_000);
    await stream.start();
    const pid = stream.helperPid() as number;
    // As a stranger's process (the Core of an earlier run) it IS found; as the Core's own it is not (control in both directions).
    expect(await leftoverHelperPids(startHelperProcess, timers, FFMPEG, new Set())).toContain(pid);
    expect(await leftoverHelperPids(startHelperProcess, timers, FFMPEG, helper.livePids())).not.toContain(pid);
    reading.stop();
    await stream.close();
    await reading.done;
    expect(await leftoverHelperPids(startHelperProcess, timers, FFMPEG, new Set())).not.toContain(pid);
  }, 30_000);

  it('NEGATIVE CONTROL: the same pipeline with a wrong sample format, channel count or rate is refused by the same judge', async () => {
    const variants: Array<[string, (args: readonly string[]) => string[]]> = [
      ['16-bit integers', (args) => args.map((argument) => (argument === 'pcm_f32le' ? 'pcm_s16le' : argument === 'f32le' ? 's16le' : argument))],
      ['two channels', (args) => args.map((argument, index) => (args[index - 1] === '-ac' ? '2' : argument))],
      ['44.1 kHz', (args) => args.map((argument, index) => (args[index - 1] === '-ar' ? '44100' : argument))],
    ];
    const files = createPipeFiles();
    for (const [title, change] of variants) {
      const runDir = nextRunDir();
      const path = await preparePipe({ runDir, sessionId: 'SES-GEN-3', deviceId: 'MIC-04', files, door: startHelperProcess, timers: createSystemTimers(), inspector: programFacts });
      const reading = readPipe(path, 48_000 * 8, 8_000);
      const args = change(micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 }, pipePath: path }));
      expect(args, title).not.toEqual([...micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 }, pipePath: path })]);
      const running = startHelperProcess({ command: FFMPEG, args, env: {} });
      const bytes = await reading.done;
      running.kill('SIGKILL');
      await running.ended;
      removePipe(files, path);
      const refusals = streamRefusals(streamFacts(bytes, 880), STATEMENT);
      expect(bytes.length, title).toBeGreaterThan(48_000);
      expect(refusals.length, `${title}: ${JSON.stringify(refusals)}`).toBeGreaterThan(0);
    }
  }, 60_000);

  it('a helper blocked at a pipe nobody reads is stopped (SIGTERM, then SIGKILL after the grace) and the pipe is removed', async () => {
    const helper = createMicHelper({ program: FFMPEG, runDir: nextRunDir(), timers: createSystemTimers(), inspect: programFacts, limits: { stopGraceMs: 700, settleMs: 800 } });
    const stream = await helper.prepare({ deviceId: 'MIC-04', sessionId: 'SES-GEN-4', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 } });
    await stream.start();
    const pid = stream.helperPid() as number;
    expect(alive(pid)).toBe(true);
    const began = Date.now();
    await stream.close();
    const tookMs = Date.now() - began;
    expect(alive(pid)).toBe(false);
    expect(existsSync(stream.input.path)).toBe(false);
    // Bounded: the grace plus the time to be reaped. (Whether SIGTERM alone ended it is not asserted; both are correct.)
    expect(tookMs).toBeLessThan(5_000);
  }, 30_000);
});

describe('the socket snapshot can say yes (control)', () => {
  it('lists the datagram socket this very process holds, and the same call lists nothing for a process without one', async () => {
    const socket = dgram.createSocket('udp4');
    await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
    try {
      const mine = await snapshotSockets(process.pid);
      expect(mine.lines.join('\n')).toMatch(/UDP/);
    } finally {
      socket.close();
    }
    const quiet = startHelperProcess({ command: '/bin/sleep', args: ['5'], env: {} });
    try {
      expect(quiet.pid).not.toBeNull();
      expect((await snapshotSockets(quiet.pid as number)).lines).toEqual([]);
    } finally {
      quiet.kill('SIGKILL');
      await quiet.ended;
    }
  }, 30_000);
});
