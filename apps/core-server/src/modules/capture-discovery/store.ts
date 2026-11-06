/**
 * The candidate store: what a camera search found, as data of ONE operator session, in the memory
 * of the Core (blueprint row 132; C3 §2.6 "Candidate state"; specs R-9 AC-3, AC-4; decision D76 (1)).
 *
 * NO TABLE, NO SLICE, NO FILE. Nothing here reaches PostgreSQL, the engine's state, the realtime
 * channel or the disk: a candidate never becomes a `capture_devices` row here (that is the commit
 * of operation 96, row 142). A restart of the Core empties the store.
 *
 * OWNERSHIP. A search belongs to the authenticated session that started it (`sessionId`, the ID of
 * the auth-session row). Every read takes the caller's session ID: there is no read by search ID
 * and none by candidate ID alone, so no role - SUPERVISOR included - can reach another session's
 * list. For a foreign, an expired and an unknown candidate ID the answer is the same `null`.
 *
 * LIFETIME. A list is gone
 *   - at `expiresAt` (`completesAt` + `CAPTURE_DISCOVERY_RESULT_TTL_MS`): looked at on every read,
 *     so no timer is needed and a fake clock decides it;
 *   - when its owner starts a new search: the new list replaces the old one, and the old candidate
 *     IDs die with their test results;
 *   - when the owner session ends (`discardSession`), and when the server stops (`clear`).
 * At most one search per session, and at most one RUNNING search in the store.
 *
 * CANDIDATE IDS are minted here: `CND-` and 12 upper-case hex digits of 6 random bytes (48 bits)
 * from the injected source. They say nothing of the device and mean nothing outside their search.
 *
 * WHAT A STORED CANDIDATE HOLDS BESIDE ITS API VIEW: the adapter's own record of the answer (with
 * the announced service address, which no answer of the API returns; the connection test of row
 * 142 dials it) and the profile codes the last passing test read. It never holds a credential: no
 * member of this file could take one, and the connect flow hands in an outcome and facts only (C3
 * §2.6 "Credential in memory").
 *
 * THE SEAM OF THE CONNECT FLOW (row 142, `connect/service.ts` `CandidateDirectory`): `find`,
 * `recordTest` and `markRegistered`, each by the caller's session ID.
 */
import {
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_DISCOVERY_MAX_CANDIDATES,
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CaptureCandidateStatus,
  CaptureConnectionOutcome,
  type CaptureConnectionTestReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryState,
  type CaptureCandidate,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
  type CaptureDiscoveryTrigger,
} from '@dems/shared/api';
import type { CameraCandidate } from '../../capture/adapters';

/** A candidate as the search hands it in: everything of the API view but what the store itself decides. */
export interface FoundCandidate extends Omit<CaptureCandidate, 'candidateId' | 'lastTest' | 'adoptable'> {
  /** The adapter-layer record of the answer (host, service address, texts). Never part of an answer of the API. */
  readonly camera: CameraCandidate;
}

/** The outcome a candidate keeps of its last test. No credential; the profile codes only for the comparison of operation 96. */
export interface TestRecord {
  readonly outcome: CaptureConnectionOutcome;
  /** Whether a credential was supplied: a fact, never a value. */
  readonly authenticated: boolean;
  readonly testedAt: number;
  /** Present only for an `AUTHENTICATION_FAILED` test in which the credential was NOT sent (finding R69-13). */
  readonly reason?: CaptureConnectionTestReason;
  /** The usable profile codes the test read; empty unless `REACHABLE`. */
  readonly profiles: readonly string[];
}

/** One candidate of the caller's own live search, as the connect flow (row 142) needs it. */
export interface HeldCandidate {
  readonly candidateId: string;
  readonly searchId: string;
  readonly camera: CameraCandidate;
  /** The registered device this candidate matches, or null (`status: NEW`). */
  readonly registeredDeviceId: string | null;
  /** REGISTERED by endpoint reference while it answers from another address than the stored one (task 4 row 97: what an operator-confirmed re-address reads). */
  readonly addressChanged: boolean;
  readonly lastTest: TestRecord | null;
}

interface Entry {
  candidate: Omit<CaptureCandidate, 'adoptable'>;
  camera: CameraCandidate;
  profiles: readonly string[];
}

interface OwnedSearch {
  readonly sessionId: string;
  search: CaptureDiscoverySearch;
  entries: Entry[];
  truncated: boolean;
}

