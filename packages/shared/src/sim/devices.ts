/**
 * Device views (step 54; SIM-GAP-W48-1..4): the PoE model of the design book, the platform
 * devices (GNSS receiver, TPM / Secure Element, front panel), the front-panel LEDs and LCD, and
 * per-device health series. Pure reads over `SimState`; every selector is referentially stable
 * (review 40 M1), so `useSim(selector)` is safe.
 *
 * The book leaves the LED colours and blink patterns open (01_explore §3 A.34 "[Gap]"): the
 * mapping below is a demo assumption, moved here unchanged from step 48's page adapter.
 */
import { SessionState, type AudioTrackId, type VideoTrackId } from '../domain';
import { stableSelector, stableSelectorBy } from './memo';
import { storageSummary } from './selectors';
import type { EpochMs, MicLevelPoint, SimState } from './types';
import { FaultKind, FrontPanelLedId, type FrontPanelLedState } from './vocabulary';

// ── PoE (design book §4.2/§8; D79) ───────────────────────────────────────────────────────

export interface PoeStatus {
  /** PoE CAM 1 carries power and data while at least one lens streams. */
  cam1Link: boolean;
  /** Ports delivering power (0 or 1). */
  poweredPorts: number;
  /** Spare ports (PoE CAM 2/AUX: 0 W normal, reserve up to 30 W). */
  sparePorts: number;
  /** Healthy ports (powered or spare-ready); `healthyPorts < totalPorts` means degraded. */
  healthyPorts: number;
  totalPorts: number;
  budgetW: number;
  drawW: number;
  /** Per-port budget (book §8: up to 30 W). */
  portBudgetW: number;
}

/** Book §8: PoE CAM 1 "up to a 30 W budget"; PoE port 2 "0 W normal / reserve up to 30 W". */
export const POE_PORT_BUDGET_W = 30;

export function poeStatus(state: Pick<SimState, 'network' | 'cameras'>): PoeStatus {
  const poe = state.network.poe;
  const cam1Link = state.cameras.some((camera) => camera.online);
  const poweredPorts = poe.poweredPorts ?? (cam1Link ? 1 : 0);
  const sparePorts = poe.sparePorts ?? 1;
  return {
    cam1Link,
    poweredPorts,
    sparePorts,
    healthyPorts: poe.activePorts,
    totalPorts: poe.totalPorts,
    budgetW: poe.budgetW,
    drawW: poe.drawW,
    portBudgetW: POE_PORT_BUDGET_W,
  };
}
export const selectPoeStatus = stableSelector((s: SimState) => [s.network.poe, s.cameras], poeStatus);

// ── Platform devices (SIM-GAP-W48-2) ─────────────────────────────────────────────────────

export type PlatformDeviceId = 'GNSS' | 'TPM' | 'FRONT-PANEL';

/** EN names of the derived platform devices (the UI takes copy from its own labels). */
export const PLATFORM_DEVICE_NAMES: Readonly<Record<string, string>> = {
  GNSS: 'GNSS Receiver',
  TPM: 'TPM 2.0 / Secure Element',
  'FRONT-PANEL': 'Front Panel (LCD and LEDs)',
};

export interface PlatformDevice {
  id: PlatformDeviceId;
  name: string;
  online: boolean;
  /** Machine-readable status: LOCKED / NO_FIX, OK / FAILED / NOT_REPORTED (a Core that reads no TPM), ON / POWER_FAIL. */
  status: string;
  /** GNSS satellites in view (GNSS only). */
  satellites: number | null;
}

/**
 * The GNSS receiver and the TPM / Secure Element as devices (BOM A.22–A.24, A.27), from the `time`
 * and `security` slices, plus the front panel. They accept the IDENTIFY command only.
 */
/** `status` of a platform device the Core does not read (fix wave J): read it before `online`. */
export const PLATFORM_DEVICE_NOT_REPORTED = 'NOT_REPORTED';

