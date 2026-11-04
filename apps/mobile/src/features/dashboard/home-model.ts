/**
 * Home (Dashboard) view model (04_mobile_specs §4.3; web Dashboard parity 01S §14.5.1). Pure: every
 * function maps simulator values to what the screen shows, so the rules are tested without React.
 *
 * - H2 status: `SystemStatus` (`selectSystemState`) → ring state, tone, copy keys, flag lines.
 * - H3 tiles: `DeviceStats`, the mics and the `StorageSummary` → value, tone, status copy, target.
 * - H4 primary action: the §3.7 table decides where an active session lives (no second copy).
 * - H5 rows: history entries → display id, "Today 09:35", subject type, poster suffix (D61).
 * - Clock: seconds of the WIB day (UTC+07:00, D28/Q2) for the tablet header (RollingNumber `clock`).
 *
 * Dates use the shared arithmetic formatters (`formatDate`, 04 §9, H-MB-08: no `Intl`).
 */
import type { SessionState } from '@dems/shared/domain';
import { DISPLAY_UTC_OFFSET_MINUTES, formatDate } from '@dems/shared/realtime';
import {
  SubjectTypeLabel,
  startOfWibDay,
  type DeviceStats,
  type MicStatus,
  type SessionHistoryEntry,
  type SimAlert,
  type StorageSummary,
  type SystemFlag,
  type SystemStatus,
} from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import { SUBJECT_TYPES, type SubjectType } from '@/components/kit';
import { NOTICE_REASON_NO_CAMERA_CONNECTED, failedStartWords, type FailedStart, type NoticeTranslate } from '@/features/capture-selector/capture-notices-model';
import { resyncTarget } from '@/runtime/route-sync';

const DAY_MS = 86_400_000;

// ── H2: System Status ───────────────────────────────────────────────────────────────────────

export type HomeStatusKind = SystemStatus['state'];

/** One ATTENTION / CRITICAL line: an i18n key under `features.dashboard.flags` plus its params. */
export interface FlagLine {
  id: string;
  severity: SystemFlag['severity'];
  key: string;
  params: Readonly<Record<string, string>>;
  /** i18n key of a param that is itself a key (the device name), resolved by the screen. */
  nameKey?: string;
}

export interface HomeStatus {
  kind: HomeStatusKind;
  ring: GlowRingState;
  tone: StatusTone;
  /** `features.dashboard.status.<kind>` */
  copyKey: string;
  /** Critical first, then warnings (the order `systemStatus()` emits within each severity). */
  flags: FlagLine[];
  /** Fix wave J: THE statement of Home (`homeStatusOf`); `ring` and `tone` are its ring and tone. */
  presentation: HomePresentation;
  /** The seal of the open session that is retried or blocked, or null. */
  seal: HomeFacts['seal'];
  /** How many unsealable notices are open. */
  openNotices: number;
  /** The state of the open session, or null. */
  sessionState: SessionState | null;
  /** The Core reports no platform security facts: the ring's sub-line says "Security not reported", never "SECURE". */
  platformNotReported: boolean;
  /** LIVE on a simulated Core, link up: Home carries the "Simulated Core" mark (truth rule 3f). */
  simulatedCore: boolean;
  /** False while the Core link is down: what Home holds is the last known state, not a present fact. */
  live: boolean;
  /** What stands against a new session now, or null. `OFFLINE`: the wizard's entries are disabled with the reason; `CRITICAL`: Start says recording is blocked (the devices check refuses the start). */
  startBlock: 'OFFLINE' | 'CRITICAL' | null;
}

/** Track ids → the shared short device names (`common.devices.*`). D60 (2026-11-04): four camera tracks. */
export const TRACK_NAME_KEY: Readonly<Record<string, string>> = {
  'VIDEO-01': 'common.devices.camera1',
  'VIDEO-02': 'common.devices.camera2',
  'VIDEO-03': 'common.devices.camera3', // D60 (2026-11-04)
  'VIDEO-04': 'common.devices.camera4', // D60
  'AUDIO-01': 'common.devices.mic1',
  'AUDIO-02': 'common.devices.mic2',
  'AUDIO-03': 'common.devices.mic3', // D61 (2026-11-04): four simultaneous microphone channels
  'AUDIO-04': 'common.devices.mic4', // D61
};

// D61 (2026-11-04): the mics slice states the CHANNEL code (`MIC-0N` for `AUDIO-0N`); the meters and
// cards name themselves from this map — one rule for the dashboard, the devices page and the monitor.
export const MIC_CHANNEL_NAME_KEY = {
  'MIC-01': 'common.devices.mic1',
  'MIC-02': 'common.devices.mic2',
  'MIC-03': 'common.devices.mic3',
  'MIC-04': 'common.devices.mic4',
} as const;

// ── Tablet device tiles: the level line of a MIC tile (task 3 M5, row 73; MB-01, B15, E-14) ──

