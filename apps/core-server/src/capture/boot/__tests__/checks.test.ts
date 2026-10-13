// The CS-22 boot checks of real capture, as a decision (blueprint row 61; check M3-BC-1; specs R-2
// AC-3; capture spec §A.1.2). No file is read and no process is started here: every fact is handed in.
// One refusal test per rule, each beside the configuration that passes (the control).
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { CaptureOperation } from '../../adapters/kinds';
import type { ProgramFacts } from '../../adapters/local';
import { CaptureFlagRefusal, captureOperationDecisionOf, type CaptureOperationInput } from '../../fence/operation';
import {
  CaptureBootError,
  CaptureBootRefusal,
  EvidenceStoreProblem,
  HandshakeFailure,
  SIMULATED_WITHOUT_DEMO_CONTROLS,
  WorkerProgramProblem,
  evidenceStoreProblemOf,
  isProofWorkerVersion,
  runCaptureBootChecks,
  workerProgramProblemOf,
  workerVersionRefusalOf,
  type CaptureBootDeps,
  type EvidenceVolumeFacts,
  type WorkerHandshake,
  CAPTURE_WORKER_VERSION,
} from '../checks';
import { CaptureHostRefusal, HOST_COMMAND_CHECKS, type HostCommand } from '../host-checks';
import { CANARY, HOST_ANSWERS, PREPARED_INTERFACE, PROGRAM_ANSWERS, fakeHost, fakeProductionHost, type FakeHostOptions } from './host-support';
import { INTERFACE_FILE_COMMAND, PROGRAM_OWNERSHIP_CHECKS, type DeliveredProgramDeps } from '../program-checks';
import { recordedSinks } from './support';

const SERVER_UID = 501;
const WORKER = '/opt/dems/capture-worker';
const flags = (overrides: Partial<CaptureOperationInput> = {}): CaptureOperationInput => ({ captureMode: 'real', demoControls: false, captureDevSources: false, host: '127.0.0.1', ...overrides });
const goodProgram = (overrides: Partial<ProgramFacts> = {}): ProgramFacts => ({
  absolute: true,
  exists: true,
  regularFile: true,
  symbolicLink: false,
  file: { ownerUid: SERVER_UID, mode: 0o755 },
  directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: SERVER_UID, mode: 0o755 }],
  directoriesResolved: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: SERVER_UID, mode: 0o755 }],
  serverUid: SERVER_UID,
  ...overrides,
});
const goodVolume = (overrides: Partial<EvidenceVolumeFacts> = {}): EvidenceVolumeFacts => ({
  absolute: true,
  present: true,
  directory: true,
  ownerUid: SERVER_UID,
  mode: 0o700,
  serverUid: SERVER_UID,
  exclusiveCreate: true,
  exclusiveRefusesSecond: true,
  synced: true,
  hardLink: true,
  linkRefusesExisting: true,
  cleaned: true,
  totalBytes: 1_000_000_000_000,
  freeBytes: 400_000_000_000,
  ...overrides,
});
const HELLO: WorkerHandshake = { outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION };

interface Scene {
  readonly deps: CaptureBootDeps;
  readonly calls: string[];
  readonly recorded: ReturnType<typeof recordedSinks>;
}
function scene(overrides: Partial<Omit<CaptureBootDeps, 'sinks'>> & { readonly config?: Partial<CaptureOperationInput>; readonly program?: ProgramFacts; readonly volume?: EvidenceVolumeFacts; readonly hello?: WorkerHandshake } = {}): Scene {
  const calls: string[] = [];
  const recorded = recordedSinks();
  const deps: CaptureBootDeps = {
    decision: captureOperationDecisionOf(flags(overrides.config)),
    workerProgram: WORKER,
    inspect: () => (calls.push('inspect'), overrides.program ?? goodProgram()),
    probeEvidenceVolume: () => (calls.push('volume'), overrides.volume ?? goodVolume()),
    signingKeyProblem: () => (calls.push('key'), null),
    signingKeyIsDevelopment: () => false,
    demoPasswordOperators: async () => 0,
    handshake: async () => (calls.push('handshake'), overrides.hello ?? HELLO),
    ...overrides,
    sinks: recorded.sinks,
  };
  return { deps, calls, recorded };
}
async function refusalOf(deps: CaptureBootDeps): Promise<CaptureBootError> {
  const failure = await runCaptureBootChecks(deps).then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof CaptureBootError)) throw new Error('the boot checks did not refuse');
  return failure;
}

describe('a real operation that has everything passes, in both source classes (control)', () => {
  it.each([[false, CaptureOperation.REAL_PRODUCTION], [true, CaptureOperation.REAL_DEVELOPMENT]] as const)('development flag %s -> %s: every check ran, in order, and the worker last', async (captureDevSources, operation) => {
    const { deps, calls, recorded } = scene({ config: { captureDevSources } });
    await expect(runCaptureBootChecks(deps)).resolves.toEqual({ operation, label: null, workerVersion: CAPTURE_WORKER_VERSION, evidenceVolume: { totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 } });
    expect(calls).toEqual(['inspect', 'volume', 'key', 'handshake']);
    expect(recorded.lines.map((line) => [line.level, line.fields['code'], line.fields['checks']])).toEqual([['info', 'CAPTURE_BOOT_CHECKS_PASSED', 'real']]);
    expect(recorded.persisted).toEqual([]);
  });
});

