/**
 * What an audit row, an event and an alert look like WHERE THEY ARE WRITTEN (support for the
 * tests of plan row W25, decisions D91, D93 and D103; not a test file, nothing here imports
 * Vitest).
 *
 * The bulk fixture builds its rows itself: it replays no request and drives no engine. So that
 * its rows cannot drift from the real ones, the test holds every fixture row against the code
 * that writes that type in the running server. Three sources, and each audit type has exactly one:
 *
 *   ALLOW-LIST   the nine server-written types: the closed list of the audit writer
 *                (`SERVER_AUDIT_DETAIL_RULES`, `core/audit-details.ts`), and where the writing
 *                module has a pure builder of the row, that builder as well.
 *   MODULE       a type a server-native module writes with the simulator's shape: the pure builder
 *                of that module (identity, biometric, pairing, the permission guard) or of the
 *                reset routine, called with the facts of the fixture row.
 *   SIMULATOR    every other type: the engine writes it with the shared code, so the reference is
 *                the shared simulator itself, driven here through its own actions.
 *
 * WHAT IS COMPARED. Of an audit row: the type, the category, the severity, the keys and values
 * of the details, and where a builder gives it, the message. Of an event: the type, the category,
 * the severity and the keys of the parameters; an event a module writes beside its audit row is
 * compared whole with that builder's event. Of a fault alert: that it has the one row and the one
 * event the engine writes when it raises the alert, with the alert's kind, target, instant, text
 * and severity.
 *
 * The EXPECTED values are stated nowhere in this file. The facts of a fixture row are read by name
 * and handed to the imported builder; the row is then compared with what the builder gives. When
 * a module changes the row it writes, the comparison fails. The three administration types have
 * no builder (their rows are written inside the unit of work): their severity is read from the
 * module's source.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STT_BACKENDS, STT_CONFIG_FIELDS } from '@dems/shared/api';
import {
  AuthMethod,
  DEFAULT_SEED,
  FAULT_SEVERITY,
  FaultKind,
  OperatorRole,
  RecordingProfileId,
  RetentionPolicyId,
  ScenarioName,
  Severity,
  SignOutReason,
  SubjectType,
  buildScenarioState,
  createIdleState,
  type AuditInput,
  type AuditRow,
  type AuditType,
  type DetailValue,
  type Details,
  type EventInput,
  type SimAlert,
  type SimEvent,
  type SimEventType,
  type SimOperator,
} from '@dems/shared/sim';
import type { AuditEntry, EventEntry } from '../../../core';
import { PAIRING_CODE_CLOSE_REASONS, SERVER_AUDIT_DETAIL_RULES, detailRulesOf } from '../../../core/audit-details';
import { auditInputOf } from '../../../core/audit-writer';
import { attemptFailed, attemptLocked, sessionExpired, signedIn, signedOut, type ExpiryReason } from '../../../modules/identity/activity';
import { TokenRefusalReason, enrolmentChanged, tokenRefused } from '../../../modules/identity/biometric/activity';
import {
  codeClosed,
  codeIssued,
  credentialRotated,
  deviceRevoked,
  deviceUnpaired,
  paired,
  redeemFailed,
  redeemLocked,
} from '../../../modules/pairing/activity';
import { sttConfigChanged } from '../../../modules/stt-config/change';
import { createRuleBook, isAccessRule } from '../../../plugins/permission-guard/access-rules';
import { AccessRefusalKind } from '../../../plugins/permission-guard/decision';
import { denialRecordOf } from '../../../plugins/permission-guard/denial';
import { scenarioLoadedActivity } from '../../reset/plan';
import { AUTH_METHOD } from '../../schema/value-sets';
import { createHost, type Host } from '../../../../test/support/seed';

// ── Reading a fixture row ──────────────────────────────────────────────────────────────────────

/** The part of an audit row the comparisons read: a fixture row in the shared shape (`auditRowFromRow`). */
export type FixtureAuditRow = Pick<AuditRow, 'seq' | 'at' | 'type' | 'severity' | 'message' | 'actorId' | 'deviceId' | 'sessionId' | 'evidenceId' | 'details'>;
/** The part of an event the comparisons read (`eventFromRow`). */
export type FixtureEvent = Pick<SimEvent, 'seq' | 'at' | 'type' | 'severity' | 'message' | 'params' | 'sessionId' | 'deviceId'>;
/** The part of an alert the pairing reads (`alertFromRow`). */
export type FixtureAlert = Pick<SimAlert, 'id' | 'at' | 'kind' | 'severity' | 'message' | 'target'>;

/** The keys of a payload map, sorted and joined: `a, b, c`; `(none)` for an empty map. */
export function signatureOf(details: Readonly<Record<string, unknown>>): string {
  const keys = Object.keys(details).sort();
  return keys.length === 0 ? '(none)' : keys.join(', ');
}

/** What kind of value a detail holds: the four a flat payload allows. */
export function kindOf(value: unknown): 'null' | 'string' | 'number' | 'boolean' | 'other' {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return typeof value as 'string' | 'number' | 'boolean';
  return 'other';
}

function named(row: Pick<FixtureAuditRow, 'type' | 'seq'>): string {
  return `${row.type} (sequence ${row.seq})`;
}

function place(row: FixtureAuditRow, key: string): string {
  return `${named(row)}: details.${key}`;
}

