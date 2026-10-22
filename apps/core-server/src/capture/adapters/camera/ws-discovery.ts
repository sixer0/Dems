/**
 * The WS-Discovery probe: the ONE datagram socket of the Core (blueprint row 131; capture spec
 * §A.6.1 DS-1 to DS-16, §G.1 rule G-R9; specs C-N13; decisions D75, D76, D80(1), D80(11), D82(a);
 * security review SEC35-27 to SEC35-30).
 *
 * This is the only file of the server that imports the datagram module, and it has one call site
 * that creates a socket. What a search does, and nothing else:
 *
 *   1. picks the eligible IPv4 interfaces (no socket, no process);
 *   2. opens ONE `udp4` socket on port 0 - bound to the interface's address when there is one
 *      interface, unbound to an address when there are several (at most four);
 *   3. sends two typed Probes (`tds:Device`, `dn:NetworkVideoTransmitter`) to the group
 *      239.255.255.250:3702 with TTL 1, once per interface, and the same two again 250 ms later;
 *   4. hands every datagram that arrives to the collector (`discovery-collector.ts`);
 *   5. closes the socket when the window ends, when the datagram cap is reached, on abort and on
 *      every error. Every way out goes through `finish`, which is the only place that closes.
 *
 * It joins no group, listens for no announcement, opens no TCP connection, asks no device
 * anything (D80(1)) and writes no log and no file: the result carries the candidates and COUNTS
 * (DS-12). The caller logs the counts.
 *
 * "THE SEARCH COULD NOT RUN" IS NOT "NOTHING FOUND" (DS-13). No eligible interface, a refused bind
 * and a first round in which no probe could be sent reject with `DiscoveryNotRunError`. A window
 * that ends with no answer resolves with an empty list.
 *
 * WHAT COMES FROM OUTSIDE. The capture folder draws no random number and names no global timer
 * (rule G-R8), so the message IDs and the timers are the caller's: `newMessageId` must return a
 * fresh random UUID per call, `timers` is the capture timer seam.
 *
 * THE LOOPBACK FIXTURE (DS-15). `loopbackFixture` replaces the group by a unicast target, which
 * must be exactly 127.0.0.1: the socket is then bound to 127.0.0.1 and no datagram can leave the
 * host. Only test support sets it (no file under `src/` does; no configuration key, no environment
 * variable). Without it the destination is the constant group below.
 *
 * THE TYPED ADDRESS (task 4 blueprint row 96, WP-12; amended ruling AM-3 of D80(10); rule G-R9 as
 * amended by decision text SR-2). A search may carry ONE more destination, `unicast`: the answer
 * of the destination rule (`capture/destination-rule.ts`, `AllowedDestination`) for an address the
 * technician typed. This file never sees the typed text: the member's type is the rule's own
 * answer, and only the rule's file makes one. For it the search sends ONE more datagram, from the
 * SAME socket and through the SAME send call: one Probe of the camera type with a message ID of
 * its own, to that address on the group's port, once, after the first round, with TTL 1. Nothing
 * else changes: no second socket, no group joined, no connection, no read of the device (D80(1)
 * stands - the candidate is built from the probe answer, by the same collector and its same rules
 * of where an answer may come from). The host must hold the source address the rule named on an
 * interface the search probes; when it does not, the search "could not run" and nothing is sent.
 * Under the loopback fixture the typed probe goes to the fixture's target too: no test datagram
 * can leave the host. A search without `unicast` is what it was, datagram for datagram.
 */
import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import type { AllowedDestination } from '../../destination-rule';
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { DiscoveryResult, DiscoverySearch } from '../types';
import {
  createDiscoveryCollector,
  selectInterfaces,
  type CollectedDiscovery,
  type DiscoveryCounts,
  type DiscoveryNetwork,
  type InterfaceTable,
  type OnvifCandidate,
  type ProbedInterface,
  type RegisteredLookup,
} from './discovery-collector';
import type { ProbeAnswerReading } from './probe-answer';

