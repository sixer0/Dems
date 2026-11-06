/**
 * Page-level views over `SimState` (step 54): the reads the web pages had to derive locally
 * while the simulator lacked them (SIM-GAP-W49-1, W50-1..3, W52-1, W52-4, W52-7). Pure, and
 * referentially stable where a component subscribes (review 40 M1).
 *
 * Values that are synthetic say so in their doc comment; the UI labels them "derived" or
 * "synthetic demo values".
 */
import type { NetworkDomain } from '../domain';
import { syntheticFingerprint } from './dataset';
import { stableSelector } from './memo';
import type { AuditRow, EpochMs, ServiceEntry, SimEvent, SimState, StorageVolume, TimelineEvent } from './types';
import {
  AvSyncState,
  FAULT_EVENT_CATEGORY,
  NetworkDomainState,
  OperatorRole,
  SIM_EVENT_CATEGORY,
  SmartStatus,
  type FaultKind,
  type SimEventCategory,
} from './vocabulary';

// ── Event categories (SIM-GAP-W50-3, W49-2) ──────────────────────────────────────────────

/** The primary category of an event; FAULT_RAISED / FAULT_CLEARED take their fault kind's. */
export function eventCategory(event: Pick<SimEvent, 'type' | 'params'>): SimEventCategory {
  if (event.type === 'FAULT_RAISED' || event.type === 'FAULT_CLEARED') {
    const kind = event.params.kind;
    if (typeof kind === 'string' && kind in FAULT_EVENT_CATEGORY) return FAULT_EVENT_CATEGORY[kind as FaultKind];
  }
  return SIM_EVENT_CATEGORY[event.type];
}

/** Newest first, at most `count`, events of the given categories (store-owned objects). */
export function selectEventsByCategory(s: SimState, categories: readonly SimEventCategory[], count = 8): SimEvent[] {
  const wanted = new Set(categories);
  const out: SimEvent[] = [];
  for (let index = s.events.length - 1; index >= 0 && out.length < count; index -= 1) {
    const event = s.events[index];
    if (event && wanted.has(eventCategory(event))) out.push(event);
  }
  return out;
}

/** The Network & Time page's source buckets (step 50's mapping, moved here unchanged). */
export type NetworkTimeSource = 'TIME' | 'LAN' | 'TABLET' | 'POE' | 'EXPORT' | 'SERVICE' | 'SYSTEM';

const NETWORK_TIME_TYPE_SOURCE: Partial<Record<SimEvent['type'], NetworkTimeSource>> = {
  TIME_SYNC: 'TIME',
  TABLET_CONNECTED: 'TABLET',
  TABLET_DISCONNECTED: 'TABLET',
  PAIRED: 'TABLET',
  UNPAIRED: 'TABLET',
  PAIRING_FAILED: 'TABLET',
  EVIDENCE_EXPORTED: 'EXPORT',
  EXPORT_DENIED: 'EXPORT',
  UPDATE_AVAILABLE: 'SERVICE',
  UPDATE_STARTED: 'SERVICE',
  UPDATE_COMPLETED: 'SERVICE',
  SYSTEM_BOOT: 'SYSTEM',
};
const NETWORK_TIME_FAULT_SOURCE: Readonly<Record<string, NetworkTimeSource>> = { GNSS_LOSS: 'TIME', CAMERA_LOSS: 'POE' };

/** The network/time bucket of an event, or null when it is not a network or time event. */
export function networkTimeSource(event: Pick<SimEvent, 'type' | 'params'>): NetworkTimeSource | null {
  if (event.type === 'FAULT_RAISED' || event.type === 'FAULT_CLEARED') {
    const kind = event.params.kind;
    return typeof kind === 'string' ? (NETWORK_TIME_FAULT_SOURCE[kind] ?? null) : null;
  }
  return NETWORK_TIME_TYPE_SOURCE[event.type] ?? null;
}

/** Newest first, at most `count` network and time events (store-owned objects). */
export function selectNetworkTimeEvents(s: SimState, count = 8): SimEvent[] {
  const out: SimEvent[] = [];
  for (let index = s.events.length - 1; index >= 0 && out.length < count; index -= 1) {
    const event = s.events[index];
    if (event && networkTimeSource(event) !== null) out.push(event);
  }
  return out;
}