function detail(row: FixtureAuditRow, key: string): DetailValue | undefined {
  return row.details[key];
}

function text(row: FixtureAuditRow, key: string): string {
  const value = detail(row, key);
  if (typeof value !== 'string') throw new Error(`${place(row, key)} is not a text`);
  return value;
}

function whole(row: FixtureAuditRow, key: string): number {
  const value = detail(row, key);
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${place(row, key)} is not a whole number`);
  return value;
}

function wholeOrNull(row: FixtureAuditRow, key: string): number | null {
  return detail(row, key) === null ? null : whole(row, key);
}

function oneOf<T extends string>(row: FixtureAuditRow, key: string, values: readonly T[]): T {
  const value = text(row, key);
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) throw new Error(`${place(row, key)} is none of ${values.join(', ')}`);
  return found;
}

function actorOf(row: FixtureAuditRow): string {
  if (row.actorId === null) throw new Error(`${named(row)} names no actor; the module writes this row for an operator`);
  return row.actorId;
}

function deviceOf(row: FixtureAuditRow): string {
  if (row.deviceId === null) throw new Error(`${named(row)} names no device; the module writes this row for a device`);
  return row.deviceId;
}

// ── The module builders ────────────────────────────────────────────────────────────────────────

/** What a builder needs that no audit row states: the texts it puts into a message. */
export interface WriterContext {
  /** The display name of an operator. */
  operatorName(operatorId: string): string;
  /** `core_device.name`. */
  readonly coreName: string;
}

/** The audit row and the event a module writes in one unit of work; `event` is null when it writes none. */
export interface WrittenActivity {
  readonly audit: AuditEntry | AuditInput;
  readonly event: EventEntry | EventInput | null;
}

/** The two methods a session of the server has (the stored value set). */
const METHODS = AUTH_METHOD;
const ROLES = Object.values(OperatorRole);
const CLOSE_REASONS = PAIRING_CODE_CLOSE_REASONS;
/** The identity module names the two as a type only; a value it does not name fails the typecheck of this line. */
const EXPIRY_REASONS: readonly ExpiryReason[] = ['IDLE', 'ABSOLUTE'];
const SIGN_OUT_REASONS = Object.values(SignOutReason);
const TOKEN_REASONS = Object.values(TokenRefusalReason);
const SCENARIOS = Object.values(ScenarioName);

const ruleBook = createRuleBook();

/** The row, and for an export the event, the permission guard writes for the refusal the fixture row describes. */
function guardRow(row: FixtureAuditRow): WrittenActivity {
  const operationId = text(row, 'operationId');
  const rule = ruleBook.ruleOf(operationId);
  if (!isAccessRule(rule)) throw new Error(`${place(row, 'operationId')} is no operation of the contract registry`);
  const record =
    row.actorId === null
      ? denialRecordOf(rule, { kind: AccessRefusalKind.DEVICE_REVOKED, deviceId: deviceOf(row) }, null)
      : rule.denial === null
        ? null
        : denialRecordOf(
            rule,
            { kind: AccessRefusalKind.NOT_PERMITTED, operatorId: row.actorId, role: oneOf(row, 'role', ROLES), deviceId: row.deviceId, denial: rule.denial },
            row.evidenceId,
          );
  if (record === null) throw new Error(`${named(row)}: the guard writes no row for a refusal of ${operationId}`);
  return record;
}

/** A failed sign-in: the biometric module's row for a token, the identity module's otherwise. */
function failedAttempt(row: FixtureAuditRow): WrittenActivity {
  const method = oneOf(row, 'method', METHODS);
  const counted = { operatorId: row.actorId, attemptsRemaining: whole(row, 'attemptsRemaining'), lockedUntil: wholeOrNull(row, 'lockedUntil') };
  if (method === AuthMethod.BIOMETRIC) {
    return tokenRefused({
      ...counted,
      deviceId: deviceOf(row),
      reason: detail(row, 'reason') === undefined ? null : oneOf(row, 'reason', TOKEN_REASONS),
      sessionsEnded: detail(row, 'sessionsEnded') === undefined ? null : whole(row, 'sessionsEnded'),
    });
  }
  return attemptFailed({ method, ...counted, deviceId: row.deviceId, disabled: detail(row, 'reason') !== undefined });
}

/**
 * The pure builder of the module that writes each type, called with the facts the fixture row
 * states. A type that is not here has no pure builder: it is one of the three administration
 * types (the allow-list is its reference) or a type the engine writes (the simulator is).
 */
export const MODULE_WRITERS: Readonly<Partial<Record<AuditType, (row: FixtureAuditRow, context: WriterContext) => WrittenActivity>>> = {
  // The permission guard.
  ACCESS_DENIED: guardRow,
  EXPORT_DENIED: guardRow,
  // The identity module, and the biometric operations (which call the same builders with their method).
  AUTH_SUCCESS: (row, context) =>
    signedIn({
      operatorId: actorOf(row),
      displayName: context.operatorName(actorOf(row)),
      method: oneOf(row, 'method', METHODS),
      deviceId: row.deviceId,
      replaced: detail(row, 'replaced') === true,
    }),
  AUTH_FAILED: failedAttempt,
  AUTH_LOCKED: (row) =>
    attemptLocked({ method: oneOf(row, 'method', METHODS), operatorId: row.actorId, deviceId: row.deviceId, lockedUntil: whole(row, 'lockedUntil'), retryInMs: whole(row, 'retryInMs') }),
  AUTH_SIGNED_OUT: (row) => signedOut({ operatorId: actorOf(row), deviceId: row.deviceId, reason: oneOf(row, 'reason', SIGN_OUT_REASONS) }),
  AUTH_EXPIRED: (row) => sessionExpired({ operatorId: actorOf(row), deviceId: row.deviceId, reason: oneOf(row, 'reason', EXPIRY_REASONS) }),
  BIOMETRIC_ENROLLMENT_CHANGED: (row) => ({
    audit: enrolmentChanged({ operatorId: actorOf(row), deviceId: deviceOf(row), enabled: detail(row, 'enabled') === true }),
    event: null,
  }),
  // The pairing module.
  PAIRING_CODE_ISSUED: (row) => codeIssued({ operatorId: actorOf(row), codeId: text(row, 'codeId'), expiresAt: whole(row, 'expiresAt') }),
  PAIRING_CODE_CLOSED: (row) => codeClosed({ codeId: text(row, 'codeId'), reason: oneOf(row, 'reason', CLOSE_REASONS), operatorId: row.actorId }),
  PAIRING_SUCCESS: (row, context) =>
    paired({
      operatorId: row.actorId,
      deviceId: deviceOf(row),
      codeId: text(row, 'codeId'),
      core: { deviceId: text(row, 'coreDeviceId'), name: context.coreName, certificateFingerprint: text(row, 'certificateFingerprint') },
    }),
  PAIRING_FAILED: (row) =>
    redeemFailed({ operatorId: row.actorId, deviceId: row.deviceId, attemptsRemaining: whole(row, 'attemptsRemaining'), lockedUntil: wholeOrNull(row, 'lockedUntil') }),
  PAIRING_LOCKED: (row) => redeemLocked({ operatorId: row.actorId, deviceId: row.deviceId, lockedUntil: whole(row, 'lockedUntil'), retryInMs: whole(row, 'retryInMs') }),
  DEVICE_REVOKED: (row) => deviceRevoked({ operatorId: actorOf(row), deviceId: deviceOf(row), reason: text(row, 'reason'), sessionsEnded: whole(row, 'sessionsEnded') }),
  UNPAIRED: (row) => deviceUnpaired({ operatorId: row.actorId, deviceId: deviceOf(row), sessionsEnded: whole(row, 'sessionsEnded') }),
  DEVICE_CREDENTIAL_ROTATED: (row) => credentialRotated({ deviceId: deviceOf(row) }),
  // The reset routine: the one row, and the one event, of a reset or a scenario load.
  SCENARIO_LOADED: (row) => {
    const written = scenarioLoadedActivity(
      { scenario: oneOf(row, 'scenario', SCENARIOS), reason: detail(row, 'reset') === true ? 'RESET' : 'SCENARIO_LOAD', actorId: row.actorId },
      { previousRows: whole(row, 'previousRows'), previousHead: text(row, 'previousHead') },
    );
    if (written.audit === undefined) throw new Error('the reset routine wrote no audit row');
    return { audit: written.audit, event: written.event ?? null };
  },
  // The STT configuration module (blueprint row 113; C3 §2.5): operation 91's row, and no event.
  STT_CONFIG_CHANGED: (row) => ({
    audit: sttConfigChanged({
      operatorId: actorOf(row),
      deviceId: row.deviceId,
      changedFields: text(row, 'changedFields')
        .split(',')
        .map((name) => {
          const field = STT_CONFIG_FIELDS.find((candidate) => candidate === name);
          if (field === undefined) throw new Error(`${place(row, 'changedFields')} names ${name}, which is no field of the STT configuration`);
          return field;
        }),
      enabled: detail(row, 'enabled') === true,
      backend: oneOf(row, 'backend', STT_BACKENDS),
      credentialChanged: detail(row, 'credentialChanged') === true,
      revision: whole(row, 'revision'),
    }),
    event: null,
  }),
};

// ── The administration module: no builder ──────────────────────────────────────────────────────

const ADMINISTRATION_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../modules/admin/changes.ts');
// REVISED 2026-11-02 (principal): RB-9 amended — the module now writes six rows inline, the three
// older ones plus USER_CREATED, USER_UPDATED and USER_DELETED of operations 15 to 17.
export const ADMINISTRATION_TYPES = ['ROLE_CHANGED', 'USER_DISABLED', 'USER_ENABLED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED'] as const satisfies readonly AuditType[];

/**
 * The severity the administration module gives each of its rows. It builds them inside its
 * unit of work, not in a pure function, so the severity is read from its source: the one entry
 * that states the type, and the `severity` member of that entry (none: the writer's default).
 * A source that no longer has that form is refused, so that a change there is noticed here.
 */
export function administrationSeverities(source: string = readFileSync(ADMINISTRATION_SOURCE, 'utf8')): Map<AuditType, string> {
  const severities = new Map<AuditType, string>();
  for (const type of ADMINISTRATION_TYPES) {
    const marker = `type: '${type}'`;
    const start = source.indexOf(marker);
    const end = source.indexOf('});', start);
    if (start === -1 || end === -1 || source.indexOf(marker, start + marker.length) !== -1) {
      throw new Error(`the administration module does not write ${type} in exactly one entry any more: give it a builder in MODULE_WRITERS`);
    }
    severities.set(type, /\bseverity: '([A-Z]+)'/.exec(source.slice(start, end))?.[1] ?? Severity.INFO);
  }
  return severities;
}

// ── The shared simulator, driven ───────────────────────────────────────────────────────────────

/** What one engine held and wrote: its audit rows, its events and its alerts, each as first seen. */
export interface SimulatorRun {
  readonly audit: readonly AuditRow[];
  readonly events: readonly SimEvent[];
  readonly alerts: readonly SimAlert[];
}

type Take = () => void;

/** One engine on one scenario, on a manual clock. */
async function play(scenario: ScenarioName, journey: (host: Host, take: Take) => void): Promise<SimulatorRun> {
  const host = await createHost({ scenario });
  const audit = new Map<number, AuditRow>();
  const events = new Map<number, SimEvent>();
  const alerts = new Map<string, SimAlert>();
  // A row is kept as it was first seen: the audit-tamper fault alters a row of the ring later.
  const take: Take = () => {
    const state = host.state();
    for (const row of state.audit.rows) if (!audit.has(row.seq)) audit.set(row.seq, row);
    for (const event of state.events) if (!events.has(event.seq)) events.set(event.seq, event);
    for (const alert of state.alerts) if (!alerts.has(alert.id)) alerts.set(alert.id, alert);
  };
  take();
  journey(host, take);
  take();
  if (host.errors.length > 0) throw new Error(`the simulator reported ${host.errors.length} error(s) on the journey of scenario ${scenario}`);
  return { audit: [...audit.values()], events: [...events.values()], alerts: [...alerts.values()] };
}

function sessionInput(investigator: SimOperator): Parameters<Host['sim']['actions']['createSession']>[0] {
  return {
    caseNumber: 'LP/2026/1001-0099',
    subjectType: SubjectType.SAKSI,
    subjectName: 'Reference Subject',
    investigatorId: investigator.id,
    room: 'Interview Room 1',
    profileId: RecordingProfileId.STANDARD_1080P25,
    notes: '',
  };
}

/** A recording that is sealed, then everything that is done with evidence and with the Core. */
function recordingJourney(host: Host, take: Take): void {
  const actions = host.sim.actions;
  const investigator = host.operator(OperatorRole.INVESTIGATOR);
  const supervisor = host.operator(OperatorRole.SUPERVISOR);
  const technician = host.operator(OperatorRole.TECHNICIAN);

  // The integrity stream of a recording: frame hashes, verified writes, confirmed timestamps.
  host.drive(90_000, 1_000);
  host.runAs(investigator, () => actions.addMarker('Key statement'));
  host.runAs(investigator, () => actions.addNote('The subject asked for a break'));
  host.runAs(investigator, () => actions.snapshot());
  // A fault while the session records: the row names the state of the session.
  actions.inject(FaultKind.MIC_CLIP);
  host.drive(500);
  actions.clearFault(FaultKind.MIC_CLIP);
  host.runAs(investigator, () => actions.stopRecording('Interview completed'));
  host.drive(30_000, 200);
  take();

  const sealedSession = host.state().lastSealedSessionId;
  if (sealedSession === null) throw new Error('the simulator sealed no session');
  host.runAs(investigator, () => actions.acknowledgeSummary(sealedSession));
  const sealed = host.state().evidence.filter((item) => item.status === 'SEALED' && !item.tampered);
  const tampered = host.state().evidence.find((item) => item.tampered);
  const [first, second] = sealed;
  if (first === undefined || second === undefined || tampered === undefined) throw new Error('the dataset holds too few evidence items for the journey');
  host.runAs(supervisor, () => actions.verify(first.id));
  host.runAs(supervisor, () => actions.verify(tampered.id));
  host.runAs(supervisor, () => actions.exportEvidence(first.id, { reason: 'Prosecutor request', destination: 'Case file transfer' }));
  host.runAs(supervisor, () => actions.archiveEvidence(second.id));
  host.runAs(supervisor, () => actions.exportAudit({ reason: 'Internal review', destination: 'Audit export' }));
  host.runAs(supervisor, () => actions.exportLogs({ reason: 'Internal review' }));

  // The Core itself.
  actions.setTabletLink('OFFLINE');
  host.drive(200);
  actions.setTabletLink('CONNECTED');
  host.runAs(technician, () => actions.deviceCommand('CAM-01', 'RESTART'));
  host.runAs(technician, () => actions.runDiagnostics());
  host.drive(10_000, 100);
  host.runAs(technician, () => actions.setStoragePolicy({ retentionPolicy: RetentionPolicyId.YEAR_1 }));
  take();

  // Every fault kind with no session: raised, then cleared. The audit-tamper fault comes last.
  for (const kind of Object.values(FaultKind)) {
    if (kind === FaultKind.AUDIT_TAMPER) continue;
    actions.inject(kind);
    host.drive(500);
    take();
    actions.clearFault(kind);
    host.drive(500);
  }
  take();
  actions.inject(FaultKind.AUDIT_TAMPER);
  host.drive(2_000, 100);
  actions.clearFault(FaultKind.AUDIT_TAMPER);
}

/** A session that is cancelled, and one whose gate a full evidence storage blocks. */
function cancelledJourney(host: Host): void {
  const actions = host.sim.actions;
  const investigator = host.operator(OperatorRole.INVESTIGATOR);
  host.runAs(investigator, () => actions.createSession(sessionInput(investigator)));
  host.runAs(investigator, () => actions.cancel());
  actions.inject(FaultKind.STORAGE_FULL);
  host.runAs(investigator, () => actions.createSession(sessionInput(investigator)));
  host.runAs(investigator, () => actions.beginPrecheck());
  host.drive(6_000);
  host.runAs(investigator, () => actions.cancel());
  actions.clearFault(FaultKind.STORAGE_FULL);
}

/** A recording that a power failure ends: the recovery, and the session closed as incomplete. */
function incompleteJourney(host: Host): void {
  const actions = host.sim.actions;
  const investigator = host.operator(OperatorRole.INVESTIGATOR);
  host.runAs(investigator, () => actions.createSession(sessionInput(investigator)));
  host.runAs(investigator, () => actions.beginPrecheck());
  host.drive(6_000);
  host.runAs(investigator, () => actions.startRecording());
  host.drive(20_000, 500);
  actions.inject(FaultKind.POWER_FAIL);
  host.drive(1_000);
  host.runAs(investigator, () => actions.recover());
  host.drive(8_000);
}

/** Diagnostics on a Core with no fault, then a software update from its start to its end. */
function maintenanceJourney(host: Host): void {
  const technician = host.operator(OperatorRole.TECHNICIAN);
  host.runAs(technician, () => host.sim.actions.runDiagnostics());
  host.drive(10_000, 100);
  host.runAs(technician, () => host.sim.actions.startSoftwareUpdate());
  host.drive(60_000, 200);
}

/**
 * What the shared simulator holds in its four seeded scenarios and writes on the journeys above,
 * one run per engine. The scenario states are built at `now`, the journeys run on a manual clock.
 * An instant or a sequence is unique within a run only.
 */
export async function driveSimulator(now: number): Promise<SimulatorRun[]> {
  const runs: SimulatorRun[] = [];
  for (const scenario of Object.values(ScenarioName)) {
    const state = buildScenarioState(scenario, createIdleState({ now, seed: DEFAULT_SEED }));
    runs.push({ audit: state.audit.rows, events: state.events, alerts: state.alerts });
  }
  runs.push(await play(ScenarioName.RECORDING, recordingJourney));
  runs.push(await play(ScenarioName.IDLE, cancelledJourney));
  runs.push(await play(ScenarioName.IDLE, incompleteJourney));
  runs.push(await play(ScenarioName.IDLE, maintenanceJourney));
  return runs;
}

/** A row or an event as the shape comparison reads it: its type, its severity and its payload map. */
export interface Shaped<T extends string> {
  readonly type: T;
  readonly severity: string;
  readonly payload: Details;
}

export const auditShaped = (row: Pick<AuditRow, 'type' | 'severity' | 'details'>): Shaped<AuditType> => ({ type: row.type, severity: row.severity, payload: row.details });
export const eventShaped = (event: Pick<SimEvent, 'type' | 'severity' | 'params'>): Shaped<SimEventType> => ({ type: event.type, severity: event.severity, payload: event.params });

/** What the simulator writes for one type. */
export interface SimulatorShape {
  /** `signatureOf(payload)` of every row of the type, without repetition. */
  readonly signatures: ReadonlySet<string>;
  /** Per key, the kinds of value that were seen (`kindOf`). */
  readonly kinds: ReadonlyMap<string, ReadonlySet<string>>;
  /** The severities that were seen. */
  readonly severities: ReadonlySet<string>;
  readonly rows: number;
}

/** The shapes of the simulator's rows, or events, by type. */
export function shapesOf<T extends string>(rows: readonly Shaped<T>[]): Map<T, SimulatorShape> {
  const shapes = new Map<T, { signatures: Set<string>; kinds: Map<string, Set<string>>; severities: Set<string>; rows: number }>();
  for (const row of rows) {
    const shape = shapes.get(row.type) ?? { signatures: new Set<string>(), kinds: new Map<string, Set<string>>(), severities: new Set<string>(), rows: 0 };
    shape.signatures.add(signatureOf(row.payload));
    shape.severities.add(row.severity);
    for (const [key, value] of Object.entries(row.payload)) {
      const kinds = shape.kinds.get(key) ?? new Set<string>();
      kinds.add(kindOf(value));
      shape.kinds.set(key, kinds);
    }
    shape.rows += 1;
    shapes.set(row.type, shape);
  }
  return shapes;
}

// ── The comparisons ────────────────────────────────────────────────────────────────────────────
//
// Each returns what it found wrong, one line per finding and nothing for a row that is right. A
// line names the type, the sequence and the key; never a value of a row.

/** Where an audit type is written: `ALLOW-LIST`, `MODULE` or `SIMULATOR`; null when nowhere known. */
export type DetailSource = 'ALLOW-LIST' | 'MODULE' | 'SIMULATOR';

export const ALLOW_LISTED_TYPES: ReadonlySet<string> = new Set(Object.keys(SERVER_AUDIT_DETAIL_RULES));

export function sourceOf(type: AuditType, shapes: ReadonlyMap<AuditType, SimulatorShape>): DetailSource | null {
  if (ALLOW_LISTED_TYPES.has(type)) return 'ALLOW-LIST';
  if (MODULE_WRITERS[type] !== undefined) return 'MODULE';
  return shapes.has(type) ? 'SIMULATOR' : null;
}

/** The nine server-written types against the closed list of the audit writer: no other key, every required key, every value in its form. */
export function allowListFindings(rows: readonly FixtureAuditRow[]): string[] {
  const findings: string[] = [];
  for (const row of rows) {
    const rules = detailRulesOf(row.type);
    if (rules === undefined) continue;
    for (const key of Object.keys(row.details)) {
      if (!Object.hasOwn(rules, key)) findings.push(`${place(row, key)} is no key of the writer's list`);
    }
    for (const [key, rule] of Object.entries(rules)) {
      const value = detail(row, key);
      if (value === undefined) {
        if (rule.required) findings.push(`${place(row, key)} is required and missing`);
      } else if (!rule.accepts(value)) {
        findings.push(`${place(row, key)} is not ${rule.form}`);
      }
    }
  }
  return findings;
}

