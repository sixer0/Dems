// Backend task 2026-10-04, plan row W22 (contract B): the Core state on the wire, one schema per
// replicated slice (01_specs §3.2, §7.18, §9.3, §9.5; API-5, API-6).
//
// No hand-written fixture: every slice parsed here is built by the shared simulator
// (`createIdleState`, the scenarios, and a headless engine driven through its actions). The
// compile-time proofs hold each schema's type to the simulator's type, in both directions.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AudioSliceSchema,
  AudioStatusResponseSchema,
  CORE_API_EXAMPLES,
  CORE_API_SCHEMAS,
  DeviceHealthResponseSchema,
  OPENAPI_EXAMPLE_INSTANT,
  OperatorSchema,
  REPLICATED_SLICE_NAMES,
  REPLICATED_SLICE_SCHEMAS,
  ReplicatedOperatorSchema,
  ReplicatedStateSchema,
  SHA256_HEX_PATTERN,
  STATE_SCHEMAS,
  STATE_SLICE_DELIVERY,
  StateSliceDelivery,
  UNREPLICATED_SLICE_NAMES,
  VideoStatusResponseSchema,
  createOpenApiDocument,
  isWellFormedText,
  pickReplicatedState,
  stateSliceSchemaName,
  type ActiveSessionBody,
  type AudioSliceBody,
  type AuditRowBody,
  type EvidenceItemBody,
  type ReplicatedOperator,
  type ReplicatedSliceName,
  type ReplicatedState,
  type SessionHistoryEntryBody,
  type SessionNoteBody,
  type SimAlertBody,
  type SimEventBody,
} from '../src/api';
import { EXAMPLE_INSTANT_MS, EXAMPLE_PLACEHOLDERS } from '../src/api/example-parts';
import {
  DEFAULT_SEED,
  FaultKind,
  GENESIS_HASH,
  SCENARIO_NAMES,
  SNAPSHOT_KEYS,
  buildScenarioState,
  createIdleState,
  createManualClock,
  createSim,
  verifyAuditChain,
  type ActiveSession,
  type AudioSlice,
  type AuditRow,
  type EvidenceItem,
  type ScenarioName,
  type SessionHistoryEntry,
  type SessionNote,
  type SimAlert,
  type SimEvent,
  type SimOperator,
  type SimState,
} from '../src/sim';

// ── Compile-time proofs: the type of each schema is the simulator's type ─────────────────────────
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/**
 * Task 3 M2-W7 (blueprint row 48): the wire `evidence` item leads with the C3 v2 shape (files with
 * both hashes and the chain head, audio-source intervals, transcript summary); the simulator
 * reaches it with M2-W9 (row 51, SH-07). The marker compiles while parity is pending and stops
 * compiling when it lands — forcing the flip to `true`. No proof is deleted.
 */
type PendingM2W9<T extends boolean> = T extends true ? true : 'PENDING-M2W9';

/** One member per replicated slice. A schema whose type differs from `SimState[slice]` makes its member `false`, which `true` does not fit. */
const everySliceIsTheSimulators: {
  [Name in ReplicatedSliceName]: Name extends 'evidence' ? PendingM2W9<Exact<z.output<(typeof REPLICATED_SLICE_SCHEMAS)[Name]>, SimState[Name]>> : Exact<z.output<(typeof REPLICATED_SLICE_SCHEMAS)[Name]>, SimState[Name]>;
} = {
  meta: true,
  device: true,
  operators: true,
  tabletLink: true,
  session: true,
  lastSealedSessionId: true,
  lastSealedAcknowledged: true,
  sessionHistory: true,
  activeCameraId: true,
  cameras: true,
  mics: true,
  storage: true,
  storagePolicy: true,
  time: true,
  network: true,
  security: true,
  services: true,
  health: true,
  otherDevices: true,
  ports: true,
  // SH-07 (row 51): the v2 item shape leads the contract; the sim reaches it in M2-W9.
  evidence: 'PENDING-M2W9',
  events: true,
  alerts: true,
  audit: true,
  faults: true,
  diagnostics: true,
  update: true,
  settings: true,
  captureConfig: true,
  captureDevices: true,
};
/**
 * Every member name of a type at every depth, optional ones included: `a`, `a.b`, and for a list
 * the names of its elements. Mutual assignability, which `Exact` tests, does not see an optional
 * member that one side lacks; comparing the names does.
 */
type MemberPaths<T> = T extends readonly (infer Element)[]
  ? MemberPaths<Element>
  : T extends object
    ? { [Key in keyof T & string]-?: Key | `${Key}.${MemberPaths<NonNullable<T[Key]>>}` }[keyof T & string]
    : never;

/** One member per replicated slice: the schema names exactly the members the simulator's type has, no fewer and no more. */
const everySliceHasTheSimulatorsMembers: {
  [Name in ReplicatedSliceName]: Name extends 'evidence' ? PendingM2W9<Exact<MemberPaths<z.output<(typeof REPLICATED_SLICE_SCHEMAS)[Name]>>, MemberPaths<SimState[Name]>>> : Exact<MemberPaths<z.output<(typeof REPLICATED_SLICE_SCHEMAS)[Name]>>, MemberPaths<SimState[Name]>>;
} = {
  meta: true,
  device: true,
  operators: true,
  tabletLink: true,
  session: true,
  lastSealedSessionId: true,
  lastSealedAcknowledged: true,
  sessionHistory: true,
  activeCameraId: true,
  cameras: true,
  mics: true,
  storage: true,
  storagePolicy: true,
  time: true,
  network: true,
  security: true,
  services: true,
  health: true,
  otherDevices: true,
  ports: true,
  evidence: 'PENDING-M2W9', // SH-07 (row 51)
  events: true,
  alerts: true,
  audit: true,
  faults: true,
  diagnostics: true,
  update: true,
  settings: true,
  captureConfig: true,
  captureDevices: true,
};
const audioHasTheSimulatorsMembers: Exact<MemberPaths<AudioSliceBody>, MemberPaths<SimState['audio']>> = true;
// The helper sees an optional member and a nested one, so the proofs above are not empty.
const pathsSeeOptionalMembers: Exact<MemberPaths<{ a?: { b?: number }[]; c: string | null }>, 'a' | 'a.b' | 'c'> = true;
const pathsTellTypesApart: Exact<MemberPaths<{ a: number }>, MemberPaths<{ a: number; b?: number }>> = false;
const evidenceNamesItsOptionalMembers: 'tamperedTrackId' | 'markers.label' | 'notes.authorId' | 'signature.keyId' extends MemberPaths<SimState['evidence']> ? true : false = true;
const stateIsThe28Slices: PendingM2W9<Exact<ReplicatedState, Pick<SimState, ReplicatedSliceName>>> = 'PENDING-M2W9'; // via the evidence slice
const audioIsTheSlice: Exact<AudioSliceBody, AudioSlice> = true;
/**
 * Task 4 rows 28 and 149 (WP-13a): the wire form, `AudioSlice` and the slice as the STATE holds it
 * are one type - `activeInputId` is nullable in all three. The seam that kept the state's member an
 * input is removed (row 149); a type that narrows it again stops this line compiling.
 */
