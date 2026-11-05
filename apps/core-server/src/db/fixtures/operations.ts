/**
 * The operations part of the bulk fixture (plan row W25; database contract §4.21, §4.28, §4.30,
 * §11): alerts and the faults behind them, health snapshots, refused requests, exports of the
 * audit log and of the log bundle, what was done to the Core itself, the lineage of discarded
 * chains, and the rows that bring the audit log and the events up to their minimums.
 *
 * A VALID START STATE. A server may start on a bulk database, so the fixture must not contradict
 * the one-row tables it leaves as seeded. The seeded hardware snapshot has no active fault;
 * therefore every alert of a fault kind is resolved, and the alerts that are still active are of
 * the kind `SYSTEM` (a notice, not a fault). The storage policy changes that the audit log
 * records end with the seeded policy.
 *
 * ONE MAPPING (MR-1). Alerts and health snapshots are built in the shared shape and become rows
 * through `alertToRow` and `healthSnapshotToRow`.
 *
 * THE DETAILS OF AN AUDIT ROW are the ones its writer gives that type (decisions D91, D93): the
 * shared simulator's for what the engine writes (faults, exports, diagnostics, the policy,
 * updates, the session steps), the permission guard's for a refusal (the operation is one of the
 * contract registry, with the permission its rule names), the reset routine's for the row of a
 * reset. `__tests__/audit-details.test.ts` compares every row with its writer.
 *
 * AN ALERT AND ITS ROW (decision D103). The engine raises an alert and writes the row and the
 * event of the fault in one step, with one text: a `FAULT_RAISED` row, or for the audit-tamper
 * fault an `AUDIT_CHAIN_DISCONTINUITY` row. The fixture does the same: each fault alert has
 * exactly one such row with its kind, target, instant, text and severity.
 */
import { createHash } from 'node:crypto';
import { SessionState } from '@dems/shared/domain';
import {
  AUDIT_RING_SIZE,
  DIAGNOSTIC_CHECKS,
  EVENT_RING_SIZE,
  FAULT_EVENT_KIND,
  FAULT_SEVERITY,
  FaultEvt,
  FaultKind,
  OperatorRole,
  Permission,
  PrecheckCheckId,
  PrecheckReasonCode,
  RETENTION_DAYS,
  RetentionPolicyId,
  ScenarioName,
  SessionOutcome,
  caseNumberFor,
  recordingBytes,
  roleHas,
  sessionIdFor,
  type AuditInput,
  type SimAlert,
} from '@dems/shared/sim';
import { alertToRow, healthSnapshotToRow, type HealthSnapshotCause } from '../mapping';
import type { AlertRow, AuditChainHistoryRow, ChainDiscardReason, FaultKindValue, HealthSnapshotRow, ScenarioValue } from '../schema';
import type { OperatorDirectory } from './identity';
import { BULK_MIX, minimumOf } from './minimums';
import type { RecordingPlan } from './recordings';
import { FIXTURE_TAG } from './rng';
import { DAY_MS, FIXTURE_WORLD_DAYS, FRAME_HASH_STREAM, HOUR_MS, MINUTE_MS, SECOND_MS, UNICODE_SAMPLE, type World } from './world';

const need = (minimum: number, have: number): number => Math.max(0, minimum - have);

export interface OperationRows {
  readonly alerts: AlertRow[];
  readonly healthSnapshots: HealthSnapshotRow[];
}

// ── Faults, alerts and health snapshots ────────────────────────────────────────────────────────

/** Faults that do not end a recording: the ones the last 24 hours hold. */
const MINOR_FAULTS = [FaultKind.MIC_CLIP, FaultKind.MIC_NO_SIGNAL, FaultKind.GNSS_LOSS, FaultKind.FAN_STALL, FaultKind.STORAGE_LOW, FaultKind.TAMPER] as const;
const ALL_FAULTS = Object.values(FaultKind);
/** The hardware each fault is reported on (the simulator's device names). */
const FAULT_DEVICE: Readonly<Record<FaultKindValue, string>> = {
  CAMERA_LOSS: 'CAM-01',
  MIC_NO_SIGNAL: 'MIC-02',
  MIC_CLIP: 'MIC-01',
  STORAGE_LOW: 'HDD-EVIDENCE',
  STORAGE_FULL: 'HDD-EVIDENCE',
  GNSS_LOSS: 'GNSS',
  TAMPER: 'FRONT-PANEL',
  FAN_STALL: 'FAN-01',
  POWER_FAIL: 'POWER',
  TPM_FAILURE: 'TPM',
  SECURITY_FAULT: 'TPM',
  AUDIT_TAMPER: 'AUDIT',
  // Schema v2 (CS-20; dbc-3 §C.1): the two new fault kinds report on the capture devices.
  MIC_SILENT: 'MIC-01',
  CAPTURE_FAULT: 'CAM-01',
};
/** Alerts that are still active at `now`: notices, not faults. */
const ACTIVE_NOTICES = BULK_MIX.alerts.active + 2;
/** One snapshot a minute for 24 hours. */
const SNAPSHOT_INTERVAL_MS = MINUTE_MS;

interface FaultPlan {
  readonly kind: FaultKindValue;
  readonly raisedAt: number;
  readonly clearedAt: number;
  readonly acknowledged: boolean;
}