/** True for a type a server-native module hands to the audit writer (the reset routine's row is not one). */
function isNativeType(type: AuditType): boolean {
  return (ALLOW_LISTED_TYPES.has(type) || MODULE_WRITERS[type] !== undefined) && type !== 'SCENARIO_LOADED';
}

/**
 * The server's own gate: `auditInputOf` is what the audit writer runs on an entry of a module
 * before a statement is sent. A fixture row of a server-written type must pass it unchanged.
 */
export function writerFindings(rows: readonly FixtureAuditRow[]): string[] {
  const findings: string[] = [];
  for (const row of rows) {
    if (!isNativeType(row.type)) continue;
    const entry: AuditEntry = {
      type: row.type,
      message: row.message,
      severity: row.severity,
      actorId: row.actorId,
      deviceId: row.deviceId,
      sessionId: row.sessionId,
      evidenceId: row.evidenceId,
      details: row.details,
    };
    try {
      const accepted = auditInputOf(entry);
      if (signatureOf(accepted.details ?? {}) !== signatureOf(row.details)) findings.push(`${named(row)}: the writer would store other keys than the row holds`);
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'an error without a code';
      findings.push(`${named(row)}: the audit writer refuses the row with ${code}`);
    }
  }
  return findings;
}

function samePayload(written: Readonly<Record<string, unknown>>, expected: Readonly<Record<string, unknown>>): boolean {
  const keys = Object.keys(written);
  return keys.length === Object.keys(expected).length && keys.every((key) => Object.hasOwn(expected, key) && Object.is(written[key], expected[key]));
}