const audioStateIsTheSlice: Exact<AudioSliceBody, SimState['audio']> = true;
// Every slice of `SimState` is classified, and nothing else is.
const deliveryCoversTheState: Exact<keyof typeof STATE_SLICE_DELIVERY, keyof SimState> = true;
const unreplicatedAreTheOtherFive: Exact<Exclude<keyof SimState, ReplicatedSliceName>, 'clock' | 'auth' | 'authLockout' | 'pairing' | 'audio'> = true;
const operatorIsSimOperator: Exact<ReplicatedOperator, SimOperator> = true;
const sessionIsActiveSession: Exact<ActiveSessionBody, ActiveSession> = true;
const noteIsSessionNote: Exact<SessionNoteBody, SessionNote> = true;
const historyEntryIsTheSimulators: Exact<SessionHistoryEntryBody, SessionHistoryEntry> = true;
const evidenceItemIsTheSimulators: PendingM2W9<Exact<EvidenceItemBody, EvidenceItem>> = 'PENDING-M2W9'; // SH-07 (row 51)
const eventIsSimEvent: Exact<SimEventBody, SimEvent> = true;
const alertIsSimAlert: Exact<SimAlertBody, SimAlert> = true;
const auditRowIsTheSimulators: Exact<AuditRowBody, AuditRow> = true;
void [
  everySliceIsTheSimulators,
  everySliceHasTheSimulatorsMembers,
  audioHasTheSimulatorsMembers,
  pathsSeeOptionalMembers,
  pathsTellTypesApart,
  evidenceNamesItsOptionalMembers,
  stateIsThe28Slices,
  audioIsTheSlice,
  audioStateIsTheSlice,
  deliveryCoversTheState,
  unreplicatedAreTheOtherFive,
  operatorIsSimOperator,
  sessionIsActiveSession,
  noteIsSessionNote,
  historyEntryIsTheSimulators,
  evidenceItemIsTheSimulators,
  eventIsSimEvent,
  alertIsSimAlert,
  auditRowIsTheSimulators,
];

// ── The real states ──────────────────────────────────────────────────────────────────────────────

/** The fixed instant of the contract's examples: 2026-10-01 10:00:00 WIB. */
const AT = EXAMPLE_INSTANT_MS;

const idleState = (): SimState => createIdleState({ now: AT, seed: DEFAULT_SEED });
const scenarioState = (name: ScenarioName): SimState => buildScenarioState(name, idleState());

/** What travels: the JSON form of a value. */
function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface Sample {
  label: string;
  state: SimState;
}

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(AT);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const samples: Sample[] = [];
  return {
    sim,
    samples,
    run(ms: number, step = 50) {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        clock.advance(step);
        sim.tick();
      }
    },
    take(label: string) {
      samples.push({ label, state: sim.store.getState() });
    },
    state: () => sim.store.getState(),
  };
}

/** Faults that move a recording to FAULT; they are injected while idle, and POWER_FAIL in its own journey. */
const CRITICAL = new Set<string>([FaultKind.STORAGE_FULL, FaultKind.TPM_FAILURE, FaultKind.POWER_FAIL, FaultKind.SECURITY_FAULT]);

/** A whole working day on one engine: a session from create to seal, every non-critical fault, evidence, maintenance. */
function journeyOfASession(): Sample[] {
  const h = harness();
  const { actions } = h.sim;
  actions.signInWithBiometric('OPR-001');
  h.take('signed in');
  const caseNumber = actions.scanCaseNumber();
  actions.createSession({
    caseNumber,
    subjectType: 'SAKSI',
    subjectName: 'Dewi Lestari',
    investigatorId: 'OPR-001',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
    notes: 'Witness interview',
  });
  h.take('CREATE');
  actions.beginPrecheck();
  h.run(200);
  h.take('PRECHECK');
  h.run(6_000);
  h.take('ARMED');
  actions.startRecording();
  h.run(1_000);
  actions.addMarker('Key statement');
  actions.addMarker();
  actions.addNote('A note during the recording');
  actions.snapshot();
  h.run(200_000, 500);
  h.take('RECORDING, 200 s in');
  for (const kind of Object.values(FaultKind)) {
    if (CRITICAL.has(kind)) continue;
    actions.inject(kind);
    h.run(1_500);
    h.take(`fault ${kind}`);
    actions.clearFault(kind);
    h.run(500);
    h.take(`cleared ${kind}`);
  }
  actions.resetClip('AUDIO-02');
  actions.setActiveCamera('VIDEO-02');
  actions.stopRecording('Interview completed');
  h.run(500);
  h.take('STOPPING');
  h.run(2_500);
  h.take('FINALIZING');
  h.run(15_000);
  h.take('SEALED');
  const sealed = h.state().lastSealedSessionId ?? '';
  actions.acknowledgeSummary(sealed);
  const evidenceId = h.state().evidence.at(-1)?.id ?? '';
  actions.verify(evidenceId);
  actions.inject('TAMPER', { evidenceId });
  actions.verify(evidenceId);
  h.take('evidence tampered');
  actions.clearFault('TAMPER', { evidenceId });
  actions.signOut('LOCK');
  actions.signInWithSecurityKey();
  actions.exportEvidence(evidenceId, { reason: 'Case file transfer', destination: 'USB-01' });
  actions.archiveEvidence(evidenceId);
  actions.exportAudit({ reason: 'Quarterly audit' });
  actions.exportLogs({ reason: 'Quarterly audit' });
  actions.setStoragePolicy({ retentionDays: 365, autoArchive: false });
  actions.updateSettings({ timeFormat: '12', notifySound: false });
  actions.setPresentationMode(true);
  h.take('supervisor: export, archive, policy, settings');
  actions.signOut();
  actions.signInWithBiometric('OPR-003');
  actions.runDiagnostics();
  h.run(300);
  h.take('diagnostics running');
  h.run(10_000);
  h.take('diagnostics done');
  actions.deviceCommand('CAM-01', 'TEST_SIGNAL');
  actions.deviceCommand('MIC-01', 'TEST_SIGNAL');
  actions.deviceCommand('CAM-01', 'RESTART');
  for (const id of ['CAM-01', 'MIC-01', 'GNSS', 'TPM', 'FRONT-PANEL']) actions.deviceCommand(id, 'IDENTIFY');
  h.run(3_000);
  h.take('device commands');
  expect(actions.restartServices()).toBeGreaterThan(0);
  actions.startSoftwareUpdate();
  h.run(400);
  h.take('update running');
  h.run(30_000);
  h.take('update done');
  actions.setTabletLink('OFFLINE');
  h.take('tablet offline');
  for (const kind of [FaultKind.STORAGE_FULL, FaultKind.TPM_FAILURE, FaultKind.SECURITY_FAULT, FaultKind.AUDIT_TAMPER]) actions.inject(kind);
  h.run(2_000);
  h.take('critical faults while idle, audit row altered');
  h.run(600_000, 1_000);
  h.take('ten minutes later');
  actions.resetDemo();
  h.take('after a demo reset');
  expect(h.sim.errors()).toEqual([]);
  return h.samples;
}

