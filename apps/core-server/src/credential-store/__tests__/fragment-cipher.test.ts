// Per-fragment AES-256-GCM (blueprint row 84, M7-W3; capture spec §D.1 to §D.4; evidence spec §B.6;
// SEC35-10; hypothesis H-2). The module is fed typed inputs here: a synthetic camera file made of
// a clear header and sealed ranges. The fMP4 writer (row 59) and the sealing pipeline (row 82) are
// not there yet; nothing in this file is a recorded fragment.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CredentialStoreError, FragmentAuthenticationError } from '../errors';
import { keyMaterialOf } from '../key-material';
import {
  FRAGMENT_NONCE_BYTES,
  createFragmentSealer,
  fragmentAad,
  openFragment,
  planRangeRead,
  readDecryptedRange,
  type FragmentKey,
  type SealedFragmentRecord,
} from '../fragment-cipher';

const sessionKey = (fill: number, keyId = 'KID-SES-0001'): FragmentKey => ({ keyId, key: keyMaterialOf(Buffer.alloc(32, fill)) });
/** Bytes that depend on their position, so that a moved byte is a different byte. */
const pattern = (length: number, seed: number): Buffer => Buffer.from(Array.from({ length }, (_unused, index) => (index * 31 + seed * 17 + (index >> 8)) & 0xff));
const codeOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof CredentialStoreError ? error.code : `not a store error: ${String(error)}`;
  }
};

interface CameraFile {
  readonly plain: Buffer;
  readonly stored: Buffer;
  readonly records: SealedFragmentRecord[];
}

/** A clear header, then `lengths.length` sealed ranges, each followed by `gap` clear bytes. */
function cameraFile(key: FragmentKey, trackId: string, lengths: readonly number[], header = 48, gap = 0): CameraFile {
  const sealer = createFragmentSealer(key);
  const plainParts: Buffer[] = [pattern(header, 255)];
  const storedParts: Buffer[] = [pattern(header, 255)];
  const records: SealedFragmentRecord[] = [];
  let offset = header;
  lengths.forEach((length, index) => {
    const seq = index + 1;
    const plain = pattern(length, seq);
    const sealed = sealer.seal({ trackId, seq, byteOffset: offset }, plain);
    records.push({ trackId, seq, byteOffset: offset, byteLength: length, gcmIv: sealed.gcmIv, gcmTag: sealed.gcmTag, keyId: sealed.keyId });
    plainParts.push(plain, pattern(gap, 100 + seq));
    storedParts.push(Buffer.from(sealed.ciphertext), pattern(gap, 100 + seq));
    offset += length + gap;
  });
  return { plain: Buffer.concat(plainParts), stored: Buffer.concat(storedParts), records };
}

const rangeOf = (file: Buffer, record: SealedFragmentRecord): Buffer => file.subarray(Number(record.byteOffset), Number(record.byteOffset) + Number(record.byteLength));
/** Which fragments of a stored file fail to open: the tamper locator. */
function failing(key: FragmentKey, records: readonly SealedFragmentRecord[], stored: Buffer): Array<[string, number]> {
  const failed: Array<[string, number]> = [];
  for (const record of records) {
    try {
      openFragment(key, record, rangeOf(stored, record));
    } catch (error) {
      if (!(error instanceof FragmentAuthenticationError)) throw error;
      failed.push([error.trackId, error.seq]);
    }
  }
  return failed;
}

describe('sealing a range', () => {
  it('the ciphertext is as long as the plaintext and is not the plaintext; nonce and tag are in the record, not in the bytes', () => {
    const key = sessionKey(1);
    const file = cameraFile(key, 'VIDEO-01', [1000, 2048, 333]);
    expect(file.stored.byteLength).toBe(file.plain.byteLength);
    expect(file.stored.subarray(0, 48).equals(file.plain.subarray(0, 48))).toBe(true);
    for (const record of file.records) {
      expect(rangeOf(file.stored, record).equals(rangeOf(file.plain, record))).toBe(false);
      expect([record.gcmIv, record.gcmTag]).toEqual([expect.stringMatching(/^[0-9a-f]{24}$/), expect.stringMatching(/^[0-9a-f]{32}$/)]);
      expect(record.keyId).toBe('KID-SES-0001');
      expect(file.stored.includes(Buffer.from(record.gcmTag, 'hex'))).toBe(false);
      expect(Buffer.from(openFragment(key, record, rangeOf(file.stored, record))).equals(rangeOf(file.plain, record))).toBe(true);
    }
    expect(failing(key, file.records, file.stored)).toEqual([]);
  });

  it('the stored bytes are hashable without any key: the hash of the ciphertext is stable, the key plays no part', () => {
    const file = cameraFile(sessionKey(1), 'VIDEO-01', [512, 512]);
    const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
    expect(file.records.map((record) => digest(rangeOf(file.stored, record)))).toEqual(file.records.map((record) => digest(Buffer.from(rangeOf(file.stored, record)))));
    expect(digest(file.stored)).not.toBe(digest(file.plain));
  });
});

