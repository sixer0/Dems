/**
 * What a search keeps of the answers it receives (blueprint row 131; capture spec §A.6.1 DS-4,
 * DS-8, DS-9, DS-10, DS-16 and "Failure modes"; security review SEC35-28, SEC35-30).
 *
 * Pure: no socket, no timer, no log, no file. `ws-discovery.ts` hands it each datagram with the
 * address the KERNEL reported for it; this file decides whether the datagram counts and what the
 * candidate list is when the window ends. Nothing here is taken on trust from a message:
 *
 *   - the source must be an IPv4 address on the segment of a probed interface, and never an
 *     address of this host, the network or broadcast address of that interface, or a multicast
 *     or unspecified address (SEC35-28 (2));
 *   - `RelatesTo` must be one of this search's two message IDs (DS-8);
 *   - a responder is the pair (source address, endpoint reference). The same pair again is a
 *     repeat: counted, not listed (each device answers up to four probes). One endpoint reference
 *     from two addresses, or two endpoint references from one address, are ALL listed, marked
 *     `conflict` and not testable: a later answer never replaces an earlier one (SEC35-28 (1));
 *   - the list holds at most 64 responders: those already registered first, then by arrival, and
 *     the result says `truncated` (SEC35-28 (4));
 *   - a service address is kept only when its host is the datagram source (DS-9).
 *
 * The counts it returns are numbers and reason names only (DS-12).
 */
import { CaptureAdapterKind } from '../kinds';
import type { CameraCandidate } from '../types';
import { HINT_LIST_MAX_ENTRIES, ProbeAnswerDrop, ipv4ToNumber, readProbeAnswer, serviceAddressFor, type ProbeAnswerReading, type ProbeMatchData, type ServiceAddressReason } from './probe-answer';

/** DS-8: datagrams processed per search; at the cap the socket is closed at once. */
export const DISCOVERY_MAX_DATAGRAMS = 256;
/** DS-8: responders listed per search. */
export const DISCOVERY_MAX_RESPONDERS = 64;
/** DS-4: interfaces probed per search. */
export const DISCOVERY_MAX_INTERFACES = 4;
/** DS-16: a stored candidate is at most this many bytes of text. */
export const CANDIDATE_MAX_BYTES = 2 * 1024;

/** An IPv4 interface a search probes: what `os.networkInterfaces()` says of it, nothing else. */
export interface ProbedInterface {
  readonly address: string;
  readonly netmask: string;
}

/** The shape of one entry of `os.networkInterfaces()` that the selection reads. */
export interface InterfaceEntry {
  readonly address: string;
  readonly netmask: string;
  readonly family: string | number;
  readonly mac: string;
  readonly internal: boolean;
}
export type InterfaceTable = Readonly<Record<string, readonly InterfaceEntry[] | undefined>>;

export interface InterfaceSelection {
  /** The interfaces a search probes: at most four (DS-4). */
  readonly probed: readonly ProbedInterface[];
  /** Every IPv4 address of this host, eligible or not: an answer "from" one of them is forged. */
  readonly ownAddresses: readonly string[];
}

/**
 * DS-4, by property and never by name: IPv4, not internal, a netmask other than a host mask, a
 * hardware address that is not all zero (tunnels have none). Link-local addresses are eligible.
 *
 * R-FLEX (network spec 5.2, NW-K1): the bound stays `DISCOVERY_MAX_INTERFACES`. When the search
 * carries a typed probe, `sourceAddress` (the destination rule's) is the eligible interface placed
 * FIRST, then the others in table order up to the bound - so a typed address on a fifth interface
 * is never refused for ordering alone. Absent, or held by no eligible interface: table order.
 */