export interface CandidateStore {
  /** A new RUNNING search of `sessionId`. Replaces that session's list. Throws when a search is RUNNING: the caller asks `running` first. */
  begin(input: { sessionId: string; searchId: string; trigger: CaptureDiscoveryTrigger; startedAt: number; windowMs: number; interfaceCount: number }): CaptureDiscoverySearch;
  /** The window closed: the candidates, the counts. At most `CAPTURE_DISCOVERY_MAX_CANDIDATES` are kept, in the order given. */
  complete(searchId: string, found: readonly FoundCandidate[], facts: { responderCount: number; interfaceCount: number; truncated: boolean; completedAt: number }): CaptureDiscoverySearch | null;
  /** The search could not run: FAILED with a reason code, no candidate. */
  fail(searchId: string, failureReason: string, completedAt: number): CaptureDiscoverySearch | null;
  /** The one RUNNING search of the Core and its owner, or null. */
  running(): { readonly sessionId: string; readonly search: CaptureDiscoverySearch } | null;
  /** Operation 94: the live search of the calling session, `search: null` when it has none. */
  stateOf(sessionId: string, now: number): CaptureDiscoveryStateBody;
  /** The candidate `candidateId` of the caller's own live search, or null: unknown, expired and foreign are one answer. */
  find(sessionId: string, candidateId: string, now: number): HeldCandidate | null;
  /** Records the outcome of a connection test on the candidate. False when the caller's live search no longer has it. */
  recordTest(sessionId: string, candidateId: string, record: TestRecord, now: number): boolean;
  /** After the commit of operation 96: the candidate reads REGISTERED with its device. */
  markRegistered(sessionId: string, candidateId: string, deviceId: string, now: number): boolean;
  /** The owner session ended: its list is gone. A RUNNING search stays the Core's until its window closes, then it is dropped. */
  discardSession(sessionId: string): void;
  clear(): void;
  /** Sessions with a list, expired ones included until the next read drops them: for the tests of the bounded memory. */
  size(): number;
  /** The sessions that hold a list (a session that ended while its search runs is not among them). */
  sessionIds(): string[];
}

export interface CandidateStoreOptions {
  /** 6 random bytes per call (the platform's source). */
  readonly randomBytes: (size: number) => Uint8Array;
}

const ID_BYTES = 6;
const HEX = '0123456789ABCDEF';
const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => `${HEX[byte >> 4] ?? '0'}${HEX[byte & 15] ?? '0'}`).join('');

