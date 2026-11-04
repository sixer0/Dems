/**
 * Local simulator adapters for the mobile Devices & Inputs screens (P6: screen steps never write
 * `packages/shared/src/sim/**`; each gap is logged as SIM-GAP-M84-<n> for the simulator owners,
 * steps 54 and 91, in implementation/56_mobile_devices.md). Everything here is a pure read of
 * `SimState`; nothing is written back to the simulator. The web page (step 48) carries the same
 * gaps as SIM-GAP-W48-1 and W48-4; the numbers below follow its formulas so phone, tablet and web
 * agree.
 *
 * - **SIM-GAP-M84-1: PoE model (= W48-1, D79).** The simulator still models a 4-port switch
 *   ("4/4 Ports Active", from mockup MB 7) with lens 2 on `POE_CAM_2_AUX`. The design book has one
 *   dual-lens camera on **PoE CAM 1** and **PoE CAM 2/AUX as the spare** (§4.2, §8), so 2 ports.
 *   `bookPoe()` presents that view: PoE CAM 1 is up while either lens streams; the spare has no load.
 * - **SIM-GAP-M84-2: no per-device health history (= W48-4).** `healthSeries()` derives each
 *   device's 1 Hz line from the simulator's own 1 Hz `network.bandwidth.history` plus the current
 *   fault state. Microphone levels have no history in the simulator (the audio slice holds one
 *   frame), so `MicLevelSampler` keeps the 1 s peak of a channel from the moment the detail opens.
 * - **SIM-GAP-M84-3** (text corrected by the contract close-out W83, finding F78-3): `deviceCommand`
 *   now checks its permission itself, DEVICE_MANAGE for Restart and DIAGNOSTICS_RUN for Test signal
 *   and Identify (`packages/shared/src/sim/maintenance.ts:204-207`). The screens gate Restart on
 *   DEVICE_MANAGE (TECHNICIAN) and disable it while recording (D79); Test signal stays open to
 *   every role (every seeded role holds DIAGNOSTICS_RUN), as on the web page.
 */