/** WS-Discovery 1.1 §3.1.1: the IPv4 group and port every Probe of the product goes to. */
export const WS_DISCOVERY_GROUP = Object.freeze({ address: '239.255.255.250', port: 3702 });
/** DS-7: each probe is sent twice, this far apart. */
export const WS_DISCOVERY_REPEAT_MS = 250;
/** DS-5: a probe does not leave the local segment. */
export const WS_DISCOVERY_TTL = 1;
/** The two device types a search asks for (DS-6). */
export const WS_DISCOVERY_PROBE_TYPES = Object.freeze(['tds:Device', 'dn:NetworkVideoTransmitter'] as const);
/** Row 96: the type of the ONE probe a typed address is asked with - the camera type. */
export const WS_DISCOVERY_TYPED_PROBE_TYPE = 'dn:NetworkVideoTransmitter';
const LOOPBACK = '127.0.0.1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why a search could not run. Fixed names; no address and no system text travels with them. */
export const DiscoveryNotRun = { NO_ELIGIBLE_INTERFACE: 'NO_ELIGIBLE_INTERFACE', SOCKET_ERROR: 'SOCKET_ERROR' } as const;
export type DiscoveryNotRun = (typeof DiscoveryNotRun)[keyof typeof DiscoveryNotRun];

const NOT_RUN_TEXT: Readonly<Record<DiscoveryNotRun, string>> = Object.freeze({
  NO_ELIGIBLE_INTERFACE: 'the search could not run: this host has no network interface a search can use',
  SOCKET_ERROR: 'the search could not run: the probe could not be sent',
});

export class DiscoveryNotRunError extends Error {
  readonly code: DiscoveryNotRun;
  /** How many probes the operating system took before the search stopped: 0 for both codes today. */
  readonly datagramsSent: number;
  constructor(code: DiscoveryNotRun, datagramsSent = 0) {
    super(NOT_RUN_TEXT[code]);
    this.name = 'DiscoveryNotRunError';
    this.code = code;
    this.datagramsSent = datagramsSent;
  }
}

export interface WsDiscoveryCounts extends DiscoveryCounts {
  /** Probes the operating system accepted for sending. */
  readonly datagramsSent: number;
  /** Probes it refused. */
  readonly sendErrors: number;
  /** Datagrams whose handling threw: caught, counted, dropped (SEC35-29 (1)). */
  readonly handlerErrors: number;
  /** Row 96: probes the operating system accepted for the typed address, 0 or 1. Present only in a search that carried one. */
  readonly typedProbesSent?: number;
}

/**
 * A search of this adapter (task 4 row 96). `unicast` is THE DESTINATION RULE'S ANSWER for an
 * address the technician typed: never the typed text, never a stored address, never a value this
 * file or its caller composed. Absent: the search as it always was.
 */
export interface WsDiscoverySearch extends DiscoverySearch {
  readonly unicast?: AllowedDestination;
}

/** The seam's result (`DiscoveryResult`) with this adapter's candidates and the counts of DS-12. */
export interface WsDiscoveryResult extends DiscoveryResult {
  readonly candidates: readonly OnvifCandidate[];
  readonly counts: WsDiscoveryCounts;
}

export interface WsDiscoveryOptions {
  /** The capture timer seam (DS-14). */
  readonly timers: CaptureTimers;
  /** A fresh random UUID per call (the platform's): the message ID is the only thing a responder must have seen (DS-8). */
  readonly newMessageId: () => string;
  /** The caller's read of its own registry, for the registered-first cap and `addressChanged`. Default: nothing is registered. */
  readonly registered?: RegisteredLookup;
  /** Default: the operating system's table. In the loopback fixture: one synthetic interface. */
  readonly interfaces?: () => InterfaceTable;
  /** TEST SUPPORT ONLY (DS-15): a unicast target on 127.0.0.1 in place of the group. */
  readonly loopbackFixture?: { readonly address: string; readonly port: number };
  /** TEST SUPPORT ONLY: the reader of one datagram, to prove that one that throws stops nothing (check `M4-SEC-DISC-1`). */
  readonly read?: (bytes: Buffer) => ProbeAnswerReading;
}

export interface WsDiscovery {
  search(search: WsDiscoverySearch): Promise<WsDiscoveryResult>;
}

/**
 * THE ONE SEND CALL of the Core's datagram socket (rule G-R9). `to` is the group constant, the
 * injected loopback target, or - since row 96 - the typed destination the rule answered.
 */
function transmit(open: Socket, probe: Buffer, to: { readonly address: string; readonly port: number }, sent: (error: Error | null) => void): void {
  open.send(probe, to.port, to.address, sent);
}