/**
 * What the line under a MIC tile's meter says.
 *
 * | Kind | When | The line |
 * |---|---|---|
 * | `LEVEL` | the newest meter frame of the input carries a level | "-18 dBFS" |
 * | `NO_SIGNAL` | the frame is flat AND the Core says the microphone has no signal (its state, the word the tile's chip shows too) | "No signal" |
 * | `NO_LEVEL` | the frame is flat and the microphone is not in that state: no meter frame has arrived (an idle Core sends none; the link is stale) | "— dBFS" |
 *
 * B15 (D249 observation O-3; O-RF-T-7): the tile read "No signal" beside a READY chip, also while a
 * session recorded. The line took the word from the flat frame alone — which only says "no frame
 * yet" — so a tile could contradict its own chip. "No signal" is a state of the microphone; a
 * missing frame is not. The second half of the defect (the line held for the whole recording under
 * the `?motion=off` test switch) is fixed where the line is drawn (`device-tiles.tsx`).
 */
export type MicReadoutKind = 'LEVEL' | 'NO_SIGNAL' | 'NO_LEVEL';

export function micReadoutKind(input: { readonly frameFlat: boolean; readonly state: string; readonly notMeasured?: boolean }): MicReadoutKind {
  // Fix wave J round two (JW-08 mobile half, seen on the tablet's Home at rest: "-60 dBFS" under "Not checked";
  // contract_wave_j.md J-S 6): a frame the Core marks `notMeasured` carries the floor as a PLACEHOLDER of the
  // required member and `noSignal: false`. It is no level: the line reads "— dBFS".
  if (input.notMeasured === true) return input.state === 'NO_SIGNAL' ? 'NO_SIGNAL' : 'NO_LEVEL';
  if (!input.frameFlat) return 'LEVEL';
  return input.state === 'NO_SIGNAL' ? 'NO_SIGNAL' : 'NO_LEVEL';
}

/** The level line without a level: the unit with the app's "no value" mark. Not a word, so not in the copy. */
export const MIC_NO_LEVEL_TEXT = '— dBFS';

/**
 * What a MIC tile says about its input while a session records: the one inside `AUDIO-01`
 * ("Active") or the hot standby ("Standby"); `null` without a recording (ux §3.6 MB-01; D105: the
 * session's pair, not the configured Primary). Pure.
 *
 * Task 4 row 171 (site M5): also `null` when the tile's channel has NO input (`inputId` null: the
 * selector in force holds no complete microphone pair) and when no input is active - an absent
 * input has no role, and nothing is "Standby" to an active input that is absent.
 *
 * D61 (2026-11-04): FOUR simultaneous channels - the pair words belong to the transcription pair
 * alone. A tile whose input is neither the transcribed channel nor its standby (channel 3 or 4)
 * records without a pair word: `null`, never a blanket "STANDBY" for every non-active input.
 */
export function micTileSourceRole(input: { readonly recording: boolean; readonly inputId: string | null | undefined; readonly activeInputId: string | null; readonly standbyInputId: string | null }): 'ACTIVE' | 'STANDBY' | null {
  if (!input.recording || input.inputId === undefined || input.inputId === null || input.activeInputId === null) return null;
  if (input.inputId === input.activeInputId) return 'ACTIVE';
  return input.inputId === input.standbyInputId ? 'STANDBY' : null;
}

const FIXED_FLAGS = new Set([
  'SESSION_FAULT',
  'POWER_FAIL',
  'AUDIT_CHAIN',
  'STORAGE_FULL',
  'SECURITY_FAULT',
  'STORAGE_LOW',
  'FAN_STALL',
  'TAMPER',
  'TABLET_OFFLINE',
  'RECOVERY',
]);

/**
 * The i18n line for one `SystemFlag` (ids from `systemStatus()`: fixed ids, `CAMERA_<track>`,
 * `MIC_<track>_NO_SIGNAL`, `MIC_<track>_CLIP`, `TIME_FALLBACK`). Unknown ids keep the simulator's
 * English fallback text through the `message` param.
 */
export function flagLineFor(flag: SystemFlag): FlagLine {
  const base = { id: flag.id, severity: flag.severity };
  if (FIXED_FLAGS.has(flag.id)) return { ...base, key: `features.dashboard.flags.${flag.id}`, params: {} };
  if (flag.id === 'TIME_FALLBACK') {
    const source = flag.message.replace(/^Time source\s*/, '') || '?';
    return { ...base, key: 'features.dashboard.flags.TIME_FALLBACK', params: { source } };
  }
  const camera = /^CAMERA_(.+)$/.exec(flag.id);
  if (camera?.[1] && TRACK_NAME_KEY[camera[1]]) {
    return { ...base, key: 'features.dashboard.flags.cameraOffline', params: {}, nameKey: TRACK_NAME_KEY[camera[1]] };
  }
  const mic = /^MIC_(.+)_(NO_SIGNAL|CLIP)$/.exec(flag.id);
  if (mic?.[1] && TRACK_NAME_KEY[mic[1]]) {
    const key = mic[2] === 'CLIP' ? 'features.dashboard.flags.micClip' : 'features.dashboard.flags.micNoSignal';
    return { ...base, key, params: {}, nameKey: TRACK_NAME_KEY[mic[1]] };
  }
  // No key for this id: show the simulator's own English text (never a raw id).
  return { ...base, key: '', params: { message: flag.message } };
}

