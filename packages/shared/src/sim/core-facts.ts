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
import { DEVICE_ID } from './dataset';
import { storageStateFor } from './selectors';
import type { CaptureDeviceStatus, CaptureSourceFact, DeviceSlice, EvidenceTranscriptSummary, PrecheckItem, SecuritySlice, SimState, StorageVolumeInput, TimeSlice, TranscriptRevisionNote, UpdateSlice } from './types';

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

// ── The platform facts a Core in its own capture does not read (closing pass J; ruling D217 (7)) ──

/**
 * A CORE IN ITS OWN CAPTURE READS NO TPM, NO SECURE BOOT STATE AND COMPUTES NO POSTURE. The
 * simulator's `security` slice is a demonstration of a hardened device: `tpm.ok: true`,
 * `secureBoot: true`, `posture: SECURE`, a control list that says "Attestation OK". A Core that
 * records with its own capture has no reader for any of them (finding G75b-06).
 *
 * THE STATEMENT is one optional member, `security.platformNotReported: true` - the smallest
 * additive one: the three members are REQUIRED by the closed shape (a boolean, a boolean, one of
 * three postures - none of which can say "unknown"), so they stay in the slice as placeholders
 * and the member says that they are not readings. Every surface that shows the TPM, Secure Boot
 * or the posture reads this member BY NAME first (`isPlatformNotReported`) and shows "Not
 * reported". Absent = the simulated device: its values are what it shows (the SIMULATED lane and
 * the in-app simulator are unchanged).
 *
 * What the member does NOT cover: `encryption` / `hashAlgorithm` (constants of the product),
 * `tamper` and the key list - those have their own rules.
 */
export const PLATFORM_NOT_REPORTED: Pick<SecuritySlice, 'platformNotReported'> = Object.freeze({ platformNotReported: true } as const);

/** The control ids the member covers (`security.controls[].id`). */
export const PLATFORM_NOT_REPORTED_CONTROLS: readonly string[] = Object.freeze(['TPM', 'SECURE_BOOT']);

/** True for the `security` slice of a Core in its own capture: TPM, Secure Boot and posture are not reported. */
export function isPlatformNotReported(security: Pick<SecuritySlice, 'platformNotReported'> | null | undefined): boolean {
  return security?.platformNotReported === true;
}

/** The slice says "not reported". The same state when it already does (no write, no row, no event). */
export function platformNotReportedTransition(state: SimState): SimState {
  if (isPlatformNotReported(state.security)) return state;
  return { ...state, security: { ...state.security, ...PLATFORM_NOT_REPORTED } };
}

// ── No updater (fix wave J; findings JT-06 / JW-06) ────────────────────────────────────────────────

/**
 * A CORE IN ITS OWN CAPTURE HAS NO SOFTWARE UPDATER. The simulator's `update` slice is the
 * demonstration of an A/B update of a hardened device; on a real-capture Core a press of "Install
 * update" ran that demonstration and left "Installed v2.5.0 - slot B" on the page. The statement
 * is one optional member, `update.updaterNotAvailable: true` (the pattern of
 * `platformNotReported`): the required members stay as placeholders, the member says they are not
 * readings, and `startSoftwareUpdate` refuses (`COMMAND_UNSUPPORTED`). Absent = the simulated device.
 */
export const UPDATER_NOT_AVAILABLE: Pick<UpdateSlice, 'updaterNotAvailable'> = Object.freeze({ updaterNotAvailable: true } as const);
/** `details.reason` of the refusal of operation 67 on such a Core. */
export const UPDATER_NOT_AVAILABLE_REASON = 'UPDATER_NOT_AVAILABLE';

/** True for the `update` slice of a Core that has no updater. */
export function isUpdaterNotAvailable(update: Pick<UpdateSlice, 'updaterNotAvailable'> | null | undefined): boolean {
  return update?.updaterNotAvailable === true;
}

/** The slice says "no updater". The same state when it already does (no write, no row, no event). A run that was in flight is ended: nothing is installing. */
export function updaterNotAvailableTransition(state: SimState): SimState {
  if (isUpdaterNotAvailable(state.update) && state.update.state !== 'RUNNING') return state;
  return { ...state, update: { ...state.update, ...(state.update.state === 'RUNNING' ? { state: 'IDLE' as const, startedAt: null, completedAt: null } : {}), ...UPDATER_NOT_AVAILABLE } };
}

/** What a Core in its own capture states of itself outside a session: the host clock, no platform reading and no updater. One call for a host. */
export function ownCaptureCoreFactsTransition(state: SimState): SimState {
  return updaterNotAvailableTransition(platformNotReportedTransition(hostClockTimeTransition(state)));
}

