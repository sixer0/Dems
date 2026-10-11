// Fix wave K Z1 (G94b-01, ruling D224 (1)): the segment index of the INDEXED VIEW, built from the
// signed manifest's fragment table. Pure. The tables are REAL ones (`real-fragment-tables.ts`: a
// clean and an interrupted recording the product sealed); the package of ONE camera is sealed here
// by the product pipeline. The box is read back by a reader of this file (ISO/IEC 14496-12 §8.16.3),
// written again so that the test does not prove the builder with the builder.
import { createHmac, randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createPackageReader } from '../../evidence-verify';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings } from '../../sealing/__tests__/pipeline-support';
import { SEEK_INDEX_MAX_REFERENCES, SeekIndexRefusal, buildSeekIndex, fileOffsetOfViewOffset, indexedViewSize, partsOfViewRange, type SeekIndexFragment } from '../seek-index';
import { planMediaFile, readIndexedView, readPlain } from '../source';
import { MediaTokenRefusal, issueMediaToken, readMediaToken, type MediaSessionMac } from '../token';
import { CLEAN_TABLES, INTERRUPTED_TABLES, rowsToFragments, type RealTable } from './real-fragment-tables';

afterAll(() => {
  removeRecordings();
  removePackages();
});

interface ReadBox {
  readonly size: number;
  readonly type: string;
  readonly version: number;
  readonly flags: number;
  readonly referenceId: number;
  readonly timescale: number;
  readonly earliest: bigint;
  readonly firstOffset: bigint;
  readonly reserved: number;
  readonly references: Array<{ readonly type: number; readonly size: number; readonly duration: number; readonly startsWithSap: number; readonly sapType: number; readonly sapDelta: number }>;
}

/** A `sidx` box, version 1, read member by member. */
function readSidx(bytes: Uint8Array): ReadBox {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(38);
  const references: ReadBox['references'] = [];
  for (let at = 0; at < count; at += 1) {
    const where = 40 + 12 * at;
    const first = view.getUint32(where);
    const third = view.getUint32(where + 8);
    references.push({ type: first >>> 31, size: first & 0x7fff_ffff, duration: view.getUint32(where + 4), startsWithSap: third >>> 31, sapType: (third >>> 28) & 0x7, sapDelta: third & 0x0fff_ffff });
  }
  return {
    size: view.getUint32(0),
    type: String.fromCharCode(...bytes.subarray(4, 8)),
    version: view.getUint8(8),
    flags: view.getUint32(8) & 0x00ff_ffff,
    referenceId: view.getUint32(12),
    timescale: view.getUint32(16),
    earliest: view.getBigUint64(20),
    firstOffset: view.getBigUint64(28),
    reserved: view.getUint16(36),
    references,
  };
}

const built = (table: RealTable) => {
  const result = buildSeekIndex(table.bytes, rowsToFragments(table));
  if (!result.ok) throw new Error(`no index: ${result.reason}`);
  return result.index;
};

const REAL: ReadonlyArray<readonly [string, RealTable]> = [...CLEAN_TABLES.map((table) => [`clean ${table.trackId}`, table] as const), ...INTERRUPTED_TABLES.map((table) => [`interrupted ${table.trackId}`, table] as const)];

