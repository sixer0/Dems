// THE KILL MATRIX OF M7 (blueprint row 86 / M7-W5): the runner file. A RUNNER CHECK, NOT A SUITE
// TEST - it starts the Core as a process, the built capture worker and the development helper
// (generated picture and tone; no camera, no microphone, no device is opened), so nothing runs
// unless `DEMS_KILL_MATRIX` NAMES THE CHECKS, and the run holds the heavy-host and the db lock:
//
//   apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --list
//   apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only M7-KM-P2-S3
//
// EACH CHECK ONCE (decision D122): a named check is one `it`, it kills once at each point its
// row of `cells.ts` names, and it is never repeated here. A second run is a decision of whoever
// reads a red result. There is no way to run "all": a run names its cells.
//
// WHAT A CELL DOES: bring a session to the recording phase the cell names -> kill (kind per cell,
// `cells.ts`) -> start the next Core on the same database and media -> for a step cell, that Core
// dies at the step -> start the last Core -> RECOVERY finishes -> judge (`judge.ts`).
// The report of every cell is written to `.cache/kill-matrix/` (git-ignored): the kills with
// their signal, the journal with its attempts at each kill and at the end, the hash comparison,
// the verify summary. Identifiers, counts, codes and equalities only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { provisionDevelopmentSigningKey } from '../../index';
import { P4_POINT, selectCells, type KillPoint, type MatrixCell } from './cells';
import { judgeFailedStart, judgeFrozenKept, judgeKillPoint, judgeMediaReference, judgeSealedFolder, judgeSealedJobs, judgeVerify } from './judge';
import { REPOSITORY, appendTornTail, copyRecordings, countOf, folderOf, fragmentRows, jobRows, killLeftCores, manifestOf, post, prefixDigests, recordingStarted, sessionRow, signIn, signedBytesOf, sleep, stagingLeft, startCore, startRecording, sweep, until, untilDurable, verify, type CoreProcess, type Rig } from './rig';

// An unknown or parked ID fails the file while it is collected: a run never silently runs nothing.
const ASKED = selectCells(process.env.DEMS_KILL_MATRIX);
const OUT = process.env.DEMS_KILL_MATRIX_OUT ?? resolve(REPOSITORY, '.cache/kill-matrix');
const KEEP = process.env.DEMS_KILL_MATRIX_KEEP === '1';

const db = useTestDatabase({ template: 'seed' });
type Fixture = ReturnType<typeof realBootFixture>;

interface Report {
  readonly id: string;
  readonly recording: string;
  readonly expectation: string;
  readonly kills: { at: string; kind: string; signal: string | null; processes?: readonly string[]; journal: readonly string[]; itemsAtKill: number; sessionRow: readonly string[] }[];
  notStaged: string[];
  facts: Record<string, unknown>;
  wrong: string[];
}

const journalOf = (rows: readonly { step: string; status: string; attempt: number }[]): string[] => rows.map((row) => `${row.step}:${row.status}:attempt ${row.attempt}`);

/** Waits for the armed Core to die at its point; a Core that does not die is the cell's failure, said plainly. */
async function diesAt(core: CoreProcess, point: KillPoint, limitMs: number): Promise<string | null> {
  const end = await Promise.race([core.exited, sleep(limitMs).then(() => null)]);
  if (end === null) return `the Core armed at ${point.step}:${point.phase} was not killed within ${limitMs} ms: the step was not reached`;
  return end.signal === 'SIGKILL' ? null : `the Core armed at ${point.step}:${point.phase} ended with ${end.signal ?? `code ${end.code}`}, not SIGKILL`;
}