function buildFaults(world: World): OperationRows {
  const { now, base } = world;
  const rng = world.rng('faults');
  const interval = BULK_MIX.healthSnapshots.interval;
  const faultSnapshots = Math.max(BULK_MIX.healthSnapshots.fault, need(minimumOf('health_snapshots'), base.counts['health_snapshots'] ?? 0) - interval);
  // A fault is raised and cleared: two snapshots each, and a few more than the minimum.
  const recentCount = Math.ceil(faultSnapshots / 2) + 4;
  const total = Math.max(need(minimumOf('alerts'), base.counts['alerts'] ?? 0), recentCount + ACTIVE_NOTICES + ALL_FAULTS.length);
  const olderCount = total - recentCount - ACTIVE_NOTICES;

  const plans: FaultPlan[] = [];
  const dayAgo = now - DAY_MS;
  for (let index = 0; index < recentCount; index += 1) {
    const raisedAt = dayAgo + 10 * MINUTE_MS + Math.floor(((DAY_MS - HOUR_MS) * index) / recentCount) + rng.int(0, 5 * MINUTE_MS);
    plans.push({ kind: MINOR_FAULTS[index % MINOR_FAULTS.length] ?? FaultKind.MIC_CLIP, raisedAt, clearedAt: Math.min(now - 10 * MINUTE_MS, raisedAt + rng.int(MINUTE_MS, 25 * MINUTE_MS)), acknowledged: index % 2 === 0 });
  }
  const olderStart = world.worldStart + DAY_MS;
  const olderEnd = dayAgo - HOUR_MS;
  for (let index = 0; index < olderCount; index += 1) {
    const raisedAt = olderStart + Math.floor(((olderEnd - olderStart) * index) / olderCount) + rng.int(0, HOUR_MS);
    plans.push({ kind: ALL_FAULTS[index % ALL_FAULTS.length] ?? FaultKind.MIC_CLIP, raisedAt, clearedAt: Math.min(olderEnd + HOUR_MS, raisedAt + rng.int(MINUTE_MS, 3 * HOUR_MS)), acknowledged: index % 2 === 0 });
  }
  plans.sort((a, b) => a.raisedAt - b.raisedAt);

  const alerts: SimAlert[] = [];
  plans.forEach((plan, index) => {
    const { kind } = plan;
    const device = FAULT_DEVICE[kind];
    const severity = FAULT_SEVERITY[kind];
    const id = world.nextItem('ALR');
    const message = index % 29 === 3 ? `Fixture alert: ${kind} on ${device} (${UNICODE_SAMPLE})` : `Fixture alert: ${kind} on ${device}`;
    alerts.push({
      id,
      at: plan.raisedAt,
      severity,
      kind,
      message,
      active: false,
      acknowledged: plan.acknowledged,
      resolvedAt: plan.clearedAt,
      target: device,
      params: { kind, target: device, evt: FaultEvt[kind], eventKind: FAULT_EVENT_KIND[kind] },
    });
    // The engine's row of a fault: its kind, its event number and class, where, and the state of the session (none).
    const faultDetails = { kind, evt: FaultEvt[kind], eventKind: FAULT_EVENT_KIND[kind], target: device, fromState: null };
    if (kind === FaultKind.AUDIT_TAMPER) {
      // The demo fault altered a row of the engine's ring; the stored chain was never touched.
      // `index` is the place of that row in the ring and `seq` its sequence there. This is the
      // row and the event of the alert: its instant, its text, its severity.
      const ringIndex = (index * 37) % AUDIT_RING_SIZE;
      world.record(plan.raisedAt, {
        audit: {
          type: 'AUDIT_CHAIN_DISCONTINUITY',
          message,
          severity,
          deviceId: device,
          details: { kind, evt: FaultEvt[kind], eventKind: FAULT_EVENT_KIND[kind], index: ringIndex, seq: ringIndex + 1 },
        },
        event: { type: 'AUDIT_CHAIN_BROKEN', message, severity, params: { index: ringIndex, seq: ringIndex + 1 } },
      });
      // A KNOWN LIMIT: one more row and event of the fault, a second later. The engine writes none
      // for this kind; they are kept because taking them out would change the row counts of the
      // audit types and of the events. No alert is paired with them.
      world.record(plan.raisedAt + SECOND_MS, {
        audit: { type: 'FAULT_RAISED', message: `Fault ${kind} raised on ${device}`, severity, deviceId: device, details: faultDetails },
        event: { type: 'FAULT_RAISED', message: `Fault ${kind} raised`, severity, deviceId: device, params: { kind, target: device } },
      });
    } else {
      // One row and one event, at the instant of the alert and with its text, severity and target.
      world.record(plan.raisedAt, {
        audit: { type: 'FAULT_RAISED', message, severity, deviceId: device, details: faultDetails },
        event: { type: 'FAULT_RAISED', message, severity, deviceId: device, params: { kind, target: device } },
      });
    }
    world.record(plan.clearedAt, {
      audit: { type: 'FAULT_CLEARED', message: `Fault ${kind} cleared on ${device}`, deviceId: device, details: { kind, evt: FaultEvt[kind], target: device } },
      event: { type: 'FAULT_CLEARED', message: `Fault ${kind} cleared`, severity: 'SUCCESS', deviceId: device, params: { kind, target: device } },
    });
  });
  // The notices that are still active.
  for (let index = 0; index < ACTIVE_NOTICES; index += 1) {
    const at = now - (ACTIVE_NOTICES - index) * 37 * MINUTE_MS;
    alerts.push({
      id: world.nextItem('ALR'),
      at,
      severity: index % 3 === 0 ? 'WARNING' : 'INFO',
      kind: 'SYSTEM',
      message: index === 0 ? `Fixture notice ${index + 1}: maintenance window (${UNICODE_SAMPLE})` : `Fixture notice ${index + 1}: maintenance window`,
      active: true,
      acknowledged: index % 3 === 1,
      resolvedAt: null,
      target: null,
      params: { kind: 'SYSTEM', notice: index + 1 },
    });
  }

  // Health snapshots: one a minute for 24 hours, and one at every raise and clear of that day.
  const snapshotRng = world.rng('health-snapshots');
  const { health, storage, time, security, faults } = base.slices;
  const recordingAt = (at: number): boolean =>
    base.slices.sessionHistory.some((entry) => entry.outcome === SessionOutcome.SEALED && entry.startedAt !== null && entry.startedAt <= at && at <= entry.endedAt);
  const recent = plans.filter((plan) => plan.raisedAt >= dayAgo);
  const snapshot = (at: number, why: HealthSnapshotCause): HealthSnapshotRow => {
    const active = recent.filter((plan) => plan.raisedAt <= at && at < plan.clearedAt).map((plan) => plan.kind);
    const fanStalled = active.includes(FaultKind.FAN_STALL);
    const row = healthSnapshotToRow(
      {
        health: {
          ...health,
          cpuPercent: Number((health.cpuPercent + snapshotRng.float(-4, 6)).toFixed(1)),
          cpuTempC: Number((health.cpuTempC + snapshotRng.float(-1.5, 2.5)).toFixed(1)),
          storageTempC: Number((health.storageTempC + snapshotRng.float(-1, 1.5)).toFixed(1)),
          ambientTempC: Number((health.ambientTempC + snapshotRng.float(-0.5, 0.5)).toFixed(1)),
          fanRpm: fanStalled ? 0 : health.fanRpm + snapshotRng.int(-60, 60),
          fanOk: !fanStalled,
        },
        storage: active.includes(FaultKind.STORAGE_LOW) ? { ...storage, state: 'LOW' } : storage,
        time: active.includes(FaultKind.GNSS_LOSS) ? { ...time, source: 'NTP', offsetMs: 12 } : { ...time, offsetMs: snapshotRng.int(1, 5) },
        security,
        session: null,
        faults,
      },
      at,
      why,
    );
    return {
      ...row,
      id: snapshotRng.uuid(),
      faultKind: row.faultKind ?? null,
      // The seeded hardware slices hold no session and no fault; these two say what was true then.
      sessionState: recordingAt(at) ? 'RECORDING' : null,
      activeFaults: active.length,
    };
  };
  const healthSnapshots: HealthSnapshotRow[] = [];
  for (let minute = interval - 1; minute >= 0; minute -= 1) healthSnapshots.push(snapshot(now - minute * SNAPSHOT_INTERVAL_MS, { cause: 'INTERVAL' }));
  for (const plan of recent) {
    healthSnapshots.push(snapshot(plan.raisedAt, { cause: 'FAULT_RAISED', faultKind: plan.kind }));
    healthSnapshots.push(snapshot(plan.clearedAt, { cause: 'FAULT_CLEARED', faultKind: plan.kind }));
  }
  healthSnapshots.sort((a, b) => a.at - b.at || (a.cause < b.cause ? -1 : a.cause > b.cause ? 1 : 0));

  return { alerts: alerts.map(alertToRow), healthSnapshots };
}