// ── Network domains (SIM-GAP-W50-1; design book §21.1) ───────────────────────────────────

/** An export shows as a live transfer on the Export domain for this long after its event. */
export const EXPORT_TRANSFER_WINDOW_MS = 20_000;

/** Sim time of the newest EVIDENCE_EXPORTED event, or null. */
export function lastExportAt(events: readonly SimEvent[]): EpochMs | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && event.type === 'EVIDENCE_EXPORTED') return event.at;
  }
  return null;
}

/**
 * The live state of one §21.1 domain: the camera domain follows the lenses, management the LAN
 * and the tablet link, service/update the software update, export/transfer the latest export.
 * `nowSecond` is the sim clock in whole seconds (the export window resolves at 1 Hz).
 */
export function domainState(state: SimState, id: NetworkDomain, nowSecond: number): NetworkDomainState {
  switch (id) {
    case 'CAMERA': {
      const online = state.cameras.filter((camera) => camera.online && camera.lens === 'READY').length;
      if (online === 0) return NetworkDomainState.DOWN;
      return online < state.cameras.length ? NetworkDomainState.DEGRADED : NetworkDomainState.ACTIVE;
    }
    case 'MANAGEMENT':
      if (!state.network.linkUp) return NetworkDomainState.DOWN;
      return state.tabletLink.state === 'CONNECTED' ? NetworkDomainState.ACTIVE : NetworkDomainState.DEGRADED;
    case 'SERVICE_UPDATE':
      return state.update.state === 'RUNNING' ? NetworkDomainState.UPDATING : NetworkDomainState.RESTRICTED;
    case 'EXPORT_TRANSFER': {
      const at = lastExportAt(state.events);
      return at !== null && nowSecond * 1_000 - at < EXPORT_TRANSFER_WINDOW_MS ? NetworkDomainState.TRANSFER : NetworkDomainState.ON_DEMAND;
    }
    default:
      return NetworkDomainState.RESTRICTED;
  }
}

/** Domain states keyed by ID (a flat record of primitives, shallow-stable for `useSim`). */
export function selectDomainStates(s: SimState): Record<NetworkDomain, NetworkDomainState> {
  const nowSecond = Math.floor(s.clock.now / 1_000);
  return {
    CAMERA: domainState(s, 'CAMERA', nowSecond),
    MANAGEMENT: domainState(s, 'MANAGEMENT', nowSecond),
    SERVICE_UPDATE: domainState(s, 'SERVICE_UPDATE', nowSecond),
    EXPORT_TRANSFER: domainState(s, 'EXPORT_TRANSFER', nowSecond),
  };
}

// ── A/V sync (SIM-GAP-W50-2; §22.2) ──────────────────────────────────────────────────────

export interface AvSyncView {
  state: AvSyncState;
  source: SimState['time']['source'];
  locked: boolean;
}

/**
 * HEALTHY while a disciplined, locked source stamps the tracks and every camera and microphone
 * delivers; otherwise DEGRADED (the common session timeline still holds the tracks together).
 * Derived (the book's common ADC clock is not modelled); a flat object of primitives.
 */
export function selectAvSync(s: SimState): AvSyncView {
  const tracksOk =
    s.cameras.every((camera) => camera.online && camera.lens === 'READY') && s.mics.every((mic) => mic.state !== 'NO_SIGNAL');
  const disciplined = s.time.source !== 'RTC' && s.time.locked;
  return {
    state: tracksOk && disciplined ? AvSyncState.HEALTHY : AvSyncState.DEGRADED,
    source: s.time.source,
    locked: s.time.locked,
  };
}

// ── Drive health (SIM-GAP-W49-1) ─────────────────────────────────────────────────────────

export type DriveTempLevel = 'OK' | 'WARM' | 'HOT';

/** Temperature bands per drive class (demo assumption; typical vendor limits). */
export const DRIVE_TEMP_LIMITS = {
  SYSTEM: { warm: 70, hot: 80 },
  EVIDENCE: { warm: 50, hot: 60 },
} as const;

