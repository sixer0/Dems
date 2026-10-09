/**
 * Check `M4-DISC-LAN-1`: ONE search on the network this Mac is on, by hand (blueprint row 131;
 * capture spec §A.6.1 DS-12, DS-13, §J H-7a, H-13; specs R-9 AC-15, AC-16; decisions D75, D76,
 * D86 C-7). Not a test file and not part of the automated suite: that suite never leaves loopback.
 *
 *   npx tsx apps/core-server/src/capture/adapters/camera/__tests__/lan-probe.ts <run-label>
 *
 * Run it OUTSIDE the command sandbox. It does, in this order:
 *   1. the negative control, on the fake ONVIF stub (loopback): the same harness must report 2 on
 *      a stub set to 2 and 0 on a stub set to 0;
 *   2. one search with the PRODUCT adapter (no loopback fixture): the two probes to the group,
 *      TTL 1, a 3,000 ms window. Probes only: no TCP connection, no authentication, no
 *      configuration call exists in this adapter, and the harness counts TCP connections anyway;
 *   3. socket snapshots before / during / after (0 / 1 / 0), and the output-packet counters of
 *      the probed interfaces before and after.
 *
 * WHAT IT PRINTS: one line on standard output, of counts only, ending in exactly one of
 * `FOUND (N)`, `EMPTY`, `NOT RUN (reason)`. No address, hardware address, serial number, name or
 * endpoint reference is ever printed (D86 C-7). The identifying result goes to ONE file under the
 * git-ignored `.data/discovery/` and nowhere else.
 *
 * "NOT RUN" is decided by whether a probe left the interface: no eligible interface, a refused
 * send, or an interface output counter that did not rise by the number of probes the operating
 * system accepted (H-13: a local-network privacy control can accept a send and drop it).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSystemTimers } from '../../../timers';
import { selectInterfaces, type InterfaceTable } from '../discovery-collector';
import { createOnvifDiscoveryAdapter } from '../onvif-discovery';
import { DiscoveryNotRunError, WS_DISCOVERY_GROUP, type WsDiscoveryResult } from '../ws-discovery';
import { LOOPBACK, datagramSockets, delay, startFakeOnvif } from './support';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', '..');
const OUT_DIR = resolve(REPOSITORY, '.data', 'discovery');
/** The search window of the contract (`CAPTURE_DISCOVERY_WINDOW_MS`, C3 §7; row 132 lands the constant). */
const WINDOW_MS = 3_000;
const signal = (): AbortSignal => new AbortController().signal;

if (process.env.VITEST !== undefined) throw new Error('lan-probe.ts is run by hand, never by the test runner');

