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
  type StorageSummary,
  type SystemFlag,
  type SystemStatus,
} from '@dems/shared/sim';
import type { StatusTone } from '@dems/shared/tokens';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import { SUBJECT_TYPES, type SubjectType } from '@/components/kit';
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
}

const RING_FOR: Record<HomeStatusKind, GlowRingState> = {
  READY: 'ready',
  ATTENTION: 'attention',
  CRITICAL: 'critical',
  RECORDING: 'recording',
  UNKNOWN: 'offline',
};

const TONE_FOR: Record<HomeStatusKind, StatusTone> = {
  READY: 'success',
  ATTENTION: 'warning',
  CRITICAL: 'danger',
  RECORDING: 'danger',
  UNKNOWN: 'default',
};

/** Track ids → the shared short device names (`common.devices.*`). */
export const TRACK_NAME_KEY: Readonly<Record<string, string>> = {
  'VIDEO-01': 'common.devices.camera1',
  'VIDEO-02': 'common.devices.camera2',
  'AUDIO-01': 'common.devices.mic1',
  'AUDIO-02': 'common.devices.mic2',
};

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

export function homeStatusFor(system: SystemStatus): HomeStatus {
  const kind = system.state;
  const critical = system.flags.filter((f) => f.severity === 'CRITICAL');
  const warnings = system.flags.filter((f) => f.severity !== 'CRITICAL');
  return {
    kind,
    ring: RING_FOR[kind],
    tone: TONE_FOR[kind],
    copyKey: `features.dashboard.status.${kind}`,
    flags: [...critical, ...warnings].map(flagLineFor),
  };
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
  /** `features.dashboard.tiles.state.<stateKey>` */
  stateKey: string;
  /** Param for the `offline` state line. */
  count?: number;
  href: '/devices' | '/storage';
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
  /** The evidence id when the session sealed one (MB 2 shows EV ids), else the session id. */
  displayId: string;
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
    displayId: entry.evidenceId ?? entry.id,
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
  timeSource: string;
  timeLocked: boolean;
  linkUp: boolean;
  /** Present on the expanded layout, where the H3 tiles give way to the device tiles (D28/Q1). */
  storage?: Pick<StorageSummary, 'usedPercent' | 'state'>;
}): ChipSpec[] {
  const synced = input.timeSource === 'GNSS' && input.timeLocked;
  return [
    {
      id: 'security',
      labelKey: 'dashboard.statusStrip.security',
      valueKey: `common.posture.${input.posture}`,
      tone: POSTURE_TONE[input.posture] ?? 'default',
    },
    {
      id: 'time',
      labelKey: 'dashboard.statusStrip.time',
      valueKey: synced ? 'common.status.synchronized' : `common.enums.timeSource.${input.timeSource}`,
      tone: synced ? 'success' : (TIME_TONE[input.timeSource] ?? 'warning'),
    },
    {
      id: 'network',
      labelKey: 'dashboard.statusStrip.network',
      valueKey: input.linkUp ? 'common.status.connected' : 'common.status.disconnected',
      tone: input.linkUp ? 'success' : 'danger',
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
