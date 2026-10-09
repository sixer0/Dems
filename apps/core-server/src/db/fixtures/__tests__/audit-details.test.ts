// Every audit row, every event and every fault alert of the bulk fixture, held against the code
// that writes them in the running server (plan row W25, follow-ups; decisions D91, D93 and D103,
// findings F68 and F-W40-3; spec §13.1, §13.2; SR-54).
//
// The fixture builds its rows itself: it replays no request and drives no engine. Nothing keeps
// its rows equal to the real ones but this test, which compares EVERY fixture row with:
//
//   ALLOW-LIST   the closed list of the audit writer for the nine server-written types, and the
//                writer's own gate (`auditInputOf`), which refuses a key outside that list;
//   MODULE       the pure builder of the module that writes the type, called with the row's facts:
//                type, severity, message, details, and the event the module writes beside the row;
//   SIMULATOR    the shared simulator, driven through its own actions, for what the engine writes:
//                the keys and the kinds of value of a row's details and of an event's parameters,
//                the severity, and the pairing of a fault alert with its row and its event.
//
// The expected values are never written down here: they come from the imported code (see
// `audit-reference.ts`). The test prints four tables: the detail keys and the severity of every
// audit type, the parameter keys and the severity of every event type, and the alerts with their
// rows. Database-free, so it runs in every later row's gate.
import {
  AUDIT_RING_SIZE,
  AUDIT_TYPE_CATEGORY,
  AUTH_LOCKOUT_MS,
  AuditType,
  CANCELLABLE_STATES,
  EVENT_RING_SIZE,
  FAULT_EVENT_KIND,
  FAULT_SEVERITY,
  FaultEvt,
  FaultKind,
  PAIRING_LOCKOUT_MS,
  PrecheckCheckId,
  PrecheckReasonCode,
  TRACK_ORDER,
  eventCategory,
  roleHas,
  type AuditRow,
  type OperatorRole,
  type Permission,
  type SimAlert,
  type SimEvent,
  type SimEventType,
} from '@dems/shared/sim';
import { beforeAll, describe, expect, it } from 'vitest';
import { TokenRefusalReason } from '../../../modules/identity/biometric/activity';
import { permissionsOfDenialCode } from '../../../plugins/permission-guard/access-rules';
import { alertFromRow, auditRowFromRow, eventFromRow } from '../../mapping';
import { buildBulkFixture, type BulkFixture } from '../build';
import {
  ADMINISTRATION_TYPES,
  ALLOW_LISTED_TYPES,
  MODULE_WRITERS,
  administrationFindings,
  administrationSeverities,
  alertFindings,
  allowListFindings,
  allowListKeys,
  auditShaped,
  driveSimulator,
  engineEventFindings,
  eventShaped,
  eventsOfAlert,
  faultSeverityFindings,
  moduleEvents,
  moduleExpectations,
  moduleFindings,
  rowTypeOfAlert,
  rowsOfAlert,
  shapeFindings,
  shapesOf,
  signatureOf,
  simulatorFindings,
  sourceOf,
  writerFindings,
  type FixtureAuditRow,
  type FixtureEvent,
  type SimulatorRun,
  type SimulatorShape,
  type WriterContext,
} from './audit-reference';
import { FIXED_NOW, pureBase } from './support';

const base = pureBase(FIXED_NOW);
let fixture: BulkFixture;
/** The audit rows, the events and the alerts of the fixture, in the shared shapes. */
let rows: AuditRow[];
let events: SimEvent[];
let alerts: SimAlert[];
/** The same of the variant with a session in RECORDING. */
let variant: { rows: AuditRow[]; events: SimEvent[]; alerts: SimAlert[] };
let runs: SimulatorRun[];
let shapes: Map<AuditType, SimulatorShape>;
let eventShapes: Map<SimEventType, SimulatorShape>;
let context: WriterContext;

const shared = (built: BulkFixture): { rows: AuditRow[]; events: SimEvent[]; alerts: SimAlert[] } => ({
  rows: built.rows.auditLog.map(auditRowFromRow),
  events: built.rows.events.map(eventFromRow),
  alerts: built.rows.alerts.map(alertFromRow),
});

beforeAll(async () => {
  fixture = buildBulkFixture({ now: FIXED_NOW }, base);
  ({ rows, events, alerts } = shared(fixture));
  variant = shared(buildBulkFixture({ now: FIXED_NOW, activeSession: true }, base));
  runs = await driveSimulator(FIXED_NOW);
  shapes = shapesOf(runs.flatMap((run) => run.audit.map(auditShaped)));
  eventShapes = shapesOf(runs.flatMap((run) => run.events.map(eventShaped)));
  const names = new Map<string, string>();
  for (const operator of base.slices.operators) names.set(operator.id, operator.displayName);
  for (const operator of fixture.rows.operators) names.set(operator.id, operator.displayName);
  context = {
    coreName: base.slices.device.name,
    operatorName: (id) => {
      const name = names.get(id);
      if (name === undefined) throw new Error(`no operator ${id}`);
      return name;
    },
  };
});

const ofType = (type: AuditType): AuditRow[] => rows.filter((row) => row.type === type);
const braces = (keys: Iterable<string>): string => [...keys].map((each) => `{${each}}`).join(' or ');
const counted = (values: readonly string[]): string => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, count]) => `${value} x ${count}`).join('; ');
};

/** A row of the fixture with other details, or another member: what a drifted fixture would hold. */
function planted(type: AuditType, details: AuditRow['details'] | null, change: Partial<FixtureAuditRow> = {}): FixtureAuditRow[] {
  const row = rows.find((candidate) => candidate.type === type);
  if (row === undefined) throw new Error(`the fixture holds no row of type ${type}`);
  return [{ ...row, ...change, details: details ?? row.details }];
}

/** The fixture's events with the first one of `type` changed, or taken out. */
function plantedEvents(type: SimEventType, change: (event: SimEvent) => FixtureEvent | null): FixtureEvent[] {
  const index = events.findIndex((candidate) => candidate.type === type);
  const event = events[index];
  if (event === undefined) throw new Error(`the fixture holds no event of type ${type}`);
  const changed = change(event);
  return [...events.slice(0, index), ...(changed === null ? [] : [changed]), ...events.slice(index + 1)];
}

const HEX64 = /^[0-9a-f]{64}$/;