// ── Refused requests ───────────────────────────────────────────────────────────────────────────

/**
 * Operations of the contract registry whose refusal the permission guard writes as
 * `ACCESS_DENIED`, each with the permissions its access rule names (one, or the alternatives of
 * an any-of). The three exports are not here: their refusal is an `EXPORT_DENIED` row.
 */
const GUARDED_OPERATIONS: ReadonlyArray<readonly [readonly Permission[], string]> = [
  [[Permission.SESSION_START], 'createSession'],
  [[Permission.SESSION_NOTE], 'addSessionNote'],
  [[Permission.EVIDENCE_REVIEW], 'archiveEvidence'],
  [[Permission.USER_ADMIN], 'assignUserRole'],
  [[Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE], 'setStoragePolicy'],
  [[Permission.DEVICE_MANAGE], 'restartDevice'],
  [[Permission.DIAGNOSTICS_RUN], 'runDiagnostics'],
  [[Permission.MAINTENANCE], 'startSoftwareUpdate'],
  [[Permission.PAIRING_MANAGE], 'issuePairingCode'],
  [[Permission.USER_ADMIN], 'listUsers'],
  // RB-9 as amended (principal PT GSP, 02-11-2026): the trio exists for USER_ADMIN holders and is
  // narrowed to the vendor `root` account inside the module. A refusal by permission is a row here.
  [[Permission.USER_ADMIN], 'createUser'],
  [[Permission.USER_ADMIN], 'updateUser'],
  [[Permission.USER_ADMIN], 'deleteUser'],
  [[Permission.DEMO_CONTROL], 'resetDemo'],
];
/** A role is refused when it holds none of the permissions the rule names. */
const refusedFor = (role: OperatorRole): ReadonlyArray<readonly [readonly Permission[], string]> =>
  GUARDED_OPERATIONS.filter(([permissions]) => !permissions.some((permission) => roleHas(role, permission)));
/** `details.permission`: the permission; for an any-of its alternatives joined with `_OR_`, as the guard writes it. */
const ANY_OF_SEPARATOR = '_OR_';
/** The operation and the permission of the evidence export, for its refusal's row. */
const EXPORT_EVIDENCE_OPERATION = 'exportEvidence';
const ACCESS_DENIED_ROWS = BULK_MIX.auditLog.accessDenied + 20;
const EXPORT_DENIED_ROWS = 12;

function buildRefusals(world: World, directory: OperatorDirectory, recordings: readonly RecordingPlan[]): void {
  const { now } = world;
  const rng = world.rng('refusals');
  const start = world.worldStart + DAY_MS;
  for (let index = 0; index < ACCESS_DENIED_ROWS; index += 1) {
    const at = start + Math.floor(((now - 5 * MINUTE_MS - start) * index) / ACCESS_DENIED_ROWS) + rng.int(0, 4 * MINUTE_MS);
    const entry = rng.pick(directory.candidates(at, at));
    const role = directory.roleAt(entry, at);
    const refused = refusedFor(role);
    // Every role is refused something here; were one not, the refusal would be of a technician.
    const actor = refused.length > 0 ? entry : rng.pick(directory.candidates(at, at, OperatorRole.TECHNICIAN));
    const actorRole = directory.roleAt(actor, at);
    const [permissions, operationId] = rng.pick(refusedFor(actorRole));
    const permission = permissions.join(ANY_OF_SEPARATOR);
    world.record(at, {
      audit: {
        type: 'ACCESS_DENIED',
        // The guard's wording: "lacks A", or "holds none of A, B" for an any-of.
        message: `Access denied: role ${actorRole} ${permissions.length === 1 ? `lacks ${permission}` : `holds none of ${permissions.join(', ')}`} (${operationId})`,
        severity: 'WARNING',
        actorId: actor.operator.id,
        details: { operationId, permission, role: actorRole },
      },
    });
  }
  const sealed = recordings.filter((recording) => recording.sealed && recording.evidenceId !== null);
  for (let index = 0; index < EXPORT_DENIED_ROWS; index += 1) {
    const recording = sealed[Math.floor((sealed.length * (index + 0.5)) / EXPORT_DENIED_ROWS)];
    if (recording === undefined || recording.evidenceId === null) continue;
    const at = Math.min(now - HOUR_MS, recording.endedAt + rng.int(HOUR_MS, 30 * HOUR_MS));
    const actor = rng.pick(directory.candidates(at, at, index % 2 === 0 ? OperatorRole.INVESTIGATOR : OperatorRole.TECHNICIAN));
    const role = directory.roleAt(actor, at);
    const evidenceId = recording.evidenceId;
    world.record(at, {
      audit: {
        type: 'EXPORT_DENIED',
        message: `Export of ${evidenceId} denied: role ${role} lacks EVIDENCE_EXPORT`,
        severity: 'WARNING',
        actorId: actor.operator.id,
        evidenceId,
        // The simulator's row, with the three names the guard adds to it (operation, permission, role).
        details: { operationId: EXPORT_EVIDENCE_OPERATION, permission: Permission.EVIDENCE_EXPORT, role, eventKind: 'UNAUTHORIZED_EXPORT' },
      },
      event: { type: 'EXPORT_DENIED', message: `Export denied · ${evidenceId}`, severity: 'WARNING', params: { evidenceId, role } },
    });
  }
}

// ── Exports of the audit log and of the log bundle ─────────────────────────────────────────────

function buildLogExports(world: World, directory: OperatorDirectory): void {
  const { now, base } = world;
  const rng = world.rng('log-exports');
  const start = world.worldStart + 2 * DAY_MS;
  const scopes = [
    ...Array.from({ length: need(BULK_MIX.exports.audit, 0) }, () => 'AUDIT' as const),
    ...Array.from({ length: need(BULK_MIX.exports.logs, 0) }, () => 'LOGS' as const),
  ];
  rng.shuffle(scopes).forEach((scope, index, all) => {
    const at = start + Math.floor(((now - HOUR_MS - start) * index) / all.length) + rng.int(0, HOUR_MS);
    const actor = rng.pick(directory.candidates(at, at, OperatorRole.SUPERVISOR)).operator.id;
    // What the engine writes: the length of its rings at the export, and the head of the chain then.
    const rows = Math.min(AUDIT_RING_SIZE, (base.counts['audit_log'] ?? 0) + index * 190);
    const events = Math.min(EVENT_RING_SIZE, rows + 40);
    // No row of the fixture has its hash before it is appended: the head is the SHA-256 of a text that says what it stands for.
    const head = createHash('sha256').update(`${FIXTURE_TAG}/exported-chain-head/${index + 1}/seed-${world.seed}`, 'utf8').digest('hex');
    const unicode = index % 7 === 2;
    const reason = unicode ? `Fixture reason: periodic review ${index + 1} (${UNICODE_SAMPLE})` : `Fixture reason: periodic review ${index + 1}`;
    const destination = unicode ? `Fixture archive ${index + 1} (${UNICODE_SAMPLE})` : 'Audit archive (simulated)';
    world.deferExport(at, (exportId) =>
      world.record(at, {
        audit: {
          type: 'AUDIT_EXPORTED',
          message: scope === 'LOGS' ? `Logs exported (${rows} audit rows, ${events} events)` : `Audit log exported (${rows} rows)`,
          actorId: actor,
          details: { exportId, rows, head, chainOk: true, eventKind: 'EXPORT', ...(scope === 'LOGS' ? { scope, events } : {}), reason, destination },
        },
      }),
    );
  });
}