describe('the index of a REAL fragment table', () => {
  it('the fixture is what it says: two clean and two interrupted tables, each with fragments', () => {
    expect(REAL.map(([name, table]) => [name, table.interrupted, table.rows.length > 5])).toEqual([
      ['clean VIDEO-01', false, true],
      ['clean VIDEO-02', false, true],
      ['interrupted VIDEO-01', true, true],
      ['interrupted VIDEO-02', true, true],
    ]);
  });

  it.each(REAL)('%s: one `sidx` box, version 1, in milliseconds, placed where the first fragment starts, one reference per fragment', (_name, table) => {
    const index = built(table);
    const box = readSidx(index.bytes);
    expect(index.at).toBe(table.rows[0]?.[1]);
    expect(index.references).toBe(table.rows.length);
    expect(index.bytes.byteLength).toBe(40 + 12 * table.rows.length);
    expect({ size: box.size, type: box.type, version: box.version, flags: box.flags, referenceId: box.referenceId, timescale: box.timescale, firstOffset: box.firstOffset, reserved: box.reserved, count: box.references.length }).toEqual({
      size: index.bytes.byteLength,
      type: 'sidx',
      version: 1,
      flags: 0,
      referenceId: 1,
      timescale: 1000,
      firstOffset: 0n,
      reserved: 0,
      count: table.rows.length,
    });
    expect(box.earliest).toBe(BigInt(table.rows[0]?.[3] ?? -1));
  });

  it.each(REAL)('%s: a player that walks the box lands on every fragment EXACTLY - its byte in the view and its start in the recording', (_name, table) => {
    const index = built(table);
    const box = readSidx(index.bytes);
    // The anchor of the first reference is the first byte behind the box (first_offset 0).
    let offset = index.at + index.bytes.byteLength;
    let time = Number(box.earliest);
    for (const [at, [, byteOffset, byteLength, mediaStartMs, , keyframe]] of table.rows.entries()) {
      const reference = box.references[at];
      // The view's offset of a fragment is its FILE offset plus the box: the request a seek makes maps back to it.
      expect([at, offset, time]).toEqual([at, byteOffset + index.bytes.byteLength, mediaStartMs]);
      expect(fileOffsetOfViewOffset(index, offset)).toBe(byteOffset);
      expect(reference).toMatchObject({ type: 0, size: byteLength, startsWithSap: keyframe, sapType: keyframe, sapDelta: 0 });
      offset += reference?.size ?? 0;
      time += reference?.duration ?? 0;
    }
    // The references are the whole of the file behind the init segment; the stream lasts what the track says.
    expect(offset).toBe(indexedViewSize(table.bytes, index));
    const last = table.rows[table.rows.length - 1];
    expect(time).toBe((last?.[3] ?? 0) + (last?.[4] ?? 0));
    expect(index.durationMs).toBe(time);
    expect(index.durationMs).toBe(table.durationMs);
  });

  it('an INTERRUPTED recording gets the index of the prefix that exists: as many references as sealed fragments, none beyond', () => {
    for (const table of INTERRUPTED_TABLES) {
      const index = built(table);
      expect(index.references).toBe(table.rows.length);
      expect(readSidx(index.bytes).references.reduce((sum, reference) => sum + reference.size, 0)).toBe(table.bytes - index.at);
    }
  });

  it('a seek target lands within ONE fragment: for 25 %, 50 % and 90 % the reference that holds the time starts at or before it and the next one after it', () => {
    for (const [, table] of REAL) {
      const index = built(table);
      const starts = table.rows.map((row) => row[3]);
      for (const share of [0.25, 0.5, 0.9]) {
        const target = Math.floor(index.durationMs * share);
        const holder = starts.filter((start) => start <= target).length - 1;
        expect(holder).toBeGreaterThanOrEqual(0);
        expect(starts[holder]).toBeLessThanOrEqual(target);
        expect(starts[holder + 1] ?? index.durationMs).toBeGreaterThan(target);
      }
    }
  });
});

