// Task 4 row 105 (WP-19b): the one local-socket client and the platform seam of the address
// helper, against a RECORDING DOUBLE: a local socket server of this test, in a temporary folder,
// that speaks the helper's line protocol (one request line in, one `<code> <NAME>` line out, then
// it closes) with every code of the helper's table, and that can hang, close, flood or answer
// nonsense. It records every request it received.
//
// The real helper is not on this machine and is never started: no `ip`, no `arping`, no `sudo`,
// no network address is dialled. The double changes nothing but its own list.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { HELPER_CODES, HostAliasTransportFailure, createHostAliasCaller, type HelperCodeName, type HostAliasFacts, type HostAliasTransport } from '../capture/host-alias';
import {
  HOST_ALIAS_ANSWER_MAX_BYTES,
  HOST_ALIAS_CALL_BOUND_MS,
  HOST_ALIAS_REQUEST_MAX_BYTES,
  LOCAL_SOCKET_FAILURES,
  createLocalSocketTransport,
  hostAliasSocketTransportOf,
  type LocalSocketTransport,
} from '../host-alias-socket';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAMES = Object.keys(HELPER_CODES) as HelperCodeName[];
const ME = process.getuid?.() ?? -1;
const CANARY = 'eth9 /home/dems/.ssh hunter2';
const ADD = 'add 192.168.1.253/24 30\n';
const DEL = 'del 192.168.1.253/24\n';
/** The bound of the tests: a hanging double is given up after this, not after the product's 35 s. */
const BOUND_MS = 200;

/** What the double does with the next connection. */
type Plan =
  | { readonly answer: string | Buffer }
  | { readonly pieces: readonly string[] }
  | { readonly flood: true }
  | 'hang'
  | 'answer-and-stay'
  | 'close'
  | 'reset';

