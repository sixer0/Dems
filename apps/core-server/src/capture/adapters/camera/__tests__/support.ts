/**
 * Test support of the discovery adapter (blueprint row 131; not a test file, nothing here imports
 * Vitest; no production source imports it).
 *
 *   loopback guard      check `M4-DISC-NOLAN-1`: while it is installed, every datagram and every TCP
 *                       connection of THIS process is recorded by destination, and one whose
 *                       destination is not 127.0.0.1 is REFUSED before it is handed to the
 *                       operating system. The discovery tests install it for the whole file;
 *   fixture datagrams   ProbeMatches messages a test shapes itself, for the cases the stub of row
 *                       60 cannot produce (a second source address, a registered device, hostile
 *                       trees). Addresses in them are documentation addresses (RFC 5737);
 *   socket snapshot     check `M4-DISC-SOCK-1`: the datagram sockets of a process, counted by the
 *                       operating system (`lsof`), not by the code under test.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import net from 'node:net';
import { createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import type { InterfaceTable } from '../discovery-collector';

export const LOOPBACK = '127.0.0.1';

// ── The loopback guard ────────────────────────────────────────────────────────────────────────

export interface LoopbackGuard {
  /** Destination addresses of every datagram that was handed on, in order. */
  datagrams(): readonly string[];
  /** Destination hosts of every TCP connection that was handed on. */
  connections(): readonly string[];
  /** Destinations that were refused: anything but 127.0.0.1. */
  refused(): readonly string[];
  /** The local ports of the sockets that sent a datagram, as the operating system names them. */
  senderPorts(): readonly number[];
  reset(): void;
  restore(): void;
}

export class LoopbackGuardError extends Error {
  readonly code = 'TEST_NETWORK_REFUSED';
  constructor() {
    super('test-support guard: a destination that is not 127.0.0.1 was refused before anything was sent');
    this.name = 'LoopbackGuardError';
  }
}

export function installLoopbackGuard(): LoopbackGuard {
  let datagrams: string[] = [];
  let connections: string[] = [];
  let refused: string[] = [];
  const senders = new Set<dgram.Socket>();
  const originalSend = dgram.Socket.prototype.send;
  const originalConnect = net.Socket.prototype.connect;

  dgram.Socket.prototype.send = function guardedSend(this: dgram.Socket, ...args: unknown[]): void {
    // send(msg, [offset, length,] port, address, callback): the address is the string after the message.
    const address = args.slice(1).find((arg): arg is string => typeof arg === 'string') ?? LOOPBACK;
    if (address !== LOOPBACK) {
      refused.push(address);
      throw new LoopbackGuardError();
    }
    datagrams.push(address);
    senders.add(this);
    (originalSend as (...all: unknown[]) => void).apply(this, args);
  } as typeof dgram.Socket.prototype.send;

  net.Socket.prototype.connect = function guardedConnect(this: net.Socket, ...args: unknown[]): net.Socket {
    // `net.createConnection`, and with it every HTTP client (the pinned ONVIF client of `onvif-session.ts`
    // included), hands `connect` ONE array: its normalised argument list `[options, callback]`. The
    // destination is read from inside it (integration pass C2); before, such a call was taken for a
    // connection to `localhost` and refused, also when it went to 127.0.0.1. Nothing else is widened:
    // the host must still be the literal 127.0.0.1 - a name (`localhost` too), another address, or no
    // host at all is refused before anything is sent.
    const normalised = Array.isArray(args[0]);
    const first: unknown = normalised ? (args[0] as unknown[])[0] : args[0];
    const host =
      first !== null && typeof first === 'object' && !Array.isArray(first)
        ? ((first as { host?: unknown; path?: unknown }).host ?? ((first as { path?: unknown }).path === undefined ? 'localhost' : 'pipe'))
        : !normalised && typeof args[1] === 'string'
          ? args[1]
          : typeof first === 'string'
            ? 'pipe'
            : 'localhost';
    if (host !== 'pipe') {
      if (host !== LOOPBACK) {
        refused.push(String(host));
        throw new LoopbackGuardError();
      }
      connections.push(host);
    }
    return (originalConnect as (...all: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;

  return {
    datagrams: () => datagrams,
    connections: () => connections,
    refused: () => refused,
    senderPorts() {
      const ports: number[] = [];
      for (const sender of senders) {
        try {
          ports.push(sender.address().port);
        } catch {
          // closed already
        }
      }
      return ports;
    },
    reset() {
      datagrams = [];
      connections = [];
      refused = [];
      senders.clear();
    },
    restore() {
      dgram.Socket.prototype.send = originalSend;
      net.Socket.prototype.connect = originalConnect;
    },
  };
}

// ── The fake ONVIF stub of row 60 ──────────────────────────────────────────────────────────────

/**
 * Starts the stub on free fixture ports of 127.0.0.1. Two test files may ask for ports at the same
 * moment (two workers): a start that loses that race is tried again with fresh ports.
 */
export async function startFakeOnvif(devices: number): Promise<FakeOnvifStub> {
  let last: unknown = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      // The fixture account is made here, per start, and used by nothing: a search never authenticates.
      const stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: { username: `fixture-${randomUUID()}`, secret: randomUUID() }, devices });
      await stub.start();
      return stub;
    } catch (error) {
      last = error;
      await delay(25 * (attempt + 1));
    }
  }
  throw last;
}