describe('a table that yields no EXACT index states none (the client keeps its no-seek sentence)', () => {
  const table = CLEAN_TABLES[0] as RealTable;
  const fragments = (): SeekIndexFragment[] => rowsToFragments(table).map((fragment) => ({ ...fragment }));
  const edited = (edit: (rows: SeekIndexFragment[]) => void, bytes: number = table.bytes) => {
    const rows = fragments();
    edit(rows);
    return buildSeekIndex(bytes, rows);
  };

  it('CONTROL: the unedited table yields one', () => {
    expect(edited(() => undefined).ok).toBe(true);
  });

  it.each([
    ['no fragment at all', SeekIndexRefusal.NO_FRAGMENTS, () => edited((rows) => void rows.splice(0))],
    ['a first fragment at byte 0 (no init segment)', SeekIndexRefusal.NO_INIT_SEGMENT, () => buildSeekIndex(10, [{ seq: 1, byteOffset: 0, byteLength: 10, mediaStartMs: 0, mediaDurationMs: 2000, keyframe: true }])],
    ['a gap between two fragments', SeekIndexRefusal.FRAGMENTS_NOT_CONTIGUOUS, () => edited((rows) => void rows.splice(3, 1))],
    ['two fragments that overlap', SeekIndexRefusal.FRAGMENTS_NOT_CONTIGUOUS, () => edited((rows) => void (rows[2] = { ...(rows[2] as SeekIndexFragment), byteLength: (rows[2] as SeekIndexFragment).byteLength + 1 }))],
    ['bytes behind the last fragment', SeekIndexRefusal.FRAGMENTS_NOT_TO_END, () => edited(() => undefined, table.bytes + 17)],
    ['a last fragment past the end of the file', SeekIndexRefusal.FRAGMENTS_NOT_TO_END, () => edited(() => undefined, table.bytes - 1)],
    ['a start that does not ascend', SeekIndexRefusal.TIMES_NOT_ASCENDING, () => edited((rows) => void (rows[4] = { ...(rows[4] as SeekIndexFragment), mediaStartMs: (rows[3] as SeekIndexFragment).mediaStartMs }))],
    ['a length that is no whole number', SeekIndexRefusal.VALUE_OUT_OF_RANGE, () => edited((rows) => void (rows[1] = { ...(rows[1] as SeekIndexFragment), byteLength: 1.5 }))],
    ['a fragment longer than a reference can say', SeekIndexRefusal.VALUE_OUT_OF_RANGE, () => edited((rows) => void (rows[1] = { ...(rows[1] as SeekIndexFragment), byteLength: 2 ** 31 }))],
    ['a duration of 0', SeekIndexRefusal.VALUE_OUT_OF_RANGE, () => edited((rows) => void (rows[1] = { ...(rows[1] as SeekIndexFragment), mediaDurationMs: 0 }))],
    [
      'more fragments than one box holds',
      SeekIndexRefusal.TOO_MANY_FRAGMENTS,
      () =>
        buildSeekIndex(
          100 + SEEK_INDEX_MAX_REFERENCES + 1,
          Array.from({ length: SEEK_INDEX_MAX_REFERENCES + 1 }, (_, at) => ({ seq: at + 1, byteOffset: 100 + at, byteLength: 1, mediaStartMs: at * 2000, mediaDurationMs: 2000, keyframe: true })),
        ),
    ],
  ])('%s -> %s', (_name, reason, run) => {
    expect(run()).toEqual({ ok: false, reason });
  });

  it('the largest table a box holds is built (65 535 fragments)', () => {
    const rows = Array.from({ length: SEEK_INDEX_MAX_REFERENCES }, (_, at) => ({ seq: at + 1, byteOffset: 100 + at, byteLength: 1, mediaStartMs: at * 2000, mediaDurationMs: 2000, keyframe: true }));
    expect(buildSeekIndex(100 + SEEK_INDEX_MAX_REFERENCES, rows).ok).toBe(true);
  });
});

describe('a range of the VIEW is the file before the box, the box, the file behind it', () => {
  const file = Buffer.from(Array.from({ length: 400 }, (_, at) => at % 251));
  const fragmentsOf = [
    { seq: 1, byteOffset: 37, byteLength: 120, mediaStartMs: 0, mediaDurationMs: 2000, keyframe: true },
    { seq: 2, byteOffset: 157, byteLength: 143, mediaStartMs: 1990, mediaDurationMs: 2000, keyframe: true },
    { seq: 3, byteOffset: 300, byteLength: 100, mediaStartMs: 3980, mediaDurationMs: 1500, keyframe: false },
  ];
  const result = buildSeekIndex(file.byteLength, fragmentsOf);
  if (!result.ok) throw new Error(result.reason);
  const index = result.index;
  const view = Buffer.concat([file.subarray(0, index.at), index.bytes, file.subarray(index.at)]);

  it('every range of the view, byte for byte (all starts, a spread of lengths)', () => {
    expect(view.byteLength).toBe(indexedViewSize(file.byteLength, index));
    let checked = 0;
    for (let start = 0; start < view.byteLength; start += 1) {
      for (const length of [1, 2, 7, 36, 37, 76, 77, 150, view.byteLength]) {
        const end = Math.min(view.byteLength, start + length);
        const assembled = Buffer.concat(partsOfViewRange(index, { start, end }).map((part) => (part.kind === 'INDEX' ? Buffer.from(index.bytes.subarray(part.from, part.to)) : file.subarray(part.start, part.end))));
        if (!assembled.equals(view.subarray(start, end))) throw new Error(`range ${start}-${end} differs`);
        checked += 1;
      }
    }
    expect(checked).toBe(view.byteLength * 9);
  });

  it('an empty range has no part; a file offset is the view offset minus the box behind it, the box itself stands for its place', () => {
    expect(partsOfViewRange(index, { start: 50, end: 50 })).toEqual([]);
    expect([0, 36, 37, 38, 37 + index.bytes.byteLength, 38 + index.bytes.byteLength, view.byteLength].map((offset) => fileOffsetOfViewOffset(index, offset))).toEqual([0, 36, 37, 37, 37, 38, file.byteLength]);
  });

  it('a non-keyframe fragment is referenced without the sync mark', () => {
    expect(readSidx(index.bytes).references.map((reference) => reference.startsWithSap)).toEqual([1, 1, 0]);
  });
});

