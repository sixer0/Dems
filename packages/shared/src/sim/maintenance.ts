/**
 * Devices, storage policy and maintenance (masterplan/01_specs.md §14.5.4, §14.5.5, §14.5.8;
 * 04_mobile_specs.md §4.12, §4.13): Run Diagnostics, device commands (simulated), the
 * retention policy, and the A/B software update 2.4.1 → 2.5.0 (§20.2 UpdateStep × 6).
 *
 * Diagnostics checks and update steps resolve one after another at seeded times stored in the
 * state (`resolvesAt`), so a reload in the middle resumes where it was.
 */
import type { AudioTrackId } from '../domain';
import {
  AUDIO_TEST_TONE_MS,
  DIAGNOSTIC_CHECK_MAX_MS,
  DIAGNOSTIC_CHECK_MIN_MS,
  UPDATE_REBOOT_MS,
  UPDATE_STEP_MAX_MS,
  UPDATE_STEP_MIN_MS,
} from './constants';
import { SessionState } from '../domain';
import type { AudioRuntime } from './audio';
import { requirePermission } from './auth';
import { DIAGNOSTIC_NOT_REPORTED_CHECKS, DIAGNOSTIC_NOT_REPORTED_DETAIL, DIAGNOSTIC_NOT_REPORTED_RULE, isDiagnosticNotReported, isPlatformNotReported, isOwnCaptureCoreState, isUpdaterNotAvailable, UPDATER_NOT_AVAILABLE_REASON } from './core-facts';
import { DEVICE_ID, PRODUCT_NAME } from './dataset';
import { PLATFORM_DEVICE_NAMES } from './devices';
import type { EngineContext } from './engine';
import { SimErrorCode, SimNotFoundError, SimTransitionError } from './errors';
import { nextItemId, recordActivity } from './events';
import { RngStream, type RngStreams } from './rng';
import { selectDeviceById } from './selectors';
import { isSessionActive } from './session-machine';
import type { Details, DiagnosticCheck, EpochMs, SimState, SimSubsystem, StoragePolicy } from './types';
import { DeviceCommand, Permission, type DiagnosticStatus, type RetentionPolicyId } from './vocabulary';

// ── Run Diagnostics ──────────────────────────────────────────────────────────────────────

/** The 8 checks, one per §6.1 / §21.2 health category. */
export const DIAGNOSTIC_CHECKS = [
  { id: 'CPU', label: 'CPU and memory' },
  { id: 'STORAGE', label: 'Storage (SMART)' },
  { id: 'FAN', label: 'Fan and thermal' },
  { id: 'NETWORK', label: 'Network and PoE' },
  { id: 'CAMERA', label: 'Cameras' },
  { id: 'AUDIO', label: 'Microphones' },
  { id: 'TIME', label: 'Time sources' },
  { id: 'SECURITY', label: 'Security (TPM, Secure Boot)' },
] as const;

/**
 * Evaluates one diagnostics check against the live state. `detail` is EN fallback text; `params`
 * carries its values so a UI renders its own copy (step 54, review 40 m4).
 */