describe('where each audit type is written', () => {
  it('the fixture writes all 63 types, and each has exactly one reference: the list, a module builder, or the simulator', () => {
    const written = [...new Set(rows.map((row) => row.type))].sort();
    expect(written).toEqual(Object.values(AuditType).sort());
    expect(written.filter((type) => sourceOf(type, shapes) === null)).toEqual([]);

    const bySource: Record<string, number> = {};
    for (const type of written) {
      const source = sourceOf(type, shapes) ?? 'none';
      bySource[source] = (bySource[source] ?? 0) + 1;
    }
    expect(bySource).toEqual({ 'ALLOW-LIST': 19, MODULE: 11, SIMULATOR: 33 });
    // The nineteen of the list are the nineteen the audit writer names (nine of the backend task,
    // nine of the capture phase, and STT_CONFIG_CHANGED of blueprint row 113, which has a builder:
    // `modules/stt-config`), and the nine older ones mostly have a builder too. A listed type
    // with no pure builder is one whose live writer lands with a later milestone: the three of the
    // administration module (rows built inside their unit) and the nine capture types (op 81 with
    // row 71, the transcript revisions with M7/M8, the credential paths with row 66) - the fixture
    // states their rows until their owners exist (D44 R4/R5).
    expect([...ALLOW_LISTED_TYPES].sort()).toEqual(written.filter((type) => sourceOf(type, shapes) === 'ALLOW-LIST'));
    const noBuilder = written.filter((type) => ALLOW_LISTED_TYPES.has(type) && MODULE_WRITERS[type] === undefined);
    expect(noBuilder.sort()).toEqual(
      [
        ...ADMINISTRATION_TYPES,
        'AUDIO_SOURCE_SWITCHED',
        'CAMERA_POE_CYCLED',
        'CAPTURE_CONFIG_CHANGED',
        'CAPTURE_CREDENTIAL_REVEALED',
        'CAPTURE_CREDENTIAL_SET',
        'EVIDENCE_EXPORT_FAILED',
        'EVIDENCE_MEDIA_SERVED',
        'MIC_SILENT',
        'TRANSCRIPT_REVISED',
      ].sort(),
    );
  });

  it('the simulator was driven: every engine-written type came from a row it wrote, several of them in more than one form', () => {
    const engine = Object.values(AuditType).filter((type) => sourceOf(type, shapes) === 'SIMULATOR');
    expect(engine).toHaveLength(33);
    for (const type of engine) expect(shapes.get(type)?.rows ?? 0, type).toBeGreaterThan(0);
    // Both forms of a fault row: the engine's, and the seeded history's.
    expect([...(shapes.get('FAULT_RAISED')?.signatures ?? [])].sort()).toEqual(['eventKind, evt, fromState, kind, target', 'fromState, kind']);
    // A fault with and without a session, on a named part and on none.
    expect([...(shapes.get('FAULT_RAISED')?.kinds.get('fromState') ?? [])].sort()).toEqual(['null', 'string']);
    expect([...(shapes.get('FAULT_RAISED')?.kinds.get('target') ?? [])].sort()).toEqual(['null', 'string']);
    // A diagnostics run on a Core with no fault, and one with warnings: both severities of its event.
    expect([...(eventShapes.get('DIAGNOSTICS_COMPLETED')?.severities ?? [])].sort()).toEqual(['SUCCESS', 'WARNING']);
  });
});

describe('every audit row of the fixture', () => {
  it('a server-written type holds exactly the keys of the audit writer’s list, each value in its form', () => {
    for (const type of ALLOW_LISTED_TYPES) expect(rows.some((row) => row.type === type), type).toBe(true);
    expect(allowListFindings(rows)).toEqual([]);
    expect(allowListFindings(variant.rows)).toEqual([]);
  });

  it('the audit writer accepts every row a server-native module would hand it, and would store the same keys', () => {
    expect(writerFindings(rows)).toEqual([]);
    expect(writerFindings(variant.rows)).toEqual([]);
  });

  it('a row a module writes is the row that module’s builder gives for the same facts: type, details, severity and message', () => {
    for (const type of Object.keys(MODULE_WRITERS) as AuditType[]) expect(rows.some((row) => row.type === type), type).toBe(true);
    expect(moduleFindings(rows, context)).toEqual([]);
    expect(moduleFindings(variant.rows, context)).toEqual([]);
  });

  it('an administration row has the severity the administration module gives it', () => {
    // Read from the module's source, which builds these rows inside its unit of work.
    expect([...administrationSeverities()]).toEqual([
      ['ROLE_CHANGED', 'INFO'],
      ['USER_DISABLED', 'WARNING'],
      ['USER_ENABLED', 'INFO'],
    ]);
    expect(administrationFindings(rows)).toEqual([]);
  });

  it('an engine-written row has a key set, values of a kind, and a severity that the shared simulator writes for that type', () => {
    expect(simulatorFindings(rows, shapes)).toEqual([]);
    expect(simulatorFindings(variant.rows, shapes)).toEqual([]);
  });

  it('the row of a raised fault has the severity of its kind, and a link row that of its state, as in the simulator', () => {
    const numbered = (row: AuditRow): ReturnType<typeof auditShaped> & { seq: number } => ({ ...auditShaped(row), seq: row.seq });
    // The simulator obeys its own table: every fault row it wrote, in every form.
    const simulated = runs.flatMap((run) => run.audit);
    expect(simulated.filter((row) => row.type === 'FAULT_RAISED' || row.type === 'AUDIT_CHAIN_DISCONTINUITY').length).toBeGreaterThan(20);
    expect(faultSeverityFindings('row', simulated.map(numbered))).toEqual([]);
    expect(faultSeverityFindings('row', rows.map(numbered))).toEqual([]);
    // The link: the severity the simulator gave each state.
    const byState = new Map(simulated.filter((row) => row.type === 'TABLET_LINK_CHANGED').map((row) => [row.details['state'], row.severity]));
    expect([...byState.keys()].sort()).toEqual(['CONNECTED', 'OFFLINE']);
    for (const row of ofType('TABLET_LINK_CHANGED')) expect(row.severity, `sequence ${row.seq}`).toBe(byState.get(row.details['state']));
  });

  it('every row is in the category the shared map gives its type', () => {
    expect(rows.filter((row) => row.category !== AUDIT_TYPE_CATEGORY[row.type])).toEqual([]);
    expect(new Set(rows.map((row) => row.category)).size).toBe(8);
  });

  it('prints the table: type, where it is written, keys expected, keys written', () => {
    const builders = moduleExpectations(rows, context);
    const lines = Object.values(AuditType).map((type) => {
      const source = sourceOf(type, shapes);
      const builder = braces(builders.get(type)?.signatures ?? []);
      const expected =
        source === 'ALLOW-LIST'
          ? `list: ${allowListKeys(type)}${builder === '' ? '' : `; builder: ${builder}`}`
          : source === 'MODULE'
            ? `builder: ${builder}`
            : `simulator: ${braces(shapes.get(type)?.signatures ?? [])}`;
      return `| ${type} | ${source ?? 'none'} | ${expected} | ${counted(ofType(type).map((row) => `{${signatureOf(row.details)}}`))} |`;
    });
    expect(lines).toHaveLength(63);
    console.log(['[w25] audit detail keys per type: | type | written by | keys expected | keys written (rows) |', ...lines].join('\n'));
  });

  it('prints the table: type, where it is written, severity expected, severity written', () => {
    const builders = moduleExpectations(rows, context);
    const administration = administrationSeverities();
    const lines = Object.values(AuditType).map((type) => {
      const builder = builders.get(type)?.severities;
      const source = builder !== undefined ? 'builder' : administration.has(type) ? 'module source' : 'simulator';
      const expected = builder ?? (administration.has(type) ? [administration.get(type) ?? ''] : (shapes.get(type)?.severities ?? []));
      return `| ${type} | ${AUDIT_TYPE_CATEGORY[type]} | ${source} | ${[...expected].sort().join(' or ')} | ${counted(ofType(type).map((row) => row.severity))} |`;
    });
    expect(lines).toHaveLength(63);
    console.log(['[w25] audit severity per type: | type | category | severity from | severity expected | severity written (rows) |', ...lines].join('\n'));
  });
});

