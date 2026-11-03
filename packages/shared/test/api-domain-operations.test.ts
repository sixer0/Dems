// Backend task 2026-10-04, plan row W27 (contract C): the schemas of areas 4 to 11 (01_specs §7.8 to
// §7.15, §7.17, §7.18) against the real simulator. A body carries exactly what the hosted simulator
// action takes, an answer is exactly what the action returns or the slices the state holds, and a
// text the simulator would cut is refused before it reaches the engine.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  ALERT_ID_PATTERN,
  API_PAGE_LIMIT_DEFAULT,
  API_PAGE_LIMIT_MAX,
  AUDIT_CHAIN_LINEAGE_MAX,
  AUDIT_EXPORT_LIMITS,
  ActiveCameraRequestSchema,
  AlertListSchema,
  AuditChainLineageEntrySchema,
  AuditChainStatusSchema,
  AuditExportAcceptedSchema,
  AuditExportRequestSchema,
  AuditListQuerySchema,
  AuditPageSchema,
  CAPTURE_CONFIG_CHANGE_OPERATIONS,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CaseNumberScanSchema,
  ChainVerifyResultSchema,
  DIAGNOSTICS_RUN_ID_PATTERN,
  DeviceInventorySchema,
  DiagnosticsRunStartedSchema,
  EVIDENCE_SEARCH_MAX_LENGTH,
  EXPORT_DESTINATION_MAX_LENGTH,
  EXPORT_REASON_MAX_LENGTH,
  EventListQuerySchema,
  EventPageSchema,
  EvidenceDetailSchema,
  EvidenceExportRequestSchema,
  EvidenceListQuerySchema,
  EvidenceMediaRefSchema,
  EvidencePageSchema,
  EvidenceVerifyResultSchema,
  HARDWARE_DEVICE_ID_PATTERN,
  LIST_CURSOR_PATTERN,
  MicClipResetRequestSchema,
  NetworkStatusSchema,
  PageQuerySchema,
  RETENTION_DAYS_RANGE,
  SESSION_TEXT_LIMITS,
  SIM_ACTION_OPERATIONS,
  SecurityStatusSchema,
  ServicesRestartedSchema,
  SessionHistoryPageSchema,
  SessionMarkerRequestSchema,
  SessionNoteRequestSchema,
  SettingsUpdateRequestSchema,
  SimActionExecution,
  StorageDetailSchema,
  StoragePolicyRequestSchema,
  SystemStatusSchema,
  TimeStatusSchema,
  findCoreApiOperation,
  simActionsOfOperation,
  type ActiveCameraRequest,
  type AlertList,
  type AuditExportRequestBody,
  type AuditPage,
  type CaseNumberScan,
  type ChainVerifyResultBody,
  type DeviceInventory,
  type DiagnosticsRunStarted,
  type EventPage,
  type EvidencePage,
  type EvidenceVerifyResultBody,
  type MicClipResetRequest,
  type NetworkStatus,
  type ServicesRestarted,
  type SessionHistoryPage,
  type SessionMarkerRequest,
  type SessionNoteRequest,
  type SettingsUpdateRequest,
  type StorageDetail,
  type StoragePolicyRequest,
  type SystemStatus,
  type TimeStatus,
  EvidenceExportAcceptedSchema,
  EvidenceExportJobSchema,
  EvidenceMediaSessionRequestSchema,
  CORE_API_EXAMPLES,
  EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE,
  EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE,
  EvidenceMediaSessionSchema,
  validateCoreApiResponse,
} from '../src/api';
import { EXAMPLE_INSTANT_MS, EXAMPLE_PLACEHOLDERS } from '../src/api/example-parts';
import { codeUnitBoundMessage } from '../src/api/schema-parts';
import {
  CAPTURE_CONFIG_CHANGE_OPERATION_ID,
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  PLATFORM_DEVICE_NAMES,
  ScenarioName,
  SimTransitionError,
  buildScenarioState,
  createIdleState,
  createManualClock,
  createSim,
  type AuditExportRequest,
  type AuditRow,
  type ChainVerifyResult,
  type EvidenceItem,
  type EvidenceVerifyResult,
  type SessionHistoryEntry,
  type SettingsSlice,
  type SimActions,
  type SimEvent,
  type SimState,
  type StoragePolicy,
  OPERATORS,
  AuditType,
} from '../src/sim';
import * as micPairBed from './support/mic-pair-bed';

// ── Compile-time proofs: a body is what the hosted action takes, an answer is what it returns ────
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Every member name at every depth, optional ones included (`Exact` alone does not see a missing optional member). */
type MemberPaths<T> = T extends readonly (infer Element)[]
  ? MemberPaths<Element>
  : T extends object
    ? { [Key in keyof T & string]-?: Key | `${Key}.${MemberPaths<NonNullable<T[Key]>>}` }[keyof T & string]
    : never;
type Same<A, B> = Exact<A, B> extends true ? Exact<MemberPaths<A>, MemberPaths<B>> : false;
/**
 * Task 3 M2-W7 (blueprint row 48): the contract leads with the C3 v2 shapes; the simulator reaches
 * them with M2-W9 (row 51, SH-07/SH-08). A proof that does not hold YET compiles as the marker and
 * stops compiling the moment parity lands — the marker then forces the flip to `true`. No proof is
 * deleted; none silently passes.
 */
type Parity<A, B> = Same<A, B> extends true ? true : 'PENDING-M2W9';

type Argument<Name extends keyof SimActions, Index extends number = 0> = Parameters<SimActions[Name]>[Index];

/** A member that is `false` does not compile: the schema's type and the simulator's differ. */
const bodiesAreWhatTheActionsTake: {
  note: Exact<SessionNoteRequest['text'], Argument<'addNote'>>;
  marker: Exact<SessionMarkerRequest['label'], Argument<'addMarker'>>;
  camera: Exact<ActiveCameraRequest['cameraId'], Argument<'setActiveCamera'>>;
  clip: Parity<MicClipResetRequest['channel'], Argument<'resetClip'>>;
  policy: Same<StoragePolicyRequest, Argument<'setStoragePolicy'>>;
  policyIsPartial: Same<StoragePolicyRequest, Partial<StoragePolicy>>;
  settings: Same<SettingsUpdateRequest, Argument<'updateSettings'>>;
  settingsIsPartial: Same<SettingsUpdateRequest, Partial<SettingsSlice>>;
  exportAudit: Same<AuditExportRequestBody, NonNullable<Argument<'exportAudit'>>>;
  exportLogs: Same<AuditExportRequestBody, NonNullable<Argument<'exportLogs'>>>;
  exportRequest: Same<AuditExportRequestBody, AuditExportRequest>;
} = {
  note: true,
  marker: true,
  camera: true,
  clip: true,
  policy: true,
  policyIsPartial: true,
  settings: true,
  settingsIsPartial: true,
  exportAudit: true,
  exportLogs: true,
  exportRequest: true,
};

const answersAreWhatTheActionsReturn: {
  verify: Parity<EvidenceVerifyResultBody, ReturnType<SimActions['verify']>>;
  verifyIsTheType: Parity<EvidenceVerifyResultBody, EvidenceVerifyResult>;
  chain: Same<ChainVerifyResultBody, ReturnType<SimActions['verifyAuditChain']>>;
  chainIsTheType: Same<ChainVerifyResultBody, ChainVerifyResult>;
  caseNumber: Exact<CaseNumberScan['caseNumber'], ReturnType<SimActions['scanCaseNumber']>>;
  runId: Exact<DiagnosticsRunStarted['runId'], ReturnType<SimActions['runDiagnostics']>>;
  restarted: Exact<ServicesRestarted['restarted'], ReturnType<SimActions['restartServices']>>;
} = {
  verify: 'PENDING-M2W9', // SH-07 (row 51): the simulated verdict gains files[] + transcriptOk
  verifyIsTheType: 'PENDING-M2W9',
  chain: true,
  chainIsTheType: true,
  caseNumber: true,
  runId: true,
  restarted: true,
};