async function runCell(cell: MatrixCell, fixture: Fixture): Promise<Report> {
  const report: Report = { id: cell.id, recording: cell.recording, expectation: cell.expectation, kills: [], notStaged: [], facts: {}, wrong: [] };
  const target = await db.another({ template: 'seed', slug: cell.id.toLowerCase().replace(/[^a-z0-9]+/g, '_') });
  const owner = target.ownerPool();
  // No speech runtime on a test host: STT is off in THIS throw-away database (as the e2e of row 82b does). The transcript of every cell is DISABLED.
  await owner.query('UPDATE public.stt_config SET enabled = false');
  const rig: Rig = { database: { host: target.runtime.host, port: target.runtime.port, database: target.runtime.database, user: target.runtime.user, password: target.runtime.password.reveal() }, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, owner };
  const itemsOf = (sessionId: string): Promise<number> => countOf(rig, 'SELECT count(*)::text AS n FROM public.evidence_items WHERE session_id = $1', [sessionId]);

  async function noteKill(sessionId: string, at: string, kind: string, signal: string | null, processes?: readonly string[]): Promise<void> {
    report.kills.push({ at, kind, signal, ...(processes === undefined ? {} : { processes }), journal: journalOf(await jobRows(rig, sessionId)), itemsAtKill: await itemsOf(sessionId), sessionRow: await sessionRow(rig) });
  }

  /** A Core armed at a sealing point dies there; the journal and the item count at that moment are judged. */
  async function sealKill(core: CoreProcess, sessionId: string, point: KillPoint, limitMs: number): Promise<{ frozen: unknown; signed: ReturnType<typeof signedBytesOf> }> {
    const notKilled = await diesAt(core, point, limitMs);
    if (notKilled !== null) {
      report.wrong.push(notKilled);
      await core.close();
    }
    await noteKill(sessionId, `${point.step}:${point.phase}`, 'CORE (SIGKILL of itself at the journal write)', core.exit()?.signal ?? null);
    const rows = await jobRows(rig, sessionId);
    report.wrong.push(...judgeKillPoint(point, rows));
    // No half package presented as sealed: the item exists only once the commit inside STORE_SEALED_PACKAGE has happened.
    const committed = point.step === 'STORE_SEALED_PACKAGE' && point.phase !== 'BEFORE' ? 1 : 0;
    const items = await itemsOf(sessionId);
    if (items !== committed) report.wrong.push(`${items} evidence item(s) at a kill at ${point.step}:${point.phase}, expected ${committed}`);
    return { frozen: rows.find((row) => row.step === point.step)?.checkpoint ?? null, signed: signedBytesOf(rig, sessionId) };
  }

  // ---- 1. the recording phase ----
  const first = await startCore(rig, cell.recording === 'C' ? cell.sealKill : cell.recording === 'P4' ? P4_POINT : null);
  const operator = await signIn(first);
  const sessionId = await startRecording(first, operator);
  report.facts.sessionId = sessionId;
  let copies: Record<string, string> | null = null;
  let rowsAtKill: Record<string, number> | null = null;
  let tornBytes = 0;
  let frozen: unknown = null;
  let signed: ReturnType<typeof signedBytesOf> = null;
  let last: CoreProcess | null = null;
  const countRows = async (): Promise<Record<string, number>> => {
    const rows = await fragmentRows(rig, sessionId);
    return { 'VIDEO-01': rows.filter((row) => row.trackId === 'VIDEO-01').length, 'VIDEO-02': rows.filter((row) => row.trackId === 'VIDEO-02').length };
  };

  if (cell.recording === 'P1') {
    // The P1 moment (test strategy §F.1): the session is RECORDING, the capture worker of this Core runs, no fragment is durable.
    // (Waiting for the camera file is too late: its first fragment was durable by the time the kill landed, measured twice.)
    for (const started = Date.now(); !(await first.workerRuns()); ) {
      if (Date.now() - started > 20_000) throw new Error(`${cell.id} NOT STAGED: no capture worker ran within 20 s of the start`);
      await sleep(25);
    }
    report.facts.cameraFileAtKill = recordingStarted(rig, sessionId);
    const crash = await first.crash();
    await noteKill(sessionId, 'P1', 'WORKER+CORE (SIGKILL from the harness)', first.exit()?.signal ?? null, crash.killed);
    const durable = await countRows();
    if (durable['VIDEO-01'] !== 0 || durable['VIDEO-02'] !== 0) throw new Error(`${cell.id} NOT STAGED: a fragment was durable before the kill (${JSON.stringify(durable)}); the cell did not run`);
  } else {
    await untilDurable(first);
    if (cell.recording === 'P3') {
      await sleep(2_000);
      const switched = await post(first, operator, `/api/v1/session/${sessionId}/audio-source`, { inputId: 'MIC-02', reason: 'Kill matrix P3' });
      if (switched.statusCode !== 200) throw new Error(`${cell.id} NOT STAGED: the microphone switch answered ${switched.statusCode}: ${switched.body.slice(0, 200)}`);
      await sleep(2_500);
    } else {
      await sleep(cell.recording === 'P2' ? 4_000 : 5_000);
    }
    if (cell.recording === 'P2' || cell.recording === 'P3') {
      const crash = await first.crash();
      await noteKill(sessionId, cell.recording, 'WORKER+CORE (SIGKILL from the harness)', first.exit()?.signal ?? null, crash.killed);
      rowsAtKill = await countRows();
      if ((await sessionRow(rig)).join() !== 'RECORDING') report.wrong.push(`the session row says ${(await sessionRow(rig)).join()} after the kill, not RECORDING: the Core recorded the end`);
      if (cell.recording === 'P2') {
        tornBytes = appendTornTail(rig, sessionId, await fragmentRows(rig, sessionId));
        report.facts.tornBytesAppended = tornBytes;
      } else {
        const open = await countOf(rig, 'SELECT count(*)::text AS n FROM public.session_audio_intervals WHERE session_id = $1 AND to_at IS NULL', [sessionId]);
        const all = await countOf(rig, 'SELECT count(*)::text AS n FROM public.session_audio_intervals WHERE session_id = $1', [sessionId]);
        if (open !== 1 || all < 2) throw new Error(`${cell.id} NOT STAGED: ${all} interval row(s), ${open} open, after the switch`);
        report.facts.intervalsAtKill = { all, open };
        // The other half of P3 (test strategy §F.1): no transcriber session runs for a recording yet (note 37b D-82b-3 / row 71c).
        report.notStaged.push('a transcript chunk in flight (STT is off in the rig; no transcriber session is wired to a recording)');
      }
      copies = copyRecordings(rig, sessionId);
    } else {
      // C and P4: the operator's stop.
      const stopped = await post(first, operator, `/api/v1/session/${sessionId}/stop`, { reason: 'Interview complete' });
      if (stopped.statusCode !== 202) throw new Error(`the stop answered ${stopped.statusCode}: ${stopped.body.slice(0, 200)}`);
      if (cell.recording === 'P4') {
        const notKilled = await diesAt(first, P4_POINT, 120_000);
        if (notKilled !== null) throw new Error(`${cell.id} NOT STAGED: ${notKilled}`);
        await noteKill(sessionId, 'P4', 'CORE (SIGKILL of itself before the first journal write)', first.exit()?.signal ?? null);
        const rows = await jobRows(rig, sessionId);
        if (rows.length !== 0) report.wrong.push(`${rows.length} row(s) of sealing_jobs at the P4 kill: a checkpoint was written`);
        copies = copyRecordings(rig, sessionId);
      } else if (cell.sealKill !== null) {
        ({ frozen, signed } = await sealKill(first, sessionId, cell.sealKill, 120_000));
        copies = copyRecordings(rig, sessionId);
      } else {
        last = first; // M7-REF-1: nothing is killed.
      }
    }
  }

  // ---- 2. the kill inside the sealing step, in the Core that RECOVERY started ----
  if (cell.recording !== 'C' && cell.sealKill !== null) {
    const armed = await startCore(rig, cell.sealKill);
    if (cell.expectation === 'FAILED_START') {
      // The armed Core must NOT die: recovery of a failed start reaches no sealing step. It is watched, then judged below.
      await Promise.race([armed.exited, sleep(20_000)]);
      last = armed;
    } else {
      ({ frozen, signed } = await sealKill(armed, sessionId, cell.sealKill, 120_000));
    }
  }

  // ---- 3. the last Core: RECOVERY finishes ----
  if (last === null) last = await startCore(rig, null);
  const final = last;

  if (cell.expectation === 'FAILED_START') {
    if (cell.sealKill === null) await sleep(15_000);
    const killed = final.exit()?.signal === 'SIGKILL';
    if (!killed) await final.call({ op: 'settled' });
    const state = await sessionRow(rig);
    report.facts.sessionRowAfterBoot = state;
    report.facts.codes = killed ? [] : (await final.view(sessionId)).codes;
    report.wrong.push(
      ...judgeFailedStart({
        items: await itemsOf(sessionId),
        jobs: (await jobRows(rig, sessionId)).length,
        sourceRows: await countOf(rig, 'SELECT count(*)::text AS n FROM public.session_capture_sources WHERE session_id = $1', [sessionId]),
        folder: folderOf(rig, sessionId),
        armedProcessKilled: cell.sealKill === null ? null : killed,
      }),
    );
    // "Closed as a failed start" (erratum PE-128-88): a session row that still says it records is not closed.
    if (state.some((value) => ['RECORDING', 'STOPPING', 'FINALIZING'].includes(value))) report.wrong.push(`the session row says ${state.join()} after the boot: the failed start is not closed`);
    await final.close();
    return report;
  }

  const interrupted = cell.expectation === 'SEALED_INTERRUPTED';
  await until('the session is SEALED', 150_000, async () => ((await final.view(sessionId)).session?.state === 'SEALED' ? true : null), async () => {
    const view = await final.view(sessionId);
    return { state: view.session?.state, steps: view.session?.steps, outcome: view.outcome, codes: view.codes, journal: journalOf(await jobRows(rig, sessionId)) };
  });
  await final.call({ op: 'settled' });
  const view = await final.view(sessionId);

  // The item: committed exactly once.
  const items = await itemsOf(sessionId);
  const sealedRows = await countOf(rig, "SELECT count(*)::text AS n FROM public.audit_log WHERE session_id = $1 AND type = 'EVIDENCE_SEALED'", [sessionId]);
  if (items !== 1) report.wrong.push(`${items} evidence items for the session, not 1`);
  if (sealedRows !== 1) report.wrong.push(`${sealedRows} EVIDENCE_SEALED audit rows, not 1`);
  if (view.items.length !== 1 || view.items[0]?.status !== 'SEALED' || view.items[0]?.integritySource !== 'REAL' || view.items[0]?.manifestVersion !== 2) report.wrong.push(`the engine holds ${JSON.stringify(view.items)}`);

  // The journal: six DONE; a killed seal is finished by attempt 2 (a kill before the first row leaves nothing to count).
  const jobs = await jobRows(rig, sessionId);
  report.facts.journal = journalOf(jobs);
  report.wrong.push(...judgeSealedJobs(jobs, cell.sealKill === null ? 1 : 2));
  if (cell.sealKill?.step === 'BUILD_MANIFEST') report.wrong.push(...judgeFrozenKept('BUILD_MANIFEST', frozen, jobs.find((row) => row.step === 'BUILD_MANIFEST')?.checkpoint ?? null));

  // The folder: the declared files only; no plaintext recording; nothing half-written.
  const folder = folderOf(rig, sessionId);
  report.wrong.push(...(folder === null ? ['the package folder is not there'] : judgeSealedFolder(folder)));
  const parts = stagingLeft(rig, sessionId);
  if (parts.length > 0) report.wrong.push(`half-written files left in the staging folder: ${parts.join(', ')}`);

  // The manifest against the recorder's rows and against the copy of the recording.
  const manifest = manifestOf(rig, sessionId);
  if (manifest.interrupted !== interrupted) report.wrong.push(`the manifest says interrupted ${manifest.interrupted}, expected ${interrupted}`);
  if (manifest.evidenceId !== view.items[0]?.id) report.wrong.push('the manifest names another evidence item than the engine holds');
  const digests = copies === null ? null : prefixDigests(copies, manifest);
  report.wrong.push(...judgeMediaReference(manifest, await fragmentRows(rig, sessionId), rowsAtKill, digests));
  report.facts.reference = { fragmentsPerFile: manifest.tracks.map((track) => track.fragmentCount), sealedBytesPerFile: manifest.tracks.map((track) => track.bytes), rowsAtKill, recordingCopyCompared: digests !== null, truncated: manifest.truncated };
  if (cell.recording === 'P2') {
    // The torn tail was left out of the sealed file, and said: the sealed VIDEO-01 is shorter than the recording by at least the torn bytes.
    const sealedBytes = manifest.tracks.find((track) => track.trackId === 'VIDEO-01')?.bytes ?? 0;
    const closeTracks = JSON.stringify(jobs.find((row) => row.step === 'CLOSE_TRACKS')?.checkpoint ?? {});
    const dropped = [...closeTracks.matchAll(/"droppedBytes":(\d+)/g)].map((match) => Number(match[1]));
    report.facts.droppedBytes = dropped;
    if (!dropped.some((bytes) => bytes >= tornBytes)) report.wrong.push(`no camera file dropped the ${tornBytes} torn bytes (CLOSE_TRACKS says ${JSON.stringify(dropped)}); sealed VIDEO-01 is ${sealedBytes} bytes`);
    if (!manifest.truncated.some((entry) => entry.startsWith('VIDEO-01:'))) report.wrong.push('no fragment of VIDEO-01 carries the truncated mark');
  }

  // Byte-identical manifest and signature where the killed run had written them (SIGN_MANIFEST's work, and after).
  const now = signedBytesOf(rig, sessionId);
  report.facts.signedBytesComparedWithKilledRun = signed !== null;
  if (signed !== null && (now?.manifest !== signed.manifest || now.signature !== signed.signature)) report.wrong.push('the manifest or the signature is not byte-identical to what the killed run wrote');

  // The product verifier (operation 41).
  const again = await signIn(final);
  const verdict = await verify(final, again, manifest.evidenceId);
  report.facts.verify = { statusCode: verdict.statusCode, ok: verdict.ok, overall: verdict.overall, interrupted: verdict.interrupted, checks: verdict.checks.length, failed: verdict.checks.filter((check) => check.status === 'FAIL').map((check) => check.id), failures: verdict.failures };
  report.wrong.push(...judgeVerify(interrupted ? 'SEALED_INTERRUPTED' : 'SEALED', verdict));
  report.facts.outcome = view.outcome === null ? null : { status: (view.outcome as { status?: string }).status, attempt: (view.outcome as { attempt?: number }).attempt, interrupted: (view.outcome as { interrupted?: boolean }).interrupted, skipped: (view.outcome as { skipped?: string[] }).skipped };
  await final.close();
  return report;
}