export function evaluateDiagnostic(state: SimState, id: string): { status: DiagnosticStatus; detail: string; params: Details } {
  // Fix wave J (truth rule 3c; JW-04 / JT-03): a Core in its own capture reads no SMART value, no fan, no PoE
  // switch and no TPM. Its rows over that hardware say so and never PASS (`isDiagnosticNotReported`).
  if (isPlatformNotReported(state.security) && DIAGNOSTIC_NOT_REPORTED_CHECKS.includes(id)) {
    return { status: 'WARN', detail: DIAGNOSTIC_NOT_REPORTED_DETAIL, params: { rule: DIAGNOSTIC_NOT_REPORTED_RULE } };
  }
  const poe = state.network.poe;
  switch (id) {
    case 'CPU': {
      const params = { cpuPercent: state.health.cpuPercent, cpuTempC: state.health.cpuTempC };
      return state.health.cpuPercent >= 85
        ? { status: 'WARN', detail: `CPU ${state.health.cpuPercent}%`, params }
        : { status: 'PASS', detail: `CPU ${state.health.cpuPercent}%, ${state.health.cpuTempC} °C`, params };
    }
    case 'STORAGE': {
      const params = { storageState: state.storage.state };
      if (state.storage.state === 'FULL') return { status: 'FAIL', detail: 'Evidence volume full', params };
      if (state.storage.state === 'LOW') return { status: 'WARN', detail: 'Evidence volume low', params };
      return { status: 'PASS', detail: 'SMART OK on both volumes', params };
    }
    case 'FAN':
      return state.health.fanOk
        ? { status: 'PASS', detail: `${state.health.fanRpm} rpm`, params: { fanRpm: state.health.fanRpm } }
        : { status: 'FAIL', detail: 'Fan stalled (0 rpm)', params: { fanRpm: 0 } };
    case 'NETWORK': {
      const params = { linkUp: state.network.linkUp, linkSpeedMbps: state.network.linkSpeedMbps, activePorts: poe.activePorts, totalPorts: poe.totalPorts };
      if (!state.network.linkUp) return { status: 'FAIL', detail: 'LAN link down', params };
      return poe.activePorts < poe.totalPorts
        ? { status: 'WARN', detail: `PoE ${poe.activePorts}/${poe.totalPorts} ports active`, params }
        : { status: 'PASS', detail: `${state.network.linkSpeedMbps} Mbps, PoE ${poe.activePorts}/${poe.totalPorts}`, params };
    }
    case 'CAMERA': {
      const lost = state.cameras.filter((camera) => camera.lens === 'FAULT' || !camera.online);
      return lost.length > 0
        ? { status: 'FAIL', detail: `${lost.map((camera) => camera.name).join(', ')} offline`, params: { tracks: lost.map((camera) => camera.id).join(',') } }
        : { status: 'PASS', detail: 'Both lenses READY', params: { tracks: '' } };
    }
    case 'AUDIO': {
      const silent = state.mics.filter((mic) => mic.state === 'NO_SIGNAL');
      if (silent.length > 0) {
        return { status: 'FAIL', detail: `${silent.map((mic) => mic.name).join(', ')}: no signal`, params: { tracks: silent.map((mic) => mic.id).join(','), reason: 'NO_SIGNAL' } };
      }
      const clipping = state.mics.filter((mic) => mic.state === 'CLIP' || mic.clipLatched);
      if (clipping.length > 0) {
        return { status: 'WARN', detail: `${clipping.map((mic) => mic.name).join(', ')}: clipping`, params: { tracks: clipping.map((mic) => mic.id).join(','), reason: 'CLIP' } };
      }
      return { status: 'PASS', detail: 'Both channels READY', params: { tracks: '', reason: null } };
    }
    case 'TIME': {
      const params = { source: state.time.source, offsetMs: state.time.offsetMs, ntpServer: state.time.ntp.server };
      if (state.time.source === 'RTC') return { status: 'WARN', detail: 'RTC only (no GNSS or NTP)', params };
      if (state.time.source === 'NTP') return { status: 'WARN', detail: `NTP fallback (${state.time.ntp.server})`, params };
      return { status: 'PASS', detail: `GNSS stratum 1, offset ${state.time.offsetMs} ms`, params };
    }
    case 'SECURITY': {
      const params = { securityState: state.security.state, posture: state.security.posture };
      if (state.security.state === 'FAULT') return { status: 'FAIL', detail: 'Security fault', params };
      if (state.security.posture !== 'SECURE') return { status: 'WARN', detail: `Posture ${state.security.posture}`, params };
      return { status: 'PASS', detail: 'TPM 2.0 and Secure Boot OK', params };
    }
    default:
      return { status: 'PASS', detail: 'OK', params: {} };
  }
}

