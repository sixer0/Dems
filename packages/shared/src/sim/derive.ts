/**
 * Derived device state (step 32; masterplan/01_specs.md §14.7 `faults.ts`, `health.ts`).
 *
 * Every field that follows from "which faults are active" and "is a session recording" is
 * recomputed here, in one pure function, after each fault change and session transition:
 * camera and microphone states, track REC states, the recording indicator, PoE and port
 * links, the time-source tier, the security posture and controls, the 17 services, and the
 * storage fill that the storage faults force.
 *
 * Continuous values (CPU, temperatures, fan speed, time offset, bandwidth, bytes written)
 * belong to the 1 Hz health subsystem (`health.ts`), not here.
 *
 * Unchanged objects keep their identity, so `useSim(selector)` consumers do not re-render.
 */
import { SessionState, type AudioTrackId, type VideoTrackId } from '../domain';
import { STORAGE_FULL_FILL_PERCENT, STORAGE_LOW_FILL_PERCENT } from './constants';
import { storageStateFor } from './selectors';
import type {
  CameraStatus,
  FaultsSlice,
  MicStatus,
  OtherDevice,
  PortStatus,
  SecurityControl,
  ServiceEntry,
  SimState,
  StorageSlice,
  TimeSlice,
} from './types';
import { FaultKind, SecurityPosture, type ServiceStatus } from './vocabulary';

type ActiveFault = FaultsSlice['active'][number];

/** Target key of an evidence-media tamper (TAMPER with an evidence target). */
export const EVIDENCE_TAMPER_PREFIX = 'evidence:';

/** GNSS satellites in view while locked (the dataset value). */
export const GNSS_SATELLITES_LOCKED = 11;

/** Shallow patch that keeps the original object when nothing changes. */
export function patchIfChanged<T extends object>(value: T, changes: Partial<T>): T {
  for (const key of Object.keys(changes) as (keyof T)[]) {
    if (!Object.is(value[key], changes[key])) return { ...value, ...changes };
  }
  return value;
}

/** Maps a list and keeps the original array when every element is unchanged. */
export function mapIfChanged<T>(items: readonly T[], map: (item: T) => T): T[] {
  let changed = false;
  const next = items.map((item) => {
    const mapped = map(item);
    if (mapped !== item) changed = true;
    return mapped;
  });
  return changed ? next : (items as T[]);
}

/**
 * Whether a fault is active. `target` undefined: on any target. `reason` (ruling D146; the fault
 * key is (kind, reason, target)): undefined - whatever its cause; null - the fault WITHOUT a
 * cause; a code - the fault of that cause.
 */
export function isFaultActive(
  faults: FaultsSlice,
  kind: FaultKind,
  target?: string | null,
  reason?: string | null,
): boolean {
  return faults.active.some(
    (fault) => fault.kind === kind && (target === undefined || fault.target === target) && (reason === undefined || (fault.reason ?? null) === reason),
  );
}

function targetsOf(active: readonly ActiveFault[], kind: FaultKind): Set<string | null> {
  return new Set(active.filter((fault) => fault.kind === kind).map((fault) => fault.target));
}

/** The enclosure TAMPER switch (EVT-12), as opposed to the evidence-media tamper hook. */
export function isEnclosureTamper(fault: ActiveFault): boolean {
  return fault.kind === FaultKind.TAMPER && !(fault.target ?? '').startsWith(EVIDENCE_TAMPER_PREFIX);
}

const SERVICE_EFFECTS: Partial<Record<FaultKind, { service: string; status: ServiceStatus }[]>> = {
  CAMERA_LOSS: [{ service: 'Video Management Service', status: 'DEGRADED' }],
  MIC_NO_SIGNAL: [{ service: 'Audio Capture Service', status: 'DEGRADED' }],
  MIC_CLIP: [{ service: 'Audio Capture Service', status: 'DEGRADED' }],
  STORAGE_LOW: [{ service: 'Storage Manager', status: 'DEGRADED' }],
  STORAGE_FULL: [
    { service: 'Storage Manager', status: 'DEGRADED' },
    { service: 'Recording Engine', status: 'DEGRADED' },
  ],
  GNSS_LOSS: [{ service: 'Time Service', status: 'DEGRADED' }],
  TAMPER: [{ service: 'Security Manager', status: 'DEGRADED' }],
  FAN_STALL: [{ service: 'Health Monitor', status: 'DEGRADED' }],
  POWER_FAIL: [{ service: 'Recording Engine', status: 'STOPPED' }],
  TPM_FAILURE: [{ service: 'Security Manager', status: 'DEGRADED' }],
  SECURITY_FAULT: [{ service: 'Security Manager', status: 'DEGRADED' }],
  AUDIT_TAMPER: [{ service: 'Audit Service', status: 'DEGRADED' }],
};

const SERVICE_RANK = { RUNNING: 0, DEGRADED: 1, STOPPED: 2 } as const satisfies Record<ServiceStatus, number>;

