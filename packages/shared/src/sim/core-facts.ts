/**
 * Two facts only a Core knows, as pure transitions (task 3 integration pass D6):
 *
 *   applyStorageVolumeTransition       CS-09. The REAL figures of the evidence volume, measured by
 *                                      the Core's boot check (row 61), become the figures of the
 *                                      evidence volume of slice `storage`. The INTERNAL action
 *                                      `applyStorageVolume` (registry entry, execution `internal`,
 *                                      no operation): no client calls it, and a Core calls it in
 *                                      real capture operation only - a simulated Core keeps the
 *                                      simulator's own volume.
 *   noteTranscriptRevisionTransition   operation 85 on a Core "publishes evidence" (C3 §2.3): the
 *                                      item's `transcript` summary (slice `evidence`) names the new
 *                                      head, so a client that watches the slice sees a revision
 *                                      another operator appended. A door of the engine host, not a
 *                                      member of `SimActions` (as the seal transitions, D147): the
 *                                      simulator's own op 85 keeps its in-memory revisions.
 *
 * Both return THE SAME state when nothing changes, write no audit row and raise no event: the rows
 * of a revision are operation 85's, and a volume figure is a measurement, not an act of an operator.
 */
import { storageStateFor } from './selectors';
import type { CaptureDeviceStatus, CaptureSourceFact, EvidenceTranscriptSummary, PrecheckItem, SimState, StorageVolumeInput, TimeSlice, TranscriptRevisionNote } from './types';

const wholeBytes = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/** CS-09. Figures that are no byte counts, or more free than total, change nothing (a measurement the Core could not take is never guessed). */
export function applyStorageVolumeTransition(state: SimState, input: StorageVolumeInput): SimState {
  const { totalBytes, freeBytes } = input;
  if (!wholeBytes(totalBytes) || !wholeBytes(freeBytes) || totalBytes === 0 || freeBytes > totalBytes) return state;
  const usedBytes = totalBytes - freeBytes;
  const current = state.storage.volumes.find((volume) => volume.kind === 'EVIDENCE');
  if (current === undefined) return state;
  const nextState = storageStateFor((usedBytes / totalBytes) * 100);
  if (current.totalBytes === totalBytes && current.usedBytes === usedBytes && state.storage.state === nextState) return state;
  return {
    ...state,
    storage: {
      ...state.storage,
      state: nextState,
      // The history is the simulator's record of natural usage and is left as it is.
      volumes: state.storage.volumes.map((volume) => (volume.kind === 'EVIDENCE' ? { ...volume, totalBytes, usedBytes } : volume)),
    },
  };
}

/**
 * The head only moves forward; an unknown item, or a note that says what the item says, changes nothing.
 *
 * AN ITEM THAT HOLDS A SUMMARY KEEPS IT (fix pass F-M6, R80-11): the state, the hash, the failed
 * chunks and the unreachable backend were signed by the seal and no revision changes them (OD-15),
 * so a note moves `revision` and nothing else. AN ITEM WITHOUT ONE takes the whole note (a state a
 * Core read back after a start carries no summary: `modules/transcripts/heads.ts` hands in the
 * projection of the sealed manifest).
 */
export function noteTranscriptRevisionTransition(state: SimState, note: TranscriptRevisionNote): SimState {
  const item = state.evidence.find((candidate) => candidate.id === note.evidenceId);
  if (item === undefined || !Number.isSafeInteger(note.revision) || note.revision < 0) return state;
  const held = item.transcript ?? null;
  if (held !== null && held.revision >= note.revision) return state;
  const count = note.failedChunks;
  const transcript: EvidenceTranscriptSummary =
    held !== null
      ? { ...held, revision: note.revision }
      : {
          state: note.state,
          sha256: note.machineTranscriptHash,
          machineTranscriptHash: note.machineTranscriptHash,
          labelsStatus: note.labelsStatus,
          revision: note.revision,
          ...(count !== undefined && Number.isSafeInteger(count) && count >= 0 ? { failedChunks: count } : {}),
          ...(typeof note.backendUnreachable === 'boolean' ? { backendUnreachable: note.backendUnreachable } : {}),
        };
  return { ...state, evidence: state.evidence.map((candidate) => (candidate.id === note.evidenceId ? { ...candidate, transcript } : candidate)) };
}

/** The adapter kinds of a development source (C3 §2.6 "Device shapes"): the class is DEVELOPMENT exactly for these. */
export const DEVELOPMENT_SOURCE_ADAPTERS: readonly string[] = ['FAKE', 'LOCAL_DEVICE'];
const ADAPTER_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * THE SOURCE FACTS OF A REAL CAPTURE OPERATION (integration pass D10; row 140's findings F-2 and
 * F-5; ux §8f.1, §8f.3). Two things only a running Core knows, per registered source:
 *
 *   the class   `adapter` and the `sourceClass` derived from it, for a device whose stored row
 *               surfaces none - the four built-in ids, which ARE the test sources (`FAKE`) of a
 *               development operation. A device that already carries an adapter keeps it: a fact
 *               never rewrites what the registry stored.
 *   "is on"     `sourceOpen: true` while the Core holds the source open; the member is REMOVED
 *               when it is not (absent reads as "not on").
 *
 * The list is the WHOLE truth of the moment: a device it does not name is not open. A Core in
 * simulated capture never calls this (D91 R-2: no class and no "is on" there), so its devices
 * carry neither member. An ID that names no device, and an adapter that is no code, are ignored.
 * Runtime facts: no audit row, no event, nothing stored. THE SAME state when nothing changes.
 */