/** A power failure during a recording, the recovery, and the incomplete session it leaves. */
function journeyOfAPowerFailure(): Sample[] {
  const h = harness('recording');
  h.sim.actions.signInWithBiometric('OPR-001');
  h.run(5_000);
  h.sim.actions.inject('POWER_FAIL');
  h.run(1_000);
  h.take('FAULT');
  h.sim.actions.recover();
  h.run(500);
  h.take('RECOVERY');
  h.run(10_000);
  h.take('recovered');
  h.run(120_000, 500);
  h.take('two minutes later');
  expect(h.sim.errors()).toEqual([]);
  return h.samples;
}

/** A pre-check that warns (time from the RTC) and one that blocks (a lens fault), with acknowledge, cancel and retry. */
function journeyOfThePrecheck(): Sample[] {
  const h = harness();
  const { actions } = h.sim;
  const input = {
    subjectType: 'TERSANGKA',
    subjectName: 'Rudi Hartono',
    investigatorId: 'OPR-001',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  } as const;
  actions.signInWithBiometric('OPR-001');
  actions.inject('GNSS_LOSS', { fallback: 'RTC' });
  actions.createSession({ ...input, caseNumber: 'LP/2026/1001-0099' });
  actions.beginPrecheck();
  h.run(6_000);
  h.take('pre-check WARN');
  actions.acknowledgePrecheckWarnings();
  h.take('warnings acknowledged');
  actions.cancel();
  actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
  actions.createSession({ ...input, caseNumber: 'LP/2026/1001-0100' });
  actions.beginPrecheck();
  h.run(6_000);
  h.take('pre-check BLOCK');
  actions.retryPrecheck();
  h.run(200);
  h.take('pre-check retried');
  expect(h.sim.errors()).toEqual([]);
  return h.samples;
}

/** Every scenario, started and left running for 90 s. */
function journeyOfTheScenarios(): Sample[] {
  return SCENARIO_NAMES.map((name) => {
    const h = harness(name);
    h.run(90_000, 250);
    return { label: `${name} + 90 s`, state: h.state() };
  });
}