/**
 * Fix wave J (JA2-04 / JT-01; truth rule 3c): EVERYTHING HOME SAYS ABOUT THE SYSTEM IS ONE PURE FUNCTION
 * OF THE CORE'S FACTS. The status card, the header chip, the ring, the tiles and the primary action read
 * the `HomeStatus` this returns and decide nothing themselves.
 *
 * | # | The fact (first that holds) | `presentation` | Home says |
 * |---|---|---|---|
 * | 1 | the Core link is down (the runtime's one rule, a few seconds after the socket drops) | `OFFLINE` | "Core offline - state unknown"; neutral ring; tiles carry no value; Start is disabled with the reason |
 * | 2 | the open session's seal is BLOCKED | `SEAL_BLOCKED` | "Sealing blocked" (critical) |
 * | 3 | a critical fault flag | `CRITICAL` | "Recording Blocked" + the flags |
 * | 4 | RECORDING before the first durable fragment | `CAMERAS_CONNECTING` | "Connecting cameras…" (neutral) |
 * | 5 | a session records | `RECORDING` | "Session in progress" |
 * | 6 | a step of the seal failed and the Core runs it again | `SEAL_RETRYING` | "Sealing is being retried" (amber) - from the FIRST failure, never "Ready" |
 * | 7 | a CRITICAL fact of `systemTruthOf` (an ACTIVE `SYSTEM` alert) that the Core does not mark "does not block" | `CRITICAL_ALERT` | "Critical alert" (red) + the Core's sentence |
 * | 8 | a warning flag, a source on a selector line the Core reports NOT reachable, or any other fact of `systemTruthOf` | `ATTENTION` | "Attention Needed" + one line per fact |
 * | 9 | an open unsealable notice | `NOTICE` | "Open notice" (amber): it does not block recording |
 * | 10 | none of the above | `READY` | "Ready for Recording" |
 *
 * `UNKNOWN` (the system slice not read yet) keeps its own neutral words.
 */
export type HomePresentation = 'OFFLINE' | 'SEAL_BLOCKED' | 'CRITICAL' | 'CAMERAS_CONNECTING' | 'RECORDING' | 'SEAL_RETRYING' | 'CRITICAL_ALERT' | 'ATTENTION' | 'NOTICE' | 'READY' | 'UNKNOWN';

/** A source ON a selector line that the Core reports not reachable (a Core in real capture). */
export interface HomeUnreachableSource {
  readonly kind: 'camera' | 'microphone';
  /** Track id of the line (`VIDEO-02`, `AUDIO-01`). */
  readonly trackId: string;
  /** The registered device on the line, or null when the selector names none. */
  readonly deviceId: string | null;
}

/** One fact of `systemTruthOf` as Home draws it: the Core's own sentence, and whether it blocks recording. */
export interface HomeCoreFact {
  readonly id: string;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly message: string;
  /** `false`: the Core says recording is NOT blocked by it; `true` / `null`: it does, or the Core does not say. */
  readonly blocksRecording: boolean | null;
}

/** The Core's facts Home is a function of. Every member is a reading of the store or of the link: no timer, no screen state. */
export interface HomeFacts {
  readonly system: SystemStatus;
  /** LIVE only: the Core link is down (`useCoreLinkNotice().offline`). Always false in SIMULATED / HEARTBEAT. */
  readonly linkOffline: boolean;
  /** `sealAttentionOf(state)`: the seal of the open session is retried or blocked. */
  readonly seal: { readonly kind: 'RETRYING' | 'BLOCKED'; readonly sessionId: string; readonly sentence: string | null } | null;
  /** How many unsealable notices are open (`openUnsealableNoticesOf`). */
  readonly openNotices: number;
  /** Sources on the selector's lines the Core reports not reachable. */
  readonly unreachable: readonly HomeUnreachableSource[];
  /**
   * What the Core states beyond the flags (`systemTruthOf(state).facts` of `@dems/shared/sim`, contract_wave_j.md
   * J-S 13 - the SAME reader as the web console's ring and pill), without the facts Home words itself: the seal
   * (`seal`), an unsealable notice (`openNotices`) and a source a line of `unreachable` already names.
   */
  readonly coreFacts: readonly HomeCoreFact[];
  /** RECORDING before the first durable fragment (`selectConnectingCameras`). */
  readonly connecting: boolean;
  /** The state of the open session, or null. */
  readonly sessionState: SessionState | null;
  /**
   * The Core states `security.platformNotReported` (contract_wave_j.md J-S 5): it reads no TPM / Secure Boot
   * and computes no posture. No surface then says SECURE / HEALTHY about the platform - the ring's sub-line too.
   */
  readonly platformNotReported: boolean;
  /**
   * LIVE on a Core that is NOT in its own capture (`!isOwnCaptureCoreState`, J-S 7; truth rule 3f): what Home
   * shows is a demonstration, and Home says so once ("Simulated Core").
   */
  readonly simulatedCore: boolean;
}

