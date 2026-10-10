// The CS-22 boot checks of real capture, as a decision (blueprint row 61; check M3-BC-1; specs R-2
// AC-3; capture spec §A.1.2). No file is read and no process is started here: every fact is handed in.
// One refusal test per rule, each beside the configuration that passes (the control).
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
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
} from '../checks';
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
const HELLO: WorkerHandshake = { outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/0.3.0' };

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
    await expect(runCaptureBootChecks(deps)).resolves.toEqual({ operation, label: null, workerVersion: 'capture-worker/0.3.0', evidenceVolume: { totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 } });
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
    expect(workerVersionRefusalOf({ protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/12.0.1' })).toBeNull();
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