describe('M3-BC-1: what a real start is refused for (one refusal each)', () => {
  it('a missing key: no worker program configured', async () => {
    for (const workerProgram of [null, '']) {
      const { deps, calls, recorded } = scene({ workerProgram });
      const failure = await refusalOf(deps);
      expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.WORKER_NOT_CONFIGURED, null]);
      expect(failure.message).toContain('DEMS_CAPTURE_WORKER');
      // Nothing was inspected, probed or started.
      expect(calls).toEqual([]);
      expect(recorded.lines.map((line) => line.level)).toEqual(['error']);
      expect(recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: CaptureBootRefusal.WORKER_NOT_CONFIGURED }]);
    }
  });

  it('capture mode real with demo controls on: the one function refuses, and this step repeats it with the fence\'s code', async () => {
    for (const captureDevSources of [false, true]) {
      const { deps, calls } = scene({ config: { demoControls: true, captureDevSources } });
      expect(deps.decision.refusal).toBe(CaptureFlagRefusal.REAL_CAPTURE_WITH_DEMO_CONTROLS);
      // A refused combination answers SIMULATED: a reader that forgot the refusal starts nothing.
      expect(deps.decision.operation).toBe(CaptureOperation.SIMULATED);
      const failure = await refusalOf(deps);
      expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.OPERATION_REFUSED, 'REAL_CAPTURE_WITH_DEMO_CONTROLS']);
      expect(calls).toEqual([]);
    }
    // The other two refusals of the flags stop this step the same way.
    expect((await refusalOf(scene({ config: { captureMode: 'simulated', captureDevSources: true } }).deps)).reason).toBe('DEV_SOURCES_NEED_REAL_CAPTURE');
    expect((await refusalOf(scene({ config: { captureDevSources: true, host: '0.0.0.0' } }).deps)).reason).toBe('DEV_FLAG_WITH_LAN_LISTENER');
  });

  it.each([
    ['a relative path', { absolute: false }, WorkerProgramProblem.NOT_ABSOLUTE],
    ['a path that is not there', { exists: false, file: null }, WorkerProgramProblem.NOT_FOUND],
    ['a directory', { regularFile: false }, WorkerProgramProblem.NOT_A_FILE],
    ['a file of another user', { file: { ownerUid: 502, mode: 0o755 } }, WorkerProgramProblem.FILE_OWNER],
    ['a file group can write', { file: { ownerUid: SERVER_UID, mode: 0o775 } }, WorkerProgramProblem.FILE_WRITABLE],
    ['a file others can write', { file: { ownerUid: SERVER_UID, mode: 0o757 } }, WorkerProgramProblem.FILE_WRITABLE],
    ['a directory on the way that group can write', { directoriesResolved: [{ ownerUid: 0, mode: 0o775 }] }, WorkerProgramProblem.DIRECTORY_WRITABLE],
    ['a directory on the way of another user', { directoriesAsWritten: [{ ownerUid: 502, mode: 0o755 }] }, WorkerProgramProblem.DIRECTORY_OWNER],
    ['a file nobody may execute', { file: { ownerUid: SERVER_UID, mode: 0o644 } }, WorkerProgramProblem.NOT_EXECUTABLE],
  ] as const)('an unusable worker path: %s', async (_title, facts, reason) => {
    const { deps, calls } = scene({ program: goodProgram(facts as Partial<ProgramFacts>) });
    const failure = await refusalOf(deps);
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.WORKER_PROGRAM_UNUSABLE, reason]);
    // The program is never started from a path that failed the rule, and nothing after it runs.
    expect(calls).toEqual(['inspect']);
    // The refusal names the key and the reason code, never the path.
    expect(failure.message).not.toContain(WORKER);
  });

  it('a root-owned worker passes the path rule (control), and the rule is the helper program\'s', () => {
    expect(workerProgramProblemOf(WORKER, () => goodProgram({ file: { ownerUid: 0, mode: 0o755 } }))).toBeNull();
    expect(workerProgramProblemOf(WORKER, () => goodProgram())).toBeNull();
  });

  it.each([
    ['PROOF build of the negative control', 'capture-worker/0.3.0-PROOF', CaptureBootRefusal.WORKER_PROOF_BUILD],
    ['the mark in another case', 'capture-worker/0.3.0-proof', CaptureBootRefusal.WORKER_PROOF_BUILD],
    ['the mark in the middle', 'capture-worker-PROOF/0.3.0', CaptureBootRefusal.WORKER_PROOF_BUILD],
    ['a build under another mark', 'capture-worker/0.3.0-negctl', CaptureBootRefusal.WORKER_VERSION_UNKNOWN],
    ['another program that speaks the protocol', 'stub-worker', CaptureBootRefusal.WORKER_VERSION_UNKNOWN],
  ] as const)('a %s is refused at HELLO', async (_title, workerVersion, code) => {
    const { deps, calls } = scene({ hello: { outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion } });
    expect((await refusalOf(deps)).code).toBe(code);
    expect(calls).toEqual(['inspect', 'volume', 'key', 'handshake']);
  });

  it('the proof mark is found wherever it stands; a release version does not carry it (control)', () => {
    expect(['capture-worker/0.3.0-PROOF', 'x-Proof-y', '-PROOF'].every(isProofWorkerVersion)).toBe(true);
    expect(['capture-worker/0.3.0', 'capture-worker/12.0.1', 'proof', 'capture-worker/0.3.0-PRO'].some(isProofWorkerVersion)).toBe(false);
    // Pin by delta (wave H driver F, gate 64 C7): the release FORM is no longer enough - only THE version this Core drives is taken.
    expect(workerVersionRefusalOf({ protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/12.0.1' })).toBe(CaptureBootRefusal.WORKER_VERSION_MISMATCH);
    expect(workerVersionRefusalOf({ protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION })).toBeNull();
  });

  it('a worker of another protocol version, and a program that does not answer', async () => {
    expect((await refusalOf(scene({ hello: { outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION - 1, workerVersion: 'capture-worker/0.2.0' } }).deps)).code).toBe(CaptureBootRefusal.WORKER_PROTOCOL_MISMATCH);
    // Pin by delta (fix pass F-M7c, D188 (a)): MEDIA_LIBRARY_MISMATCH is a worker that DID answer - it has its own named refusal (asserted below).
    for (const failure of Object.values(HandshakeFailure).filter((value) => value !== HandshakeFailure.MEDIA_LIBRARY_MISMATCH)) {
      const refused = await refusalOf(scene({ hello: { outcome: 'NONE', failure } }).deps);
      expect([refused.code, refused.reason]).toEqual([CaptureBootRefusal.WORKER_NO_HANDSHAKE, failure]);
    }
  });

  it.each([
    [{ absolute: false }, EvidenceStoreProblem.NOT_ABSOLUTE],
    [{ present: false }, EvidenceStoreProblem.NOT_CREATABLE],
    [{ directory: false }, EvidenceStoreProblem.NOT_A_DIRECTORY],
    [{ ownerUid: 0 }, EvidenceStoreProblem.OWNER],
    [{ serverUid: -1 }, EvidenceStoreProblem.OWNER],
    [{ mode: 0o770 }, EvidenceStoreProblem.WRITABLE_BY_OTHERS],
    [{ mode: 0o1777 }, EvidenceStoreProblem.WRITABLE_BY_OTHERS],
    [{ exclusiveCreate: false }, EvidenceStoreProblem.NOT_WRITABLE],
    [{ exclusiveRefusesSecond: false }, EvidenceStoreProblem.NO_EXCLUSIVE_CREATE],
    [{ synced: false }, EvidenceStoreProblem.NO_SYNC],
    [{ hardLink: false }, EvidenceStoreProblem.NO_HARD_LINKS],
    [{ linkRefusesExisting: false }, EvidenceStoreProblem.LINK_REPLACES_EXISTING],
    [{ cleaned: false }, EvidenceStoreProblem.PROBE_LEFT_BEHIND],
  ] as const)('an evidence store with %j is refused as %s, before the key is read or the worker started', async (facts, reason) => {
    expect(evidenceStoreProblemOf(goodVolume(facts))).toBe(reason);
    const { deps, calls } = scene({ volume: goodVolume(facts) });
    const failure = await refusalOf(deps);
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.EVIDENCE_STORE_UNUSABLE, reason]);
    expect(calls).toEqual(['inspect', 'volume']);
  });

  it('a volume that does not say its size is no refusal: the figures are reported as unknown (control)', async () => {
    expect(evidenceStoreProblemOf(goodVolume({ totalBytes: null, freeBytes: null }))).toBeNull();
    const { deps } = scene({ volume: goodVolume({ totalBytes: null, freeBytes: null }) });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ evidenceVolume: { totalBytes: null, freeBytes: null } });
  });

  it('an evidence signing key that does not load', async () => {
    const { deps, calls } = scene({ signingKeyProblem: () => 'KEY_ABSENT' });
    const failure = await refusalOf(deps);
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.SIGNING_KEY_UNUSABLE, 'KEY_ABSENT']);
    expect(calls).toEqual(['inspect', 'volume']);
  });
});