// ── The Core itself: boots, the tablet link, device commands, diagnostics, policy, updates ─────

const HARDWARE = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH'] as const;
const DEVICE_COMMANDS = ['RESTART', 'TEST_SIGNAL', 'IDENTIFY'] as const;

/** The version `steps` minor releases before `version` (`2.4.1` gives `2.3.0`), for the history of updates. */
function earlierVersion(version: string, steps: number): string {
  const [major = 0, minor = 0] = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return `${major}.${Math.max(0, minor - steps)}.0`;
}

function buildCoreActivity(world: World, directory: OperatorDirectory): void {
  const { base } = world;
  const rng = world.rng('core-activity');
  const coreId = base.slices.device.id;
  const version = base.slices.device.softwareVersion;
  const { activeSlot } = base.slices.update;
  const otherSlot = activeSlot === 'A' ? 'B' : 'A';
  const technician = (at: number): string => rng.pick(directory.candidates(at, at, OperatorRole.TECHNICIAN)).operator.id;
  /** `count` instants spread over the history, at `hour` WIB (outside the office hours of the recordings). */
  const spread = (count: number, hour: number, each: (at: number, index: number) => void): void => {
    for (let index = 0; index < count; index += 1) {
      const daysAgo = FIXTURE_WORLD_DAYS - 1 - Math.floor(((FIXTURE_WORLD_DAYS - 4) * index) / count);
      each(world.dayAt(daysAgo, hour, rng.int(0, 40), rng.int(0, 59)), index);
    }
  };

  spread(6, 6, (at) => {
    world.record(at, {
      audit: { type: 'SYSTEM_BOOT', message: `Core started · v${version}`, deviceId: coreId },
      event: { type: 'SYSTEM_BOOT', message: `System started · v${version}`, deviceId: coreId },
    });
    world.record(at + MINUTE_MS, { event: { type: 'TIME_SYNC', message: 'Time synchronized · GNSS stratum 1', severity: 'SUCCESS', params: { source: 'GNSS' } } });
    world.record(at + 2 * MINUTE_MS, { event: { type: 'HEALTH_CHECK_OK', message: 'System health check completed', severity: 'SUCCESS' } });
  });
  spread(24, 20, (at, index) => {
    const connected = index % 2 === 1;
    world.record(at, {
      audit: { type: 'TABLET_LINK_CHANGED', message: `Tablet link ${connected ? 'connected' : 'offline'}`, severity: connected ? 'INFO' : 'WARNING', details: { state: connected ? 'CONNECTED' : 'OFFLINE' } },
      event: { type: connected ? 'TABLET_CONNECTED' : 'TABLET_DISCONNECTED', message: `Tablet ${connected ? 'connected' : 'disconnected'}`, severity: connected ? 'SUCCESS' : 'WARNING' },
    });
  });
  spread(20, 21, (at, index) => {
    const device = HARDWARE[index % HARDWARE.length] ?? 'CAM-01';
    const command = DEVICE_COMMANDS[index % DEVICE_COMMANDS.length] ?? 'IDENTIFY';
    world.record(at, {
      audit: { type: 'DEVICE_COMMAND', message: `Command ${command} sent to ${device}`, actorId: technician(at), deviceId: device, details: { command } },
    });
  });
  spread(10, 22, (at) => {
    const runId = world.nextItem('DIAG');
    const actor = technician(at);
    world.record(at, { event: { type: 'DIAGNOSTICS_STARTED', message: 'Diagnostics started', params: { runId } } });
    world.record(at + 6 * SECOND_MS, {
      audit: { type: 'DIAGNOSTICS_RUN', message: `Diagnostics run ${runId} completed`, actorId: actor, deviceId: coreId, details: { runId, checks: DIAGNOSTIC_CHECKS.length } },
      event: { type: 'DIAGNOSTICS_COMPLETED', message: 'Diagnostics completed', severity: 'SUCCESS', params: { runId, pass: DIAGNOSTIC_CHECKS.length, warn: 0, fail: 0 } },
    });
  });
  // Storage policy changes; the last one sets the policy the seed holds.
  const policy = base.slices.storagePolicy;
  const policies = [RetentionPolicyId.DAYS_30, RetentionPolicyId.YEAR_1, RetentionPolicyId.CASE_CLOSURE, policy.retentionPolicy];
  spread(policies.length, 5, (at, index) => {
    const retentionPolicy = policies[index] ?? policy.retentionPolicy;
    // The last change sets the seeded policy with the seeded number of days; the others the default of their policy.
    const retentionDays = index === policies.length - 1 ? policy.retentionDays : RETENTION_DAYS[retentionPolicy];
    world.record(at, {
      audit: { type: 'STORAGE_POLICY_CHANGED', message: `Retention policy set to ${retentionPolicy}`, actorId: technician(at), details: { retentionPolicy, retentionDays, autoArchive: policy.autoArchive } },
      event: { type: 'STORAGE_POLICY_CHANGED', message: `Retention policy · ${retentionPolicy}`, params: { retentionPolicy, retentionDays, autoArchive: policy.autoArchive } },
    });
  });
  // Two updates. The second one installed the seeded version into the slot that is active now;
  // the first one the version before it, into the other slot.
  const updates = [
    { from: earlierVersion(version, 2), to: earlierVersion(version, 1), slot: otherSlot },
    { from: earlierVersion(version, 1), to: version, slot: activeSlot },
  ] as const;
  spread(updates.length, 23, (at, index) => {
    const actor = technician(at);
    const { from, to, slot } = updates[index] ?? { from: version, to: version, slot: activeSlot };
    world.record(at - 10 * MINUTE_MS, { event: { type: 'UPDATE_AVAILABLE', message: `Version ${to} is ready to install`, params: { version: to } } });
    world.record(at, {
      audit: { type: 'UPDATE_STARTED', message: `Software update to ${to} started`, actorId: actor, deviceId: coreId, details: { from, to, targetSlot: slot } },
      event: { type: 'UPDATE_STARTED', message: `Update started · ${to}`, params: { version: to } },
    });
    world.record(at + 9 * MINUTE_MS, {
      audit: { type: 'UPDATE_COMPLETED', message: `Software update to ${to} completed`, actorId: actor, deviceId: coreId, details: { version: to, slot, outcome: 'PASS' } },
      event: { type: 'UPDATE_COMPLETED', message: `Update completed · ${to}`, severity: 'SUCCESS', params: { version: to } },
    });
  });
  // Sessions that were created and cancelled: an identifier is used, no history row is left.
  spread(6, 19, (at, index) => {
    const number = world.counters.session;
    world.counters.session += 1;
    const created = at + 30 * MINUTE_MS;
    const sessionId = sessionIdFor(number, created);
    const caseNumber = caseNumberFor(world.counters.caseNumber, created);
    world.counters.caseNumber += 1;
    const actor = rng.pick(directory.candidates(created, created + 5 * MINUTE_MS, OperatorRole.INVESTIGATOR)).operator.id;
    world.record(created, {
      audit: { type: 'SESSION_CREATED', message: `Session ${sessionId} created`, actorId: actor, sessionId, details: { caseNumber } },
      event: { type: 'SESSION_CREATED', message: `Session ${sessionId} created`, sessionId },
    });
    // One check blocked the gate: a lens fault, or the evidence storage was full.
    const [check, reasonCode] = index % 2 === 0 ? [PrecheckCheckId.LENS_1, PrecheckReasonCode.LENS_FAULT] : [PrecheckCheckId.STORAGE, PrecheckReasonCode.STORAGE_FULL];
    world.record(created + 40 * SECOND_MS, {
      audit: { type: 'PRECHECK_BLOCKED', message: 'Pre-recording checks blocked', severity: 'WARNING', actorId: actor, sessionId, details: { blocks: 1, checks: check, reasons: reasonCode, by: 'system' } },
      event: { type: 'PRECHECK_BLOCKED', message: 'Pre-recording checks blocked', severity: 'CRITICAL', sessionId, params: { blocks: 1 } },
    });
    world.record(created + 3 * MINUTE_MS, {
      audit: { type: 'SESSION_CANCELLED', message: `Session ${sessionId} cancelled`, actorId: actor, sessionId, details: { fromState: SessionState.PRECHECK } },
      event: { type: 'SESSION_CANCELLED', message: `Session ${sessionId} cancelled`, sessionId },
    });
  });
}