describe('H-2: tampering one encrypted fragment fails exactly that fragment', () => {
  const key = sessionKey(2);
  const file = cameraFile(key, 'VIDEO-01', [900, 900, 900, 900, 900]);

  it.each([1, 2, 3, 4, 5])('one flipped bit inside fragment %i: only that (trackId, seq) fails, every other fragment opens', (seq) => {
    const record = file.records[seq - 1]!;
    for (const at of [0, 449, 899]) {
      const stored = Buffer.from(file.stored);
      const index = Number(record.byteOffset) + at;
      stored[index] = (stored[index] ?? 0) ^ 0x01;
      expect(failing(key, file.records, stored), `byte ${at}`).toEqual([['VIDEO-01', seq]]);
    }
  });

  it('an altered tag or nonce of one record fails that fragment only; an untouched file fails nothing (control)', () => {
    const flip = (hex: string): string => `${hex[0] === '0' ? '1' : '0'}${hex.slice(1)}`;
    const withRecord = (seq: number, change: Partial<SealedFragmentRecord>): SealedFragmentRecord[] => file.records.map((record) => (record.seq === seq ? { ...record, ...change } : record));
    expect(failing(key, withRecord(3, { gcmTag: flip(file.records[2]!.gcmTag) }), file.stored)).toEqual([['VIDEO-01', 3]]);
    expect(failing(key, withRecord(4, { gcmIv: flip(file.records[3]!.gcmIv) }), file.stored)).toEqual([['VIDEO-01', 4]]);
    expect(failing(key, file.records, file.stored)).toEqual([]);
  });

  it('a clear byte outside every sealed range is not this module\'s to catch: no fragment fails (the stored-bytes hash does that)', () => {
    const stored = Buffer.from(file.stored);
    stored[10] = (stored[10] ?? 0) ^ 0xff;
    expect(failing(key, file.records, stored)).toEqual([]);
  });
});

describe('SEC35-10: the additional authenticated data binds a fragment to its position and key', () => {
  const key = sessionKey(3);
  const file = cameraFile(key, 'VIDEO-01', [700, 700, 700]);
  const [first, second] = [file.records[0]!, file.records[1]!];

  it('a ciphertext moved to another position, with its own nonce and tag, does not open', () => {
    // Two ranges of equal length swapped in the file, and their nonce and tag swapped with them.
    const stored = Buffer.from(file.stored);
    rangeOf(file.stored, second).copy(stored, Number(first.byteOffset));
    rangeOf(file.stored, first).copy(stored, Number(second.byteOffset));
    const records = [
      { ...first, gcmIv: second.gcmIv, gcmTag: second.gcmTag },
      { ...second, gcmIv: first.gcmIv, gcmTag: first.gcmTag },
      file.records[2]!,
    ];
    expect(failing(key, records, stored)).toEqual([['VIDEO-01', 1], ['VIDEO-01', 2]]);
  });

  it.each([
    ['another seq', { seq: 9 }],
    ['another byte offset', { byteOffset: Number(first.byteOffset) + 1 }],
    ['the other track', { trackId: 'VIDEO-02' }],
  ] as const)('a record that states %s for the same bytes does not open', (_label, change) => {
    expect(codeOf(() => openFragment(key, { ...first, ...change }, rangeOf(file.stored, first)))).toBe('FRAGMENT_AUTH_FAILED');
  });

  it('another key ID, or another key under the same ID, does not open', () => {
    expect(codeOf(() => openFragment(key, { ...first, keyId: 'KID-SES-0002' }, rangeOf(file.stored, first)))).toBe('FRAGMENT_AUTH_FAILED');
    expect(codeOf(() => openFragment(sessionKey(3, 'KID-SES-0002'), { ...first, keyId: 'KID-SES-0002' }, rangeOf(file.stored, first)))).toBe('FRAGMENT_AUTH_FAILED');
    expect(codeOf(() => openFragment(sessionKey(4), first, rangeOf(file.stored, first)))).toBe('FRAGMENT_AUTH_FAILED');
  });

  it('the encoding is canonical: different positions never give the same bytes, the same position always does', () => {
    const base = { trackId: 'VIDEO-01', seq: 1, byteOffset: 48, keyId: 'KID-SES-0001' };
    const variants = [base, { ...base, seq: 2 }, { ...base, byteOffset: 49 }, { ...base, trackId: 'VIDEO-02' }, { ...base, keyId: 'KID-SES-0002' }, { ...base, trackId: 'VIDEO-0', keyId: '1KID-SES-0001' }, { ...base, seq: 48, byteOffset: 1 }];
    expect(new Set(variants.map((position) => fragmentAad(position).toString('hex'))).size).toBe(variants.length);
    expect(fragmentAad(base).equals(fragmentAad({ ...base, byteOffset: 48n }))).toBe(true);
    expect(fragmentAad(base).toString('hex')).toBe(
      `${Buffer.from('dems.fragment-aad/1\u0000').toString('hex')}0008${Buffer.from('VIDEO-01').toString('hex')}00000000000000010000000000000030000c${Buffer.from('KID-SES-0001').toString('hex')}`,
    );
    for (const bad of [{ ...base, seq: 0 }, { ...base, seq: 1.5 }, { ...base, byteOffset: -1 }, { ...base, trackId: '' }, { ...base, keyId: 'a b' }]) expect(codeOf(() => fragmentAad(bad))).toBe('FRAGMENT_INPUT_INVALID');
  });
});

