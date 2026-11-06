// Blueprint row 76 Verification — "both backends return the identical document shape on the
// fixture": the two results the REAL runs left in their run directories are compared. Run after
// `test:real:cpu-local` and `test:real:omlx-server`; a missing result is a failure, never a skip.
//
// WHAT PROVES IT (fix round 1, N-11). "Identical shape" is proven by the ONE strict schema: both
// results parse under it, and it rejects one member more or one mandatory member less (the first
// test shows the schema rejecting). What two schema-valid results may still differ in is stated by
// `resultShape`: only the QA members of a segment. That difference is REAL between the two engines
// (4 keys against 10) and is asserted here, not hidden.
//
// Run:  npm run test:real:shape -w @dems/transcriber
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TWO_SPEAKER_SCRIPT } from '../../src/fixtures/tts-fixture-provider';
import { MANDATORY_SEGMENT_KEYS, QA_SEGMENT_KEYS, TranscribeResultSchema, optionalSegmentKeys, resultShape, type TranscribeResult } from '../../src/types';
import { createRunDir, latestRunWith, writeEvidence } from './real-support';

function load(name: string): { result: TranscribeResult; run: string; raw: unknown } {
  const run = latestRunWith(name);
  if (run === null) throw new Error(`no real run has left ${name}: run the two real backend tests first`);
  const raw: unknown = JSON.parse(readFileSync(join(run, name), 'utf8'));
  return { result: TranscribeResultSchema.parse(raw), run, raw };
}

describe('both real backends on the sealed fixture: one strict schema', () => {
  const cpu = load('cpu-local.result.json');
  const server = load('omlx-server.result.json');

  it('the schema can fail: each real result with one member more, or one mandatory member less, is rejected', () => {
    for (const { raw } of [cpu, server]) {
      const value = raw as Record<string, unknown> & { segments: Record<string, unknown>[] };
      expect(TranscribeResultSchema.safeParse(value).success).toBe(true);
      expect(TranscribeResultSchema.safeParse({ ...value, duration: 1 }).success).toBe(false);
      expect(TranscribeResultSchema.safeParse({ ...value, segments: value.segments.map((segment) => ({ ...segment, speaker: 'A' })) }).success).toBe(false);
      for (const key of MANDATORY_SEGMENT_KEYS) {
        const segments = value.segments.map((segment, index) => (index === 0 ? Object.fromEntries(Object.entries(segment).filter(([name]) => name !== key)) : segment));
        expect(TranscribeResultSchema.safeParse({ ...value, segments }).success).toBe(false);
      }
      for (const key of ['engine', 'model', 'language', 'text', 'segments']) {
        expect(TranscribeResultSchema.safeParse(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))).success).toBe(false);
      }
    }
  });

  it('both real results pass it; the top level is the same; the segments differ in QA members only', () => {
    expect(cpu.result.engine).toBe('cpu-local');
    expect(server.result.engine).toBe('omlx-server');
    const cpuShape = resultShape(cpu.result);
    const serverShape = resultShape(server.result);
    expect(cpuShape.top).toEqual(['engine', 'language', 'model', 'segments', 'text']);
    expect(serverShape.top).toEqual(cpuShape.top);
    expect(cpuShape.segmentKeys).toEqual([...MANDATORY_SEGMENT_KEYS]);
    // The helper is able to differ, and here it does: this is the allowed difference, spelled out.
    expect(serverShape).not.toEqual(cpuShape);
    expect(optionalSegmentKeys(cpuShape)).toEqual([]);
    expect(optionalSegmentKeys(serverShape)).toEqual(['avgLogprob', 'compressionRatio', 'noSpeechProb', 'seek', 'temperature', 'tokens']);
    for (const key of optionalSegmentKeys(serverShape)) expect(QA_SEGMENT_KEYS).toContain(key);
    for (const { result } of [cpu, server]) {
      expect(result.language).toBe('id');
      expect(result.segments.length).toBeGreaterThanOrEqual(TWO_SPEAKER_SCRIPT.length);
      for (const [index, segment] of result.segments.entries()) {
        expect(segment.id).toBe(index);
        for (const key of MANDATORY_SEGMENT_KEYS) expect(key in segment).toBe(true);
      }
    }

    writeEvidence(createRunDir('shape'), 'shape.evidence.json', {
      check: 'row 76 identical document shape on the sealed fixture: one strict schema; QA members are the only difference',
      cpuLocalRun: cpu.run,
      omlxServerRun: server.run,
      bothParseUnderTheStrictSchema: true,
      topLevelKeys: cpuShape.top,
      cpuLocalSegmentKeys: cpuShape.segmentKeys,
      omlxServerSegmentKeys: serverShape.segmentKeys,
      differenceIsQaMembersOnly: optionalSegmentKeys(serverShape).every((key) => (QA_SEGMENT_KEYS as readonly string[]).includes(key)),
      cpuLocalSegments: cpu.result.segments.length,
      omlxServerSegments: server.result.segments.length,
    });
  });
});
