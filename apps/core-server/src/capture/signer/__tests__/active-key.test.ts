// Task 4 row 225 (package X1-4; GATE SX-09 (a), (b), (e); UD-5): THE ACTIVE SIGNING KEY ID.
//
// Its own file: the existing cases of `signer.test.ts` and `signer-sync.test.ts` are not edited by
// this row - they are the proof that a store WITHOUT a pointer loads as it always did.
//
// EVERY KEY OF THIS FILE IS MADE BY THE TEST in a fresh directory of the temporary folder that
// `afterAll` removes (and asserts gone). No case names the repository's `.data/`. Nothing of a key
// is printed: the cases run with standard output, standard error and the console captured, and
// the capture is asserted EMPTY (the signer unit says nothing at all).
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_KEY_POINTER_NAME,
  CORE_EVIDENCE_SIGNING_KEY_ID,
  SignerError,
  SignerRefusal,
  activateSigningKey,
  activeSigningKeyId,
  loadSoftwareSigner,
  markSigningKeyCompromised,
  nextSigningKeyId,
  provisionSigningKey,
  readStoredCertificate,
  signingKeySeriesNumber,
} from '..';

const NOW = 1_792_000_000_000;
const UID = typeof process.getuid === 'function' ? process.getuid() : -1;
const FIRST = 'CORE-KEY-EVSIGN-01';
const SECOND = 'CORE-KEY-EVSIGN-02';
const THIRD = 'CORE-KEY-EVSIGN-03';

const roots: string[] = [];
/** A fresh store directory (0700) in a root of its own. */
function store(): { root: string; dir: string; pointer: string } {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row225-'));
  roots.push(root);
  const dir = join(root, 'signer');
  mkdirSync(dir, { mode: 0o700 });
  return { root, dir, pointer: join(dir, ACTIVE_KEY_POINTER_NAME) };
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  for (const root of roots) expect(() => lstatSync(root)).toThrow();
});

// NOTHING IS SAID. Every case runs with the three outputs captured; `afterEach` asserts the capture empty.
const said: string[] = [];
beforeEach(() => {
  said.length = 0;
  const capture = (chunk: unknown): boolean => {
    said.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('latin1'));
    return true;
  };
  vi.spyOn(process.stdout, 'write').mockImplementation(capture as typeof process.stdout.write);
  vi.spyOn(process.stderr, 'write').mockImplementation(capture as typeof process.stderr.write);
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void said.push(parts.map(String).join(' ')));
});
afterEach(() => {
  vi.restoreAllMocks();
  expect(said).toEqual([]);
});

/** The code and the key id of what `act` throws; fails when it does not throw a `SignerError`. */
function refusalOf(act: () => unknown): { code: string; keyId: string | null; message: string } {
  try {
    act();
  } catch (error) {
    if (error instanceof SignerError) return { code: error.code, keyId: error.keyId, message: error.message };
    throw error;
  }
  throw new Error('nothing was refused');
}
const codeOf = (act: () => unknown): string => refusalOf(act).code;
/** A pointer as a test plants it: the bytes and the mode stated, by name (a test may; the store never writes it this way). */
function plant(pointer: string, bytes: string | Buffer, mode = 0o600): void {
  writeFileSync(pointer, bytes, { mode });
  chmodSync(pointer, mode);
}
const names = (dir: string): string[] => readdirSync(dir).sort();