describe('the nonce: unique per (key, fragment)', () => {
  it('2000 fragments under one key have 2000 different nonces, also when one position is sealed again', () => {
    const sealer = createFragmentSealer(sessionKey(5));
    const nonces = new Set<string>();
    for (let seq = 1; seq <= 1000; seq += 1) {
      nonces.add(sealer.seal({ trackId: 'VIDEO-01', seq, byteOffset: seq * 100 }, pattern(64, seq)).gcmIv);
      nonces.add(sealer.seal({ trackId: 'VIDEO-01', seq, byteOffset: seq * 100 }, pattern(64, seq)).gcmIv);
    }
    expect([nonces.size, sealer.sealed()]).toEqual([2000, 2000]);
  });

  it('a random source that repeats itself encrypts nothing the second time (NONCE_REUSED)', () => {
    const fixed = Buffer.alloc(FRAGMENT_NONCE_BYTES, 0x5a);
    const sealer = createFragmentSealer(sessionKey(5), { randomNonce: () => fixed });
    expect(sealer.seal({ trackId: 'VIDEO-01', seq: 1, byteOffset: 0 }, pattern(64, 1)).gcmIv).toBe(fixed.toString('hex'));
    expect(codeOf(() => sealer.seal({ trackId: 'VIDEO-01', seq: 2, byteOffset: 64 }, pattern(64, 2)))).toBe('FRAGMENT_NONCE_REUSED');
    expect(codeOf(() => sealer.seal({ trackId: 'VIDEO-02', seq: 1, byteOffset: 0 }, pattern(64, 3)))).toBe('FRAGMENT_NONCE_REUSED');
    expect(sealer.sealed()).toBe(1);
    expect(codeOf(() => createFragmentSealer(sessionKey(5), { randomNonce: () => new Uint8Array(8) }).seal({ trackId: 'VIDEO-01', seq: 1, byteOffset: 0 }, pattern(8, 1)))).toBe('FRAGMENT_INPUT_INVALID');
  });

  it('refuses an empty range, a stored range of another length and a malformed nonce or tag', () => {
    const key = sessionKey(5);
    const file = cameraFile(key, 'VIDEO-01', [100]);
    const record = file.records[0]!;
    expect(codeOf(() => createFragmentSealer(key).seal({ trackId: 'VIDEO-01', seq: 1, byteOffset: 0 }, new Uint8Array(0)))).toBe('FRAGMENT_INPUT_INVALID');
    expect(codeOf(() => openFragment(key, record, rangeOf(file.stored, record).subarray(1)))).toBe('FRAGMENT_INPUT_INVALID');
    expect(codeOf(() => openFragment(key, { ...record, gcmIv: 'zz' }, rangeOf(file.stored, record)))).toBe('FRAGMENT_INPUT_INVALID');
    expect(codeOf(() => openFragment(key, { ...record, gcmTag: record.gcmTag.slice(2) }, rangeOf(file.stored, record)))).toBe('FRAGMENT_INPUT_INVALID');
  });
});