/** What of a row is compared with the module's builder. */
export type RowAspect = 'details' | 'severity' | 'message';
const EVERY_ASPECT: readonly RowAspect[] = ['details', 'severity', 'message'];

/**
 * The module's pure builder, called with the facts of the row: the same type, the same keys and
 * values of the details, the same severity, the same message.
 */
export function moduleFindings(rows: readonly FixtureAuditRow[], context: WriterContext, aspects: readonly RowAspect[] = EVERY_ASPECT): string[] {
  const findings: string[] = [];
  for (const row of rows) {
    const writer = MODULE_WRITERS[row.type];
    if (writer === undefined) continue;
    let written: WrittenActivity['audit'];
    try {
      written = writer(row, context).audit;
    } catch (error) {
      if (aspects.includes('details')) findings.push(error instanceof Error ? error.message : `${named(row)}: the module's builder failed`);
      continue;
    }
    if (written.type !== row.type) {
      if (aspects.includes('details')) findings.push(`${named(row)}: the module writes this refusal as ${written.type}`);
      continue;
    }
    const details = written.details ?? {};
    if (aspects.includes('details')) {
      if (signatureOf(details) !== signatureOf(row.details)) findings.push(`${named(row)}: keys {${signatureOf(row.details)}}; the module writes {${signatureOf(details)}}`);
      else if (!samePayload(row.details, details)) findings.push(`${named(row)}: a value differs from what the module writes for the same facts`);
    }
    const severity = written.severity ?? Severity.INFO;
    if (aspects.includes('severity') && row.severity !== severity) findings.push(`${named(row)}: severity ${row.severity}; the module writes ${severity}`);
    if (aspects.includes('message') && row.message !== written.message) findings.push(`${named(row)}: the message is not the one the module's builder gives`);
  }
  return findings;
}