/** Starts a run (or returns the run in progress). */
export function runDiagnosticsTransition(
  state: SimState,
  now: EpochMs,
  rng: RngStreams,
): { state: SimState; runId: string } {
  const operator = requirePermission(state, 'runDiagnostics', Permission.DIAGNOSTICS_RUN);
  if (state.diagnostics && state.diagnostics.completedAt === null) {
    return { state, runId: state.diagnostics.id };
  }
  const random = rng.get(RngStream.DIAGNOSTICS);
  const { id, meta } = nextItemId(state.meta, 'DIAG');
  let at = now;
  const checks: DiagnosticCheck[] = DIAGNOSTIC_CHECKS.map((check, index) => {
    at += random.int(DIAGNOSTIC_CHECK_MIN_MS, DIAGNOSTIC_CHECK_MAX_MS);
    return { id: check.id, label: check.label, status: index === 0 ? 'RUNNING' : 'PENDING', detail: null, resolvesAt: at };
  });
  const next: SimState = { ...state, meta, diagnostics: { id, startedAt: now, completedAt: null, checks } };
  return {
    runId: id,
    state: {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: 'DIAGNOSTICS_RUN',
          message: `Diagnostics run ${id} started`,
          actorId: operator.id,
          deviceId: DEVICE_ID,
          details: { runId: id, checks: checks.length },
        },
        event: { type: 'DIAGNOSTICS_STARTED', message: 'Diagnostics started', params: { runId: id } },
      }),
    },
  };
}

export function advanceDiagnostics(state: SimState, now: EpochMs): SimState {
  const run = state.diagnostics;
  if (!run || run.completedAt !== null) return state;
  const checks = run.checks.slice();
  let changed = false;
  for (let index = 0; index < checks.length; index += 1) {
    const check = checks[index] as DiagnosticCheck;
    if (check.status !== 'RUNNING' && check.status !== 'PENDING') continue;
    if (check.resolvesAt === undefined || check.resolvesAt === null || check.resolvesAt > now) break;
    const result = evaluateDiagnostic(state, check.id);
    checks[index] = { ...check, status: result.status, detail: result.detail, params: result.params };
    const following = checks[index + 1];
    if (following && following.status === 'PENDING') checks[index + 1] = { ...following, status: 'RUNNING' };
    changed = true;
  }
  if (!changed) return state;
  const done = checks.every((check) => check.status === 'PASS' || check.status === 'WARN' || check.status === 'FAIL');
  if (!done) return { ...state, diagnostics: { ...run, checks } };
  const completedAt = checks[checks.length - 1]?.resolvesAt ?? now;
  const fail = checks.filter((check) => check.status === 'FAIL').length;
  // Fix wave J: a row that states nothing is no warning and no pass.
  const notReported = checks.filter((check) => isDiagnosticNotReported(check)).length;
  const warn = checks.filter((check) => check.status === 'WARN').length - notReported;
  const next: SimState = { ...state, diagnostics: { ...run, checks, completedAt } };
  return {
    ...next,
    ...recordActivity(next, completedAt, {
      event: {
        type: 'DIAGNOSTICS_COMPLETED',
        message:
          fail > 0
            ? `Diagnostics completed · ${fail} failed`
            : warn > 0
              ? `Diagnostics completed · ${warn} warning(s)`
              : notReported > 0
                ? `Diagnostics completed · ${checks.length - notReported} passed, ${notReported} not reported`
                : 'Diagnostics completed · all passed',
        severity: fail > 0 ? 'CRITICAL' : warn > 0 ? 'WARNING' : notReported > 0 ? 'INFO' : 'SUCCESS',
        params: { runId: run.id, pass: checks.length - fail - warn - notReported, warn, fail, ...(notReported > 0 ? { notReported } : {}) },
      },
    }),
  };
}

// ── Device commands (simulated) ──────────────────────────────────────────────────────────