function deriveServices(services: ServiceEntry[], active: readonly ActiveFault[]): ServiceEntry[] {
  const worst = new Map<string, ServiceStatus>();
  for (const fault of active) {
    const effects =
      fault.kind === FaultKind.TAMPER && !isEnclosureTamper(fault)
        ? [{ service: 'Evidence Manager', status: 'DEGRADED' as ServiceStatus }]
        : (SERVICE_EFFECTS[fault.kind] ?? []);
    for (const effect of effects) {
      const current = worst.get(effect.service) ?? 'RUNNING';
      if (SERVICE_RANK[effect.status] > SERVICE_RANK[current]) worst.set(effect.service, effect.status);
    }
  }
  return mapIfChanged(services, (entry) => patchIfChanged(entry, { status: worst.get(entry.name) ?? 'RUNNING' }));
}

function deriveStorage(storage: StorageSlice, active: readonly ActiveFault[]): StorageSlice {
  const fillPercent = active.some((f) => f.kind === FaultKind.STORAGE_FULL)
    ? STORAGE_FULL_FILL_PERCENT
    : active.some((f) => f.kind === FaultKind.STORAGE_LOW)
      ? STORAGE_LOW_FILL_PERCENT
      : 0;
  const previousFill = storage.simulatedFillBytes ?? 0;
  let simulatedFillBytes = previousFill;
  const volumes = mapIfChanged(storage.volumes, (volume) => {
    if (volume.kind !== 'EVIDENCE') return volume;
    const natural = volume.usedBytes - previousFill;
    const fill = fillPercent > 0 ? Math.max(0, Math.round((volume.totalBytes * fillPercent) / 100) - natural) : 0;
    simulatedFillBytes = fill;
    return patchIfChanged(volume, { usedBytes: natural + fill });
  });
  const evidence = volumes.find((volume) => volume.kind === 'EVIDENCE');
  const state = evidence && evidence.totalBytes > 0
    ? storageStateFor((evidence.usedBytes / evidence.totalBytes) * 100)
    : storage.state;
  return patchIfChanged(storage, { volumes, state, simulatedFillBytes });
}

function deriveTime(time: TimeSlice, active: readonly ActiveFault[]): TimeSlice {
  const gnssLoss = active.find((fault) => fault.kind === FaultKind.GNSS_LOSS);
  if (!gnssLoss) {
    return patchIfChanged(time, {
      source: 'GNSS',
      locked: true,
      stratum: 1,
      gnss: time.gnss.locked ? time.gnss : { locked: true, satellites: GNSS_SATELLITES_LOCKED },
      ntp: time.ntp.reachable ? time.ntp : { ...time.ntp, reachable: true },
    });
  }
  const gnss = time.gnss.locked || time.gnss.satellites > 0 ? { locked: false, satellites: 0 } : time.gnss;
  if (gnssLoss.target === 'RTC') {
    return patchIfChanged(time, {
      source: 'RTC',
      locked: false,
      stratum: 16,
      gnss,
      ntp: time.ntp.reachable ? { ...time.ntp, reachable: false } : time.ntp,
    });
  }
  return patchIfChanged(time, {
    source: 'NTP',
    locked: true,
    stratum: time.ntp.stratum + 1,
    gnss,
    ntp: time.ntp.reachable ? time.ntp : { ...time.ntp, reachable: true },
  });
}

function control(
  id: string,
  ok: boolean,
  okDetail: string,
  failDetail: string,
): (entry: SecurityControl) => SecurityControl {
  return (entry) => (entry.id === id ? patchIfChanged(entry, { ok, detail: ok ? okDetail : failDetail }) : entry);
}

function deriveSecurity(security: SimState['security'], active: readonly ActiveFault[]): SimState['security'] {
  const tpmFail = active.some((f) => f.kind === FaultKind.TPM_FAILURE);
  const securityFault = active.some((f) => f.kind === FaultKind.SECURITY_FAULT);
  const auditTamper = active.some((f) => f.kind === FaultKind.AUDIT_TAMPER);
  const tamper = active.some(isEnclosureTamper);
  const critical = tpmFail || securityFault || auditTamper;
  const rules = [
    control('TPM', !tpmFail, 'Attestation OK', 'Attestation failed'),
    control('SECURE_BOOT', !securityFault, 'Enabled', 'Verification failed'),
    control('TAMPER', !tamper, 'Closed', 'Open'),
    control('HASH_CHAIN', !auditTamper, 'SHA-256', 'Discontinuity detected'),
  ];
  const controls = mapIfChanged(security.controls, (entry) => rules.reduce((acc, rule) => rule(acc), entry));
  return patchIfChanged(security, {
    state: tpmFail || securityFault ? 'FAULT' : 'READY',
    posture: critical ? SecurityPosture.CRITICAL : tamper ? SecurityPosture.ATTENTION : SecurityPosture.SECURE,
    tpm: security.tpm.ok === !tpmFail ? security.tpm : { ...security.tpm, ok: !tpmFail },
    secureBoot: !securityFault,
    tamper,
    controls,
  });
}

