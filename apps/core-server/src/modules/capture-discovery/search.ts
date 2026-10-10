/**
 * One camera search, from its trigger to its audit row (blueprint row 132; C3 §2.6 "Search
 * trigger", "Rate limits", §5.2 `CAPTURE_DISCOVERY_SEARCHED`; specs R-9 AC-1 to AC-4, AC-11, AC-13;
 * decisions D74 (1), D80, D86 C-4, D91; security review SEC35-28, SEC35-29, SEC35-39).
 *
 * THE ONE CALL SITE OF `discover` (static rule G-R13). A search is started by exactly two
 * triggers, and both come through `start` of this file:
 *
 *   MANUAL     operation 93 (`routes.ts`)
 *   PRECHECK   the one search of a pre-check run with an unreachable camera (`precheckSearch` of
 *              the module's control; the pre-check hook of row 133 calls it)
 *
 * Nothing else starts one: no boot step, no timer, no read. Operation 94 reads the store and
 * sends nothing.
 *
 * WHAT `start` DECIDES, in this order, before a datagram is sent:
 *   1. no discovery adapter                         503 DISCOVERY_NOT_READY
 *   2. the session is RECORDING and the lift of     409 DISCOVERY_NOT_ALLOWED_WHILE_RECORDING
 *      D86 C-4 is off                               (0 datagrams, no audit row, no alert)
 *   3. the caller's own search is RUNNING           the same search, `created: false` (no second probe)
 *   4. another session's search is RUNNING          409 DISCOVERY_IN_PROGRESS (one socket per Core)
 *   5. a bound of `limits.ts` (MANUAL only)         429 DISCOVERY_RATE_LIMITED with retry-after
 *      The search of a pre-check has its own allowance - one per pre-check run, which the
 *      pre-check gate of `src/capture-notices` holds - and is outside these bounds: it is not
 *      refused by them and not counted into them. It stays single-flight (3 and 4).
 * A refusal changes nothing: no state, no count toward a bound, no row.
 *
 * THEN: the registered cameras are read (one SELECT), the search is RUNNING in the store, and the
 * adapter probes for the window. `start` answers as soon as the search is RUNNING; the window
 * closes later, in `closed`, which
 *   - maps the adapter's candidates to the contract's shape (the store mints the IDs);
 *   - writes ONE `CAPTURE_DISCOVERY_SEARCHED` row with counts (the only database write of a
 *     search: `capture_devices` and `capture_device_credentials` are never written here);
 *   - logs the counts and the duration (numbers and reason names only);
 *   - tells the listeners (the no-device notifier of row 133 raises or resolves its alert).
 * "The search could not run" (`DiscoveryNotRunError`, or the registry read failed) is state
 * FAILED with a reason code and a row with `outcome: FAILED`. It is never an empty COMPLETE.
 */
import {
  CAPTURE_DISCOVERY_WINDOW_MS,
  CaptureCandidateStatus,
  CaptureDiscoveryReason,
  CaptureDiscoveryScope,
  CaptureDiscoveryState,
  CaptureDiscoveryTrigger,
  captureDiscoverySearchedDetails,
  type CaptureDiscoverySearch,
} from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import { DiscoveryNotRunError, connectionTargetOf, sourceClassOf, type OnvifDiscoveryAdapter, type RegisteredLookup, type WsDiscoveryResult } from '../../capture/adapters';
import type { AuditEntry } from '../../core';
import { SearchBound, type SearchLimiter } from './limits';
import { registeredIndexOf, type RegisteredCamera, type RegisteredIndex } from './registered';
import { searchIdOf } from './search-ids';
import type { CandidateStore, FoundCandidate } from './store';

/** Why a search that was asked for did not start. `retryAfterMs` only with `RATE_LIMITED`. */
export type SearchRefusal =
  | { readonly kind: 'NOT_READY'; readonly reason: typeof CaptureDiscoveryReason.DISCOVERY_NOT_READY }
  | { readonly kind: 'RECORDING'; readonly reason: typeof CaptureDiscoveryReason.DISCOVERY_NOT_ALLOWED_WHILE_RECORDING }
  | { readonly kind: 'IN_PROGRESS'; readonly reason: typeof CaptureDiscoveryReason.DISCOVERY_IN_PROGRESS }
  | { readonly kind: 'RATE_LIMITED'; readonly reason: typeof CaptureDiscoveryReason.DISCOVERY_RATE_LIMITED; readonly bound: SearchBound; readonly retryAfterMs: number };