describe('SX-09 (a), (b): the one resolver of the active key id', () => {
  it('NO pointer = the first key id: the store loads exactly as before rotation existed', () => {
    expect(CORE_EVIDENCE_SIGNING_KEY_ID).toBe(FIRST);
    expect([signingKeySeriesNumber(FIRST), signingKeySeriesNumber('CORE-KEY-EVSIGN-99'), signingKeySeriesNumber('CORE-KEY-EVSIGN-00'), signingKeySeriesNumber('CORE-KEY-EVSIGN-100'), signingKeySeriesNumber('TEST-KEY-01')]).toEqual([1, 99, null, null, null]);
    const { root, dir } = store();
    // No store at all, an empty store, a store with the first key: the first id each time.
    expect(activeSigningKeyId({ dir: join(root, 'absent') })).toBe(FIRST);
    expect(activeSigningKeyId({ dir })).toBe(FIRST);
    expect(codeOf(() => loadSoftwareSigner({ dir, now: NOW }))).toBe(SignerRefusal.KEY_ABSENT);
    const certificate = provisionSigningKey({ dir, now: NOW });
    expect(activeSigningKeyId({ dir })).toBe(FIRST);
    const loaded = loadSoftwareSigner({ dir, now: NOW + 1 });
    expect([loaded.signer.keyId, loaded.certificate.keyId, loaded.certificate.sha256]).toEqual([FIRST, FIRST, certificate.sha256]);
    expect(readStoredCertificate({ dir }).sha256).toBe(certificate.sha256);
    // The resolver made nothing: no pointer was written by asking.
    expect(names(dir)).toEqual([`${FIRST}.crt`, `${FIRST}.p8`, `${FIRST}.wrap`]);
  });

  it('a pointer names the key that loads when no key id is handed in; the earlier key and certificate stay loadable by their id', () => {
    const { dir, pointer } = store();
    const first = provisionSigningKey({ dir, now: NOW });
    const second = provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    expect(first.sha256).not.toBe(second.sha256);
    activateSigningKey({ dir, keyId: SECOND, now: NOW + 1 });
    // The pointer: exactly the id and a line end, a private file of this user; nothing staged is left.
    expect(readFileSync(pointer, 'latin1')).toBe(`${SECOND}\n`);
    expect([lstatSync(pointer).mode & 0o7777, lstatSync(pointer).uid, lstatSync(pointer).isFile()]).toEqual([0o600, UID, true]);
    expect(names(dir)).toEqual([ACTIVE_KEY_POINTER_NAME, `${FIRST}.crt`, `${FIRST}.p8`, `${FIRST}.wrap`, `${SECOND}.crt`, `${SECOND}.p8`, `${SECOND}.wrap`].sort());

    expect(activeSigningKeyId({ dir })).toBe(SECOND);
    const loaded = loadSoftwareSigner({ dir, now: NOW + 2 });
    expect([loaded.signer.keyId, loaded.certificate.sha256]).toEqual([SECOND, second.sha256]);
    expect([readStoredCertificate({ dir }).keyId, readStoredCertificate({ dir }).sha256]).toEqual([SECOND, second.sha256]);
    // The earlier key is KEPT: by its id it loads and its certificate reads, unchanged.
    expect(loadSoftwareSigner({ dir, now: NOW + 2, keyId: FIRST }).certificate.sha256).toBe(first.sha256);
    expect(readStoredCertificate({ dir, keyId: FIRST }).sha256).toBe(first.sha256);
    // A pointer that names the first id in so many words is the first id (a valid pointer, not an absent one).
    const plain = store();
    provisionSigningKey({ dir: plain.dir, now: NOW });
    plant(plain.pointer, `${FIRST}\n`);
    expect(loadSoftwareSigner({ dir: plain.dir, now: NOW }).signer.keyId).toBe(FIRST);
  });

  it('a MALFORMED pointer refuses by the named code and never falls back to the first key - which is there and would load', () => {
    const { dir, pointer } = store();
    provisionSigningKey({ dir, now: NOW });
    provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    const malformed: Array<[string, string | Buffer]> = [
      ['empty', ''],
      ['a line end only', '\n'],
      ['no line end', SECOND],
      ['a carriage return', `${SECOND}\r\n`],
      ['two line ends', `${SECOND}\n\n`],
      ['two ids', `${FIRST}\n${SECOND}\n`],
      ['a space before', ` ${SECOND}\n`],
      ['a space after', `${SECOND} \n`],
      ['lower case', `${SECOND.toLowerCase()}\n`],
      ['place 00', 'CORE-KEY-EVSIGN-00\n'],
      ['three digits', 'CORE-KEY-EVSIGN-002\n'],
      ['one digit', 'CORE-KEY-EVSIGN-2\n'],
      ['an id outside the series', 'TEST-KEY-01\n'],
      ['a path', `../${SECOND}\n`],
      ['a zero byte', Buffer.concat([Buffer.from(SECOND), Buffer.from([0, 10])])],
      ['a byte outside ASCII', Buffer.concat([Buffer.from(SECOND), Buffer.from([0xc2, 0xa0, 10])])],
      ['JSON', `{"keyId":"${SECOND}"}\n`],
      ['larger than any stored file', Buffer.alloc(16 * 1024 + 1, 0x41)],
    ];
    for (const [what, bytes] of malformed) {
      rmSync(pointer, { force: true });
      plant(pointer, bytes);
      const resolved = refusalOf(() => activeSigningKeyId({ dir }));
      expect([resolved.code, resolved.keyId], what).toEqual([SignerRefusal.ACTIVE_KEY_POINTER_INVALID, null]);
      expect(codeOf(() => loadSoftwareSigner({ dir, now: NOW })), what).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      // The public read keeps its one code, and reads NO certificate - not the first key's either.
      expect(codeOf(() => readStoredCertificate({ dir })), what).toBe(SignerRefusal.CERTIFICATE_INVALID);
      // Neither a rotation step nor a provisioning goes on over a pointer it cannot take.
      expect(codeOf(() => nextSigningKeyId({ dir })), what).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      expect(codeOf(() => activateSigningKey({ dir, keyId: SECOND, now: NOW })), what).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      expect(codeOf(() => provisionSigningKey({ dir, now: NOW, keyId: THIRD })), what).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      // The refused pointer was not repaired, replaced or removed.
      expect(readFileSync(pointer).equals(Buffer.from(bytes)), what).toBe(true);
    }
    // CONTROL: the first key is there and loads the moment it is asked for by its id - the refusals above are the pointer's.
    expect(loadSoftwareSigner({ dir, now: NOW, keyId: FIRST }).signer.keyId).toBe(FIRST);
    expect(names(dir)).not.toContain(`${THIRD}.p8`);
  });

  it('a LINKED pointer, a pointer group or others can reach, and a pointer that is no file are refused; nothing behind a link is read', () => {
    const { root, dir, pointer } = store();
    provisionSigningKey({ dir, now: NOW });
    provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    // A link to a file that would be a perfectly good pointer; a link that leads nowhere; a link to the first key's own certificate.
    const elsewhere = join(root, 'elsewhere');
    plant(elsewhere, `${SECOND}\n`);
    for (const target of [elsewhere, join(root, 'nowhere'), join(dir, `${FIRST}.crt`)]) {
      rmSync(pointer, { force: true });
      symlinkSync(target, pointer);
      expect(codeOf(() => activeSigningKeyId({ dir })), target).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      expect(codeOf(() => loadSoftwareSigner({ dir, now: NOW })), target).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      expect(lstatSync(pointer).isSymbolicLink(), target).toBe(true);
    }
    rmSync(pointer, { force: true });
    // Every mode with a bit for group or others - readable is enough - is refused; owner-only modes are taken.
    for (const mode of [0o640, 0o604, 0o644, 0o660, 0o620, 0o602, 0o610, 0o601, 0o666, 0o777]) {
      plant(pointer, `${SECOND}\n`, mode);
      expect(codeOf(() => activeSigningKeyId({ dir })), mode.toString(8)).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      expect(codeOf(() => loadSoftwareSigner({ dir, now: NOW })), mode.toString(8)).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
      rmSync(pointer);
    }
    for (const mode of [0o600, 0o400]) {
      plant(pointer, `${SECOND}\n`, mode);
      expect(loadSoftwareSigner({ dir, now: NOW }).signer.keyId, mode.toString(8)).toBe(SECOND);
      rmSync(pointer);
    }
    // A directory in the pointer's place.
    mkdirSync(pointer, { mode: 0o700 });
    expect(codeOf(() => activeSigningKeyId({ dir }))).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
    expect(codeOf(() => loadSoftwareSigner({ dir, now: NOW }))).toBe(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
    rmSync(pointer, { recursive: true });
    // The store directory itself keeps the codes it always had, pointer or not (the directory is looked at first).
    plant(pointer, `${SECOND}\n`);
    chmodSync(dir, 0o750);
    expect(codeOf(() => activeSigningKeyId({ dir }))).toBe(SignerRefusal.KEY_MODE);
    expect(codeOf(() => loadSoftwareSigner({ dir, now: NOW }))).toBe(SignerRefusal.KEY_MODE);
    chmodSync(dir, 0o700);
    expect(codeOf(() => activeSigningKeyId({ dir, ownerUid: UID + 1 }))).toBe(SignerRefusal.KEY_MODE);
    const alias = join(root, 'alias');
    symlinkSync(dir, alias);
    expect(codeOf(() => activeSigningKeyId({ dir: alias }))).toBe(SignerRefusal.KEY_UNREADABLE);
    expect(codeOf(() => loadSoftwareSigner({ dir: alias, now: NOW }))).toBe(SignerRefusal.KEY_UNREADABLE);
  });

  it('a pointer to a key that is absent, compromised or expired refuses with that key\'s code and id: never another key', () => {
    const { dir, pointer } = store();
    const first = provisionSigningKey({ dir, now: NOW });
    plant(pointer, `${SECOND}\n`);
    expect(refusalOf(() => loadSoftwareSigner({ dir, now: NOW }))).toMatchObject({ code: SignerRefusal.KEY_ABSENT, keyId: SECOND });
    expect(codeOf(() => readStoredCertificate({ dir }))).toBe(SignerRefusal.CERTIFICATE_INVALID);
    rmSync(pointer);
    provisionSigningKey({ dir, now: NOW, keyId: SECOND, validityDays: 1 });
    activateSigningKey({ dir, keyId: SECOND, now: NOW });
    expect(refusalOf(() => loadSoftwareSigner({ dir, now: NOW + 2 * 86_400_000 }))).toMatchObject({ code: SignerRefusal.CERTIFICATE_NOT_VALID_NOW, keyId: SECOND });
    markSigningKeyCompromised({ dir, keyId: SECOND, at: NOW + 5 });
    expect(refusalOf(() => loadSoftwareSigner({ dir, now: NOW }))).toMatchObject({ code: SignerRefusal.KEY_COMPROMISED, keyId: SECOND });
    // The first key was not marked and still loads BY ITS ID - but it is not what the store answers with.
    expect(loadSoftwareSigner({ dir, now: NOW, keyId: FIRST }).certificate.sha256).toBe(first.sha256);
  });

  it('no refusal of the resolver holds a location, a file name of the store or a text of the operating system', () => {
    const { root, dir, pointer } = store();
    provisionSigningKey({ dir, now: NOW });
    const messages: string[] = [];
    plant(pointer, 'x\n');
    messages.push(refusalOf(() => activeSigningKeyId({ dir })).message, refusalOf(() => loadSoftwareSigner({ dir, now: NOW })).message);
    rmSync(pointer);
    symlinkSync(join(root, 'nowhere'), pointer);
    messages.push(refusalOf(() => activeSigningKeyId({ dir })).message);
    rmSync(pointer);
    plant(pointer, `${SECOND}\n`, 0o644);
    messages.push(refusalOf(() => activeSigningKeyId({ dir })).message);
    expect(messages).toEqual(Array(4).fill('ACTIVE_KEY_POINTER_INVALID'));
    for (const message of messages) {
      expect(message).not.toContain(root);
      expect(message).not.toMatch(/signer|ACTIVE\b(?!_)|ELOOP|ENOENT|EACCES|no such|symbolic/i);
    }
  });
});

describe('the pointer only moves forward, and only to a key that loads', () => {
  it('refused before anything is written: an id outside the series, the active id or an earlier one, a key that does not load, a staged file of that id', () => {
    const { dir, pointer } = store();
    provisionSigningKey({ dir, now: NOW });
    const before = names(dir);
    // Nothing of the second key is there yet.
    expect(refusalOf(() => activateSigningKey({ dir, keyId: SECOND, now: NOW }))).toMatchObject({ code: SignerRefusal.KEY_ABSENT, keyId: SECOND });
    expect(codeOf(() => activateSigningKey({ dir, keyId: 'TEST-KEY-02', now: NOW }))).toBe(SignerRefusal.KEY_ID_INVALID);
    expect(codeOf(() => activateSigningKey({ dir, keyId: FIRST, now: NOW }))).toBe(SignerRefusal.ACTIVE_KEY_NOT_NEWER);
    expect(codeOf(() => activateSigningKey({ dir: join(dir, 'absent'), keyId: SECOND, now: NOW }))).toBe(SignerRefusal.KEY_ABSENT);
    expect(names(dir)).toEqual(before);

    provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    provisionSigningKey({ dir, now: NOW + 60_000, keyId: THIRD });
    // The third key is not valid yet at this instant: it does not load, so the pointer does not name it.
    expect(codeOf(() => activateSigningKey({ dir, keyId: THIRD, now: NOW }))).toBe(SignerRefusal.CERTIFICATE_NOT_VALID_NOW);
    // A compromised key is never made active.
    markSigningKeyCompromised({ dir, keyId: SECOND, at: NOW });
    expect(codeOf(() => activateSigningKey({ dir, keyId: SECOND, now: NOW }))).toBe(SignerRefusal.KEY_COMPROMISED);
    expect(() => lstatSync(pointer)).toThrow();
    expect(activeSigningKeyId({ dir })).toBe(FIRST);

    activateSigningKey({ dir, keyId: THIRD, now: NOW + 60_000 });
    expect(activeSigningKeyId({ dir })).toBe(THIRD);
    // Back to an earlier id, or the same again: refused, the pointer as it was.
    for (const earlier of [FIRST, SECOND, THIRD]) expect(codeOf(() => activateSigningKey({ dir, keyId: earlier, now: NOW + 60_000 })), earlier).toBe(SignerRefusal.ACTIVE_KEY_NOT_NEWER);
    expect(readFileSync(pointer, 'latin1')).toBe(`${THIRD}\n`);

    // A staged file of the id (the leftover of an interrupted activation) is not written over.
    const fourth = 'CORE-KEY-EVSIGN-04';
    provisionSigningKey({ dir, now: NOW, keyId: fourth });
    const staged = join(dir, `${ACTIVE_KEY_POINTER_NAME}.${fourth}.next`);
    plant(staged, 'CORE-KEY-EV');
    expect(codeOf(() => activateSigningKey({ dir, keyId: fourth, now: NOW + 60_000 }))).toBe(SignerRefusal.KEY_EXISTS);
    expect([readFileSync(staged, 'latin1'), readFileSync(pointer, 'latin1')]).toEqual(['CORE-KEY-EV', `${THIRD}\n`]);
    expect(loadSoftwareSigner({ dir, now: NOW + 60_000 }).signer.keyId).toBe(THIRD);
  });
});

describe('SX-09 (e): a key id is never used for a second key', () => {
  it('provisioning refuses an id of which any entry is left, and an id at or before the pointer - also when its key files are gone', () => {
    const { dir } = store();
    const first = provisionSigningKey({ dir, now: NOW });
    provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    activateSigningKey({ dir, keyId: SECOND, now: NOW });

    // What an installer might do by hand in a store that has been rotated: remove the files of the first key. (The test removes its own synthetic key.)
    for (const extension of ['p8', 'wrap', 'crt']) rmSync(join(dir, `${FIRST}.${extension}`));
    expect(names(dir)).toEqual([ACTIVE_KEY_POINTER_NAME, `${SECOND}.crt`, `${SECOND}.p8`, `${SECOND}.wrap`].sort());
    expect(refusalOf(() => provisionSigningKey({ dir, now: NOW }))).toMatchObject({ code: SignerRefusal.KEY_EXISTS, keyId: FIRST });
    expect(refusalOf(() => provisionSigningKey({ dir, now: NOW, keyId: SECOND }))).toMatchObject({ code: SignerRefusal.KEY_EXISTS, keyId: SECOND });
    expect(names(dir)).toEqual([ACTIVE_KEY_POINTER_NAME, `${SECOND}.crt`, `${SECOND}.p8`, `${SECOND}.wrap`].sort());
    expect(first.keyId).toBe(FIRST);

    // Without a pointer: ANY entry of the id is enough - here a record alone (the note the production command writes).
    const noted = store();
    writeFileSync(join(noted.dir, `${FIRST}.provisioned.json`), '{}\n', { mode: 0o644 });
    expect(codeOf(() => provisionSigningKey({ dir: noted.dir, now: NOW }))).toBe(SignerRefusal.KEY_EXISTS);
    expect(names(noted.dir)).toEqual([`${FIRST}.provisioned.json`]);
    // CONTROL: an entry of ANOTHER id does not spend this one, and an id outside the series is unaffected by the pointer.
    expect(provisionSigningKey({ dir: noted.dir, now: NOW, keyId: SECOND }).keyId).toBe(SECOND);
    expect(provisionSigningKey({ dir, now: NOW, keyId: 'TEST-KEY-01' }).keyId).toBe('TEST-KEY-01');
  });

  // Task 4 row 226d (review 230 caution R-5): the two questions above look at entries of THAT id and at the pointer. A store
  // edited by hand - the pointer and every entry of an early id removed, copied away or renamed, a later id left - answered
  // "not spent", and a second key was made under an id that once named another.
  it('row 226d (R-5): in a store EDITED BY HAND - the pointer and every entry of the first id gone, a later id left - the first id is not given to a second key', () => {
    const { dir, pointer } = store();
    provisionSigningKey({ dir, now: NOW });
    provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    activateSigningKey({ dir, keyId: SECOND, now: NOW });
    // By hand: the pointer and the three files of the first key. (The test removes its own synthetic key.)
    rmSync(pointer);
    for (const extension of ['p8', 'wrap', 'crt']) rmSync(join(dir, `${FIRST}.${extension}`));
    const left = [`${SECOND}.crt`, `${SECOND}.p8`, `${SECOND}.wrap`].sort();
    expect(names(dir)).toEqual(left);
    // Without a pointer the resolver answers the first id - and that id is REFUSED to a second key: an entry of a later id is in the store.
    expect(activeSigningKeyId({ dir })).toBe(FIRST);
    expect(refusalOf(() => provisionSigningKey({ dir, now: NOW }))).toMatchObject({ code: SignerRefusal.KEY_EXISTS, keyId: FIRST });
    expect(names(dir)).toEqual(left);
    // The store goes on upwards only: the next id is the third, and it is provisioned.
    expect(nextSigningKeyId({ dir })).toBe(THIRD);
    expect(provisionSigningKey({ dir, now: NOW, keyId: THIRD }).keyId).toBe(THIRD);

    // ANY entry that names a later id of the series spends every id at or before it: a copied certificate, a mark, a record, a staged pointer.
    for (const entry of [`${THIRD}.crt`, `${THIRD}.compromised`, `${THIRD}.provisioned.json`, `${THIRD}.handover.txt`, `${ACTIVE_KEY_POINTER_NAME}.${THIRD}.next`, `copy of ${THIRD}.crt`]) {
      const edited = store();
      writeFileSync(join(edited.dir, entry), 'x\n', { mode: 0o644 });
      expect([FIRST, SECOND, THIRD].map((keyId) => codeOf(() => provisionSigningKey({ dir: edited.dir, now: NOW, keyId }))), entry).toEqual([SignerRefusal.KEY_EXISTS, SignerRefusal.KEY_EXISTS, SignerRefusal.KEY_EXISTS]);
      expect(names(edited.dir), entry).toEqual([entry]);
      // CONTROL: the id AFTER the one named is free.
      expect(nextSigningKeyId({ dir: edited.dir }), entry).toBe('CORE-KEY-EVSIGN-04');
    }

    // CONTROLS: a name that is no id of the series spends nothing - a longer number, another series, the bare pointer name.
    const other = store();
    for (const entry of ['CORE-KEY-EVSIGN-021.crt', 'TEST-KEY-05.crt', 'CORE-KEY-EVSIGN-.crt', 'notes.txt']) writeFileSync(join(other.dir, entry), 'x\n', { mode: 0o644 });
    expect(provisionSigningKey({ dir: other.dir, now: NOW }).keyId).toBe(FIRST);
    // CONTROL: an id OUTSIDE the series is not held to the series (the rule of before this row).
    expect(provisionSigningKey({ dir, now: NOW, keyId: 'TEST-KEY-02' }).keyId).toBe('TEST-KEY-02');
  });

  it('the next key id is the one after the highest the store has ever named - in an entry, a staged file or the pointer', () => {
    const { root, dir, pointer } = store();
    expect(nextSigningKeyId({ dir: join(root, 'absent') })).toBe(FIRST);
    expect(nextSigningKeyId({ dir })).toBe(FIRST);
    provisionSigningKey({ dir, now: NOW });
    expect(nextSigningKeyId({ dir })).toBe(SECOND);
    provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    // Provisioned and never activated: the id is spent all the same.
    expect(nextSigningKeyId({ dir })).toBe(THIRD);
    activateSigningKey({ dir, keyId: SECOND, now: NOW });
    expect(nextSigningKeyId({ dir })).toBe(THIRD);
    // A mark, a record or a staged file alone names an id.
    const marked = store();
    writeFileSync(join(marked.dir, 'CORE-KEY-EVSIGN-05.compromised'), '{}\n');
    expect(nextSigningKeyId({ dir: marked.dir })).toBe('CORE-KEY-EVSIGN-06');
    writeFileSync(join(marked.dir, `${ACTIVE_KEY_POINTER_NAME}.CORE-KEY-EVSIGN-08.next`), 'CORE');
    expect(nextSigningKeyId({ dir: marked.dir })).toBe('CORE-KEY-EVSIGN-09');
    // The pointer alone, every file of its key gone.
    const bare = store();
    plant(bare.pointer, 'CORE-KEY-EVSIGN-41\n');
    expect(nextSigningKeyId({ dir: bare.dir })).toBe('CORE-KEY-EVSIGN-42');
    // The end of the series.
    rmSync(pointer);
    plant(pointer, 'CORE-KEY-EVSIGN-99\n');
    expect(refusalOf(() => nextSigningKeyId({ dir }))).toMatchObject({ code: SignerRefusal.KEY_SERIES_EXHAUSTED, keyId: null });
  });
});