/** What the module builders give for `rows`, by type: the key sets and the severities the tables show as expected. */
export function moduleExpectations(rows: readonly FixtureAuditRow[], context: WriterContext): Map<AuditType, { signatures: Set<string>; severities: Set<string> }> {
  const expectations = new Map<AuditType, { signatures: Set<string>; severities: Set<string> }>();
  for (const row of rows) {
    const writer = MODULE_WRITERS[row.type];
    if (writer === undefined) continue;
    const { audit } = writer(row, context);
    const of = expectations.get(row.type) ?? { signatures: new Set<string>(), severities: new Set<string>() };
    of.signatures.add(signatureOf(audit.details ?? {}));
    of.severities.add(audit.severity ?? Severity.INFO);
    expectations.set(row.type, of);
  }
  return expectations;
}

/** The three administration rows: the severity the module's source gives them. */
export function administrationFindings(rows: readonly FixtureAuditRow[], severities: ReadonlyMap<AuditType, string> = administrationSeverities()): string[] {
  const findings: string[] = [];
  for (const row of rows) {
    const severity = severities.get(row.type);
    if (severity !== undefined && row.severity !== severity) findings.push(`${named(row)}: severity ${row.severity}; the administration module writes ${severity}`);
  }
  return findings;
}

/**
 * A row, or an event, the engine writes: its key set is one the simulator writes for that type,
 * every value is of a kind the simulator writes for that key, and its severity is one the
 * simulator gives that type. (Where the severity depends on a value, see `faultSeverityFindings`.)
 */
