// The two value sets `@dems/capture-protocol` restates from `@dems/shared` (fix round 1 of row 57,
// navigator finding F-8). The protocol package deliberately does not depend on the shared package
// (the C worker implements it by hand), so the Core server, which depends on both, holds them equal.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AudioSourceIntervalReason,
  CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES,
  CAPTURE_IPC_DEFAULTS,
  CAPTURE_MEDIA_PORT_MAX,
  CAPTURE_MEDIA_PORT_MIN,
  CAPTURE_PROTOCOL_VERSION,
  CAPTURE_SWITCH_BOUND_US,
  CAPTURE_WORKER_SETTINGS,
  CAPTURE_WORKER_SETTING_DEFAULTS,
  CaptureIngestState,
  CaptureMicRole,
  CaptureRecordKind,
  CaptureSyncLevel,
  CaptureWarningCode,
  CaptureWarningReason,
  LIBAVFORMAT_VERSION_MISMATCH,
  SWITCH_REFUSAL_CODES,
  WARNING_REASONS_OF,
  WorkerMessageType,
} from '@dems/capture-protocol';
import { CAPTURE_AAC_FRAME_SAMPLES, CAPTURE_AUDIO_CHANNELS, CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES, MIC_DISCONNECT_DEBOUNCE_MS, MIC_SILENCE_DBFS, MIC_SILENCE_DURATION_MS } from '@dems/shared/api';
import { MicRole } from '@dems/shared/domain';
import { VERIFY_MAX_OPEN_FRAGMENT_BYTES } from '@dems/shared/evidence-verify';
import { FaultKind } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { RELEASE_WORKER_VERSION } from '../boot/checks';
import { CAPTURE_WORKER_PROCESS_SETTINGS } from '../index';
import { SEALING_MAX_FRAGMENT_BYTES } from '../../sealing';

describe('what the capture protocol restates from the shared vocabulary', () => {
  it('the mic roles are exactly the shared MicRole, name by name', () => {
    expect(CaptureMicRole).toEqual(MicRole);
  });

  it('every warning code is a shared fault kind of the same name, and they are the two capture faults of schema v2', () => {
    const shared: Record<string, string> = FaultKind;
    for (const [name, value] of Object.entries(CaptureWarningCode)) expect(shared[name], name).toBe(value);
    // The last two of the shared list, in its order (`sim/vocabulary.ts`: appended for schema v2).
    expect(Object.values(CaptureWarningCode)).toEqual(Object.values(FaultKind).slice(-2));
  });
});