/** Demo power-on hours at load: a unit provisioned about three months before the demo (synthetic). */
export const DRIVE_POWER_ON_HOURS_AT_LOAD = 2_184;
/** The NVMe sits on the SoC thermal zone: CPU temperature minus this, never below the HDD. */
const NVME_BELOW_CPU_C = 7;

export interface DriveHealth {
  id: StorageVolume['id'];
  kind: StorageVolume['kind'];
  smart: SmartStatus;
  temperatureC: number;
  tempLevel: DriveTempLevel;
  powerOnHours: number;
  /** NVMe only. */
  wearPercent: number | null;
  spare: number | null;
  mediaErrors: number | null;
  /** HDD only. */
  reallocatedSectors: number | null;
  pendingSectors: number | null;
}

function tempLevel(kind: StorageVolume['kind'], celsius: number): DriveTempLevel {
  const limits = DRIVE_TEMP_LIMITS[kind];
  if (celsius >= limits.hot) return 'HOT';
  if (celsius >= limits.warm) return 'WARM';
  return 'OK';
}

/** A drive's temperature: the HDD reads `storageTempC`; the NVMe tracks the SoC zone. */
export function driveTemperature(kind: StorageVolume['kind'], storageTempC: number, cpuTempC: number): number {
  return kind === 'EVIDENCE' ? storageTempC : Math.round(Math.max(storageTempC, cpuTempC - NVME_BELOW_CPU_C) * 10) / 10;
}

/**
 * Per-drive SMART summary (synthetic counters, live temperatures). SMART turns WARNING on a hot
 * drive (FAN_STALL heats it), as the drive's own temperature attribute would. Power-on hours grow
 * with the store's runtime.
 */
export function driveHealth(state: SimState, volume: StorageVolume): DriveHealth {
  const temperatureC = driveTemperature(volume.kind, state.health.storageTempC, state.health.cpuTempC);
  const level = tempLevel(volume.kind, temperatureC);
  const powerOnHours = DRIVE_POWER_ON_HOURS_AT_LOAD + Math.max(0, Math.floor((state.clock.now - state.meta.createdAt) / 3_600_000));
  const base = {
    id: volume.id,
    kind: volume.kind,
    smart: level === 'HOT' ? SmartStatus.WARNING : SmartStatus.PASSED,
    temperatureC,
    tempLevel: level,
    powerOnHours,
  };
  return volume.kind === 'SYSTEM'
    ? { ...base, wearPercent: 2, spare: 100, mediaErrors: 0, reallocatedSectors: null, pendingSectors: null }
    : { ...base, wearPercent: null, spare: null, mediaErrors: null, reallocatedSectors: 0, pendingSectors: 0 };
}

/** Health of both drives, stable while nothing it shows changed. */
export const selectDriveHealth = stableSelector(
  (s: SimState) => [s.storage.volumes, s.health.storageTempC, s.health.cpuTempC, Math.floor((s.clock.now - s.meta.createdAt) / 3_600_000)],
  (s: SimState) => s.storage.volumes.map((volume) => driveHealth(s, volume)),
);

// ── Service uptime (SIM-GAP-W52-1) ───────────────────────────────────────────────────────

/** Scope tag of a Core services restart in its DEVICE_COMMAND row. */
const RESTART_SCOPE = 'CORE_SERVICES';

/**
 * When a service's uptime starts: its `startedAt` (boot, services restart or update reboot).
 * Before step 54 a snapshot has none: the newest SYSTEM_BOOT or services-restart audit row, or
 * the oldest kept row. Null for a STOPPED service.
 */
export function serviceStartedAt(service: ServiceEntry, s: Pick<SimState, 'audit' | 'meta'>): EpochMs | null {
  if (service.status === 'STOPPED') return null;
  if (typeof service.startedAt === 'number') return service.startedAt;
  const rows: readonly AuditRow[] = s.audit.rows;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row) continue;
    if (row.type === 'SYSTEM_BOOT' || (row.type === 'DEVICE_COMMAND' && row.details.scope === RESTART_SCOPE)) return row.at;
  }
  return rows[0]?.at ?? s.meta.createdAt;
}

