// The table of the kill matrix and its pass rules (blueprint row 86). Unit: no process, no database.
// Every pass rule has a control that FAILS it, so a rule that always passes cannot hide here.
import { describe, expect, it } from 'vitest';
import { SEALING_STEP_ORDER } from '../../pipeline/contract';
import { KILL_MATRIX, PARKED_CELLS, UnknownCellError, selectCells } from './cells';
import { judgeFailedStart, judgeFrozenKept, judgeKillPoint, judgeMediaReference, judgeSealedFolder, judgeSealedJobs, judgeVerify, type JobRow, type ManifestView } from './judge';

const done = (upTo: number, attempt = 1): JobRow[] => SEALING_STEP_ORDER.slice(0, upTo).map((step) => ({ step, status: 'DONE', attempt, checkpoint: {} }));

describe('the table: 35 distinct named checks, 10 parked', () => {
  it('names M7-REF-1, four baselines, six clean step cells and the 24 phase x step cells, each once', () => {
    const ids = KILL_MATRIX.map((cell) => cell.id);
    expect(new Set(ids).size).toBe(35);
    expect(ids.filter((id) => /^M7-KM-P[1-4]-S[1-6]$/.test(id))).toHaveLength(24);
    expect(ids.filter((id) => /^M7-KM-P[1-4]-0$/.test(id))).toEqual(['M7-KM-P1-0', 'M7-KM-P2-0', 'M7-KM-P3-0', 'M7-KM-P4-0']);
    expect(ids.filter((id) => /^M7-KM-C-S[1-6]$/.test(id))).toHaveLength(6);
    expect(ids).toContain('M7-REF-1');
  });

  it('a step cell kills in its own step; the P1 row expects a failed start, P2 and P3 an interrupted seal, C and P4 a plain one', () => {
    for (const cell of KILL_MATRIX) {
      const step = /-S([1-6])$/.exec(cell.id);
      expect(cell.sealKill?.step ?? null, cell.id).toBe(step === null ? null : SEALING_STEP_ORDER[Number(step[1]) - 1]);
      expect(cell.expectation, cell.id).toBe({ C: 'SEALED', P1: 'FAILED_START', P2: 'SEALED_INTERRUPTED', P3: 'SEALED_INTERRUPTED', P4: 'SEALED' }[cell.recording]);
      // Every kill of every cell says its kind.
      expect(cell.kills.every((kill) => kill.includes('SIGKILL')), cell.id).toBe(true);
    }
    expect(KILL_MATRIX.find((cell) => cell.id === 'M7-REF-1')?.kills).toEqual([]);
    expect(KILL_MATRIX.find((cell) => cell.id === 'M7-KM-P2-S3')?.kills).toHaveLength(2);
  });

  it('the fallback cells are listed with their condition and cannot be run; a run names its cells', () => {
    expect(PARKED_CELLS.map((cell) => cell.id)).toEqual(['M7-KM-C-S7', 'M7-KM-C-S8', 'M7-KM-P1-S7', 'M7-KM-P1-S8', 'M7-KM-P2-S7', 'M7-KM-P2-S8', 'M7-KM-P3-S7', 'M7-KM-P3-S8', 'M7-KM-P4-S7', 'M7-KM-P4-S8']);
    expect(PARKED_CELLS.every((cell) => cell.condition.includes('OD-21'))).toBe(true);
    expect(selectCells(undefined)).toEqual([]);
    expect(selectCells(' M7-KM-P4-S6 , M7-REF-1 ').map((cell) => cell.id)).toEqual(['M7-KM-P4-S6', 'M7-REF-1']);
    expect(() => selectCells('M7-KM-P2-S7')).toThrow(/parked: OD-21/);
    expect(() => selectCells('ALL')).toThrow(UnknownCellError);
  });
});