/** API-6: a read answers the wire form of the slices it names, and a list the elements of its slice. */
const readsAreTheSlices: {
  inventory: Same<DeviceInventory, Pick<SimState, 'device' | 'cameras' | 'mics' | 'otherDevices' | 'ports' | 'activeCameraId' | 'tabletLink' | 'captureConfig'>>;
  storage: Same<StorageDetail, Pick<SimState, 'storage' | 'storagePolicy'>>;
  network: Same<NetworkStatus, Pick<SimState, 'network' | 'tabletLink'>>;
  time: Same<Omit<TimeStatus, 'cameraOffsets'>, Pick<SimState, 'time'>>; // v2 adds server-side camera offsets (C3 §3 op 57); the slice stays the sim's
  system: Same<Omit<SystemStatus, 'components'>, Pick<SimState, 'device' | 'services' | 'update' | 'diagnostics' | 'settings'>>; // fix wave J round two (JW-26): `components` is the Core's own statement of its versions, no slice
  alerts: Same<AlertList, Pick<SimState, 'alerts'>>;
  history: Same<SessionHistoryPage['items'][number], SessionHistoryEntry>;
  evidence: Parity<EvidencePage['items'][number], EvidenceItem>;
  audit: Same<AuditPage['rows'][number], AuditRow>;
  events: Same<EventPage['events'][number], SimEvent>;
} = {
  inventory: true,
  storage: true,
  network: true,
  time: true,
  system: true,
  alerts: true,
  history: true,
  evidence: 'PENDING-M2W9', // SH-07 (row 51): files gains both hashes + chain head, intervals and the transcript summary land in the sim too
  audit: true,
  events: true,
};
void [bodiesAreWhatTheActionsTake, answersAreWhatTheActionsReturn, readsAreTheSlices];

// ── The real simulator ───────────────────────────────────────────────────────────────────────────

const AT = EXAMPLE_INSTANT_MS;
const PAIR = '\u{1F600}'; // one character, two UTF-16 code units
const NUL = '\u0000';
const INVESTIGATOR = 'budi.santoso';
const SUPERVISOR = 'andi.pratama';
const TECHNICIAN = 'rina.wijaya';