import { SessionState, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain';
import { channelOfMicLine, FaultKind, type AudioFrame, type AuditRow, type BandwidthPoint, type EpochMs, type RoleMicLine, type SimState } from '@dems/shared/sim';
import { DEVICE_CAMERA, isDeviceId, type DeviceId } from './device-ids';

// ── SIM-GAP-M84-1: PoE, book view ────────────────────────────────────────────────────────
/** Book §8: every camera PoE port runs "up to a 30 W budget"; PoE CAM 2/AUX is the spare. */
export const POE_PORT_BUDGET_W = 30;

export interface BookPoe {
  /** PoE CAM 1 carries power and data while at least one of its two lenses streams. */
  readonly cam1Link: boolean;
  /** D60 (2026-11-04): the two further camera ports, each carrying its own track. */
  readonly cam3Link: boolean;
  readonly cam4Link: boolean;
  /** Ports delivering power, spare ports and the total (the Core's own switch facts since D60). */
  readonly active: number;
  readonly spare: number;
  readonly total: number;
  readonly budgetW: number;
  readonly drawW: number;
}

export function bookPoe(state: Pick<SimState, 'cameras' | 'network'>): BookPoe {
  const online = (trackId: VideoTrackId) => state.cameras.some((camera) => camera.id === trackId && camera.online);
  const cam1Link = online('VIDEO-01') || online('VIDEO-02');
  // D60 (2026-11-04): four camera tracks — CAM 3 and CAM 4 feed their own ports; the counts come from the switch.
  const cam3Link = online('VIDEO-03');
  const cam4Link = online('VIDEO-04');
  const poe = state.network.poe;
  return {
    cam1Link,
    cam3Link,
    cam4Link,
    active: poe.poweredPorts ?? (cam1Link ? 1 : 0),
    spare: poe.sparePorts ?? 1,
    total: poe.totalPorts,
    budgetW: poe.budgetW,
    drawW: cam1Link || cam3Link || cam4Link ? poe.drawW : 0,
  };
}

/** D60 (2026-11-04): CAM-01/02 share PoE CAM 1 (dual-lens, book B.01); CAM-03 and CAM-04 hold their own port. */
export function cameraPoePortKey(deviceId: DeviceId): string {
  return deviceId === 'CAM-03' ? 'devices.ports.poeCam3' : deviceId === 'CAM-04' ? 'devices.ports.poeCam4' : 'devices.ports.poeCam1';
}

// ── SIM-GAP-M84-2: health series ─────────────────────────────────────────────────────────
/** Points shown on a device's health line (one per simulator second). */
export const HEALTH_POINTS = 60;

export type HealthMetric = 'linkQuality' | 'signal' | 'poeDraw' | 'relay';

export const HEALTH_METRIC: Readonly<Record<DeviceId, HealthMetric>> = {
  'CAM-01': 'linkQuality',
  'CAM-02': 'linkQuality',
  'CAM-03': 'linkQuality', // D60 (2026-11-04): four cameras
  'CAM-04': 'linkQuality', // D60
  'MIC-01': 'signal',
  'MIC-02': 'signal',
  'MIC-03': 'signal', // D61 (2026-11-04): four microphone channels
  'MIC-04': 'signal', // D61
  'POE-SWITCH': 'poeDraw',
  'REC-INDICATOR': 'relay',
  TABLET: 'linkQuality',
};

/** `t` is the epoch ms of the sample (sim clock), `v` the value. */
export interface HealthPoint {
  readonly t: EpochMs;
  readonly v: number;
}

export interface HealthSeries {
  readonly metric: HealthMetric;
  readonly points: readonly HealthPoint[];
  readonly domain: readonly [number, number];
}

/** The flat inputs of a health line (each a store-owned value, so `useSim` can select them as is). */
export interface SeriesInput {
  readonly history: readonly BandwidthPoint[];
  readonly poeDrawW: number;
  readonly cameras: SimState['cameras'];
  readonly faults: SimState['faults'];
  readonly tabletLink: SimState['tabletLink'];
  readonly session: SimState['session'];
}

export function seriesInputOf(state: SimState): SeriesInput {
  return {
    history: state.network.bandwidth.history,
    poeDrawW: state.network.poe.drawW,
    cameras: state.cameras,
    faults: state.faults,
    tabletLink: state.tabletLink,
    session: state.session,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** When the newest active fault of `kind` on `target` started, or null. */
function faultSince(state: Pick<SimState, 'faults'>, kind: FaultKind, target: string | null): EpochMs | null {
  let since: EpochMs | null = null;
  for (const fault of state.faults.active) {
    if (fault.kind === kind && fault.target === target) since = since === null ? fault.since : Math.max(since, fault.since);
  }
  return since;
}

/** The device's 1 Hz health line (mic lines come from `MicLevelSampler`, passed in). */
export function healthSeries(state: SeriesInput, deviceId: DeviceId, micPoints: readonly HealthPoint[] = []): HealthSeries {
  const metric = HEALTH_METRIC[deviceId];
  const base = state.history.slice(-HEALTH_POINTS);
  switch (metric) {
    case 'linkQuality': {
      if (deviceId === 'TABLET') {
        const offlineSince = state.tabletLink.state === 'OFFLINE' ? state.tabletLink.changedAt : null;
        return {
          metric,
          domain: [90, 100],
          points: base.map((p) => ({
            t: p.at,
            v: offlineSince !== null && p.at >= offlineSince ? 0 : round1(clamp(99.3 + (p.upMbps - 3.1) * 0.9, 96.5, 100)),
          })),
        };
      }
      const trackId: VideoTrackId = DEVICE_CAMERA[deviceId] ?? 'VIDEO-01';
      const camera = state.cameras.find((entry) => entry.id === trackId);
      const lostNow = camera ? !camera.online : false;
      const lostSince = faultSince(state, FaultKind.CAMERA_LOSS, trackId);
      const phase = trackId === 'VIDEO-02' ? -0.35 : 0.2;
      return {
        metric,
        domain: [90, 100],
        points: base.map((p) => {
          const lost = lostNow && (lostSince === null || p.at >= lostSince);
          const typical = p.downMbps > 17 ? 21.5 : 12.4;
          return { t: p.at, v: lost ? 0 : round1(clamp(99.4 + (p.downMbps - typical) * 0.28 + phase, 97, 100)) };
        }),
      };
    }
    case 'signal':
      return { metric, domain: [-90, 0], points: micPoints.slice(-HEALTH_POINTS) };
    case 'poeDraw': {
      const allLost = state.cameras.every((camera) => !camera.online);
      const lostSince = allLost
        ? Math.max(0, ...state.faults.active.filter((f) => f.kind === FaultKind.CAMERA_LOSS).map((f) => f.since))
        : null;
      return {
        metric,
        domain: [0, POE_PORT_BUDGET_W],
        points: base.map((p) => ({ t: p.at, v: lostSince !== null && p.at >= lostSince ? 0 : state.poeDrawW })),
      };
    }
    case 'relay': {
      const session = state.session;
      const since = session?.state === SessionState.RECORDING ? session.startedAt : null;
      return { metric, domain: [0, 1], points: base.map((p) => ({ t: p.at, v: since !== null && p.at >= since ? 1 : 0 })) };
    }
  }
}

/**
 * 1 s peak sampler for one microphone channel (SIM-GAP-M84-2). Feed it every audio frame; it closes
 * one point per SIMULATOR second (the frame's own `at`, D73 F74-09: no wall-clock timer) and keeps
 * `HEALTH_POINTS` points. Returns true when a point closed, so the caller renders at most at 1 Hz.
 */
export class MicLevelSampler {
  private list: HealthPoint[] = [];
  private open: { second: number; peak: number } | null = null;

  push(frame: Pick<AudioFrame, 'at' | 'dbfs' | 'noSignal'>): boolean {
    const second = Math.floor(frame.at / 1000);
    const level = frame.noSignal ? -90 : frame.dbfs;
    const current = this.open;
    if (current && current.second === second) {
      current.peak = Math.max(current.peak, level);
      return false;
    }
    this.open = { second, peak: level };
    if (!current || second < current.second) return false;
    this.list = [...this.list, { t: current.second * 1000, v: round1(current.peak) }].slice(-HEALTH_POINTS);
    return true;
  }

  points(): readonly HealthPoint[] {
    return this.list;
  }
}

// ── Device log ───────────────────────────────────────────────────────────────────────────
const FAULT_DEVICE: Partial<Record<string, (target: string | null) => DeviceId | null>> = {
  // D60 (2026-11-04): four camera tracks — VIDEO-0n faults name CAM-0n.
  [FaultKind.CAMERA_LOSS]: (target) => (/^VIDEO-0[1-4]$/.test(target ?? '') ? (`CAM-${(target as string).slice(-2)}` as DeviceId) : null),
  [FaultKind.MIC_NO_SIGNAL]: (target) => micDevice(target),
  [FaultKind.MIC_CLIP]: (target) => micDevice(target),
};

// D61 (2026-11-04): any of the four meter channels names its built-in microphone.
function micDevice(target: string | null): DeviceId | null {
  if (target === 'AUDIO-01') return 'MIC-01';
  if (target === 'AUDIO-02') return 'MIC-02';
  if (target === 'AUDIO-03') return 'MIC-03';
  if (target === 'AUDIO-04') return 'MIC-04';
  return null;
}

/** The device an audit row belongs to (recording start/stop → the lamp relay; faults → their target). */
export function auditRowDevice(row: Pick<AuditRow, 'deviceId' | 'type' | 'details'>): DeviceId | null {
  if (row.type === 'RECORDING_STARTED' || row.type === 'RECORDING_STOPPED') return 'REC-INDICATOR';
  const kind = typeof row.details.kind === 'string' ? row.details.kind : null;
  const mapFault = kind ? FAULT_DEVICE[kind] : undefined;
  if (mapFault) {
    const target = typeof row.details.target === 'string' ? row.details.target : typeof row.details.channel === 'string' ? row.details.channel : null;
    const device = mapFault(target);
    if (device) return device;
  }
  return isDeviceId(row.deviceId) ? row.deviceId : null;
}

/** Newest first, at most `limit` rows; store-owned row references (flat for `useSim`). */
export function deviceLog(rows: readonly AuditRow[], deviceId: DeviceId, limit = 20): AuditRow[] {
  const out: AuditRow[] = [];
  for (let index = rows.length - 1; index >= 0 && out.length < limit; index -= 1) {
    const row = rows[index];
    if (row && auditRowDevice(row) === deviceId) out.push(row);
  }
  return out;
}

/**
 * Microphone channel of a mic device: the position of its line in the capture configuration
 * (`captureMicLines(state)`, input order; ruling D137, integration pass D5, kept by C21 (7)) - for a
 * COMPLETE pair. A device that is neither line has no meter channel, and neither has any device
 * while the selector holds no complete pair (no line, a lone line): `null`.
 *
 * Task 4 row 171 (site M6; row 164's request): the lines STATE their role (`RoleMicLine`) and there is
 * no default list - "without lines, the built-in pair" is gone. The caller hands `micLinesInForce(state)`.
 */
export function channelOf(deviceId: DeviceId, mics: readonly RoleMicLine[]): AudioTrackId | null {
  return channelOfMicLine(mics, deviceId);
}