export function shapeFindings<T extends string>(what: string, items: ReadonlyArray<Shaped<T> & { readonly seq: number }>, shapes: ReadonlyMap<T, SimulatorShape>): string[] {
  const findings: string[] = [];
  for (const item of items) {
    const label = `${what} ${item.type} (sequence ${item.seq})`;
    const shape = shapes.get(item.type);
    if (shape === undefined) {
      findings.push(`${label}: the simulator wrote none of this type`);
      continue;
    }
    const signature = signatureOf(item.payload);
    if (!shape.signatures.has(signature)) {
      findings.push(`${label}: keys {${signature}}; the simulator writes ${[...shape.signatures].map((keys) => `{${keys}}`).join(' or ')}`);
    } else {
      for (const [key, value] of Object.entries(item.payload)) {
        if (shape.kinds.get(key)?.has(kindOf(value)) !== true) findings.push(`${label}: ${key} is a ${kindOf(value)}; the simulator writes ${[...(shape.kinds.get(key) ?? [])].join(' or ')}`);
      }
    }
    if (!shape.severities.has(item.severity)) findings.push(`${label}: severity ${item.severity}; the simulator writes ${[...shape.severities].join(' or ')}`);
  }
  return findings;
}

/** The types whose row, or event, the engine writes when a fault is raised: their severity is the one of the fault kind. */
const RAISED_TYPES: ReadonlySet<string> = new Set(['FAULT_RAISED', 'AUDIT_CHAIN_DISCONTINUITY']);