const MIC_DEVICE_CHANNEL: Record<string, AudioTrackId> = { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02' };

/** Identify blinks the device's indicator 3 times at 2 Hz (P8: ≤ 3 flashes per second). */
export const IDENTIFY_BLINKS = 3;
export const IDENTIFY_PERIOD_MS = 500;

/**
 * `deviceCommand(deviceId, TEST_SIGNAL | RESTART | IDENTIFY)`: one DEVICE_COMMAND audit row.
 * - TEST_SIGNAL (DIAGNOSTICS_RUN): a microphone plays a steady −18 dBFS tone for 2 s on its meter.
 * - IDENTIFY (DIAGNOSTICS_RUN; step 54, SIM-GAP-W48-5): the indicator blinks 3× at 2 Hz; every
 *   device accepts it, including the platform devices GNSS, TPM and FRONT-PANEL.
 * - RESTART (DEVICE_MANAGE, TECHNICIAN): refused while recording (D79).
 */
export function deviceCommandTransition(
  state: SimState,
  now: EpochMs,
  deviceId: string,
  command: DeviceCommand,
  audio: AudioRuntime,
): SimState {
  const operator =
    command === DeviceCommand.RESTART
      ? requirePermission(state, 'deviceCommand', Permission.DEVICE_MANAGE)
      : requirePermission(state, 'deviceCommand', Permission.DIAGNOSTICS_RUN);
  const device = selectDeviceById(state, deviceId);
  const platformName = PLATFORM_DEVICE_NAMES[deviceId];
  if (!device && !platformName) throw new SimNotFoundError('device', deviceId);
  if (!device && command !== DeviceCommand.IDENTIFY) {
    throw new SimTransitionError(null, 'deviceCommand', `${deviceId} accepts IDENTIFY only`, SimErrorCode.COMMAND_UNSUPPORTED);
  }
  if (command === DeviceCommand.RESTART && state.session?.state === SessionState.RECORDING) {
    throw new SimTransitionError(state.session.state, 'deviceCommand', 'restart is unavailable while recording', SimErrorCode.RECORDING_ACTIVE);
  }
  const channel = MIC_DEVICE_CHANNEL[deviceId];
  if (command === DeviceCommand.TEST_SIGNAL && channel) audio.testToneUntil[channel] = now + AUDIO_TEST_TONE_MS;
  const name = device && 'name' in device ? device.name : (platformName ?? deviceId);
  const message =
    command === DeviceCommand.TEST_SIGNAL
      ? `Test signal sent to ${name} (simulated)`
      : command === DeviceCommand.IDENTIFY
        ? `Identify sent to ${name} (indicator blinks ${IDENTIFY_BLINKS}×, simulated)`
        : `${name} restarted (simulated)`;
  return {
    ...state,
    ...recordActivity(state, now, {
      audit: {
        type: 'DEVICE_COMMAND',
        message,
        actorId: operator.id,
        deviceId,
        details:
          command === DeviceCommand.IDENTIFY
            ? { command, blinks: IDENTIFY_BLINKS, periodMs: IDENTIFY_PERIOD_MS }
            : { command },
      },
    }),
  };
}

/** The scope tag of a Core services restart (DEVICE_COMMAND `details.scope`). */
export const SERVICES_RESTART_SCOPE = 'CORE_SERVICES';

/**
 * `details.reason` of the refusal of operation 66 on a Core in its own capture (row 104c2; finding RT-1, ruling D81).
 * The `services` slice is the simulator's model of an appliance: such a Core has no producer for it and restarts
 * nothing from the console. The press is refused like operation 67 (`COMMAND_UNSUPPORTED`): no service changes, no
 * DEVICE_COMMAND row enters the chain, no count is answered.
 */
export const SERVICES_RESTART_NOT_AVAILABLE_REASON = 'SERVICES_RESTART_NOT_AVAILABLE';

/**
 * Restarts the Core services (simulated; step 54, SIM-GAP-W52-3). MAINTENANCE; refused while a
 * session is active, and refused on a Core in its own capture (`isOwnCaptureCoreState`; row 104c2).
 * One DEVICE_COMMAND row through the hash chain; every service that is not
 * STOPPED restarts now (`startedAt = now`). Returns the number restarted.
 */
export function restartServicesTransition(state: SimState, now: EpochMs): { state: SimState; result: number } {
  const operator = requirePermission(state, 'restartServices', Permission.MAINTENANCE);
  // Row 104c2 (RT-1, D81): a Core in its own capture restarts nothing from the console - refused like operation 67,
  // before any change and before any row (the simulated restart and its "(simulated)" row never reach the production chain).
  if (isOwnCaptureCoreState(state)) {
    throw new SimTransitionError(state.session?.state ?? null, 'restartServices', 'this Core restarts no services from the console', SimErrorCode.COMMAND_UNSUPPORTED, SERVICES_RESTART_NOT_AVAILABLE_REASON);
  }
  if (isSessionActive(state.session)) {
    throw new SimTransitionError(state.session.state, 'restartServices', 'a session is active', SimErrorCode.SESSION_ACTIVE);
  }
  const restartable = state.services.filter((service) => service.status !== 'STOPPED');
  const next: SimState = {
    ...state,
    services: state.services.map((service) => (service.status === 'STOPPED' ? service : { ...service, startedAt: now })),
  };
  return {
    result: restartable.length,
    state: {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: 'DEVICE_COMMAND',
          message: `Core services restarted (simulated, ${restartable.length} services)`,
          actorId: operator.id,
          deviceId: DEVICE_ID,
          details: { command: DeviceCommand.RESTART, scope: SERVICES_RESTART_SCOPE, services: restartable.length },
        },
      }),
    },
  };
}