export function platformDevices(state: Pick<SimState, 'time' | 'security' | 'faults'>): PlatformDevice[] {
  const powerFail = state.faults.active.some((fault) => fault.kind === FaultKind.POWER_FAIL);
  return [
    {
      id: 'GNSS',
      name: PLATFORM_DEVICE_NAMES.GNSS ?? 'GNSS',
      online: state.time.gnss.locked,
      status: state.time.gnss.locked ? 'LOCKED' : 'NO_FIX',
      satellites: state.time.gnss.satellites,
    },
    // Fix wave J (truth rule 3c; one of the three readers wave I left): a Core that reads no TPM says so - never OK.
    state.security.platformNotReported === true
      ? { id: 'TPM', name: PLATFORM_DEVICE_NAMES.TPM ?? 'TPM', online: false, status: PLATFORM_DEVICE_NOT_REPORTED, satellites: null }
      : {
          id: 'TPM',
          name: PLATFORM_DEVICE_NAMES.TPM ?? 'TPM',
          online: state.security.tpm.ok,
          status: state.security.tpm.ok ? 'OK' : 'FAILED',
          satellites: null,
        },
    {
      id: 'FRONT-PANEL',
      name: PLATFORM_DEVICE_NAMES['FRONT-PANEL'] ?? 'Front panel',
      online: !powerFail,
      status: powerFail ? 'POWER_FAIL' : 'ON',
      satellites: null,
    },
  ];
}
export const selectPlatformDevices = stableSelector((s: SimState) => [s.time.gnss, s.security.tpm, s.security.platformNotReported, s.faults], platformDevices);

// ── Front panel (SIM-GAP-W48-3) ──────────────────────────────────────────────────────────

export const LED_IDS = [
  FrontPanelLedId.POWER,
  FrontPanelLedId.RECORD,
  FrontPanelLedId.NETWORK,
  FrontPanelLedId.STORAGE,
  FrontPanelLedId.FAULT,
] as const;
export type FrontPanelLeds = Record<FrontPanelLedId, FrontPanelLedState>;

/** Escalation rank of an LED state (only a rise pulses). */
export const LED_RANK: Record<FrontPanelLedState, number> = { off: 0, on: 0, activity: 0, rec: 1, warn: 2, fault: 3 };

type LedInput = Pick<SimState, 'session' | 'faults' | 'network' | 'tabletLink' | 'storage' | 'alerts'>;

/** The five LEDs (book §4.2: POWER, RECORD, NETWORK, STORAGE, FAULT). */
export function frontPanelLeds(state: LedInput): FrontPanelLeds {
  const sessionState = state.session?.state ?? null;
  const active = state.alerts.filter((alert) => alert.active);
  const critical = active.some((alert) => alert.severity === 'CRITICAL') || sessionState === SessionState.FAULT;
  const warning = active.some((alert) => alert.severity === 'WARNING');
  let record: FrontPanelLedState = 'off';
  if (sessionState === SessionState.RECORDING) record = 'rec';
  else if (sessionState === SessionState.FAULT) record = 'fault';
  else if (sessionState === SessionState.STOPPING || sessionState === SessionState.FINALIZING) record = 'warn';
  let network: FrontPanelLedState = 'off';
  if (state.network.linkUp) network = state.tabletLink.state === 'CONNECTED' ? 'activity' : 'warn';
  const powerFail = state.faults.active.some((fault) => fault.kind === FaultKind.POWER_FAIL);
  return {
    POWER: powerFail ? 'warn' : 'on',
    RECORD: record,
    NETWORK: network,
    STORAGE: state.storage.state === 'FULL' ? 'fault' : state.storage.state === 'LOW' ? 'warn' : 'on',
    FAULT: critical ? 'fault' : warning ? 'warn' : 'off',
  };
}

/** What the 800×480 LCD shows (primitives; the page lays them out). */
export interface FrontPanelLcd {
  mode: 'IDLE' | 'RECORDING' | 'FINALIZING' | 'FAULT' | 'RECOVERY' | 'POWER_FAIL';
  sessionId: string | null;
  /** Recording start on the sim clock (the LCD timer), or null. */
  startedAt: EpochMs | null;
  camsOk: number;
  camsTotal: number;
  micsOk: number;
  micsTotal: number;
  timeSource: SimState['time']['source'];
  storageUsedPercent: number;
  storageState: SimState['storage']['state'];
  tablet: SimState['tabletLink']['state'];
}

export interface FrontPanel {
  leds: FrontPanelLeds;
  lcd: FrontPanelLcd;
}