export type SearchStart =
  | { readonly started: true; readonly created: boolean; readonly search: CaptureDiscoverySearch; /** Settles with the closed search when the window has closed and the row is written (null: not this call's search). Never rejects. */ readonly closed: Promise<CaptureDiscoverySearch | null> }
  | { readonly started: false; readonly refusal: SearchRefusal };

export interface SearchRequest {
  /** The auth session that owns the search (the caller's, or the operator's who started the pre-check). */
  readonly sessionId: string;
  readonly operatorId: string;
  /** The paired device of that session, or null on the web console: the row's `deviceId`. */
  readonly deviceId: string | null;
  readonly trigger: CaptureDiscoveryTrigger;
}

/** What the window's end tells a listener: counts and ids, never a candidate. */
export interface SearchClosed {
  readonly search: CaptureDiscoverySearch;
  readonly sessionId: string;
}

export interface SearchLog {
  info(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface SearchRunnerOptions {
  readonly store: CandidateStore;
  readonly limiter: SearchLimiter;
  /** The server clock. */
  readonly now: () => number;
  /** The discovery adapter of this Core, built with `registered`; null when none is provided (`SIMULATED`, or no network search in this operation). */
  readonly adapter: (registered: RegisteredLookup) => OnvifDiscoveryAdapter | null;
  /** True when an adapter can be built: asked before anything is read. */
  readonly ready: () => boolean;
  /** The camera rows of the registry (one read). */
  readonly registeredCameras: () => Promise<readonly RegisteredCamera[]>;
  /** The open recording session: its ID and state, or null when none is open. */
  readonly openSession: () => { readonly id: string; readonly state: string } | null;
  /** The lift of D86 C-4: `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` of the contract. */
  readonly duringRecordingEnabled: boolean;
  /** Writes the one audit row of a search, in a unit of its own. */
  readonly audit: (entry: AuditEntry) => Promise<void>;
  readonly log: SearchLog;
  /** Persists a failure the caller is not waiting for (the window closes after the answer). */
  readonly persist: (entry: { source: string; message: string; code: string; context: Record<string, string | number> }) => void;
  readonly windowMs?: number;
  /**
   * Fix wave I (G70b-07): the highest camera-search number the stored audit chain holds
   * (`search-ids.ts`). Asked ONCE per process, by the first search; the IDs go on from it, so that
   * a restart of the Core never gives a number of the chain again. Absent: the IDs start at 1 (a
   * runner without a database). A read that fails is logged and persisted, this search numbers
   * from what is known, and the next search asks again.
   */
  readonly lastStoredSearchNumber?: () => Promise<number>;
}

export interface SearchRunner {
  start(request: SearchRequest): Promise<SearchStart>;
  /** Called for every search whose window closed, COMPLETE or FAILED, after its row is written. */
  onClosed(listener: (closed: SearchClosed) => void | Promise<void>): void;
  /** Stops a RUNNING search (the server closes). Its socket is closed by the adapter. */
  abort(): void;
  /** Searches started since the process began. The number of a search ID is this count on top of the stored chain's highest (G70b-07). */
  started(): number;
}

const SOURCE = 'captureDiscovery.search';

/** The `connectionTarget` member of a candidate that is testable and has a target; nothing otherwise. */
function targetMemberOf(candidate: WsDiscoveryResult['candidates'][number]): { connectionTarget?: string } {
  if (!candidate.testable || candidate.conflict) return {};
  const target = connectionTargetOf(candidate);
  return target === null ? {} : { connectionTarget: target };
}

/** A candidate of the adapter as the contract lists it. The store adds the ID, `lastTest` and `adoptable`. */
function foundOf(result: WsDiscoveryResult, index: RegisteredIndex): FoundCandidate[] {
  return result.candidates.map((candidate) => {
    const device = index.deviceOf(candidate);
    return {
      adapter: candidate.adapterKind,
      // Derived by the Core from the adapter kind; a client never sets it.
      sourceClass: sourceClassOf(candidate.adapterKind),
      host: candidate.host,
      endpointRef: candidate.endpointRef,
      vendor: candidate.vendor,
      model: candidate.model,
      name: candidate.name,
      status: device === null ? CaptureCandidateStatus.NEW : CaptureCandidateStatus.REGISTERED,
      deviceId: device?.deviceId ?? null,
      // A conflicting answer is listed and never testable (SEC35-28 (1)); so is one without a service address of its own host.
      testable: candidate.testable && !candidate.conflict && candidate.serviceAddress !== null,
      // What the operator confirms before a test (finding R69-12): the adapter's own text of the target it will contact. Absent when there is none.
      ...targetMemberOf(candidate),
      conflict: candidate.conflict,
      addressChanged: candidate.addressChanged,
      camera: candidate,
    };
  });
}

export function createSearchRunner(options: SearchRunnerOptions): SearchRunner {
  const { store, limiter, now, log } = options;
  const windowMs = options.windowMs ?? CAPTURE_DISCOVERY_WINDOW_MS;
  const listeners: Array<(closed: SearchClosed) => void | Promise<void>> = [];
  let sequence = 0;
  let running: AbortController | null = null;
  /** The highest number of the stored chain, once it was read (G70b-07); null until then. */
  let storedBase: number | null = options.lastStoredSearchNumber === undefined ? 0 : null;
  let baseRead: Promise<void> | null = null;
  /** Reads the base once. Never throws: a failed read leaves `storedBase` null and is asked again by the next search. */
  const readBase = (): Promise<void> => {
    const read = options.lastStoredSearchNumber;
    if (storedBase !== null || read === undefined) return Promise.resolve();
    baseRead ??= read()
      .then(
        (last) => {
          storedBase = Number.isSafeInteger(last) && last > 0 ? last : 0;
        },
        (error: unknown) => {
          const message = 'the highest stored search number could not be read: this search is numbered without it';
          const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : 'CAPTURE_DISCOVERY_SEARCH_NUMBER_UNREAD';
          log.error({ code: 'CAPTURE_DISCOVERY_SEARCH_NUMBER_UNREAD', source: SOURCE, failureCode: code }, message);
          options.persist({ source: SOURCE, message, code: 'CAPTURE_DISCOVERY_SEARCH_NUMBER_UNREAD', context: { failureCode: code } });
        },
      )
      .finally(() => {
        baseRead = null;
      });
    return baseRead;
  };

  const refuse = (refusal: SearchRefusal): SearchStart => ({ started: false, refusal });

  /** The window closed, one way or the other: the row, the log line, the listeners. Never throws. */
  const closed = async (request: SearchRequest, search: CaptureDiscoverySearch | null, startedAt: number, counts: Record<string, unknown>): Promise<void> => {
    if (search === null) return;
    const failed = search.state === CaptureDiscoveryState.FAILED;
    const open = options.openSession();
    try {
      await options.audit({
        type: 'CAPTURE_DISCOVERY_SEARCHED',
        message: failed ? 'Camera search could not run' : `Camera search performed (${search.responderCount} answered)`,
        severity: failed ? 'WARNING' : 'INFO',
        actorId: request.operatorId,
        deviceId: request.deviceId,
        // Ids, the trigger, the outcome and four counts (C3 §5.2). Never an address or a device text.
        details: captureDiscoverySearchedDetails({
          searchId: search.searchId,
          scope: CaptureDiscoveryScope.CAMERA_NETWORK,
          trigger: search.trigger,
          outcome: failed ? 'FAILED' : 'COMPLETE',
          responderCount: search.responderCount,
          newCount: search.newCount,
          registeredCount: search.registeredCount,
          interfaceCount: search.interfaceCount,
          failureReason: search.failureReason,
          sessionId: open?.id ?? null,
          operationId: request.trigger === CaptureDiscoveryTrigger.MANUAL ? 'startCaptureDiscovery' : null,
          permission: request.trigger === CaptureDiscoveryTrigger.MANUAL ? 'CAPTURE_CONFIG' : null,
        }),
      });
    } catch {
      // The search itself stands; that its row is missing is a fault the team must find tomorrow.
      const message = 'the audit row of a camera search could not be written';
      log.error({ code: 'CAPTURE_DISCOVERY_AUDIT_FAILED', source: SOURCE, searchId: search.searchId }, message);
      options.persist({ source: SOURCE, message, code: 'CAPTURE_DISCOVERY_AUDIT_FAILED', context: { searchId: search.searchId, trigger: search.trigger } });
    }
    log.info(
      {
        code: 'CAPTURE_DISCOVERY_SEARCHED',
        source: SOURCE,
        searchId: search.searchId,
        trigger: search.trigger,
        outcome: search.state,
        failureReason: search.failureReason,
        responderCount: search.responderCount,
        newCount: search.newCount,
        registeredCount: search.registeredCount,
        interfaceCount: search.interfaceCount,
        durationMs: now() - startedAt,
        // The adapter's counts: numbers and reason names only (capture spec DS-12).
        counts,
      },
      'camera search closed',
    );
    for (const listener of listeners) {
      try {
        await listener({ search, sessionId: request.sessionId });
      } catch {
        const message = 'a listener of a closed camera search failed';
        log.error({ code: 'CAPTURE_DISCOVERY_LISTENER_FAILED', source: SOURCE, searchId: search.searchId }, message);
        options.persist({ source: SOURCE, message, code: 'CAPTURE_DISCOVERY_LISTENER_FAILED', context: { searchId: search.searchId } });
      }
    }
  };

  return {
    async start(request) {
      if (!options.ready()) return refuse({ kind: 'NOT_READY', reason: CaptureDiscoveryReason.DISCOVERY_NOT_READY });
      // G70b-07: before the checks below, which run in one turn (single flight): the one read of the stored chain's highest number.
      await readBase();
      if (!options.duringRecordingEnabled && options.openSession()?.state === SessionState.RECORDING) {
        return refuse({ kind: 'RECORDING', reason: CaptureDiscoveryReason.DISCOVERY_NOT_ALLOWED_WHILE_RECORDING });
      }
      const current = store.running();
      if (current !== null) {
        // Idempotent while the caller's own search runs: the same search, no second probe.
        if (current.sessionId === request.sessionId) return { started: true, created: false, search: { ...current.search, created: false }, closed: Promise.resolve(null) };
        return refuse({ kind: 'IN_PROGRESS', reason: CaptureDiscoveryReason.DISCOVERY_IN_PROGRESS });
      }
      const startedAt = now();
      if (request.trigger === CaptureDiscoveryTrigger.MANUAL) {
        const allowance = limiter.check(request.sessionId, startedAt);
        if (!allowance.allowed) {
          return refuse({ kind: 'RATE_LIMITED', reason: CaptureDiscoveryReason.DISCOVERY_RATE_LIMITED, bound: allowance.bound, retryAfterMs: allowance.retryAfterMs });
        }
      }

      // From here on a search IS started: it takes its ID, its place in the bounds and its row.
      sequence += 1;
      const searchId = searchIdOf((storedBase ?? 0) + sequence);
      // The pre-check's search is outside the four bounds: it takes no place in them (SEC35-39 (3)).
      if (request.trigger === CaptureDiscoveryTrigger.MANUAL) limiter.record(request.sessionId, startedAt);
      const search = store.begin({ sessionId: request.sessionId, searchId, trigger: request.trigger, startedAt, windowMs, interfaceCount: 0 });
      const abort = new AbortController();
      running = abort;

      const work = (async (): Promise<CaptureDiscoverySearch | null> => {
        let result: CaptureDiscoverySearch | null;
        let counts: Record<string, unknown> = {};
        try {
          // One read of the registry, then the probe. A registry that cannot be read is a search that could not run.
          const index = registeredIndexOf(await options.registeredCameras());
          const adapter = options.adapter(index.lookup);
          if (adapter === null) throw new DiscoveryUnavailable();
          const found = await adapter.discover({ windowMs, signal: abort.signal });
          counts = { ...found.counts };
          result = store.complete(searchId, foundOf(found, index), { responderCount: found.responderCount, interfaceCount: found.interfaceCount, truncated: found.truncated, completedAt: now() });
        } catch (error) {
          const failureReason = error instanceof DiscoveryNotRunError ? error.code : error instanceof DiscoveryUnavailable ? CaptureDiscoveryReason.DISCOVERY_NOT_READY : abort.signal.aborted ? 'SEARCH_ABORTED' : 'SEARCH_FAILED';
          if (failureReason === 'SEARCH_FAILED') {
            // Not one of the named ways a search cannot run: a fault of the server, by its code only.
            const code = typeof (error as { code?: unknown } | null)?.code === 'string' ? String((error as { code: string }).code) : 'SEARCH_FAILED';
            const message = 'a camera search failed';
            log.error({ code, source: SOURCE, searchId }, message);
            options.persist({ source: SOURCE, message, code, context: { searchId, trigger: request.trigger } });
          }
          result = store.fail(searchId, failureReason, now());
        } finally {
          if (running === abort) running = null;
        }
        await closed(request, result, startedAt, counts);
        return result;
      })();

      return { started: true, created: true, search, closed: work };
    },
    onClosed(listener) {
      listeners.push(listener);
    },
    abort() {
      running?.abort();
    },
    started: () => sequence,
  };
}

/** The adapter went away between the readiness check and the probe. */
class DiscoveryUnavailable extends Error {}