describe('the pass rules, each with a control that fails it', () => {
  it('the kill point: the journal at the death is the one the cell names', () => {
    const running = [...done(3), { step: 'BUILD_MANIFEST', status: 'RUNNING', attempt: 1, checkpoint: {} }];
    expect(judgeKillPoint({ step: 'BUILD_MANIFEST', phase: 'AFTER_WORK' }, running)).toEqual([]);
    expect(judgeKillPoint({ step: 'CLOSE_TRACKS', phase: 'BEFORE' }, [])).toEqual([]);
    expect(judgeKillPoint({ step: 'SIGN_MANIFEST', phase: 'AFTER_CHECKPOINT' }, done(5))).toEqual([]);
    // Controls: the step was already DONE, a later step had started, an earlier one had not finished.
    expect(judgeKillPoint({ step: 'BUILD_MANIFEST', phase: 'AFTER_WORK' }, done(4))).toEqual(['BUILD_MANIFEST is DONE, not RUNNING, before its checkpoint']);
    expect(judgeKillPoint({ step: 'BUILD_MANIFEST', phase: 'AFTER_WORK' }, done(5))).toContain('SIGN_MANIFEST has a row at a kill in BUILD_MANIFEST');
    expect(judgeKillPoint({ step: 'BUILD_MANIFEST', phase: 'AFTER_WORK' }, done(2))).toContain('FINALIZE_TRANSCRIPT is not DONE at a kill in BUILD_MANIFEST');
  });

  it('the sealed journal: six DONE, finished by the expected attempt', () => {
    expect(judgeSealedJobs(done(6), 1)).toEqual([]);
    expect(judgeSealedJobs([...done(3), ...done(6, 2).slice(3)], 2)).toEqual([]);
    expect(judgeSealedJobs(done(5), 1)).not.toEqual([]);
    expect(judgeSealedJobs([...done(5), { step: 'STORE_SEALED_PACKAGE', status: 'RUNNING', attempt: 1, checkpoint: null }], 1)).toContain('STORE_SEALED_PACKAGE is RUNNING');
    // A resumed seal that still says attempt 1 at its last step did not count the killed run; a third attempt is one run too many.
    expect(judgeSealedJobs(done(6), 2)).not.toEqual([]);
    expect(judgeSealedJobs(done(6, 3), 2)).not.toEqual([]);
  });

  it('the frozen checkpoint of a killed BUILD_MANIFEST is the finished one', () => {
    expect(judgeFrozenKept('BUILD_MANIFEST', { sealedAt: 5, signedAt: 6 }, { sealedAt: 5, signedAt: 6, manifestSha256: 'x' })).toEqual([]);
    expect(judgeFrozenKept('BUILD_MANIFEST', { sealedAt: 5 }, { sealedAt: 9 })).toEqual(["BUILD_MANIFEST: the checkpoint member sealedAt of the killed run is not the finished run's"]);
  });

  const manifest = (interrupted: boolean): ManifestView => ({
    interrupted,
    tracks: ['VIDEO-01', 'VIDEO-02'].map((trackId) => ({ trackId, bytes: 10, sha256Plain: `p-${trackId}`, fragmentCount: 2 })),
    files: ['VIDEO-01', 'VIDEO-02'].map((trackId) => ({ trackId, fragments: [0, 1].map((seq) => ({ seq, sha256Plain: `${trackId}-${seq}`, interrupted })) })),
  });
  const rows = ['VIDEO-01', 'VIDEO-02'].flatMap((trackId) => [0, 1].map((seq) => ({ trackId, seq, sha256: `${trackId}-${seq}` })));

  it('the sealed plaintext is the recorded one: rows, the count at the kill, the copy of the recording', () => {
    expect(judgeMediaReference(manifest(true), rows, { 'VIDEO-01': 2, 'VIDEO-02': 1 }, { 'VIDEO-01': 'p-VIDEO-01', 'VIDEO-02': 'p-VIDEO-02' })).toEqual([]);
    expect(judgeMediaReference(manifest(false), rows, null, null)).toEqual([]);
    // Controls: another digest, a durable fragment lost, another recording, a fragment flag that contradicts the timeline.
    expect(judgeMediaReference(manifest(true), [...rows.slice(0, 3), { trackId: 'VIDEO-02', seq: 1, sha256: 'other' }], null, null)).toEqual(['VIDEO-02 fragment 1: the sealed plaintext digest is not the recorded one']);
    expect(judgeMediaReference(manifest(true), rows, { 'VIDEO-01': 3, 'VIDEO-02': 2 }, null)).toEqual(['VIDEO-01: 3 fragments were durable at the kill, 2 are sealed']);
    expect(judgeMediaReference(manifest(true), rows, null, { 'VIDEO-01': 'p-VIDEO-01', 'VIDEO-02': 'tampered' })).toEqual(['VIDEO-02: the sealed plaintext is not the first 10 bytes of the recording']);
    const mixed = manifest(true);
    expect(judgeMediaReference({ ...mixed, interrupted: false }, rows, null, null)).toHaveLength(4);
  });

  it('verify: PASS, 15 checks, the interrupted flag as the cell expects', () => {
    const checks = Array.from({ length: 15 }, (_, index) => ({ id: `V-${String(index + 1).padStart(2, '0')}`, status: 'PASS' }));
    expect(judgeVerify('SEALED_INTERRUPTED', { statusCode: 200, ok: true, overall: 'PASS', interrupted: true, checks })).toEqual([]);
    expect(judgeVerify('SEALED', { statusCode: 200, ok: true, overall: 'PASS', interrupted: true, checks })).toEqual(['verify says interrupted true, expected false']);
    expect(judgeVerify('SEALED', { statusCode: 200, ok: false, overall: 'TAMPERED', interrupted: false, checks: [{ id: 'V-04', status: 'FAIL' }, ...checks.slice(1)] })).toEqual(['verify says ok false, overall TAMPERED', 'verify check V-04 failed']);
    expect(judgeVerify('SEALED', { statusCode: 200, ok: true, overall: 'PASS', interrupted: false, checks: checks.slice(0, 14) })).toEqual(['verify ran 14 checks, not 15']);
  });

  it('the sealed folder holds the declared files only: a plaintext recording or a half-written file fails it', () => {
    const top = ['session-manifest.json', 'signature.sig', 'device-certificate.pem', 'audit-session-extract.jsonl', 'fragments'];
    const fragments = ['VIDEO-01.mp4', 'VIDEO-02.mp4', 'fragments.json'];
    expect(judgeSealedFolder({ top, fragments })).toEqual([]);
    expect(judgeSealedFolder({ top: [...top, 'VIDEO-01.mp4'], fragments })).toHaveLength(1);
    expect(judgeSealedFolder({ top, fragments: [...fragments, 'VIDEO-01.mp4.seal.part'] })).toHaveLength(1);
    expect(judgeSealedFolder({ top, fragments: null })).toHaveLength(1);
  });

  it('a failed start: no item, no sealing row, no sealed file, four start records, the armed process alive', () => {
    const clean = { items: 0, jobs: 0, sourceRows: 4, folder: { top: ['VIDEO-01.mp4'], fragments: null }, armedProcessKilled: false };
    expect(judgeFailedStart(clean)).toEqual([]);
    expect(judgeFailedStart({ ...clean, folder: null, armedProcessKilled: null })).toEqual([]);
    expect(judgeFailedStart({ ...clean, items: 1 })).toHaveLength(1);
    expect(judgeFailedStart({ ...clean, jobs: 1 })).toHaveLength(1);
    expect(judgeFailedStart({ ...clean, sourceRows: 0 })).toHaveLength(1);
    expect(judgeFailedStart({ ...clean, folder: { top: ['signature.sig'], fragments: [] } })).toHaveLength(2);
    expect(judgeFailedStart({ ...clean, armedProcessKilled: true })).toEqual(['the armed process was killed: recovery reached the sealing step']);
  });
});