// ── Fixture datagrams ─────────────────────────────────────────────────────────────────────────

export const PROBE_MATCHES_ACTION = 'http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches';

export interface FixtureMatch {
  readonly endpointRef?: string;
  readonly types?: string;
  readonly scopes?: readonly string[];
  /** Null: no XAddrs element. */
  readonly xaddrs?: string | null;
  /** Raw XML placed inside the ProbeMatch. */
  readonly extra?: string;
}

export const uuidUrn = (): string => `urn:uuid:${randomUUID()}`;

export function scopesOf(name: string, hardware: string, more: readonly string[] = []): string[] {
  return ['onvif://www.onvif.org/Profile/Streaming', `onvif://www.onvif.org/hardware/${encodeURIComponent(hardware)}`, `onvif://www.onvif.org/name/${encodeURIComponent(name)}`, ...more];
}

export function matchXml(match: FixtureMatch, host: string): string {
  const xaddrs = match.xaddrs === undefined ? `http://${host}/onvif/device_service` : match.xaddrs;
  return (
    `<d:ProbeMatch><a:EndpointReference><a:Address>${match.endpointRef ?? uuidUrn()}</a:Address></a:EndpointReference>` +
    `<d:Types>${match.types ?? 'dn:NetworkVideoTransmitter tds:Device'}</d:Types><d:Scopes>${(match.scopes ?? scopesOf('Fixture Camera', 'FIXTURE-1')).join(' ')}</d:Scopes>` +
    (xaddrs === null ? '' : `<d:XAddrs>${xaddrs}</d:XAddrs>`) +
    `${match.extra ?? ''}<d:MetadataVersion>1</d:MetadataVersion></d:ProbeMatch>`
  );
}

export interface FixtureAnswer {
  readonly relatesTo: string;
  readonly action?: string;
  /** The inside of `ProbeMatches`. */
  readonly matches?: string;
  readonly beforeEnvelope?: string;
  readonly headerExtra?: string;
  readonly bodyExtra?: string;
}

export function answerXml(answer: FixtureAnswer): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>${answer.beforeEnvelope ?? ''}` +
    `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" ` +
    `xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">` +
    `<s:Header><a:MessageID>${uuidUrn()}</a:MessageID><a:RelatesTo>${answer.relatesTo}</a:RelatesTo>` +
    `<a:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:To><a:Action>${answer.action ?? PROBE_MATCHES_ACTION}</a:Action>${answer.headerExtra ?? ''}</s:Header>` +
    `<s:Body><d:ProbeMatches>${answer.matches ?? ''}</d:ProbeMatches>${answer.bodyExtra ?? ''}</s:Body></s:Envelope>`
  );
}

/** One answer of one device at `host`, as bytes. */
export const answerFrom = (relatesTo: string, host: string, match: FixtureMatch = {}): Buffer => Buffer.from(answerXml({ relatesTo, matches: matchXml(match, host) }), 'utf8');

// ── Interfaces ────────────────────────────────────────────────────────────────────────────────

/** Documentation networks (RFC 5737): never a real segment. */
export const LAN_A = { address: '192.0.2.10', netmask: '255.255.255.0' } as const;
export const LAN_B = { address: '198.51.100.10', netmask: '255.255.255.0' } as const;

export function interfaceTable(...lans: readonly { readonly address: string; readonly netmask: string }[]): InterfaceTable {
  const table: Record<string, InterfaceTable[string]> = {
    lo0: [{ address: LOOPBACK, netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true }],
  };
  lans.forEach((lan, index) => {
    table[`en${index}`] = [{ ...lan, family: 'IPv4', mac: `02:00:00:00:00:0${index + 1}`, internal: false }];
  });
  return table;
}

// ── Socket snapshot ───────────────────────────────────────────────────────────────────────────

/** How many datagram sockets the operating system lists for a process (`lsof -nP -a -p <pid> -iUDP`). */
export function datagramSockets(pid: number = process.pid): number {
  try {
    const out = execFileSync('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-iUDP'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter((line) => /\bUDP\b/.test(line)).length;
  } catch (error) {
    // lsof ends with status 1 and no output when the process has none.
    if ((error as { status?: number }).status === 1) return 0;
    throw error;
  }
}

export const delay = (ms: number): Promise<void> => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** Waits until `condition` holds; fails after `timeoutMs` so that a test never hangs. */
export async function until(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('test support: the awaited condition did not come true');
    await delay(5);
  }
}