// ── Storage policy ───────────────────────────────────────────────────────────────────────

/** Retention days per policy (CASE_CLOSURE keeps evidence 10 years in this demo). */
export const RETENTION_DAYS = {
  DAYS_30: 30,
  DAYS_90: 90,
  YEAR_1: 365,
  CASE_CLOSURE: 3_650,
} as const satisfies Record<RetentionPolicyId, number>;

/**
 * Retention policy (step 54, F-49-1): needs EVIDENCE_REVIEW or MAINTENANCE (SUPERVISOR or
 * TECHNICIAN; the mobile Storage screen applies the same rule).
 */
export function setStoragePolicyTransition(state: SimState, now: EpochMs, policy: Partial<StoragePolicy>): SimState {
  const operator = requirePermission(state, 'setStoragePolicy', Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE);
  const current = state.storagePolicy;
  const retentionPolicy = policy.retentionPolicy ?? current.retentionPolicy;
  if (!(retentionPolicy in RETENTION_DAYS)) {
    throw new SimTransitionError(null, 'setStoragePolicy', `unknown policy ${String(retentionPolicy)}`, SimErrorCode.POLICY_RANGE);
  }
  const retentionDays =
    policy.retentionDays ?? (policy.retentionPolicy !== undefined ? RETENTION_DAYS[retentionPolicy] : current.retentionDays);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3_650) {
    throw new SimTransitionError(null, 'setStoragePolicy', 'retentionDays must be an integer from 1 to 3650', SimErrorCode.POLICY_RANGE);
  }
  const autoArchive = policy.autoArchive ?? current.autoArchive;
  if (
    retentionPolicy === current.retentionPolicy &&
    retentionDays === current.retentionDays &&
    autoArchive === current.autoArchive
  ) {
    return state;
  }
  const next: SimState = { ...state, storagePolicy: { retentionPolicy, retentionDays, autoArchive } };
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: {
        type: 'STORAGE_POLICY_CHANGED',
        message: `Retention policy set to ${retentionPolicy} (${retentionDays} days)`,
        actorId: operator.id,
        deviceId: 'HDD-EVIDENCE',
        details: { retentionPolicy, retentionDays, autoArchive },
      },
      event: {
        type: 'STORAGE_POLICY_CHANGED',
        message: `Retention policy updated · ${retentionDays} days`,
        params: { retentionPolicy, retentionDays, autoArchive },
      },
    }),
  };
}

// ── Software update (§20.2; A/B slots, §20.3) ────────────────────────────────────────────

/** Starts the update to `update.availableVersion`. MAINTENANCE (step 54); refused while a session is active. */
export function startSoftwareUpdateTransition(state: SimState, now: EpochMs, rng: RngStreams): SimState {
  const operator = requirePermission(state, 'startSoftwareUpdate', Permission.MAINTENANCE);
  const { update } = state;
  // Fix wave J (JT-06 / JW-06): a Core in its own capture has no updater - the demonstration update is not run there.
  if (isUpdaterNotAvailable(update)) {
    throw new SimTransitionError(state.session?.state ?? null, 'startSoftwareUpdate', 'this Core has no software updater', SimErrorCode.COMMAND_UNSUPPORTED, UPDATER_NOT_AVAILABLE_REASON);
  }
  if (update.state === 'RUNNING' || !update.availableVersion) return state;
  if (isSessionActive(state.session)) {
    throw new SimTransitionError(state.session?.state ?? null, 'startSoftwareUpdate', 'a session is active', SimErrorCode.SESSION_ACTIVE);
  }
  const random = rng.get('update');
  let at = now;
  const steps = update.steps.map((step, index) => {
    at += step.id === 'REBOOT' ? UPDATE_REBOOT_MS : random.int(UPDATE_STEP_MIN_MS, UPDATE_STEP_MAX_MS);
    return { id: step.id, status: index === 0 ? ('active' as const) : ('pending' as const), resolvesAt: at };
  });
  const next: SimState = { ...state, update: { ...update, state: 'RUNNING', steps, startedAt: now, completedAt: null } };
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: {
        type: 'UPDATE_STARTED',
        message: `Software update ${update.currentVersion} → ${update.availableVersion} started`,
        actorId: operator.id,
        deviceId: DEVICE_ID,
        details: { from: update.currentVersion, to: update.availableVersion, targetSlot: update.activeSlot === 'A' ? 'B' : 'A' },
      },
      event: {
        type: 'UPDATE_STARTED',
        message: `Installing ${update.availableVersion}`,
        params: { version: update.availableVersion },
      },
    }),
  };
}