/**
 * The row and the event of a raised fault have the severity the simulator's own table gives the
 * kind of the fault (`FAULT_SEVERITY`), not just one the type can have. The test shows first that
 * every such row and event of the driven simulator obeys the table.
 */
export function faultSeverityFindings(what: string, items: ReadonlyArray<Shaped<string> & { readonly seq: number }>): string[] {
  const findings: string[] = [];
  for (const item of items) {
    const kind = item.payload['kind'];
    if (!RAISED_TYPES.has(item.type) || typeof kind !== 'string' || !Object.hasOwn(FAULT_SEVERITY, kind)) continue;
    const severity = FAULT_SEVERITY[kind as FaultKind];
    if (item.severity !== severity) findings.push(`${what} ${item.type} (sequence ${item.seq}): severity ${item.severity}; a fault of kind ${kind} is ${severity}`);
  }
  return findings;
}

/** The engine-written audit rows of `rows` against the simulator (`shapeFindings`). */
export function simulatorFindings(rows: readonly FixtureAuditRow[], shapes: ReadonlyMap<AuditType, SimulatorShape>): string[] {
  const engine = rows.filter((row) => sourceOf(row.type, shapes) === 'SIMULATOR');
  return shapeFindings('row', engine.map((row) => ({ ...auditShaped(row), seq: row.seq })), shapes);
}

/** `required [optional]` of the writer's list for one type, for the table. */
export function allowListKeys(type: AuditType): string {
  const rules = detailRulesOf(type);
  if (rules === undefined) return '';
  const names = Object.entries(rules).map(([key, rule]) => (rule.required ? key : `[${key}]`));
  return names.length === 0 ? '(none)' : names.join(', ');
}

// ── Events ─────────────────────────────────────────────────────────────────────────────────────

function eventDifferences(event: FixtureEvent, expected: EventEntry | EventInput): string[] {
  const differences: string[] = [];
  const params = expected.params ?? {};
  if (event.severity !== (expected.severity ?? Severity.INFO)) differences.push('the severity');
  if (signatureOf(event.params) !== signatureOf(params)) differences.push(`the parameter keys ({${signatureOf(event.params)}} for {${signatureOf(params)}})`);
  else if (!samePayload(event.params, params)) differences.push('a parameter value');
  if (event.message !== expected.message) differences.push('the message');
  if (event.deviceId !== (expected.deviceId ?? null)) differences.push('the device');
  if (event.sessionId !== (expected.sessionId ?? null)) differences.push('the session');
  return differences;
}

export interface ModuleEvents {
  readonly findings: string[];
  /** The sequences of the fixture events that are the event of a module's audit row. */
  readonly accounted: ReadonlySet<number>;
  /** Per event type a module writes, the parameter key sets and severities its builders gave. */
  readonly expected: ReadonlyMap<SimEventType, { signatures: Set<string>; severities: Set<string> }>;
}

/**
 * The events the modules write beside their audit rows. A module appends both in one unit of
 * work, at one instant: for every fixture row with a builder, the event of that builder must be
 * in the fixture at the row's instant, equal in type, severity, message, parameters, device and
 * session; and a fixture event of a type only a module writes must be the event of such a row.
 */