export function selectInterfaces(table: InterfaceTable, sourceAddress?: string): InterfaceSelection {
  const eligible: ProbedInterface[] = [];
  const ownAddresses: string[] = [];
  for (const name of Object.keys(table)) {
    for (const entry of table[name] ?? []) {
      if (entry.family !== 'IPv4' && entry.family !== 4) continue;
      const address = ipv4ToNumber(entry.address);
      const mask = ipv4ToNumber(entry.netmask);
      if (address === null) continue;
      if (!ownAddresses.includes(entry.address)) ownAddresses.push(entry.address);
      if (entry.internal || mask === null || mask === 0xffffffff || mask === 0) continue;
      if (!/[1-9a-f]/i.test(entry.mac)) continue;
      if (eligible.some((known) => known.address === entry.address)) continue;
      eligible.push(Object.freeze({ address: entry.address, netmask: entry.netmask }));
    }
  }
  const source = eligible.findIndex((known) => known.address === sourceAddress);
  const ordered = source <= 0 ? eligible : [eligible[source] as ProbedInterface, ...eligible.slice(0, source), ...eligible.slice(source + 1)];
  return { probed: Object.freeze(ordered.slice(0, DISCOVERY_MAX_INTERFACES)), ownAddresses: Object.freeze(ownAddresses) };
}

/** Where the answers of a search may come from. */
export type DiscoveryNetwork =
  | { readonly kind: 'LAN'; readonly probed: readonly ProbedInterface[]; readonly ownAddresses: readonly string[] }
  /** The injected loopback fixture (DS-15): the one stub address is the whole network, and what it yields is `FAKE`. */
  | { readonly kind: 'LOOPBACK_FIXTURE'; readonly address: string };

export const DiscoveryDrop = {
  ...ProbeAnswerDrop,
  SOURCE_NOT_IPV4: 'SOURCE_NOT_IPV4',
  SOURCE_RESERVED: 'SOURCE_RESERVED',
  SOURCE_OWN_ADDRESS: 'SOURCE_OWN_ADDRESS',
  SOURCE_OFF_LINK: 'SOURCE_OFF_LINK',
  RELATES_TO_MISMATCH: 'RELATES_TO_MISMATCH',
  OVER_DATAGRAM_CAP: 'OVER_DATAGRAM_CAP',
} as const;
export type DiscoveryDrop = (typeof DiscoveryDrop)[keyof typeof DiscoveryDrop];

/** Why a datagram source is refused, or null when it may answer. The kernel's address, never the message's. */
export function sourceRefusal(address: string, family: string, network: DiscoveryNetwork): DiscoveryDrop | null {
  const source = family === 'IPv4' ? ipv4ToNumber(address) : null;
  if (source === null) return DiscoveryDrop.SOURCE_NOT_IPV4;
  if (network.kind === 'LOOPBACK_FIXTURE') return address === network.address ? null : DiscoveryDrop.SOURCE_OFF_LINK;
  const firstOctet = Math.floor(source / 0x1000000);
  if (source === 0 || source === 0xffffffff || firstOctet === 0 || firstOctet === 127 || firstOctet >= 224) return DiscoveryDrop.SOURCE_RESERVED;
  if (network.ownAddresses.includes(address)) return DiscoveryDrop.SOURCE_OWN_ADDRESS;
  let onLink = false;
  for (const probed of network.probed) {
    const local = ipv4ToNumber(probed.address);
    const mask = ipv4ToNumber(probed.netmask);
    if (local === null || mask === null) continue;
    // Unsigned arithmetic: `>>> 0` keeps the 32-bit values positive.
    const segment: number = (local & mask) >>> 0;
    if (((source & mask) >>> 0) !== segment) continue;
    const broadcast: number = (segment | (~mask >>> 0)) >>> 0;
    if (source === segment || source === broadcast) return DiscoveryDrop.SOURCE_RESERVED;
    onLink = true;
  }
  return onLink ? null : DiscoveryDrop.SOURCE_OFF_LINK;
}

/** What the caller knows of a registered camera that an answer matches (`dbc-4` §N.5: the endpoint reference, else the whole address). */
export interface RegisteredMatch {
  /** The address stored for that camera, or null when none is stored. */
  readonly storedHost: string | null;
  /** True when the match is by endpoint reference: only then can the address have changed. */
  readonly byEndpointRef: boolean;
}
/** Asked once per new responder. It is the caller's read of its own registry; it gets no other data of the answer. */
export type RegisteredLookup = (responder: { readonly endpointRef: string; readonly host: string }) => RegisteredMatch | null;

/** A candidate as this adapter builds it: the seam's members (`CameraCandidate`) and what DS-10 adds. Not a device (rule RG-4). */
export interface OnvifCandidate extends CameraCandidate {
  readonly endpointRef: string;
  /** Why there is no service address, or null when there is one. */
  readonly reason: ServiceAddressReason | null;
  /** Already registered, by the caller's lookup. */
  readonly registered: boolean;
  /** Registered by endpoint reference, and answering from another address than the stored one (SEC35-28 (6)). */
  readonly addressChanged: boolean;
  readonly types: readonly string[];
  readonly profileHints: readonly string[];
  readonly locationHints: readonly string[];
  readonly macHint: string | null;
  readonly serialHint: string | null;
}