function probeXml(messageId: string, type: string): Buffer {
  return Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" ' +
      'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">' +
      '<s:Header><a:Action s:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>' +
      `<a:MessageID>${messageId}</a:MessageID>` +
      '<a:ReplyTo><a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address></a:ReplyTo>' +
      '<a:To s:mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To></s:Header>' +
      `<s:Body><d:Probe><d:Types>${type}</d:Types></d:Probe></s:Body></s:Envelope>`,
    'utf8',
  );
}

const SYNTHETIC_INTERFACE: InterfaceTable = Object.freeze({ fixture: Object.freeze([Object.freeze({ address: '192.0.2.1', netmask: '255.255.255.0', family: 'IPv4', mac: '02:00:00:00:00:01', internal: false })]) });

export function createWsDiscovery(options: WsDiscoveryOptions): WsDiscovery {
  const fixture = options.loopbackFixture ?? null;
  // The only unicast destination this file ever takes is the loopback literal (rule G-R9).
  if (fixture !== null && (fixture.address !== LOOPBACK || !Number.isInteger(fixture.port) || fixture.port < 1 || fixture.port > 65_535)) {
    throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID);
  }
  const destination = fixture ?? WS_DISCOVERY_GROUP;
  const readInterfaces = options.interfaces ?? (fixture === null ? (): InterfaceTable => networkInterfaces() as InterfaceTable : (): InterfaceTable => SYNTHETIC_INTERFACE);

  return {
    search(search) {
      return new Promise<WsDiscoveryResult>((resolveSearch, rejectSearch) => {
        if (search.signal.aborted) {
          rejectSearch(new CaptureAdapterError(CaptureAdapterRefusal.ABORTED));
          return;
        }
        // Row 96: the rule's answer for a typed address, or none. The host must hold the source the rule named on a probed interface.
        const unicast = search.unicast ?? null;
        // R-FLEX 5.2: the typed probe's source interface is probed FIRST, the bound stays four.
        const selection = selectInterfaces(readInterfaces(), unicast?.sourceAddress);
        const interfaces: readonly ProbedInterface[] = selection.probed;
        const sourceHeld = unicast === null || fixture !== null || interfaces.some((probed) => probed.address === unicast.sourceAddress);
        if (interfaces.length === 0 || !sourceHeld) {
          rejectSearch(new DiscoveryNotRunError(DiscoveryNotRun.NO_ELIGIBLE_INTERFACE));
          return;
        }
        /** Where the typed probe goes: the rule's address on the group's port; under the fixture, the fixture's target. */
        const typed = unicast === null ? null : (fixture ?? { address: unicast.address, port: WS_DISCOVERY_GROUP.port });
        const messageIds = WS_DISCOVERY_PROBE_TYPES.map(() => options.newMessageId());
        const typedId = typed === null ? null : options.newMessageId();
        const askedIds = typedId === null ? messageIds : [...messageIds, typedId];
        if (askedIds.some((id) => !UUID.test(id)) || new Set(askedIds).size !== askedIds.length) {
          rejectSearch(new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_INVALID));
          return;
        }
        const urns = messageIds.map((id) => `urn:uuid:${id}`);
        const probes = WS_DISCOVERY_PROBE_TYPES.map((type, index) => probeXml(urns[index] ?? '', type));
        const typedUrn = typedId === null ? null : `urn:uuid:${typedId}`;
        const typedProbe = typedUrn === null ? null : probeXml(typedUrn, WS_DISCOVERY_TYPED_PROBE_TYPE);
        const network: DiscoveryNetwork = fixture === null ? { kind: 'LAN', probed: interfaces, ownAddresses: selection.ownAddresses } : { kind: 'LOOPBACK_FIXTURE', address: fixture.address };
        const collector = createDiscoveryCollector({ messageIds: typedUrn === null ? urns : [...urns, typedUrn], network, registered: options.registered, read: options.read });

        let socket: Socket | null = null;
        let finished = false;
        let datagramsSent = 0;
        let sendErrors = 0;
        let handlerErrors = 0;
        let typedProbesSent = 0;
        const interfacesReached = new Set<number>();
        const cancels: (() => void)[] = [];

        /** The one way out: timers off, the abort listener off, the socket closed, THEN the promise settles. */
        const finish = (settle: () => void): void => {
          if (finished) return;
          finished = true;
          for (const cancel of cancels.splice(0)) cancel();
          search.signal.removeEventListener('abort', onAbort);
          const open = socket;
          socket = null;
          if (open === null) {
            settle();
            return;
          }
          open.removeAllListeners('message');
          try {
            open.close(() => settle());
          } catch {
            settle(); // closed by the operating system already
          }
        };
        const result = (): WsDiscoveryResult => {
          const collected: CollectedDiscovery = collector.result();
          return Object.freeze({
            candidates: collected.candidates,
            responderCount: collected.responderCount,
            interfaceCount: interfacesReached.size,
            truncated: collected.truncated,
            counts: Object.freeze({ ...collected.counts, datagramsSent, sendErrors, handlerErrors, ...(typed === null ? {} : { typedProbesSent }) }),
          });
        };
        const done = (): void => finish(() => resolveSearch(result()));
        const notRun = (): void => finish(() => rejectSearch(new DiscoveryNotRunError(DiscoveryNotRun.SOCKET_ERROR, datagramsSent)));
        function onAbort(): void {
          finish(() => rejectSearch(new CaptureAdapterError(CaptureAdapterRefusal.ABORTED)));
        }
        /** A boundary of our own code: whatever it throws ends the search as "could not run", never the process. */
        const guarded = (step: () => void) => (): void => {
          try {
            step();
          } catch {
            notRun();
          }
        };

        /** One round: both probes on each interface, one interface after the other (the outgoing interface is a socket option). */
        const sendRound = (afterRound: () => void): void => {
          const sendOn = (index: number): void => {
            const open = socket;
            if (finished || open === null) return;
            const probed = interfaces[index];
            if (probed === undefined) {
              afterRound();
              return;
            }
            let pending = probes.length;
            const sent = (error: Error | null): void => {
              if (error === null) {
                datagramsSent += 1;
                interfacesReached.add(index);
              } else sendErrors += 1;
              pending -= 1;
              if (pending === 0) guarded(() => sendOn(index + 1))();
            };
            try {
              if (fixture === null) open.setMulticastInterface(probed.address);
              for (const probe of probes) transmit(open, probe, destination, sent);
            } catch {
              // This interface refused the option or the send: it is counted, the next one is tried.
              sendErrors += pending;
              pending = 0;
              guarded(() => sendOn(index + 1))();
            }
          };
          sendOn(0);
        };

        /** Row 96: ONE probe to the typed destination, once. A refused send is counted; the search goes on. */
        const sendTyped = (): void => {
          const open = socket;
          if (finished || open === null || typed === null || typedProbe === null) return;
          const typedSent = (error: Error | null): void => {
            if (error === null) typedProbesSent += 1;
            else sendErrors += 1;
          };
          try {
            transmit(open, typedProbe, typed, typedSent);
          } catch {
            sendErrors += 1;
          }
        };

        const onDatagram = (bytes: Buffer, remote: RemoteInfo): void => {
          // SEC35-29 (1): the whole handler is this one try / catch. It counts and drops.
          try {
            if (finished) return;
            if (!collector.accept(bytes, remote)) done();
          } catch {
            handlerErrors += 1;
          }
        };

        try {
          search.signal.addEventListener('abort', onAbort, { once: true });
          const open = createSocket({ type: 'udp4' });
          socket = open;
          // A socket error ends the search. Before any probe left it could not run; after, what was collected stands.
          open.on('error', () => (datagramsSent === 0 ? notRun() : done()));
          open.on('message', onDatagram);
          const only = interfaces.length === 1 ? interfaces[0] : undefined;
          const bound = fixture !== null ? { address: LOOPBACK, port: 0 } : only !== undefined ? { address: only.address, port: 0 } : { port: 0 };
          open.bind(
            bound,
            guarded(() => {
              if (finished) return;
              if (fixture === null) {
                open.setMulticastTTL(WS_DISCOVERY_TTL);
                open.setMulticastLoopback(false);
              }
              // Row 96: the typed probe does not leave the local segment either.
              if (typed !== null) open.setTTL(WS_DISCOVERY_TTL);
              // DS-7: the window runs from the first datagram.
              cancels.push(options.timers.after(search.windowMs, guarded(done)));
              sendRound(() => {
                // DS-13: a first round in which nothing could be sent is "could not run", at once.
                if (datagramsSent === 0) notRun();
                else {
                  sendTyped();
                  cancels.push(options.timers.after(WS_DISCOVERY_REPEAT_MS, guarded(() => sendRound(() => undefined))));
                }
              });
            }),
          );
        } catch {
          notRun();
        }
      });
    },
  };
}