/** Facts of a Core that states nothing beyond `system` (tests, and the default of `homeStatusFor`). */
export const QUIET_HOME_FACTS: Omit<HomeFacts, 'system'> = Object.freeze({
  linkOffline: false,
  seal: null,
  openNotices: 0,
  unreachable: Object.freeze([]) as readonly HomeUnreachableSource[],
  coreFacts: Object.freeze([]) as readonly HomeCoreFact[],
  connecting: false,
  sessionState: null,
  platformNotReported: false,
  simulatedCore: false,
});

const PRESENTATION_RING: Record<HomePresentation, GlowRingState> = {
  OFFLINE: 'offline',
  SEAL_BLOCKED: 'critical',
  CRITICAL: 'critical',
  CAMERAS_CONNECTING: 'offline',
  RECORDING: 'recording',
  SEAL_RETRYING: 'attention',
  CRITICAL_ALERT: 'critical',
  ATTENTION: 'attention',
  NOTICE: 'attention',
  READY: 'ready',
  UNKNOWN: 'offline',
};

const PRESENTATION_TONE: Record<HomePresentation, StatusTone> = {
  OFFLINE: 'default',
  SEAL_BLOCKED: 'danger',
  CRITICAL: 'danger',
  CAMERAS_CONNECTING: 'default',
  RECORDING: 'danger',
  SEAL_RETRYING: 'warning',
  CRITICAL_ALERT: 'danger',
  ATTENTION: 'warning',
  NOTICE: 'warning',
  READY: 'success',
  UNKNOWN: 'default',
};

/** The line of a source the Core reports not reachable ("Camera 2 (CAM-02): not reachable"). */
function unreachableLine(source: HomeUnreachableSource): FlagLine {
  const nameKey = TRACK_NAME_KEY[source.trackId];
  return {
    id: `UNREACHABLE_${source.trackId}`,
    severity: 'WARNING',
    key: source.deviceId === null ? 'features.dashboard.flags.sourceNotReachable' : 'features.dashboard.flags.sourceNotReachableDevice',
    params: source.deviceId === null ? {} : { deviceId: source.deviceId },
    ...(nameKey !== undefined ? { nameKey } : {}),
  };
}

function presentationOf(facts: HomeFacts, lines: number): HomePresentation {
  const kind = facts.system.state;
  if (facts.linkOffline) return 'OFFLINE';
  if (kind === 'UNKNOWN') return 'UNKNOWN';
  if (facts.seal?.kind === 'BLOCKED') return 'SEAL_BLOCKED';
  if (kind === 'CRITICAL') return 'CRITICAL';
  if (facts.sessionState === 'RECORDING' && facts.connecting) return 'CAMERAS_CONNECTING';
  if (kind === 'RECORDING') return 'RECORDING';
  if (facts.seal?.kind === 'RETRYING') return 'SEAL_RETRYING';
  // The shared rule (J-S 13): a critical fact is critical unless the Core says it does not block recording.
  if (facts.coreFacts.some((fact) => fact.severity === 'CRITICAL' && fact.blocksRecording !== false)) return 'CRITICAL_ALERT';
  if (kind === 'ATTENTION' || lines > 0 || facts.coreFacts.length > 0) return 'ATTENTION';
  if (facts.openNotices > 0) return 'NOTICE';
  return 'READY';
}