/**
 * Both lenses of the one dual-lens camera are on PoE CAM 1 (design book B.01, §4.2; D79, step 54).
 * PoE CAM 2/AUX is the spare port: no device, no load, always healthy.
 */
export const CAMERA_PORT: Record<VideoTrackId, PortStatus['id']> = {
  'VIDEO-01': 'POE_CAM_1',
  'VIDEO-02': 'POE_CAM_1',
};
const MIC_PORT: Record<AudioTrackId, PortStatus['id']> = {
  'AUDIO-01': 'MIC_IN_1',
  'AUDIO-02': 'MIC_IN_2',
};
/** PoE draw of the dual-lens camera on PoE CAM 1 (W; budget 30 W per port, 60 W in total). */
export const CAMERA_POE_DRAW_W = 18.6;
/** Ports: PoE CAM 1 (powered) and PoE CAM 2/AUX (spare). */
export const POE_TOTAL_PORTS = 2;
export const POE_SPARE_PORTS = 1;

/**
 * Recomputes every fault- and session-derived field. Pure; returns the same object when
 * nothing changed.
 */
export function deriveDeviceState(state: SimState): SimState {
  const active = state.faults.active;
  const recording = state.session?.state === SessionState.RECORDING;
  const lostCameras = targetsOf(active, FaultKind.CAMERA_LOSS);
  const silentMics = targetsOf(active, FaultKind.MIC_NO_SIGNAL);
  const clippingMics = targetsOf(active, FaultKind.MIC_CLIP);

  const cameras = mapIfChanged(state.cameras, (camera: CameraStatus) => {
    const lost = lostCameras.has(camera.id);
    return patchIfChanged(camera, {
      lens: lost ? 'FAULT' : 'READY',
      online: !lost,
      recState: recording ? (lost ? 'LOST' : 'REC') : null,
    });
  });

  const mics = mapIfChanged(state.mics, (mic: MicStatus) => {
    const silent = silentMics.has(mic.id);
    const clipping = clippingMics.has(mic.id);
    return patchIfChanged(mic, {
      state: silent ? 'NO_SIGNAL' : clipping ? 'CLIP' : 'READY',
      recState: recording ? (silent ? 'LOST' : clipping ? 'DEGRADED' : 'REC') : null,
    });
  });

  // The camera stays powered while at least one lens streams; losing both takes PoE CAM 1 down.
  const cameraPowered = state.cameras.some((camera) => !lostCameras.has(camera.id));
  const poweredPorts = cameraPowered ? 1 : 0;
  const activePorts = poweredPorts + POE_SPARE_PORTS;
  const network = patchIfChanged(state.network, {
    poe: patchIfChanged(state.network.poe, {
      activePorts,
      totalPorts: POE_TOTAL_PORTS,
      poweredPorts,
      sparePorts: POE_SPARE_PORTS,
      drawW: cameraPowered ? CAMERA_POE_DRAW_W : 0,
    }),
  });

  const gnssLost = active.some((fault) => fault.kind === FaultKind.GNSS_LOSS);
  const ports = mapIfChanged(state.ports, (port) => {
    let link = true;
    if (port.id === 'POE_CAM_1' && !cameraPowered) link = false;
    for (const mic of state.mics) if (MIC_PORT[mic.id] === port.id && silentMics.has(mic.id)) link = false;
    if (port.id === 'GNSS_SMA' && gnssLost) link = false;
    return patchIfChanged(port, { link });
  });

  const tabletConnected = state.tabletLink.state === 'CONNECTED';
  const otherDevices = mapIfChanged(state.otherDevices, (device: OtherDevice) => {
    switch (device.id) {
      case 'POE-SWITCH':
        return patchIfChanged(device, {
          online: true,
          status: `${activePorts}/${state.network.poe.totalPorts} Ports Active`,
        });
      case 'REC-INDICATOR':
        return patchIfChanged(device, { online: true, status: recording ? 'SEDANG MEREKAM' : 'Standby' });
      default:
        return patchIfChanged(device, { online: tabletConnected, status: state.tabletLink.state });
    }
  });

  const fanStalled = active.some((fault) => fault.kind === FaultKind.FAN_STALL);
  const health = patchIfChanged(state.health, {
    fanOk: !fanStalled,
    ...(fanStalled ? { fanRpm: 0 } : {}),
  });

  const next: SimState = {
    ...state,
    cameras,
    mics,
    network,
    ports,
    otherDevices,
    health,
    storage: deriveStorage(state.storage, active),
    time: deriveTime(state.time, active),
    security: deriveSecurity(state.security, active),
    services: deriveServices(state.services, active),
  };
  const keys = [
    'cameras',
    'mics',
    'network',
    'ports',
    'otherDevices',
    'health',
    'storage',
    'time',
    'security',
    'services',
  ] as const;
  return keys.some((key) => next[key] !== state[key]) ? next : state;
}