describe('SIMULATED: the checks are inert, and every stored kind with them (D83 O-2)', () => {
  const throwing = (name: string) => (): never => {
    throw new Error(`${name} must not be called in SIMULATED`);
  };
  const inert = { inspect: throwing('inspect'), probeEvidenceVolume: throwing('volume'), signingKeyProblem: throwing('key'), handshake: throwing('handshake') };

  it('today\'s demo (demo controls on): passes, reads nothing, starts nothing, says nothing but the passed line', async () => {
    const { deps, recorded } = scene({ config: { captureMode: 'simulated', demoControls: true }, workerProgram: null, ...inert });
    await expect(runCaptureBootChecks(deps)).resolves.toEqual({ operation: CaptureOperation.SIMULATED, label: null, workerVersion: null, evidenceVolume: null });
    expect(recorded.lines.map((line) => [line.level, line.fields['checks'], line.fields['label']])).toEqual([['info', 'inert', undefined]]);
    expect(recorded.persisted).toEqual([]);
  });

  it('table row 5, simulated without demo controls: boots, LABELLED, never called real', async () => {
    const { deps, recorded } = scene({ config: { captureMode: 'simulated', demoControls: false }, workerProgram: null, ...inert });
    const outcome = await runCaptureBootChecks(deps);
    expect([outcome.operation, outcome.label]).toEqual([CaptureOperation.SIMULATED, SIMULATED_WITHOUT_DEMO_CONTROLS]);
    expect(recorded.lines.map((line) => [line.level, line.fields['operation'], line.fields['label']])).toEqual([['info', 'SIMULATED', SIMULATED_WITHOUT_DEMO_CONTROLS]]);
  });

  it('a worker program configured in simulated is a warning in the log and the error log, and is never inspected or started (A-12)', async () => {
    const { deps, recorded } = scene({ config: { captureMode: 'simulated', demoControls: true }, ...inert });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: CaptureOperation.SIMULATED, workerVersion: null });
    expect(recorded.lines.map((line) => [line.level, line.fields['code']])).toEqual([['warn', 'CAPTURE_WORKER_IGNORED_IN_SIMULATED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.persisted).toEqual([{ level: 'warn', source: 'capture.boot', code: 'CAPTURE_WORKER_IGNORED_IN_SIMULATED' }]);
  });
});

describe('what a refusal says', () => {
  it('every code has a text that names a key or the remedy; no text holds a path of this host', () => {
    for (const code of Object.values(CaptureBootRefusal)) {
      const failure = new CaptureBootError(code, 'REASON_CODE');
      expect(failure.message, code).toMatch(/DEMS_|data directory|capture worker/);
      expect(failure.message, code).toMatch(/ Reason: REASON_CODE\.$/);
      expect(failure.message, code).not.toMatch(/\/Users\/|\/opt\/|\/private\//);
    }
  });
});

// ── Fix pass F-M7 (review row 88; decision D178) ─────────────────────────────────────────────────
describe('F-M7 R88-04: the evidence store root is OWNER-ONLY (recordings lie there in plaintext until they are sealed, D147)', () => {
  it.each([
    [0o750, 'READABLE_BY_OTHERS'],
    [0o705, 'READABLE_BY_OTHERS'],
    [0o755, 'READABLE_BY_OTHERS'],
    [0o710, 'READABLE_BY_OTHERS'],
    [0o770, 'WRITABLE_BY_OTHERS'],
    [0o777, 'WRITABLE_BY_OTHERS'],
  ] as const)('a store root with mode %o is refused: %s', (mode, problem) => {
    expect(evidenceStoreProblemOf(goodVolume({ mode }))).toBe(problem);
  });

  it('CONTROL: 0700 is the store the Core makes and accepts', () => {
    expect(evidenceStoreProblemOf(goodVolume({ mode: 0o700 }))).toBeNull();
  });

  it('a real-mode boot on a store that others can read is REFUSED by name, before the signing key is read and before the worker is started', async () => {
    const { deps, calls, recorded } = scene({ volume: goodVolume({ mode: 0o755 }) });
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_EVIDENCE_STORE_UNUSABLE', reason: 'READABLE_BY_OTHERS' });
    expect(calls).toEqual(['inspect', 'volume']);
    expect(recorded.persisted.at(-1)).toMatchObject({ level: 'error', code: 'CAPTURE_EVIDENCE_STORE_UNUSABLE' });
    // The operator-facing text of the refusal says what lies there and how to close it.
    expect(failure.message).toMatch(/owner-only|chmod 700/);
  });
});

describe('F-M7 R88-08 (3): a development signing key never signs for a production Core', () => {
  it('REAL_PRODUCTION with a signing key whose certificate carries the development mark: the boot is REFUSED by name, the worker is not started', async () => {
    const { deps, calls, recorded } = scene({ signingKeyIsDevelopment: () => (calls.push('dev?'), true) } as never);
    expect(deps.decision.operation).toBe('REAL_PRODUCTION');
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION' });
    expect(calls).not.toContain('handshake');
    expect(recorded.persisted.at(-1)).toMatchObject({ level: 'error', code: 'CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION' });
  });

  it('CONTROL: REAL_DEVELOPMENT accepts the development key; REAL_PRODUCTION accepts a key without the mark', async () => {
    const development = scene({ config: { captureDevSources: true }, signingKeyIsDevelopment: () => true } as never);
    expect(development.deps.decision.operation).toBe('REAL_DEVELOPMENT');
    await expect(runCaptureBootChecks(development.deps)).resolves.toMatchObject({ operation: 'REAL_DEVELOPMENT' });
    const production = scene({ signingKeyIsDevelopment: () => false } as never);
    await expect(runCaptureBootChecks(production.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
  });
});

// ── Batch N (security review row 99, finding S99-01 HIGH; ruling D241) ───────────────────────────
describe('S99-01: a production Core does not start while an operator still has the published demo password', () => {
  it('REAL_PRODUCTION with 3 such operators: REFUSED by name, the COUNT is said and logged, the worker is not started', async () => {
    const { deps, calls, recorded } = scene({ demoPasswordOperators: async () => (calls.push('operators'), 3) });
    expect(deps.decision.operation).toBe('REAL_PRODUCTION');
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION', reason: 'operators=3' });
    expect(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION).toBe('CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION');
    // After the file checks and the key, before any process is started.
    expect(calls).toEqual(['inspect', 'volume', 'key', 'operators']);
    expect(recorded.lines.at(-1)).toMatchObject({ level: 'error', fields: { code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION', operation: 'REAL_PRODUCTION', operators: 3 } });
    expect(recorded.persisted.at(-1)).toMatchObject({ level: 'error', source: 'capture.boot', code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION' });
    // The text names the remedy and the count; the published password itself is in no line, no error-log row and no message.
    const password: string = DEMO_OPERATOR_PASSWORD;
    expect(failure.message).toMatch(/3 operator/);
    expect(JSON.stringify([failure.message, recorded.lines, recorded.persisted]).includes(password)).toBe(false);
  });

  it('FAIL CLOSED: REAL_PRODUCTION whose operators cannot be read (null) is refused under the same code, reason OPERATORS_UNREADABLE', async () => {
    const { deps, calls } = scene({ demoPasswordOperators: async () => null });
    expect(await refusalOf(deps)).toMatchObject({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION', reason: 'OPERATORS_UNREADABLE' });
    expect(calls).not.toContain('handshake');
    const throwing = scene({ demoPasswordOperators: async () => Promise.reject(new Error('the pool is closed')) });
    expect(await refusalOf(throwing.deps)).toMatchObject({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION', reason: 'OPERATORS_UNREADABLE' });
    expect(JSON.stringify(throwing.recorded.lines)).not.toContain('the pool is closed');
  });

  it('CONTROL: REAL_PRODUCTION with no such operator passes; REAL_DEVELOPMENT and SIMULATED never ask', async () => {
    const production = scene({ demoPasswordOperators: async () => (production.calls.push('operators'), 0) });
    await expect(runCaptureBootChecks(production.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(production.calls).toEqual(['inspect', 'volume', 'key', 'operators', 'handshake']);
    for (const config of [{ captureDevSources: true }, { captureMode: 'simulated', demoControls: true }] as const) {
      const other = scene({ config, demoPasswordOperators: async () => (other.calls.push('operators'), 9) });
      await expect(runCaptureBootChecks(other.deps)).resolves.toMatchObject({ operation: other.deps.decision.operation });
      expect(other.deps.decision.operation).not.toBe('REAL_PRODUCTION');
      expect(other.calls).not.toContain('operators');
    }
  });
});

// ── Fix pass F-M7c (item 2; decisions D178, D180) ────────────────────────────────────────────────
describe('F-M7c: the hidden folders of the evidence store are OWNER-ONLY too (quarantined recordings and the transcriber scratch are plaintext)', () => {
  const folder = (name: string, over: Partial<{ directory: boolean; ownerUid: number | null; mode: number | null }> = {}) => ({ name, directory: true, ownerUid: 501, mode: 0o700, ...over });

  it.each([
    ['.quarantine', 0o750, 'QUARANTINE_READABLE_BY_OTHERS'],
    ['.quarantine', 0o701, 'QUARANTINE_READABLE_BY_OTHERS'],
    ['.transcriber', 0o755, 'TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS'],
    ['.transcriber/sessions', 0o710, 'TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS'],
  ] as const)('%s with mode %o is refused: %s', (name, mode, problem) => {
    expect(evidenceStoreProblemOf(goodVolume({ privateFolders: [folder(name, { mode })] }))).toBe(problem);
  });

  it('a hidden folder that is a LINK or a file (not a directory), or of another user, is refused the same way', () => {
    expect(evidenceStoreProblemOf(goodVolume({ privateFolders: [folder('.quarantine', { directory: false })] }))).toBe('QUARANTINE_READABLE_BY_OTHERS');
    expect(evidenceStoreProblemOf(goodVolume({ privateFolders: [folder('.transcriber', { ownerUid: 0 })] }))).toBe('TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS');
  });

  it('CONTROL: folders that are 0700 directories of the server, and a store with none of them, are accepted', () => {
    expect(evidenceStoreProblemOf(goodVolume({ privateFolders: [folder('.quarantine'), folder('.transcriber'), folder('.transcriber/sessions')] }))).toBeNull();
    expect(evidenceStoreProblemOf(goodVolume({ privateFolders: [] }))).toBeNull();
    expect(evidenceStoreProblemOf(goodVolume({}))).toBeNull();
  });

  it('a real-mode boot with a quarantine others can read is REFUSED by name before the signing key is read and the worker is started', async () => {
    const { deps, calls } = scene({ volume: goodVolume({ privateFolders: [folder('.quarantine', { mode: 0o755 })] }) });
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_EVIDENCE_STORE_UNUSABLE', reason: 'QUARANTINE_READABLE_BY_OTHERS' });
    expect(calls).toEqual(['inspect', 'volume']);
  });
});

// ── Fix pass F-M7c (controller decision D188 (a)) ────────────────────────────────────────────────
describe('D188 (a): a worker whose media library is not the verified one is a NAMED boot refusal', () => {
  it('the handshake says MEDIA_LIBRARY_MISMATCH: the boot is refused as CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH with the sentence an installer needs - not as "no HELLO"', async () => {
    const { deps, recorded } = scene({ hello: { outcome: 'NONE', failure: HandshakeFailure.MEDIA_LIBRARY_MISMATCH } });
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH', reason: 'LIBAVFORMAT_VERSION_MISMATCH' });
    expect(failure.message).toMatch(/libavformat/);
    expect(failure.message).toMatch(/make -C apps\/capture-worker/);
    expect(recorded.persisted.at(-1)).toMatchObject({ level: 'error', code: 'CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH' });
  });

  it('CONTROL: every other handshake failure is still CAPTURE_WORKER_NO_HANDSHAKE with its reason', async () => {
    const { deps } = scene({ hello: { outcome: 'NONE', failure: HandshakeFailure.EXITED } });
    expect(await refusalOf(deps)).toMatchObject({ code: 'CAPTURE_WORKER_NO_HANDSHAKE', reason: 'EXITED' });
  });
});

// ── Task 4 row 80 (WP-20): the host checks of a production Core, as step 4d of the boot ───────────
describe('row 80: the host checks run in REAL_PRODUCTION only, after the operators and before the worker; a missing prerequisite is refused by its own code', () => {
  const codeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => check.command.program === command.program && check.command.args.join(' ') === command.args.join(' '))?.code;
  const host = (options: Omit<FakeHostOptions, 'codeOf'> = {}): ReturnType<typeof fakeHost> => fakeHost({ ...options, codeOf });
  const said = (failure: CaptureBootError | null, recorded: ReturnType<typeof recordedSinks>): string => JSON.stringify([failure?.message ?? null, failure?.reason ?? null, recorded.lines, recorded.persisted]);

  it('a prepared Linux host passes: one line for the host, then the unchanged line of the boot; the worker is started last', async () => {
    const prepared = host();
    const { deps, calls, recorded } = scene({ host: prepared.deps });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION', workerVersion: CAPTURE_WORKER_VERSION });
    // The worker's path rule, the store, the key; then the relay and the guard under the SAME rule; the worker itself last.
    expect(calls).toEqual(['inspect', 'volume', 'key', 'inspect', 'inspect', 'handshake']);
    expect(prepared.asked).toHaveLength(HOST_COMMAND_CHECKS.length);
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['info', 'CAPTURE_HOST_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.lines[0]?.fields).toEqual({ code: 'CAPTURE_HOST_CHECKS_PASSED', operation: 'REAL_PRODUCTION', hostChecks: 4 + HOST_COMMAND_CHECKS.length });
    expect(recorded.lines[1]?.fields).toEqual({ code: 'CAPTURE_BOOT_CHECKS_PASSED', operation: 'REAL_PRODUCTION', checks: 'real', workerVersion: CAPTURE_WORKER_VERSION, volumeTotalBytes: 1_000_000_000_000, volumeFreeBytes: 400_000_000_000 });
    expect(recorded.persisted).toEqual([]);
  });

  it('BR-12: with the loopback rule missing the boot names exactly that prerequisite, asks nothing further and does not start the worker', async () => {
    const answer = HOST_ANSWERS[CaptureHostRefusal.HOST_LOOPBACK_RULE]?.absent[0]?.answer;
    if (answer === undefined) throw new Error('no answer');
    const unprepared = host({ answers: { [CaptureHostRefusal.HOST_LOOPBACK_RULE]: answer } });
    const { deps, calls, recorded } = scene({ host: unprepared.deps });
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_HOST_LOOPBACK_RULE_MISSING', reason: 'RULE_UNIT_NOT_ACTIVE' });
    expect(failure.message).toMatch(/HOST-25/);
    expect(failure.message).toMatch(/ Reason: RULE_UNIT_NOT_ACTIVE\.$/);
    expect(unprepared.asked).toEqual(['/usr/bin/systemctl is-active dems-loopback-rule.service']);
    expect(calls).not.toContain('handshake');
    expect(recorded.lines).toEqual([{ level: 'error', fields: { code: 'CAPTURE_HOST_LOOPBACK_RULE_MISSING', operation: 'REAL_PRODUCTION', reason: 'RULE_UNIT_NOT_ACTIVE' }, message: 'the capture boot checks refuse this start: the server does not start' }]);
    expect(recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_LOOPBACK_RULE_MISSING' }]);
  });

  it('every prerequisite, removed one at a time, is the one the boot names; nothing of an output reaches the message, the log or the error log', async () => {
    for (const check of HOST_COMMAND_CHECKS) {
      const answers = HOST_ANSWERS[check.code];
      for (const answer of [...(answers?.absent.map((entry) => entry.answer) ?? []), ...(answers?.malformed ?? []), { outcome: 'NOT_STARTED' } as const, { outcome: 'TIMED_OUT' } as const]) {
        const { deps, calls, recorded } = scene({ host: host({ answers: { [check.code]: answer } }).deps });
        const failure = await refusalOf(deps);
        expect(failure.code, JSON.stringify(answer)).toBe(check.code);
        expect(failure.reason, JSON.stringify(answer)).toMatch(/^[A-Z][A-Z_]+$/);
        expect(calls).not.toContain('handshake');
        expect(said(failure, recorded)).not.toMatch(/CANARY|hunter2|\/home\/|apport|\/usr\/|\/run\/|\/proc\//);
        expect(recorded.lines.at(-1)?.fields).toEqual({ code: check.code, operation: 'REAL_PRODUCTION', reason: failure.reason });
      }
    }
    expect(CANARY).toMatch(/hunter2/);
  });

  it('AD-09 (1): a core-file limit above 0 is refused in REAL_PRODUCTION before any question is asked; the relay and the guard are held to the path rule', async () => {
    const limited = host({ coreFileLimit: () => Infinity });
    const first = scene({ host: limited.deps });
    expect(await refusalOf(first.deps)).toMatchObject({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_ABOVE_ZERO' });
    expect(limited.asked).toEqual([]);
    expect(await refusalOf(scene({ host: host({ relayProgram: null }).deps }).deps)).toMatchObject({ code: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE', reason: 'NOT_SET' });
    expect(await refusalOf(scene({ host: host({ guardProgram: null }).deps }).deps)).toMatchObject({ code: 'CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE', reason: 'NOT_SET' });
    // The second and third program asked are refused by the rule of check 2: the worker (first) passes, the relay does not.
    let asked = 0;
    const writable = scene({ host: host().deps, inspect: () => ((asked += 1), asked === 1 ? goodProgram() : goodProgram({ file: { ownerUid: SERVER_UID, mode: 0o777 } })) });
    expect(await refusalOf(writable.deps)).toMatchObject({ code: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE', reason: WorkerProgramProblem.FILE_WRITABLE });
  });

  it('REAL_DEVELOPMENT and SIMULATED never ask the host, however unprepared it is; a composition without host facts asks nothing either', async () => {
    const broken = (): ReturnType<typeof fakeHost> => host({ coreFileLimit: () => Infinity, relayProgram: null, guardProgram: null, startArguments: ['--inspect'], answers: Object.fromEntries(HOST_COMMAND_CHECKS.map((check) => [check.code, { outcome: 'NOT_STARTED' } as const])) });
    for (const config of [{ captureDevSources: true }, { captureMode: 'simulated' as const, demoControls: true }, { captureMode: 'simulated' as const }]) {
      const unprepared = broken();
      const { deps, recorded } = scene({ config, host: unprepared.deps });
      const outcome = await runCaptureBootChecks(deps);
      expect(outcome.operation).not.toBe(CaptureOperation.REAL_PRODUCTION);
      expect(unprepared.asked).toEqual([]);
      expect(recorded.lines.filter((line) => String(line.fields.code).includes('HOST'))).toEqual([]);
    }
    const without = scene();
    await expect(runCaptureBootChecks(without.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(without.calls).toEqual(['inspect', 'volume', 'key', 'handshake']);
    expect(without.recorded.lines.map((line) => line.fields.code)).toEqual(['CAPTURE_BOOT_CHECKS_PASSED']);
  });

  it('REAL_PRODUCTION on a host that is not Linux: no question is asked and that is SAID as a warning, not passed over; the own-process checks still refuse', async () => {
    const mac = host({ platform: 'darwin' });
    const { deps, recorded } = scene({ host: mac.deps });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(mac.asked).toEqual([]);
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['warn', 'CAPTURE_HOST_PROFILE_NOT_ASKED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.persisted).toEqual([{ level: 'warn', source: 'capture.boot', code: 'CAPTURE_HOST_PROFILE_NOT_ASKED' }]);
    expect(await refusalOf(scene({ host: host({ platform: 'darwin', startArguments: ['--heapsnapshot-signal=SIGUSR2'] }).deps }).deps)).toMatchObject({ code: 'CAPTURE_HOST_DIAGNOSTIC_SWITCH', reason: 'DIAGNOSTIC_SWITCH_SET' });
  });

  it('an earlier refusal stays the one that is said: the host is not asked when the operators already refuse the start', async () => {
    const prepared = host({ coreFileLimit: () => Infinity });
    const { deps } = scene({ host: prepared.deps, demoPasswordOperators: async () => 2 });
    expect(await refusalOf(deps)).toMatchObject({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION' });
    expect(prepared.asked).toEqual([]);
  });
});

// ── Task 4 row 81 (WP-20): the delivered programs, as step 4e of the boot ─────────────────────────
describe('row 81: the checks of the delivered programs run in REAL_PRODUCTION only, after the host checks and before the worker; each is refused by its own code', () => {
  const hostCodeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => check.command.program === command.program && check.command.args.join(' ') === command.args.join(' '))?.code;
  const same = (a: HostCommand, b: HostCommand): boolean => a.program === b.program && a.args.join(' ') === b.args.join(' ');
  const RELAY = '/srv/dems/relay';
  const programKeyOf = (command: HostCommand): string | undefined => (command.program === RELAY && command.args.length === 0 ? 'RELAY' : same(command, INTERFACE_FILE_COMMAND) ? 'INTERFACE' : PROGRAM_OWNERSHIP_CHECKS.find((check) => same(check.command, command))?.code);
  /** One prepared production host for both steps: the host facts of 4d and what 4e needs, over ONE runner. */
  const production = (options: { readonly platform?: string; readonly programAnswers?: Parameters<typeof fakeProductionHost>[0]['programAnswers']; readonly stored?: () => Promise<string | null> } = {}) => {
    const host = fakeProductionHost({ codeOf: hostCodeOf, programKeyOf, ...(options.platform === undefined ? {} : { platform: options.platform }), ...(options.programAnswers === undefined ? {} : { programAnswers: options.programAnswers }) });
    const programs: DeliveredProgramDeps = { platform: host.deps.platform, relayProgram: host.deps.relayProgram, run: host.deps.run, storedInterface: options.stored ?? (async () => PREPARED_INTERFACE) };
    return { host, programs };
  };
  const failing = (key: string, index = 0) => {
    const answer = PROGRAM_ANSWERS[key]?.absent[index]?.answer;
    if (answer === undefined) throw new Error('no answer');
    return answer;
  };

  it('a prepared Linux host passes: the host line, the line of the programs, then the unchanged line of the boot; the relay is asked after the host and the worker is started last', async () => {
    const prepared = production();
    const { deps, calls, recorded } = scene({ host: prepared.host.deps, programs: prepared.programs });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION', workerVersion: CAPTURE_WORKER_VERSION });
    // The worker's path rule, the store, the key; relay and guard under the rule (4d); the relay under the rule once more (4e); the worker last.
    expect(calls).toEqual(['inspect', 'volume', 'key', 'inspect', 'inspect', 'inspect', 'handshake']);
    expect(prepared.host.asked).toHaveLength(HOST_COMMAND_CHECKS.length + 4);
    expect(prepared.host.asked.slice(HOST_COMMAND_CHECKS.length)).toEqual([
      RELAY,
      '/usr/bin/stat -c %F %U %G %a /usr/local/sbin/dems-core-netalias /usr/local/sbin',
      '/usr/bin/stat -c %F %U %G %a /run/dems-core-netalias /etc/systemd/system/dems-core-netalias.socket /etc/systemd/system/dems-core-netalias@.service',
      '/usr/bin/cat /etc/dems/netalias-interface',
    ]);
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['info', 'CAPTURE_HOST_CHECKS_PASSED'], ['info', 'CAPTURE_PROGRAM_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.lines[1]?.fields).toEqual({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation: 'REAL_PRODUCTION', programChecks: 4, notAsked: 0 });
    // The two lines of before are what they were.
    expect(recorded.lines[0]?.fields).toEqual({ code: 'CAPTURE_HOST_CHECKS_PASSED', operation: 'REAL_PRODUCTION', hostChecks: 4 + HOST_COMMAND_CHECKS.length });
    expect(recorded.lines[2]?.fields).toEqual({ code: 'CAPTURE_BOOT_CHECKS_PASSED', operation: 'REAL_PRODUCTION', checks: 'real', workerVersion: CAPTURE_WORKER_VERSION, volumeTotalBytes: 1_000_000_000_000, volumeFreeBytes: 400_000_000_000 });
    expect(recorded.persisted).toEqual([]);
    expect(JSON.stringify(recorded.lines)).not.toContain(PREPARED_INTERFACE);
  });

  it('A MISMATCH OF FILE AND ROW IS A NAMED REFUSAL of the boot: the code, the reason, one error line, one error-log row; the worker is not started and no interface name is said', async () => {
    const unprepared = production({ programAnswers: { INTERFACE: failing('INTERFACE', 1) } });
    const { deps, calls, recorded } = scene({ host: unprepared.host.deps, programs: unprepared.programs });
    const failure = await refusalOf(deps);
    expect(failure).toMatchObject({ code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', reason: 'INTERFACE_FILE_DIFFERS_FROM_ROW' });
    expect(failure.code).toBe(CaptureBootRefusal.PROGRAM_INTERFACE_FILE);
    expect(failure.message).toMatch(/HOST-46/);
    expect(failure.message).toMatch(/ Reason: INTERFACE_FILE_DIFFERS_FROM_ROW\.$/);
    expect(calls).not.toContain('handshake');
    expect(recorded.lines.at(-1)).toEqual({ level: 'error', fields: { code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', operation: 'REAL_PRODUCTION', reason: 'INTERFACE_FILE_DIFFERS_FROM_ROW' }, message: 'the capture boot checks refuse this start: the server does not start' });
    expect(recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH' }]);
    expect(JSON.stringify([failure.message, recorded.lines])).not.toMatch(/enp[0-9]s0/);
  });

  it('each of the four, failing one at a time, is the one the boot names; nothing of an output reaches the message, the log or the error log', async () => {
    const codes: Readonly<Record<string, string>> = { RELAY: 'CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', INTERFACE: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH' };
    for (const [key, answers] of Object.entries(PROGRAM_ANSWERS)) {
      for (const answer of [...answers.absent.map((entry) => entry.answer), ...answers.malformed, { outcome: 'NOT_STARTED' } as const, { outcome: 'TIMED_OUT' } as const]) {
        const unprepared = production({ programAnswers: { [key]: answer } });
        const { deps, calls, recorded } = scene({ host: unprepared.host.deps, programs: unprepared.programs });
        const failure = await refusalOf(deps);
        expect(failure.code, JSON.stringify(answer)).toBe(codes[key] ?? key);
        expect(failure.reason, JSON.stringify(answer)).toMatch(/^[A-Z][A-Z_]+$/);
        expect(calls).not.toContain('handshake');
        expect(JSON.stringify([failure.message, failure.reason, recorded.lines, recorded.persisted])).not.toMatch(/CANARY|hunter2|\/home\/|\/usr\/|\/run\/|\/etc\/|enp[0-9]s0/);
        expect(recorded.lines.at(-1)?.fields).toEqual({ code: failure.code, operation: 'REAL_PRODUCTION', reason: failure.reason });
      }
    }
  });

  it('REAL_DEVELOPMENT and SIMULATED never ask, however wrong the programs are; and without `programs` step 4d is exactly what it was', async () => {
    const wrong = () => production({ programAnswers: Object.fromEntries(Object.keys(PROGRAM_ANSWERS).map((key) => [key, { outcome: 'NOT_STARTED' } as const])), stored: async () => Promise.reject(new Error('unreadable')) });
    for (const config of [{ captureDevSources: true }, { captureMode: 'simulated' as const, demoControls: true }, { captureMode: 'simulated' as const }]) {
      const unprepared = wrong();
      const { deps, recorded } = scene({ config, host: unprepared.host.deps, programs: unprepared.programs });
      const outcome = await runCaptureBootChecks(deps);
      expect(outcome.operation).not.toBe(CaptureOperation.REAL_PRODUCTION);
      expect(unprepared.host.asked).toEqual([]);
      expect(recorded.lines.filter((line) => /HOST|PROGRAM/.test(String(line.fields.code)))).toEqual([]);
    }
    // The host facts alone (a composition of before this row): the questions of row 80 and nothing more.
    const hostOnly = production();
    const only = scene({ host: hostOnly.host.deps });
    await expect(runCaptureBootChecks(only.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(hostOnly.host.asked).toHaveLength(HOST_COMMAND_CHECKS.length);
    expect(only.recorded.lines.map((line) => line.fields.code)).toEqual(['CAPTURE_HOST_CHECKS_PASSED', 'CAPTURE_BOOT_CHECKS_PASSED']);
  });

  it('a host check that is missing is said first: the programs are not asked after it; off Linux the relay alone is asked and the count says what was not', async () => {
    const answer = HOST_ANSWERS[CaptureHostRefusal.HOST_ALIAS_SOCKET]?.absent[0]?.answer;
    if (answer === undefined) throw new Error('no answer');
    const host = fakeProductionHost({ codeOf: hostCodeOf, programKeyOf, answers: { [CaptureHostRefusal.HOST_ALIAS_SOCKET]: answer } });
    const first = scene({ host: host.deps, programs: { platform: 'linux', relayProgram: RELAY, run: host.deps.run, storedInterface: async () => PREPARED_INTERFACE } });
    expect(await refusalOf(first.deps)).toMatchObject({ code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_ABSENT' });
    expect(host.asked.some((question) => question === RELAY)).toBe(false);

    const mac = production({ platform: 'darwin' });
    const { deps, recorded } = scene({ host: mac.host.deps, programs: mac.programs });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(mac.host.asked).toEqual([RELAY]);
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['warn', 'CAPTURE_HOST_PROFILE_NOT_ASKED'], ['info', 'CAPTURE_PROGRAM_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.lines[1]?.fields).toEqual({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation: 'REAL_PRODUCTION', programChecks: 1, notAsked: 3 });
  });
});