describe.skipIf(ASKED.length === 0)('M7 kill matrix (row 86): each named check once', () => {
  const fixtures: Fixture[] = [];
  afterEach(() => killLeftCores());
  afterAll(() => {
    for (const fixture of fixtures) sweep({ dataDir: fixture.dataDir } as Rig);
    if (!KEEP) for (const fixture of fixtures) fixture.remove();
  });

  // One `it` per named check: generated from the table, reported under its own ID, never repeated.
  for (const cell of ASKED) {
    it(`${cell.id} [${cell.kills.join(' -> ') || 'no kill'}] ${cell.asserts}`, async () => {
      const fixture = realBootFixture(`row86-${cell.id}`);
      provisionDevelopmentSigningKey({ dataDir: fixture.dataDir, now: Date.now() });
      fixtures.push(fixture);
      let report: Awaited<ReturnType<typeof runCell>> | { id: string; error: string };
      try {
        report = await runCell(cell, fixture);
      } catch (error) {
        report = { id: cell.id, error: error instanceof Error ? error.message : 'the cell did not run' };
        mkdirSync(OUT, { recursive: true });
        writeFileSync(`${OUT}/${cell.id}-${Date.now()}.json`, JSON.stringify(report, null, 1));
        throw error;
      }
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/${cell.id}-${Date.now()}.json`, JSON.stringify(report, null, 1));
      console.info(`[kill matrix] ${cell.id}: ${report.wrong.length === 0 ? 'PASS' : 'FAIL'} ${JSON.stringify({ kills: report.kills.map((kill) => `${kill.at} ${kill.signal}`), notStaged: report.notStaged, facts: report.facts })}`);
      expect(report.wrong, cell.id).toEqual([]);
    }, 600_000);
  }
});