// Blueprint row 58: the C worker implements the protocol by hand (it cannot import the package).
// The numbers and words it restates are held equal to the package here, so that a message or a
// version "lands in the package and the worker together" (capture spec §B.2 R-4) or this fails.
describe('what the C capture worker restates from the protocol package and the contract', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../capture-worker');
  const source = (name: string): string => readFileSync(resolve(root, 'src', name), 'utf8');
  const header = source('worker.h');
  const define = (name: string): string | undefined => new RegExp(`^#define ${name} +(\\S+)`, 'm').exec(header)?.[1];
  const all = ['capture_worker.c', 'ipc.c', 'ingest.c', 'audio.c', 'sink.c', 'micwatch.c', 'anchor.c'].map(source).join('\n');

  it('the protocol version, the media port range, the longest frame and the audio format', () => {
    expect(define('CAPTURE_PROTOCOL_VERSION')).toBe(String(CAPTURE_PROTOCOL_VERSION));
    expect([define('CAPTURE_MEDIA_PORT_MIN'), define('CAPTURE_MEDIA_PORT_MAX')]).toEqual([String(CAPTURE_MEDIA_PORT_MIN), String(CAPTURE_MEDIA_PORT_MAX)]);
    expect(define('MAX_FRAME_CHARS')).toBe(String(CAPTURE_IPC_DEFAULTS.maxFrameChars));
    expect(define('SR')).toBe(String(CAPTURE_AUDIO_SAMPLE_RATE_HZ));
    expect(CAPTURE_AUDIO_CHANNELS).toBe(1);
    // Positive control: the reader finds a define that is there and none that is not.
    expect(define('AAC_FRAME')).toBe('1024');
    expect(define('NO_SUCH_DEFINE')).toBeUndefined();
  });

  it('every message type, record kind, ingest state, mic role and warning code the worker writes is one of the package', () => {
    const written = (key: string): string[] => [...new Set([...all.matchAll(new RegExp(`\\\\"${key}\\\\":\\\\"([A-Z_]+)\\\\"`, 'g'))].map((match) => match[1] ?? ''))].sort();
    expect(written('type')).toEqual(['ACK', 'CRASH', 'HEARTBEAT', 'HELLO', 'RECORD', 'TELEMETRY', 'WARNING']);
    expect(written('type').every((type) => (Object.values(WorkerMessageType) as string[]).includes(type))).toBe(true);
    // PROGRESS is the sealing rows': the worker of this row writes none.
    expect(written('type')).not.toContain(WorkerMessageType.PROGRESS);
    // Row 59: the fMP4 writer's checkpoint and the observed keyframe interval joined the two of row 58.
    // Row 71 (protocol version 4): the audio-source interval and the end of the audio timeline joined them.
    expect(written('kind')).toEqual(
      [CaptureRecordKind.AUDIO_SOURCE_INTERVAL, CaptureRecordKind.AUDIO_TIMELINE_END, CaptureRecordKind.FIRST_DURABLE_FRAGMENT, CaptureRecordKind.FIRST_VIDEO_SAMPLE, CaptureRecordKind.FRAGMENT_CHECKPOINT, CaptureRecordKind.KEYFRAME_INTERVAL].sort(),
    );
    for (const state of Object.values(CaptureIngestState)) expect(all, state).toContain(`"${state}"`);
    for (const role of Object.values(CaptureMicRole)) expect(all, role).toContain(`"${role}"`);
    expect(all).toContain(`send_warning("${CaptureWarningCode.CAPTURE_FAULT}"`);
  });

  // Blueprint row 71 (worker half): protocol version 4. What the worker restates of it is held here.
  it('version 4: every warning reason, interval reason and switch refusal the worker writes is one of the package, and each reason is written', () => {
    expect(CAPTURE_PROTOCOL_VERSION).toBe(4);
    const reasons = Object.values(CaptureWarningReason) as string[];
    // Every reason the package names is a literal of the worker's sources, and the mic warnings name their code.
    for (const reason of reasons) expect(all, reason).toContain(`"${reason}"`);
    expect(all).toContain(`"${CaptureWarningCode.MIC_SILENT}", "${CaptureWarningReason.MIC_LEVEL_BELOW_THRESHOLD}"`);
    expect(all).toContain(`"${CaptureWarningCode.CAPTURE_FAULT}", "${CaptureWarningReason.MIC_DISCONNECTED}"`);
    expect(all).toContain(`"${CaptureWarningCode.CAPTURE_FAULT}", "${CaptureWarningReason.MIC_RATE_AT_LIMIT}"`);
    expect(WARNING_REASONS_OF.MIC_SILENT).toEqual([CaptureWarningReason.MIC_LEVEL_BELOW_THRESHOLD]);
    // The frame itself: reason before state, a subject that is always a string, and no way to write a null one.
    expect(all).toContain('\\"code\\":\\"%s\\",\\"reason\\":\\"%s\\",\\"state\\":\\"%s\\",\\"subject\\":\\"%s\\"');
    expect(all).not.toContain('\\"subject\\":null');
    // Interval reasons: the start and the operator, nothing else.
    const intervalReasons = [...new Set([...all.matchAll(/\\"reason\\":\\"([A-Z_]+)\\",\\"correlationId\\"/g)].map((match) => match[1] ?? ''))].sort();
    expect(intervalReasons).toEqual(Object.values(AudioSourceIntervalReason).sort());
    // Switch refusals the worker acknowledges with are the package's list.
    for (const code of SWITCH_REFUSAL_CODES) expect(all, code).toContain(`"${code}`);
    // The input chunk and the switch bound.
    expect(define('QUANTUM')).toBe(String(CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES));
    expect(CAPTURE_SWITCH_BOUND_US).toBe(Math.floor((CAPTURE_AAC_FRAME_SAMPLES * 1_000_000) / CAPTURE_AUDIO_SAMPLE_RATE_HZ));
  });

  it('version 4: the named settings of a worker process - the worker\'s defaults, the package\'s defaults and the contract constants are one set of numbers', () => {
    expect(define('DEFAULT_INGEST_OPEN_WINDOW_MS')).toBe(String(CAPTURE_WORKER_SETTING_DEFAULTS.ingestOpenWindowMs));
    expect(define('DEFAULT_MIC_SILENCE_DBFS')).toBe(String(CAPTURE_WORKER_SETTING_DEFAULTS.micSilenceDbfs));
    expect(define('DEFAULT_MIC_SILENCE_MS')).toBe(String(CAPTURE_WORKER_SETTING_DEFAULTS.micSilenceDurationMs));
    expect(define('DEFAULT_MIC_DISCONNECT_MS')).toBe(String(CAPTURE_WORKER_SETTING_DEFAULTS.micDisconnectDebounceMs));
    // Capture spec §E.1: the three thresholds live in @dems/shared/api; the protocol package restates them.
    expect(CAPTURE_WORKER_SETTING_DEFAULTS.micSilenceDbfs).toBe(MIC_SILENCE_DBFS);
    expect(CAPTURE_WORKER_SETTING_DEFAULTS.micSilenceDurationMs).toBe(MIC_SILENCE_DURATION_MS);
    expect(CAPTURE_WORKER_SETTING_DEFAULTS.micDisconnectDebounceMs).toBe(MIC_DISCONNECT_DEBOUNCE_MS);
    // Every argument the package spells is one the worker reads.
    for (const rule of Object.values(CAPTURE_WORKER_SETTINGS)) expect(source('capture_worker.c'), rule.argument).toContain(`"${rule.argument}"`);
  });

  // Fix pass F-M3 (review R63-02; ruling D179): ONE number bounds a fragment - during the recording and at the seal.
  it('R63-02: the fragment size bound is ONE number - the verifier\'s, the seal\'s, the launcher\'s, the package\'s default and the worker\'s default', () => {
    expect(VERIFY_MAX_OPEN_FRAGMENT_BYTES).toBe(64 * 1024 * 1024);
    expect(SEALING_MAX_FRAGMENT_BYTES).toBe(VERIFY_MAX_OPEN_FRAGMENT_BYTES);
    // What the Core's launcher passes to every worker: the seal's bound, never the worker's own default.
    expect(CAPTURE_WORKER_PROCESS_SETTINGS.maxFragmentBytes).toBe(SEALING_MAX_FRAGMENT_BYTES);
    expect(CAPTURE_WORKER_SETTING_DEFAULTS.maxFragmentBytes).toBe(SEALING_MAX_FRAGMENT_BYTES);
    expect(define('DEFAULT_MAX_FRAGMENT_BYTES')).toBe(String(SEALING_MAX_FRAGMENT_BYTES));
    // The range a launcher may pass is the worker's: its floor and its compiled sanity cap (never below the seal's bound).
    expect(define('MIN_MAX_FRAGMENT_BYTES')).toBe(String(CAPTURE_WORKER_SETTINGS.maxFragmentBytes.min));
    expect(define('MAX_FRAGMENT_BYTES_CEILING')).toBe(String(CAPTURE_WORKER_SETTINGS.maxFragmentBytes.max));
    expect(CAPTURE_WORKER_SETTINGS.maxFragmentBytes.max).toBeGreaterThanOrEqual(SEALING_MAX_FRAGMENT_BYTES);
    // The writer refuses a larger fragment before it writes it, and the ingest closes the open one before it gets there.
    expect(source('sink.c')).toContain('if (s->max_fragment_bytes && len > s->max_fragment_bytes) return fail(s, "WRITER_FRAGMENT_TOO_LARGE", AVERROR(EFBIG));');
    expect(source('capture_worker.c')).toContain('cam->sink.max_fragment_bytes = (size_t)g_max_fragment_bytes;');
    expect(source('ingest.c')).toContain(`send_warning("${CaptureWarningCode.CAPTURE_FAULT}", "${CaptureWarningReason.FRAGMENT_SIZE_BOUND_REACHED}", 1, c->device_id);`);
    // Every video and every audio packet goes through the bounded write: the muxer is handed a packet nowhere else.
    expect([...source('ingest.c').matchAll(/av_write_frame\(c->out, [a-z]\)/g)]).toHaveLength(1);
    expect([...source('ingest.c').matchAll(/write_bounded_locked\(c, [a-z]\)/g)]).toHaveLength(2);
  });

  it('R63-04 / R63-06: the release worker names itself with a word of the allowlist, and a build with any proof switch does not', () => {
    const version = /^#define WORKER_VERSION "([^"]+)"/m.exec(header)?.[1] ?? '';
    expect(version).toMatch(RELEASE_WORKER_VERSION);
    expect(`${version}-PROOF`).not.toMatch(RELEASE_WORKER_VERSION);
    expect(source('ipc.c')).toContain('#define HELLO_WORKER_VERSION WORKER_VERSION "-PROOF"');
  });

  it('R63-07 / R63-09: the refusal of another libavformat and the sync level are the package\'s words', () => {
    expect(source('capture_worker.c')).toContain(`ipc_start(heartbeat_ms, "${LIBAVFORMAT_VERSION_MISMATCH}")`);
    for (const level of Object.values(CaptureSyncLevel)) expect(source('sink.c'), level).toContain(`"${level}"`);
    expect(source('ingest.c')).toContain('\\"syncLevel\\":\\"%s\\"');
  });

  it('the media-time origin is the AAC priming of the pinned mux flags: the contract constant follows the worker\'s flags', () => {
    const flags = /#define DEMS_MOVFLAGS "([^"]+)"/.exec(source('ingest.c'))?.[1] ?? '';
    expect(flags).toBe('+frag_keyframe+empty_moov+default_base_moof+skip_trailer');
    // empty_moov without delay_moov: no edit list, the priming is presented (capture spec §F, erratum PE-111-06).
    expect(CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES).toBe(flags.includes('delay_moov') ? 0 : Number(define('AAC_FRAME')));
    expect(CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES).toBe(1_024);
    // Row 78's request (D-77-6): the shared AAC frame length is the worker's define, not a second number.
    expect(CAPTURE_AAC_FRAME_SAMPLES).toBe(Number(define('AAC_FRAME')));
  });
});