export function advanceUpdate(state: SimState, now: EpochMs): SimState {
  const { update } = state;
  if (update.state !== 'RUNNING') return state;
  const steps = update.steps.slice();
  let next = state;
  let changed = false;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step || step.status !== 'active') continue;
    if (step.resolvesAt === undefined || step.resolvesAt === null || step.resolvesAt > now) break;
    steps[index] = { ...step, status: 'done' };
    const following = steps[index + 1];
    if (following) steps[index + 1] = { ...following, status: 'active' };
    changed = true;
    if (step.id === 'REBOOT') {
      const version = update.availableVersion ?? update.currentVersion;
      const slot = update.activeSlot === 'A' ? 'B' : 'A';
      // The reboot restarts every service (step 54, SIM-GAP-W52-1: uptime counts from here).
      const bootAt = step.resolvesAt;
      next = {
        ...next,
        services: next.services.map((service) => (service.status === 'STOPPED' ? service : { ...service, startedAt: bootAt })),
        ...recordActivity(next, step.resolvesAt, {
          audit: {
            type: 'SYSTEM_BOOT',
            message: `${PRODUCT_NAME} v${version} started (slot ${slot})`,
            deviceId: DEVICE_ID,
            details: { version, slot },
          },
          event: { type: 'SYSTEM_BOOT', message: `System started · v${version}`, deviceId: DEVICE_ID },
        }),
      };
    }
  }
  if (!changed) return state;
  const finished = steps.every((step) => step.status === 'done');
  if (!finished) return { ...next, update: { ...update, steps } };

  const version = update.availableVersion ?? update.currentVersion;
  const completedAt = steps[steps.length - 1]?.resolvesAt ?? now;
  const activeSlot = update.activeSlot === 'A' ? 'B' : 'A';
  next = {
    ...next,
    update: { ...update, steps, state: 'PASS', currentVersion: version, availableVersion: null, activeSlot, completedAt },
    device: {
      ...next.device,
      softwareVersion: version,
      identity: { ...next.device.identity, coreSoftwareVersion: version },
    },
    security: {
      ...next.security,
      controls: next.security.controls.map((control) =>
        control.id === 'SIGNED_FIRMWARE' ? { ...control, detail: `v${version}` } : control,
      ),
    },
  };
  return {
    ...next,
    ...recordActivity(next, completedAt, {
      audit: {
        type: 'UPDATE_COMPLETED',
        message: `Software update to ${version} completed (slot ${activeSlot})`,
        deviceId: DEVICE_ID,
        details: { version, slot: activeSlot, outcome: 'PASS' },
      },
      event: {
        type: 'UPDATE_COMPLETED',
        message: `Update complete · v${version}`,
        severity: 'SUCCESS',
        params: { version },
      },
    }),
  };
}

/** Advances a diagnostics run and a running update. */
export function createMaintenanceSubsystem(engine: EngineContext): SimSubsystem {
  return {
    name: 'maintenance',
    tick({ now }) {
      const state = engine.store.getState();
      if ((!state.diagnostics || state.diagnostics.completedAt !== null) && state.update.state !== 'RUNNING') return;
      const next = advanceUpdate(advanceDiagnostics(state, now), now);
      if (next !== state) engine.store.setState(next);
    },
  };
}