export function homeStatusOf(facts: HomeFacts): HomeStatus {
  const system = facts.system;
  const kind = system.state;
  const critical = system.flags.filter((f) => f.severity === 'CRITICAL');
  const warnings = system.flags.filter((f) => f.severity !== 'CRITICAL');
  const flags = [...critical, ...warnings].map(flagLineFor);
  // A recording's own telemetry words its sources (the track's flag); the reported state of a line is said at rest.
  const unreachable = kind === 'RECORDING' || facts.sessionState === 'RECORDING' ? [] : facts.unreachable.map(unreachableLine);
  // The Core's own sentence for each remaining fact (no i18n key: an id without a key shows its message).
  const coreLines: FlagLine[] = facts.coreFacts.map((fact, index) => ({ id: `FACT_${fact.id}_${index}`, severity: fact.severity, key: '', params: { message: fact.message } }));
  const stated = [...flags, ...unreachable, ...coreLines];
  const presentation = presentationOf(facts, stated.length);
  return {
    kind,
    presentation,
    ring: PRESENTATION_RING[presentation],
    tone: PRESENTATION_TONE[presentation],
    copyKey: `features.dashboard.status.${kind}`,
    flags: stated,
    seal: facts.seal,
    openNotices: facts.openNotices,
    sessionState: facts.sessionState,
    platformNotReported: facts.platformNotReported,
    simulatedCore: facts.simulatedCore && presentation !== 'OFFLINE',
    // Without the link nothing on Home is a present fact: the tiles carry no value and no session is started.
    live: presentation !== 'OFFLINE',
    startBlock: presentation === 'OFFLINE' ? 'OFFLINE' : presentation === 'CRITICAL' ? 'CRITICAL' : null,
  };
}

/** `homeStatusOf` of a Core that states nothing beyond its system status. */
export function homeStatusFor(system: SystemStatus): HomeStatus {
  return homeStatusOf({ ...QUIET_HOME_FACTS, system });
}

/**
 * The header chip's word (tablet header, `home-header-state`) - the SAME statement as the card:
 * a `common.systemState.*` word, or the key of the state's own chip word.
 */
export function homeChipKey(status: Pick<HomeStatus, 'presentation' | 'kind'>): string {
  switch (status.presentation) {
    case 'OFFLINE':
      return 'features.dashboard.status.OFFLINE.chip';
    case 'CAMERAS_CONNECTING':
      return 'common.session.trackConnecting';
    case 'NOTICE':
      return 'features.session-finalizing.openNotice.chip';
    case 'SEAL_RETRYING':
    case 'ATTENTION':
      return 'common.systemState.ATTENTION';
    case 'SEAL_BLOCKED':
    case 'CRITICAL_ALERT':
      return 'common.systemState.CRITICAL';
    default:
      return `common.systemState.${status.kind}`;
  }
}

/** A tile while the Core link is down: no count, no state word of the Core - "Not known". */
export function offlineTile(tile: HomeTile): HomeTile {
  const { count: _count, reported: _reported, ...rest } = tile;
  return { ...rest, tone: 'default', stateKey: 'features.dashboard.tiles.state.unknown', unknown: true };
}

// ── Header bell: the alert of a session start that recorded nothing (integration pass D7 item 3) ──

/**
 * The alert-centre line of a `CAPTURE_FAULT` alert that belongs to a FAILED START (ux §8e.1 "told
 * apart by reason", §8e.2 situation C), or null for any other alert:
 *
 * | The alert | The line |
 * |---|---|
 * | carries `params.reason: NO_CAMERA_CONNECTED` | "No camera connected. Nothing was recorded." |
 * | is active, names no cause, and the open session is a failed start | "Recording did not start. Nothing was recorded." |
 * | anything else | null: the fault's own label |
 *
 * "Nothing was recorded." is said in full; nothing here names a value of the device.
 */
export function failedStartAlertLabel(t: NoticeTranslate, alert: Pick<SimAlert, 'kind' | 'active' | 'params'>, failedStart: FailedStart | null): string | null {
  if (alert.kind !== 'CAPTURE_FAULT') return null;
  const kind: FailedStart | null =
    alert.params?.['reason'] === NOTICE_REASON_NO_CAMERA_CONNECTED ? NOTICE_REASON_NO_CAMERA_CONNECTED : alert.active && failedStart !== null ? 'OTHER' : null;
  if (kind === null) return null;
  const words = failedStartWords(t, kind);
  return `${words.title}. ${words.body}`;
}

// ── H3: status tiles ────────────────────────────────────────────────────────────────────────

export type HomeTileId = 'camera' | 'microphone' | 'storage';

export interface HomeTile {
  id: HomeTileId;
  /** Camera and microphone: the online / ready count. Storage: whole percent used (D28/Q1). */
  value: number;
  /** Camera and microphone only. */
  total: number | null;
  tone: StatusTone;
  /** `features.dashboard.tiles.state.<stateKey>`; a value that starts with `features.` is a whole key (fix wave I). */
  stateKey: string;
  /** Param for the `offline` state line. */
  count?: number;
  href: '/devices' | '/storage';
  /**
   * Fix wave L (G70c-02): the count is what the Core REPORTED for the sources on the selector's lines
   * (a Core in real capture), so the spoken label says "reachable", never "online" / "ready".
   */
  reported?: boolean;
  /** Fix wave J (JA2-04): the Core link is down - the tile draws no value ("—") and says "Not known". */
  unknown?: boolean;
}