describe('every event of the fixture', () => {
  it('is in the category the shared map gives its type', () => {
    // The shared rule: the map of the event types, and for the event of a fault the category of its kind.
    const stored = fixture.rows.events.map((row) => ({ category: row.category, expected: eventCategory(eventFromRow(row)), seq: row.seq }));
    expect(stored.filter((row) => row.category !== row.expected).map((row) => row.seq)).toEqual([]);
    expect(new Set(stored.map((row) => row.category)).size).toBe(10);
  });

  it('the event a module writes beside its audit row is there, at the row’s instant, and equal to the builder’s: type, severity, message, parameters, device', () => {
    const beside = moduleEvents(rows, events, context);
    expect(beside.findings).toEqual([]);
    expect([...beside.expected.keys()].sort()).toEqual(['AUTH_EXPIRED', 'AUTH_FAILED', 'AUTH_LOCKED', 'AUTH_LOGIN', 'AUTH_LOGOUT', 'EXPORT_DENIED', 'PAIRED', 'PAIRING_FAILED', 'SCENARIO_LOADED', 'UNPAIRED']);
    // One event for each row of a type whose builder gives one, and none for the others.
    expect(beside.accounted.size).toBe(rows.filter((row) => MODULE_WRITERS[row.type]?.(row, context).event != null).length);
    expect(moduleEvents(variant.rows, variant.events, context).findings).toEqual([]);
  });

  it('every other event is the engine’s: parameter keys, kinds of value and severity are the simulator’s for that type', () => {
    const beside = moduleEvents(rows, events, context);
    const moduleTypes = new Set(beside.expected.keys());
    expect(engineEventFindings(events, beside.accounted, moduleTypes, eventShapes)).toEqual([]);
    const besideVariant = moduleEvents(variant.rows, variant.events, context);
    expect(engineEventFindings(variant.events, besideVariant.accounted, moduleTypes, eventShapes)).toEqual([]);
    // The event of a raised fault has the severity of its kind, in the simulator and here.
    const numbered = (event: SimEvent): ReturnType<typeof eventShaped> & { seq: number } => ({ ...eventShaped(event), seq: event.seq });
    expect(faultSeverityFindings('event', runs.flatMap((run) => run.events.map(numbered)))).toEqual([]);
    expect(faultSeverityFindings('event', events.map(numbered))).toEqual([]);
    // Every event is one or the other.
    const engine = events.filter((event) => !beside.accounted.has(event.seq));
    expect(beside.accounted.size + engine.length).toBe(events.length);
    expect(new Set(engine.map((event) => event.type)).size + moduleTypes.size).toBe(new Set(events.map((event) => event.type)).size);
  });

  it('prints the table: event type, where it is written, parameter keys and severity expected and written', () => {
    const beside = moduleEvents(rows, events, context);
    const types = [...new Set(events.map((event) => event.type))].sort();
    const lines = types.map((type) => {
      const builder = beside.expected.get(type);
      const shape = eventShapes.get(type);
      const expected = builder !== undefined ? `${braces(builder.signatures)} [${[...builder.severities].sort().join(', ')}]` : `${braces(shape?.signatures ?? [])} [${[...(shape?.severities ?? [])].sort().join(', ')}]`;
      const written = events.filter((event) => event.type === type);
      // The category as stored: the event of a fault takes the category of its kind.
      const categories = [...new Set(fixture.rows.events.filter((row) => row.type === type).map((row) => row.category))].sort().join(', ');
      return `| ${type} | ${categories} | ${builder !== undefined ? 'MODULE' : 'SIMULATOR'} | ${expected} | ${counted(written.map((event) => `{${signatureOf(event.params)}}`))} [${counted(written.map((event) => event.severity))}] |`;
    });
    expect(lines).toHaveLength(44);
    console.log(['[w25] event parameter keys per type: | event type | category written | written by | keys expected [severity] | keys written (events) [severity] |', ...lines].join('\n'));
  });
});

describe('a fault alert, and the row and the event of its fault', () => {
  it('the simulator: every alert it raised has exactly one row and one event with its kind, target, instant, text and severity', () => {
    const raised = runs.flatMap((run) => run.alerts.map((alert) => ({ alert, run })));
    expect(new Set(raised.map(({ alert }) => alert.kind))).toEqual(new Set(Object.values(FaultKind)));
    for (const { alert, run } of raised) {
      expect(rowsOfAlert(alert, run.audit), `${alert.kind} ${alert.id}`).toHaveLength(1);
      expect(eventsOfAlert(alert, run.events), `${alert.kind} ${alert.id}`).toHaveLength(1);
      expect(alert.severity).toBe(FAULT_SEVERITY[alert.kind as FaultKind]);
    }
    for (const run of runs) expect(alertFindings(run.alerts, run.audit, run.events)).toEqual([]);
    // The audit-tamper fault: a row of the chain discontinuity, and no FAULT_RAISED row at all.
    const tampered = raised.filter(({ alert }) => alert.kind === FaultKind.AUDIT_TAMPER);
    expect(tampered.length).toBeGreaterThan(0);
    for (const { alert, run } of tampered) expect(rowsOfAlert(alert, run.audit)[0]?.type).toBe('AUDIT_CHAIN_DISCONTINUITY');
    expect(runs.flatMap((run) => run.audit).filter((row) => row.type === 'FAULT_RAISED' && row.details['kind'] === FaultKind.AUDIT_TAMPER)).toEqual([]);
  });

  it('the fixture: every one of its fault alerts has exactly that one row and that one event', () => {
    const faults = alerts.filter((alert) => alert.kind !== 'SYSTEM');
    expect(faults).toHaveLength(238);
    expect(new Set(faults.map((alert) => alert.kind))).toEqual(new Set(Object.values(FaultKind)));
    expect(alertFindings(alerts, rows, events)).toEqual([]);
    expect(alertFindings(variant.alerts, variant.rows, variant.events)).toEqual([]);
    for (const alert of faults) expect(alert.severity, alert.id).toBe(FAULT_SEVERITY[alert.kind as FaultKind]);
    // And the other way round: a row the engine writes for a fault belongs to exactly one alert.
    const paired = new Set(faults.flatMap((alert) => rowsOfAlert(alert, rows).map((row) => row.seq)));
    expect(paired.size).toBe(faults.length);
    expect(ofType('AUDIT_CHAIN_DISCONTINUITY').filter((row) => !paired.has(row.seq))).toEqual([]);
    expect(ofType('FAULT_RAISED').filter((row) => row.details['evt'] !== undefined && row.details['kind'] !== FaultKind.AUDIT_TAMPER && !paired.has(row.seq))).toEqual([]);
  });

  it('a known limit: the fixture keeps one FAULT_RAISED row beside each audit-tamper alert, which the engine does not write', () => {
    // Taking the rows out would change the row counts of the audit types and of the events, which
    // the fixture keeps fixed. They pair with no alert, and stand one second after it.
    const extra = ofType('FAULT_RAISED').filter((row) => row.details['kind'] === FaultKind.AUDIT_TAMPER);
    const tampered = alerts.filter((alert) => alert.kind === FaultKind.AUDIT_TAMPER);
    expect(extra).toHaveLength(tampered.length);
    // Measured: the fixture's fault mix spreads over the fourteen FaultKind values of schema v2
    // (MIC_SILENT and CAPTURE_FAULT joined in task 3), so the audit-tamper share is 14, not 17.
    expect(extra).toHaveLength(14);
    expect(extra.map((row) => row.at)).toEqual(tampered.map((alert) => alert.at + 1_000));
    for (const alert of tampered) expect(extra.filter((row) => row.message === alert.message)).toEqual([]);
  });

  it('prints the table: fault kind, alerts, the type of their row, alerts with one row and one event', () => {
    const lines = Object.values(FaultKind).map((kind) => {
      const of = alerts.filter((alert) => alert.kind === kind);
      const first = of[0];
      const simulated = runs.flatMap((run) => run.alerts.filter((alert) => alert.kind === kind).map((alert) => rowsOfAlert(alert, run.audit).length === 1 && eventsOfAlert(alert, run.events).length === 1));
      return `| ${kind} | ${FAULT_SEVERITY[kind]} | ${first === undefined ? '-' : rowTypeOfAlert(first)} | ${of.length} | ${of.filter((alert) => rowsOfAlert(alert, rows).length === 1).length} | ${of.filter((alert) => eventsOfAlert(alert, events).length === 1).length} | ${simulated.filter(Boolean).length} of ${simulated.length} |`;
    });
    expect(lines).toHaveLength(14);
    console.log(['[w25] fault alerts and their rows: | kind | severity | row type | fixture alerts | with exactly one row | with exactly one event | simulator: alerts with one row and one event |', ...lines].join('\n'));
  });
});