export function moduleEvents(rows: readonly FixtureAuditRow[], events: readonly FixtureEvent[], context: WriterContext): ModuleEvents {
  const findings: string[] = [];
  const accounted = new Set<number>();
  const expected = new Map<SimEventType, { signatures: Set<string>; severities: Set<string> }>();
  const byInstant = new Map<string, FixtureEvent[]>();
  for (const event of events) {
    const key = `${event.at}|${event.type}`;
    byInstant.set(key, [...(byInstant.get(key) ?? []), event]);
  }
  for (const row of rows) {
    const writer = MODULE_WRITERS[row.type];
    if (writer === undefined) continue;
    let written: WrittenActivity['event'];
    try {
      written = writer(row, context).event;
    } catch {
      // The row itself is not what its builder gives: `moduleFindings` reports it.
      continue;
    }
    if (written === null) continue;
    const of = expected.get(written.type) ?? { signatures: new Set<string>(), severities: new Set<string>() };
    of.signatures.add(signatureOf(written.params ?? {}));
    of.severities.add(written.severity ?? Severity.INFO);
    expected.set(written.type, of);

    const free = (byInstant.get(`${row.at}|${written.type}`) ?? []).filter((event) => !accounted.has(event.seq));
    const expectedEvent = written;
    const same = free.find((event) => eventDifferences(event, expectedEvent).length === 0);
    if (same !== undefined) {
      accounted.add(same.seq);
    } else if (free[0] !== undefined) {
      accounted.add(free[0].seq);
      findings.push(`${named(row)}: the event ${written.type} beside it (sequence ${free[0].seq}) differs from the module's in ${eventDifferences(free[0], written).join(', ')}`);
    } else {
      findings.push(`${named(row)}: the module writes an event ${written.type} beside this row; the fixture holds none at that instant`);
    }
  }
  for (const event of events) {
    if (!accounted.has(event.seq) && expected.has(event.type)) findings.push(`event ${event.type} (sequence ${event.seq}): only a module writes this type, and no row of the fixture accounts for it`);
  }
  return { findings, accounted, expected };
}

/** The events no module accounts for are the engine's: each against the simulator's events of its type. */
export function engineEventFindings(events: readonly FixtureEvent[], accounted: ReadonlySet<number>, moduleTypes: ReadonlySet<SimEventType>, shapes: ReadonlyMap<SimEventType, SimulatorShape>): string[] {
  const engine = events.filter((event) => !accounted.has(event.seq) && !moduleTypes.has(event.type));
  return shapeFindings('event', engine.map((event) => ({ ...eventShaped(event), seq: event.seq })), shapes);
}

// ── A fault alert, and the row and the event of the fault ──────────────────────────────────────

/** The audit type of the row the engine writes when it raises an alert of this kind. */
export function rowTypeOfAlert(alert: Pick<FixtureAlert, 'kind'>): AuditType {
  return alert.kind === FaultKind.AUDIT_TAMPER ? 'AUDIT_CHAIN_DISCONTINUITY' : 'FAULT_RAISED';
}

/**
 * The audit rows that are the row of an alert: of the alert's fault, at its instant, with its
 * kind, its text, its severity and (but for the audit-tamper fault, whose row names a place in
 * the chain instead) its target. The engine writes exactly one; the test shows that on the
 * simulator before it asks the same of the fixture.
 */
export function rowsOfAlert(alert: FixtureAlert, audit: readonly FixtureAuditRow[]): FixtureAuditRow[] {
  const type = rowTypeOfAlert(alert);
  return audit.filter(
    (row) =>
      row.type === type &&
      row.at === alert.at &&
      row.details['kind'] === alert.kind &&
      row.message === alert.message &&
      row.severity === alert.severity &&
      (type === 'AUDIT_CHAIN_DISCONTINUITY' || (row.details['target'] ?? null) === (alert.target ?? null)),
  );
}

/** The events that are the event of an alert: the one the engine writes with that row. */
export function eventsOfAlert(alert: FixtureAlert, events: readonly FixtureEvent[]): FixtureEvent[] {
  const tamper = alert.kind === FaultKind.AUDIT_TAMPER;
  return events.filter(
    (event) =>
      event.type === (tamper ? 'AUDIT_CHAIN_BROKEN' : 'FAULT_RAISED') &&
      event.at === alert.at &&
      event.message === alert.message &&
      event.severity === alert.severity &&
      (tamper || (event.params['kind'] === alert.kind && (event.params['target'] ?? null) === (alert.target ?? null))),
  );
}

/** Every fault alert has exactly one row and exactly one event of its fault. A notice (kind `SYSTEM`) is no fault. */
export function alertFindings(alerts: readonly FixtureAlert[], audit: readonly FixtureAuditRow[], events: readonly FixtureEvent[]): string[] {
  const findings: string[] = [];
  for (const alert of alerts) {
    if (alert.kind === 'SYSTEM') continue;
    const rows = rowsOfAlert(alert, audit).length;
    const beside = eventsOfAlert(alert, events).length;
    if (rows !== 1) findings.push(`alert ${alert.id} (${alert.kind}): ${rows} row(s) of type ${rowTypeOfAlert(alert)} with its kind, target, instant, text and severity; the engine writes one`);
    if (beside !== 1) findings.push(`alert ${alert.id} (${alert.kind}): ${beside} event(s) of its fault with its instant, text and severity; the engine writes one`);
  }
  return findings;
}
