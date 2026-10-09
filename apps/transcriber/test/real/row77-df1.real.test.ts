// M6-DF-1 (test strategy `:222`; transcript spec §C "The proof", §E.1-8; RK-1; E-22): "no dropped
// capture fragment while STT runs" — with the `cpu-local` engine (a GPU engine gives no evidence
// about CPU starvation, AU3-01). ONE FUNCTIONAL CHECK, NOT A THROUGHPUT MEASUREMENT: nothing here
// measures, compares or stores a duration or a speed (D230).
//
// WHAT RUNS. The capture side is row 58's own harness, used read-only: the REAL capture worker on
// two fake cameras and the fake microphones (`apps/capture-worker/test/m3worker.py session … --case
// long --tap`). Beside it, for the whole capture, the row-77 pipeline decodes the sealed fixture
// with `whisper-cli -ng` (a new pipeline process is started whenever one finishes, so the engine
// is busy from before the capture starts until after it ends).
//
// WHAT IS JUDGED, per camera file (`fmp4-fragments.ts`): the fragment sequence numbers are one run
// of consecutive integers, every track's timeline is continuous from fragment to fragment, and
// every fragment has its data; plus the harness's own count of audio packets against the encoder's
// manifest (none missing, none repeated). NEGATIVE CONTROLS on copies of the SAME files: one
// fragment removed, and one fragment written twice, must both be reported.
//
// THE SIBLING RULE is observed on the way: the niceness `ps` reports for the capture worker and
// for the engine (the engine must be the higher number).
//
// Run alone, outside the sandbox, with NO other capture run and no other heavy job on the host:
//   npm run test:real:row77:df1 -w @dems/transcriber
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { judgeFragments, readFragmentsOf, withFragmentTwice, withoutFragment } from './fmp4-fragments';
import { REPO, ROW77_RUNS_DIR, createRunDir, writeEvidence } from './real-support';

const WORKSPACE = resolve(import.meta.dirname, '..', '..');
const CHILD = join(import.meta.dirname, 'row77-pipeline-child.ts');
const HARNESS = join(REPO, 'apps/capture-worker/test/m3worker.py');
const WORKER_BUILD = join(REPO, 'apps/capture-worker/build');
const EVIDENCE_DIR = createRunDir('row77-df1', ROW77_RUNS_DIR);
const STAMP = EVIDENCE_DIR.split('/').pop()!.split('-')[0]!.toLowerCase();

const ps = (...args: string[]): string => {
  try {
    return execFileSync('/bin/ps', args, { encoding: 'utf8' });
  } catch {
    return '';
  }
};
/**
 * `[pid, niceness]` of the processes whose EXECUTABLE is named `program` and whose command line
 * holds every one of `needles`. By executable, not by text: a shell whose command line merely
 * mentions the name is not that program.
 */
function processes(program: string, ...needles: string[]): { pid: number; nice: number }[] {
  return ps('-axo', 'pid=,ni=,command=')
    .split('\n')
    .map((line) => /^\s*(\d+)\s+(-?\d+)\s+(\S+)(.*)$/.exec(line))
    .filter((parts): parts is RegExpExecArray => parts !== null && parts[3]!.split('/').pop() === program && needles.every((needle) => parts[4]!.includes(needle)))
    .map((parts) => ({ pid: Number(parts[1]), nice: Number(parts[2]) }));
}
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

interface JournalLine {
  readonly event: string;
  readonly seq?: number;
  readonly pid?: number;
}
const journalOf = (scratch: string): JournalLine[] => {
  try {
    return readFileSync(join(scratch, 'engine-journal.jsonl'), 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as JournalLine);
  } catch {
    return [];
  }
};