describe('the comparisons can fail: what the fixture held before, and other drift', () => {
  it('the writer’s list refuses the keys the administration rows had, and a missing required key', () => {
    const before = planted('ROLE_CHANGED', { operatorId: 'OPR-006', fromRole: 'TECHNICIAN', toRole: 'INVESTIGATOR' });
    expect(allowListFindings(before)).toHaveLength(6);
    expect(allowListFindings(before).filter((finding) => finding.endsWith("is no key of the writer's list"))).toHaveLength(3);
    expect(allowListFindings(before).filter((finding) => finding.endsWith('is required and missing'))).toHaveLength(3);
    expect(writerFindings(before)).toEqual([expect.stringMatching(/the audit writer refuses the row with AUDIT_DETAIL_KEY_NOT_ALLOWED$/)]);

    const disabled = planted('USER_DISABLED', { targetOperatorId: 'OPR-008' });
    expect(allowListFindings(disabled)).toEqual([expect.stringMatching(/details\.sessionsEnded is required and missing$/)]);
    expect(writerFindings(disabled)).toEqual([expect.stringMatching(/AUDIT_DETAIL_MISSING$/)]);

    const role = planted('ROLE_CHANGED', { targetOperatorId: 'OPR-006', from: 'TECHNICIAN', to: 'AUDITOR' });
    expect(allowListFindings(role)).toEqual([expect.stringMatching(/details\.to is not a role$/)]);
    expect(writerFindings(role)).toEqual([expect.stringMatching(/AUDIT_DETAIL_VALUE_INVALID$/)]);
  });

  it('the pairing rows as they were: a key the writer refuses, a revoke without its reason, a failure that named a code', () => {
    const details = ['details'] as const;
    const rotated = planted('DEVICE_CREDENTIAL_ROTATED', { deviceId: 'DEV-0001', phase: 'ISSUED' });
    expect(allowListFindings(rotated)).toEqual([expect.stringMatching(/details\.phase is no key of the writer's list$/)]);
    expect(writerFindings(rotated)).toEqual([expect.stringMatching(/AUDIT_DETAIL_KEY_NOT_ALLOWED$/)]);
    expect(moduleFindings(rotated, context, details)).toEqual([expect.stringMatching(/keys \{deviceId, phase\}; the module writes \{\(none\)\}$/)]);

    const revoked = planted('DEVICE_REVOKED', { deviceId: 'DEV-0001', sessionsEnded: 2 });
    expect(allowListFindings(revoked)).toEqual([expect.stringMatching(/details\.reason is required and missing$/)]);
    expect(writerFindings(revoked)).toEqual([expect.stringMatching(/AUDIT_DETAIL_MISSING$/)]);
    expect(moduleFindings(revoked, context)).toEqual([expect.stringMatching(/details\.reason is not a text$/)]);

    expect(moduleFindings(planted('PAIRING_CODE_CLOSED', { codeId: 'PCD-000001', state: 'EXPIRED' }), context)).toEqual([expect.stringMatching(/details\.reason is not a text$/)]);
    expect(moduleFindings(planted('PAIRING_FAILED', { codeId: 'PCD-000001', attempt: 1 }), context)).toEqual([expect.stringMatching(/details\.attemptsRemaining is not a whole number$/)]);
    expect(moduleFindings(planted('PAIRING_SUCCESS', { codeId: 'PCD-000001', platform: 'android' }), context)).toEqual([expect.stringMatching(/details\.coreDeviceId is not a text$/)]);
    expect(moduleFindings(planted('UNPAIRED', { sessionsEnded: 1, deviceId: 'DEV-0001' }), context, details)).toEqual([expect.stringMatching(/keys \{deviceId, sessionsEnded\}; the module writes \{sessionsEnded\}$/)]);
  });

  it('the sign-in rows as they were, a value outside its set, and a row that contradicts its own actor', () => {
    const details = ['details'] as const;
    expect(moduleFindings(planted('AUTH_SUCCESS', { method: 'PASSWORD', transport: 'web' }), context, details)).toEqual([expect.stringMatching(/keys \{method, transport\}; the module writes \{method\}$/)]);
    expect(moduleFindings(planted('AUTH_FAILED', { reason: 'BAD_CREDENTIALS', method: 'PASSWORD' }), context)).toEqual([expect.stringMatching(/details\.attemptsRemaining is not a whole number$/)]);
    expect(moduleFindings(planted('AUTH_LOCKED', { lockedForMs: 60_000, failures: 5 }), context)).toEqual([expect.stringMatching(/details\.method is not a text$/)]);
    expect(moduleFindings(planted('AUTH_EXPIRED', { reason: 'IDLE_EXPIRED' }), context)).toEqual([expect.stringMatching(/details\.reason is none of IDLE, ABSOLUTE$/)]);
    // `knownOperator` says whether the row names an operator: a row without an actor cannot say true.
    const unknown = planted('AUTH_FAILED', { method: 'PASSWORD', knownOperator: true, attemptsRemaining: 4, lockedUntil: null }, { actorId: null, deviceId: null });
    expect(moduleFindings(unknown, context, details)).toEqual([expect.stringMatching(/a value differs from what the module writes for the same facts$/)]);
    // The token-reuse row as it was: no operator named, so the builder says the operator is unknown.
    const reuse = rows.filter((row) => row.type === 'AUTH_FAILED' && row.details['reason'] === 'TOKEN_REUSE').slice(0, 1);
    expect(moduleFindings(reuse.map((row) => ({ ...row, actorId: null })), context, details)).toEqual([expect.stringMatching(/a value differs from what the module writes for the same facts$/)]);
    // The reason of a refused token is one of the six the biometric module names. The fixture
    // writes the reuse; a row with any of the other five is the builder's row too, and the
    // name the fixture had for the reuse is none of them.
    const { sessionsEnded: _ended, ...refused } = reuse[0]?.details ?? {};
    expect(Object.values(TokenRefusalReason)).toEqual(['TOKEN_REUSE', 'USER_DISABLED', 'TOKEN_REVOKED', 'TOKEN_EXPIRED', 'OTHER_DEVICE', 'DEVICE_NOT_PAIRED']);
    for (const reason of Object.values(TokenRefusalReason)) {
      expect(moduleFindings(reuse.map((row) => ({ ...row, details: { ...refused, reason } })), context, details), reason).toEqual([]);
    }
    expect(moduleFindings(reuse.map((row) => ({ ...row, details: { ...row.details, reason: 'BIOMETRIC_TOKEN_REUSE' } })), context)).toEqual([
      expect.stringMatching(/details\.reason is none of TOKEN_REUSE, USER_DISABLED, TOKEN_REVOKED, TOKEN_EXPIRED, OTHER_DEVICE, DEVICE_NOT_PAIRED$/),
    ]);
    expect(moduleFindings(planted('BIOMETRIC_ENROLLMENT_CHANGED', { deviceId: 'DEV-0001', enabled: true, reason: 'ENROLLED' }), context, details)).toEqual([
      expect.stringMatching(/keys \{deviceId, enabled, reason\}; the module writes \{deviceId, enabled\}$/),
    ]);
  });

  it('a refusal: an operation outside the registry, an export written as a plain refusal, a permission the rule does not name', () => {
    const details = ['details'] as const;
    const refusal = { permission: 'EVIDENCE_REVIEW', role: 'INVESTIGATOR' };
    expect(moduleFindings(planted('ACCESS_DENIED', { operationId: 'openEvidenceReview', ...refusal }), context)).toEqual([
      expect.stringMatching(/details\.operationId is no operation of the contract registry$/),
    ]);
    expect(moduleFindings(planted('ACCESS_DENIED', { operationId: 'exportEvidence', permission: 'EVIDENCE_EXPORT', role: 'INVESTIGATOR' }), context)).toEqual([
      expect.stringMatching(/the module writes this refusal as EXPORT_DENIED$/),
    ]);
    expect(moduleFindings(planted('ACCESS_DENIED', { operationId: 'archiveEvidence', permission: 'EVIDENCE_VIEW', role: 'INVESTIGATOR' }), context, details)).toEqual([
      expect.stringMatching(/a value differs from what the module writes for the same facts$/),
    ]);
    expect(moduleFindings(planted('EXPORT_DENIED', { role: 'INVESTIGATOR', eventKind: 'UNAUTHORIZED_EXPORT' }), context)).toEqual([expect.stringMatching(/details\.operationId is not a text$/)]);
    expect(moduleFindings(planted('SCENARIO_LOADED', { scenario: 'idle', previousRows: 83, previousHead: 'a'.repeat(64) }), context, details)).toEqual([
      expect.stringMatching(/keys \{previousHead, previousRows, scenario\}; the module writes \{previousHead, previousRows, reset, scenario\}$/),
    ]);
  });

  it('an engine row with the keys it had, with one key too many, and with a value of another kind', () => {
    expect(simulatorFindings(planted('FAULT_CLEARED', { kind: 'MIC_CLIP', target: 'MIC-01', alertId: 'ALR-000001' }), shapes)).toEqual([
      expect.stringMatching(/keys \{alertId, kind, target\}; the simulator writes \{evt, kind, target\}$/),
    ]);
    expect(simulatorFindings(planted('MARKER_ADDED', { index: 1 }), shapes)).toEqual([expect.stringMatching(/keys \{index\}; the simulator writes \{index, label\}$/)]);
    expect(simulatorFindings(planted('FRAME_HASH', { segment: 1, track: 'VIDEO-01' }), shapes)).toHaveLength(1);
    expect(simulatorFindings(planted('PRECHECK_BLOCKED', { reasonCode: 'TIME_RTC' }), shapes)).toHaveLength(1);
    expect(simulatorFindings(planted('UPDATE_STARTED', { version: '2.4.1' }), shapes)).toHaveLength(1);
    expect(simulatorFindings(planted('SESSION_CANCELLED', {}), shapes)).toHaveLength(1);
    expect(simulatorFindings(planted('DIAGNOSTICS_RUN', { runId: 'DIAG-000001', checks: 8, result: 'PASS' }), shapes)).toHaveLength(1);
    expect(simulatorFindings(planted('WRITE_VERIFIED', { bytesWritten: 'many', volume: 'HDD-EVIDENCE' }), shapes)).toEqual([
      expect.stringMatching(/bytesWritten is a string; the simulator writes number$/),
    ]);
  });

  it('the severities as they were: of a module’s row, of an administration row, of an engine row', () => {
    const severity = ['severity'] as const;
    expect(moduleFindings(planted('PAIRING_SUCCESS', null, { severity: 'SUCCESS' }), context, severity)).toEqual([expect.stringMatching(/severity SUCCESS; the module writes INFO$/)]);
    expect(moduleFindings(planted('DEVICE_CREDENTIAL_ROTATED', null, { severity: 'INFO' }), context, severity)).toEqual([expect.stringMatching(/severity INFO; the module writes WARNING$/)]);
    const exhausted = rows.filter((row) => row.type === 'PAIRING_CODE_CLOSED' && row.details['reason'] === 'EXHAUSTED').slice(0, 1);
    expect(moduleFindings(exhausted.map((row) => ({ ...row, severity: 'INFO' as const })), context, severity)).toEqual([expect.stringMatching(/severity INFO; the module writes WARNING$/)]);
    const reuse = rows.filter((row) => row.type === 'AUTH_FAILED' && row.details['reason'] === 'TOKEN_REUSE').slice(0, 1);
    expect(moduleFindings(reuse.map((row) => ({ ...row, severity: 'CRITICAL' as const })), context, severity)).toEqual([expect.stringMatching(/severity CRITICAL; the module writes WARNING$/)]);

    expect(administrationFindings(planted('USER_DISABLED', null, { severity: 'INFO' }))).toEqual([expect.stringMatching(/severity INFO; the administration module writes WARNING$/)]);
    // A source in which the module no longer writes the three rows inline is refused, not guessed at.
    expect(() => administrationSeverities('export const nothing = 1;')).toThrow(/does not write ROLE_CHANGED in exactly one entry/);
    expect([...administrationSeverities("append({ type: 'ROLE_CHANGED', severity: 'CRITICAL' }); append({ type: 'USER_DISABLED' }); append({ type: 'USER_ENABLED' });")]).toEqual([
      ['ROLE_CHANGED', 'CRITICAL'],
      ['USER_DISABLED', 'INFO'],
      ['USER_ENABLED', 'INFO'],
    ]);

    expect(simulatorFindings(planted('UPDATE_COMPLETED', null, { severity: 'SUCCESS' }), shapes)).toEqual([expect.stringMatching(/severity SUCCESS; the simulator writes INFO$/)]);
    // A fault row has the severity of its kind, not just one the type can have.
    const clip = rows.filter((row) => row.type === 'FAULT_RAISED' && row.details['kind'] === FaultKind.MIC_CLIP).slice(0, 1);
    expect(simulatorFindings(clip.map((row) => ({ ...row, severity: 'CRITICAL' as const })), shapes)).toEqual([]);
    expect(faultSeverityFindings('row', clip.map((row) => ({ ...auditShaped(row), severity: 'CRITICAL', seq: row.seq })))).toEqual([expect.stringMatching(/severity CRITICAL; a fault of kind MIC_CLIP is WARNING$/)]);
  });

  it('a message that is not the builder’s', () => {
    const message = ['message'] as const;
    expect(moduleFindings(planted('AUTH_EXPIRED', null, { message: 'Session of OPR-001 expired' }), context, message)).toEqual([expect.stringMatching(/the message is not the one the module's builder gives$/)]);
    expect(moduleFindings(planted('PAIRING_SUCCESS', null, { message: 'Device DEV-0001 paired' }), context, message)).toHaveLength(1);
    expect(moduleFindings(planted('ACCESS_DENIED', null, { message: 'Access denied: createSession requires SESSION_START' }), context, message)).toHaveLength(1);
  });

  it('the events as they were: other parameters, another severity, an event that is missing, one that no row accounts for', () => {
    const findings = (changed: FixtureEvent[]): string[] => moduleEvents(rows, changed, context).findings;
    expect(findings(plantedEvents('PAIRING_FAILED', (event) => ({ ...event, params: { codeId: 'PCD-000001', attempt: 1 } })))).toEqual([
      expect.stringMatching(/the event PAIRING_FAILED beside it \(sequence \d+\) differs from the module's in the parameter keys \(\{attempt, codeId\} for \{attemptsRemaining\}\)$/),
    ]);
    expect(findings(plantedEvents('AUTH_LOGIN', (event) => ({ ...event, severity: 'INFO' })))).toEqual([expect.stringMatching(/the event AUTH_LOGIN beside it \(sequence \d+\) differs from the module's in the severity$/)]);
    expect(findings(plantedEvents('UNPAIRED', (event) => ({ ...event, params: { deviceId: 'DEV-0001' }, message: 'Tablet unpaired' })))).toEqual([
      expect.stringMatching(/differs from the module's in the parameter keys \(\{deviceId\} for \{\(none\)\}\), the message$/),
    ]);
    expect(findings(plantedEvents('AUTH_EXPIRED', () => null))).toEqual([expect.stringMatching(/^AUTH_EXPIRED \(sequence \d+\): the module writes an event AUTH_EXPIRED beside this row; the fixture holds none at that instant$/)]);
    const stray: FixtureEvent = { seq: 999_999, at: FIXED_NOW - 1, type: 'AUTH_LOGOUT', severity: 'INFO', message: 'Operator signed out', params: { operatorId: 'OPR-001', reason: 'USER' }, sessionId: null, deviceId: null };
    expect(findings([...events, stray])).toEqual([expect.stringMatching(/^event AUTH_LOGOUT \(sequence 999999\): only a module writes this type, and no row of the fixture accounts for it$/)]);

    const engine = (changed: FixtureEvent[]): string[] => shapeFindings('event', changed.map((event) => ({ ...eventShaped(event), seq: event.seq })), eventShapes);
    const one = (type: SimEventType, change: Partial<FixtureEvent>): FixtureEvent[] => events.filter((event) => event.type === type).slice(0, 1).map((event) => ({ ...event, ...change }));
    expect(engine(one('MARKER_ADDED', { params: { index: 1 } }))).toEqual([expect.stringMatching(/keys \{index\}; the simulator writes \{\(none\)\}$/)]);
    expect(engine(one('AUDIT_CHAIN_BROKEN', { params: { scope: 'RING' } }))).toEqual([expect.stringMatching(/keys \{scope\}; the simulator writes \{index, seq\}$/)]);
    expect(engine(one('PRECHECK_BLOCKED', { severity: 'WARNING' }))).toEqual([expect.stringMatching(/severity WARNING; the simulator writes CRITICAL$/)]);
    expect(engine(one('RECOVERY_COMPLETED', { severity: 'SUCCESS' }))).toEqual([expect.stringMatching(/severity SUCCESS; the simulator writes INFO$/)]);
    expect(engine(one('DIAGNOSTICS_COMPLETED', { params: { runId: 'DIAG-000001', result: 'PASS' } }))).toHaveLength(1);
  });

  it('an alert whose row has another text, or stands a second later', () => {
    const tampered = alerts.filter((alert) => alert.kind === FaultKind.AUDIT_TAMPER).slice(0, 1);
    const clip = alerts.filter((alert) => alert.kind === FaultKind.MIC_CLIP).slice(0, 1);
    // As it was: the row of a fault with a text of its own.
    expect(alertFindings(clip.map((alert) => ({ ...alert, message: `Fault ${alert.kind} raised on MIC-01` })), rows, events)).toEqual([
      expect.stringMatching(/0 row\(s\) of type FAULT_RAISED with its kind, target, instant, text and severity; the engine writes one$/),
      expect.stringMatching(/0 event\(s\) of its fault with its instant, text and severity; the engine writes one$/),
    ]);
    // As it was: the chain discontinuity a second after its alert.
    expect(alertFindings(tampered.map((alert) => ({ ...alert, at: alert.at - 1_000 })), rows, events)).toEqual([
      expect.stringMatching(/0 row\(s\) of type AUDIT_CHAIN_DISCONTINUITY/),
      expect.stringMatching(/0 event\(s\) of its fault/),
    ]);
    expect(alertFindings(clip.map((alert) => ({ ...alert, target: 'AUDIO-02' })), rows, events)).toHaveLength(2);
    expect(alertFindings(clip.map((alert) => ({ ...alert, severity: 'CRITICAL' as const })), rows, events)).toHaveLength(2);
  });
});

describe('what a row states agrees with the rows it is about', () => {
  it('sessionsEnded is the number of sessions the fixture ends at that instant, for that reason', () => {
    const { authSessions } = fixture.rows;
    const ended = (reason: string, at: number, by: (session: (typeof authSessions)[number]) => boolean): number =>
      authSessions.filter((session) => session.endReason === reason && session.endedAt === at && by(session)).length;

    const disabled = ofType('USER_DISABLED');
    expect(disabled).toHaveLength(4);
    for (const row of disabled) {
      expect(row.details['sessionsEnded'], `sequence ${row.seq}`).toBe(ended('USER_DISABLED', row.at, (session) => session.operatorId === row.details['targetOperatorId']));
      expect(row.details['sessionsEnded']).toBe(3);
    }
    const revoked = ofType('DEVICE_REVOKED');
    expect(revoked).toHaveLength(10);
    for (const row of revoked) {
      expect(row.details['sessionsEnded'], `sequence ${row.seq}`).toBe(ended('DEVICE_REVOKED', row.at, (session) => session.deviceId === row.deviceId));
    }
    const unpaired = ofType('UNPAIRED');
    expect(unpaired).toHaveLength(10);
    for (const row of unpaired) {
      expect(row.details['sessionsEnded'], `sequence ${row.seq}`).toBe(ended('DEVICE_UNPAIRED', row.at, (session) => session.deviceId === row.deviceId));
    }
    expect(unpaired.map((row) => row.details['sessionsEnded']).sort()).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
    const reused = ofType('AUTH_FAILED').filter((row) => row.details['reason'] === 'TOKEN_REUSE');
    expect(reused).toHaveLength(6);
    for (const row of reused) {
      expect(row.details['sessionsEnded'], `sequence ${row.seq}`).toBe(ended('TOKEN_REUSE', row.at, (session) => session.deviceId === row.deviceId && session.method === 'BIOMETRIC'));
    }
    // Every session row with one of the four reasons is counted by exactly one audit row.
    const total = [...disabled, ...revoked, ...unpaired, ...reused].reduce((sum, row) => sum + Number(row.details['sessionsEnded']), 0);
    expect(total).toBe(authSessions.filter((session) => ['USER_DISABLED', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'TOKEN_REUSE'].includes(session.endReason ?? '')).length);
  });

  it('a refused token: the row of a reuse names the operator of the token that was used before, and only a reuse says what it ended', () => {
    const { biometricTokens, authSessions } = fixture.rows;
    const refused = ofType('AUTH_FAILED').filter((row) => row.details['method'] === 'BIOMETRIC');
    expect(refused).toHaveLength(6);
    for (const row of refused) {
      // A stated reason means a stored token was matched, and that token has an operator.
      if (row.details['reason'] !== undefined) expect(row.actorId, `sequence ${row.seq}`).not.toBeNull();
      expect(row.details['sessionsEnded'] !== undefined, `sequence ${row.seq}`).toBe(row.details['reason'] === 'TOKEN_REUSE');
      expect(row.deviceId).not.toBeNull();
      // The family that was revoked at that instant on that device: two tokens of one operator, the row's actor.
      const family = biometricTokens.filter((token) => token.revokeReason === 'TOKEN_REUSE' && token.revokedAt === row.at && token.deviceId === row.deviceId);
      expect(family).toHaveLength(2);
      expect(new Set(family.map((token) => token.operatorId))).toEqual(new Set([row.actorId]));
      expect(family.some((token) => token.usedAt !== null)).toBe(true);
      // The sessions it ended were that operator's.
      const ended = authSessions.filter((session) => session.endReason === 'TOKEN_REUSE' && session.endedAt === row.at && session.deviceId === row.deviceId);
      expect(new Set(ended.map((session) => session.operatorId))).toEqual(new Set([row.actorId]));
    }
    // The sign-ins with a token are the identity module's rows with the method BIOMETRIC.
    expect(ofType('AUTH_SUCCESS').filter((row) => row.details['method'] === 'BIOMETRIC').length).toBe(authSessions.filter((session) => session.method === 'BIOMETRIC').length);
    for (const row of ofType('BIOMETRIC_ENROLLMENT_CHANGED')) expect(row.details['deviceId'], `sequence ${row.seq}`).toBe(row.deviceId);
  });

  it('a pairing row names the code, the Core and the reason the registry rows hold', () => {
    const { pairedDevices, pairingCodes } = fixture.rows;
    for (const row of ofType('PAIRING_SUCCESS')) {
      const device = pairedDevices.find((candidate) => candidate.id === row.deviceId);
      expect(row.details, `sequence ${row.seq}`).toEqual({ coreDeviceId: base.slices.device.id, certificateFingerprint: base.certificateFingerprint, codeId: device?.pairedWithCodeId });
    }
    expect(base.certificateFingerprint).toMatch(/^[0-9A-F]{2}(?::[0-9A-F]{2}){15}$/);
    for (const row of ofType('DEVICE_REVOKED')) {
      const device = pairedDevices.find((candidate) => candidate.id === row.deviceId);
      expect(row.details['reason'], `sequence ${row.seq}`).toBe(device?.revokeReason);
      expect(row.actorId).toBe(device?.revokedByOperatorId);
    }
    for (const row of ofType('PAIRING_CODE_CLOSED')) {
      expect(row.details['reason'], `sequence ${row.seq}`).toBe(pairingCodes.find((code) => code.id === row.details['codeId'])?.state);
    }
    for (const row of ofType('PAIRING_CODE_ISSUED')) {
      expect(row.details['expiresAt'], `sequence ${row.seq}`).toBe(pairingCodes.find((code) => code.id === row.details['codeId'])?.expiresAt);
    }
    // One failed redeem per counted failure of a code; the row says nothing about the code.
    expect(ofType('PAIRING_FAILED')).toHaveLength(pairingCodes.reduce((sum, code) => sum + code.failedAttempts, 0));
    for (const row of ofType('PAIRING_FAILED')) {
      expect(row.details['lockedUntil'], `sequence ${row.seq}`).toBe(row.details['attemptsRemaining'] === 0 ? row.at + PAIRING_LOCKOUT_MS : null);
    }
    for (const row of ofType('PAIRING_LOCKED')) {
      expect(Number(row.details['retryInMs']), `sequence ${row.seq}`).toBeGreaterThan(0);
      expect(Number(row.details['retryInMs'])).toBeLessThanOrEqual(PAIRING_LOCKOUT_MS);
      expect(row.details['lockedUntil']).toBe(row.at + Number(row.details['retryInMs']));
    }
  });

  it('an administration row names the operator, both roles and the sessions; the reason is there for some and not for others', () => {
    const { operators } = fixture.rows;
    const roles = ofType('ROLE_CHANGED');
    expect(roles).toHaveLength(2);
    for (const row of roles) {
      expect(row.details['from']).not.toBe(row.details['to']);
      expect(operators.find((operator) => operator.id === row.details['targetOperatorId'])?.roleId, `sequence ${row.seq}`).toBe(row.details['to']);
    }
    const administration = [...roles, ...ofType('USER_DISABLED'), ...ofType('USER_ENABLED')];
    expect(administration).toHaveLength(7);
    expect(administration.filter((row) => row.details['reason'] !== undefined)).toHaveLength(3);
    for (const type of ['ROLE_CHANGED', 'USER_DISABLED'] as const) {
      expect(ofType(type).some((row) => row.details['reason'] === undefined), type).toBe(true);
      expect(ofType(type).some((row) => row.details['reason'] !== undefined), type).toBe(true);
    }
    for (const row of administration) expect(operators.some((operator) => operator.id === row.details['targetOperatorId']), `sequence ${row.seq}`).toBe(true);
  });

  it('a refusal names an operation of the registry, and the role holds none of the permissions it names', () => {
    const refusals = [...ofType('ACCESS_DENIED'), ...ofType('EXPORT_DENIED')];
    expect(refusals).toHaveLength(132);
    for (const row of refusals) {
      const role = row.details['role'] as OperatorRole;
      for (const permission of permissionsOfDenialCode(String(row.details['permission']))) {
        expect(roleHas(role, permission as Permission), `sequence ${row.seq}`).toBe(false);
      }
    }
    // The any-of is there, and so are refusals of each of the three roles.
    expect(ofType('ACCESS_DENIED').some((row) => String(row.details['permission']).includes('_OR_'))).toBe(true);
    expect(new Set(ofType('ACCESS_DENIED').map((row) => row.details['role'])).size).toBe(3);
    for (const row of ofType('EXPORT_DENIED')) expect(row.evidenceId, `sequence ${row.seq}`).not.toBeNull();
  });

  it('a sign-in row: the lock times agree with the row’s own instant, and nothing is dated after the clock', () => {
    for (const row of ofType('AUTH_LOCKED')) {
      expect(Number(row.details['retryInMs']), `sequence ${row.seq}`).toBeGreaterThan(0);
      expect(Number(row.details['retryInMs'])).toBeLessThanOrEqual(AUTH_LOCKOUT_MS);
      expect(row.details['lockedUntil']).toBe(row.at + Number(row.details['retryInMs']));
    }
    for (const row of ofType('AUTH_FAILED')) {
      expect(row.details['knownOperator'], `sequence ${row.seq}`).toBe(row.actorId !== null);
      expect(row.details['lockedUntil']).toBe(row.details['attemptsRemaining'] === 0 ? row.at + AUTH_LOCKOUT_MS : null);
    }
    expect(new Set(ofType('AUTH_FAILED').map((row) => row.details['attemptsRemaining']))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(new Set(ofType('AUTH_EXPIRED').map((row) => row.details['reason']))).toEqual(new Set(['IDLE', 'ABSOLUTE']));
    for (const row of rows) {
      const lockedUntil = row.details['lockedUntil'];
      if (typeof lockedUntil === 'number') expect(lockedUntil, `sequence ${row.seq}`).toBeLessThanOrEqual(FIXED_NOW);
    }
  });

  it('an engine row: values the simulator would give for the same facts', () => {
    for (const row of ofType('FAULT_RAISED').filter((candidate) => candidate.details['evt'] !== undefined)) {
      const kind = row.details['kind'] as keyof typeof FaultEvt;
      expect([row.details['evt'], row.details['eventKind']], `sequence ${row.seq}`).toEqual([FaultEvt[kind], FAULT_EVENT_KIND[kind]]);
    }
    for (const row of ofType('FAULT_CLEARED')) expect(row.details['evt'], `sequence ${row.seq}`).toBe(FaultEvt[row.details['kind'] as keyof typeof FaultEvt]);
    for (const row of ofType('AUDIT_CHAIN_DISCONTINUITY')) {
      expect(Number(row.details['index']), `sequence ${row.seq}`).toBeLessThan(AUDIT_RING_SIZE);
      expect(row.details['seq']).toBe(Number(row.details['index']) + 1);
      // The event beside it names the same place in the ring.
      expect(events.filter((event) => event.type === 'AUDIT_CHAIN_BROKEN' && event.at === row.at).map((event) => event.params)).toEqual([{ index: row.details['index'], seq: row.details['seq'] }]);
    }
    for (const row of ofType('SESSION_CANCELLED')) expect(CANCELLABLE_STATES, `sequence ${row.seq}`).toContain(row.details['fromState']);
    for (const row of ofType('PRECHECK_BLOCKED')) {
      expect(row.details['blocks'], `sequence ${row.seq}`).toBe(1);
      expect(Object.values(PrecheckCheckId)).toContain(row.details['checks']);
      expect(Object.values(PrecheckReasonCode)).toContain(row.details['reasons']);
    }
    const frames = ofType('FRAME_HASH');
    for (const row of frames) {
      expect(String(row.details['sha256']), `sequence ${row.seq}`).toMatch(HEX64);
      expect(TRACK_ORDER).toContain(row.details['trackId']);
    }
    expect(new Set(frames.map((row) => row.details['sha256'])).size).toBe(frames.length);
    for (const row of ofType('AUDIT_EXPORTED')) {
      expect(String(row.details['head']), `sequence ${row.seq}`).toMatch(HEX64);
      expect(Number(row.details['rows'])).toBeLessThanOrEqual(AUDIT_RING_SIZE);
      if (row.details['scope'] === 'LOGS') expect(Number(row.details['events'])).toBeLessThanOrEqual(EVENT_RING_SIZE);
    }
    // No exported head is the hash of a row of the chain: it stands for one, and says so in its source.
    const hashes = new Set(rows.map((row) => row.hash));
    expect(ofType('AUDIT_EXPORTED').filter((row) => hashes.has(String(row.details['head'])))).toEqual([]);
    // The updates end at the seeded version in the slot that is active; the policy at the seeded one.
    const started = ofType('UPDATE_STARTED');
    const completed = ofType('UPDATE_COMPLETED');
    expect(started.map((row) => [row.details['to'], row.details['targetSlot']])).toEqual(completed.map((row) => [row.details['version'], row.details['slot']]));
    expect(started[1]?.details['from']).toBe(started[0]?.details['to']);
    expect(completed[completed.length - 1]?.details).toEqual({ version: base.slices.update.currentVersion, slot: base.slices.update.activeSlot, outcome: 'PASS' });
    const policies = ofType('STORAGE_POLICY_CHANGED');
    expect(policies[policies.length - 1]?.details).toEqual({ ...base.slices.storagePolicy });
    // The event of a stopped recording names the session and how long it recorded; a finalization its evidence.
    for (const event of events.filter((candidate) => candidate.type === 'RECORDING_STOPPED')) {
      const session = fixture.rows.sessionHistory.find((row) => row.id === event.sessionId);
      expect(event.params, `event ${event.seq}`).toEqual({ sessionId: event.sessionId, durationMs: session?.durationMs });
    }
    for (const event of events.filter((candidate) => candidate.type === 'FINALIZATION_STARTED')) {
      expect(event.params['evidenceId'], `event ${event.seq}`).toBe(fixture.rows.evidenceItems.find((item) => item.sessionId === event.sessionId)?.id);
    }
  });
});