export interface DiscoveryCounts {
  /** Datagrams the socket delivered, the ones over the cap included. */
  readonly datagramsReceived: number;
  /** Datagrams that passed every rule and held at least one usable `ProbeMatch`. */
  readonly datagramsAccepted: number;
  /** Dropped datagrams by reason name. */
  readonly dropped: Readonly<Partial<Record<DiscoveryDrop, number>>>;
  /** Repeats of a responder that was seen already (same source, same endpoint reference). */
  readonly repeats: number;
  /** `ProbeMatch` children that were not usable (no endpoint reference, one over 120 characters, over the per-message cap). */
  readonly matchesSkipped: number;
  /** Responders seen but not listed because the list was full. */
  readonly respondersOverCap: number;
  /** Calls of the caller's registry lookup that threw: the responder was listed as not registered. */
  readonly lookupErrors: number;
}

export interface CollectedDiscovery {
  readonly candidates: readonly OnvifCandidate[];
  readonly responderCount: number;
  readonly truncated: boolean;
  readonly counts: DiscoveryCounts;
}

export interface DiscoveryCollectorOptions {
  /** The two `urn:uuid:` message IDs of this search's probes. */
  readonly messageIds: readonly string[];
  readonly network: DiscoveryNetwork;
  readonly registered?: RegisteredLookup;
  /** The reader of one datagram. Default: `readProbeAnswer`. A test passes one that throws (check `M4-SEC-DISC-1`). */
  readonly read?: (bytes: Buffer) => ProbeAnswerReading;
}

export interface DiscoveryCollector {
  /**
   * Takes one datagram. Returns false when the datagram cap is reached: the caller closes the
   * socket at once (SEC35-28 (5)). It may throw only if the injected `read` does: the caller's
   * handler is the one `try` / `catch`.
   */
  accept(bytes: Buffer, source: { readonly address: string; readonly family: string }): boolean;
  result(): CollectedDiscovery;
}

interface Responder {
  readonly host: string;
  readonly match: ProbeMatchData;
  readonly registered: RegisteredMatch | null;
}

const textBytes = (...values: readonly (string | null)[]): number => values.reduce((sum, value) => sum + (value === null ? 0 : Buffer.byteLength(value, 'utf8')), 0);

/** Keeps a candidate within DS-16's 2 KiB by shortening its hint lists, last entries first. */
function boundedLists(match: ProbeMatchData, fixedBytes: number): { types: readonly string[]; profileHints: readonly string[]; locationHints: readonly string[] } {
  const lists = { types: [...match.types].slice(0, HINT_LIST_MAX_ENTRIES), profileHints: [...match.profileHints], locationHints: [...match.locationHints] };
  const size = (): number => fixedBytes + textBytes(...lists.types, ...lists.profileHints, ...lists.locationHints);
  for (const name of ['locationHints', 'profileHints', 'types'] as const) while (size() > CANDIDATE_MAX_BYTES && lists[name].length > 0) lists[name].pop();
  return { types: Object.freeze(lists.types), profileHints: Object.freeze(lists.profileHints), locationHints: Object.freeze(lists.locationHints) };
}