function rig(scenario: ScenarioName = 'idle', username?: string) {
  const clock = createManualClock(AT);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  if (username) expect(sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { sim, actions: sim.actions, state: () => sim.store.getState() };
}

/** What travels: the JSON form of a value. */
const wire = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const states = (): [string, SimState][] => {
  const idle = createIdleState({ now: AT, seed: DEFAULT_SEED });
  return [['idle', idle], ...Object.values(ScenarioName).filter((name) => name !== 'idle').map((name) => [name, buildScenarioState(name, createIdleState({ now: AT, seed: DEFAULT_SEED }))] as [string, SimState])];
};

describe('the state reads answer the slices the state holds (API-6)', () => {
  const READS: readonly [string, z.ZodType, (state: SimState) => unknown][] = [
    ['DeviceInventory', DeviceInventorySchema, (s) => ({ device: s.device, cameras: s.cameras, mics: s.mics, otherDevices: s.otherDevices, ports: s.ports, activeCameraId: s.activeCameraId, tabletLink: s.tabletLink, captureConfig: s.captureConfig })],
    ['StorageDetail', StorageDetailSchema, (s) => ({ storage: s.storage, storagePolicy: s.storagePolicy })],
    ['NetworkStatus', NetworkStatusSchema, (s) => ({ network: s.network, tabletLink: s.tabletLink })],
    ['TimeStatus', TimeStatusSchema, (s) => ({ time: s.time })],
    ['SecurityStatus', SecurityStatusSchema, (s) => ({ security: s.security, auditHead: s.audit.head, auditTotal: s.audit.total })],
    ['SystemStatus', SystemStatusSchema, (s) => ({ device: s.device, services: s.services, update: s.update, diagnostics: s.diagnostics, settings: s.settings })],
    ['AlertList', AlertListSchema, (s) => ({ alerts: s.alerts })],
    ['SessionHistoryPage', SessionHistoryPageSchema, (s) => ({ items: s.sessionHistory, nextCursor: null })],
    ['EvidencePage', EvidencePageSchema, (s) => ({ items: s.evidence, nextCursor: null })],
    ['AuditPage', AuditPageSchema, (s) => ({ rows: s.audit.rows, head: s.audit.head, total: s.audit.total, nextCursor: null })],
    ['EventPage', EventPageSchema, (s) => ({ events: s.events, nextCursor: null })],
  ];

  it('each answer schema accepts, unchanged, what the idle state and every scenario hold', () => {
    let parsed = 0;
    for (const [label, state] of states()) {
      for (const [name, schema, build] of READS) {
        const body = wire(build(state));
        const result = schema.safeParse(body);
        expect(result.success, `${name} of ${label}: ${result.success ? '' : JSON.stringify(result.error.issues.slice(0, 2))}`).toBe(true);
        expect(result.data, `${name} of ${label}`).toEqual(body);
        parsed += 1;
      }
    }
    expect(parsed).toBe(4 * READS.length);
  });

  it('each one is strict: a member it does not name is refused, a slice of another read included', () => {
    const state = createIdleState({ now: AT, seed: DEFAULT_SEED });
    for (const [name, schema, build] of READS) {
      const body = wire(build(state)) as Record<string, unknown>;
      for (const extra of [{ auth: state.auth }, { clock: state.clock }, { pairing: state.pairing }, { operators: state.operators }, { note: 'x' }]) {
        expect(schema.safeParse({ ...body, ...wire(extra) }).success, `${name} + ${Object.keys(extra)[0]}`).toBe(false);
      }
      const [first] = Object.keys(body);
      const { [first!]: _dropped, ...rest } = body;
      expect(schema.safeParse(rest).success, `${name} without ${first}`).toBe(false);
    }
  });

  it('every evidence item of the dataset is an `evidence` of getEvidence, with a media reference of one of the two forms', () => {
    const state = createIdleState({ now: AT, seed: DEFAULT_SEED });
    for (const item of state.evidence) {
      const suffix = item.id.slice(-4);
      expect(EvidenceDetailSchema.safeParse(wire({ evidence: item, media: { source: 'DEMO_PACKAGE', packageSuffix: suffix } })).success, item.id).toBe(true);
      expect(EvidenceDetailSchema.safeParse(wire({ evidence: item, media: { source: 'NONE', packageSuffix: null } })).success, item.id).toBe(true);
    }
    // The source and the suffix go together, and the reference holds nothing else: no path, no URL, no file name.
    const ref = (value: unknown) => EvidenceMediaRefSchema.safeParse(value).success;
    expect(ref({ source: 'DEMO_PACKAGE', packageSuffix: null })).toBe(false);
    expect(ref({ source: 'NONE', packageSuffix: '0004' })).toBe(false);
    expect(ref({ source: 'DEMO_PACKAGE', packageSuffix: '4' })).toBe(false);
    expect(ref({ source: 'DEMO_PACKAGE', packageSuffix: '../0004' })).toBe(false);
    expect(ref({ source: 'FILE', packageSuffix: '0004' })).toBe(false);
    for (const extra of ['path', 'url', 'file', 'href']) expect(ref({ source: 'DEMO_PACKAGE', packageSuffix: '0004', [extra]: '/media/0004.mp4' }), extra).toBe(false);
  });
});

describe('the answers of the hosted actions parse with their schemas', () => {
  it('verify: the verdict of every dataset item, passed and failed', () => {
    const { actions, state } = rig('idle', SUPERVISOR);
    let failed = 0;
    let neverSealed = 0;
    for (const item of state().evidence) {
      // Fix wave J (truth rule 3a; JA2-01 / JW-01): a never-sealed item has nothing to verify - refused, and nothing is written.
      if (item.sealedAt === null) {
        neverSealed += 1;
        const rows = state().audit.total;
        expect(() => actions.verify(item.id), item.id).toThrowError(expect.objectContaining({ code: 'UNSEALED_EVIDENCE' }));
        expect(state().audit.total, item.id).toBe(rows);
        expect(state().evidence.find((entry) => entry.id === item.id), item.id).toEqual(item);
        continue;
      }
      const result = actions.verify(item.id);
      expect(EvidenceVerifyResultSchema.parse(wire(result)), item.id).toEqual(result);
      expect(result.tracks.map((track) => track.trackId), item.id).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
      // Fix wave J (JA2-02): every verdict of the simulator says that it is a demonstration.
      expect(result.demonstration, item.id).toBe(true);
      if (!result.ok) failed += 1;
    }
    // The dataset has one item whose AUDIO-02 track fails, and one item that was never sealed.
    expect(failed).toBe(1);
    expect(neverSealed).toBe(1);
    expect(EvidenceVerifyResultSchema.safeParse({ evidenceId: 'EV-20260930-0004', ok: true, at: AT, tracks: [], manifestOk: true, signatureOk: true, note: 'x' }).success).toBe(false);
  });

  it('verifyAuditChain: the view result, intact and broken by AUDIT_TAMPER', () => {
    const { actions, state } = rig('idle');
    const intact = actions.verifyAuditChain();
    expect(ChainVerifyResultSchema.parse(wire(intact))).toEqual(intact);
    expect(intact).toMatchObject({ ok: true, checked: state().audit.rows.length });
    actions.inject('AUDIT_TAMPER');
    const broken = actions.verifyAuditChain();
    expect(ChainVerifyResultSchema.parse(wire(broken))).toEqual(broken);
    expect(broken).toMatchObject({ ok: false, reason: 'HASH_MISMATCH' });
    // The two forms do not mix: a result that is `ok` has no reason, a broken one has no head.
    expect(ChainVerifyResultSchema.safeParse({ ok: true, checked: 1, head: 'a'.repeat(64), reason: 'SEQ_GAP' }).success).toBe(false);
    expect(ChainVerifyResultSchema.safeParse({ ok: false, checked: 1, head: 'a'.repeat(64) }).success).toBe(false);
    expect(ChainVerifyResultSchema.safeParse({ ok: false, checked: 1, index: 1, seq: 2, reason: 'ROW_MISSING' }).success).toBe(false);
  });

  it('AuditChainStatus: the view, the stored chain and the lineage of discarded chains, newest first and at most 20', () => {
    const { actions, state } = rig('idle');
    const head = state().audit.head;
    const entry = { epoch: 0, rows: 82, head, resetAt: AT, actorId: 'OPR-002', scenario: 'idle', reason: 'RESET' } as const;
    const status = {
      view: actions.verifyAuditChain(),
      stored: { ok: true, checked: 82, head, firstBadSeq: null },
      lineage: [entry, { ...entry, epoch: 1, actorId: null, scenario: 'recording', reason: 'SCENARIO_LOAD' }],
      lineageTotal: 2,
    };
    expect(AuditChainStatusSchema.parse(wire(status))).toEqual(status);
    expect(Object.keys(AuditChainStatusSchema.shape)).toEqual(['view', 'stored', 'lineage', 'lineageTotal']);
    expect(Object.keys(AuditChainLineageEntrySchema.shape)).toEqual(['epoch', 'rows', 'head', 'resetAt', 'actorId', 'scenario', 'reason']);
    expect(Object.keys(AuditChainStatusSchema.shape.stored.shape)).toEqual(['ok', 'checked', 'head', 'firstBadSeq']);
    // A broken stored chain names its first bad row.
    expect(AuditChainStatusSchema.safeParse({ ...status, stored: { ok: false, checked: 40, head, firstBadSeq: 41 } }).success).toBe(true);
    // The lineage is bounded, and both members are required.
    expect(AUDIT_CHAIN_LINEAGE_MAX).toBe(20);
    expect(AuditChainStatusSchema.safeParse({ ...status, lineage: Array.from({ length: 20 }, () => entry), lineageTotal: 37 }).success).toBe(true);
    expect(AuditChainStatusSchema.safeParse({ ...status, lineage: Array.from({ length: 21 }, () => entry), lineageTotal: 37 }).success).toBe(false);
    const { lineage: _lineage, ...withoutLineage } = status;
    expect(AuditChainStatusSchema.safeParse(withoutLineage).success).toBe(false);
    const { lineageTotal: _total, ...withoutTotal } = status;
    expect(AuditChainStatusSchema.safeParse(withoutTotal).success).toBe(false);
    // An entry holds integrity values and identifiers only.
    for (const bad of [{ reason: 'CLI' }, { scenario: 'night' }, { head: 'abc' }, { actorId: 'andi.pratama' }, { rows: -1 }, { resetAt: '2026-10-01T03:00:00.000Z' }, { firstSeq: 1 }]) {
      expect(AuditChainLineageEntrySchema.safeParse({ ...entry, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('scanCaseNumber, runDiagnostics and restartServices: the values the actions return', () => {
    const investigator = rig('idle', INVESTIGATOR);
    const caseNumber = investigator.actions.scanCaseNumber();
    expect(CaseNumberScanSchema.parse({ caseNumber })).toEqual({ caseNumber });
    expect(investigator.actions.scanCaseNumber()).not.toBe(caseNumber);

    const technician = rig('idle', TECHNICIAN);
    const runId = technician.actions.runDiagnostics();
    expect(DiagnosticsRunStartedSchema.parse({ runId })).toEqual({ runId });
    expect(runId).toMatch(DIAGNOSTICS_RUN_ID_PATTERN);
    // A run in progress is returned as it is.
    expect(technician.actions.runDiagnostics()).toBe(runId);
    const restarted = technician.actions.restartServices();
    expect(ServicesRestartedSchema.parse({ restarted })).toEqual({ restarted: 17 });
    expect(SystemStatusSchema.shape.diagnostics.safeParse(wire(technician.state().diagnostics)).success).toBe(true);
  });

  it('an accepted audit or log export: the ID of the action, with the rows and the head of its audit row', () => {
    const { actions, state } = rig('idle', SUPERVISOR);
    for (const [scope, run] of [['AUDIT', actions.exportAudit], ['LOGS', actions.exportLogs]] as const) {
      const before = state().audit;
      const result = run(AuditExportRequestSchema.parse({ reason: 'Quarterly audit review' }));
      expect(result).toMatchObject({ ok: true, status: 202 });
      if (!result.ok) throw new Error('the export was refused');
      const row = state().audit.rows.at(-1)!;
      expect(row.type).toBe('AUDIT_EXPORTED');
      const accepted = { exportId: result.exportId, scope, rows: row.details.rows, head: row.details.head };
      expect(AuditExportAcceptedSchema.parse(accepted)).toEqual({ exportId: result.exportId, scope, rows: before.rows.length, head: before.head });
    }
    expect(AuditExportAcceptedSchema.safeParse({ exportId: 'EXP-000032', scope: 'EVIDENCE', rows: 1, head: 'a'.repeat(64) }).success).toBe(false);
  });
});

describe('the texts an operator types: bounded in UTF-16 code units, as the simulator counts them', () => {
  it('a marker label of 80 code units is stored as it was sent; a longer one is refused, never cut', () => {
    expect(SESSION_TEXT_LIMITS).toEqual({ markerLabelMax: 80, noteMax: 2_000 });
    const label = (text: string | undefined) => SessionMarkerRequestSchema.safeParse(text === undefined ? {} : { label: text });
    const widest = `${'m'.repeat(78)}${PAIR}`;
    expect(widest.length).toBe(80);
    for (const text of ['Exhibit A shown', 'm'.repeat(80), widest]) {
      const parsed = label(text);
      expect(parsed.success, text).toBe(true);
      const { actions, state } = rig('recording', INVESTIGATOR);
      actions.addMarker(parsed.data?.label);
      // The engine kept every code unit: it had nothing to cut.
      expect(state().audit.rows.at(-1)).toMatchObject({ type: 'MARKER_ADDED', details: { label: text } });
    }
    // 81 units: refused. The second is 80 characters and 81 units, which `.max(80)` alone would let through.
    for (const text of ['m'.repeat(81), `${'m'.repeat(79)}${PAIR}`]) {
      const parsed = label(text);
      expect(parsed.success, text).toBe(false);
      expect([...new Set(parsed.error?.issues.map((issue) => issue.path.join('.')))]).toEqual(['label']);
    }
    expect(label(`${'m'.repeat(79)}${PAIR}`).error?.issues.map((issue) => issue.message)).toEqual([codeUnitBoundMessage(80)]);
    // Trimmed before it is measured; empty or absent means "Marker n".
    expect(label(`  ${'m'.repeat(80)}  `).data).toEqual({ label: 'm'.repeat(80) });
    expect(label('   ').data).toEqual({ label: '' });
    expect(label(undefined).data).toEqual({});
    const { actions, state } = rig('recording', INVESTIGATOR);
    actions.addMarker(label('   ').data?.label);
    expect(String(state().audit.rows.at(-1)?.details.label)).toMatch(/^Marker \d+$/);
    for (const bad of [`Exhibit${NUL}`, 'Exhibit \ud83d']) expect(label(bad).success, JSON.stringify(bad)).toBe(false);
  });

  it('a note of 1 to 2,000 code units: what the contract accepts the simulator accepts, and what it refuses the simulator refuses', () => {
    const note = (text: unknown) => SessionNoteRequestSchema.safeParse({ text });
    const accepted = ['x', 'Subject confirms the statement.', 'n'.repeat(2_000), PAIR.repeat(1_000), `  ${'n'.repeat(2_000)}  `];
    for (const text of accepted) {
      const parsed = note(text);
      expect(parsed.success, text.slice(0, 20)).toBe(true);
      const { actions, state } = rig('recording', INVESTIGATOR);
      actions.addNote(parsed.data!.text);
      expect(state().session?.notes.at(-1)?.text).toBe(text.trim());
    }
    // 2,001 units, in plain characters and as 1,001 characters of two units each (1,001 code points pass `.max(2000)`).
    for (const text of ['n'.repeat(2_001), PAIR.repeat(1_001), '', '   ']) {
      expect(note(text).success, `${text.length} units`).toBe(false);
      const { actions } = rig('recording', INVESTIGATOR);
      expect(() => actions.addNote(text), `${text.length} units`).toThrow(SimTransitionError);
    }
    for (const bad of [`Note${NUL}`, 'Note \ud83d', '\udc00', 42, null]) expect(note(bad).success, JSON.stringify(bad)).toBe(false);
    expect(SessionNoteRequestSchema.safeParse({}).success).toBe(false);
  });

  it('an export destination of 120 code units is recorded as it was sent; a longer one is refused by all three export requests', () => {
    expect(AUDIT_EXPORT_LIMITS).toEqual({ reasonMin: 5, reasonMax: 500, destinationMax: 120 });
    expect(AUDIT_EXPORT_LIMITS.destinationMax).toBe(EXPORT_DESTINATION_MAX_LENGTH);
    const reason = 'Quarterly audit review';
    const widest = `${'d'.repeat(118)}${PAIR}`;
    expect(widest.length).toBe(120);
    for (const destination of ['Evidence locker 3', 'd'.repeat(120), widest]) {
      const { actions, state } = rig('idle', SUPERVISOR);
      const audit = AuditExportRequestSchema.safeParse({ reason, destination });
      expect(audit.success, destination).toBe(true);
      expect(actions.exportAudit(audit.data)).toMatchObject({ ok: true });
      expect(state().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { reason, destination } });
      expect(actions.exportLogs(audit.data)).toMatchObject({ ok: true });
      expect(state().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { scope: 'LOGS', destination } });
      const evidence = EvidenceExportRequestSchema.safeParse({ reason, destination });
      expect(evidence.success, destination).toBe(true);
      expect(actions.exportEvidence('EV-20260930-0004', { reason, destination })).toMatchObject({ ok: true });
      expect(state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', details: { destination } });
    }
    for (const destination of ['d'.repeat(121), `${'d'.repeat(119)}${PAIR}`, `${'d'.repeat(119)}${PAIR} and more`]) {
      expect(AuditExportRequestSchema.safeParse({ reason, destination }).success, `${destination.length} units`).toBe(false);
      expect(EvidenceExportRequestSchema.safeParse({ reason, destination }).success, `${destination.length} units`).toBe(false);
    }
    // Measured after trimming, like the simulator; the existing request keeps the text as sent.
    expect(AuditExportRequestSchema.parse({ reason, destination: `  ${'d'.repeat(120)}  ` })).toEqual({ reason, destination: 'd'.repeat(120) });
    expect(EvidenceExportRequestSchema.parse({ reason, destination: `  ${'d'.repeat(120)}  ` })).toEqual({ reason, destination: `  ${'d'.repeat(120)}  ` });
    // Omitted or empty: the simulator names its default destination.
    const { actions, state } = rig('idle', SUPERVISOR);
    expect(actions.exportAudit(AuditExportRequestSchema.parse({ reason, destination: '  ' }))).toMatchObject({ ok: true });
    expect(state().audit.rows.at(-1)?.details.destination).toBe('Audit archive (simulated)');
  });

  it('an export reason of 5 to 500 characters is mandatory in Live mode', () => {
    const request = (reason: unknown) => AuditExportRequestSchema.safeParse({ reason });
    for (const reason of ['Audit', '  Audit  ', 'r'.repeat(500)]) {
      expect(request(reason).success, String(reason).slice(0, 10)).toBe(true);
      const { actions } = rig('idle', SUPERVISOR);
      expect(actions.exportAudit(request(reason).data)).toMatchObject({ ok: true });
    }
    for (const reason of ['Audi', '    ', 'r'.repeat(501), PAIR.repeat(251), `Audit${NUL}`, undefined]) expect(request(reason).success, String(reason).slice(0, 10)).toBe(false);
    // The simulator's own bound for a reason that is too short: the server maps it to 422 INVALID_REASON.
    const { actions } = rig('idle', SUPERVISOR);
    expect(actions.exportAudit({ reason: 'Audi' })).toMatchObject({ ok: false, status: 422, reason: 'INVALID_REASON' });
    expect(AuditExportRequestSchema.parse({ reason: '  Quarterly audit  ' })).toEqual({ reason: 'Quarterly audit' });
  });

  it('all three exports need a body with a reason, so an export record never lacks one (01_specs §7.9, §7.13; 03_database_contract T-20)', () => {
    // The stored `exports` row has `reason` NOT NULL with at least 5 characters, and a destination of
    // 1 to 120. The specification makes the reason mandatory for all three, and so does the contract.
    expect(EXPORT_REASON_MAX_LENGTH).toBe(500);
    expect(AUDIT_EXPORT_LIMITS.reasonMax).toBe(EXPORT_REASON_MAX_LENGTH);
    const REQUESTS = { exportEvidence: 'EvidenceExportRequest', exportAudit: 'AuditExportRequest', exportLogs: 'AuditExportRequest' } as const;
    for (const [operationId, schemaName] of Object.entries(REQUESTS)) {
      const operation = findCoreApiOperation(operationId);
      expect(operation?.requestBody, operationId).toEqual({ schema: schemaName, required: true });
      expect(operation?.audit.denial, operationId).toBe('EXPORT_DENIED');
      const schema = CORE_API_SCHEMAS[schemaName];
      const accepts = (body: unknown) => schema.safeParse(body).success;
      // No reason, an empty one, a blank one, one of four characters: refused.
      for (const body of [{}, { destination: 'Evidence locker 3' }, { reason: '' }, { reason: '     ' }, { reason: 'Four' }, { reason: null }, { reason: 5 }]) {
        expect(accepts(body), `${operationId} ${JSON.stringify(body)}`).toBe(false);
      }
      // 5 to 500 code units after trimming, with the text rule.
      expect(accepts({ reason: 'Audit' }), operationId).toBe(true);
      expect(accepts({ reason: 'r'.repeat(500) }), operationId).toBe(true);
      expect(accepts({ reason: `  ${'r'.repeat(500)}  ` }), operationId).toBe(true);
      expect(accepts({ reason: 'r'.repeat(501) }), operationId).toBe(false);
      expect(accepts({ reason: PAIR.repeat(251) }), operationId).toBe(false);
      expect(accepts({ reason: `Audit${NUL}` }), operationId).toBe(false);
      expect(accepts({ reason: 'Audit \ud83d' }), operationId).toBe(false);
      // The destination is optional: the engine names its default, so the stored one is never empty.
      expect(accepts({ reason: 'Audit' }), operationId).toBe(true);
    }
    // What the engine records for an export without a destination is 1 to 120 characters.
    const { actions, state } = rig('idle', SUPERVISOR);
    for (const run of [() => actions.exportAudit({ reason: 'Quarterly audit' }), () => actions.exportLogs({ reason: 'Quarterly audit' }), () => actions.exportEvidence('EV-20260930-0004', { reason: 'Case file transfer', destination: '' })]) {
      expect(run()).toMatchObject({ ok: true });
      const { reason, destination } = state().audit.rows.at(-1)!.details;
      expect(String(reason).trim().length).toBeGreaterThanOrEqual(5);
      expect(String(destination).length).toBeGreaterThan(0);
      expect(String(destination).length).toBeLessThanOrEqual(120);
    }
  });
});

describe('the other bodies of areas 4 to 11', () => {
  it('setStoragePolicy: a partial policy; the days are a whole number from 1 to 3,650, as the simulator checks', () => {
    expect(RETENTION_DAYS_RANGE).toEqual({ min: 1, max: 3_650 });
    const body = (value: unknown) => StoragePolicyRequestSchema.safeParse(value);
    for (const value of [{}, { retentionPolicy: 'YEAR_1' }, { retentionDays: 1 }, { retentionDays: 3_650 }, { autoArchive: false }, { retentionPolicy: 'DAYS_30', retentionDays: 45, autoArchive: true }]) {
      expect(body(value).success, JSON.stringify(value)).toBe(true);
      const { actions, state } = rig('idle', TECHNICIAN);
      actions.setStoragePolicy(body(value).data!);
      // The answer is the slice after the change.
      expect(CORE_API_SCHEMAS.StoragePolicySlice.safeParse(wire(state().storagePolicy)).success, JSON.stringify(value)).toBe(true);
    }
    const { actions, state } = rig('idle', SUPERVISOR);
    actions.setStoragePolicy(body({ retentionPolicy: 'YEAR_1' }).data!);
    expect(state().storagePolicy).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true });
    for (const value of [{ retentionDays: 0 }, { retentionDays: 3_651 }, { retentionDays: 1.5 }]) {
      expect(body(value).success, JSON.stringify(value)).toBe(false);
      expect(() => actions.setStoragePolicy(value), JSON.stringify(value)).toThrow(SimTransitionError);
    }
    for (const value of [{ retentionDays: '90' }, { retentionPolicy: 'FOREVER' }, { autoArchive: 'yes' }]) expect(body(value).success, JSON.stringify(value)).toBe(false);
    // API-4: an unknown key is dropped.
    expect(body({ autoArchive: true, owner: 'x' }).data).toEqual({ autoArchive: true });
  });

  it('updateSettings: the members of the settings slice, each optional; an unknown key is dropped where the slice refuses it', () => {
    const body = (value: unknown) => SettingsUpdateRequestSchema.safeParse(value);
    expect(Object.keys(SettingsUpdateRequestSchema.shape)).toEqual(Object.keys(CORE_API_SCHEMAS.SettingsSlice.shape));
    for (const value of [{}, { presentationMode: true }, { timeFormat: '12', notifyWarnings: false, notifySound: true }]) {
      expect(body(value).success, JSON.stringify(value)).toBe(true);
      const { actions, state } = rig('idle', INVESTIGATOR);
      actions.updateSettings(body(value).data!);
      expect(state().settings).toMatchObject(value);
      expect(CORE_API_SCHEMAS.SettingsSlice.parse(wire(state().settings))).toEqual(state().settings);
    }
    // `setPresentationMode(true)` of the simulator is this body.
    const { actions, state } = rig('idle');
    actions.setPresentationMode(true);
    expect(state().settings.presentationMode).toBe(body({ presentationMode: true }).data?.presentationMode);
    for (const value of [{ timeFormat: '13' }, { presentationMode: 'on' }, { notifySound: 1 }]) expect(body(value).success, JSON.stringify(value)).toBe(false);
    expect(body({ presentationMode: true, theme: 'dark' }).data).toEqual({ presentationMode: true });
    expect(CORE_API_SCHEMAS.SettingsSlice.safeParse({ ...state().settings, theme: 'dark' }).success).toBe(false);
  });

  it('setActiveCamera and resetMicClip: one of the two tracks of their kind', () => {
    for (const cameraId of ['VIDEO-01', 'VIDEO-02']) expect(ActiveCameraRequestSchema.safeParse({ cameraId }).success, cameraId).toBe(true);
    for (const cameraId of ['AUDIO-01', 'VIDEO-03', 'CAM-01', '', undefined]) expect(ActiveCameraRequestSchema.safeParse({ cameraId }).success, String(cameraId)).toBe(false);
    for (const channel of ['AUDIO-01', 'AUDIO-02']) expect(MicClipResetRequestSchema.safeParse({ channel }).success, channel).toBe(true);
    for (const channel of ['VIDEO-01', 'MIC-01', 'AUDIO-03', undefined]) expect(MicClipResetRequestSchema.safeParse({ channel }).success, String(channel)).toBe(false);
    const { actions, state } = rig('idle', INVESTIGATOR);
    actions.setActiveCamera(ActiveCameraRequestSchema.parse({ cameraId: 'VIDEO-02' }).cameraId);
    expect(state().activeCameraId).toBe('VIDEO-02');
  });

  it('the path parameters: every device, alert and run ID the simulator mints fits its pattern', () => {
    const { actions, state } = rig('idle', TECHNICIAN);
    const deviceIds = [...state().cameras.map((camera) => camera.deviceId), ...state().mics.map((mic) => mic.deviceId), ...state().otherDevices.map((device) => device.id), ...Object.keys(PLATFORM_DEVICE_NAMES)];
    expect(deviceIds).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'REC-INDICATOR', 'TABLET', 'GNSS', 'TPM', 'FRONT-PANEL']);
    for (const id of deviceIds) {
      expect(id, id).toMatch(HARDWARE_DEVICE_ID_PATTERN);
      // IDENTIFY is the one command every device accepts.
      actions.deviceCommand(id, 'IDENTIFY');
      expect(state().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', deviceId: id });
    }
    for (const bad of ['cam-01', 'CAM 01', '../CAM-01', 'CAM_01', '', '1CAM', `CAM-01${NUL}`, 'C'.repeat(33)]) expect(HARDWARE_DEVICE_ID_PATTERN.test(bad), JSON.stringify(bad)).toBe(false);
    actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-02' });
    expect(state().alerts[0]?.id).toMatch(ALERT_ID_PATTERN);
    for (const operationId of ['restartDevice', 'testDeviceSignal', 'identifyDevice']) expect(findCoreApiOperation(operationId)?.pathParam?.pattern, operationId).toBe(HARDWARE_DEVICE_ID_PATTERN);
    expect(findCoreApiOperation('acknowledgeAlert')?.pathParam?.pattern).toBe(ALERT_ID_PATTERN);
  });
});

describe('the list queries (API-9; decision D51)', () => {
  it('paging: an opaque cursor and a limit from 1 to 200, with 50 as the server\'s default', () => {
    expect([API_PAGE_LIMIT_DEFAULT, API_PAGE_LIMIT_MAX]).toEqual([50, 200]);
    expect(PageQuerySchema.parse({})).toEqual({});
    expect(PageQuerySchema.parse({ cursor: '1790819100000-SES-20261001-0022', limit: 200 })).toEqual({ cursor: '1790819100000-SES-20261001-0022', limit: 200 });
    // The server parses the text of the URL; a client passes a number. Both give the number.
    expect(PageQuerySchema.parse({ limit: '20' })).toEqual({ limit: 20 });
    expect(PageQuerySchema.parse({ limit: 1 })).toEqual({ limit: 1 });
    for (const limit of [0, 201, 1.5, -1, '', 'ten', '0', '201', null]) expect(PageQuerySchema.safeParse({ limit }).success, JSON.stringify(limit)).toBe(false);
    for (const cursor of ['', 'a b', 'a/b', 'a_b', 'c'.repeat(129), `81${NUL}`, 'a?b', 42]) expect(PageQuerySchema.safeParse({ cursor }).success, JSON.stringify(cursor)).toBe(false);
    // No bearer value fits a cursor, so a cursor in a URL is never a credential.
    for (const secret of [EXAMPLE_PLACEHOLDERS.sessionToken, EXAMPLE_PLACEHOLDERS.deviceCredential, EXAMPLE_PLACEHOLDERS.biometricToken]) {
      expect(LIST_CURSOR_PATTERN.test(secret), secret.slice(0, 4)).toBe(false);
    }
    expect(LIST_CURSOR_PATTERN.test('81')).toBe(true);
  });

  it('listEvidence: status, case type and a search text', () => {
    const query = (value: unknown) => EvidenceListQuerySchema.safeParse(value);
    expect(Object.keys(EvidenceListQuerySchema.shape)).toEqual(['status', 'caseType', 'q', 'cursor', 'limit']);
    expect(query({ status: 'SEALED', caseType: 'SAKSI', q: '  LP/2026/0930  ', limit: '50' }).data).toEqual({ status: 'SEALED', caseType: 'SAKSI', q: 'LP/2026/0930', limit: 50 });
    expect(EVIDENCE_SEARCH_MAX_LENGTH).toBe(100);
    expect(query({ q: 'q'.repeat(100) }).success).toBe(true);
    for (const value of [{ status: 'OPEN' }, { caseType: 'WITNESS' }, { q: '' }, { q: '   ' }, { q: 'q'.repeat(101) }, { q: PAIR.repeat(51) }, { q: `a${NUL}b` }, { q: 'a\ud83d' }]) {
      expect(query(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it('listAuditRows: five filters and the order by seq', () => {
    const query = (value: unknown) => AuditListQuerySchema.safeParse(value);
    expect(Object.keys(AuditListQuerySchema.shape)).toEqual(['category', 'type', 'actorId', 'sessionId', 'evidenceId', 'order', 'cursor', 'limit']);
    const full = { category: 'EVIDENCE', type: 'EVIDENCE_EXPORTED', actorId: 'OPR-002', sessionId: 'SES-20260930-0014', evidenceId: 'EV-20260930-0004', order: 'DESC', cursor: '81', limit: 200 };
    expect(query(full).data).toEqual(full);
    // The new audit types of the backend task are filter values too.
    for (const type of ['ACCESS_DENIED', 'ROLE_CHANGED', 'PAIRING_CODE_ISSUED']) expect(query({ type }).success, type).toBe(true);
    for (const value of [{ category: 'EXPORT' }, { type: 'LOGIN' }, { actorId: 'andi.pratama' }, { sessionId: 'SES-1' }, { evidenceId: 'EV-4' }, { order: 'desc' }, { order: 'NEWEST' }]) {
      expect(query(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it('listEvents: category, type and severity', () => {
    const query = (value: unknown) => EventListQuerySchema.safeParse(value);
    expect(Object.keys(EventListQuerySchema.shape)).toEqual(['category', 'type', 'severity', 'cursor', 'limit']);
    expect(query({ category: 'EXPORT', type: 'EVIDENCE_SEALED', severity: 'SUCCESS' }).success).toBe(true);
    for (const value of [{ category: 'PAIRING' }, { type: 'EVIDENCE_EXPORTED_TWICE' }, { severity: 'ERROR' }, { order: 'DESC', limit: 0 }]) {
      expect(query(value).success, JSON.stringify(value)).toBe(false);
    }
    // An event list has one order, by seq; `order` is not one of its members and is dropped.
    expect(query({ order: 'DESC' }).data).toEqual({});
  });
});

describe('the 53 simulator actions and the operations they reach (01_specs §7.17; task 3 SH-18, R-9; pass D6 CS-09: applyStorageVolume, 48 -> 49; task 4 row 185: registerCaptureMicrophone, 49 -> 50; row 195: readdressCaptureDevice, 50 -> 51; row V7: storeCaptureDeviceProfiles, 51 -> 52; row RD2: retireCaptureDevice, 52 -> 53)', () => {
  const names = Object.keys(SIM_ACTION_OPERATIONS) as (keyof typeof SIM_ACTION_OPERATIONS)[];
  const byExecution = (execution: string) => names.filter((name) => SIM_ACTION_OPERATIONS[name].execution === execution);

  it('names exactly the actions of the real simulator', () => {
    const { actions } = rig('idle');
    expect([...names].sort()).toEqual(Object.keys(actions).sort());
    expect(names).toHaveLength(53);
  });

  it('33 are hosted, 9 server-native, 1 is not available and 10 are internal', () => {
    expect([SimActionExecution.HOSTED, SimActionExecution.SERVER_NATIVE, SimActionExecution.NOT_AVAILABLE, SimActionExecution.INTERNAL].map((execution) => byExecution(execution).length)).toEqual([33, 9, 1, 10]);
    // Blueprint row 66 (SH-18, C3 §2.4): the hosted pair of the capture selector and the mic switch,
    // the last two members. One is three operations (78, 79, 80), as `deviceCommand` is.
    expect(byExecution('hosted').slice(-2)).toEqual(['setCaptureConfig', 'switchAudioSource']);
    expect(SIM_ACTION_OPERATIONS.setCaptureConfig.operations).toEqual(['updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic']);
    expect(Object.values(CAPTURE_CONFIG_CHANGE_OPERATIONS)).toEqual([...SIM_ACTION_OPERATIONS.setCaptureConfig.operations]);
    expect(CAPTURE_CONFIG_CHANGE_OPERATIONS).toEqual(CAPTURE_CONFIG_CHANGE_OPERATION_ID);
    expect(SIM_ACTION_OPERATIONS.switchAudioSource.operations).toEqual(['switchAudioSource']);
    expect(byExecution('server-native')).toEqual(['signIn', 'signInWithBiometric', 'recordBiometricFailure', 'signOut', 'touch', 'loadScenario', 'resetDemo', 'pair', 'unpair']);
    // X-1 and X-2: no operation issues a session without a credential, and no client sets the tablet link.
    expect(byExecution('not-available')).toEqual(['signInWithSecurityKey']);
    // SH-18: the capture supervisor's three actions join the tablet link; no client reaches any of the four.
    // R-9 (row 132; C3 §2.6): the adoption's `registerCaptureDevice` is the fifth - run by the Core inside
    // operation 96's unit, reached by no client and by no operation of its own.
    // Task 4 row 185: `registerCaptureMicrophone` is the seventh - run by the Core inside operation 99's unit.
    expect(byExecution('internal')).toEqual(['setTabletLink', 'applyCaptureTelemetry', 'raiseCaptureWarning', 'clearCaptureWarning', 'applyStorageVolume', 'registerCaptureDevice', 'registerCaptureMicrophone', 'readdressCaptureDevice', 'storeCaptureDeviceProfiles', 'retireCaptureDevice']);
    // Task 4 row 195: `readdressCaptureDevice` is the eighth - run by the Core inside operation 100's unit.
    // Task 4 row V7: `storeCaptureDeviceProfiles` is the ninth - run by the Core inside the unit of operation 108's storing test.
    // Task 4 row RD2: `retireCaptureDevice` is the tenth - run by the Core inside operation 111's unit; no operation of its own.
    for (const name of [...byExecution('not-available'), ...byExecution('internal')]) expect(SIM_ACTION_OPERATIONS[name].operations, name).toEqual([]);
    expect(CORE_API_OPERATIONS.filter((operation) => /tablet-?link|security-?key|telemetry|capture-?warning|register/i.test(operation.path))).toEqual([]);
  });

  it('42 actions reach 45 operations, every one of them in the registry; the other 66 are reads and server functions', () => {
    const reaching = names.filter((name) => SIM_ACTION_OPERATIONS[name].operations.length > 0);
    expect(reaching).toHaveLength(42);
    const reached = [...new Set(reaching.flatMap((name) => [...SIM_ACTION_OPERATIONS[name].operations]))];
    expect(reached).toHaveLength(45);
    for (const operationId of reached) expect(findCoreApiOperation(operationId), operationId).toBeDefined();
    // Task 3 M2-W7 adds fourteen operations, none reached by a simulator action (the thirteen
    // simulated ones are answered by the sim route table, op 88 is live): 89 - 41 = 48. Task 3 M6 row
    // 113 adds the three STT configuration operations 90-92, also answered by the sim route table and
    // reached by no simulator action: 92 - 41 = 51. Blueprint row 66 lands the hosted pair of SH-18:
    // operations 78, 79, 80 (`setCaptureConfig`) and 81 (`switchAudioSource`) are reached now, 51 - 4 = 47.
    // Task 3 R-9..R-11 (row 132, D106) add the five operations 93-97, answered by the sim route table
    // and by server modules, reached by no simulator action: 97 - 45 = 52. Task 4 row 63 adds the two
    // sound-card operations 98-99, answered by the sim route table, reached by no action: 99 - 45 = 54.
    // Task 4 row 194 adds operation 100 (the confirmed re-address), reached by no action: 100 - 45 = 55.
    // Task 4 row 102 adds the seven commissioning operations 101-107, reached by no action: 107 - 45 = 62.
    // Task 4 row V3 adds operation 108 (the stored-credential connection test), reached by no action: 108 - 45 = 63.
    // Task 4 row 116 adds operations 109-110 (the installation acceptance and its revocation), reached by no action: 110 - 45 = 65.
    // Task 4 row RD2 adds operation 111 (the retirement of a device), answered by the sim route table, reached by no action: 111 - 45 = 66.
    // Task 4 row D53 adds operations 112-113 (the live preview, the idle meters), live only, reached by no action: 113 - 45 = 68.
    // The LCD bridge task adds operation 114 (the panel's own firmware word), live only, reached by no action: 114 - 45 = 69.
    // REVISED 2026-11-02 (principal): RB-9 as amended adds createUser, updateUser and deleteUser, live
    // only and answered by the Core server alone, so no simulator action reaches them: 117 - 45 = 72.
    expect(CORE_API_OPERATIONS.length - reached.length).toBe(72);
    // `deviceCommand` is three operations with one permission each; two settings actions share one.
    expect(SIM_ACTION_OPERATIONS.deviceCommand.operations).toEqual(['restartDevice', 'testDeviceSignal', 'identifyDevice']);
    expect(simActionsOfOperation('updateSettings')).toEqual(['setPresentationMode', 'updateSettings']);
    expect(simActionsOfOperation('listAuditRows')).toEqual([]);
    // An action is a command, except the chain check, which reads.
    const gets = reached.filter((operationId) => findCoreApiOperation(operationId)?.method === 'get');
    expect(gets).toEqual(['verifyAuditChain']);
  });

  it('an operation of contract C that hosts an action says which, and its permission is the one the simulator checks', () => {
    const contractC = CORE_API_OPERATIONS.filter((operation) => /§7\.(8|9|10|11|12|13|14|15), /.test(operation.source));
    expect(contractC).toHaveLength(38);
    let hosted = 0;
    for (const operation of contractC) {
      const actions = simActionsOfOperation(operation.operationId);
      if (actions.length === 0) {
        // A read of the state or of a list.
        expect(operation.method, operation.operationId).toBe('get');
        expect(operation.description, operation.operationId).toMatch(/In Simulated mode a client reads/);
        continue;
      }
      hosted += 1;
      expect(operation.description, operation.operationId).toContain('the server runs the shared simulator action `');
      const named = actions.some((name) => operation.description.includes(`\`${name}`));
      expect(named, `${operation.operationId}: ${actions.join(', ')}`).toBe(true);
    }
    // 26 of the 38 host an action; the other 12 are reads.
    expect(hosted).toBe(26);
    // The simulator's own rule for the three device commands and the retention policy (RB-7).
    const refused = (username: string, run: (actions: SimActions) => void) => {
      const { actions } = rig('idle', username);
      try {
        run(actions);
        return false;
      } catch {
        return true;
      }
    };
    expect(refused(SUPERVISOR, (actions) => actions.deviceCommand('CAM-01', 'RESTART'))).toBe(true);
    expect(refused(TECHNICIAN, (actions) => actions.deviceCommand('CAM-01', 'RESTART'))).toBe(false);
    expect(refused(INVESTIGATOR, (actions) => actions.setStoragePolicy({ autoArchive: false }))).toBe(true);
    expect(refused(SUPERVISOR, (actions) => actions.setStoragePolicy({ autoArchive: false }))).toBe(false);
    expect(refused(TECHNICIAN, (actions) => actions.setStoragePolicy({ autoArchive: false }))).toBe(false);
  });
});

// Integration pass D1b (decision D133), seam 12: ops 42 / 87 / 88, additive (ruling D140): the
// optional `fileId` body of op 88, `jobId` on the 202 of op 42, `kind` on the export request row,
// the documented refusals.
describe('the export job and the camera file of the media session', () => {
  const { START, harness } = micPairBed;

  describe('operations 42, 87 and 88: additive and optional (ruling D140; pass D1b, seam 12)', () => {
    it('op 88 takes an optional body that names the camera file, and nothing else', () => {
      for (const body of [{}, { fileId: 'VIDEO-01' }, { fileId: 'VIDEO-02' }]) expect(EvidenceMediaSessionRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(true);
      for (const body of [{ fileId: 'AUDIO-01' }, { fileId: 'VIDEO-03' }, { fileId: 1 }, { fileId: 'VIDEO-01', token: 'x' }, { file: 'VIDEO-01' }, 'VIDEO-01', null]) {
        expect(EvidenceMediaSessionRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
      }
      const operation = findCoreApiOperation('createEvidenceMediaSession');
      expect(operation?.requestBody).toEqual({ schema: 'EvidenceMediaSessionRequest', required: false });
      expect(Object.keys(operation?.responses ?? {}).map(Number).sort((a, b) => a - b)).toEqual([201, 400, 401, 403, 404, 409, 422]);
      for (const code of ['EVIDENCE_CASE_SCOPE', 'MEDIA_NOT_AVAILABLE', 'PACKAGE_MISSING', 'SESSION_KEY_UNAVAILABLE', 'MEDIA_SESSION_INVALID', 'MEDIA_SESSION_EXPIRED', 'CREDENTIAL_STORE_NOT_READY']) {
        expect(operation?.description, code).toContain(code);
      }
    });

    it('op 42: the 202 may carry the job id in the EXPJ- form; the request names its kind; 409 documents EXPORT_IN_PROGRESS', () => {
      const accepted = { exportId: 'EXP-000012', evidenceId: 'EV-20260930-0004', status: 'QUEUED' };
      expect(EvidenceExportAcceptedSchema.safeParse(accepted).success).toBe(true);
      expect(EvidenceExportAcceptedSchema.safeParse({ ...accepted, jobId: 'EXPJ-000012' }).success).toBe(true);
      for (const bad of ['EXP-000012', 'EXPJ-12', 'expj-000012', '']) expect(EvidenceExportAcceptedSchema.safeParse({ ...accepted, jobId: bad }).success, bad).toBe(false);
      const request = { reason: 'Case file handover for prosecutor review' };
      for (const kind of ['PACKAGE', 'COMPOSITE']) expect(EvidenceExportRequestSchema.safeParse({ ...request, kind }).success, kind).toBe(true);
      expect(EvidenceExportRequestSchema.safeParse({ ...request, kind: 'ARCHIVE' }).success).toBe(false);
      expect(findCoreApiOperation('exportEvidence')?.responses[409]?.description).toContain('EXPORT_IN_PROGRESS');
      const job = { jobId: 'EXPJ-000012', evidenceId: 'EV-20260930-0004', kind: 'COMPOSITE', status: 'FAILED', progressPct: 0, etaMs: null, derived: true, createdAt: START };
      for (const failureReason of ['COMPOSITE_ENCODER_NOT_SELECTED', 'EXPORT_INTERRUPTED']) expect(EvidenceExportJobSchema.safeParse({ ...job, failureReason }).success, failureReason).toBe(true);
      expect(EvidenceExportJobSchema.safeParse({ ...job, failureReason: 'not a code' }).success).toBe(false);
      for (const code of ['COMPOSITE_ENCODER_NOT_SELECTED', 'EXPORT_INTERRUPTED']) expect(EvidenceExportJobSchema.shape.failureReason.description, code).toContain(code);
    });

    it('the simulator: the 202 names the job, the request row carries the kind that was named, and op 87 answers that job', () => {
      const h = harness('idle', 'INVESTIGATOR');
      h.sim.actions.signOut();
      const supervisor = OPERATORS.find((candidate) => candidate.role === 'SUPERVISOR');
      if (supervisor === undefined) throw new Error('no seeded supervisor');
      expect(h.sim.actions.signIn(supervisor.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
      const sealed = h.state().evidence.find((item) => item.status === 'SEALED');
      if (sealed === undefined) throw new Error('the dataset holds no sealed item');
      const path = `/api/v1/evidence/${sealed.id}/export`;
      const reason = 'Case file handover for prosecutor review';

      // Fix wave J (truth rule 3d; JA2-03 / JW-03): a COMPOSITE is an output this build cannot produce. It is refused
      // before anything is recorded - no export id, no row, no event, the item as it was - and never delivered as a Package.
      const before = { rows: h.state().audit.total, events: h.state().events.length, item: h.state().evidence.find((item) => item.id === sealed.id) };
      const composite = h.sim.request({ method: 'POST', path, body: { reason, kind: 'COMPOSITE' } });
      expect(composite.status).toBe(409);
      expect(composite.body).toMatchObject({ error: { code: 'COMMAND_UNSUPPORTED' } });
      expect(h.state().audit.total).toBe(before.rows);
      expect(h.state().events.length).toBe(before.events);
      expect(h.state().evidence.find((item) => item.id === sealed.id)).toEqual(before.item);

      // The kind that IS available is named on the row and answered by op 87.
      const named = h.sim.request({ method: 'POST', path, body: { reason, kind: 'PACKAGE' } });
      expect(named.status).toBe(202);
      const receipt = named.body as { exportId: string; jobId: string };
      expect(EvidenceExportAcceptedSchema.safeParse(receipt).success).toBe(true);
      expect(receipt.jobId).toBe(`EXPJ-${receipt.exportId.slice('EXP-'.length)}`);
      expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', details: { exportId: receipt.exportId, kind: 'PACKAGE' } });
      const job = h.sim.request({ method: 'GET', path: `/api/v1/evidence/exports/${receipt.jobId}` });
      expect(job.status).toBe(200);
      expect(EvidenceExportJobSchema.safeParse(job.body).success).toBe(true);
      expect(job.body).toMatchObject({ jobId: receipt.jobId, evidenceId: sealed.id, kind: 'PACKAGE', derived: false, status: 'COMPLETE' });

      // A request that names no kind writes none (the row is what it was before; absent reads as PACKAGE).
      const plain = h.sim.request({ method: 'POST', path, body: { reason } });
      expect(plain.status).toBe(202);
      expect('kind' in (h.state().audit.rows.at(-1)?.details ?? {})).toBe(false);
      expect(h.sim.request({ method: 'GET', path: `/api/v1/evidence/exports/${(plain.body as { jobId: string }).jobId}` }).body).toMatchObject({ kind: 'PACKAGE', derived: false });
      // A kind outside the two is not written either.
      h.sim.request({ method: 'POST', path, body: { reason, kind: 'ARCHIVE' } });
      expect('kind' in (h.state().audit.rows.at(-1)?.details ?? {})).toBe(false);
    });
  });
});

// Fix wave K Z1 (gate finding G94b-01, ruling D224 (1); `contract_wave_k.md` "Z1"): operation 88
// states the INDEXED VIEW of a sealed camera file additively - ONE optional member name, `seekIndex`,
// on the request body and on the answer - and the contract totals do not move.
describe('the indexed view of the media session', () => {
  const MEMBER = 'seekIndex';

  describe('operation 88: the indexed view is an additive optional member', () => {
    it('the exported example states it by name, and it is a valid answer of the operation', () => {
      expect(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE[MEMBER]).toBe(true);
      expect(EvidenceMediaSessionSchema.safeParse(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE).success).toBe(true);
      expect(validateCoreApiResponse('createEvidenceMediaSession', 201, EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE).ok).toBe(true);
    });

    it('OPTIONAL on the answer: without it the answer is the one of before; `false` and other values are no value of it', () => {
      const { [MEMBER]: _stated, ...plain } = EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE;
      expect(EvidenceMediaSessionSchema.safeParse(plain).success).toBe(true);
      for (const value of [false, 'true', 1, null]) expect(EvidenceMediaSessionSchema.safeParse({ ...plain, [MEMBER]: value }).success).toBe(false);
    });

    it('OPTIONAL on the request: `{}`, `{ fileId }`, `{ seekIndex: true }` and both are bodies; `seekIndex: false` and an unknown member are not', () => {
      for (const body of [{}, { fileId: 'VIDEO-02' }, { [MEMBER]: true }, EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE]) expect(EvidenceMediaSessionRequestSchema.safeParse(body).success).toBe(true);
      for (const body of [{ [MEMBER]: false }, { fileId: 'VIDEO-01', [MEMBER]: 'yes' }, { fileId: 'VIDEO-01', view: 'INDEXED' }]) expect(EvidenceMediaSessionRequestSchema.safeParse(body).success).toBe(false);
    });

    it('the operation shows both in its examples (request and 201)', () => {
      const examples = CORE_API_EXAMPLES.createEvidenceMediaSession;
      expect(examples?.request?.['indexedView']?.value).toEqual(EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE);
      const answers = (examples?.responses[201] ?? {}) as Record<string, { value: unknown } | undefined>;
      const valueOf = (name: string): Record<string, unknown> => (answers[name]?.value ?? {}) as Record<string, unknown>;
      expect(valueOf('indexedView')[MEMBER]).toBe(true);
      // The first example is the stream of before: no member.
      expect([Object.keys(valueOf('video01')).length > 0, MEMBER in valueOf('video01')]).toEqual([true, false]);
    });

    it('the totals do not move with the indexed view: 117 operations (40 GET / 77 POST; 97 + the two of task 4 row 63 + the one of row 194 + the seven of row 102 + the one of row V3 + the two of row 116 + the one of row RD2 + the two of row D53 + the one of the LCD bridge task + the three of RB-9 as amended), 90 audit types (67 + the ten of task 4 row 19 + the one of row 201 + the four of row V3 + the one of row R1b + the two of row N2 + the one of row RD2 + the one of row D53 + the three of RB-9 as amended)', () => {
      // REVISED 2026-11-02 (principal): three user-management operations and audit types added to the registry.
      const methods = CORE_API_OPERATIONS.map((operation) => String(operation.method).toUpperCase());
      expect([methods.length, methods.filter((method) => method === 'GET').length, methods.filter((method) => method === 'POST').length]).toEqual([117, 40, 77]);
      expect(Object.keys(AuditType)).toHaveLength(90);
    });
  });
});
