/**
 * SA-3: WHEN A CAMERA OF A SESSION COUNTS AS OPEN (task 4 row 48; design addendum section 5.3;
 * security requirements RC-3 / S13-06, AD-01 (4), BR-08).
 *
 * THE RULE. A camera counts as open only when TWO reports for the same camera and the same attempt
 * (the same worker of the session) have both arrived, in either order, within `boundMs` of each
 * other:
 *   (i)  its own relay reports that the worker answered its record request with success;
 *   (ii) the worker reports a connect on that camera's listener.
 * A completed connect alone is never "open". Everything else is a FAULT of the capture:
 *   - one of the two without the other within the bound;
 *   - a second connect report of the worker for a camera of the same attempt (the second-connect
 *     rule: one listener, one pusher), before or after the camera was open;
 *   - a second report of the relay for a camera of the same attempt (two relays claim one listener);
 *   - the worker reports that it refused or gave up the listener of a camera WHOSE RELAY REPORTED
 *     (BR-08: the two sides contradict each other; the worker's own comparison does not relax the
 *     pairing);
 *   - a relay report for another attempt than the one in force, earlier or later.
 *
 * WHAT IS NOT A FAULT (controller ruling C35 (a), which keeps ruling D72(k) of task 3): A CAMERA THAT
 * IS SIMPLY ABSENT. Nothing arrives from either side - or the worker says it gave the listener up
 * and no relay ever reported for it - is a missing camera: this unit says nothing, the session
 * records with the other camera (the degraded start) and the worker's own warning names the
 * missing one. Only an arrival that is unpaired or contradictory is an integrity fault.
 *
 * THE ATTEMPT OF A WORKER-SIDE REPORT is stamped by the caller (a telemetry frame carries none),
 * so it is no claim of the worker: one stamped with another attempt than the one in force is
 * dropped. A relay names its own attempt: that is a claim, and a wrong one is the fault above.
 *
 * ONE FAULT. The first fault is said once and ends the pairing: the protocol has no frame that
 * drops one camera of a running session, so the caller ends the capture, and nothing said after
 * that changes it.
 *
 * WHAT THIS UNIT IS. Pure state and injected timers: it imports nothing, reads no clock, starts
 * nothing, logs nothing and holds no address. The session unit feeds it from the two sources (the
 * supervisor's events for the worker's side; an injected `RelayIngestReports` for the relay's side,
 * whose program is built by other rows) and acts on what it says.
 */

/** The bound between the two reports of one camera, in ms (design addendum 5.3; HYPOTHESIS HA-9 for the value). */
export const INGEST_PAIRING_BOUND_MS = 5_000;

/** Why the pairing of a camera failed: a closed list. */
export const IngestPairingFault = {
  /** The relay reported; the worker's connect report did not arrive within the bound. */
  WORKER_REPORT_MISSING: 'WORKER_REPORT_MISSING',
  /** The worker reported a connect; the relay's report did not arrive within the bound (a pusher that is not this session's relay). */
  RELAY_REPORT_MISSING: 'RELAY_REPORT_MISSING',
  /** A second connect report of the worker for a camera of the same attempt. */
  WORKER_CONNECTED_TWICE: 'WORKER_CONNECTED_TWICE',
  /** A second report of the relay for a camera of the same attempt. */
  RELAY_REPORTED_TWICE: 'RELAY_REPORTED_TWICE',
  /** The relay of the camera reported success and the worker says it refused, or gave up, that listener. */
  WORKER_REFUSED: 'WORKER_REFUSED',
  /** A relay report names another attempt than the one in force. */
  ATTEMPT_MISMATCH: 'ATTEMPT_MISMATCH',
} as const;
export type IngestPairingFault = (typeof IngestPairingFault)[keyof typeof IngestPairingFault];

/** The one fault of a pairing. */
export interface IngestPairingFailure {
  readonly deviceId: string;
  readonly attempt: number;
  readonly reason: IngestPairingFault;
}

/**
 * THE RELAY'S SIDE, AS THE SESSION TAKES IT (the interface rows 43, 44 and 46 fill): a relay of
 * this Core says that the worker answered its record request with success, for one camera of one
 * attempt of one session. No address and no text: three identifiers.
 */
export interface RelayIngestReport {
  readonly sessionId: string;
  readonly deviceId: string;
  /** The attempt (the worker of the session) the relay was started for. */
  readonly attempt: number;
}

/** Where the relay reports come from. `subscribe` returns the function that ends the subscription. */
export interface RelayIngestReports {
  subscribe(listener: (report: RelayIngestReport) => void): () => void;
}