export function cameraTileFor(stats: Pick<DeviceStats, 'camerasOnline' | 'camerasTotal'>): HomeTile {
  const offline = Math.max(0, stats.camerasTotal - stats.camerasOnline);
  return {
    id: 'camera',
    value: stats.camerasOnline,
    total: stats.camerasTotal,
    tone: offline > 0 ? 'danger' : 'success',
    stateKey: offline > 0 ? 'offline' : 'online',
    ...(offline > 0 ? { count: offline } : {}),
    href: '/devices',
  };
}

export function micTileFor(mics: readonly Pick<MicStatus, 'state' | 'clipLatched'>[]): HomeTile {
  const ready = mics.filter((m) => m.state === 'READY').length;
  const noSignal = mics.some((m) => m.state === 'NO_SIGNAL');
  const clipping = mics.some((m) => m.state === 'CLIP' || m.clipLatched);
  const stateKey = noSignal ? 'noSignal' : clipping ? 'clipping' : 'online';
  return {
    id: 'microphone',
    value: ready,
    total: mics.length,
    tone: noSignal || clipping ? 'warning' : 'success',
    stateKey,
    href: '/devices',
  };
}

/**
 * Fix wave I (the Home microphone item of re-gate 75; contract note A2 §4): the Microphone tile on a
 * Core in REAL capture. The count is the lines whose microphone the Core reports reachable, and the
 * state line follows the PRIMARY line: "Primary not reachable" / "Primary not checked" come first;
 * otherwise the signal words of the track (`micTileFor`) stand. `stateKey` values that start with
 * `features.` are whole i18n keys (the tile resolves them as such).
 */
export function realCaptureMicTileFor(
  lines: readonly { readonly primary: boolean; readonly state: 'UNKNOWN' | 'ON' | 'NOT_CHECKED' | 'REACHABLE' | 'NOT_REACHABLE' }[],
  signal: HomeTile,
): HomeTile {
  const reachable = lines.filter((line) => line.state === 'REACHABLE' || line.state === 'ON' || line.state === 'NOT_CHECKED').length;
  const primary = lines.find((line) => line.primary);
  const base = { ...signal, value: reachable, total: lines.length };
  if (primary !== undefined && (primary.state === 'NOT_REACHABLE' || primary.state === 'UNKNOWN')) {
    return { ...base, tone: 'danger', stateKey: 'features.capture-selector.sourceState.primaryNotReachable' };
  }
  if (primary !== undefined && primary.state === 'NOT_CHECKED') {
    return { ...base, reported: true, tone: signal.tone === 'success' ? 'default' : signal.tone, stateKey: 'features.capture-selector.sourceState.primaryNotChecked' };
  }
  // Fix wave L (G70c-02): "Online" is no statement of a Core in real capture. With no signal word to say
  // (the track's own NO SIGNAL / CLIPPING stay), the tile says what the Core reported: "Reachable".
  const stated = signal.stateKey === 'online' ? { ...base, stateKey: REPORTED_REACHABLE_KEY } : base;
  return { ...(reachable < lines.length && signal.tone === 'success' ? { ...stated, tone: 'warning' as StatusTone } : stated), reported: true };
}

const REPORTED_REACHABLE_KEY = 'features.capture-selector.sourceState.reachable';

/**
 * Fix wave L (G70c-02; contract note A2 section 4, the selector lines' rule on Home): the Camera tile on a
 * Core in REAL capture. The count is the cameras ON the selector's lines that the Core reports reachable.
 * The state line: "n not reachable" first, then "Not checked" (the Core says it has not read a camera
 * since it started), else "Reachable" - and "Live" ONLY while a session records (the recording's
 * telemetry is the one thing that makes it true). Never "Online".
 */
export function realCaptureCameraTileFor(
  lines: readonly { readonly state: 'UNKNOWN' | 'ON' | 'NOT_CHECKED' | 'REACHABLE' | 'NOT_REACHABLE' }[],
  recording: boolean,
): HomeTile {
  const notReachable = lines.filter((line) => line.state === 'NOT_REACHABLE' || line.state === 'UNKNOWN').length;
  const notChecked = lines.filter((line) => line.state === 'NOT_CHECKED').length;
  const base = { id: 'camera' as const, value: lines.length - notReachable, total: lines.length, href: '/devices' as const, reported: true };
  if (notReachable > 0) return { ...base, tone: 'danger', stateKey: 'features.capture-selector.sourceState.notReachableCount', count: notReachable };
  if (recording) return { ...base, tone: 'success', stateKey: 'features.capture-selector.selector.stream.LIVE' };
  // Controller ruling: at rest a camera the Core has not checked is "Not checked" (web and mobile alike).
  if (notChecked > 0) return { ...base, tone: 'default', stateKey: 'features.capture-selector.sourceState.notChecked' };
  return { ...base, tone: 'success', stateKey: REPORTED_REACHABLE_KEY };
}

const STORAGE_STATE: Record<StorageSummary['state'], { tone: StatusTone; stateKey: string }> = {
  READY: { tone: 'success', stateKey: 'healthy' },
  LOW: { tone: 'warning', stateKey: 'low' },
  FULL: { tone: 'danger', stateKey: 'full' },
};