export function createCandidateStore(options: CandidateStoreOptions): CandidateStore {
  const bySession = new Map<string, OwnedSearch>();
  /** Sessions that ended while their search was RUNNING: the list is dropped when the window closes. */
  const ended = new Set<string>();

  const mintId = (taken: ReadonlySet<string>): string => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bytes = options.randomBytes(ID_BYTES);
      if (bytes.length !== ID_BYTES) throw new Error('the random source of the candidate store returned another length than it was asked for');
      const id = `CND-${toHex(bytes)}`;
      if (!taken.has(id)) return id;
    }
    throw new Error('the random source of the candidate store repeats itself: no candidate ID could be minted');
  };

  const ownedBy = (searchId: string): OwnedSearch | null => {
    for (const owned of bySession.values()) if (owned.search.searchId === searchId) return owned;
    return null;
  };

  /** The caller's search when it is alive at `now`; an expired one is dropped here. */
  const live = (sessionId: string, now: number): OwnedSearch | null => {
    const owned = bySession.get(sessionId);
    if (owned === undefined) return null;
    if (owned.search.state !== CaptureDiscoveryState.RUNNING && now >= owned.search.expiresAt) {
      bySession.delete(sessionId);
      return null;
    }
    return owned;
  };

  const viewOf = (entry: Entry, now: number): CaptureCandidate => {
    const last = entry.candidate.lastTest;
    const fresh = last !== null && last.outcome === CaptureConnectionOutcome.REACHABLE && now - last.testedAt < CAPTURE_CONNECTION_TEST_VALIDITY_MS;
    return { ...entry.candidate, adoptable: entry.candidate.status === CaptureCandidateStatus.NEW && fresh };
  };

  const entryOf = (sessionId: string, candidateId: string, now: number): { owned: OwnedSearch; entry: Entry } | null => {
    const owned = live(sessionId, now);
    if (owned === null || owned.search.state !== CaptureDiscoveryState.COMPLETE) return null;
    const entry = owned.entries.find((candidate) => candidate.candidate.candidateId === candidateId);
    return entry === undefined ? null : { owned, entry };
  };

  const close = (owned: OwnedSearch): CaptureDiscoverySearch | null => {
    if (!ended.delete(owned.sessionId)) return owned.search;
    bySession.delete(owned.sessionId);
    return owned.search;
  };

  return {
    begin({ sessionId, searchId, trigger, startedAt, windowMs, interfaceCount }) {
      if ([...bySession.values()].some((owned) => owned.search.state === CaptureDiscoveryState.RUNNING)) throw new Error('a camera search is running: one search per Core');
      const completesAt = startedAt + windowMs;
      const search: CaptureDiscoverySearch = {
        searchId,
        scope: CaptureDiscoveryScope.CAMERA_NETWORK,
        trigger,
        state: CaptureDiscoveryState.RUNNING,
        startedAt,
        windowMs,
        completesAt,
        expiresAt: completesAt + CAPTURE_DISCOVERY_RESULT_TTL_MS,
        responderCount: 0,
        newCount: 0,
        registeredCount: 0,
        interfaceCount,
        failureReason: null,
        created: true,
      };
      ended.delete(sessionId);
      // The new list replaces the old one: the old candidate IDs die here, with their test results.
      bySession.set(sessionId, { sessionId, search, entries: [], truncated: false });
      return search;
    },
    complete(searchId, found, facts) {
      const owned = ownedBy(searchId);
      if (owned === null || owned.search.state !== CaptureDiscoveryState.RUNNING) return null;
      const kept = found.slice(0, CAPTURE_DISCOVERY_MAX_CANDIDATES);
      const taken = new Set<string>();
      owned.entries = kept.map(({ camera, ...candidate }) => {
        const candidateId = mintId(taken);
        taken.add(candidateId);
        return { candidate: { ...candidate, candidateId, lastTest: null }, camera, profiles: [] };
      });
      owned.truncated = facts.truncated || found.length > kept.length;
      const registeredCount = kept.filter((candidate) => candidate.status === CaptureCandidateStatus.REGISTERED).length;
      const completesAt = Math.max(owned.search.startedAt, facts.completedAt);
      owned.search = {
        ...owned.search,
        state: CaptureDiscoveryState.COMPLETE,
        completesAt,
        expiresAt: completesAt + CAPTURE_DISCOVERY_RESULT_TTL_MS,
        responderCount: Math.max(facts.responderCount, kept.length),
        newCount: kept.length - registeredCount,
        registeredCount,
        interfaceCount: facts.interfaceCount,
      };
      return close(owned);
    },
    fail(searchId, failureReason, completedAt) {
      const owned = ownedBy(searchId);
      if (owned === null || owned.search.state !== CaptureDiscoveryState.RUNNING) return null;
      const completesAt = Math.max(owned.search.startedAt, completedAt);
      owned.entries = [];
      owned.search = { ...owned.search, state: CaptureDiscoveryState.FAILED, completesAt, expiresAt: completesAt + CAPTURE_DISCOVERY_RESULT_TTL_MS, failureReason };
      return close(owned);
    },
    running() {
      for (const owned of bySession.values()) if (owned.search.state === CaptureDiscoveryState.RUNNING) return { sessionId: owned.sessionId, search: owned.search };
      return null;
    },
    stateOf(sessionId, now) {
      const owned = ended.has(sessionId) ? null : live(sessionId, now);
      if (owned === null) return { search: null, candidates: [], truncated: false };
      return { search: { ...owned.search, created: false }, candidates: owned.entries.map((entry) => viewOf(entry, now)), truncated: owned.truncated };
    },
    find(sessionId, candidateId, now) {
      const found = entryOf(sessionId, candidateId, now);
      if (found === null) return null;
      const { candidate, camera, profiles } = found.entry;
      return {
        candidateId: candidate.candidateId,
        searchId: found.owned.search.searchId,
        camera,
        registeredDeviceId: candidate.status === CaptureCandidateStatus.REGISTERED ? candidate.deviceId : null,
        addressChanged: candidate.status === CaptureCandidateStatus.REGISTERED && candidate.addressChanged === true,
        lastTest: candidate.lastTest === null ? null : { ...candidate.lastTest, profiles },
      };
    },
    recordTest(sessionId, candidateId, record, now) {
      const found = entryOf(sessionId, candidateId, now);
      if (found === null) return false;
      found.entry.candidate = { ...found.entry.candidate, lastTest: { outcome: record.outcome, authenticated: record.authenticated, testedAt: record.testedAt, ...(record.reason === undefined ? {} : { reason: record.reason }) } };
      found.entry.profiles = record.outcome === CaptureConnectionOutcome.REACHABLE ? [...record.profiles] : [];
      return true;
    },
    markRegistered(sessionId, candidateId, deviceId, now) {
      const found = entryOf(sessionId, candidateId, now);
      if (found === null) return false;
      found.entry.candidate = { ...found.entry.candidate, status: CaptureCandidateStatus.REGISTERED, deviceId };
      return true;
    },
    discardSession(sessionId) {
      const owned = bySession.get(sessionId);
      if (owned === undefined) return;
      if (owned.search.state === CaptureDiscoveryState.RUNNING) ended.add(sessionId);
      else bySession.delete(sessionId);
    },
    clear() {
      bySession.clear();
      ended.clear();
    },
    size: () => bySession.size,
    sessionIds: () => [...bySession.keys()].filter((sessionId) => !ended.has(sessionId)),
  };
}