/** The helper's request grammar (its `parse_request`, as far as the form goes). */
const HELPER_REQUEST = /^(?:add (?:[0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2} [1-9][0-9]{0,2}|del (?:[0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2})$/;

interface Double {
  readonly path: string;
  readonly folder: string;
  readonly requests: string[];
  readonly connections: () => number;
  readonly closedByClient: () => number;
  plan(...next: Plan[]): void;
  stop(): Promise<void>;
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

function folder(): string {
  const made = mkdtempSync(join(tmpdir(), 'na-'));
  cleanups.push(() => rmSync(made, { recursive: true, force: true }));
  return made;
}

async function double(options: { mode?: number; in?: string } = {}): Promise<Double> {
  const root = options.in ?? folder();
  const path = join(root, 'socket');
  const requests: string[] = [];
  const plans: Plan[] = [];
  const open = new Set<Socket>();
  let connections = 0;
  let closedByClient = 0;
  const server: Server = createServer((socket) => {
    connections += 1;
    open.add(socket);
    let received = '';
    let served = false;
    /** True once the double itself ended or broke the connection: a close after that is not the client's. */
    let endedHere = false;
    const finish = (text?: string | Buffer): void => {
      endedHere = true;
      if (text === undefined) socket.end();
      else socket.end(text);
    };
    const leftByClient = (): void => {
      if (!endedHere) closedByClient += 1;
      endedHere = true;
    };
    socket.on('error', () => undefined);
    socket.on('end', leftByClient);
    socket.on('close', () => {
      open.delete(socket);
      leftByClient();
    });
    socket.on('data', (chunk: Buffer) => {
      received += chunk.toString('latin1');
      if (served || !received.includes('\n')) return;
      served = true;
      requests.push(received);
      const line = received.slice(0, received.indexOf('\n'));
      const plan = plans.shift() ?? { answer: '60 INTERNAL\n' };
      // The double refuses what the helper would refuse by form, whatever was planned.
      if (received.length > 64) finish('13 REQUEST_TOO_LONG\n');
      else if (received.indexOf('\n') !== received.length - 1 || !HELPER_REQUEST.test(line)) finish('14 REQUEST_MALFORMED\n');
      else if (plan === 'hang') return;
      else if (plan === 'close') finish();
      else if (plan === 'reset') {
        endedHere = true;
        socket.destroy();
      } else if (plan === 'answer-and-stay') socket.write('0 OK\n');
      else if ('flood' in plan) {
        const pump = (): void => {
          while (!socket.destroyed && socket.write('0 OK 0 OK 0 OK 0 OK\n'.repeat(64))) continue;
          if (!socket.destroyed) socket.once('drain', pump);
        };
        pump();
      } else if ('pieces' in plan) {
        const pieces = [...plan.pieces];
        const next = (): void => {
          const piece = pieces.shift();
          if (piece === undefined) finish();
          else socket.write(piece, () => setTimeout(next, 5));
        };
        next();
      } else finish(plan.answer);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, resolve);
  });
  chmodSync(path, options.mode ?? 0o660);
  const stop = async (): Promise<void> => {
    for (const socket of open) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  cleanups.push(stop);
  return { path, folder: root, requests, connections: () => connections, closedByClient: () => closedByClient, plan: (...next) => void plans.push(...next), stop };
}

const transportTo = (path: string, trustedOwnerUid: number = ME): LocalSocketTransport => createLocalSocketTransport({ socketPath: path, trustedOwnerUid, boundMs: BOUND_MS });

const FACTS: HostAliasFacts = {
  storedInterface: 'eth1',
  fileInterface: 'eth1',
  cameraSubnet: { network: '192.168.100.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.100.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  hostAddresses: ['10.20.0.5', '192.168.100.1'],
};

function callerOver(transport: HostAliasTransport) {
  const entries: unknown[] = [];
  const caller = createHostAliasCaller<{ readonly who: string }, number>({
    transport,
    facts: async () => FACTS,
    journal: {
      intent: async (entry) => entries.push(['intent', entry]),
      result: async (entry) => void entries.push(['result', entry]),
    },
  });
  return { caller, entries };
}

describe('the client and the caller against the recording double', () => {
  it('every code of the helper, for add and for remove: the double received exactly the one line, the Core names the answer', async () => {
    const helper = await double();
    const { caller, entries } = callerOver(transportTo(helper.path));
    for (const name of NAMES) {
      helper.plan({ answer: `${HELPER_CODES[name]} ${name}\n` }, { answer: `${HELPER_CODES[name]} ${name}\n` });
      const added = await caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op-technician' } });
      const removed = await caller.remove({ address: '192.168.1.253', subject: { who: 'op-technician' } });
      for (const outcome of [added, removed]) {
        expect(outcome, name).toMatchObject({ refusal: name === 'OK' ? null : `HELPER_${name}`, helperCode: HELPER_CODES[name], attempted: true, resultRecorded: true });
      }
    }
    expect(helper.requests).toEqual(NAMES.flatMap(() => [ADD, DEL]));
    // Pass I-9b: 41 codes (36 + the five of the helper's R119 fixes), one connection per action: 72 + 10.
    expect(helper.connections()).toBe(82);
    // 1 intent and 1 result entry per action.
    expect(entries.map((entry) => (entry as [string])[0])).toEqual(NAMES.flatMap(() => ['intent', 'result', 'intent', 'result']));
  });

  it('an answer that arrives in pieces is one answer', async () => {
    const helper = await double();
    helper.plan({ pieces: ['4', '4 ADDRESS_', 'IN_USE', '\n'] });
    await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'ANSWER', text: '44 ADDRESS_IN_USE\n' });
  });

  it('a helper that hangs is given up inside the bound, and the connection is closed by the Core', async () => {
    const helper = await double();
    for (const plan of ['hang', 'answer-and-stay'] as const) {
      helper.plan(plan);
      const before = helper.closedByClient();
      const started = performance.now();
      await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'TIMED_OUT' });
      const elapsed = performance.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(BOUND_MS - 20);
      expect(elapsed).toBeLessThan(BOUND_MS + 1500);
      await expect.poll(() => helper.closedByClient()).toBe(before + 1);
    }
    const { caller, entries } = callerOver(transportTo(helper.path));
    helper.plan('hang');
    await expect(caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op' } })).resolves.toMatchObject({ refusal: 'HELPER_TIMED_OUT', effect: 'UNKNOWN', attempted: true });
    expect(entries).toHaveLength(2);
    // The product's bound is longer than the helper's own 30 s, and it is a number, not "for ever".
    expect(HOST_ALIAS_CALL_BOUND_MS).toBe(35_000);
  });

  it('a connection that ends without an answer, or breaks', async () => {
    const helper = await double();
    for (const plan of ['close', 'reset'] as const) {
      helper.plan(plan);
      await expect(transportTo(helper.path).exchange(DEL), plan).resolves.toEqual({ kind: 'FAILED', failure: 'CONNECTION_LOST' });
    }
  });

  it('an oversized answer is cut at the bound: the Core stops reading and closes', async () => {
    const helper = await double();
    expect(HOST_ALIAS_ANSWER_MAX_BYTES).toBe(64);
    helper.plan({ answer: `0 OK${' '.repeat(60)}\n` });
    await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'ANSWER_TOO_LONG' });
    helper.plan({ answer: Buffer.alloc(4096, 0x41) }, { flood: true });
    await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'ANSWER_TOO_LONG' });
    const before = helper.closedByClient();
    await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'ANSWER_TOO_LONG' });
    await expect.poll(() => helper.closedByClient()).toBeGreaterThan(before);
    // Exactly at the bound the bytes are handed on, and the caller judges them.
    const atBound = `0 OK${' '.repeat(59)}\n`;
    helper.plan({ answer: atBound });
    await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'ANSWER', text: atBound });
  });

  it('a malformed answer: one fixed word, and nothing of its text in an outcome or an entry', async () => {
    const helper = await double();
    const { caller, entries } = callerOver(transportTo(helper.path));
    const answers: (string | Buffer)[] = [`0 OK ${CANARY}\n`, `${CANARY}\n`, '0 OK', '0 ok\n', '0 OK\n0 OK\n', '\u001b[2J0 OK\n', Buffer.from([0x30, 0x20, 0x4f, 0x4b, 0x00, 0x0a]), Buffer.from([0xff, 0xfe, 0x0a]), '52 OK\n', '7 UNKNOWN_NAME\n'];
    for (const text of answers) {
      helper.plan({ answer: text });
      await expect(caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op' } }), String(text)).resolves.toEqual({
        action: 'ADD',
        refusal: 'HELPER_ANSWER_NOT_UNDERSTOOD',
        effect: 'UNKNOWN',
        address: '192.168.1.253/24',
        attempted: true,
        helperCode: null,
        resultRecorded: true,
      });
    }
    const written = JSON.stringify(entries);
    for (const part of ['eth9', '/home', 'hunter2', 'u001b', 'UNKNOWN_NAME']) expect(written.includes(part), part).toBe(false);
    expect(entries).toHaveLength(answers.length * 2);
  });

  it('a line that is not a request of the helper\'s grammar is not sent: 0 connections', async () => {
    const helper = await double();
    const transport = transportTo(helper.path);
    for (const line of [
      'add 192.168.1.253/24 30',
      'add 192.168.1.253/24 30\n\n',
      'add 192.168.1.253/24 30\ndel 192.168.1.253/24\n',
      'add eth1 192.168.1.253/24 30\n',
      'add 192.168.1.253/24 30 eth1\n',
      'add 192.168.1.253/16 30\n',
      'add 192.168.1.253/24 0\n',
      'add 192.168.1.253/24 -I\n',
      'add 192.168.1.253/24\n',
      'del 192.168.1.253/24 30\n',
      'del camera.local/24\n',
      'check\n',
      'listen eth1 5\n',
      'ADD 192.168.1.253/24 30\n',
      ' add 192.168.1.253/24 30\n',
      'add 192.168.1.253/24 30\r\n',
      'add 192.168.1.253/24 30\0\n',
      `del 192.168.1.253/24${' '.repeat(HOST_ALIAS_REQUEST_MAX_BYTES)}\n`,
      '',
      undefined as unknown as string,
    ]) {
      await expect(transport.exchange(line), JSON.stringify(line)).resolves.toEqual({ kind: 'FAILED', failure: 'REQUEST_NOT_A_LINE' });
    }
    expect(helper.connections()).toBe(0);
  });
});