export function storageTileFor(storage: Pick<StorageSummary, 'usedPercent' | 'state'>): HomeTile {
  const { tone, stateKey } = STORAGE_STATE[storage.state];
  return { id: 'storage', value: storage.usedPercent, total: null, tone, stateKey, href: '/storage' };
}

// ── H4: primary quick action ────────────────────────────────────────────────────────────────

export type PrimaryActionKind = 'start' | 'returnLive' | 'continueSetup' | 'finalizing' | 'recovery' | 'summary';

export interface PrimaryAction {
  kind: PrimaryActionKind;
  /** `features.dashboard.actions.<kind>` */
  labelKey: string;
  href: string;
}

export const START_SESSION_HREF = '/session/new?step=1';

const ACTION_FOR_STATE: Partial<Record<SessionState, PrimaryActionKind>> = {
  CREATE: 'continueSetup',
  PRECHECK: 'continueSetup',
  ARMED: 'continueSetup',
  RECORDING: 'returnLive',
  STOPPING: 'finalizing',
  FINALIZING: 'finalizing',
  SEALED: 'summary',
  FAULT: 'recovery',
  RECOVERY: 'recovery',
};

/**
 * "Start Session", or, while a session is active, the way back to it (04 §4.3 H4: "Start is
 * replaced by 'Return to live session' while recording"). The target is the §3.7 table
 * (`resyncTarget`); a SEALED session whose summary is acknowledged is over, so Start returns.
 */
export function primaryActionFor(
  state: SessionState | null,
  context: { sessionId?: string | null; summaryAcknowledged?: boolean } = {},
): PrimaryAction {
  const target = resyncTarget(state, {
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    ...(context.summaryAcknowledged !== undefined ? { summaryAcknowledged: context.summaryAcknowledged } : {}),
  });
  const kind = state ? ACTION_FOR_STATE[state] : undefined;
  if (target === null || kind === undefined) {
    return { kind: 'start', labelKey: 'features.dashboard.actions.start', href: START_SESSION_HREF };
  }
  return { kind, labelKey: `features.dashboard.actions.${kind}`, href: target };
}

// ── H5: recent sessions ─────────────────────────────────────────────────────────────────────

export interface RecentRow {
  sessionId: string;
  /**
   * Fix wave J (JA2-28): the SESSION id - the card is "Recent Sessions" and a row opens the session's details.
   * (It was the evidence id: a row read EV-… and opened SES-….)
   */
  displayId: string;
  /** The evidence item the session made, or null (cancelled before an item, or quarantined). */
  evidenceId: string | null;
  /** `features.dashboard.recent.<whenKey>` with `{ time, date }`. */
  whenKey: 'today' | 'yesterday' | 'earlier';
  time: string;
  date: string;
  /** The kit chip's type (verbatim Indonesian term, resolved through i18n by the chip). */
  subjectType: SubjectType;
  outcome: SessionHistoryEntry['outcome'];
  /** Evidence number suffix for the bundled poster (D61 join), or null (incomplete session). */
  posterSuffix: string | null;
}

/**
 * Sim subject type codes → the kit chip's display type through the shared `SubjectTypeLabel`
 * (D73 / F74-03 interim mapping until step 78 lets the chip take sim codes); no literals (MA-21).
 * An unknown code falls back to the "other" type.
 */
export function subjectTypeFor(value: string): SubjectType {
  const label = (SubjectTypeLabel as Readonly<Record<string, string>>)[value];
  return SUBJECT_TYPES.find((type) => type === label) ?? SubjectTypeLabel.LAINNYA;
}

/** The stable numeric suffix of an id (`EV-20261001-0013` → `0013`, P13 / D61). */
export function idSuffix(id: string | null): string | null {
  if (!id) return null;
  const match = /-(\d{4})$/.exec(id);
  return match?.[1] ?? null;
}