/**
 * THE ONE READER OF "IS THIS A CORE IN ITS OWN CAPTURE" (fix wave J; truth rule 3f; finding JW-07).
 * Such a Core states `time.hostClock` and `security.platformNotReported` at every start and at
 * every health tick; a Core in SIMULATED capture and the in-app simulator state neither. So for a
 * client in Live mode `false` means: the Core it talks to is SIMULATED - every feed, recording
 * state, integrity statement and platform card it shows is a DEMONSTRATION and says so.
 */
export function isOwnCaptureCoreState(state: { readonly time?: Pick<TimeSlice, 'hostClock'> | null; readonly security?: Pick<SecuritySlice, 'platformNotReported'> | null } | null | undefined): boolean {
  return state?.time?.hostClock === true || state?.security?.platformNotReported === true;
}

/**
 * THE ONE READER OF "WHICH DEVICE ID DOES THIS CORE REPORT" (audit row CS2, finding U-14c; rule S9 of row 105, D88).
 * The device id of the state is the Core's stored record (`core_device.id`, replicated into `device.id`). On a Core
 * in its own capture (`isOwnCaptureCoreState`) a record that still holds the dataset's reserved id (`DEVICE_ID`,
 * `DEMS-IR-01`: the seed's, never an installation's) is not this installation's id: `null` = "Not reported".
 * Every other case answers the record as it is - the simulated lane keeps the dataset's id.
 */
/** What a FILE the console writes (a log or audit export) states as `deviceId` when `reportedCoreDeviceIdOf` is null. */
export const CORE_DEVICE_ID_NOT_REPORTED = 'not-reported';

export function reportedCoreDeviceIdOf(state: { readonly device: Pick<DeviceSlice, 'id'>; readonly time?: Pick<TimeSlice, 'hostClock'> | null; readonly security?: Pick<SecuritySlice, 'platformNotReported'> | null }): string | null {
  return isOwnCaptureCoreState(state) && state.device.id === DEVICE_ID ? null : state.device.id;
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
  const rule = item.params?.['rule'];
  return item.status === 'WARN' && (rule === HOST_CLOCK_PRECHECK_RULE || rule === SECURITY_NOT_REPORTED_PRECHECK_RULE);
}

// Fix wave J (truth rule 3c; findings JW-04 / JT-03): the SECURITY item of a Core that reads no platform.
/** `params.rule` of the pre-check SECURITY item of a Core that states `platformNotReported`: a NOTE, never READY / PASS. */
export const SECURITY_NOT_REPORTED_PRECHECK_RULE = 'SECURITY_PLATFORM_NOT_REPORTED';
/** `value` of that item. */
export const SECURITY_NOT_REPORTED_PRECHECK_VALUE = 'NOT_REPORTED';
/** Its sentence (English fallback; a client words it from the rule). */
export const SECURITY_NOT_REPORTED_PRECHECK_REASON = 'Platform security: not reported (this Core reads no TPM and no Secure Boot state)';

/** `params.rule` of a diagnostics row over hardware a Core in its own capture does not read. */
export const DIAGNOSTIC_NOT_REPORTED_RULE = 'NOT_REPORTED';
/** Its detail text (English fallback). */
export const DIAGNOSTIC_NOT_REPORTED_DETAIL = 'Not reported by this Core';
/** The diagnostics rows such a Core cannot answer: SMART, the fan, the LAN / PoE readings and the platform. */
export const DIAGNOSTIC_NOT_REPORTED_CHECKS: readonly string[] = Object.freeze(['STORAGE', 'FAN', 'NETWORK', 'SECURITY']);

/**
 * A diagnostics row that states NOTHING (fix wave J): the Core does not read that hardware. The
 * row vocabulary has no such status, so it is carried at WARN level with `params.rule` (the idiom
 * of the pre-check note) - a client draws "Not reported" and does not count it with the warnings.
 */
export function isDiagnosticNotReported(check: { readonly status?: unknown; readonly params?: Readonly<Record<string, unknown>> | undefined } | null | undefined): boolean {
  return check?.status === 'WARN' && check.params?.['rule'] === DIAGNOSTIC_NOT_REPORTED_RULE;
}

/** True for an audio frame the Core did not measure (fix wave J, JW-08): draw "Not measured", never "NO SIGNAL". */
export function isLevelNotMeasured(frame: { readonly notMeasured?: unknown } | null | undefined): boolean {
  return frame?.notMeasured === true;
}