describe('refused before connecting, by what the client can check', () => {
  it('the socket is absent, or its folder is', async () => {
    const empty = folder();
    for (const path of [join(empty, 'socket'), join(empty, 'missing', 'socket')]) {
      const transport = transportTo(path);
      await expect(transport.preflight()).resolves.toBe('SOCKET_ABSENT');
      await expect(transport.exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_ABSENT' });
    }
    const { caller, entries } = callerOver(transportTo(join(empty, 'socket')));
    await expect(caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op' } })).resolves.toMatchObject({ refusal: 'HELPER_NOT_INSTALLED', effect: 'NOT_DONE', attempted: false });
    expect(entries).toEqual([]);
  });

  it('the node is not a socket: a file, a folder, a link to the real socket', async () => {
    const helper = await double();
    const root = folder();
    writeFileSync(join(root, 'file'), '0 OK\n', { mode: 0o660 });
    chmodSync(join(root, 'file'), 0o660);
    mkdirSync(join(root, 'dir'), { mode: 0o700 });
    symlinkSync(helper.path, join(root, 'link'));
    for (const name of ['file', 'dir', 'link']) {
      const transport = transportTo(join(root, name));
      await expect(transport.preflight(), name).resolves.toBe('SOCKET_NOT_A_SOCKET');
      await expect(transport.exchange(ADD), name).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_NOT_A_SOCKET' });
    }
    expect(helper.connections()).toBe(0);
  });

  it('the node has another mode than 0660', async () => {
    for (const mode of [0o666, 0o664, 0o662, 0o600, 0o760, 0o770, 0o4660, 0o2660]) {
      const helper = await double({ mode });
      expect(statSync(helper.path).mode & 0o7777).toBe(mode);
      const transport = transportTo(helper.path);
      await expect(transport.preflight(), mode.toString(8)).resolves.toBe('SOCKET_OWNER_OR_MODE');
      await expect(transport.exchange(ADD), mode.toString(8)).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_OWNER_OR_MODE' });
      expect(helper.connections()).toBe(0);
    }
  });

  it('the node or its folder is not the trusted owner\'s; the folder is writable by group or others', async () => {
    const helper = await double();
    // Another trusted owner than the one who made folder and node (on this Mac both have one owner: the folder speaks first).
    for (const other of [0, ME + 1]) {
      await expect(transportTo(helper.path, other).preflight()).resolves.toBe('SOCKET_DIRECTORY_UNSAFE');
      await expect(transportTo(helper.path, other).exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_DIRECTORY_UNSAFE' });
    }
    for (const mode of [0o770, 0o707, 0o720, 0o702, 0o1777]) {
      chmodSync(helper.folder, mode);
      await expect(transportTo(helper.path).exchange(ADD), mode.toString(8)).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_DIRECTORY_UNSAFE' });
    }
    chmodSync(helper.folder, 0o755);
    helper.plan({ answer: '0 OK\n' });
    await expect(transportTo(helper.path).exchange(ADD)).resolves.toEqual({ kind: 'ANSWER', text: '0 OK\n' });
    expect(helper.connections()).toBe(1);
  });

  it('the path is not a plain absolute path', async () => {
    const helper = await double();
    for (const path of ['socket', './socket', `${helper.folder}/../${helper.folder.split('/').pop() ?? ''}/socket`, `${helper.folder}//socket`, `${helper.folder}/./socket`, `${helper.path}/`, `${helper.path}\0`, '/socket', '/', '', `/${'a'.repeat(120)}/socket`]) {
      await expect(transportTo(path).preflight(), JSON.stringify(path)).resolves.toBe('SOCKET_PATH_UNSAFE');
      await expect(transportTo(path).exchange(ADD), JSON.stringify(path)).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_PATH_UNSAFE' });
    }
    expect(helper.connections()).toBe(0);
  });
});

describe('the platform seam', () => {
  it('off Linux: "not available on this platform", whatever is configured; nothing is touched', async () => {
    const helper = await double();
    for (const platform of ['darwin', 'win32', 'freebsd', 'Linux', '', process.platform === 'linux' ? 'darwin' : process.platform]) {
      for (const socketPath of [helper.path, null, '/run/dems-core-netalias/socket']) {
        const transport = hostAliasSocketTransportOf({ platform, socketPath });
        await expect(transport.preflight()).resolves.toBe('NOT_AVAILABLE_ON_THIS_PLATFORM');
        await expect(transport.exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'NOT_AVAILABLE_ON_THIS_PLATFORM' });
      }
    }
    expect(helper.connections()).toBe(0);
    const { caller, entries } = callerOver(hostAliasSocketTransportOf({ platform: 'darwin', socketPath: helper.path }));
    await expect(caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op' } })).resolves.toEqual({
      action: 'ADD',
      refusal: 'NOT_AVAILABLE_ON_THIS_PLATFORM',
      effect: 'NOT_DONE',
      address: '192.168.1.253/24',
      attempted: false,
      helperCode: null,
      resultRecorded: true,
    });
    await expect(caller.remove({ address: '192.168.1.253', subject: { who: 'op' } })).resolves.toMatchObject({ refusal: 'NOT_AVAILABLE_ON_THIS_PLATFORM', attempted: false });
    expect(entries).toEqual([]);
  });

  it('on Linux without a path: "not configured"; with a path the trusted owner is root, so a socket somebody else made is never dialled', async () => {
    const unset = hostAliasSocketTransportOf({ platform: 'linux', socketPath: null });
    await expect(unset.preflight()).resolves.toBe('NOT_CONFIGURED');
    await expect(unset.exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'NOT_CONFIGURED' });
    await expect(callerOver(unset).caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op' } })).resolves.toMatchObject({ refusal: 'HELPER_NOT_CONFIGURED', attempted: false });
    // The double is this test's own socket, mode 0660, in a private folder: everything right but the owner.
    if (ME === 0) return;
    const helper = await double();
    const pointed = hostAliasSocketTransportOf({ platform: 'linux', socketPath: helper.path });
    await expect(pointed.preflight()).resolves.toBe('SOCKET_DIRECTORY_UNSAFE');
    await expect(pointed.exchange(ADD)).resolves.toEqual({ kind: 'FAILED', failure: 'SOCKET_DIRECTORY_UNSAFE' });
    await expect(callerOver(pointed).caller.add({ address: '192.168.1.253', minutes: 30, subject: { who: 'op' } })).resolves.toMatchObject({ refusal: 'HELPER_SOCKET_UNSAFE', attempted: false });
    expect(helper.connections()).toBe(0);
  });

  it('the transport is the caller\'s port by structure, word for word', () => {
    const asPort: HostAliasTransport = hostAliasSocketTransportOf({ platform: 'darwin', socketPath: null });
    expect(typeof asPort.exchange).toBe('function');
    expect([...LOCAL_SOCKET_FAILURES].sort()).toEqual(Object.keys(HostAliasTransportFailure).sort());
  });
});

describe('static: one local socket, in one file, by path only; no program is started', () => {
  const SRC = join(HERE, '..');
  const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const walk = (root: string): string[] =>
    readdirSync(root, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? (entry.name === '__tests__' || entry.name === 'node_modules' ? [] : walk(join(root, entry.name))) : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [join(root, entry.name)] : []));
  const production = walk(SRC).map((path) => ({ path: path.slice(SRC.length + 1), text: strip(readFileSync(path, 'utf8')) }));
  const client = production.find((file) => file.path === 'host-alias-socket.ts')?.text ?? '';
  const stream = ['n', 'et'].join('');

  it('the stream-socket module is imported by this one file of the server, for one function', () => {
    const importers = production.filter((file) => new RegExp(`['"](?:node:)?${stream}['"]`).test(file.text)).map((file) => file.path);
    expect(importers).toEqual(['host-alias-socket.ts']);
    expect([...client.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])).toEqual(['node:fs/promises', `node:${stream}`, 'node:path']);
    expect(client).toMatch(new RegExp(`^import \\{ createConnection \\} from 'node:${stream}';$`, 'm'));
    expect(client).toMatch(/^import \{ lstat \} from 'node:fs\/promises';$/m);
  });

  it('one connection call, made with the path and nothing else; nothing listens, nothing is resolved, no process is started', () => {
    expect(client.match(/\bcreateConnection\s*\([^)]*\)/g)).toEqual(['createConnection({ path: socketPath })']);
    const forbidden = new RegExp(
      [
        `\\b(?:${['spawn', 'exec', 'execFile', 'fork'].join('|')})\\s*\\(`,
        ['child', '_process'].join(''),
        `\\b(?:host|port|lookup|localAddress)\\s*:`,
        `\\.listen\\s*\\(`,
        `\\bprocess\\s*\\.`,
        `\\bconsole\\b`,
        `\\b(?:${['sudo', 'arping', 'ifconfig', 'systemctl'].join('|')})\\b`,
        `\\b(?:write|writeFile|appendFile|mkdir|rm|unlink|rename|chmod|chown|symlink)\\s*\\(`,
      ].join('|'),
      'g',
    );
    // The one write of the file is the request line on the connection.
    expect(client.match(forbidden)).toEqual(['write(']);
    expect(client).toMatch(/socket\.write\(requestLine, 'latin1'\);/);
  });

  it('the mechanism has one caller in the product, the seam, and there the trusted owner is root', () => {
    const callers = production.flatMap((file) => [...file.text.matchAll(/\bcreateLocalSocketTransport\s*\(([^)]*)\)/g)].map((match) => `${file.path}: ${match[1]}`));
    expect(callers).toEqual(['host-alias-socket.ts: options: LocalSocketOptions', 'host-alias-socket.ts: { socketPath: facts.socketPath, trustedOwnerUid: ROOT_UID }']);
    expect(client).toMatch(/^const ROOT_UID = 0;$/m);
    expect(client).toMatch(/^const HELPER_PLATFORM = 'linux';$/m);
    // Task 4 row 106b (request line `row 106`, (5); decision C74): the seam has ONE caller in the product, the composition
    // of production capture, which hands it the platform it was given and the configured socket and nothing else.
    expect(production.filter((file) => /\bhostAliasSocketTransportOf\s*\(/.test(file.text)).map((file) => file.path).sort()).toEqual(['capture-composition.ts', 'host-alias-socket.ts']);
    const composition = production.find((file) => file.path === 'capture-composition.ts')?.text ?? '';
    expect(composition.match(/\bhostAliasSocketTransportOf\s*\([^)]*\)/g)).toEqual(['hostAliasSocketTransportOf({ platform: input.platform, socketPath: app.config.captureAliasSocketPath })']);
  });
});