describe('a package of ONE camera, sealed by the product pipeline', () => {
  it('its one file has an index, and the indexed view without the box is the sealed plaintext', async () => {
    const recording = recordSession();
    rmSync(recording.recordingFile('VIDEO-02'));
    recording.tracks['VIDEO-02'].rows.length = 0;
    const h = harnessOf(recording);
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
    const anchors = h.anchors();
    const item = { evidenceId: anchors.evidenceId ?? '', sessionId: recording.sessionId, manifestSha256: anchors.manifestSha256 ?? '' };
    const ports = { reader: createPackageReader(recording.packageDir), opener: recording.opener };
    const plan = await planMediaFile(ports, item, 'VIDEO-01');
    expect(plan.seekIndexRefusal).toBeNull();
    const index = plan.seekIndex;
    if (index === null) throw new Error('the plan of the one camera file has no index');
    expect(index.references).toBe(plan.records.length);
    expect(index.at).toBe(plan.records[0]?.byteOffset);

    const pieces: Buffer[] = [];
    for await (const piece of readIndexedView(ports, plan, index, { start: 0, end: indexedViewSize(plan.size, index) })) pieces.push(piece);
    const view = Buffer.concat(pieces);
    const plain: Buffer[] = [];
    for await (const piece of readPlain(ports, plan, { start: 0, end: plan.size })) plain.push(piece);
    const whole = Buffer.concat(plain);
    expect(view.byteLength).toBe(whole.byteLength + index.bytes.byteLength);
    expect(view.subarray(index.at, index.at + index.bytes.byteLength).equals(Buffer.from(index.bytes))).toBe(true);
    expect(Buffer.concat([view.subarray(0, index.at), view.subarray(index.at + index.bytes.byteLength)]).equals(whole)).toBe(true);
  });
});

describe('the view is a claim of the token, under its MAC', () => {
  const KEY = randomBytes(32);
  const mac: MediaSessionMac = (message) => createHmac('sha256', KEY).update(message).digest();
  const NOW = 1_791_500_000_000;
  const HOLDER = { operatorId: 'OPR-001', sessionId: 'AS-000041' };
  const CLAIMS = { evidenceId: 'EV-20261009-0001', fileId: 'VIDEO-02', expiresAt: NOW + 60_000 } as const;
  const NONCE = Buffer.from('0102030405060708', 'hex');

  it('a token of the indexed view reads back `indexed: true`, is as long as a plain one, and a plain one states nothing (control)', () => {
    const indexed = issueMediaToken({ ...CLAIMS, indexed: true }, HOLDER, NONCE, mac);
    const plain = issueMediaToken(CLAIMS, HOLDER, NONCE, mac);
    expect(readMediaToken(indexed, HOLDER, NOW, mac)).toEqual({ ok: true, claims: { ...CLAIMS, indexed: true } });
    expect(readMediaToken(plain, HOLDER, NOW, mac)).toEqual({ ok: true, claims: CLAIMS });
    expect(readMediaToken(issueMediaToken({ ...CLAIMS, indexed: false }, HOLDER, NONCE, mac), HOLDER, NOW, mac)).toEqual({ ok: true, claims: CLAIMS });
    expect(indexed.length).toBe(plain.length);
    expect(indexed).not.toBe(plain);
  });

  it('a plain token whose view bit is set by hand does not verify, and neither does an indexed one whose bit is cleared', () => {
    const edit = (token: string): string => {
      const bytes = Buffer.from(token.slice(4), 'base64url');
      bytes[1] = (bytes[1] ?? 0) ^ 0x80;
      return `mts_${bytes.toString('base64url')}`;
    };
    const INVALID = { ok: false, refusal: MediaTokenRefusal.INVALID };
    expect(readMediaToken(edit(issueMediaToken(CLAIMS, HOLDER, NONCE, mac)), HOLDER, NOW, mac)).toEqual(INVALID);
    expect(readMediaToken(edit(issueMediaToken({ ...CLAIMS, indexed: true }, HOLDER, NONCE, mac)), HOLDER, NOW, mac)).toEqual(INVALID);
  });
});
