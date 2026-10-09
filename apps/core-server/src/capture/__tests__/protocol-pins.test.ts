// The two value sets `@dems/capture-protocol` restates from `@dems/shared` (fix round 1 of row 57,
// navigator finding F-8). The protocol package deliberately does not depend on the shared package
// (the C worker implements it by hand), so the Core server, which depends on both, holds them equal.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE_IPC_DEFAULTS, CAPTURE_MEDIA_PORT_MAX, CAPTURE_MEDIA_PORT_MIN, CAPTURE_PROTOCOL_VERSION, CaptureIngestState, CaptureMicRole, CaptureRecordKind, CaptureWarningCode, WorkerMessageType } from '@dems/capture-protocol';
import { CAPTURE_AUDIO_CHANNELS, CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES } from '@dems/shared/api';
import { MicRole } from '@dems/shared/domain';
import { FaultKind } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';

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
  const all = ['capture_worker.c', 'ipc.c', 'ingest.c', 'audio.c', 'sink.c'].map(source).join('\n');

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
    expect(written('kind')).toEqual([CaptureRecordKind.FIRST_DURABLE_FRAGMENT, CaptureRecordKind.FIRST_VIDEO_SAMPLE].sort());
    for (const state of Object.values(CaptureIngestState)) expect(all, state).toContain(`"${state}"`);
    for (const role of Object.values(CaptureMicRole)) expect(all, role).toContain(`"${role}"`);
    expect(all).toContain(`send_warning("${CaptureWarningCode.CAPTURE_FAULT}"`);
  });

  it('the media-time origin is the AAC priming of the pinned mux flags: the contract constant follows the worker\'s flags', () => {
    const flags = /#define DEMS_MOVFLAGS "([^"]+)"/.exec(source('ingest.c'))?.[1] ?? '';
    expect(flags).toBe('+frag_keyframe+empty_moov+default_base_moof+skip_trailer');
    // empty_moov without delay_moov: no edit list, the priming is presented (capture spec §F, erratum PE-111-06).
    expect(CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES).toBe(flags.includes('delay_moov') ? 0 : Number(define('AAC_FRAME')));
    expect(CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES).toBe(1_024);
  });
});