export function createDiscoveryCollector(options: DiscoveryCollectorOptions): DiscoveryCollector {
  const { network } = options;
  const read = options.read ?? readProbeAnswer;
  const messageIds = new Set(options.messageIds);
  const dropped: Partial<Record<DiscoveryDrop, number>> = {};
  /** Every responder seen, listed or not, by its pair: the conflict rule reads all of them. */
  const hostsOfReference = new Map<string, Set<string>>();
  const referencesOfHost = new Map<string, Set<string>>();
  const listed: Responder[] = [];
  let datagramsReceived = 0;
  let datagramsAccepted = 0;
  let repeats = 0;
  let matchesSkipped = 0;
  let respondersOverCap = 0;
  let lookupErrors = 0;
  let datagramCapReached = false;

  const drop = (reason: DiscoveryDrop): void => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };

  /** True when the pair is new. */
  const remember = (host: string, endpointRef: string): boolean => {
    const hosts = hostsOfReference.get(endpointRef) ?? new Set<string>();
    if (hosts.has(host)) return false;
    hosts.add(host);
    hostsOfReference.set(endpointRef, hosts);
    const references = referencesOfHost.get(host) ?? new Set<string>();
    references.add(endpointRef);
    referencesOfHost.set(host, references);
    return true;
  };

  return {
    accept(bytes, source) {
      datagramsReceived += 1;
      if (datagramsReceived > DISCOVERY_MAX_DATAGRAMS) {
        datagramCapReached = true;
        drop(DiscoveryDrop.OVER_DATAGRAM_CAP);
        return false;
      }
      const atCap = datagramsReceived === DISCOVERY_MAX_DATAGRAMS;
      if (atCap) datagramCapReached = true;
      // The source first: it costs nothing, and a forged source never reaches the parser.
      const refusal = sourceRefusal(source.address, source.family, network);
      if (refusal !== null) {
        drop(refusal);
        return !atCap;
      }
      const reading = read(bytes);
      if (!reading.ok) {
        drop(reading.drop);
        return !atCap;
      }
      if (!messageIds.has(reading.answer.relatesTo)) {
        drop(DiscoveryDrop.RELATES_TO_MISMATCH);
        return !atCap;
      }
      datagramsAccepted += 1;
      matchesSkipped += reading.answer.matchesSkipped;
      for (const match of reading.answer.matches) {
        if (!remember(source.address, match.endpointRef)) {
          repeats += 1;
          continue;
        }
        let registered: RegisteredMatch | null = null;
        try {
          registered = options.registered?.({ endpointRef: match.endpointRef, host: source.address }) ?? null;
        } catch {
          // The caller's lookup failed: the device is still listed, as not registered, and the failure is counted.
          lookupErrors += 1;
        }
        // The list is full: a responder that is not registered is counted and not kept. A registered
        // one is kept (they are the caller's own rows, so their number is bounded) and takes its
        // place first when the list is cut (SEC35-28 (4)).
        if (listed.length >= DISCOVERY_MAX_RESPONDERS && (registered === null || listed.length >= 2 * DISCOVERY_MAX_RESPONDERS)) respondersOverCap += 1;
        else listed.push({ host: source.address, match, registered });
      }
      return !atCap;
    },

    result() {
      const ordered = [...listed.filter((responder) => responder.registered !== null), ...listed.filter((responder) => responder.registered === null)];
      const kept = ordered.slice(0, DISCOVERY_MAX_RESPONDERS);
      const responderCount = listed.length + respondersOverCap;
      const candidates = kept.map(({ host, match, registered }): OnvifCandidate => {
        const conflict = (hostsOfReference.get(match.endpointRef)?.size ?? 0) > 1 || (referencesOfHost.get(host)?.size ?? 0) > 1;
        const service = serviceAddressFor(match.xaddrs, host);
        const fixedBytes = textBytes(host, service.serviceAddress, match.endpointRef, match.vendor, match.model, match.name, match.macHint, match.serialHint);
        return Object.freeze({
          // SEC35-41 (a): what the injected loopback target yields is a fixture, never a production candidate.
          adapterKind: network.kind === 'LOOPBACK_FIXTURE' ? CaptureAdapterKind.FAKE : CaptureAdapterKind.ONVIF_RTSP,
          host,
          serviceAddress: service.serviceAddress,
          endpointRef: match.endpointRef,
          vendor: match.vendor,
          model: match.model,
          name: match.name,
          testable: service.serviceAddress !== null && !conflict,
          conflict,
          reason: service.reason,
          registered: registered !== null,
          addressChanged: registered !== null && registered.byEndpointRef && registered.storedHost !== null && registered.storedHost !== host,
          ...boundedLists(match, fixedBytes),
          macHint: match.macHint,
          serialHint: match.serialHint,
        });
      });
      return Object.freeze({
        candidates: Object.freeze(candidates),
        responderCount,
        truncated: datagramCapReached || responderCount > candidates.length,
        counts: Object.freeze({ datagramsReceived, datagramsAccepted, dropped: Object.freeze({ ...dropped }), repeats, matchesSkipped, respondersOverCap, lookupErrors }),
      });
    },
  };
}
