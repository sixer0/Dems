// The numbers of an attended camera run (integration pass C2; decisions D118, D119; check
// M4-LOCAL-CAM-1): `e2e/camera_run_numbers.py`, the module the attended script takes its bound and
// its start-up intervals from. GENERATED worker logs only - lines of timestamps and counters in the
// shape the worker writes; no media, no device, no worker process. The script is run as the
// attended script runs it (`python3`), so the function under test is the one that judges the user's run.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'e2e', 'camera_run_numbers.py');
const root = mkdtempSync(join(tmpdir(), 'dems-camnumbers-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;

interface Shape {
  /** File time 0 (the audio's first sample), microseconds of the wall clock. */
  readonly t0: number;
  /** The stamp of the first frame the worker could place, after t0. */
  readonly stampAfterT0Us: number;
  /** The first frame in the file, in 90 kHz ticks after t0. */
  readonly firstPts: number;
  /** When the helper's stream ended, after t0. */
  readonly endedAfterT0Us: number;
  readonly droppedNoPts: number;
  readonly droppedPrestart: number;
}

/** A generated worker log of one camera session: the lines the numbers are read from, among others. */
function workerLog(shape: Shape): string {
  const line = (afterT0Us: number, message: string, more: Record<string, unknown>): string => JSON.stringify({ ts_us: shape.t0 + afterT0Us, level: 'info', source: 'capture-worker.generated', pid: 1, sessionId: 'S-GENERATED', message, ...more });
  const path = join(root, `worker-${(counter += 1)}.jsonl`);
  writeFileSync(
    path,
    [
      line(-100_000, 'session_starting', { cameras: 1 }),
      line(312_000, 'audio_started', { t0_real_us: shape.t0, encoders: 1 }),
      line(shape.stampAfterT0Us + 900_000, 'ingest_connected', { port: 8563, codec: 'h264' }),
      line(shape.stampAfterT0Us + 900_016, 'video_anchored', { mode: 'prft', shift_us: shape.stampAfterT0Us }),
      line(shape.stampAfterT0Us + 990_000, 'video_started', { first_pts: shape.firstPts, time_base_den: 90_000 }),
      'not a line of the log',
      line(shape.endedAfterT0Us, 'INGEST_ENDED', { port: 8563, video_packets: 300 }),
      line(shape.endedAfterT0Us + 1_100_000, 'camera_summary', { cam: 1, video_packets: 300, dropped_no_pts: shape.droppedNoPts, dropped_prearm: 0, dropped_prestart: shape.droppedPrestart, dropped_unanchored: 0 }),
      '',
    ].join('\n'),
  );
  return path;
}

interface Analysis {
  readonly numbers: Record<string, number | null> & { readonly dropped: Record<string, number> | null };
  readonly gap: { readonly residual_ms_one_frame_interval_expected: number; readonly audio_before_first_recorded_frame_ms: number; readonly audio_priming_ms: number } | null;
  readonly bound?: { readonly pass: boolean; readonly camera_within_bound: boolean; readonly file_within_bound: boolean; readonly camera_recorded_s_upper_bound: number | null };
}
const analyse = (log: string, ...options: Array<string | number>): Analysis => JSON.parse(execFileSync('python3', [SCRIPT, 'analyse', log, ...options.map(String)], { encoding: 'utf8' })) as Analysis;

const T0 = 1_791_543_896_282_588;
/** The shape of the attended run of D119: audio 3,992 ms before the first recorded frame, one group of pictures not written, the stream 14.265 s after t0. */
const D119: Shape = { t0: T0, stampAfterT0Us: 3_198_412, firstPts: 359_307, endedAfterT0Us: 14_264_878, droppedNoPts: 1, droppedPrestart: 29 };

describe('the first-frame gap is the audio that ran before the camera, not a pause of the device', () => {
  it('a gap of 4,046.6 ms = 3,992.3 ms of audio before the first recorded frame + 21.3 ms of priming + one frame interval (33.0 ms)', () => {
    const { numbers, gap } = analyse(workerLog(D119), '--gap-ms', 4046.6);
    expect(numbers.audio_before_first_recorded_frame_ms).toBe(3992.3);
    expect(numbers.audio_before_first_frame_stamp_ms).toBe(3198.4);
    expect(numbers.first_frame_stamp_to_first_recorded_frame_ms).toBe(793.9);
    expect(numbers.frames_before_the_first_recorded_one).toBe(30);
    expect(gap).toMatchObject({ audio_priming_ms: 21.3, residual_ms_one_frame_interval_expected: 33 });
  });

  it('a device that really paused after its first frame would leave a residual far from one frame interval (the decomposition can say no)', () => {
    // Same log, but the file's second frame 2 s later than the worker's numbers explain.
    const { gap } = analyse(workerLog(D119), '--gap-ms', 6046.6);
    expect(gap?.residual_ms_one_frame_interval_expected).toBe(2033);
  });

  it('the helper-side interval needs the helper start, which the old script did not record: null without it, a number with it', () => {
    const log = workerLog(D119);
    expect(analyse(log).numbers.helper_spawn_to_first_frame_stamp_ms).toBeNull();
    const spawned = T0 + 12_000;
    expect(analyse(log, '--helper-spawn-us', spawned).numbers.helper_spawn_to_first_frame_stamp_ms).toBe(3186.4);
  });

  it('a log without the lines gives nulls, never a guess', () => {
    const empty = join(root, 'empty.jsonl');
    writeFileSync(empty, '{"message":"worker_starting"}\n');
    const { numbers, gap } = analyse(empty, '--gap-ms', 100);
    expect([numbers.t0_real_us, numbers.first_recorded_frame_us, numbers.camera_recorded_s_upper_bound, gap]).toEqual([null, null, null, null]);
  });
});

describe('the bound of the attended step: at most 10 s of the camera, and a file of at most 12 s', () => {
  it('the run of D119 FAILS it on both counts: 10.273 s of the camera and a 15.33 s file', () => {
    const { bound } = analyse(workerLog(D119), '--seconds', 10, '--file-duration-s', 15.331333);
    expect(bound).toMatchObject({ camera_recorded_s_upper_bound: 10.273, camera_within_bound: false, file_within_bound: false, pass: false });
  });

  it('a run of the new shape PASSES: audio started when the helper connected, the helper gone at the bound', () => {
    // t0 about when the first frame is stamped; the first recorded frame one group of pictures later; the helper gone 9.9 s after that frame.
    const firstPts = 81_000; // 0.9 s
    const shape: Shape = { t0: T0, stampAfterT0Us: -150_000, firstPts, endedAfterT0Us: 900_000 + 9_900_000, droppedNoPts: 1, droppedPrestart: 26 };
    const gone = T0 + 900_000 + 9_930_000;
    const { bound, numbers } = analyse(workerLog(shape), '--seconds', 10, '--file-duration-s', 11.2, '--helper-spawn-us', T0 - 3_400_000, '--helper-gone-us', gone);
    expect(bound).toMatchObject({ camera_recorded_s_upper_bound: 9.93, camera_within_bound: true, file_within_bound: true, pass: true });
    expect(numbers.camera_open_s_upper_bound).toBe(14.23);
  });

  it('the margin is a quarter of a second for the camera and 2 s for the file: just inside passes, just outside fails', () => {
    const shape: Shape = { t0: T0, stampAfterT0Us: 0, firstPts: 90_000, endedAfterT0Us: 11_000_000, droppedNoPts: 1, droppedPrestart: 29 };
    const log = workerLog(shape);
    const first = T0 + 1_000_000;
    const verdict = (goneAfterFirstUs: number, fileSeconds: number): boolean => analyse(log, '--seconds', 10, '--file-duration-s', fileSeconds, '--helper-gone-us', first + goneAfterFirstUs).bound?.pass === true;
    expect([verdict(10_240_000, 11.9), verdict(10_260_000, 11.9), verdict(10_000_000, 12.1), verdict(10_000_000, 12.0)]).toEqual([true, false, false, true]);
  });

  it('a run with no first recorded frame cannot pass the bound', () => {
    const empty = join(root, 'no-video.jsonl');
    writeFileSync(empty, `${JSON.stringify({ ts_us: T0, message: 'audio_started', t0_real_us: T0 })}\n`);
    expect(analyse(empty, '--seconds', 10).bound).toMatchObject({ pass: false, camera_recorded_s_upper_bound: null });
  });
});