export function frontPanel(state: SimState): FrontPanel {
  const session = state.session;
  const powerFail = state.faults.active.some((fault) => fault.kind === FaultKind.POWER_FAIL);
  let mode: FrontPanelLcd['mode'] = 'IDLE';
  if (powerFail) mode = 'POWER_FAIL';
  else if (session?.state === SessionState.RECORDING) mode = 'RECORDING';
  else if (session?.state === SessionState.STOPPING || session?.state === SessionState.FINALIZING) mode = 'FINALIZING';
  else if (session?.state === SessionState.FAULT) mode = 'FAULT';
  else if (session?.state === SessionState.RECOVERY) mode = 'RECOVERY';
  return {
    leds: frontPanelLeds(state),
    lcd: {
      mode,
      sessionId: session && session.state !== SessionState.SEALED ? session.id : null,
      startedAt: session?.state === SessionState.RECORDING ? session.startedAt : null,
      camsOk: state.cameras.filter((camera) => camera.online && camera.lens === 'READY').length,
      camsTotal: state.cameras.length,
      micsOk: state.mics.filter((mic) => mic.state === 'READY' && !mic.clipLatched).length,
      micsTotal: state.mics.length,
      timeSource: state.time.source,
      storageUsedPercent: storageSummary(state).usedPercent,
      storageState: state.storage.state,
      tablet: state.tabletLink.state,
    },
  };
}
/** The front panel (LEDs and LCD), stable while nothing it shows changed. */
export const selectFrontPanel = stableSelector(
  (s: SimState) => [s.session, s.faults, s.network, s.tabletLink, s.storage, s.alerts, s.cameras, s.mics, s.time.source],
  frontPanel,
);

// ── Per-device health series (SIM-GAP-W48-4) ─────────────────────────────────────────────

export type DeviceHealthMetric = 'linkQuality' | 'signal' | 'poeDraw' | 'relay' | 'offset' | 'attestation' | 'temperature';

export interface DeviceHealthPoint {
  /** Simulator time, epoch ms. */
  t: EpochMs;
  v: number;
}

export interface DeviceHealthSeries {
  metric: DeviceHealthMetric;
  points: DeviceHealthPoint[];
  /** Chart domain (fixed per metric, so the line does not rescale every second). */
  domain: [number, number];
  /** Unit suffix key in `common.units` for the "Now" readout. */
  unit: 'percent' | 'dbfs' | 'watt' | 'ms' | 'celsius' | 'none';
}

/** The device each health chart belongs to (sim device IDs plus the platform devices). */
export const DEVICE_HEALTH_METRIC: Readonly<Record<string, DeviceHealthMetric>> = {
  'CAM-01': 'linkQuality',
  'CAM-02': 'linkQuality',
  'MIC-01': 'signal',
  'MIC-02': 'signal',
  'POE-SWITCH': 'poeDraw',
  'REC-INDICATOR': 'relay',
  TABLET: 'linkQuality',
  GNSS: 'offset',
  TPM: 'attestation',
  'FRONT-PANEL': 'temperature',
};

/** At most this many points per chart (the simulator series hold 120). */
export const DEVICE_HEALTH_POINTS = 90;

// D60 (2026-11-04): the two further built-in cameras carry their own track's health chart.
const CAMERA_OF: Readonly<Record<string, VideoTrackId>> = { 'CAM-01': 'VIDEO-01', 'CAM-02': 'VIDEO-02', 'CAM-03': 'VIDEO-03', 'CAM-04': 'VIDEO-04' };
const MIC_OF: Readonly<Record<string, AudioTrackId>> = { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02' };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function faultSince(state: Pick<SimState, 'faults'>, kind: FaultKind, target?: string): EpochMs | null {
  const fault = state.faults.active.find((entry) => entry.kind === kind && (target === undefined || entry.target === target));
  return fault ? fault.since : null;
}

type SeriesInput = Pick<
  SimState,
  'cameras' | 'network' | 'time' | 'health' | 'faults' | 'tabletLink' | 'security' | 'session' | 'clock'
>;

const EMPTY_MIC_LEVELS: MicLevelPoint[] = [];

/**
 * The device's health chart, from simulator series (no invented history):
 * - camera lens: link quality from the camera-domain stream jitter (`bandwidth.history`), 0 from the
 *   moment its CAMERA_LOSS began; tablet: from the management upstream, 0 while OFFLINE;
 * - PoE switch: the draw (W), 0 while the camera is lost; recording indicator: 1 while recording;
 * - GNSS: `time.history` offsets plus the live offset; TPM: 100 %, 0 from TPM_FAILURE;
 * - front panel: CPU temperature; microphones: the 1 Hz `health.micLevels` peaks.
 * `micPoints` overrides the microphone series (a page that samples the 20 Hz frames itself).
 */