export function applyCaptureSourceFactsTransition(state: SimState, facts: readonly CaptureSourceFact[]): SimState {
  const byId = new Map(facts.map((fact) => [fact.deviceId, fact] as const));
  let changed = false;
  const devices = state.captureDevices.devices.map((device): CaptureDeviceStatus => {
    const fact = byId.get(device.id);
    const open = fact?.open === true;
    const adapter = device.adapter === undefined && fact?.adapter !== undefined && ADAPTER_CODE.test(fact.adapter) ? fact.adapter : undefined;
    if (adapter === undefined && (device.sourceOpen === true) === open) return device;
    changed = true;
    const { sourceOpen: _was, ...rest } = device;
    return {
      ...rest,
      ...(adapter === undefined ? {} : { adapter, sourceClass: DEVELOPMENT_SOURCE_ADAPTERS.includes(adapter) ? ('DEVELOPMENT' as const) : ('PRODUCTION' as const) }),
      ...(open ? { sourceOpen: true } : {}),
    };
  });
  return changed ? { ...state, captureDevices: { ...state.captureDevices, devices } } : state;
}

// ── The time a Core in its own capture has (fix wave H, closing pass Z1; ruling D203 (1)) ──────────

/**
 * THE TIME OF A CORE IN ITS OWN CAPTURE IS THE HOST SYSTEM CLOCK. The simulator's `time` slice is a
 * demonstration of a GNSS-disciplined time service (locked, 11 satellites, an NTP server, an offset
 * history). A Core that records with its own capture has none of that: no GNSS receiver, no
 * network-time module, no measurement of an offset. Its only time is the clock of the host. The
 * signed manifest already says so (`RTC` / `HOST_SYSTEM_CLOCK`, `sealing-host/session-reader.ts`);
 * this is the same statement for the slice, so `RECORDING_STARTED.timeSource`, the session's
 * `startTimeSource` / `stopTimeSource`, the evidence item and every client that reads the slice
 * follow it.
 *
 * THE VALUES. `source: RTC` is the one member of the contract's closed enumeration (GNSS / NTP /
 * RTC) that states no external reference; `hostClock: true` says WHICH clock it is, so a reader
 * tells the host clock from a GNSS fallback of the simulation. Nothing is locked, no satellite is
 * seen, no NTP server is named or reachable, no offset or drift is measured (0, never a figure of
 * the dataset), nothing was ever synchronised (`lastSyncAt: 0`) and the offset history is empty.
 */
export const HOST_CLOCK_TIME: TimeSlice = Object.freeze({
  hostClock: true,
  source: 'RTC',
  locked: false,
  stratum: 0,
  offsetMs: 0,
  lastSyncAt: 0,
  gnss: { locked: false, satellites: 0 },
  ntp: { server: '', reachable: false, stratum: 0 },
  rtc: { driftPpm: 0 },
  history: [],
}) as TimeSlice;

/** True for the `time` slice of a Core in its own capture: the host system clock, no time service. */
export function isHostClockTime(time: Pick<TimeSlice, 'hostClock'> | null | undefined): boolean {
  return time?.hostClock === true;
}

/** The slice says the host clock. The same state when it already does (no write, no row, no event). */
export function hostClockTimeTransition(state: SimState): SimState {
  const time = state.time;
  if (isHostClockTime(time) && time.source === 'RTC' && !time.locked && !time.gnss.locked && time.history.length === 0) return state;
  return { ...state, time: { ...HOST_CLOCK_TIME, gnss: { ...HOST_CLOCK_TIME.gnss }, ntp: { ...HOST_CLOCK_TIME.ntp }, rtc: { ...HOST_CLOCK_TIME.rtc }, history: [] } };
}

/** The sentence of the pre-check TIME item of a Core in its own capture (English fallback; a client words it from the rule). */
export const HOST_CLOCK_PRECHECK_REASON = 'Time source: host system clock (no GNSS)';
/** `params.rule` of that item: it has no reason code of the closed table (as an unreachable source has none). */
export const HOST_CLOCK_PRECHECK_RULE = 'TIME_HOST_CLOCK';
/** `value` of that item. */
export const HOST_CLOCK_PRECHECK_VALUE = 'HOST_SYSTEM_CLOCK';

/**
 * A pre-check NOTE: an item at WARN level that states a fact of the installation and asks nothing
 * of the operator. It does not block the start, it is not a warning to acknowledge and it is not
 * counted with the warnings (`advancePrecheck`: the outcome of a run whose only WARN items are notes
 * is PASS). Today there is one: the host-clock time item.
 */
export function isPrecheckNote(item: Pick<PrecheckItem, 'status' | 'params'>): boolean {
  return item.status === 'WARN' && item.params?.['rule'] === HOST_CLOCK_PRECHECK_RULE;
}