export interface IngestPairingOptions {
  /** The cameras of the plan, by device. A report for another device is dropped: it is no camera of this session. */
  readonly cameras: readonly string[];
  /** Default `INGEST_PAIRING_BOUND_MS`. */
  readonly boundMs?: number;
  /** A timer: runs `callback` once after `delayMs`; returns the function that cancels it. */
  after(delayMs: number, callback: () => void): () => void;
  /** Both reports of a camera arrived: it counts as open, for this attempt. */
  opened(deviceId: string, attempt: number): void;
  /** The one fault. Said once. */
  fault(failure: IngestPairingFailure): void;
}

export interface IngestPairing {
  /** A worker of the session begins (the first, or a later one): every half pair and every open camera of an earlier attempt is dropped. */
  begin(attempt: number): void;
  relayReported(deviceId: string, attempt: number): void;
  workerConnected(deviceId: string, attempt: number): void;
  workerRefused(deviceId: string, attempt: number): void;
  /** The cameras that count as open for the attempt in force, in the order of the plan. */
  open(): readonly string[];
  /** The fault, once there is one. */
  failure(): IngestPairingFailure | null;
  /** The capture ends: every timer is cancelled and nothing more is said. */
  end(): void;
}

interface Pair {
  relay: boolean;
  worker: boolean;
  open: boolean;
  cancel(): void;
}

const nothing = (): void => {};

export function createIngestPairing(options: IngestPairingOptions): IngestPairing {
  const boundMs = options.boundMs ?? INGEST_PAIRING_BOUND_MS;
  const cameras = new Set(options.cameras);
  const pairs = new Map<string, Pair>();
  let inForce = 0;
  let failed: IngestPairingFailure | null = null;
  let ended = false;

  const drop = (): void => {
    for (const pair of pairs.values()) pair.cancel();
    pairs.clear();
  };

  function fault(deviceId: string, attempt: number, reason: IngestPairingFault): void {
    if (failed !== null || ended) return;
    failed = Object.freeze({ deviceId, attempt, reason });
    drop();
    options.fault(failed);
  }

  /**
   * The pair of a camera for a report of `attempt`, or null when the report is not to be counted.
   * `claimed`: the attempt is the reporter's own word (a relay), so another attempt than the one in
   * force is a fault; otherwise (the caller's stamp on a worker-side report) it is dropped.
   */
  function pairOf(deviceId: string, attempt: number, claimed: boolean): Pair | null {
    if (failed !== null || ended || !cameras.has(deviceId)) return null;
    if (attempt !== inForce) {
      if (claimed) fault(deviceId, attempt, IngestPairingFault.ATTEMPT_MISMATCH);
      return null;
    }
    let pair = pairs.get(deviceId);
    if (pair === undefined) {
      pair = { relay: false, worker: false, open: false, cancel: nothing };
      pairs.set(deviceId, pair);
    }
    return pair;
  }

  /** One side of a pair arrived for the first time. */
  function arrived(deviceId: string, attempt: number, pair: Pair, missing: IngestPairingFault): void {
    if (pair.relay && pair.worker) {
      pair.cancel();
      pair.cancel = nothing;
      pair.open = true;
      options.opened(deviceId, attempt);
      return;
    }
    // The first of the two: the other has the bound.
    pair.cancel = options.after(boundMs, () => {
      if (pairs.get(deviceId) === pair && !pair.open) fault(deviceId, attempt, missing);
    });
  }

  return {
    begin(attempt) {
      if (failed !== null || ended || attempt <= inForce) return;
      drop();
      inForce = attempt;
    },
    relayReported(deviceId, attempt) {
      const pair = pairOf(deviceId, attempt, true);
      if (pair === null) return;
      if (pair.relay) return fault(deviceId, attempt, IngestPairingFault.RELAY_REPORTED_TWICE);
      pair.relay = true;
      arrived(deviceId, attempt, pair, IngestPairingFault.WORKER_REPORT_MISSING);
    },
    workerConnected(deviceId, attempt) {
      const pair = pairOf(deviceId, attempt, false);
      if (pair === null) return;
      if (pair.worker) return fault(deviceId, attempt, IngestPairingFault.WORKER_CONNECTED_TWICE);
      pair.worker = true;
      arrived(deviceId, attempt, pair, IngestPairingFault.RELAY_REPORT_MISSING);
    },
    workerRefused(deviceId, attempt) {
      // C35 (a): a listener the worker gave up and no relay reported for is a MISSING camera, not a fault. Read without making a pair.
      if (failed !== null || ended || attempt !== inForce) return;
      if (pairs.get(deviceId)?.relay === true) fault(deviceId, attempt, IngestPairingFault.WORKER_REFUSED);
    },
    open: () => options.cameras.filter((deviceId) => pairs.get(deviceId)?.open === true),
    failure: () => failed,
    end() {
      ended = true;
      drop();
    },
  };
}