/** Destinations of every datagram and every TCP connection of this process: recorded, not refused. */
const datagramDestinations: string[] = [];
const tcpDestinations: string[] = [];
const originalSend = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function recordingSend(this: dgram.Socket, ...args: unknown[]): void {
  datagramDestinations.push(args.slice(1).find((arg): arg is string => typeof arg === 'string') ?? LOOPBACK);
  (originalSend as (...all: unknown[]) => void).apply(this, args);
} as typeof dgram.Socket.prototype.send;
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function recordingConnect(this: net.Socket, ...args: unknown[]): net.Socket {
  const first = args[0];
  const host = first !== null && typeof first === 'object' ? String((first as { host?: unknown }).host ?? 'unknown') : typeof args[1] === 'string' ? args[1] : 'unknown';
  tcpDestinations.push(host);
  return (originalConnect as (...all: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;

/** The output-packet counter of an interface, by its name (`netstat -I <name> -b`); null when it cannot be read. */
function outputPackets(name: string): number | null {
  try {
    const lines = execFileSync('/usr/sbin/netstat', ['-n', '-b', '-I', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
    const row = lines[1]?.trim().split(/\s+/);
    // The columns end in `Opkts Oerrs Obytes Coll`: counted from the end, since the address column can be empty.
    const value = Number(row?.[row.length - 4]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** The names of the interfaces a search probes: the same selection the adapter makes, kept inside this process. */
function probedInterfaceNames(): string[] {
  const table = networkInterfaces() as InterfaceTable;
  const probed = selectInterfaces(table).probed.map((entry) => entry.address);
  return Object.keys(table).filter((name) => (table[name] ?? []).some((entry) => probed.includes(entry.address)));
}

async function controlCount(devices: number): Promise<number> {
  const stub = await startFakeOnvif(devices);
  try {
    const adapter = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, loopbackFixture: stub.addresses().discovery });
    return (await adapter.discover({ windowMs: 400, signal: signal() })).responderCount;
  } finally {
    await stub.stop();
  }
}

async function main(): Promise<void> {
  const label = (process.argv[2] ?? 'run').replace(/[^A-Za-z0-9_-]/g, '');
  const facts: string[] = [`M4-DISC-LAN-1 ${label}`];
  const finish = (outcome: string, code = 0): void => {
    process.stdout.write(`${[...facts, outcome].join(' | ')}\n`);
    process.exitCode = code;
  };

  // 1. The negative control: the harness can tell 2 from 0.
  const two = await controlCount(2);
  const zero = await controlCount(0);
  facts.push(`control stub(2)=${two} stub(0)=${zero}`);
  if (two !== 2 || zero !== 0) return finish('NOT RUN (the control on the stub failed)', 1);
  if (datagramDestinations.some((destination) => destination !== LOOPBACK)) return finish('NOT RUN (the control left loopback)', 1);
  const controlDatagrams = datagramDestinations.length;

  // 2. The one search on the real network.
  const names = probedInterfaceNames();
  const countersBefore = names.map(outputPackets);
  const socketsBefore = datagramSockets();
  const adapter = createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID });
  let socketsDuring = -1;
  let tcpDuring = -1;
  const pending = adapter.discover({ windowMs: WINDOW_MS, signal: signal() }).then(
    (result) => ({ result, error: null as unknown }),
    (error: unknown) => ({ result: null as WsDiscoveryResult | null, error }),
  );
  await delay(1_000);
  socketsDuring = datagramSockets();
  try {
    tcpDuring = execFileSync('/usr/sbin/lsof', ['-nP', '-a', '-p', String(process.pid), '-iTCP'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter((line) => /\bTCP\b/.test(line)).length;
  } catch {
    tcpDuring = 0; // lsof ends with status 1 when the process has no TCP socket
  }
  const { result, error } = await pending;
  const socketsAfter = datagramSockets();
  const countersAfter = names.map(outputPackets);
  const searchDatagrams = datagramDestinations.slice(controlDatagrams);
  const onlyTheGroup = searchDatagrams.every((destination) => destination === WS_DISCOVERY_GROUP.address);

  facts.push(`interfaces eligible=${names.length}`);
  facts.push(`sockets before/during/after=${socketsBefore}/${socketsDuring}/${socketsAfter}`);
  facts.push(`tcp connections=${tcpDestinations.length} tcp sockets during=${tcpDuring}`);
  facts.push(`destinations other than the group=${onlyTheGroup ? 0 : searchDatagrams.filter((destination) => destination !== WS_DISCOVERY_GROUP.address).length}`);

  if (error !== null) {
    if (error instanceof DiscoveryNotRunError) {
      facts.push(`probes accepted=${error.datagramsSent}`);
      return finish(`NOT RUN (${error.code === 'NO_ELIGIBLE_INTERFACE' ? 'no eligible interface: this Mac is on no network it can search' : 'the probe could not be sent'})`);
    }
    facts.push(`error=${error instanceof Error ? error.name : 'unknown'}`);
    return finish('NOT RUN (the harness failed)', 1);
  }
  if (result === null) return finish('NOT RUN (the harness failed)', 1);

  // 3. Did the probes leave? The counters of the probed interfaces must have risen by at least what was accepted.
  const rises = countersAfter.map((after, index) => (after === null || countersBefore[index] === null || countersBefore[index] === undefined ? null : after - countersBefore[index]));
  const risen = rises.reduce<number>((sum, rise) => sum + (rise ?? 0), 0);
  const readable = rises.every((rise) => rise !== null);
  facts.push(`interfaces probed=${result.interfaceCount} probes accepted=${result.counts.datagramsSent} send errors=${result.counts.sendErrors}`);
  facts.push(`interface output packets rose by>=accepted: ${readable ? String(risen >= result.counts.datagramsSent) : 'counter unreadable'}`);
  facts.push(`datagrams received=${result.counts.datagramsReceived} accepted=${result.counts.datagramsAccepted} dropped=${Object.values(result.counts.dropped).reduce((sum, count) => sum + (count ?? 0), 0)} handler errors=${result.counts.handlerErrors}`);

  // The identifying result: one git-ignored file, never the terminal.
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUT_DIR, `row131-${label}.json`),
    `${JSON.stringify({ check: 'M4-DISC-LAN-1', label, interfaceNames: names, counterRises: rises, result }, null, 2)}\n`,
    { mode: 0o600 },
  );

  if (socketsBefore !== 0 || socketsDuring !== 1 || socketsAfter !== 0 || tcpDestinations.length !== 0 || tcpDuring !== 0 || !onlyTheGroup) return finish('NOT RUN (a socket rule of the check was broken: see the counts)', 1);
  if (result.counts.datagramsSent === 0) return finish('NOT RUN (the probe could not be sent)');
  if (!readable) return finish('NOT RUN (the interface output counter could not be read)');
  if (risen < result.counts.datagramsSent) return finish('NOT RUN (the interface output counter did not rise by the number of probes sent)');

  const candidates = result.candidates;
  facts.push(`responders=${result.responderCount} listed=${candidates.length} testable=${candidates.filter((candidate) => candidate.testable).length} conflict=${candidates.filter((candidate) => candidate.conflict).length} truncated=${result.truncated}`);
  // Model class, as a count of kinds only: how many distinct hardware hints and device types were announced.
  facts.push(`distinct hardware hints=${new Set(candidates.map((candidate) => candidate.model ?? '')).size - (candidates.some((candidate) => candidate.model === null) ? 1 : 0)} with a name hint=${candidates.filter((candidate) => candidate.name !== null).length}`);
  return finish(result.responderCount === 0 ? 'EMPTY' : `FOUND (${result.responderCount})`);
}

void main().catch(() => {
  process.stdout.write('M4-DISC-LAN-1 | NOT RUN (the harness failed)\n');
  process.exitCode = 1;
});