export function buildOperations(world: World, directory: OperatorDirectory, recordings: readonly RecordingPlan[]): OperationRows {
  const rows = buildFaults(world);
  buildRefusals(world, directory, recordings);
  buildLogExports(world, directory);
  buildCoreActivity(world, directory);
  buildCaptureActivity(world, directory);
  return rows;
}

/**
 * The nine capture-phase types of task 3 (C3 §5.2; register CS-14). The fixture states ONE row of
 * each, with details exactly in the form of the audit writer's list (`SERVER_AUDIT_DETAIL_RULES`),
 * so that every gate over the allow-list - the writer's own `auditInputOf`, the key scan, the
 * table of printed references - covers all 82 types from the first load (the 63rd, STT_CONFIG_CHANGED
 * of row 113, the four of row 132, the ten of task 4 blueprint row 19, the one of row 201 and the four of row V3 are the last rows below). The modules that will
 * write these rows on a live path land with their milestones (op 81 with row 71, the transcript
 * revisions with M7/M8, the credential paths with row 66): until then the fixture is the reference
 * holder, and each row names the actor whose permission owns the future operation. No credential,
 * token or transcript text joins any of these details (RK-12, SEC35-01/02, SD-8).
 */
function buildCaptureActivity(world: World, directory: OperatorDirectory): void {
  const rng = world.rng('capture-activity');
  const supervisor = (at: number): string => rng.pick(directory.candidates(at, at, OperatorRole.SUPERVISOR)).operator.id;
  const technician = (at: number): string => rng.pick(directory.candidates(at, at, OperatorRole.TECHNICIAN)).operator.id;
  const investigator = (at: number): string => rng.pick(directory.candidates(at, at, OperatorRole.INVESTIGATOR)).operator.id;
  /** Six evenings spread over the world, two hours apart so the nine rows never collide. */
  const at = (index: number): number => world.dayAt(FIXTURE_WORLD_DAYS - 3 - index, 21, rng.int(0, 30), rng.int(0, 59));

  world.record(at(0), {
    audit: {
      type: 'CAPTURE_CONFIG_CHANGED',
      // D61 (2026-11-04): history says `SOURCE` for what op 80 became - moving the transcription pair's PRIMARY name; the selector plane now keys its microphones by channel.
      message: 'Primary microphone source set to MIC-02',
      actorId: supervisor(at(0)),
      deviceId: null,
      details: { operationId: 'setPrimaryMic', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-01', deviceId: 'MIC-01', from: 'MIC-01', to: 'MIC-02', permission: 'CAPTURE_CONFIG' },
    },
  });
  world.record(at(1), {
    audit: {
      type: 'AUDIO_SOURCE_SWITCHED',
      message: 'Audio source switched MIC-01 to MIC-02',
      actorId: null,
      deviceId: null,
      details: { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: at(1), toMs: at(1) + 200 },
    },
  });
  world.record(at(2), {
    audit: {
      type: 'CAMERA_POE_CYCLED',
      message: 'PoE port cycled for CAM-02',
      actorId: technician(at(2)),
      deviceId: null,
      details: { deviceId: 'CAM-02', poePort: 'POE_CAM_2_AUX', streamWasLost: true, confirmed: true, gapFromMs: at(2), gapToMs: at(2) + 4_000 },
    },
  });
  world.record(at(3), {
    audit: {
      type: 'TRANSCRIPT_REVISED',
      message: 'Transcript revision 1 recorded',
      actorId: investigator(at(3)),
      deviceId: null,
      details: { revisionId: 'TRV-000001', authorId: investigator(at(3)), number: 1, baseRevision: 0, changeCount: 2, machineTranscriptHash: rng.bytes(32).toString('hex'), reason: 'Subject name corrected' },
    },
  });
  world.record(at(4), {
    audit: {
      type: 'MIC_SILENT',
      message: 'Microphone input silent beyond the warning threshold',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { inputId: 'MIC-01', thresholdDbfs: -60, durationMs: 5_000, sinceMs: at(4), active: true },
    },
  });
  world.record(at(5), {
    audit: {
      type: 'EVIDENCE_MEDIA_SERVED',
      message: 'Media range served for VIDEO-01',
      actorId: investigator(at(5)),
      deviceId: null,
      details: { fileId: 'VIDEO-01', bytesServed: 4_194_304, rangeStart: 0, rangeEnd: 4_194_303, signed: true, expiresAt: at(5) + 15 * MINUTE_MS },
    },
  });
  world.record(at(6), {
    audit: {
      type: 'EVIDENCE_EXPORT_FAILED',
      message: 'Export job failed',
      actorId: supervisor(at(6)),
      deviceId: null,
      severity: 'CRITICAL',
      details: { jobId: 'EXPJ-000001', kind: 'PACKAGE', reason: 'DISK_FULL' },
    },
  });
  world.record(at(7), {
    audit: {
      type: 'CAPTURE_CREDENTIAL_SET',
      message: 'Camera credential stored',
      actorId: supervisor(at(7)),
      deviceId: null,
      details: { deviceId: 'CAM-01', operationId: 'setCaptureCredential', permission: 'CAPTURE_CONFIG' },
    },
  });
  world.record(at(8), {
    audit: {
      type: 'CAPTURE_CREDENTIAL_REVEALED',
      // Task 4 (blueprint row 19; AD-03 (1)): `reason` is one of the closed set of three.
      message: 'Camera credential revealed for a connection test',
      actorId: supervisor(at(8)),
      deviceId: null,
      details: { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' },
    },
  });
  // Task 3 M6 (blueprint row 113; C3 §2.5; R-8): the one type of the STT configuration. Unlike the
  // nine above its live writer exists (`modules/stt-config`, operation 91), so the row is held
  // against that module's own builder as well as against the list (`audit-reference.ts`). Field
  // NAMES and two flags: no endpoint, no model, no credential (E-30/E-31; SEC35-14; SD-8).
  world.record(at(9), {
    audit: {
      type: 'STT_CONFIG_CHANGED',
      message: 'STT configuration changed',
      actorId: technician(at(9)),
      deviceId: null,
      details: { changedFields: 'backend,endpoint,credential', enabled: true, backend: 'omlx-server', credentialChanged: true, revision: 2 },
    },
  });
  // Task 3 R-9, R-10 (blueprint row 132, decision D106; C3 §5.2): the four types of the camera
  // search, the connection test, the adoption and the no-device warning - ONE row of each, in the
  // form of the audit writer's list, so that the fixture keeps covering every type (67). Ids,
  // counts, codes and facts only: no address, no device text, no username, no secret (D86 C-3: the
  // candidate is a DEVELOPMENT one, so no `host` and no `endpointRef`).
  world.record(at(10), {
    audit: {
      type: 'CAPTURE_DISCOVERY_SEARCHED',
      message: 'Camera search performed',
      actorId: technician(at(10)),
      deviceId: null,
      details: { searchId: 'DSC-000001', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 1, newCount: 1, registeredCount: 0, interfaceCount: 1, operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' },
    },
  });
  world.record(at(11), {
    audit: {
      type: 'CAPTURE_CONNECTION_TESTED',
      message: 'Camera connection tested',
      actorId: technician(at(11)),
      deviceId: null,
      details: { candidateId: 'CND-0000000000A1', searchId: 'DSC-000001', outcome: 'REACHABLE', authenticated: false, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', operationId: 'testCaptureCandidateConnection', permission: 'CAPTURE_CONFIG' },
    },
  });
  world.record(at(12), {
    audit: {
      type: 'CAPTURE_CANDIDATE_ADOPTED',
      message: 'Camera added',
      actorId: supervisor(at(12)),
      deviceId: null,
      details: { deviceId: 'CAM-06', candidateId: 'CND-0000000000A1', searchId: 'DSC-000001', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', credentialSet: false, operationId: 'adoptCaptureCandidate', permission: 'CAPTURE_CONFIG' },
    },
  });
  world.record(at(13), {
    audit: {
      type: 'CAPTURE_DEVICE_UNREACHABLE',
      message: 'Capture device not reachable',
      actorId: investigator(at(13)),
      deviceId: null,
      severity: 'WARNING',
      details: { deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId: 'SES-20261001-0001' },
    },
  });
  // Task 4 (blueprint row 19, WP-23a; design addendum 04 sections 4.2, 8.2): the ten types of the
  // hardware-input port - ONE row of each, in the form of the audit writer's list, so that the
  // fixture keeps covering every type (77). Their live writers land with rows 70, 106 to 111 and
  // 115; until then the fixture is the reference holder. Ids, closed codes, counts and addresses of
  // the documentation and private ranges only: no device text, no interface name, no secret.
  const ALIAS_ID = '00000000-0000-4000-8000-0000000000a1';
  const ACCEPTANCE_ID = '00000000-0000-4000-8000-0000000000c1';
  world.record(at(14), {
    audit: {
      type: 'CAPTURE_AUDIO_INPUT_CHANGED',
      message: 'Microphone input registered',
      actorId: technician(at(14)),
      deviceId: null,
      details: { deviceId: 'MIC-05', change: 'REGISTERED', inputNumber: 1, channelCount: 2, permission: 'CAPTURE_CONFIG' },
    },
  });
  world.record(at(15), {
    audit: {
      type: 'CAPTURE_NETWORK_CONFIG_CHANGED',
      message: 'Camera network configuration changed',
      actorId: technician(at(15)),
      deviceId: null,
      details: { changedFields: 'interfaceName,cameraSubnet', revision: 2 },
    },
  });
  world.record(at(16), {
    audit: {
      type: 'HOST_ALIAS_ADDED',
      message: 'Time-limited host address added',
      actorId: technician(at(16)),
      deviceId: null,
      details: { aliasId: ALIAS_ID, address: '192.168.1.253', reason: 'FACTORY_SCAN', expiresAt: at(16) + 30 * 60 * 1000 },
    },
  });
  world.record(at(17), {
    audit: {
      type: 'CAMERA_FACTORY_SCANNED',
      message: 'Factory address scan performed',
      actorId: technician(at(17)),
      deviceId: null,
      details: { outcome: 'COMPLETE', addressCount: 4, responderCount: 1, aliasId: ALIAS_ID },
    },
  });
  world.record(at(18), {
    audit: {
      type: 'CAMERA_NETWORK_SET',
      message: 'Camera network address set',
      actorId: technician(at(18)),
      deviceId: null,
      details: { phase: 'COMPLETED', fromAddress: '192.168.1.64', toAddress: '192.168.10.101', aliasId: ALIAS_ID },
    },
  });
  world.record(at(19), {
    audit: {
      type: 'HOST_ALIAS_REMOVE_FAILED',
      message: 'Time-limited host address could not be removed',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { aliasId: ALIAS_ID, address: '192.168.1.253', removeReason: 'JOB_DONE', failureReason: 'HELPER_FAILED' },
    },
  });
  world.record(at(20), {
    audit: {
      type: 'HOST_ALIAS_REMOVED',
      message: 'Time-limited host address removed',
      actorId: null,
      deviceId: null,
      details: { aliasId: ALIAS_ID, address: '192.168.1.253', removeReason: 'EXPIRED' },
    },
  });
  world.record(at(21), {
    audit: {
      type: 'CAPTURE_DEVICE_ADDRESS_CHANGED',
      message: 'Camera address changed',
      actorId: technician(at(21)),
      deviceId: null,
      details: { deviceId: 'CAM-01', fromAddress: '192.168.1.64', toAddress: '192.168.10.101', reason: 'SET_CAMERA_ADDRESS' },
    },
  });
  world.record(at(22), {
    audit: {
      type: 'INSTALLATION_ACCEPTED',
      message: 'Installation accepted',
      actorId: supervisor(at(22)),
      deviceId: null,
      details: { acceptanceId: ACCEPTANCE_ID, stepCount: 12, passedCount: 12 },
    },
  });
  world.record(at(23), {
    audit: {
      type: 'INSTALLATION_ACCEPTANCE_REVOKED',
      message: 'Installation acceptance revoked',
      actorId: supervisor(at(23)),
      deviceId: null,
      details: { acceptanceId: ACCEPTANCE_ID },
    },
  });
  // Task 4 (blueprint row 201, X-C; design 05 section 3.7; SX-14): ONE row of the host command that
  // sets an operator's password, in the form of the audit writer's list, so that the fixture keeps
  // covering every type (78). Its live writer is the command of row 215; until then the fixture is
  // the reference holder. The actor is null (the command cannot know who sat at the terminal) and
  // the severity is the type's fixed one. No password, length, salt, tag or hash parameter: no such key exists.
  const passwordSetAt = at(24);
  world.record(passwordSetAt, {
    audit: {
      type: 'OPERATOR_PASSWORD_SET',
      message: 'Operator password set from the host',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { targetOperatorId: supervisor(passwordSetAt), method: 'HOST_COMMAND', sessionsEnded: 0, earlierWasDemo: true, invokerUid: 1000 },
    },
  });
  // Task 4 (row V3, the third vocabulary step; decisions C53 (4d), C57, C58, C62): ONE row of each of
  // the four types of that step, in the form of the audit writer's list, so that the fixture keeps
  // covering every type (82). Their live writers land with row 106 (the two alias types), row 191b
  // (the audio gap) and the route of operation 108 (the stored-credential test); until then the
  // fixture is the reference holder. Ids, closed codes, counts and one address of a private range:
  // no interface name, no credential, no locator, no device text.
  world.record(at(25), {
    audit: {
      type: 'HOST_ALIAS_REQUESTED',
      message: 'Time-limited host address requested',
      actorId: technician(at(25)),
      deviceId: null,
      details: { action: 'ADD', address: '192.168.1.253', reason: 'FACTORY_SCAN', minutes: 30 },
    },
  });
  world.record(at(26), {
    audit: {
      type: 'HOST_ALIAS_ADD_FAILED',
      message: 'Time-limited host address could not be added',
      actorId: technician(at(26)),
      deviceId: null,
      severity: 'WARNING',
      details: { address: '192.168.1.253', reason: 'FACTORY_SCAN', failureReason: 'HELPER_ADDRESS_IN_USE' },
    },
  });
  world.record(at(27), {
    audit: {
      type: 'CAPTURE_AUDIO_ABSENT_ON_RESTART',
      message: 'Audio was not recorded while the capture worker was replaced',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { sessionId: 'SES-20261001-0001', earlierAttempt: 1, laterAttempt: 2, audioAbsentAtLeastMs: 287, audioAbsentAtMostMs: 624 },
    },
  });
  world.record(at(28), {
    audit: {
      type: 'CAPTURE_DEVICE_CONNECTION_TESTED',
      message: 'Registered camera connection tested',
      actorId: technician(at(28)),
      deviceId: null,
      details: { deviceId: 'CAM-01', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', permission: 'CAPTURE_CONFIG' },
    },
  });
  // Task 4 row R1b (decision C99): the one type of a camera absent inside a session; its live writer is the capture session.
  world.record(at(29), {
    audit: {
      type: 'CAPTURE_VIDEO_ABSENT_IN_SESSION',
      message: 'Video was not recorded while a camera of the session was absent',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { sessionId: 'SES-20261001-0001', deviceId: 'CAM-01', trackId: 'VIDEO-01', attempt: 1, loss: 1, tries: 1, videoAbsentAtLeastMs: 3048, videoAbsentAtMostMs: 8049, ended: 'RE_OPENED' },
    },
  });
  // Task 4 row N2 (decisions U25 (3), C110, C112 (3)): the two types of an audio path that is not sample-continuous;
  // their live writer is the capture session (row N11). The account row is stated in its form WITHOUT numbers
  // (`account: NONE`: the worker left no account), and one listed run that arrived before the worker went down.
  // WHY NOT A CLOSED ACCOUNT: an account with its thirteen numbers holds 19 keys, and the audit writer holds a
  // native row to `NATIVE_PAYLOAD_KEYS_MAX` (16) - it refuses such a row today. Found by row N2 and put to the
  // controller (`implementation/n2_mic_contract.md`, section 6); the fixture states a row the writer accepts.
  // ROW V7 (decision C119 (1)): the bound stays and an account is TWO entries, `part` 1 and 2. This fixture row
  // is ONE example entry of the type - part 1 of an account without numbers - and no whole account: no row was
  // added, so that no count of the fixture moved. The seal reads no account from fixture rows.
  world.record(at(30), {
    audit: {
      type: 'CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED',
      message: 'Audio samples were not received from a microphone; the amount was not measured',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { sessionId: 'SES-20261001-0001', attempt: 1, part: 1, captureLayer: 'AVFOUNDATION', captureGroup: 1, account: 'NONE', openRetries: 0 },
    },
  });
  world.record(at(31), {
    audit: {
      type: 'CAPTURE_AUDIO_SILENCE_INSERTED',
      message: 'Silence was inserted into the audio track in one piece',
      actorId: null,
      deviceId: null,
      severity: 'WARNING',
      details: { sessionId: 'SES-20261001-0001', attempt: 1, index: 1, fromSample: 1_440_000, samples: 5_280 },
    },
  });
  // Task 4 row RD2 (decision C147): the retirement of a camera (operation 111); its live writer is the retire unit (row RD3).
  world.record(at(32), {
    audit: {
      type: 'CAPTURE_DEVICE_RETIRED',
      message: 'Device retired: CAM-06',
      actorId: technician(at(32)),
      deviceId: null,
      details: { deviceId: 'CAM-06', kind: 'CAMERA', reason: 'STATEMENT_CHANGED', credentialDestroyed: true, streamRowsKept: 1, operationId: 'retireCaptureDevice', permission: 'CAPTURE_COMMISSION' },
    },
  });
  // D57 (2026-11-03, principal): the pre-delivery panel setup changed from the console (operation
  // 116 of §7); its live writer is the devices module's panel-setup route, gated on the vendor
  // identity. Facts only: which fields moved and where the logo went - never the words, never bytes.
  const panelSetupAt = at(34);
  world.record(panelSetupAt, {
    audit: {
      type: 'PANEL_SETUP_CHANGED',
      message: 'Panel pre-delivery setup changed (logo queued)',
      severity: 'WARNING',
      actorId: supervisor(panelSetupAt),
      deviceId: null,
      details: { satkerChanged: true, clientChanged: false, logoQueued: true, logoTarget: 'both', reason: 'Handover branding approved' },
    },
  });
  // Decisions D51 / D53 (row 90P): a live camera preview session opened (operation 112); its live writer is `src/camera-preview`.
  const previewAt = at(33);
  world.record(previewAt, {
    audit: {
      type: 'CAMERA_PREVIEW_OPENED',
      message: 'Live camera preview opened for CAM-01',
      actorId: technician(previewAt),
      deviceId: 'CAM-01',
      details: { deviceId: 'CAM-01', expiresAt: previewAt + 60_000, operationId: 'createCameraPreviewSession', permission: 'CAPTURE_CONFIG' },
    },
  });
  // Row 85 (W1 register A9; decision D23 (1, 2)): the camera network link went down and, two minutes later, came
  // back; the live writer is the camera-link sweep (row 102), a timer, so no actor, no device and no operation.
  // Placed last so that no draw of the stream above moves. The DOWN row is the earlier evening.
  const linkDownAt = at(36);
  const linkUpAt = at(35);
  world.record(linkDownAt, {
    audit: {
      type: 'CAMERA_LINK_DOWN',
      message: 'Camera network link down',
      severity: 'WARNING',
      actorId: null,
      deviceId: null,
      details: { previous: 'UP' },
    },
  });
  world.record(linkUpAt, {
    audit: {
      type: 'CAMERA_LINK_UP',
      message: 'Camera network link up',
      severity: 'INFO',
      actorId: null,
      deviceId: null,
      details: { previous: 'DOWN', downMs: 120_000 },
    },
  });
}

// ── The lineage of discarded chains ────────────────────────────────────────────────────────────

export interface Lineage {
  readonly rows: AuditChainHistoryRow[];
  /** `core_state.epoch` after the load: above the highest lineage epoch. */
  readonly epoch: number;
  /** The `SCENARIO_LOADED` row the newest lineage row agrees with (LN-3); `null` when no lineage row is added. */
  readonly marker: AuditInput | null;
  /** The instant of the newest reset: `core_state.last_reset_at`. */
  readonly lastResetAt: number | null;
}

const LINEAGE_SCENARIOS: readonly ScenarioValue[] = [ScenarioName.RECORDING, ScenarioName.FINALIZING, ScenarioName.FAULT_DEMO, ScenarioName.IDLE];

/**
 * The rows of `audit_chain_history`: one per chain that an earlier reset or scenario load
 * discarded, the newest one for the reset that built the seeded database. Its head and row count
 * are what the `SCENARIO_LOADED` row of the present chain names (LN-3). The discarded chains
 * themselves are gone, so their head hashes are the SHA-256 of a text that says so.
 */
export function buildLineage(world: World, directory: OperatorDirectory): Lineage {
  const { base, seed } = world;
  const rng = world.rng('lineage');
  const existing = base.counts['audit_chain_history'] ?? 0;
  const count = need(minimumOf('audit_chain_history'), existing);
  if (count === 0 || existing > 0) {
    // A base that already carries a lineage is left as it is: the table is append-only.
    return { rows: [], epoch: base.slices.meta.epoch, marker: null, lastResetAt: null };
  }
  const scenarioNow: ScenarioValue = base.slices.meta.scenario;
  const rows: AuditChainHistoryRow[] = [];
  let epoch = base.slices.meta.epoch;
  for (let resetNo = 1; resetNo <= count; resetNo += 1) {
    const newest = resetNo === count;
    // Every start of the server adds one to the epoch, every reset one more.
    epoch += 1 + rng.int(0, 3);
    const reset = newest ? scenarioNow === ScenarioName.IDLE : resetNo % 2 === 1;
    const scenario: ScenarioValue = newest ? scenarioNow : reset ? ScenarioName.IDLE : (LINEAGE_SCENARIOS[Math.floor(resetNo / 2) % LINEAGE_SCENARIOS.length] ?? ScenarioName.IDLE);
    const reason: ChainDiscardReason = reset ? 'RESET' : 'SCENARIO_LOAD';
    const resetAt = newest ? base.seededAt : base.seededAt - (count - resetNo) * 3 * DAY_MS - rng.int(0, 20 * HOUR_MS);
    const rowCount = rng.int(83, 900);
    // One discarded chain was not intact: its head was beyond the rows it still held.
    const damaged = resetNo === Math.ceil(count / 2);
    // A reset from the command line names no operator.
    const fromCommandLine = resetNo % 4 === 0;
    rows.push({
      resetNo,
      epoch,
      headHash: createHash('sha256').update(`${FIXTURE_TAG}/discarded-chain-head/${resetNo}/seed-${seed}`, 'utf8').digest('hex'),
      rowCount,
      firstSeq: 1,
      lastSeq: damaged ? rowCount + rng.int(1, 9) : rowCount,
      resetAt,
      actorId: fromCommandLine ? null : rng.pick(directory.candidates(Math.max(resetAt, world.worldStart + DAY_MS), base.seededAt, OperatorRole.SUPERVISOR)).operator.id,
      reason,
      scenario,
    });
  }
  const newest = rows[rows.length - 1];
  if (newest === undefined) return { rows: [], epoch: base.slices.meta.epoch, marker: null, lastResetAt: null };
  const reset = newest.reason === 'RESET';
  return {
    rows,
    epoch: epoch + 1 + rng.int(0, 2),
    lastResetAt: newest.resetAt,
    marker: {
      type: 'SCENARIO_LOADED',
      message: reset ? 'Demo reset (fresh dataset)' : `Demo scenario "${newest.scenario}" loaded`,
      actorId: newest.actorId,
      // The row of the reset routine (`db/reset/plan.ts`): `reset` is always there, false for a scenario load.
      details: { scenario: newest.scenario, reset, previousRows: newest.rowCount, previousHead: newest.headHash },
    },
  };
}

// ── Padding up to the minimums ─────────────────────────────────────────────────────────────────

/** Integrity-stream audit rows on the sealed recordings, until `missing` rows are added. */
export function padAuditLog(world: World, recordings: readonly RecordingPlan[], missing: number): void {
  const sealed = recordings.filter((recording) => recording.sealed);
  if (sealed.length === 0) return;
  const frames = world.rng(FRAME_HASH_STREAM);
  const rounds = Math.ceil(missing / sealed.length);
  for (let index = 0; index < missing; index += 1) {
    const recording = sealed[index % sealed.length];
    if (recording === undefined) continue;
    const round = Math.floor(index / sealed.length) + 1;
    const at = recording.startedAt + Math.floor(((recording.endedAt - recording.startedAt) * round) / (rounds + 1));
    const { sessionId } = recording;
    const choice = index % 3;
    if (choice === 0) {
      world.record(at, { audit: { type: 'FRAME_HASH', message: `Frame hash recorded · segment ${round}`, sessionId, evidenceId: recording.evidenceId, details: { trackId: 'VIDEO-01', segment: round, sha256: frames.hex(64) } } });
    } else if (choice === 1) {
      world.record(at, { audit: { type: 'WRITE_VERIFIED', message: 'Storage write verified', sessionId, deviceId: 'HDD-EVIDENCE', details: { bytesWritten: recordingBytes(at - recording.startedAt), volume: 'HDD-EVIDENCE' } } });
    } else {
      world.record(at, { audit: { type: 'TIMESTAMP_CONFIRMED', message: 'Secure timestamp confirmed · GNSS', sessionId, details: { source: 'GNSS', offsetMs: 3 } } });
    }
  }
}

/** Idle operational events, spread over the history, until `missing` events are added. */
export function padEvents(world: World, missing: number): void {
  const start = world.worldStart + DAY_MS;
  const span = world.now - MINUTE_MS - start;
  for (let index = 0; index < missing; index += 1) {
    const at = start + Math.floor((span * index) / Math.max(1, missing));
    // The three events the engine writes while no session is active.
    const choice = index % 3;
    if (choice === 0) world.record(at, { event: { type: 'HEALTH_CHECK_OK', message: 'System health check completed', severity: 'SUCCESS' } });
    else if (choice === 1) world.record(at, { event: { type: 'TIME_SYNC', message: 'Time synchronized · GNSS', severity: 'SUCCESS', params: { source: 'GNSS' } } });
    else world.record(at, { event: { type: 'STORAGE_WRITE_VERIFIED', message: 'Storage integrity check passed', severity: 'SUCCESS' } });
  }
}
