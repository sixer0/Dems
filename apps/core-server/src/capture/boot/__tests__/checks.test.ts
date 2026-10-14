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
// Row NB (design 06 row N13): the two system programs of the macOS microphone listing, by row N4's own constants.
import { MACOS_SYSTEM_AUDIO_PROGRAM, MACOS_USB_TREE_PROGRAM } from '../../adapters/local/mic-helper-args';

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
      // Row HC (C94 (j)): the socket node that is NOT THERE is no refusal of step 4d any more - the block of row HC below holds what it is.
      const refused = answers?.absent.filter((entry) => entry.reason !== 'SOCKET_ABSENT').map((entry) => entry.answer) ?? [];
      for (const answer of [...refused, ...(answers?.malformed ?? []), { outcome: 'NOT_STARTED' } as const, { outcome: 'TIMED_OUT' } as const]) {
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

  // ── Task 4 row P1 (decisions U21 (2), C66 (1), C71 C-7): check 4d-2, the platforms of a production Core ──
  it('row P1, check 4d-2: REAL_PRODUCTION passes on `linux` (the whole profile asked) and on `darwin` (none asked, the warning said), and the outcome STATES which; every other platform is refused by its own code with a fixed word, after 4d and before 4e and the worker', async () => {
    const linux = host();
    const onLinux = scene({ host: linux.deps });
    const asked = await runCaptureBootChecks(onLinux.deps);
    expect(asked.hostProfile).toEqual({ platform: 'linux', asked: true });
    expect(linux.asked).toHaveLength(HOST_COMMAND_CHECKS.length);
    expect(onLinux.recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['info', 'CAPTURE_HOST_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);

    const mac = host({ platform: 'darwin' });
    const onMac = scene({ host: mac.deps });
    const notAsked = await runCaptureBootChecks(onMac.deps);
    expect(notAsked.hostProfile).toEqual({ platform: 'darwin', asked: false });
    expect(mac.asked).toEqual([]);
    expect(onMac.recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['warn', 'CAPTURE_HOST_PROFILE_NOT_ASKED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(Object.isFrozen(notAsked.hostProfile)).toBe(true);

    for (const platform of ['win32', 'freebsd', 'openbsd', 'sunos', 'aix', 'android', 'test-host', 'not-stated', 'Linux', 'DARWIN', 'linux ', '__proto__', 'constructor', '']) {
      const other = host({ platform });
      const { deps, recorded, calls } = scene({ host: other.deps });
      const failure = await refusalOf(deps);
      expect(failure, platform).toMatchObject({ code: 'CAPTURE_HOST_PLATFORM_NOT_SUPPORTED', reason: 'PLATFORM_NOT_LINUX_OR_DARWIN' });
      // No question of the profile was asked there, the worker was never started, and the refusal is in the log AND the error log.
      expect(other.asked, platform).toEqual([]);
      expect(calls, platform).not.toContain('handshake');
      expect(recorded.lines.at(-1)?.fields, platform).toEqual({ code: 'CAPTURE_HOST_PLATFORM_NOT_SUPPORTED', operation: 'REAL_PRODUCTION', reason: 'PLATFORM_NOT_LINUX_OR_DARWIN' });
      expect(recorded.persisted.at(-1), platform).toEqual({ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_PLATFORM_NOT_SUPPORTED' });
      // The platform's own word is in no text of the refusal (a fixed word and the fixed message).
      if (platform.trim().length > 4 && !['linux ', 'Linux', 'DARWIN'].includes(platform)) expect(failure?.message ?? '', platform).not.toContain(platform);
      expect(failure?.message ?? '').toMatch(/Linux.*macOS.*NOT checked/);
    }
    // The order of before is kept: on a platform that is refused, the Core's own-process checks of 4d still refuse FIRST, by their own code
    // (so a host that cannot be seen - no limit, platform `not-stated` - is still `CAPTURE_HOST_CORE_FILE_LIMIT`, decision C46).
    expect(await refusalOf(scene({ host: host({ platform: 'not-stated', coreFileLimit: () => null }).deps }).deps)).toMatchObject({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_UNREADABLE' });
    expect(await refusalOf(scene({ host: host({ platform: 'win32', startArguments: ['--inspect'] }).deps }).deps)).toMatchObject({ code: 'CAPTURE_HOST_DIAGNOSTIC_SWITCH' });
    // ... and an earlier check (4c) refuses before the platform is judged at all.
    expect(await refusalOf(scene({ host: host({ platform: 'win32' }).deps, demoPasswordOperators: async () => 1 }).deps)).toMatchObject({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION' });
  });

  it('row P1: REAL_DEVELOPMENT and SIMULATED are unchanged - no platform is judged or refused and the outcome states no host profile; neither does a production decision built without host facts', async () => {
    for (const config of [{ captureDevSources: true }, { captureMode: 'simulated' as const, demoControls: true }, { captureMode: 'simulated' as const }]) {
      for (const platform of ['win32', 'darwin', 'linux', 'not-stated']) {
        const there = host({ platform });
        const { deps, recorded } = scene({ config, host: there.deps });
        const outcome = await runCaptureBootChecks(deps);
        expect(outcome.operation, platform).not.toBe(CaptureOperation.REAL_PRODUCTION);
        expect('hostProfile' in outcome, platform).toBe(false);
        expect(there.asked, platform).toEqual([]);
        expect(recorded.lines.filter((line) => /HOST|PLATFORM/.test(String(line.fields.code))), platform).toEqual([]);
      }
    }
    const without = await runCaptureBootChecks(scene().deps);
    expect(without.operation).toBe(CaptureOperation.REAL_PRODUCTION);
    expect('hostProfile' in without).toBe(false);
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
    // Re-stated by row HC: the missing host check of this case was the absent socket, which is no refusal of step 4d any more
    // (C94 (j)). A socket node that is THERE and wrong is one, and so is every other host check: the programs are not asked after it.
    const answer = HOST_ANSWERS[CaptureHostRefusal.HOST_ALIAS_SOCKET]?.absent[1]?.answer;
    if (answer === undefined) throw new Error('no answer');
    const host = fakeProductionHost({ codeOf: hostCodeOf, programKeyOf, answers: { [CaptureHostRefusal.HOST_ALIAS_SOCKET]: answer } });
    const first = scene({ host: host.deps, programs: { platform: 'linux', relayProgram: RELAY, run: host.deps.run, storedInterface: async () => PREPARED_INTERFACE } });
    expect(await refusalOf(first.deps)).toMatchObject({ code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_OWNER_GROUP_OR_MODE' });
    expect(host.asked.some((question) => question === RELAY)).toBe(false);

    const mac = production({ platform: 'darwin' });
    const { deps, recorded } = scene({ host: mac.host.deps, programs: mac.programs });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(mac.host.asked).toEqual([RELAY]);
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['warn', 'CAPTURE_HOST_PROFILE_NOT_ASKED'], ['info', 'CAPTURE_PROGRAM_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.lines[1]?.fields).toEqual({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation: 'REAL_PRODUCTION', programChecks: 1, notAsked: 3 });
  });
});

// ── Task 4 row 228 (X1-5; SX-10; UD-4): check 4b-2, the active certificate names THIS installation ──────────────
describe('row 228, check 4b-2: a production Core starts only with a signing key that names its installation', () => {
  /** A scene whose questions of the key and of the operators are recorded in the order they are asked. */
  const ordered = (answer: string | null, extra: Parameters<typeof scene>[0] = {}): Scene => {
    const made = scene({
      signingKeyIsDevelopment: () => (made.calls.push('development?'), false),
      signingKeyInstallationProblem: () => (made.calls.push('installation?'), answer),
      demoPasswordOperators: async () => (made.calls.push('operators'), 0),
      ...extra,
    });
    return made;
  };

  it('REAL_PRODUCTION and a word from the reader: refused by CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH with that word - after 4b, before the operators are read, and no worker is started', async () => {
    const { deps, calls, recorded } = ordered('OTHER_INSTALLATION');
    expect(deps.decision.operation).toBe('REAL_PRODUCTION');
    const failure = await refusalOf(deps);
    expect(CaptureBootRefusal.SIGNING_KEY_INSTALLATION_MISMATCH).toBe('CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH');
    expect([failure.code, failure.reason]).toEqual(['CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH', 'OTHER_INSTALLATION']);
    expect(calls).toEqual(['inspect', 'volume', 'key', 'development?', 'installation?']);
    expect(recorded.lines.map((line) => [line.level, line.fields])).toEqual([['error', { code: 'CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH', operation: 'REAL_PRODUCTION', reason: 'OTHER_INSTALLATION' }]]);
    expect(recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH' }]);
    // The sentence names the remedy (rotation) and the form; it names no key of the environment and no value.
    expect(failure.message).toContain('Evidence signing <installation device id>');
    expect(failure.message).toContain('evidence:rotate-key');
    expect(failure.message).toContain('Reason: OTHER_INSTALLATION.');
  });

  it('CONTROL: REAL_PRODUCTION and no word (the certificate names this installation) - every check runs, in order, and the start passes', async () => {
    const { deps, calls } = ordered(null);
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(calls).toEqual(['inspect', 'volume', 'key', 'development?', 'installation?', 'operators', 'handshake']);
  });

  it('the earlier checks refuse first, by their own codes: a key that does not load (4) and a development key (4b) never reach the question', async () => {
    const unloadable = ordered('OTHER_INSTALLATION', { signingKeyProblem: () => 'KEY_ABSENT' });
    expect((await refusalOf(unloadable.deps)).code).toBe(CaptureBootRefusal.SIGNING_KEY_UNUSABLE);
    expect(unloadable.calls).not.toContain('installation?');
    const development = ordered('OTHER_INSTALLATION', { signingKeyIsDevelopment: () => true });
    expect((await refusalOf(development.deps)).code).toBe(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY);
    expect(development.calls).not.toContain('installation?');
  });

  it('REAL_DEVELOPMENT and SIMULATED never ask: a reader that would refuse - or throw - is not called', async () => {
    const never = (): string | null => {
      throw new Error('check 4b-2 was asked outside REAL_PRODUCTION');
    };
    const development = scene({ config: { captureDevSources: true }, signingKeyInstallationProblem: never });
    await expect(runCaptureBootChecks(development.deps)).resolves.toMatchObject({ operation: 'REAL_DEVELOPMENT' });
    const simulated = scene({ config: { captureMode: 'simulated', demoControls: true }, signingKeyInstallationProblem: never });
    await expect(runCaptureBootChecks(simulated.deps)).resolves.toMatchObject({ operation: 'SIMULATED' });
    expect(simulated.calls).toEqual([]);
  });

  it('every word of the reader is a refusal by the ONE code; a decision built without the reader is not asked (the mount always hands one in: boot.test.ts)', async () => {
    for (const word of ['INSTALLATION_ID_NOT_KNOWN', 'INSTALLATION_ID_FORM', 'SUBJECT_UNREADABLE', 'NO_ORGANISATIONAL_UNIT', 'SEVERAL_ORGANISATIONAL_UNITS', 'OTHER_INSTALLATION']) {
      const failure = await refusalOf(ordered(word).deps);
      expect([failure.code, failure.reason], word).toEqual(['CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH', word]);
    }
    const without = scene();
    expect(without.deps.signingKeyInstallationProblem).toBeUndefined();
    await expect(runCaptureBootChecks(without.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
  });
});

// ── Task 4 row HC (decisions C94 (j), C53 (4c), C49 (2), C55 DD-2): the host-checks follow-up, at the boot ──────
// The command runner is the double of `host-support.ts` in every case: no command of a host is started.
describe('row HC: the helper absent is a stated fact, the helper wrong a refusal; a configured socket path is the installed one; no host facts has a code of its own', () => {
  const hostCodeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => check.command.program === command.program && check.command.args.join(' ') === command.args.join(' '))?.code;
  const same = (a: HostCommand, b: HostCommand): boolean => a.program === b.program && a.args.join(' ') === b.args.join(' ');
  const RELAY = '/srv/dems/relay';
  const programKeyOf = (command: HostCommand): string | undefined => (command.program === RELAY && command.args.length === 0 ? 'RELAY' : same(command, INTERFACE_FILE_COMMAND) ? 'INTERFACE' : PROGRAM_OWNERSHIP_CHECKS.find((check) => same(check.command, command))?.code);
  const ran = (output: string, exitCode = 0) => ({ outcome: 'RAN', exitCode, output }) as const;
  const SOCKET = CaptureHostRefusal.HOST_ALIAS_SOCKET;
  const NO_SOCKET = ran('', 1);
  /** What `stat` answers on a host without the helper: the system's own directory alone; nothing of the grant. */
  const NO_HELPER = { CAPTURE_HOST_ALIAS_HELPER_UNSAFE: ran('directory root root 755\n', 1), CAPTURE_HOST_ALIAS_GRANT_UNSAFE: ran('', 1) };
  const production = (options: { readonly platform?: string; readonly answers?: FakeHostOptions['answers']; readonly programAnswers?: Parameters<typeof fakeProductionHost>[0]['programAnswers']; readonly stored?: () => Promise<string | null> } = {}) => {
    const host = fakeProductionHost({ codeOf: hostCodeOf, programKeyOf, ...(options.platform === undefined ? {} : { platform: options.platform }), ...(options.answers === undefined ? {} : { answers: options.answers }), ...(options.programAnswers === undefined ? {} : { programAnswers: options.programAnswers }) });
    let reads = 0;
    const programs: DeliveredProgramDeps = { platform: host.deps.platform, relayProgram: host.deps.relayProgram, run: host.deps.run, storedInterface: options.stored ?? (async () => ((reads += 1), PREPARED_INTERFACE)) };
    return { host, programs, reads: () => reads };
  };

  // ── item 1: C94 (j) ──
  it('C94 (j): on Linux a host with NOTHING of the address helper starts - one warning line and one error-log row say so, the interface file is not asked, the worker is started', async () => {
    const without = production({ answers: { [SOCKET]: NO_SOCKET }, programAnswers: NO_HELPER });
    const { deps, calls, recorded } = scene({ host: without.host.deps, programs: without.programs });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION', workerVersion: CAPTURE_WORKER_VERSION, hostProfile: { platform: 'linux', asked: true } });
    expect(calls.at(-1)).toBe('handshake');
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([
      ['info', 'CAPTURE_HOST_CHECKS_PASSED'],
      ['info', 'CAPTURE_PROGRAM_CHECKS_PASSED'],
      ['warn', 'CAPTURE_HOST_ALIAS_HELPER_ABSENT'],
      ['info', 'CAPTURE_BOOT_CHECKS_PASSED'],
    ]);
    // The socket is not counted "in place": 4 own-process checks and every question but the socket's.
    expect(recorded.lines[0]?.fields).toEqual({ code: 'CAPTURE_HOST_CHECKS_PASSED', operation: 'REAL_PRODUCTION', hostChecks: 4 + HOST_COMMAND_CHECKS.length - 1 });
    expect(recorded.lines[1]?.fields).toEqual({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation: 'REAL_PRODUCTION', programChecks: 1, notAsked: 1 });
    expect(recorded.lines[2]).toEqual({ level: 'warn', fields: { code: 'CAPTURE_HOST_ALIAS_HELPER_ABSENT', operation: 'REAL_PRODUCTION' }, message: expect.stringMatching(/^the address helper is not installed on this host/) });
    expect(recorded.persisted).toEqual([{ level: 'warn', source: 'capture.boot', code: 'CAPTURE_HOST_ALIAS_HELPER_ABSENT' }]);
    expect(JSON.stringify(recorded.lines)).not.toMatch(/\/usr\/|\/run\/|\/etc\//);
    expect(without.host.asked.some((question) => question.startsWith('/usr/bin/cat'))).toBe(false);
    expect(without.reads()).toBe(0);
  });

  it('C94 (j): a helper that is PRESENT says nothing new - the lines of before the row, no warning, no error-log row', async () => {
    const prepared = production();
    const { deps, recorded } = scene({ host: prepared.host.deps, programs: prepared.programs });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['info', 'CAPTURE_HOST_CHECKS_PASSED'], ['info', 'CAPTURE_PROGRAM_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
    expect(recorded.persisted).toEqual([]);
  });

  it('C94 (j): a helper that is PRESENT BUT WRONG is refused by the codes of before - a socket of another owner, group or mode; a path that is no socket; a partial installation', async () => {
    const wrong: ReadonlyArray<readonly [string, Parameters<typeof production>[0], { readonly code: string; readonly reason: string }]> = [
      ['a socket every account may write', { answers: { [SOCKET]: ran('socket root dems-netalias 666\n') } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_OWNER_GROUP_OR_MODE' }],
      ['a socket of the service user', { answers: { [SOCKET]: ran('socket dems-core dems-netalias 660\n') } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_OWNER_GROUP_OR_MODE' }],
      ['a socket of another group', { answers: { [SOCKET]: ran('socket root root 660\n') } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_OWNER_GROUP_OR_MODE' }],
      ['a path that is not a socket', { answers: { [SOCKET]: ran('regular file root dems-netalias 660\n') } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_OWNER_GROUP_OR_MODE' }],
      ['partial: no socket, the helper file and the units installed', { answers: { [SOCKET]: NO_SOCKET } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_ABSENT' }],
      ['partial: no socket, no helper file, the units installed', { answers: { [SOCKET]: NO_SOCKET }, programAnswers: { CAPTURE_HOST_ALIAS_HELPER_UNSAFE: NO_HELPER.CAPTURE_HOST_ALIAS_HELPER_UNSAFE } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_ABSENT' }],
      ['partial: no socket, no units, the helper file installed', { answers: { [SOCKET]: NO_SOCKET }, programAnswers: { CAPTURE_HOST_ALIAS_GRANT_UNSAFE: NO_HELPER.CAPTURE_HOST_ALIAS_GRANT_UNSAFE } }, { code: 'CAPTURE_HOST_ALIAS_SOCKET', reason: 'SOCKET_ABSENT' }],
      ['partial: the socket, no helper file', { programAnswers: NO_HELPER }, { code: 'CAPTURE_HOST_ALIAS_HELPER_UNSAFE', reason: 'FILE_ABSENT' }],
      ['partial: the socket and the helper file, no units', { programAnswers: { CAPTURE_HOST_ALIAS_GRANT_UNSAFE: NO_HELPER.CAPTURE_HOST_ALIAS_GRANT_UNSAFE } }, { code: 'CAPTURE_HOST_ALIAS_GRANT_UNSAFE', reason: 'FILE_ABSENT' }],
      ['no socket, and a helper file the service user owns', { answers: { [SOCKET]: NO_SOCKET }, programAnswers: { CAPTURE_HOST_ALIAS_HELPER_UNSAFE: ran('regular file dems-core root 755\ndirectory root root 755\n') } }, { code: 'CAPTURE_HOST_ALIAS_HELPER_UNSAFE', reason: 'NOT_OWNED_BY_ROOT' }],
      ['no socket, no helper file, and the question of the units cannot be asked', { answers: { [SOCKET]: NO_SOCKET }, programAnswers: { ...NO_HELPER, CAPTURE_HOST_ALIAS_GRANT_UNSAFE: { outcome: 'TIMED_OUT' } } }, { code: 'CAPTURE_HOST_ALIAS_GRANT_UNSAFE', reason: 'HOST_COMMAND_TIMED_OUT' }],
    ];
    for (const [name, options, expected] of wrong) {
      const unprepared = production(options);
      const { deps, calls, recorded } = scene({ host: unprepared.host.deps, programs: unprepared.programs });
      const failure = await refusalOf(deps);
      expect({ code: failure.code, reason: failure.reason }, name).toEqual(expected);
      expect(calls, name).not.toContain('handshake');
      expect(recorded.lines.at(-1), name).toEqual({ level: 'error', fields: { ...expected, operation: 'REAL_PRODUCTION' }, message: 'the capture boot checks refuse this start: the server does not start' });
      expect(recorded.lines.some((line) => line.fields.code === 'CAPTURE_HOST_ALIAS_HELPER_ABSENT'), name).toBe(false);
      expect(recorded.persisted, name).toEqual([{ level: 'error', source: 'capture.boot', code: expected.code }]);
    }
  });

  it('row P1 kept: on darwin NOTHING of the helper is asked and nothing of it is said - no question of the Linux profile, no line "absent"', async () => {
    const mac = production({ platform: 'darwin', answers: { [SOCKET]: NO_SOCKET }, programAnswers: NO_HELPER });
    const { deps, recorded } = scene({ host: mac.host.deps, programs: mac.programs });
    await expect(runCaptureBootChecks(deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION', hostProfile: { platform: 'darwin', asked: false } });
    expect(mac.host.asked).toEqual([RELAY]);
    expect(recorded.lines.map((line) => [line.level, line.fields.code])).toEqual([['warn', 'CAPTURE_HOST_PROFILE_NOT_ASKED'], ['info', 'CAPTURE_PROGRAM_CHECKS_PASSED'], ['info', 'CAPTURE_BOOT_CHECKS_PASSED']]);
  });

  // ── item 2: C53 (4c), R119-10 ──
  it('C53 (4c): a configured socket path that is not the installed one is refused by its own code, on every platform, after the host checks and before the programs; unset and the installed path pass; the path is never repeated', async () => {
    const INSTALLED = '/run/dems-core-netalias/socket';
    for (const platform of ['linux', 'darwin']) {
      for (const configuredAliasSocket of ['/run/dems-core-netalias/other', '/tmp/socket', `${INSTALLED}/`, '/run/dems-core-netalias/../dems-core-netalias/socket', '/RUN/dems-core-netalias/socket', '']) {
        const other = production({ platform });
        const { deps, calls, recorded } = scene({ host: other.host.deps, programs: other.programs, configuredAliasSocket });
        const failure = await refusalOf(deps);
        expect({ code: failure.code, reason: failure.reason }, configuredAliasSocket).toEqual({ code: 'CAPTURE_HOST_ALIAS_SOCKET_PATH', reason: 'CONFIGURED_PATH_NOT_THE_INSTALLED_ONE' });
        expect(failure.code).toBe(CaptureBootRefusal.HOST_ALIAS_SOCKET_PATH);
        expect(failure.message).toMatch(/DEMS_CAPTURE_ALIAS_SOCKET/);
        expect(failure.message).toMatch(/HOST-44/);
        expect(JSON.stringify([failure.message, recorded.lines, recorded.persisted])).not.toMatch(/\/run\/|\/tmp\/|\/RUN\//);
        expect(calls).not.toContain('handshake');
        // After 4d (the host was asked), before 4e (the relay was not).
        expect(other.host.asked.includes(RELAY)).toBe(false);
        // Off Linux the warning "the host profile was not asked" has its row first (step 4d said it before this check refused).
        expect(recorded.persisted.filter((entry) => entry.level === 'error')).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_ALIAS_SOCKET_PATH' }]);
        expect(recorded.persisted.at(-1)?.code).toBe('CAPTURE_HOST_ALIAS_SOCKET_PATH');
      }
      for (const configuredAliasSocket of [null, INSTALLED]) {
        const same = production({ platform });
        await expect(runCaptureBootChecks(scene({ host: same.host.deps, programs: same.programs, configuredAliasSocket }).deps), String(configuredAliasSocket)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
      }
    }
    // An earlier refusal is still the one said: a host check that is missing comes first.
    const limited = scene({ host: fakeHost({ codeOf: hostCodeOf, coreFileLimit: () => 4096 }).deps, configuredAliasSocket: '/tmp/socket' });
    expect(await refusalOf(limited.deps)).toMatchObject({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT' });
    // REAL_DEVELOPMENT and SIMULATED never ask.
    for (const config of [{ captureDevSources: true }, { captureMode: 'simulated' as const, demoControls: true }]) {
      await expect(runCaptureBootChecks(scene({ config, configuredAliasSocket: '/tmp/socket' }).deps)).resolves.not.toMatchObject({ operation: 'REAL_PRODUCTION' });
    }
  });

  // ── item 3 (C49 (2), the listing of the rule table) was TAKEN OUT by row HC3 (decision C103): the Core's unit has no
  //    capability and the kernel refuses the listing. The loopback rule is asked by the state of its unit (the block of row 80 above). ──

  // ── item 4: C55 DD-2 ──
  it('C55 DD-2: a Core that was handed NO host facts is refused by a code of its own, before any question; facts that were handed in keep the code of what could not be read (C46)', async () => {
    // What the mount builds with nothing handed in: the host that cannot be seen, and the statement that none was handed in.
    const asked: string[] = [];
    const unseen = { platform: 'not-stated', coreFileLimit: () => null, startArguments: [], nodeOptionsSet: true, relayProgram: RELAY, guardProgram: '/srv/dems/guard', run: async (command: HostCommand) => (asked.push(command.program), { outcome: 'NOT_STARTED' } as const) };
    const none = scene({ host: unseen, programs: { platform: 'not-stated', relayProgram: RELAY, run: unseen.run, storedInterface: async () => null }, hostFactsHandedIn: false });
    const failure = await refusalOf(none.deps);
    expect({ code: failure.code, reason: failure.reason }).toEqual({ code: 'CAPTURE_HOST_FACTS_NOT_HANDED_IN', reason: 'NO_HOST_FACTS' });
    expect(failure.code).toBe(CaptureBootRefusal.HOST_FACTS_NOT_HANDED_IN);
    expect(failure.message).toMatch(/without the facts of its host/);
    expect(failure.message).toMatch(/ Reason: NO_HOST_FACTS\.$/);
    expect(asked).toEqual([]);
    // After checks 1 to 4c (the worker's path rule, the store, the key), before the relay and the guard are inspected, and the worker is not started.
    expect(none.calls).toEqual(['inspect', 'volume', 'key']);
    expect(none.recorded.lines).toEqual([{ level: 'error', fields: { code: 'CAPTURE_HOST_FACTS_NOT_HANDED_IN', operation: 'REAL_PRODUCTION', reason: 'NO_HOST_FACTS' }, message: 'the capture boot checks refuse this start: the server does not start' }]);
    expect(none.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_FACTS_NOT_HANDED_IN' }]);
    // An earlier refusal is still the one said (here: the operators), and the two other operations never ask.
    expect(await refusalOf(scene({ hostFactsHandedIn: false, demoPasswordOperators: async () => 2 }).deps)).toMatchObject({ code: 'CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION' });
    for (const config of [{ captureDevSources: true }, { captureMode: 'simulated' as const, demoControls: true }]) {
      await expect(runCaptureBootChecks(scene({ config, host: unseen, hostFactsHandedIn: false }).deps)).resolves.not.toMatchObject({ operation: 'REAL_PRODUCTION' });
    }
    // Facts handed in whose limit cannot be read: the code of the limit, as before (C46) - with the member true and with it left out.
    for (const handedIn of [{ hostFactsHandedIn: true }, {}]) {
      expect(await refusalOf(scene({ host: unseen, ...handedIn }).deps)).toMatchObject({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_UNREADABLE' });
    }
  });
});

// ── Task 4 row NB (design 06 revision 3 row N13; decision C135 (1)): the two system programs of the macOS microphone listing ──
// Stand-in path facts only: the inspector of the scene answers per path; the runner is the double of `host-support.ts` and
// starts nothing. What is proven: the step's judgement of the facts; NOT the facts of a real Mac (the db cases use the real inspector).
describe('row NB: a production boot on darwin holds the two system programs of the microphone listing to the worker\'s path rule, starts neither and waits for no listing; Linux and REAL_DEVELOPMENT unchanged', () => {
  const RELAY = '/srv/dems/relay';
  const same = (a: HostCommand, b: HostCommand): boolean => a.program === b.program && a.args.join(' ') === b.args.join(' ');
  const hostCodeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => same(check.command, command))?.code;
  const programKeyOf = (command: HostCommand): string | undefined => (command.program === RELAY && command.args.length === 0 ? 'RELAY' : same(command, INTERFACE_FILE_COMMAND) ? 'INTERFACE' : PROGRAM_OWNERSHIP_CHECKS.find((check) => same(check.command, command))?.code);
  const LISTING = [MACOS_USB_TREE_PROGRAM, MACOS_SYSTEM_AUDIO_PROGRAM] as const;
  /** A scene on `platform` whose inspector answers `facts(path)` for the listing programs and a good program for every other path. */
  const on = (platform: string, facts: (path: string) => ProgramFacts = () => goodProgram(), config: Partial<CaptureOperationInput> = {}) => {
    const host = fakeProductionHost({ codeOf: hostCodeOf, programKeyOf, platform });
    const programs: DeliveredProgramDeps = { platform, relayProgram: RELAY, run: host.deps.run, storedInterface: async () => PREPARED_INTERFACE, systemListingPrograms: LISTING };
    const inspected: string[] = [];
    const inspect = (path: string): ProgramFacts => (inspected.push(path), (LISTING as readonly string[]).includes(path) ? facts(path) : goodProgram());
    return { ...scene({ config, host: host.deps, programs, inspect }), host, inspected };
  };
  /** Each word of the worker's path rule, from facts of the form the real inspector gives. */
  const FAILING: ReadonlyArray<readonly [string, ProgramFacts]> = [
    ['NOT_FOUND', goodProgram({ exists: false, regularFile: false, file: null })],
    ['NOT_A_FILE', goodProgram({ regularFile: false })],
    ['FILE_OWNER', goodProgram({ file: { ownerUid: 777, mode: 0o755 } })],
    ['FILE_WRITABLE', goodProgram({ file: { ownerUid: 0, mode: 0o775 } })],
    ['DIRECTORY_WRITABLE', goodProgram({ directoriesResolved: [{ ownerUid: 0, mode: 0o777 }], directoriesAsWritten: [{ ownerUid: 0, mode: 0o777 }] })],
    ['NOT_EXECUTABLE', goodProgram({ file: { ownerUid: 0, mode: 0o644 } })],
  ];

  it('darwin, both programs as the system delivers them: the start goes on; both are inspected in table order AFTER the delivered programs; NOTHING is started for them; the passed line counts them', async () => {
    const mac = on('darwin', () => goodProgram({ file: { ownerUid: 0, mode: 0o755 } }));
    await expect(runCaptureBootChecks(mac.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION', hostProfile: { platform: 'darwin', asked: false } });
    expect(mac.inspected.filter((path) => (LISTING as readonly string[]).includes(path))).toEqual([...LISTING]);
    expect(mac.inspected.indexOf(MACOS_USB_TREE_PROGRAM)).toBeGreaterThan(mac.inspected.lastIndexOf(RELAY));
    // The runner was asked the relay alone: no listing program is run by the boot (design 06 10.1: the boot never waits for a listing).
    expect(mac.host.asked).toEqual([RELAY]);
    expect(mac.recorded.lines.find((line) => line.fields.code === 'CAPTURE_PROGRAM_CHECKS_PASSED')?.fields).toEqual({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation: 'REAL_PRODUCTION', programChecks: 3, notAsked: 3 });
    expect(mac.calls.at(-1)).toBe('handshake');
  });

  it('darwin, a program that fails the rule refuses the start by CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE with the rule\'s own word - for each word, for either program; the worker is not started; no path in the line or the message', async () => {
    for (const failing of LISTING) {
      for (const [word, facts] of FAILING) {
        const mac = on('darwin', (path) => (path === failing ? facts : goodProgram()));
        const failure = await refusalOf(mac.deps);
        expect([failure.code, failure.reason], `${failing} ${word}`).toEqual(['CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE', word]);
        expect(failure.code).toBe(CaptureBootRefusal.PROGRAM_SYSTEM_LISTING);
        expect(mac.calls, word).not.toContain('handshake');
        // The warning of 4d (the host profile is not asked on darwin), then the refusal: nothing else.
        expect(mac.recorded.persisted, word).toEqual([{ level: 'warn', source: 'capture.boot', code: 'CAPTURE_HOST_PROFILE_NOT_ASKED' }, { level: 'error', source: 'capture.boot', code: 'CAPTURE_HOST_LISTING_PROGRAM_UNUSABLE' }]);
        expect(JSON.stringify([mac.recorded.lines, failure.message]), word).not.toMatch(/\/usr\/|sbin|ioreg|system_profiler/);
        // The boot stops at the first: a failing first program leaves the second uninspected.
        if (failing === MACOS_USB_TREE_PROGRAM) expect(mac.inspected, word).not.toContain(MACOS_SYSTEM_AUDIO_PROGRAM);
      }
    }
  });

  it('linux, other platforms the boot refuses anyway, and REAL_DEVELOPMENT on darwin: the two programs are NEVER inspected, the lines are the ones of before this row', async () => {
    const refusing = (): ProgramFacts => goodProgram({ exists: false, regularFile: false, file: null });
    const linux = on('linux', refusing);
    await expect(runCaptureBootChecks(linux.deps)).resolves.toMatchObject({ operation: 'REAL_PRODUCTION', hostProfile: { platform: 'linux', asked: true } });
    expect(linux.recorded.lines.find((line) => line.fields.code === 'CAPTURE_PROGRAM_CHECKS_PASSED')?.fields).toEqual({ code: 'CAPTURE_PROGRAM_CHECKS_PASSED', operation: 'REAL_PRODUCTION', programChecks: 4, notAsked: 0 });
    const development = on('darwin', refusing, { captureDevSources: true });
    await expect(runCaptureBootChecks(development.deps)).resolves.toMatchObject({ operation: 'REAL_DEVELOPMENT' });
    // 4d-2 refuses another platform BEFORE 4e: the programs are not inspected there either.
    const other = on('freebsd', refusing);
    expect((await refusalOf(other.deps)).code).toBe('CAPTURE_HOST_PLATFORM_NOT_SUPPORTED');
    for (const seen of [linux, development, other]) expect(seen.inspected.filter((path) => (LISTING as readonly string[]).includes(path))).toEqual([]);
  });

  it('a decision built without the member (a caller from before this row) asks nothing more on darwin; the refusal has a text that names the key, not a path', async () => {
    const mac = on('darwin', () => goodProgram({ exists: false, regularFile: false, file: null }));
    const before: DeliveredProgramDeps = { platform: 'darwin', relayProgram: RELAY, run: mac.host.deps.run, storedInterface: async () => PREPARED_INTERFACE };
    await expect(runCaptureBootChecks({ ...mac.deps, programs: before })).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(mac.inspected.filter((path) => (LISTING as readonly string[]).includes(path))).toEqual([]);
    const text = new CaptureBootError(CaptureBootRefusal.PROGRAM_SYSTEM_LISTING, 'NOT_FOUND').message;
    expect(text).toMatch(/^This host is not prepared for a production Core \(DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES\) on macOS: /);
    expect(text).not.toMatch(/\/usr\/|ioreg|system_profiler/);
  });
});