export function whenKeyFor(atMs: number, nowMs: number): RecentRow['whenKey'] {
  const days = Math.round((startOfWibDay(nowMs) - startOfWibDay(atMs)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return 'earlier';
}

/** Newest first, `count` rows (MB 2 shows 3). `history` must already be newest first. */
export function recentRowsFor(history: readonly SessionHistoryEntry[], nowMs: number, count = 3): RecentRow[] {
  return history.slice(0, count).map((entry) => ({
    sessionId: entry.id,
    displayId: entry.id,
    evidenceId: entry.evidenceId ?? null,
    whenKey: whenKeyFor(entry.endedAt, nowMs),
    time: formatDate(entry.endedAt, 'HH:mm'),
    date: formatDate(entry.endedAt, 'D MMM'),
    subjectType: subjectTypeFor(entry.subjectType),
    outcome: entry.outcome,
    posterSuffix: idSuffix(entry.evidenceId),
  }));
}

// ── Clock (tablet header) ───────────────────────────────────────────────────────────────────

/** Seconds of the display day at UTC+07:00 (`RollingNumber` `clock` format), from epoch seconds. */
export function displaySecondsOfDay(epochSeconds: number, offsetMinutes: number = DISPLAY_UTC_OFFSET_MINUTES): number {
  const shifted = Math.floor(epochSeconds) + offsetMinutes * 60;
  return ((shifted % 86_400) + 86_400) % 86_400;
}

/** `HH:MM:SS` of `displaySecondsOfDay` (the accessibility label of the rolling clock). */
export function clockText(secondsOfDay: number): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(Math.floor(secondsOfDay / 3600))}:${pad(Math.floor((secondsOfDay % 3600) / 60))}:${pad(secondsOfDay % 60)}`;
}

/** `HH:MM:SS` of elapsed seconds (the REC timer's accessibility label). */
export function durationText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// ── Tablet chip row: Security, Time & Network ───────────────────────────────────────────────

export interface ChipSpec {
  id: 'security' | 'time' | 'network' | 'storage';
  /** i18n key of the label (shared `dashboard.statusStrip.*`). */
  labelKey: string;
  /** i18n key of the value. */
  valueKey: string;
  /** Interpolation values for the value key. */
  valueParams?: Readonly<Record<string, string | number>>;
  tone: StatusTone;
}

const POSTURE_TONE: Record<string, StatusTone> = { SECURE: 'success', ATTENTION: 'warning', CRITICAL: 'danger', UNKNOWN: 'default' };
const TIME_TONE: Record<string, StatusTone> = { GNSS: 'success', NTP: 'info', RTC: 'warning' };

export function chipRowFor(input: {
  posture: string;
  /**
   * Closing pass J (G75b-06 at its source, ruling D217 (7)): the Core states `security.platformNotReported` -
   * it reads no TPM / Secure Boot and computes no posture. A posture that would read "Secure" reads "Not
   * reported" (neutral); one that names a fault keeps its words.
   */
  platformNotReported?: boolean;
  timeSource: string;
  timeLocked: boolean;
  /**
   * Fix wave I (re-gate 75, G75b-06): the Core's `time` slice says it runs on the host's system clock
   * (`hostClock: true`). Such a Core states no external reference, so the chip names the clock and
   * neither "GNSS" (its label) nor "RTC" / a holdover (a synchronised clock that was lost).
   */
  hostClock?: boolean;
  linkUp: boolean;
  /** Present on the expanded layout, where the H3 tiles give way to the device tiles (D28/Q1). */
  storage?: Pick<StorageSummary, 'usedPercent' | 'state'>;
}): ChipSpec[] {
  const synced = input.timeSource === 'GNSS' && input.timeLocked;
  return [
    {
      id: 'security',
      labelKey: 'dashboard.statusStrip.security',
      valueKey: input.platformNotReported === true && input.posture === 'SECURE' ? 'common.platformNotReported.value' : `common.posture.${input.posture}`,
      tone: input.platformNotReported === true && input.posture === 'SECURE' ? 'default' : (POSTURE_TONE[input.posture] ?? 'default'),
    },
    input.hostClock === true
      ? { id: 'time' as const, labelKey: 'features.capture-selector.sourceState.timeLabel', valueKey: 'session.captureFacts.timeSource.hostClock', tone: 'info' as const }
      : {
          id: 'time' as const,
          labelKey: 'dashboard.statusStrip.time',
          valueKey: synced ? 'common.status.synchronized' : `common.enums.timeSource.${input.timeSource}`,
          tone: synced ? ('success' as const) : (TIME_TONE[input.timeSource] ?? 'warning'),
        },
    // Round two (JT-03 remainder, seen on the tablet: Home "Network: Connected" beside Network & Time's own
    // "Network: Not reported"; truth rule 3c): a Core in its OWN capture reports no network - `linkUp` is then the
    // hosted model's value. It states its own capture by either fact (`isOwnCaptureCoreState`).
    input.platformNotReported === true || input.hostClock === true
      ? { id: 'network' as const, labelKey: 'dashboard.statusStrip.network', valueKey: 'common.platformNotReported.value', tone: 'default' as const }
      : {
          id: 'network' as const,
          labelKey: 'dashboard.statusStrip.network',
          valueKey: input.linkUp ? 'common.status.connected' : 'common.status.disconnected',
          tone: input.linkUp ? ('success' as const) : ('danger' as const),
        },
    ...(input.storage
      ? [
          {
            id: 'storage' as const,
            labelKey: 'dashboard.statusStrip.storage',
            valueKey: 'common.storage.usedPercent',
            valueParams: { percent: input.storage.usedPercent },
            tone: STORAGE_STATE[input.storage.state].tone,
          },
        ]
      : []),
  ];
}