/** `label slice path: message` for every slice of every sample that its schema refuses or changes. */
function refusals(samples: readonly Sample[]): string[] {
  const out: string[] = [];
  for (const { label, state } of samples) {
    const sent = wire(state);
    for (const name of REPLICATED_SLICE_NAMES) {
      const result = REPLICATED_SLICE_SCHEMAS[name].safeParse(sent[name]);
      if (!result.success) {
        for (const issue of result.error.issues.slice(0, 3)) out.push(`${label}: ${name}.${issue.path.join('.')}: ${issue.message}`);
      } else {
        try {
          expect(result.data).toStrictEqual(sent[name]);
        } catch {
          out.push(`${label}: ${name}: the parse changed the slice`);
        }
      }
    }
    if (!AudioSliceSchema.safeParse(sent.audio).success) out.push(`${label}: audio`);
    if (!ReplicatedStateSchema.safeParse(pickReplicatedState(sent)).success) out.push(`${label}: the 30 slices as one state`);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════

describe('the 30 replicated slices and the other five', () => {
  it('the fixed instant is the instant of the contract\'s examples', () => {
    expect(AT).toBe(Date.parse(OPENAPI_EXAMPLE_INSTANT));
    expect(AT).toBe(Date.UTC(2026, 9, 1, 3, 0, 0));
  });

  it('every slice of SimState is classified: 30 replicated, audio streamed, four built by the client', () => {
    const state = idleState();
    expect(Object.keys(STATE_SLICE_DELIVERY)).toEqual(Object.keys(state));
    expect(Object.keys(state)).toHaveLength(35);
    const by = (delivery: StateSliceDelivery) => Object.entries(STATE_SLICE_DELIVERY).filter(([, value]) => value === delivery).map(([name]) => name);
    expect(by(StateSliceDelivery.REPLICATED)).toEqual([...REPLICATED_SLICE_NAMES]);
    expect(by(StateSliceDelivery.STREAMED)).toEqual(['audio']);
    expect(by(StateSliceDelivery.CLIENT)).toEqual(['clock', 'auth', 'authLockout', 'pairing']);
    expect(UNREPLICATED_SLICE_NAMES).toEqual(['clock', 'auth', 'authLockout', 'pairing', 'audio']);
  });

  it('the 30 are the ones 01_specs §3.2 marks "Replicated", in state order', () => {
    expect([...REPLICATED_SLICE_NAMES]).toEqual([
      'meta', 'device', 'operators', 'tabletLink', 'session', 'lastSealedSessionId', 'lastSealedAcknowledged', 'sessionHistory',
      'activeCameraId', 'cameras', 'mics', 'storage', 'storagePolicy', 'time', 'network', 'security', 'services', 'health',
      'otherDevices', 'ports', 'evidence', 'events', 'alerts', 'audit', 'faults', 'diagnostics', 'update', 'settings',
      // Slices 29 and 30 (SH-16): appended after the v1 order, each with its own delta kind (E-04).
      'captureConfig', 'captureDevices',
    ]);
    expect(REPLICATED_SLICE_NAMES).toHaveLength(30);
    expect(Object.keys(REPLICATED_SLICE_SCHEMAS)).toEqual([...REPLICATED_SLICE_NAMES]);
    // The simulator persists 32 slices; the two that persist and do not replicate are server-native in Live mode.
    expect(SNAPSHOT_KEYS.filter((key) => !(REPLICATED_SLICE_NAMES as readonly string[]).includes(key))).toEqual(['authLockout', 'pairing']);
    expect(REPLICATED_SLICE_NAMES.filter((name) => !(SNAPSHOT_KEYS as readonly string[]).includes(name))).toEqual([]);
  });

  it('each replicated slice is a named component `<Name>Slice`; the registry holds them after the 50 of contract A', () => {
    const names = REPLICATED_SLICE_NAMES.map((name) => stateSliceSchemaName(name));
    expect(names.slice(0, 5)).toEqual(['MetaSlice', 'DeviceSlice', 'OperatorsSlice', 'TabletLinkSlice', 'SessionSlice']);
    expect(Object.keys(STATE_SCHEMAS).slice(0, 30)).toEqual(names);
    for (const name of REPLICATED_SLICE_NAMES) {
      expect(STATE_SCHEMAS[stateSliceSchemaName(name)], name).toBe(REPLICATED_SLICE_SCHEMAS[name]);
      expect(CORE_API_SCHEMAS[stateSliceSchemaName(name)], name).toBe(REPLICATED_SLICE_SCHEMAS[name]);
    }
    expect(Object.keys(STATE_SCHEMAS).slice(30)).toEqual([
      'AudioSlice', 'ReplicatedState', 'ActiveSession', 'SessionNote', 'SessionHistoryEntry', 'EvidenceItem', 'SimEvent', 'SimAlert', 'AuditRow',
    ]);
    expect(Object.keys(STATE_SCHEMAS)).toHaveLength(39);
  });
});

describe.each([
  ['createIdleState at the fixed instant', idleState],
  ['the recording scenario at the fixed instant', () => scenarioState('recording')],
] as const)('each of the 30 slice schemas accepts its slice of %s', (_title, build) => {
  const state = build();
  const sent = wire(state);

  it('the state is plain JSON: the wire form equals the state', () => {
    expect(sent).toEqual(state);
    expect(Object.keys(sent)).toEqual(Object.keys(state));
  });

  it.each([...REPLICATED_SLICE_NAMES])('%s: accepted unchanged', (name) => {
    const schema = REPLICATED_SLICE_SCHEMAS[name];
    // What the server sends and the Live source receives.
    expect(schema.parse(sent[name])).toStrictEqual(sent[name]);
    // What the engine holds, before it is serialised.
    expect(schema.parse(state[name])).toEqual(state[name]);
  });

  it('the 30 together are the `state` of a snapshot; the other five slices stay behind', () => {
    const picked = pickReplicatedState(sent);
    expect(Object.keys(picked)).toEqual([...REPLICATED_SLICE_NAMES]);
    for (const name of REPLICATED_SLICE_NAMES) expect(picked[name], name).toBe(sent[name]);
    expect(ReplicatedStateSchema.parse(picked)).toStrictEqual(picked);
    expect(Object.keys(sent)).toHaveLength(35);
    expect(ReplicatedStateSchema.safeParse(sent).success).toBe(false);
  });

  it('audio is not one of them, and its wire form parses with its own schema', () => {
    expect((REPLICATED_SLICE_NAMES as readonly string[]).includes('audio')).toBe(false);
    expect(AudioSliceSchema.parse(sent.audio)).toStrictEqual(sent.audio);
  });
});

describe('the recording scenario is the recording session of the examples', () => {
  it('a session in RECORDING with its pre-check, timeline and notes, and the audit chain still verifies after the parse', () => {
    const state = wire(scenarioState('recording'));
    const session = REPLICATED_SLICE_SCHEMAS.session.parse(state.session);
    expect(session?.state).toBe('RECORDING');
    expect(session?.id).toBe('SES-20261001-0024');
    expect(session?.precheck.items).toHaveLength(8);
    expect(session?.timeline.length).toBeGreaterThan(5);
    // A client verifies server rows with the shared check (CL-14): the parse keeps every hashed member.
    const audit = REPLICATED_SLICE_SCHEMAS.audit.parse(state.audit);
    expect(audit.rows.length).toBeGreaterThan(50);
    expect(verifyAuditChain(audit)).toEqual({ ok: true, checked: audit.rows.length, head: audit.head });
    expect(audit.rows[0]?.prevHash).toBe(GENESIS_HASH);
    expect(GENESIS_HASH).toMatch(SHA256_HEX_PATTERN);
  });
});

describe('beyond the two required states: every scenario and four journeys of a headless engine', () => {
  it('every scenario at the fixed instant', () => {
    const samples = SCENARIO_NAMES.map((name) => ({ label: name, state: scenarioState(name) }));
    expect(samples.map((sample) => sample.label)).toEqual(['idle', 'recording', 'finalizing', 'fault-demo']);
    expect(refusals(samples)).toEqual([]);
  });

  it('a session from create to seal, every fault, evidence, export, diagnostics, update and a reset', () => {
    const samples = journeyOfASession();
    expect(refusals(samples)).toEqual([]);
    expect(samples.length).toBeGreaterThanOrEqual(30);
    const seen = <T>(read: (state: SimState) => T | undefined | null) => new Set(samples.map(({ state }) => read(state)).filter((value) => value != null));
    // The journey reached what makes the optional members appear.
    expect(seen((state) => state.session?.state)).toEqual(new Set(['CREATE', 'PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING', 'SEALED']));
    const faults = new Set(samples.flatMap(({ state }) => state.faults.active.map((fault) => fault.kind)));
    expect([...faults].sort()).toEqual(Object.values(FaultKind).filter((kind) => kind !== FaultKind.POWER_FAIL).sort());
    expect(seen((state) => state.diagnostics?.completedAt)).not.toEqual(new Set());
    expect(seen((state) => state.update.state)).toEqual(new Set(['IDLE', 'RUNNING', 'PASS']));
    expect(seen((state) => state.meta.counters.export)).not.toEqual(new Set());
    expect(seen((state) => state.storage.state)).toEqual(new Set(['READY', 'LOW', 'FULL']));
    const statuses = new Set(samples.flatMap(({ state }) => state.evidence.map((item) => item.status)));
    expect(statuses).toEqual(new Set(['RECORDED', 'SEALED', 'EXPORTED', 'UNDER_REVIEW', 'ARCHIVED']));
    expect(samples.some(({ state }) => state.evidence.some((item) => item.tampered && item.verification.status === 'FAIL'))).toBe(true);
    expect(samples.some(({ state }) => !verifyAuditChain(state.audit).ok)).toBe(true);
    expect(seen((state) => state.settings.timeFormat)).toEqual(new Set(['24', '12']));
    expect(seen((state) => state.tabletLink.state)).toEqual(new Set(['CONNECTED', 'OFFLINE']));
  });

  it('a power failure during a recording, the recovery and the incomplete session', () => {
    const samples = journeyOfAPowerFailure();
    expect(refusals(samples)).toEqual([]);
    expect(samples.map(({ state }) => state.session?.state ?? null)).toEqual(['FAULT', 'RECOVERY', null, null]);
    expect(samples[0]?.state.session?.fault).toMatchObject({ kind: 'POWER_FAIL', fromState: 'RECORDING' });
    expect(samples[1]?.state.session?.recovery).not.toBeNull();
    expect(samples.at(-1)?.state.sessionHistory.some((entry) => entry.outcome === 'INCOMPLETE' && entry.faultKind === 'POWER_FAIL')).toBe(true);
  });

  it('a pre-check that warns and one that blocks', () => {
    const samples = journeyOfThePrecheck();
    expect(refusals(samples)).toEqual([]);
    expect(samples.map(({ state }) => state.session?.precheck.outcome ?? null)).toEqual(['WARN', 'WARN', 'BLOCK', null]);
    expect(samples[0]?.state.session?.precheck.items.some((item) => item.reasonCode === 'TIME_RTC')).toBe(true);
    expect(samples[2]?.state.session?.precheck.items.some((item) => item.reasonCode === 'LENS_FAULT' && item.params !== undefined)).toBe(true);
    expect(samples[1]?.state.session?.precheck.warningsAcknowledged).toBe(true);
  });

  it('every scenario after 90 s of engine time', () => {
    const samples = journeyOfTheScenarios();
    expect(samples).toHaveLength(4);
    expect(refusals(samples)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// What a slice may not carry
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Names a secret would have, with values of the right form that open nothing. */
const SECRET_MEMBERS: Readonly<Record<string, unknown>> = {
  password: EXAMPLE_PLACEHOLDERS.password,
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$EXAMPLE$EXAMPLE',
  salt: 'EXAMPLE',
  token: EXAMPLE_PLACEHOLDERS.sessionToken,
  sessionToken: EXAMPLE_PLACEHOLDERS.sessionToken,
  cookie: `dems_session_4420=${EXAMPLE_PLACEHOLDERS.sessionToken}`,
  deviceCredential: EXAMPLE_PLACEHOLDERS.deviceCredential,
  biometricToken: EXAMPLE_PLACEHOLDERS.biometricToken,
  code: EXAMPLE_PLACEHOLDERS.pairingCode,
  pairingCode: EXAMPLE_PLACEHOLDERS.pairingCode,
  qrPayload: EXAMPLE_PLACEHOLDERS.qrPayload,
};

/** The open maps of the simulator's `Details`: any key is theirs to hold. */
const OPEN_MAP = /\.(details|params)$/;

/**
 * Every object inside `value` except the open maps, with a function that returns a copy of the
 * whole value in which that one object gained `member`.
 */
function objectsOf(value: unknown, path = '', rebuild: (inner: unknown) => unknown = (inner) => inner, out: [string, (member: object) => unknown][] = []) {
  if (Array.isArray(value)) {
    // One element stands for the list: the first.
    if (value.length > 0) objectsOf(value[0], `${path}[0]`, (inner) => rebuild([inner, ...value.slice(1)]), out);
  } else if (value && typeof value === 'object') {
    if (OPEN_MAP.test(path)) return out;
    out.push([path, (member) => rebuild({ ...value, ...member })]);
    for (const [key, child] of Object.entries(value)) objectsOf(child, `${path}.${key}`, (inner) => rebuild({ ...value, [key]: inner }), out);
  }
  return out;
}

/** A state in which every slice that can hold something holds it: a sealed session, diagnostics, an export. */
function richState(): SimState {
  const samples = journeyOfASession();
  const sealed = samples.find((sample) => sample.label === 'SEALED');
  const diagnosed = samples.find((sample) => sample.label === 'diagnostics done');
  if (!sealed || !diagnosed) throw new Error('the journey lost a sample');
  return wire({ ...diagnosed.state, session: sealed.state.session });
}

describe('strict: a member the schema does not name is refused, at every level of every slice', () => {
  const state = richState();

  it('the snapshot state is exactly the 28 names', () => {
    const picked = pickReplicatedState(state);
    expect(ReplicatedStateSchema.safeParse(picked).success).toBe(true);
    for (const name of REPLICATED_SLICE_NAMES) {
      const { [name]: _removed, ...rest } = picked;
      expect(ReplicatedStateSchema.safeParse(rest).success, `without ${name}`).toBe(false);
    }
    expect(ReplicatedStateSchema.safeParse({ ...picked, extra: 1 }).success).toBe(false);
  });

  it.each([...UNREPLICATED_SLICE_NAMES])('a snapshot state that also carries `%s` is refused', (name) => {
    const leaked = { ...pickReplicatedState(state), [name]: state[name] };
    const result = ReplicatedStateSchema.safeParse(leaked);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.code)).toEqual(['unrecognized_keys']);
  });

  it('an unknown member in any object of any slice is refused', () => {
    let objects = 0;
    const visited = new Set<string>();
    for (const name of REPLICATED_SLICE_NAMES) {
      const schema = REPLICATED_SLICE_SCHEMAS[name];
      expect(schema.safeParse(state[name]).success, name).toBe(true);
      for (const [path, withMember] of objectsOf(state[name], name)) {
        expect(schema.safeParse(withMember({ notInTheContract: true })).success, path).toBe(false);
        objects += 1;
        visited.add(name);
      }
    }
    // Every slice that is an object or a list of objects was reached; the three scalar slices have none.
    expect(REPLICATED_SLICE_NAMES.filter((name) => !visited.has(name))).toEqual(['lastSealedSessionId', 'lastSealedAcknowledged', 'activeCameraId']);
    expect(objects).toBeGreaterThan(50);
    // The same for the streamed slice.
    for (const [path, withMember] of objectsOf(state.audio, 'audio')) {
      expect(AudioSliceSchema.safeParse(withMember({ notInTheContract: true })).success, path).toBe(false);
    }
  });

  it('a member with the name of a secret is refused wherever it is put', () => {
    let refused = 0;
    let objects = 0;
    for (const name of REPLICATED_SLICE_NAMES) {
      for (const [path, withMember] of objectsOf(state[name], name)) {
        objects += 1;
        for (const [member, value] of Object.entries(SECRET_MEMBERS)) {
          expect(REPLICATED_SLICE_SCHEMAS[name].safeParse(withMember({ [member]: value })).success, `${path}.${member}`).toBe(false);
          refused += 1;
        }
      }
    }
    expect(Object.keys(SECRET_MEMBERS)).toHaveLength(11);
    expect(refused).toBe(objects * 11);
    expect(refused).toBeGreaterThan(500);
  });

  it('the open maps take flat values under any key, and nothing nested', () => {
    const audit = state.audit;
    const first = audit.rows[0];
    if (!first) throw new Error('the state has no audit row');
    const withDetails = (details: unknown) => ({ ...audit, rows: [{ ...first, details }, ...audit.rows.slice(1)] });
    const schema = REPLICATED_SLICE_SCHEMAS.audit;
    expect(schema.safeParse(withDetails({ scope: 'LOGS', rows: 12, reset: true, target: null })).success).toBe(true);
    for (const nested of [{ a: { b: 1 } }, { a: [1, 2] }, { a: undefined }]) {
      expect(schema.safeParse(withDetails(nested)).success, JSON.stringify(nested)).toBe(false);
    }
    for (const notAMap of [null, 'text', 3, [1]]) expect(schema.safeParse(withDetails(notAMap)).success, JSON.stringify(notAMap)).toBe(false);
  });
});

describe('the operators slice: identity members and role only (01_specs §3.2 row 4, §9.5)', () => {
  const operators = wire(idleState().operators);
  const first = operators[0];
  if (!first) throw new Error('the dataset has no operator');

  it('holds the three seeded operators with exactly seven members each', () => {
    expect(REPLICATED_SLICE_SCHEMAS.operators.parse(operators)).toStrictEqual(operators);
    expect(operators.map((operator) => operator.id)).toEqual(['OPR-001', 'OPR-002', 'OPR-003']);
    for (const operator of operators) expect(Object.keys(operator).sort()).toEqual(['displayName', 'id', 'initials', 'name', 'rank', 'role', 'username']);
  });

  it.each([
    ['enabled', true],
    ['passwordHash', '$argon2id$v=19$m=19456,t=2,p=1$EXAMPLE$EXAMPLE'],
    ['passwordSalt', 'EXAMPLE'],
    ['password', EXAMPLE_PLACEHOLDERS.password],
    ['lastSignInAt', AT],
    ['roleChangedAt', AT],
    ['activeSessions', 2],
    ['sessions', []],
    ['biometricToken', EXAMPLE_PLACEHOLDERS.biometricToken],
  ])('an operator that carries `%s` is refused, in the slice and in a snapshot state', (member, value) => {
    const leaked = [{ ...first, [member]: value }, ...operators.slice(1)];
    expect(REPLICATED_SLICE_SCHEMAS.operators.safeParse(leaked).success).toBe(false);
    expect(ReplicatedOperatorSchema.safeParse(leaked[0]).success).toBe(false);
    const state = pickReplicatedState(wire(idleState()));
    expect(ReplicatedStateSchema.safeParse({ ...state, operators: leaked }).success).toBe(false);
  });

  it('is stricter than the `Operator` of a REST answer, which drops what it does not know', () => {
    const extra = { ...first, enabled: true };
    expect(OperatorSchema.parse(extra)).toStrictEqual(first);
    expect(ReplicatedOperatorSchema.safeParse(extra).success).toBe(false);
    expect(ReplicatedOperatorSchema.parse(first)).toStrictEqual(first);
  });

  it('refuses a role, an ID or a member type outside the contract', () => {
    for (const bad of [{ role: 'ADMIN' }, { id: 'budi.santoso' }, { id: 'OPR-1' }, { rank: 3 }, { username: '' }, { displayName: null }]) {
      expect(ReplicatedOperatorSchema.safeParse({ ...first, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    const { role: _role, ...withoutRole } = first;
    expect(ReplicatedOperatorSchema.safeParse(withoutRole).success).toBe(false);
  });
});

describe('values: time, value sets, identifiers, hashes, levels, text', () => {
  const state = wire(scenarioState('recording'));
  const refuses = (name: ReplicatedSliceName, value: unknown) => !REPLICATED_SLICE_SCHEMAS[name].safeParse(value).success;

  it('time is epoch milliseconds: an integer that is not negative, never a string (API-5)', () => {
    for (const changedAt of [AT + 0.5, -1, OPENAPI_EXAMPLE_INSTANT, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(refuses('tabletLink', { ...state.tabletLink, changedAt }), String(changedAt)).toBe(true);
    }
    expect(refuses('tabletLink', { ...state.tabletLink, changedAt: 0 })).toBe(false);
    expect(refuses('meta', { ...state.meta, createdAt: '2026-10-01T10:00:00.000+07:00' })).toBe(true);
  });

  it('a value outside its set is refused', () => {
    expect(refuses('tabletLink', { ...state.tabletLink, state: 'MAYBE' })).toBe(true);
    expect(refuses('activeCameraId', 'AUDIO-01')).toBe(true);
    expect(refuses('activeCameraId', 'VIDEO-02')).toBe(false);
    expect(refuses('storage', { ...state.storage, state: 'BROKEN' })).toBe(true);
    // SH-10 moved the wire literal to 2: 2 is now the accepted value, so the refusal cases are 1 and 3.
    expect(refuses('meta', { ...state.meta, schemaVersion: 2 })).toBe(false);
    expect(refuses('meta', { ...state.meta, schemaVersion: 1 })).toBe(true);
    expect(refuses('meta', { ...state.meta, schemaVersion: 3 })).toBe(true);
    expect(refuses('meta', { ...state.meta, scenario: 'chaos' })).toBe(true);
    expect(refuses('settings', { ...state.settings, timeFormat: '48' })).toBe(true);
    expect(refuses('lastSealedAcknowledged', 'yes')).toBe(true);
    expect(refuses('security', { ...state.security, encryption: 'ROT13' })).toBe(true);
    expect(refuses('session', { ...state.session, state: 'PAUSED' })).toBe(true);
    expect(refuses('session', null)).toBe(false);
    expect(refuses('diagnostics', null)).toBe(false);
    for (const name of ['meta', 'device', 'operators', 'audit', 'storage'] as const) expect(refuses(name, null), name).toBe(true);
  });

  // Task 4 row 52 (WP-10b; design addendum 7.3; review P12-F08 rows 5 and 6; AD-06 (1), (2)).
  it('a camera states its stream: picture, rate and codec are the stream\'s facts, each closed or bounded, and the simulator states what it stated', () => {
    // The simulator's two cameras, in every scenario: the three former literals, unchanged.
    for (const name of SCENARIO_NAMES) {
      expect(scenarioState(name).cameras.map((camera) => [camera.resolution, camera.fps, camera.codec]), name).toEqual([['1080p', 25, 'H.264'], ['1080p', 25, 'H.264']]);
    }
    const [first, second] = state.cameras;
    const withFacts = (facts: Record<string, unknown>) => [{ ...first, ...facts }, second];
    // What the literals refused and a real camera delivers.
    for (const facts of [{ codec: 'HEVC' }, { resolution: '720p', fps: 30 }, { resolution: '2160p', fps: 60 }, { resolution: '2560x1920', fps: 20, codec: 'HEVC' }, { fps: 1 }, { fps: 240 }, { fps: null }, { codec: 'HEVC', fps: null }]) {
      expect(refuses('cameras', withFacts(facts)), JSON.stringify(facts)).toBe(false);
    }
    // The codec is a closed set: the stored code, another case, a codec outside it and device text are refused.
    for (const codec of ['H264', 'h.264', 'hevc', 'H.265', 'AV1', '', '<b>H.264</b>', 'H.264 ', 'x'.repeat(300), null, 264]) {
      expect(refuses('cameras', withFacts({ codec })), String(codec)).toBe(true);
    }
    // The picture is `<height>p` or `<width>x<height>`, each number 100 to 9999.
    for (const resolution of ['1080P', '1080', '1080i', '99p', '10800p', '0720p', '1920X1080', '1920x', 'x1080', '1920x1080p', ' 1080p', '1080p\n', '<1080p>', 'x'.repeat(300), '', null, 1080]) {
      expect(refuses('cameras', withFacts({ resolution })), String(resolution)).toBe(true);
    }
    // The rate is a whole number from 1 to 240.
    for (const fps of [0, -25, 29.97, 241, '25', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(refuses('cameras', withFacts({ fps })), String(fps)).toBe(true);
    }
    // None of the three may be left out.
    for (const member of ['resolution', 'fps', 'codec'] as const) {
      const { [member]: _dropped, ...rest } = first!;
      expect(refuses('cameras', [rest, second]), member).toBe(true);
    }
  });

  it('identifiers and hashes have their form', () => {
    expect(refuses('lastSealedSessionId', 'SES-1')).toBe(true);
    expect(refuses('lastSealedSessionId', 'SES-20261001-0024')).toBe(false);
    expect(refuses('lastSealedSessionId', null)).toBe(false);
    expect(refuses('session', { ...state.session, id: 'session-24' })).toBe(true);
    expect(refuses('session', { ...state.session, createdBy: 'budi.santoso' })).toBe(true);
    const audit = state.audit;
    expect(refuses('audit', { ...audit, head: 'not-a-hash' })).toBe(true);
    expect(refuses('audit', { ...audit, head: audit.head.toUpperCase() })).toBe(true);
    expect(refuses('audit', { ...audit, total: -1 })).toBe(true);
    expect(refuses('audit', { ...audit, dropped: 0.5 })).toBe(true);
    const row = audit.rows[0];
    expect(refuses('audit', { ...audit, rows: [{ ...row, type: 'SOMETHING_ELSE' }] })).toBe(true);
    expect(refuses('audit', { ...audit, rows: [{ ...row, actorId: 'budi.santoso' }] })).toBe(true);
    expect(refuses('audit', { ...audit, rows: [{ ...row, hash: undefined }] })).toBe(true);
    const item = state.evidence[0];
    expect(refuses('evidence', [{ ...item, id: 'EV-4' }])).toBe(true);
    expect(refuses('evidence', [{ ...item, manifestHash: 'abc' }])).toBe(true);
    expect(refuses('evidence', [{ ...item, signature: { ...item?.signature, simulated: false } }])).toBe(true);
  });

  it('an audio level is between -90 and 0 dBFS, and both mic inputs are present', () => {
    const audio = state.audio;
    const frame = audio.inputs['MIC-01'];
    for (const dbfs of [0.1, -90.5, null]) {
      expect(AudioSliceSchema.safeParse({ ...audio, inputs: { ...audio.inputs, 'MIC-01': { ...frame, dbfs } } }).success, String(dbfs)).toBe(false);
    }
    // Schema v2 keys the meters by input and names the active one (SH-17): a third input, or the
    // v1 `channels` shape, or a missing `activeInputId`, are all refused.
    expect(AudioSliceSchema.safeParse({ ...audio, inputs: { ...audio.inputs, 'MIC-03': frame } }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ inputs: audio.inputs }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ channels: audio.inputs, activeInputId: 'MIC-01' }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ ...audio, inputs: { ...audio.inputs, 'MIC-01': { ...frame, dbfs: -90, peak: 0 } } }).success).toBe(true);
  });

  // Task 4 row 28 (WP-13a; decision C25; names register E41): a selector slot may be unassigned,
  // so the meters slice holds AT MOST two frames and may name no active input. Each acceptance has
  // its refusal beside it.
  it('row 28: the audio slice admits an absent selector value - one frame or none, and a null active input; a complete slice reads as before', () => {
    const audio = state.audio;
    const frame = audio.inputs['MIC-01'];
    // A complete selector: the slice of today parses to itself, member for member.
    expect(Object.keys(audio.inputs)).toEqual(['MIC-01', 'MIC-02']);
    expect(AudioSliceSchema.parse(audio)).toStrictEqual(audio);
    // One microphone line: one frame (this body was refused before the widening).
    expect(AudioSliceSchema.safeParse({ inputs: { 'MIC-01': frame }, activeInputId: 'MIC-01' }).success).toBe(true);
    // A lone STANDBY line: its frame, and no active input.
    expect(AudioSliceSchema.parse({ inputs: { 'MIC-02': frame }, activeInputId: null })).toStrictEqual({ inputs: { 'MIC-02': frame }, activeInputId: null });
    // No microphone line at all.
    expect(AudioSliceSchema.safeParse({ inputs: {}, activeInputId: null }).success).toBe(true);
    // Absent is `null`, never a missing member, an empty text or a word.
    expect(AudioSliceSchema.safeParse({ inputs: {} }).success).toBe(false);
    for (const bad of ['', 'NONE', 'AUDIO-01', 0, false]) expect(AudioSliceSchema.safeParse({ inputs: {}, activeInputId: bad }).success, String(bad)).toBe(false);
    // Still at most two, and still keyed by `MIC-NN`.
    expect(AudioSliceSchema.safeParse({ inputs: { 'MIC-01': frame, 'MIC-02': frame, 'MIC-03': frame }, activeInputId: null }).success).toBe(false);
    expect(AudioSliceSchema.safeParse({ inputs: { 'AUDIO-01': frame }, activeInputId: null }).success).toBe(false);
  });

  it('row 28: the audio and video status answers admit an absent selector value (operations 44, 45, 46); the examples of a complete selector still pass', () => {
    const exampleOf = (operationId: string, name: string): unknown => CORE_API_EXAMPLES[operationId]?.responses[200]?.[name]?.value;
    const audioExample = AudioStatusResponseSchema.parse(exampleOf('getAudioStatus', 'recording'));
    const videoExample = VideoStatusResponseSchema.parse(exampleOf('getVideoStatus', 'recording'));
    const healthExample = DeviceHealthResponseSchema.parse(exampleOf('getDeviceHealth', 'idle'));
    // Complete selector: two entries, an active input, a source device behind each track.
    expect([audioExample.channels.length, typeof audioExample.activeInputId]).toEqual([2, 'string']);
    expect(videoExample.tracks.map((track) => typeof track.sourceDeviceId)).toEqual(['string', 'string']);
    expect([healthExample.audio.length, typeof healthExample.activeInputId, healthExample.cameras.length]).toEqual([2, 'string', 2]);

    const [first, second] = audioExample.channels;
    // Operation 45: one entry per meter channel that has an input, so two, one or none.
    expect(AudioStatusResponseSchema.safeParse({ channels: [first], activeInputId: first?.inputId }).success).toBe(true);
    expect(AudioStatusResponseSchema.safeParse({ channels: [], activeInputId: null }).success).toBe(true);
    expect(AudioStatusResponseSchema.safeParse({ channels: [first, second], activeInputId: null }).success).toBe(true);
    expect(AudioStatusResponseSchema.safeParse({ channels: [first, second, first], activeInputId: null }).success).toBe(false);
    expect(AudioStatusResponseSchema.safeParse({ channels: [] }).success).toBe(false);
    expect(AudioStatusResponseSchema.safeParse({ channels: [], activeInputId: '' }).success).toBe(false);
    // An entry IS an input: its own members did not become nullable.
    expect(AudioStatusResponseSchema.safeParse({ channels: [{ ...first, inputId: null }], activeInputId: null }).success).toBe(false);
    expect(AudioStatusResponseSchema.safeParse({ channels: [{ ...first, role: null }], activeInputId: null }).success).toBe(false);

    const [trackOne, trackTwo] = videoExample.tracks;
    // Operation 46: `tracks` stays two; a track without a line states `sourceDeviceId: null`.
    expect(VideoStatusResponseSchema.safeParse({ tracks: [{ ...trackOne, sourceDeviceId: null }, trackTwo] }).success).toBe(true);
    expect(VideoStatusResponseSchema.safeParse({ tracks: [{ ...trackOne, sourceDeviceId: null }, { ...trackTwo, sourceDeviceId: null }] }).success).toBe(true);
    expect(VideoStatusResponseSchema.safeParse({ tracks: [{ ...trackOne, sourceDeviceId: null }] }).success).toBe(false);
    expect(VideoStatusResponseSchema.safeParse({ tracks: [{ ...trackOne, sourceDeviceId: '' }, trackTwo] }).success).toBe(false);
    const { sourceDeviceId: _dropped, ...withoutSource } = trackOne as NonNullable<typeof trackOne>;
    expect(VideoStatusResponseSchema.safeParse({ tracks: [withoutSource, trackTwo] }).success).toBe(false);

    // Operation 44 carries the same audio members and the same tracks.
    expect(DeviceHealthResponseSchema.safeParse({ ...healthExample, audio: [], activeInputId: null }).success).toBe(true);
    expect(DeviceHealthResponseSchema.safeParse({ ...healthExample, cameras: healthExample.cameras.map((camera) => ({ ...camera, sourceDeviceId: null })) }).success).toBe(true);
    expect(DeviceHealthResponseSchema.safeParse({ ...healthExample, audio: [...healthExample.audio, ...healthExample.audio] }).success).toBe(false);
    expect(DeviceHealthResponseSchema.safeParse({ ...healthExample, cameras: [] }).success).toBe(false);
  });

  it('text carries the text rule API-13: what well-formed input leaves in the state is well-formed, and a slice with ill-formed text is refused', () => {
    // Changed by design (W27; the ruling on finding F-1 of implementation/22_contract_b.md). Contract B
    // took slice text as the engine held it, because the engine cut two texts by UTF-16 code units and
    // could split a surrogate pair: the timeline entry of a note longer than 140, an export destination
    // longer than 120. The engine now cuts on a character boundary (`sim/text-cut.ts`), so the rule is
    // on for slice text: one line, `text()` in `state-slices.ts`.
    const h = harness('recording');
    const { actions } = h.sim;
    const pair = '\u{1F600}';
    actions.signInWithBiometric('OPR-001');
    // The pair sits on the cut: code units 139 and 140 of the note.
    actions.addNote(`${'a'.repeat(138)}${pair} and the rest of a long note`);
    actions.addMarker(`${'m'.repeat(79)}${pair} and more`);
    actions.signOut();
    actions.signInWithSecurityKey();
    const destination = `${'d'.repeat(119)}${pair} and more`;
    // The contract refuses a destination of more than 120 UTF-16 code units, so a server that validates
    // never hands the engine a text to cut. The same text one unit under the bound passes. The engine is
    // still called with the long one, as the in-app simulator can be.
    expect(destination.length).toBe(130);
    expect(CORE_API_SCHEMAS.EvidenceExportRequest.safeParse({ reason: 'Case file transfer', destination }).success).toBe(false);
    expect(CORE_API_SCHEMAS.AuditExportRequest.safeParse({ reason: 'Quarterly audit', destination }).success).toBe(false);
    expect(CORE_API_SCHEMAS.EvidenceExportRequest.safeParse({ reason: 'Case file transfer', destination: `${'d'.repeat(118)}${pair}` }).success).toBe(true);
    expect(actions.exportEvidence('EV-20260930-0004', { reason: 'Case file transfer', destination })).toMatchObject({ ok: true });
    expect(actions.exportAudit({ reason: 'Quarterly audit', destination })).toMatchObject({ ok: true });
    expect(h.sim.errors()).toEqual([]);
    // Every text the engine cut is well-formed: the whole character was left out.
    const cut = h.state();
    expect(cut.session?.timeline.some((item) => item.detail === `${'a'.repeat(138)}…`)).toBe(true);
    expect(cut.audit.rows.filter((row) => row.details.destination === 'd'.repeat(119))).toHaveLength(2);
    expect(cut.audit.rows.some((row) => row.details.label === 'm'.repeat(79))).toBe(true);
    const strings: string[] = [];
    const collect = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          strings.push(key);
          collect(child);
        }
      }
    };
    collect(cut);
    expect(strings.filter((text) => !isWellFormedText(text))).toEqual([]);
    // The note itself is kept whole, pair included; only its timeline line was cut.
    expect(strings.some((text) => text.includes(pair))).toBe(true);
    // So every slice of that state passes the rule and survives the wire.
    expect(refusals([{ label: 'texts cut by the engine', state: cut }])).toEqual([]);
    const sent = wire(cut);
    expect(sent).toEqual(cut);
    // The chain of the parsed slice still verifies: the hashed text is the text that travelled.
    const audit = REPLICATED_SLICE_SCHEMAS.audit.parse(sent.audit);
    expect(verifyAuditChain(audit)).toMatchObject({ ok: true });

    // Directly: an unpaired surrogate or U+0000 in a free text of a slice, or in a key or a value of an
    // open map, is refused. Such a row could not be stored as it was hashed (03_database_contract §13.1).
    const session = sent.session;
    if (!session) throw new Error('the recording scenario has a session');
    const row = sent.audit.rows[0];
    for (const bad of ['a\ud83d', '\udc00b', 'a\u0000b']) {
      expect(refuses('session', { ...session, stopReason: bad }), JSON.stringify(bad)).toBe(true);
      expect(refuses('session', { ...session, notes: [{ id: 'NOTE-000099', at: AT, authorId: 'OPR-001', text: bad }] }), JSON.stringify(bad)).toBe(true);
      expect(refuses('audit', { ...sent.audit, rows: [{ ...row, message: bad }] }), JSON.stringify(bad)).toBe(true);
      expect(refuses('audit', { ...sent.audit, rows: [{ ...row, details: { destination: bad } }] }), JSON.stringify(bad)).toBe(true);
      expect(refuses('audit', { ...sent.audit, rows: [{ ...row, details: { [bad]: 'x' } }] }), JSON.stringify(bad)).toBe(true);
    }
    // The same members with well-formed text, a surrogate pair included, are accepted unchanged.
    const fine = { ...session, stopReason: `Interview completed ${pair}`, notes: [{ id: 'NOTE-000099', at: AT, authorId: 'OPR-001', text: pair }] };
    expect(REPLICATED_SLICE_SCHEMAS.session.parse(fine)).toStrictEqual(fine);
    // Identifiers and value sets stay closed whatever the text holds.
    expect(refuses('session', { ...session, id: 'SES-20261001-0024\u0000' })).toBe(true);
    expect(refuses('session', { ...session, state: 'RECORDING\ud83d' })).toBe(true);
    // An operator's members come from the `Operator` schema and carry the same rule.
    const operator = sent.operators[0];
    expect(refuses('operators', [{ ...operator, name: 'a\u0000b' }])).toBe(true);
  });
});

describe('the OpenAPI documents', () => {
  it('the `all` scope holds every state schema as a component, closed to unknown members; the offline scope holds none but the two capture slices', () => {
    const all = createOpenApiDocument({ scope: 'all' }).components.schemas;
    const offline = createOpenApiDocument().components.schemas;
    // Task 3 M2-W7 (`C3 §6`/`§8`, API-6): `captureConfig` and `captureDevices` are replicated slices
    // that SIMULATED operations 76-80/89 answer directly, so they appear in the offline document too.
    const offlineAnswered = new Set(['CaptureConfigSlice', 'CaptureDevicesSlice']);
    for (const name of Object.keys(STATE_SCHEMAS)) {
      expect(all[name], name).toBeDefined();
      if (offlineAnswered.has(name)) expect(offline[name], name).toBeDefined();
      else expect(offline[name], name).toBeUndefined();
    }
    const state = all.ReplicatedState as { required: string[]; additionalProperties: boolean; properties: Record<string, { $ref: string }> };
    expect(state.required).toEqual([...REPLICATED_SLICE_NAMES]);
    expect(state.additionalProperties).toBe(false);
    for (const name of REPLICATED_SLICE_NAMES) {
      expect(state.properties[name]?.$ref, name).toBe(`#/components/schemas/${stateSliceSchemaName(name)}`);
    }
    // Every object of every state component is closed.
    const open: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) node.forEach((item, index) => walk(item, `${path}[${index}]`));
      else if (node && typeof node === 'object') {
        const schema = node as Record<string, unknown>;
        if (schema.type === 'object' && schema.properties !== undefined && schema.additionalProperties !== false) open.push(path);
        for (const [key, child] of Object.entries(schema)) walk(child, `${path}.${key}`);
      }
    };
    for (const name of Object.keys(STATE_SCHEMAS)) walk(all[name], name);
    expect(open).toEqual([]);
    // Rows that more than one component uses are references.
    expect(JSON.stringify(all.AuditSlice)).toContain('#/components/schemas/AuditRow');
    expect(JSON.stringify(all.EvidenceItem)).toContain('#/components/schemas/SessionNote');
    expect(JSON.stringify(all.SessionSlice)).toContain('#/components/schemas/ActiveSession');
    // The operator of a slice is not the open `Operator` of a REST answer.
    expect(JSON.stringify(all.OperatorsSlice)).not.toContain('#/components/schemas/Operator');
    expect((all.OperatorsSlice as { items: { additionalProperties: boolean } }).items.additionalProperties).toBe(false);
  });
});