describe('M6-DF-1: no dropped capture fragment while cpu-local STT runs', () => {
  let hostReady = false;

  it('the host is ready: the capture harness is built, and no capture run of another row is in progress', () => {
    for (const name of ['capture-worker', 'fake_cam', 'fake_mic']) expect(existsSync(join(WORKER_BUILD, name)), `${name} is not built: row 58 builds it`).toBe(true);
    const busy = [...processes('capture-worker'), ...processes('fake_cam'), ...processes('fake_mic'), ...processes('whisper-cli')];
    expect(busy, 'another capture or STT run is in progress on this host: this check must run alone').toEqual([]);
    hostReady = true;
  });

  it.each([1, 2])('run %i — the capture session beside whisper-cli -ng: every fragment is there once, in order, on both camera files', async (runNumber) => {
    expect(hostReady, 'the host was not ready: nothing is started beside another capture run').toBe(true);
    const name = `row77_df1_${STAMP}_r${runNumber}`;
    const sttScratch = (index: number): string => join(EVIDENCE_DIR, `run${runNumber}-stt-${index}`);

    // ── the STT load: one pipeline process after the other, until the capture has ended ──
    let sttIndex = 1;
    let pipelinesFinished = 0;
    let pipelinesFailed = 0;
    let stop = false;
    const startPipeline = (): ReturnType<typeof spawn> => spawn(process.execPath, ['--import', 'tsx', CHILD, sttScratch(sttIndex), 'report.json'], { cwd: WORKSPACE, stdio: 'ignore' });
    let pipeline = startPipeline();
    const keepBusy = (): void => {
      pipeline.once('exit', (code) => {
        if (stop) return;
        if (code === 0) pipelinesFinished += 1;
        else pipelinesFailed += 1;
        sttIndex += 1;
        pipeline = startPipeline();
        keepBusy();
      });
    };
    keepBusy();
    const enginePid = (): number | null => {
      const starts = journalOf(sttScratch(sttIndex)).filter((line) => line.event === 'stt-start');
      const last = starts[starts.length - 1];
      return last?.pid !== undefined && alive(last.pid) ? last.pid : null;
    };
    for (let tries = 0; tries < 12_000 && enginePid() === null; tries += 1) await wait(50);
    const engineAtCaptureStart = enginePid();
    expect(engineAtCaptureStart, 'whisper-cli did not start: there is no STT to run beside the capture').not.toBeNull();

    // ── the capture session (row 58's harness; its own output stays in its own run directory) ──
    const harness = spawn('python3', [HARNESS, 'session', name, '--case', 'long', '--tap'], { cwd: REPO, stdio: 'ignore' });
    const harnessExit = new Promise<number | null>((done) => harness.once('exit', (code) => done(code)));
    let harnessDone = false;
    void harnessExit.then(() => {
      harnessDone = true;
    });
    let workerSeen: { pid: number; nice: number } | null = null;
    let engineNiceSeen: number | null = null;
    let pollsWithWorker = 0;
    let pollsWithWorkerAndEngine = 0;
    while (!harnessDone) {
      const worker = processes('capture-worker', name)[0];
      if (worker !== undefined) {
        pollsWithWorker += 1;
        workerSeen = worker;
        const engine = enginePid();
        if (engine !== null) {
          const row = processes('whisper-cli').find((entry) => entry.pid === engine);
          if (row !== undefined) {
            pollsWithWorkerAndEngine += 1;
            engineNiceSeen = row.nice;
          }
        }
      }
      await wait(200);
    }
    const harnessCode = await harnessExit;
    // The pipeline may be between two chunks at this instant: the pipeline PROCESS is what must be alive.
    const pipelineAliveAtCaptureEnd = pipeline.pid !== undefined && alive(pipeline.pid);

    // ── the STT load is no longer needed ──
    stop = true;
    const lastEngine = enginePid();
    pipeline.kill('SIGKILL');
    if (lastEngine !== null) {
      try {
        process.kill(lastEngine, 'SIGKILL');
      } catch {
        // It ended by itself.
      }
    }
    await wait(500);
    expect(processes('whisper-cli')).toEqual([]);

    // ── judgement ──
    const runDir = join(REPO, '.cache/m3worker/runs', name);
    const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8')) as {
      verdict: string;
      info: { rc: Record<string, number>; crash?: unknown };
      h4_one_encoder_both_files?: { audio_packets: number[]; encoder_packets_in_manifest: number; packets_differing_between_files: number; payload_mismatches_vs_encoder: number[]; distinct_payloads_in_file1: number };
    };
    const files = ['VIDEO-01.mp4', 'VIDEO-02.mp4'].map((file) => join(runDir, 'media', file));
    const verdicts = files.map((file) => judgeFragments(readFragmentsOf(readFileSync(file))));
    const controls = files.map((file) => {
      const bytes = readFileSync(file);
      const middle = Math.floor(judgeFragments(readFragmentsOf(bytes)).fragments / 2);
      return { dropped: judgeFragments(readFragmentsOf(withoutFragment(bytes, middle))), duplicated: judgeFragments(readFragmentsOf(withFragmentTwice(bytes, middle))) };
    });
    const h4 = result.h4_one_encoder_both_files;

    writeEvidence(EVIDENCE_DIR, `run${runNumber}.evidence.json`, {
      check: 'row 77 M6-DF-1: no dropped capture fragment while cpu-local STT runs (one functional check; no duration, no speed)',
      captureHarness: `python3 apps/capture-worker/test/m3worker.py session ${name} --case long --tap`,
      captureRunDirectory: `.cache/m3worker/runs/${name}`,
      sttBesideTheCapture: {
        engine: 'whisper-cli -ng through the row-77 pipeline, sealed fixture, started again whenever a pipeline process finished',
        engineRunningWhenTheCaptureStarted: engineAtCaptureStart !== null,
        pipelineProcessAliveWhenTheCaptureEnded: pipelineAliveAtCaptureEnd,
        engineSeenRunningBesideTheCaptureWorker: pollsWithWorkerAndEngine > 0,
        pipelineProcessesThatFailed: pipelinesFailed,
        aPipelineFinishedAndWasRestartedDuringTheCapture: pipelinesFinished > 0,
      },
      siblingRule: { captureWorkerNice: workerSeen?.nice ?? null, engineNice: engineNiceSeen, engineBelowWorker: workerSeen !== null && engineNiceSeen !== null && engineNiceSeen > workerSeen.nice },
      harness: { exitCode: harnessCode, verdict: result.verdict, processExitCodes: result.info.rc },
      audioPacketsAgainstTheEncoderManifest: h4 === undefined ? null : { packetsPerFile: h4.audio_packets, encoderPackets: h4.encoder_packets_in_manifest, differingBetweenFiles: h4.packets_differing_between_files, mismatchesAgainstEncoder: h4.payload_mismatches_vs_encoder, distinctPayloads: h4.distinct_payloads_in_file1 },
      fragments: Object.fromEntries(files.map((file, index) => [file.split('/').pop()!, verdicts[index]])),
      negativeControls: Object.fromEntries(files.map((file, index) => [file.split('/').pop()!, { oneFragmentRemoved: { ok: controls[index]!.dropped.ok, findings: controls[index]!.dropped.findings }, oneFragmentTwice: { ok: controls[index]!.duplicated.ok, findings: controls[index]!.duplicated.findings } }])),
    });

    // STT really ran beside the capture, for all of it.
    expect(pollsWithWorker).toBeGreaterThan(0);
    expect(pollsWithWorkerAndEngine).toBeGreaterThan(0);
    expect(pipelineAliveAtCaptureEnd).toBe(true);
    expect(pipelinesFailed).toBe(0);
    // The capture ended cleanly.
    expect(result.info.rc).toEqual({ cam1: 0, cam2: 0, worker: 0 });
    // THE CHECK: on both files every fragment is there once and in order, and both timelines are continuous.
    for (const verdict of verdicts) {
      expect(verdict.findings).toEqual([]);
      expect(verdict.ok).toBe(true);
      expect(verdict.fragments).toBeGreaterThanOrEqual(10);
      expect(verdict.firstSequence).toBe(1);
      expect(verdict.lastSequence).toBe(verdict.fragments);
    }
    expect(verdicts[0]!.fragments).toBe(verdicts[1]!.fragments);
    // No audio packet missing or repeated against what the one encoder produced.
    expect(h4).toBeDefined();
    expect(h4!.packets_differing_between_files).toBe(0);
    expect(h4!.payload_mismatches_vs_encoder).toEqual([0, 0]);
    expect(h4!.audio_packets).toEqual([h4!.encoder_packets_in_manifest, h4!.encoder_packets_in_manifest]);
    // Row 58's own condition on distinct payloads (`m3worker.py` h4, pair-111 N-9): nearly every packet is
    // unique, so the position-by-position equality above bites. It is NOT "all distinct": the one encoder
    // itself emits the same payload for stretches of identical input (25 of 1,850 in the first run of
    // 2026-10-09), and those packets are in the file exactly where the encoder manifest has them.
    expect(h4!.distinct_payloads_in_file1).toBeGreaterThan(h4!.encoder_packets_in_manifest * 0.9);
    // NEGATIVE CONTROLS: the same reader on the same files with one fragment removed / written twice FAILS.
    for (const control of controls) {
      expect(control.dropped.ok).toBe(false);
      expect(control.dropped.findings.some((finding) => finding.startsWith('SEQUENCE_NOT_CONSECUTIVE'))).toBe(true);
      expect(control.dropped.findings.some((finding) => finding.startsWith('TIMELINE_GAP'))).toBe(true);
      expect(control.duplicated.ok).toBe(false);
      expect(control.duplicated.findings.some((finding) => finding.startsWith('DUPLICATED_SEQUENCE'))).toBe(true);
    }
    // The sibling rule, as `ps` saw it.
    expect(workerSeen).not.toBeNull();
    expect(engineNiceSeen).not.toBeNull();
    expect(engineNiceSeen!).toBeGreaterThan(workerSeen!.nice);
  });
});