describe('§D.4: a byte range needs whole fragments', () => {
  const key = sessionKey(6);
  const file = cameraFile(key, 'VIDEO-01', [400, 400, 400, 400], 48, 8);
  const reads: Array<[number, number]> = [];
  const read = (stored: Buffer) => (offset: number, length: number): Uint8Array => {
    reads.push([offset, length]);
    return stored.subarray(offset, offset + length);
  };

  it('plans the clear bytes as stored and each touched fragment whole, with the slice wanted inside it', () => {
    // The file: header [0,48), F1 [48,448), gap, F2 [456,856), gap, F3 [864,1264), gap, F4 [1272,1672), gap to 1680.
    expect(file.records.map((record) => record.byteOffset)).toEqual([48, 456, 864, 1272]);
    const plan = planRangeRead(file.records, { start: 500, end: 900 });
    expect(plan.map((segment) => (segment.kind === 'CLEAR' ? ['CLEAR', segment.start, segment.end] : ['FRAGMENT', segment.record.seq, segment.from, segment.to]))).toEqual([
      ['FRAGMENT', 2, 44, 400],
      ['CLEAR', 856, 864],
      ['FRAGMENT', 3, 0, 36],
    ]);
    expect(planRangeRead(file.records, { start: 0, end: 50 }).map((segment) => segment.kind)).toEqual(['CLEAR', 'FRAGMENT']);
    expect(planRangeRead(file.records, { start: 1670, end: 1680 }).map((segment) => segment.kind)).toEqual(['FRAGMENT', 'CLEAR']);
    expect(planRangeRead([], { start: 5, end: 9 })).toEqual([{ kind: 'CLEAR', start: 5, end: 9 }]);
  });

  it('every range of the file decrypts to the same bytes of the plaintext, reading whole fragments only', async () => {
    for (const [start, end] of [[0, 1680], [0, 48], [48, 49], [447, 457], [500, 900], [600, 601], [1271, 1680], [860, 870]] as const) {
      reads.length = 0;
      const bytes = await readDecryptedRange({ sessionKey: key, records: file.records, range: { start, end }, read: read(file.stored) });
      expect(Buffer.from(bytes).equals(file.plain.subarray(start, end)), `${start}-${end}`).toBe(true);
      // A read that touches a fragment is the whole fragment, never a part of it.
      for (const [offset, length] of reads) {
        const inside = file.records.find((record) => offset >= Number(record.byteOffset) && offset < Number(record.byteOffset) + 400);
        if (inside !== undefined) expect([offset, length]).toEqual([inside.byteOffset, 400]);
      }
    }
  });

  it('a tampered fragment inside the range gives no byte at all; a range that does not touch it is served', async () => {
    const stored = Buffer.from(file.stored);
    stored[900] = (stored[900] ?? 0) ^ 0x01;
    await expect(readDecryptedRange({ sessionKey: key, records: file.records, range: { start: 500, end: 870 }, read: read(stored) })).rejects.toMatchObject({ code: 'FRAGMENT_AUTH_FAILED', trackId: 'VIDEO-01', seq: 3 });
    const untouched = await readDecryptedRange({ sessionKey: key, records: file.records, range: { start: 500, end: 860 }, read: read(stored) });
    expect(Buffer.from(untouched).equals(file.plain.subarray(500, 860))).toBe(true);
  });

  it('key loss: without the session key nothing is decrypted (no escrow), and a wrong key is refused', async () => {
    const request = { records: file.records, range: { start: 48, end: 100 }, read: read(file.stored) };
    await expect(readDecryptedRange({ ...request, sessionKey: sessionKey(7) })).rejects.toMatchObject({ code: 'FRAGMENT_AUTH_FAILED' });
  });

  it('refuses an empty or backwards range, overlapping records and a short read', async () => {
    expect(codeOf(() => planRangeRead(file.records, { start: 10, end: 10 }))).toBe('FRAGMENT_RANGE_INVALID');
    expect(codeOf(() => planRangeRead(file.records, { start: -1, end: 10 }))).toBe('FRAGMENT_RANGE_INVALID');
    expect(codeOf(() => planRangeRead([file.records[1]!, file.records[0]!], { start: 0, end: 1680 }))).toBe('FRAGMENT_RANGE_INVALID');
    expect(codeOf(() => planRangeRead([file.records[0]!, { ...file.records[1]!, byteOffset: 447 }], { start: 0, end: 1680 }))).toBe('FRAGMENT_RANGE_INVALID');
    await expect(readDecryptedRange({ sessionKey: key, records: file.records, range: { start: 0, end: 48 }, read: () => new Uint8Array(3) })).rejects.toMatchObject({ code: 'FRAGMENT_RANGE_INVALID' });
  });
});