/** The newest start among the running services (the "services up since" line). */
export function selectServicesSince(s: SimState): EpochMs {
  let since: EpochMs | null = null;
  for (const service of s.services) {
    const at = serviceStartedAt(service, s);
    if (at !== null && (since === null || at > since)) since = at;
  }
  return since ?? s.meta.createdAt;
}

// ── Release and SBOM (SIM-GAP-W52-4; design book §24.3) ──────────────────────────────────

export interface ReleaseInfo {
  version: string;
  buildId: string;
  checksum: string;
  components: number;
  format: string;
}

/** Design book §3.3 software inventory size (research/01_explore.md Part B: 27 components). */
export const SBOM_COMPONENT_COUNT = 27;

/** Synthetic, deterministic release metadata for a version (labelled "Synthetic demo values"). */
export function releaseInfo(version: string): ReleaseInfo {
  const digest = syntheticFingerprint(`release-${version}`, 8).replaceAll(':', '').toLowerCase();
  return {
    version,
    buildId: `dems-core-${version}+${digest.slice(0, 8)}`,
    checksum: `sha256:${syntheticFingerprint(`release-checksum-${version}`, 12).replaceAll(':', '').toLowerCase()}`,
    components: SBOM_COMPONENT_COUNT,
    format: 'SPDX 2.3 (synthetic)',
  };
}

const releaseCache = new Map<string, ReleaseInfo>();
/** The running version's release metadata (stable per version). */
export function selectReleaseInfo(s: SimState): ReleaseInfo {
  const version = s.update.currentVersion;
  let info = releaseCache.get(version);
  if (!info) {
    info = releaseInfo(version);
    releaseCache.set(version, info);
  }
  return info;
}

// ── Log bundle (SIM-GAP-W52-7) ───────────────────────────────────────────────────────────

export interface LogBundle {
  schema: 'dems.log-bundle/1';
  /** Always true: the logs of a simulated Core. */
  simulated: true;
  deviceId: string;
  softwareVersion: string;
  exportedAt: EpochMs;
  exportId: string | null;
  audit: { rows: AuditRow[]; head: string; total: number; dropped: number };
  events: SimEvent[];
}

/** The JSON a log export downloads: the audit ring (with its chain head) and the event ring. */
export function logBundle(s: SimState, exportId: string | null = null): LogBundle {
  return {
    schema: 'dems.log-bundle/1',
    simulated: true,
    deviceId: s.device.id,
    softwareVersion: s.device.softwareVersion,
    exportedAt: s.clock.now,
    exportId,
    audit: { rows: s.audit.rows, head: s.audit.head, total: s.audit.total, dropped: s.audit.dropped },
    events: s.events,
  };
}

// ── Session timeline titles (E-fix FX-C, E2E-T-5) ────────────────────────────────────────

/** The i18n key of a session timeline row's title (typed, so a client's `t` accepts it). */
export type TimelineTitleKey = `session.timeline.kind.${TimelineEvent['kind']}` | `session.timeline.noteBy.${OperatorRole}`;

const NOTE_TITLE_ROLES: readonly string[] = Object.values(OperatorRole);
const isNoteTitleRole = (value: unknown): value is OperatorRole => typeof value === 'string' && NOTE_TITLE_ROLES.includes(value);

/**
 * The i18n key of a session timeline row's title. A NOTE whose item names its author's role
 * (`params.authorRole`, written by `addNoteTransition`) is titled by that role ("Supervisor Note
 * Added"); any other NOTE by the neutral kind title ("Note Added"); every other kind by
 * `session.timeline.kind.<KIND>`. A SUPERVISOR's note was titled "Investigator Note Added" on
 * the web and the tablet (E2E-T-5).
 */
export function timelineTitleKey(event: Pick<TimelineEvent, 'kind' | 'params'>): TimelineTitleKey {
  const role = event.kind === 'NOTE' ? event.params?.authorRole : undefined;
  if (isNoteTitleRole(role)) return `session.timeline.noteBy.${role}`;
  return `session.timeline.kind.${event.kind}`;
}