export function deviceHealthSeries(
  state: SeriesInput,
  deviceId: string,
  micPoints?: readonly DeviceHealthPoint[],
): DeviceHealthSeries {
  const metric = DEVICE_HEALTH_METRIC[deviceId] ?? 'linkQuality';
  const base = state.network.bandwidth.history.slice(-DEVICE_HEALTH_POINTS);
  switch (metric) {
    case 'linkQuality': {
      if (deviceId === 'TABLET') {
        const offlineSince = state.tabletLink.state === 'OFFLINE' ? state.tabletLink.changedAt : null;
        const points = base.map((p) => ({
          t: p.at,
          v: offlineSince !== null && p.at >= offlineSince ? 0 : round1(clamp(99.3 + (p.upMbps - 3.1) * 0.9, 96.5, 100)),
        }));
        return { metric, points, domain: [90, 100], unit: 'percent' };
      }
      const trackId = CAMERA_OF[deviceId] ?? 'VIDEO-01';
      const lostSince = faultSince(state, FaultKind.CAMERA_LOSS, trackId);
      const camera = state.cameras.find((entry) => entry.id === trackId);
      const lostNow = camera ? !camera.online : false;
      const points = base.map((p) => {
        const lost = lostNow && (lostSince === null || p.at >= lostSince);
        const typical = p.downMbps > 17 ? 21.5 : 12.4;
        const phase = trackId === 'VIDEO-02' ? -0.35 : 0.2;
        return { t: p.at, v: lost ? 0 : round1(clamp(99.4 + (p.downMbps - typical) * 0.28 + phase, 97, 100)) };
      });
      return { metric, points, domain: [90, 100], unit: 'percent' };
    }
    case 'signal': {
      const channel = MIC_OF[deviceId] ?? 'AUDIO-01';
      const points =
        micPoints && micPoints.length > 0
          ? micPoints.slice(-DEVICE_HEALTH_POINTS)
          : (state.health.micLevels ?? EMPTY_MIC_LEVELS).slice(-DEVICE_HEALTH_POINTS).map((p) => ({ t: p.at, v: p[channel] }));
      return { metric, points, domain: [-90, 0], unit: 'dbfs' };
    }
    case 'poeDraw': {
      const lostSince = state.cameras.every((camera) => !camera.online)
        ? Math.max(...state.faults.active.filter((f) => f.kind === FaultKind.CAMERA_LOSS).map((f) => f.since), 0)
        : null;
      const points = base.map((p) => ({ t: p.at, v: lostSince !== null && p.at >= lostSince ? 0 : state.network.poe.drawW }));
      return { metric, points, domain: [0, POE_PORT_BUDGET_W], unit: 'watt' };
    }
    case 'relay': {
      const session = state.session;
      const since = session?.state === SessionState.RECORDING ? session.startedAt : null;
      const points = base.map((p) => ({ t: p.at, v: since !== null && p.at >= since ? 1 : 0 }));
      return { metric, points, domain: [0, 1], unit: 'none' };
    }
    case 'offset': {
      const history = state.time.history.slice(-DEVICE_HEALTH_POINTS + 1).map((p) => ({ t: p.at, v: p.offsetMs }));
      const last = history.at(-1);
      if (!last || last.t < state.clock.now - 1_000) history.push({ t: state.clock.now, v: state.time.offsetMs });
      const span = Math.max(12, ...history.map((p) => Math.ceil(Math.abs(p.v))));
      return { metric, points: history, domain: [-span, span], unit: 'ms' };
    }
    case 'attestation': {
      const failedSince = state.security.tpm.ok ? null : (faultSince(state, FaultKind.TPM_FAILURE) ?? 0);
      const points = base.map((p) => ({ t: p.at, v: failedSince !== null && p.at >= failedSince ? 0 : 100 }));
      return { metric, points, domain: [0, 100], unit: 'percent' };
    }
    case 'temperature': {
      const points = state.health.series.slice(-DEVICE_HEALTH_POINTS).map((p) => ({ t: p.at, v: p.cpuTempC }));
      return { metric, points, domain: [30, 90], unit: 'celsius' };
    }
  }
}

/** `deviceHealthSeries` as a stable selector, one cache entry per device. */
export const selectDeviceHealthSeries = stableSelectorBy(
  (s: SimState, deviceId: string) => [
    s.network.bandwidth.history,
    s.time.history,
    s.health.series,
    s.health.micLevels,
    s.faults,
    s.cameras,
    s.tabletLink,
    s.security.tpm,
    s.session?.state,
    deviceId === 'GNSS' ? Math.floor(s.clock.now / 1_000) : 0,
  ],
  (s: SimState, deviceId: string) => deviceHealthSeries(s, deviceId),
);
