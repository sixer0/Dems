// Task 4 row 226 (package X1-4; SX-09 (e); R-X1-1 to R-X1-8 for the new key; UD-5): the commands
// `evidence:rotate-key` and `evidence:mark-compromised`.
//
// EVERY KEY OF THIS FILE IS MADE BY THE TEST, in a fresh directory of the temporary folder that the
// test removes (also after a failure: `afterAll`, which asserts each root gone). No case names the
// repository's `.data/` or a default data directory; the organisation of a test key is one fixed,
// obviously synthetic text. The first key of a scene is made by the REAL production key command
// (row 206), so a rotation starts from the store a production installation has.
//
// THE ONE DOUBLE OF THE FILE SYSTEM is row 206's: the directories ABOVE the test's own root
// (`aboveIsSound`; the temporary folder of this host lies below a directory every user may write).
// The root and everything below it is the file system as it is.
import { createPrivateKey } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { inspect as show } from 'node:util';
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { COMPROMISED_WORD, MarkCompromisedRefusal, runMarkCompromisedCommand, type MarkCompromisedRun } from '../../../cli/mark-compromised-command';
import { terminalPorts } from '../../../cli/production-key';
import { PROVISION_WORD, ProductionKeyRefusal, runProductionKeyCommand, type EntryFacts, type ProductionKeyPorts } from '../../../cli/production-key-command';
import { ROTATE_WORD, RotateKeyRefusal, handoverRecordNameOf, provisioningRecordNameOf, runRotateKeyCommand, type RotateKeyRun } from '../../../cli/rotate-key-command';
import { WORKSPACE, isProductionSource, readTree } from '../../../test/static/scan';
import { ACTIVE_KEY_POINTER_NAME, SignerError, activeSigningKeyId, loadSoftwareSigner, markSigningKeyCompromised, readStoredCertificate, verifyEd25519 } from '../../capture';
import { CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, runCaptureBootChecks, storedSigningKeyReaders, type CaptureBootDeps } from '../../capture/boot';
import { ReservedInstallationId } from '../../capture/boot/checks';
import { captureOperationDecisionOf } from '../../capture/fence/operation';
import { isDevelopmentSigningCertificate, loadSealingSigner, provisionDevelopmentSigningKey } from '../signing';

const NOW = 1_792_300_000_000;
const UID = typeof process.getuid === 'function' ? process.getuid() : -1;
const SERVER_UID = 501;
/** One fixed, obviously synthetic organisation (SX-19) and two installations. */
const ORGANISATION = 'SYNTHETIC TEST ORG - NOT AN INSTALLATION';
const INSTALLATION = 'DEMS-TEST-226';
const FIRST = 'CORE-KEY-EVSIGN-01';
const SECOND = 'CORE-KEY-EVSIGN-02';
const THIRD = 'CORE-KEY-EVSIGN-03';
const subjectOf = (keyId: string, installation = INSTALLATION): string => `CN=${keyId},OU=Evidence signing ${installation},O=${ORGANISATION}`;

const roots: string[] = [];
/** A fresh root of this test, with an empty data directory in it. */
function scene(): { root: string; dataDir: string; signer: string } {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row226-'));
  roots.push(root);
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return { root, dataDir, signer: join(dataDir, 'signer') };
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  for (const root of roots) expect(() => lstatSync(root)).toThrow();
});
afterEach(() => vi.restoreAllMocks());

const real = (path: string): EntryFacts | null => {
  try {
    const status = lstatSync(path);
    return { kind: status.isSymbolicLink() ? 'link' : status.isDirectory() ? 'directory' : status.isFile() ? 'file' : 'other', ownerUid: status.uid, mode: status.mode & 0o7777 };
  } catch {
    return null;
  }
};
/** Row 206's double: only the steps ABOVE `root` are stated; the root and what is below it are read. */
const aboveIsSound =
  (root: string) =>
  (path: string): EntryFacts | null =>
    root !== path && (path === sep || root.startsWith(`${path}${sep}`)) ? { kind: 'directory', ownerUid: 0, mode: 0o755 } : real(path);

/** The ports of a run: typed lines, a clock that may be stated per read, the stated ancestors. */
function portsOf(root: string, typed: ReadonlyArray<string | null>, overrides: Partial<ProductionKeyPorts> = {}, onAsk: (prompt: string) => void = () => undefined): { ports: ProductionKeyPorts; prompts: string[]; out: string[] } {
  const answers = [...typed];
  const prompts: string[] = [];
  const out: string[] = [];
  return {
    prompts,
    out,
    ports: {
      now: () => NOW,
      uid: () => UID,
      out: (line) => void out.push(line),
      ask: async (prompt) => {
        prompts.push(prompt);
        onAsk(prompt);
        return answers.length === 0 ? null : (answers.shift() ?? null);
      },
      inspect: aboveIsSound(root),
      ...overrides,
    },
  };
}
const ROTATE = [ORGANISATION, INSTALLATION, ROTATE_WORD];
async function rotate(root: string, dataDir: string, typed: ReadonlyArray<string | null> = ROTATE, overrides: Partial<ProductionKeyPorts> = {}, onAsk?: (prompt: string) => void): Promise<{ run: RotateKeyRun; prompts: string[]; out: string[] }> {
  const { ports, prompts, out } = portsOf(root, typed, overrides, onAsk);
  return { run: await runRotateKeyCommand(['--data-dir', dataDir], ports), prompts, out };
}
async function mark(root: string, dataDir: string, keyId: string, typed: ReadonlyArray<string | null> = [COMPROMISED_WORD], overrides: Partial<ProductionKeyPorts> = {}): Promise<{ run: MarkCompromisedRun; prompts: string[]; out: string[] }> {
  const { ports, prompts, out } = portsOf(root, typed, overrides);
  return { run: await runMarkCompromisedCommand(['--data-dir', dataDir, '--key-id', keyId], ports), prompts, out };
}
/** A production installation: the first key, made by the production key command of row 206. */
async function installed(): Promise<{ root: string; dataDir: string; signer: string }> {
  const made = scene();
  const { ports } = portsOf(made.root, [ORGANISATION, INSTALLATION, PROVISION_WORD]);
  const run = await runProductionKeyCommand(['--data-dir', made.dataDir], ports);
  expect([run.code, run.refusal]).toEqual([0, null]);
  return made;
}

/** Every entry below a directory: its kind, its mode and, for a file, its bytes. Links are not followed. */
function tree(directory: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    const status = lstatSync(path);
    const mode = (status.mode & 0o7777).toString(8);
    if (status.isSymbolicLink()) found.push(`${prefix}${name} link`);
    else if (status.isDirectory()) found.push(`${prefix}${name}/ ${mode}`, ...tree(path, `${prefix}${name}/`));
    else found.push(`${prefix}${name} ${mode} ${readFileSync(path).toString('hex')}`);
  }
  return found;
}
const modeOf = (path: string): number => lstatSync(path).mode & 0o777;
const names = (directory: string): string[] => readdirSync(directory).sort();
const codeOf = (act: () => unknown): string => {
  try {
    act();
    return 'loads';
  } catch (error) {
    return error instanceof SignerError ? error.code : 'NOT A SIGNER CODE';
  }
};

/** A REAL_PRODUCTION start in which every check but 4 and 4b passes by statement; 4 and 4b are the boot unit's own readers on this store. */
async function productionStart(dataDir: string): Promise<string> {
  const readers = storedSigningKeyReaders();
  const directory = join(dataDir, 'signer');
  const directories = [{ ownerUid: 0, mode: 0o755 }, { ownerUid: SERVER_UID, mode: 0o755 }];
  const deps: CaptureBootDeps = {
    decision: captureOperationDecisionOf({ captureMode: 'real', demoControls: false, captureDevSources: false, host: '127.0.0.1' }),
    workerProgram: '/opt/dems/capture-worker',
    inspect: () => ({ absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: SERVER_UID, mode: 0o755 }, directoriesAsWritten: directories, directoriesResolved: directories, serverUid: SERVER_UID }),
    probeEvidenceVolume: () => ({ absolute: true, present: true, directory: true, ownerUid: SERVER_UID, mode: 0o700, serverUid: SERVER_UID, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true, totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 }),
    signingKeyProblem: () => readers.problem(directory, NOW),
    signingKeyIsDevelopment: () => readers.isDevelopment(directory, NOW),
    demoPasswordOperators: async () => 0,
    handshake: async () => ({ outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION }),
    sinks: { info: () => undefined, warn: () => undefined, error: () => undefined, persist: () => undefined },
  };
  return runCaptureBootChecks(deps).then(
    (outcome) => `STARTS ${outcome.operation}`,
    (error: unknown) => (error instanceof CaptureBootError ? `REFUSED ${error.code} ${String(error.reason)}` : 'ANOTHER ERROR'),
  );
}
const KEY_REFUSED = `REFUSED ${CaptureBootRefusal.SIGNING_KEY_UNUSABLE}`;

describe('evidence:rotate-key makes the next key the active one and keeps the earlier one (X1-4)', () => {
  it('after a rotation the active id is the new one, both certificates exist and the earlier key files are byte-identical', async () => {
    const { root, dataDir, signer } = await installed();
    const before = tree(dataDir);
    const first = loadSealingSigner({ dataDir, now: NOW }).certificate;
    expect([first.keyId, await productionStart(dataDir)]).toEqual([FIRST, 'STARTS REAL_PRODUCTION']);

    let treeWhenAsked: string[] | null = null;
    const { run, prompts, out } = await rotate(root, dataDir, ROTATE, {}, (prompt) => {
      if (prompt.includes(ROTATE_WORD)) treeWhenAsked = tree(dataDir);
    });
    expect(run.lines.filter((line) => line.startsWith('evidence:rotate-key: '))).toEqual([
      `evidence:rotate-key: the active key is ${FIRST}`,
      'evidence:rotate-key: about to make a NEW evidence signing key the active one of this installation',
      'evidence:rotate-key: OK, the new evidence signing key was provisioned, loads and is the ACTIVE one',
    ]);
    expect([run.code, run.refusal, prompts.length]).toEqual([0, null, 3]);
    expect(out).toEqual(run.lines);
    // The word is asked BEFORE anything is made: the directory was as before.
    expect(treeWhenAsked).toEqual(before);

    // THE ACTIVE ID IS THE NEW ONE - for the resolver, the seal's loader and a production start.
    expect(activeSigningKeyId({ dir: signer })).toBe(SECOND);
    const active = loadSealingSigner({ dataDir, now: NOW });
    expect([active.signer.keyId, active.certificate.subject, isDevelopmentSigningCertificate(active.certificate)]).toEqual([SECOND, subjectOf(SECOND), false]);
    expect(await productionStart(dataDir)).toBe('STARTS REAL_PRODUCTION');
    // The new key signs, and its signature verifies under the new certificate - not under the earlier one.
    const message = Buffer.from('row 226');
    const signature = await active.signer.sign(message);
    expect([verifyEd25519(active.certificate.publicKey, message, signature), verifyEd25519(first.publicKey, message, signature)]).toEqual([true, false]);

    // BOTH CERTIFICATES EXIST, and the earlier key is as it was: every entry that was there is byte-identical.
    expect([readStoredCertificate({ dir: signer, keyId: FIRST }).sha256, readStoredCertificate({ dir: signer, keyId: SECOND }).sha256]).toEqual([first.sha256, active.certificate.sha256]);
    expect(loadSoftwareSigner({ dir: signer, keyId: FIRST, now: NOW }).certificate.sha256).toBe(first.sha256);
    const after = tree(dataDir);
    for (const entry of before) expect(after).toContain(entry);
    const added = after.filter((entry) => !before.includes(entry)).map((entry) => entry.split(' ').slice(0, 2).join(' '));
    expect(added).toEqual([`handover/${handoverRecordNameOf(SECOND)} 644`, `signer/${ACTIVE_KEY_POINTER_NAME} 600`, `signer/${SECOND}.crt 644`, `signer/${SECOND}.p8 600`, `signer/${provisioningRecordNameOf(SECOND)} 644`, `signer/${SECOND}.wrap 600`].sort());
    expect([modeOf(signer), readFileSync(join(signer, ACTIVE_KEY_POINTER_NAME), 'latin1')]).toEqual([0o700, `${SECOND}\n`]);
    for (const name of names(signer)) expect(lstatSync(join(signer, name)).uid, name).toBe(UID);

    // The two records hold public facts: the new certificate, and which key it follows.
    const record = JSON.parse(readFileSync(join(signer, provisioningRecordNameOf(SECOND)), 'utf8')) as Record<string, unknown>;
    expect(record).toMatchObject({ record: 'DEMS_EVIDENCE_SIGNING_KEY_ROTATED', keyId: SECOND, certificateSha256: active.certificate.sha256, subject: subjectOf(SECOND), earlierKeyId: FIRST, earlierCertificateSha256: first.sha256, earlierKeyState: 'loads', command: 'evidence:rotate-key', uid: UID });
    expect(Object.keys(record).sort()).toEqual(['algorithm', 'certificateSha256', 'command', 'commandVersion', 'earlierCertificateSha256', 'earlierKeyId', 'earlierKeyState', 'keyId', 'notAfter', 'notBefore', 'note', 'record', 'rotatedAt', 'selfSigned', 'serialNumber', 'subject', 'uid']);
    const handover = readFileSync(join(dataDir, 'handover', handoverRecordNameOf(SECOND)), 'utf8');
    expect(handover).toContain(`certificate sha256:  ${active.certificate.sha256}`);
    expect(handover).toContain(active.certificate.pemText.trimEnd());
    expect(run.lines).toContain(`  earlier certificate: sha256 ${first.sha256} - KEPT`);
    expect(run.lines).toContain(`  certificate:         sha256 ${active.certificate.sha256}`);

    // A SECOND rotation, to another installation name: the third id; all three certificates are there.
    const again = await rotate(root, dataDir, [ORGANISATION, 'DEMS-TEST-227', ROTATE_WORD]);
    expect([again.run.code, activeSigningKeyId({ dir: signer }), loadSealingSigner({ dataDir, now: NOW }).certificate.subject]).toEqual([0, THIRD, subjectOf(THIRD, 'DEMS-TEST-227')]);
    for (const entry of after.filter((line) => !line.startsWith(`signer/${ACTIVE_KEY_POINTER_NAME} `))) expect(tree(dataDir)).toContain(entry);
    expect([FIRST, SECOND, THIRD].map((keyId) => readStoredCertificate({ dir: signer, keyId }).keyId)).toEqual([FIRST, SECOND, THIRD]);
    // The production key command never makes the first key a second time.
    const { ports } = portsOf(root, [ORGANISATION, INSTALLATION, PROVISION_WORD]);
    expect((await runProductionKeyCommand(['--data-dir', dataDir], ports)).refusal).toBe(ProductionKeyRefusal.KEY_EXISTS);
  });

  it('a rotation that stops after the new key was made leaves the EARLIER key active; the next run takes the id after it', async () => {
    // The clock of the activation is before the validity of the new certificate: the store does not move the pointer.
    const stopped = await installed();
    const before = tree(stopped.dataDir);
    let reads = 0;
    const late = await rotate(stopped.root, stopped.dataDir, ROTATE, { now: () => (reads++ === 3 ? NOW - 3_600_000 : NOW) });
    expect([late.run.code, late.run.refusal]).toEqual([1, RotateKeyRefusal.NOT_ACTIVATED]);
    expect(late.run.lines).toContain('  the store says: CERTIFICATE_NOT_VALID_NOW');
    expect([activeSigningKeyId({ dir: stopped.signer }), loadSealingSigner({ dataDir: stopped.dataDir, now: NOW }).signer.keyId]).toEqual([FIRST, FIRST]);
    expect(names(stopped.signer)).toEqual([`${FIRST}.crt`, `${FIRST}.p8`, provisioningRecordNameOf(FIRST), `${FIRST}.wrap`, `${SECOND}.crt`, `${SECOND}.p8`, `${SECOND}.wrap`].sort());
    for (const entry of before) expect(tree(stopped.dataDir)).toContain(entry);
    // Nothing is removed and the spent id is not used again: the next run makes the THIRD key the active one.
    const next = await rotate(stopped.root, stopped.dataDir);
    expect([next.run.code, activeSigningKeyId({ dir: stopped.signer }), loadSealingSigner({ dataDir: stopped.dataDir, now: NOW }).certificate.subject]).toEqual([0, THIRD, subjectOf(THIRD)]);
    expect(names(stopped.signer)).toContain(`${SECOND}.p8`);

    // The new key does not load at the instant it is asked: refused BEFORE the pointer is touched.
    const unloaded = await installed();
    reads = 0;
    const early = await rotate(unloaded.root, unloaded.dataDir, ROTATE, { now: () => (reads++ === 2 ? NOW - 3_600_000 : NOW) });
    expect([early.run.refusal, early.run.lines.includes('  the loader says: CERTIFICATE_NOT_VALID_NOW'), activeSigningKeyId({ dir: unloaded.signer })]).toEqual([RotateKeyRefusal.LOAD_FAILED, true, FIRST]);
    expect(real(join(unloaded.signer, ACTIVE_KEY_POINTER_NAME))).toBeNull();

    // The records cannot be written: the key IS active, and the command says so.
    const sealed = await installed();
    chmodSync(join(sealed.dataDir, 'handover'), 0o500);
    const unrecorded = await rotate(sealed.root, sealed.dataDir);
    chmodSync(join(sealed.dataDir, 'handover'), 0o700);
    expect([unrecorded.run.code, unrecorded.run.refusal, activeSigningKeyId({ dir: sealed.signer })]).toEqual([1, RotateKeyRefusal.RECORD_NOT_WRITTEN, SECOND]);
    expect(unrecorded.run.lines).toContain(`  new key id:          ${SECOND} - ACTIVE`);
  });

  it('every refusal before the word leaves the data directory byte-identical', async () => {
    const { root, dataDir, signer } = await installed();
    const before = tree(root);
    const refused = async (expected: string, typed: ReadonlyArray<string | null>, overrides: Partial<ProductionKeyPorts> = {}): Promise<void> => {
      const { run } = await rotate(root, dataDir, typed, overrides);
      expect([run.code, run.refusal], expected).toEqual([1, expected]);
      expect(tree(root), expected).toEqual(before);
    };
    await refused(RotateKeyRefusal.ROOT_REFUSED, ROTATE, { uid: () => 0 });
    await refused(RotateKeyRefusal.USER_UNKNOWN, ROTATE, { uid: () => -1 });
    await refused(RotateKeyRefusal.NOT_A_TERMINAL, []);
    await refused(RotateKeyRefusal.NOT_A_TERMINAL, [ORGANISATION]);
    await refused(RotateKeyRefusal.NOT_A_TERMINAL, [ORGANISATION, INSTALLATION]);
    for (const organisation of ['', 'x', 'A,B', 'A=B', 'ORG\nOU=x', 'Org  two spaces', 'trailing ', 'DEVELOPMENT KEY - NOT FOR PRODUCTION', 'Organisasi é']) await refused(RotateKeyRefusal.ORGANISATION_REFUSED, [organisation, INSTALLATION, ROTATE_WORD]);
    for (const installation of ['', 'dems-jkt-07', 'DEMS JKT', 'DEMS-JKT,07', 'DEMS-JKT=07']) await refused(RotateKeyRefusal.INSTALLATION_ID_REFUSED, [ORGANISATION, installation, ROTATE_WORD]);
    for (const word of ['', 'rotate', 'ROTATE ', 'YES', PROVISION_WORD]) await refused(RotateKeyRefusal.NOT_CONFIRMED, [ORGANISATION, INSTALLATION, word]);
    // Usage: `--data-dir` only, required, absolute, as written.
    for (const args of [[], ['--data-dir'], ['--data-dir', 'relative'], ['--data-dir', `${dataDir}/`], ['--data-dir', dataDir, '--key-id', SECOND], ['--data-dir', dataDir, '--force'], [dataDir]]) {
      const { ports, prompts } = portsOf(root, ROTATE);
      const run = await runRotateKeyCommand(args, ports);
      expect([run.code, run.refusal, prompts.length, run.lines.length], args.join(' ')).toEqual([2, null, 0, 1]);
    }
    expect(tree(root)).toEqual(before);

    // The directory rule of row 206 holds here too: a store group may read, a link at the data directory.
    chmodSync(signer, 0o750);
    const loose = await rotate(root, dataDir);
    expect([loose.run.code, loose.run.refusal, loose.prompts.length]).toEqual([1, ProductionKeyRefusal.SIGNER_MODE, 0]);
    chmodSync(signer, 0o700);
    expect(tree(root)).toEqual(before);
    expect((await rotate(root, join(root, 'absent'))).run.refusal).toBe(ProductionKeyRefusal.DATA_DIR_NOT_FOUND);
    symlinkSync(dataDir, join(root, 'alias'));
    expect((await rotate(root, join(root, 'alias'))).run.refusal).toBe(ProductionKeyRefusal.DATA_DIR_LINK);
    rmSync(join(root, 'alias'));
    expect(tree(root)).toEqual(before);
  });

  it('the store decides whether a rotation is the answer: no store, nothing to rotate, a development store, a pointer that cannot be taken', async () => {
    const empty = scene();
    expect((await rotate(empty.root, empty.dataDir)).run.refusal).toBe(RotateKeyRefusal.NO_STORE);
    mkdirSync(empty.signer, { mode: 0o700 });
    expect((await rotate(empty.root, empty.dataDir)).run.refusal).toBe(RotateKeyRefusal.NOTHING_TO_ROTATE);
    expect(tree(empty.root)).toEqual(['data/ 700', 'data/signer/ 700']);

    const development = scene();
    provisionDevelopmentSigningKey({ dataDir: development.dataDir, now: NOW });
    const developmentBefore = tree(development.root);
    const refusedDevelopment = await rotate(development.root, development.dataDir);
    expect([refusedDevelopment.run.refusal, refusedDevelopment.prompts.length]).toEqual([RotateKeyRefusal.DEVELOPMENT_STORE, 0]);
    expect(tree(development.root)).toEqual(developmentBefore);

    // A pointer that cannot be taken: refused, and NOT repaired - its bytes and its mode are as they were.
    const spoiled = await installed();
    const pointer = join(spoiled.signer, ACTIVE_KEY_POINTER_NAME);
    for (const [bytes, mode] of [['garbage\n', 0o600], [`${FIRST}\n`, 0o640], ['', 0o600]] as const) {
      writeFileSync(pointer, bytes, { mode });
      chmodSync(pointer, mode);
      const before = tree(spoiled.root);
      const { run, prompts } = await rotate(spoiled.root, spoiled.dataDir);
      expect([run.code, run.refusal, prompts.length, run.lines[1]], bytes).toEqual([1, RotateKeyRefusal.STORE_REFUSED, 0, '  the store says: ACTIVE_KEY_POINTER_INVALID']);
      expect(tree(spoiled.root), bytes).toEqual(before);
      // The compromise mark is not kept from being set by a pointer nobody can read - and it says so.
      rmSync(pointer);
    }
    writeFileSync(pointer, 'garbage\n', { mode: 0o600 });
    const marked = await mark(spoiled.root, spoiled.dataDir, FIRST);
    expect([marked.run.code, marked.run.lines.includes('  the active key: cannot be told (ACTIVE_KEY_POINTER_INVALID)'), readFileSync(pointer, 'latin1')]).toEqual([0, true, 'garbage\n']);
  });

  // Task 4 row 226d (review 230 caution R-5): a rotated store EDITED BY HAND - the pointer and every entry of the first key id
  // removed, in the store and in the hand-over folder, the second key left. The first-key command saw none of its names and
  // made a SECOND key under the first id, which then was the active one. The store refuses it now (`host-key.ts` `keyIdSpent`).
  it('row 226d (R-5): after a rotation, with the pointer and every entry of the first key id removed by hand, the first-key command makes NO second key under the first id; the next rotation takes the id after the highest', async () => {
    const { root, dataDir, signer } = await installed();
    expect((await rotate(root, dataDir)).run.code).toBe(0);
    rmSync(join(signer, ACTIVE_KEY_POINTER_NAME));
    for (const directory of [signer, join(dataDir, 'handover')]) for (const name of names(directory)) if (name.startsWith(`${FIRST}.`)) rmSync(join(directory, name));
    const left = [names(signer), names(join(dataDir, 'handover'))];
    expect(left.flat().some((name) => name.includes(FIRST))).toBe(false);
    expect(left[0]).toEqual(expect.arrayContaining([`${SECOND}.crt`, `${SECOND}.p8`, `${SECOND}.wrap`]));

    const { ports, prompts } = portsOf(root, [ORGANISATION, INSTALLATION, PROVISION_WORD]);
    const again = await runProductionKeyCommand(['--data-dir', dataDir], ports);
    // Row K6: refused BEFORE the first prompt - the command asks the store for its next key id, which is not the first one
    // (before row K6: three prompts, then the store's refusal `FAILED, KEY_EXISTS` after the word). Nothing was written.
    expect([again.code, again.refusal, prompts.length]).toEqual([1, ProductionKeyRefusal.KEY_EXISTS, 0]);
    expect(again.lines.slice(0, 2)).toEqual(['evidence:production-key: REFUSED, KEY_EXISTS', `  The key id ${FIRST} is SPENT: the store names a later key of the series, in an entry or in its pointer.`]);
    expect([names(signer), names(join(dataDir, 'handover'))]).toEqual(left);
    // NO COMMAND REPAIRS SUCH A STORE: without a pointer the active id is the first, of which nothing is there - a rotation has
    // nothing to rotate and refuses too, and writes nothing. What was removed by hand is put back by hand (the installer's act).
    const onward = await rotate(root, dataDir);
    expect([onward.run.code, onward.run.refusal, activeSigningKeyId({ dir: signer })]).toEqual([1, RotateKeyRefusal.NOTHING_TO_ROTATE, FIRST]);
    expect([names(signer), names(join(dataDir, 'handover'))]).toEqual(left);
  });

  // Row K6 (decisions C84, C86; the left-over requests of rows 226d and 228b). Planted entries are texts, never keys.
  it('row K6: an installation id of the boot checks\' reserved list is refused as it is typed - no word asked, no new key, the store byte-identical, the earlier key still active', async () => {
    const { root, dataDir, signer } = await installed();
    const before = tree(root);
    expect(Object.values(ReservedInstallationId).sort()).toEqual(['DEMS-IR-01', 'DEMS-JKT-07', 'DEMS-TEST-01']);
    for (const id of Object.values(ReservedInstallationId)) {
      const { run, prompts } = await rotate(root, dataDir, [ORGANISATION, id, ROTATE_WORD]);
      expect([run.code, run.refusal, prompts.length], id).toEqual([1, RotateKeyRefusal.INSTALLATION_ID_RESERVED, 2]);
      expect(run.lines.slice(-3), id).toEqual([
        'evidence:rotate-key: REFUSED, INSTALLATION_ID_RESERVED',
        '  This installation device id is reserved for tests and demonstration data: no installation may carry it, and a production start refuses it.',
        '  No key was made and nothing was written. Give the installation an id of its own and run the command again.',
      ]);
      expect(run.lines.join('\n'), id).not.toContain(id);
      expect(tree(root), id).toEqual(before);
    }
    expect(activeSigningKeyId({ dir: signer })).toBe(FIRST);
    // The list is asked through the first-key command's one question; the rotation's source names none of the ids.
    const source = readFileSync(join(__dirname, '..', '..', '..', 'cli', 'rotate-key-command.ts'), 'utf8');
    for (const id of Object.values(ReservedInstallationId)) expect(source, id).not.toContain(id);
    // CONTROL: an id beside the list rotates.
    expect((await rotate(root, dataDir, [ORGANISATION, 'DEMS-JKT-08', ROTATE_WORD])).run.code).toBe(0);
  });

  it('row K6: every state of the store a rotation is refused for ends BEFORE the first prompt, the store byte-identical', async () => {
    const refusedUnasked = async (label: string, made: { root: string; dataDir: string }, expected: string): Promise<void> => {
      const before = tree(made.root);
      const { run, prompts } = await rotate(made.root, made.dataDir);
      expect([run.code, run.refusal, prompts.length], label).toEqual([1, expected, 0]);
      expect(tree(made.root), label).toEqual(before);
    };
    const none = scene();
    await refusedUnasked('no store', none, RotateKeyRefusal.NO_STORE);
    mkdirSync(none.signer, { mode: 0o700 });
    await refusedUnasked('an empty store', none, RotateKeyRefusal.NOTHING_TO_ROTATE);
    // A hand-over record of the NEXT id without its key.
    const noted = await installed();
    writeFileSync(join(noted.dataDir, 'handover', handoverRecordNameOf(SECOND)), 'a note\n', { mode: 0o644 });
    await refusedUnasked('a record of the next id', noted, RotateKeyRefusal.RECORD_EXISTS);
    // The series is used up: an entry names its last id.
    const last = await installed();
    writeFileSync(join(last.signer, 'CORE-KEY-EVSIGN-99.crt.bak'), 'NOT A CERTIFICATE\n', { mode: 0o644 });
    await refusedUnasked('the last id of the series is named', last, RotateKeyRefusal.KEY_SERIES_EXHAUSTED);
    // The active key file can be read by the group: no new key is an answer to that.
    const loose = await installed();
    chmodSync(join(loose.signer, `${FIRST}.p8`), 0o640);
    await refusedUnasked('a key file the group can read', loose, RotateKeyRefusal.ACTIVE_KEY_STATE);
  });
});

describe('evidence:mark-compromised: a marked key loads for nobody, and the start is refused until a rotation', () => {
  it('the mark is set through the store, the key and its certificate stay, and only a rotation lets the Core start again', async () => {
    const { root, dataDir, signer } = await installed();
    const before = tree(dataDir);
    const first = loadSealingSigner({ dataDir, now: NOW }).certificate;
    expect(await productionStart(dataDir)).toBe('STARTS REAL_PRODUCTION');

    const { run, prompts, out } = await mark(root, dataDir, FIRST);
    expect(run.lines.filter((line) => line.startsWith('evidence:mark-compromised: '))).toEqual(['evidence:mark-compromised: about to mark an evidence signing key COMPROMISED', 'evidence:mark-compromised: OK, the key is MARKED COMPROMISED and loads for nobody']);
    expect([run.code, run.refusal, prompts.length]).toEqual([0, null, 1]);
    expect(out).toEqual(run.lines);
    expect(run.lines).toContain(`  certificate:    sha256 ${first.sha256}`);
    expect(run.lines).toContain('  the active key: yes');

    // IT LOADS FOR NOBODY: by its id, through the seal's loader, and a production start is REFUSED by check 4.
    expect([codeOf(() => loadSoftwareSigner({ dir: signer, keyId: FIRST, now: NOW })), codeOf(() => loadSoftwareSigner({ dir: signer, now: NOW })), codeOf(() => loadSealingSigner({ dataDir, now: NOW }))]).toEqual(['KEY_COMPROMISED', 'KEY_COMPROMISED', 'KEY_COMPROMISED']);
    expect(await productionStart(dataDir)).toBe(`${KEY_REFUSED} KEY_COMPROMISED`);
    // ONE entry was added - the mark, the fact and the instant, nothing else - and every earlier entry is byte-identical.
    const after = tree(dataDir);
    for (const entry of before) expect(after).toContain(entry);
    expect(after.filter((entry) => !before.includes(entry)).map((entry) => entry.split(' ').slice(0, 2).join(' '))).toEqual([`signer/${FIRST}.compromised 644`]);
    expect(JSON.parse(readFileSync(join(signer, `${FIRST}.compromised`), 'utf8'))).toEqual({ keyId: FIRST, compromisedAt: NOW });
    // The certificate is still read as public data: what the key signed can be verified again.
    expect(readStoredCertificate({ dir: signer, keyId: FIRST }).sha256).toBe(first.sha256);

    // A second run: said to be marked, exit 0, nothing asked, nothing written.
    const again = await mark(root, dataDir, FIRST);
    expect([again.run.code, again.run.refusal, again.prompts.length, again.run.lines[0]]).toEqual([0, null, 0, 'evidence:mark-compromised: the key is MARKED COMPROMISED already; nothing was written']);
    expect(tree(dataDir)).toEqual(after);
    // The start stays refused, and the first key id is not provisioned a second time.
    expect(await productionStart(dataDir)).toBe(`${KEY_REFUSED} KEY_COMPROMISED`);
    const { ports } = portsOf(root, [ORGANISATION, INSTALLATION, PROVISION_WORD]);
    expect((await runProductionKeyCommand(['--data-dir', dataDir], ports)).refusal).toBe(ProductionKeyRefusal.KEY_EXISTS);

    // UNTIL A ROTATION: the rotation takes a compromised active key as its reason, and the Core starts with the new key.
    const rotated = await rotate(root, dataDir);
    expect([rotated.run.code, rotated.run.refusal]).toEqual([0, null]);
    expect(rotated.run.lines).toContain(`  earlier key id:      ${FIRST} (does not load: KEY_COMPROMISED)`);
    expect([activeSigningKeyId({ dir: signer }), await productionStart(dataDir)]).toEqual([SECOND, 'STARTS REAL_PRODUCTION']);
    // The marked key stays marked and stays there: mark, key file and certificate, byte for byte.
    for (const entry of after) expect(tree(dataDir)).toContain(entry);
    expect(codeOf(() => loadSoftwareSigner({ dir: signer, keyId: FIRST, now: NOW }))).toBe('KEY_COMPROMISED');
    expect(JSON.parse(readFileSync(join(signer, provisioningRecordNameOf(SECOND)), 'utf8'))).toMatchObject({ earlierKeyId: FIRST, earlierKeyState: 'KEY_COMPROMISED', earlierCertificateSha256: first.sha256 });

    // A key that is NOT the active one can be marked too: the store goes on with the active key.
    const earlier = await installed();
    await rotate(earlier.root, earlier.dataDir);
    const markedEarlier = await mark(earlier.root, earlier.dataDir, FIRST);
    expect([markedEarlier.run.code, markedEarlier.run.lines.includes('  the active key: no')]).toEqual([0, true]);
    expect([loadSealingSigner({ dataDir: earlier.dataDir, now: NOW }).signer.keyId, await productionStart(earlier.dataDir)]).toEqual([SECOND, 'STARTS REAL_PRODUCTION']);
  });

  it('every refusal leaves the data directory byte-identical: the caller, the word, a key that is not there, the arguments', async () => {
    const { root, dataDir } = await installed();
    const before = tree(root);
    const refused = async (expected: string, keyId: string, typed: ReadonlyArray<string | null>, overrides: Partial<ProductionKeyPorts> = {}): Promise<void> => {
      const { run } = await mark(root, dataDir, keyId, typed, overrides);
      expect([run.code, run.refusal], expected).toEqual([1, expected]);
      expect(tree(root), expected).toEqual(before);
    };
    await refused(MarkCompromisedRefusal.ROOT_REFUSED, FIRST, [COMPROMISED_WORD], { uid: () => 0 });
    await refused(MarkCompromisedRefusal.USER_UNKNOWN, FIRST, [COMPROMISED_WORD], { uid: () => -1 });
    await refused(MarkCompromisedRefusal.NOT_A_TERMINAL, FIRST, []);
    for (const word of ['', 'compromised', 'COMPROMISED ', 'YES', ROTATE_WORD]) await refused(MarkCompromisedRefusal.NOT_CONFIRMED, FIRST, [word]);
    // No mark is made for a key that was never in the store.
    await refused(MarkCompromisedRefusal.KEY_NOT_IN_STORE, SECOND, [COMPROMISED_WORD]);
    await refused(MarkCompromisedRefusal.KEY_NOT_IN_STORE, 'CORE-KEY-EVSIGN-99', [COMPROMISED_WORD]);
    // Usage: both options required; the key id is one of the series, as written; no other option, no default to the active key.
    for (const args of [[], ['--data-dir', dataDir], ['--key-id', FIRST], ['--data-dir', dataDir, '--key-id'], ['--data-dir', dataDir, '--key-id', 'TEST-KEY-01'], ['--data-dir', dataDir, '--key-id', `../${FIRST}`], ['--data-dir', dataDir, '--key-id', FIRST.toLowerCase()], ['--data-dir', 'relative', '--key-id', FIRST], ['--data-dir', dataDir, '--key-id', FIRST, '--all'], ['--data-dir', dataDir, '--key-id', FIRST, 'extra']]) {
      const { ports, prompts } = portsOf(root, [COMPROMISED_WORD]);
      const run = await runMarkCompromisedCommand(args, ports);
      expect([run.code, run.refusal, prompts.length, run.lines.length], args.join(' ')).toEqual([2, null, 0, 1]);
    }
    expect(tree(root)).toEqual(before);
    const empty = scene();
    expect((await mark(empty.root, empty.dataDir, FIRST)).run.refusal).toBe(MarkCompromisedRefusal.NO_STORE);
    expect((await mark(empty.root, join(empty.root, 'absent'), FIRST)).run.refusal).toBe(ProductionKeyRefusal.DATA_DIR_NOT_FOUND);
    expect(tree(empty.root)).toEqual(['data/ 700']);
  });

  // Task 4 row 226d (review 230 caution R-6): the command marked WITHOUT asking the store what it holds, and the store's
  // function wrote without the look at the directory every read has. Now the store is asked and its answer SHOWN before
  // the word; a store the signer unit does not take is refused before anything is asked; and the look is taken again
  // after the word - a person may wait at the prompt. No byte of a key is read by this case: names and modes only.
  it('row 226d (R-6): the command first SHOWS what the store holds of that key id, refuses a store the signer unit does not take, and looks again after the word - before anything is written', async () => {
    const FOUND = (key: string, wrap: string, certificate: string, markState: string): string => `  found:          key file ${key}, wrap secret ${wrap}, certificate ${certificate}, mark ${markState}`;
    const markRun = async (root: string, dataDir: string, keyId: string, typed: ReadonlyArray<string | null>, overrides: Partial<ProductionKeyPorts> = {}, onAsk?: (prompt: string) => void): Promise<{ run: MarkCompromisedRun; prompts: string[] }> => {
      const { ports, prompts } = portsOf(root, typed, overrides, onAsk);
      return { run: await runMarkCompromisedCommand(['--data-dir', dataDir, '--key-id', keyId], ports), prompts };
    };

    // 1. SHOWN BEFORE THE WORD: present / absent / marked / active - and a run that is not confirmed wrote nothing.
    const { root, dataDir, signer } = await installed();
    const sound = names(signer);
    const shown = await markRun(root, dataDir, FIRST, ['no']);
    expect([shown.run.code, shown.run.refusal, shown.prompts.length]).toEqual([1, MarkCompromisedRefusal.NOT_CONFIRMED, 1]);
    const summary = shown.run.lines.slice(0, shown.run.lines.indexOf(`evidence:mark-compromised: REFUSED, ${MarkCompromisedRefusal.NOT_CONFIRMED}`));
    expect(summary).toContain(FOUND('present', 'present', 'present', 'absent'));
    expect(summary).toContain('  the active key: yes');
    expect(names(signer)).toEqual(sound);
    // Absent: refused by name, nothing asked.
    const absent = await markRun(root, dataDir, SECOND, [COMPROMISED_WORD]);
    expect([absent.run.refusal, absent.prompts.length]).toEqual([MarkCompromisedRefusal.KEY_NOT_IN_STORE, 0]);
    // A key of which only the certificate is left (a rotated-out key whose private half an installer removed by hand), not active: shown as it is, and marked.
    await rotate(root, dataDir);
    for (const extension of ['p8', 'wrap']) rmSync(join(signer, `${FIRST}.${extension}`));
    const partial = await markRun(root, dataDir, FIRST, [COMPROMISED_WORD]);
    expect([partial.run.code, partial.run.refusal]).toEqual([0, null]);
    expect(partial.run.lines).toContain(FOUND('absent', 'absent', 'present', 'absent'));
    expect(partial.run.lines).toContain('  the active key: no');
    // Already marked: said with what was found, exit 0, nothing asked, nothing written.
    const afterMark = names(signer);
    const already = await markRun(root, dataDir, FIRST, [COMPROMISED_WORD]);
    expect([already.run.code, already.prompts.length, already.run.lines[0]]).toEqual([0, 0, 'evidence:mark-compromised: the key is MARKED COMPROMISED already; nothing was written']);
    expect(already.run.lines).toContain(FOUND('absent', 'absent', 'present', 'present'));
    expect(names(signer)).toEqual(afterMark);

    // 2. A STORE THE SIGNER UNIT DOES NOT TAKE, where the command's own directory rule saw nothing wrong (its facts are
    //    stated here as sound - the double of "the two looks differ"): refused by the store's code BEFORE the word.
    const statedSound =
      (made: { root: string; signer: string }) =>
      (path: string): EntryFacts | null =>
        path === made.signer ? { kind: 'directory', ownerUid: UID, mode: 0o700 } : aboveIsSound(made.root)(path);
    const reachable = await installed();
    const reachableNames = names(reachable.signer);
    chmodSync(reachable.signer, 0o750);
    const refusedMode = await markRun(reachable.root, reachable.dataDir, FIRST, [COMPROMISED_WORD], { inspect: statedSound(reachable) });
    expect([refusedMode.run.code, refusedMode.run.refusal, refusedMode.prompts.length]).toEqual([1, MarkCompromisedRefusal.STORE_NOT_TAKEN, 0]);
    expect(refusedMode.run.lines).toContain('  the store says: KEY_MODE');
    chmodSync(reachable.signer, 0o700);
    expect(names(reachable.signer)).toEqual(reachableNames);
    const linked = await installed();
    const linkedNames = names(linked.signer);
    const behind = join(linked.root, 'elsewhere');
    renameSync(linked.signer, behind);
    symlinkSync(behind, linked.signer);
    const refusedLink = await markRun(linked.root, linked.dataDir, FIRST, [COMPROMISED_WORD], { inspect: statedSound(linked) });
    expect([refusedLink.run.refusal, refusedLink.prompts.length]).toEqual([MarkCompromisedRefusal.STORE_NOT_TAKEN, 0]);
    expect(refusedLink.run.lines).toContain('  the store says: KEY_UNREADABLE');
    expect(names(behind)).toEqual(linkedNames);
    // CONTROL: with the facts as they ARE the command's own directory rule refuses the link first, as before this row.
    expect((await markRun(linked.root, linked.dataDir, FIRST, [COMPROMISED_WORD])).run.refusal).toBe(ProductionKeyRefusal.SIGNER_LINK);
    expect(names(behind)).toEqual(linkedNames);

    // 3. CHANGED WHILE THE PERSON WAITS AT THE PROMPT: the word is typed, and NOTHING is written.
    //    (a) the store became a link to itself-elsewhere: before this row the mark was written through the link.
    const swapped = await installed();
    const swappedNames = names(swapped.signer);
    const swappedBehind = join(swapped.root, 'elsewhere');
    const viaLink = await markRun(swapped.root, swapped.dataDir, FIRST, [COMPROMISED_WORD], {}, () => {
      renameSync(swapped.signer, swappedBehind);
      symlinkSync(swappedBehind, swapped.signer);
    });
    expect([viaLink.run.code, viaLink.run.refusal, viaLink.prompts.length]).toEqual([1, MarkCompromisedRefusal.STORE_NOT_TAKEN, 1]);
    expect(viaLink.run.lines).toContain('  the store says: KEY_UNREADABLE');
    expect(names(swappedBehind)).toEqual(swappedNames);
    //    (b) the store became reachable by its group.
    const opened = await installed();
    const openedNames = names(opened.signer);
    const viaMode = await markRun(opened.root, opened.dataDir, FIRST, [COMPROMISED_WORD], {}, () => chmodSync(opened.signer, 0o750));
    expect([viaMode.run.refusal, viaMode.run.lines.includes('  the store says: KEY_MODE')]).toEqual([MarkCompromisedRefusal.STORE_NOT_TAKEN, true]);
    chmodSync(opened.signer, 0o700);
    expect(names(opened.signer)).toEqual(openedNames);
    //    (c) the certificate that was shown is no longer there.
    const emptied = await installed();
    const viaRemoval = await markRun(emptied.root, emptied.dataDir, FIRST, [COMPROMISED_WORD], {}, () => rmSync(join(emptied.signer, `${FIRST}.crt`)));
    expect([viaRemoval.run.code, viaRemoval.run.refusal]).toEqual([1, MarkCompromisedRefusal.STORE_CHANGED]);
    expect(names(emptied.signer)).not.toContain(`${FIRST}.compromised`);
    //    (d) another run marked the key meanwhile: this run writes nothing and does not claim the mark.
    const raced = await installed();
    const viaOther = await markRun(raced.root, raced.dataDir, FIRST, [COMPROMISED_WORD], {}, () => markSigningKeyCompromised({ dir: raced.signer, keyId: FIRST, at: NOW - 5 }));
    expect([viaOther.run.code, viaOther.run.refusal]).toEqual([1, MarkCompromisedRefusal.STORE_CHANGED]);
    expect(JSON.parse(readFileSync(join(raced.signer, `${FIRST}.compromised`), 'utf8'))).toEqual({ keyId: FIRST, compromisedAt: NOW - 5 });
    // CONTROL: nothing changed at the prompt - the mark is written (the first case of this block is the full proof).
    const calm = await installed();
    expect([(await markRun(calm.root, calm.dataDir, FIRST, [COMPROMISED_WORD], {}, () => undefined)).run.code, names(calm.signer).includes(`${FIRST}.compromised`)]).toEqual([0, true]);
  });
});

describe('R-X1-1, R-X1-2 for both commands: nothing of a key is printed, logged, recorded or put into an error', () => {
  it('the sweep of row 206 - standard output, standard error, the console, every line, every record, the pointer and the mark - counts 0', async () => {
    const written: string[] = [];
    const capture = (chunk: unknown): boolean => {
      written.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('latin1'));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(capture as typeof process.stdout.write);
    vi.spyOn(process.stderr, 'write').mockImplementation(capture as typeof process.stderr.write);
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void written.push(parts.map((part) => show(part, { depth: 8 })).join(' ')));

    const runs: Array<RotateKeyRun | MarkCompromisedRun> = [];
    const thrown: unknown[] = [];
    /** The entry's own ports - its `out` writes to standard output as a real run does - with typed lines and the stated ancestors. */
    const typedAt = (root: string, typed: ReadonlyArray<string | null>, overrides: Partial<ProductionKeyPorts> = {}): ProductionKeyPorts => {
      const answers = [...typed];
      return { ...terminalPorts(), now: () => NOW, ask: async () => (answers.length === 0 ? null : (answers.shift() ?? null)), inspect: aboveIsSound(root), ...overrides };
    };
    const attempt = async (act: () => Promise<RotateKeyRun | MarkCompromisedRun>): Promise<void> => {
      try {
        runs.push(await act());
      } catch (error) {
        thrown.push(error);
      }
    };
    // Scene A: a rotation, each refusal with TWO keys in the store, the mark of the active key, a rotation out of it, a mark of an earlier key.
    const a = await installed();
    const dir = ['--data-dir', a.dataDir];
    await attempt(() => runRotateKeyCommand(dir, typedAt(a.root, ROTATE)));
    await attempt(() => runRotateKeyCommand(dir, typedAt(a.root, ROTATE, { uid: () => 0 })));
    await attempt(() => runRotateKeyCommand([...dir, '--verbose'], typedAt(a.root, ROTATE)));
    await attempt(() => runRotateKeyCommand(dir, typedAt(a.root, [ORGANISATION, INSTALLATION, 'no'])));
    chmodSync(join(a.signer, `${SECOND}.p8`), 0o644);
    await attempt(() => runRotateKeyCommand(dir, typedAt(a.root, ROTATE)));
    await attempt(() => runMarkCompromisedCommand([...dir, '--key-id', SECOND], typedAt(a.root, ['no'])));
    chmodSync(join(a.signer, `${SECOND}.p8`), 0o600);
    await attempt(() => runMarkCompromisedCommand([...dir, '--key-id', SECOND], typedAt(a.root, [COMPROMISED_WORD])));
    await attempt(() => runMarkCompromisedCommand([...dir, '--key-id', SECOND], typedAt(a.root, [COMPROMISED_WORD])));
    await attempt(() => runMarkCompromisedCommand([...dir, '--key-id', 'CORE-KEY-EVSIGN-09'], typedAt(a.root, [COMPROMISED_WORD])));
    await attempt(() => runMarkCompromisedCommand([...dir], typedAt(a.root, [COMPROMISED_WORD])));
    await attempt(() => runRotateKeyCommand(dir, typedAt(a.root, ROTATE)));
    await attempt(() => runMarkCompromisedCommand([...dir, '--key-id', FIRST], typedAt(a.root, [COMPROMISED_WORD])));
    // Scene B: the failures AFTER the new key was made - not activated, not loaded - and a pointer that cannot be taken.
    const b = await installed();
    let reads = 0;
    await attempt(() => runRotateKeyCommand(['--data-dir', b.dataDir], typedAt(b.root, ROTATE, { now: () => (reads++ === 3 ? NOW - 3_600_000 : NOW) })));
    reads = 0;
    await attempt(() => runRotateKeyCommand(['--data-dir', b.dataDir], typedAt(b.root, ROTATE, { now: () => (reads++ === 2 ? NOW - 3_600_000 : NOW) })));
    writeFileSync(join(b.signer, ACTIVE_KEY_POINTER_NAME), 'garbage\n', { mode: 0o600 });
    await attempt(() => runRotateKeyCommand(['--data-dir', b.dataDir], typedAt(b.root, ROTATE)));
    vi.restoreAllMocks();

    expect(thrown).toEqual([]);
    expect(runs.map((run) => [run.code, run.refusal])).toEqual([
      [0, null],
      [1, RotateKeyRefusal.ROOT_REFUSED],
      [2, null],
      [1, RotateKeyRefusal.NOT_CONFIRMED],
      [1, RotateKeyRefusal.ACTIVE_KEY_STATE],
      [1, MarkCompromisedRefusal.NOT_CONFIRMED],
      [0, null],
      [0, null],
      [1, MarkCompromisedRefusal.KEY_NOT_IN_STORE],
      [2, null],
      [0, null],
      [0, null],
      [1, RotateKeyRefusal.NOT_ACTIVATED],
      [1, RotateKeyRefusal.LOAD_FAILED],
      [1, RotateKeyRefusal.STORE_REFUSED],
    ]);
    expect(runs[4]?.lines[1]).toBe(`  the active key ${SECOND} does not load: KEY_MODE`);
    expect([activeSigningKeyId({ dir: a.signer }), names(b.signer).filter((name) => name.endsWith('.p8'))]).toEqual([THIRD, [`${FIRST}.p8`, `${SECOND}.p8`, `${THIRD}.p8`]]);

    // THE NEEDLES: every key of both stores - six keys - in every form the store handles or could give out.
    const needles: string[] = ['PRIVATE KEY'];
    let keys = 0;
    for (const store of [a.signer, b.signer]) {
      for (const name of names(store).filter((entry) => entry.endsWith('.p8'))) {
        const secret = readFileSync(join(store, name.replace(/\.p8$/, '.wrap')));
        const wrapped = readFileSync(join(store, name));
        const opened = createPrivateKey({ key: wrapped, format: 'der', type: 'pkcs8', passphrase: secret });
        const plain = opened.export({ format: 'der', type: 'pkcs8' });
        const seed = plain.subarray(16);
        expect([secret.length, seed.length], name).toEqual([32, 32]);
        const pem = opened.export({ format: 'pem', type: 'pkcs8' }) as string;
        const jwk = opened.export({ format: 'jwk' }) as { d?: string };
        for (const bytes of [secret, wrapped, plain, seed]) needles.push(bytes.toString('hex'), bytes.toString('hex').toUpperCase(), bytes.toString('base64'), bytes.toString('base64url'), bytes.toString('latin1'));
        needles.push(pem.split('\n')[1] ?? 'no pem body', jwk.d ?? 'no jwk member');
        needles.push(secret.toString('hex').slice(0, 32), secret.toString('hex').slice(32), seed.toString('hex').slice(0, 32), seed.toString('base64').slice(0, 22), wrapped.toString('base64').slice(0, 40));
        keys += 1;
      }
    }
    expect(keys).toBe(6);
    expect(needles.every((needle) => needle.length >= 11)).toBe(true);

    const haystacks: Record<string, string> = {
      'standard output, standard error and the console': written.join(''),
      'every returned line': runs.flatMap((run) => run.lines).join('\n'),
      'the results as objects': runs.map((run) => `${show(run, { depth: 8 })}\n${JSON.stringify(run)}`).join('\n'),
    };
    // Every file of both data directories that is not a key file or a wrap secret: records, certificates, hand-over records, pointers, marks.
    let files = 0;
    for (const store of [a, b]) {
      for (const folder of ['signer', 'handover']) {
        for (const name of names(join(store.dataDir, folder)).filter((entry) => !/\.(?:p8|wrap)$/.test(entry))) {
          haystacks[`${folder}/${name} of ${store.root}`] = readFileSync(join(store.dataDir, folder, name), 'latin1');
          files += 1;
        }
      }
    }
    expect(haystacks['standard output, standard error and the console']).toContain('evidence:rotate-key: OK');
    expect(haystacks['standard output, standard error and the console']).toContain('evidence:mark-compromised: OK');
    // a: 3 certificates, 3 records, pointer, 2 marks, 3 hand-over records; b: 3 certificates, 1 record, the spoiled pointer, 1 hand-over record.
    expect(files).toBe(12 + 6);
    const hits = (text: string): number => needles.reduce((count, needle) => count + (text.split(needle).length - 1), 0);
    for (const [where, text] of Object.entries(haystacks)) expect(hits(text), where).toBe(0);
    // POSITIVE CONTROL: the same count FINDS each needle in a text that holds it, and the key files themselves.
    for (const needle of needles) expect(hits(`x ${needle} y`), 'a planted needle').toBeGreaterThanOrEqual(1);
    for (const name of [`${FIRST}.wrap`, `${SECOND}.p8`, `${THIRD}.wrap`]) expect(hits(readFileSync(join(a.signer, name), 'latin1')), name).toBeGreaterThanOrEqual(1);
  });

  it('static: the four files import no cryptography module, read no environment, touch no database, and hold no call that removes, renames, cuts, copies or writes a file in place', () => {
    // The commands are not the server: no production source under `src/` names any of their files.
    const sources = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(300);
    expect(sources.filter((file) => /from\s+'[^']*(?:rotate-key|mark-compromised)[^']*'/.test(file.text)).map((file) => file.path)).toEqual([]);
    const cli = join(__dirname, '..', '..', '..', 'cli');
    const DATABASE = new RegExp(`['"]pg['"]|/db/|plugins/db|owner-connection|pg\\.(?:owner\\.)?${'en'}v|\\bPool\\b|\\bquery\\s*\\(`);
    const FILE_CHANGE = /random|wrapSecrets|validityDays|unlink|rmSync|renameSync|rename\s*\(|rmdir|truncate|copyFile|writeFileSync|appendFile|chmod|symlink|linkSync/i;
    for (const name of ['rotate-key-command.ts', 'rotate-key.ts', 'mark-compromised-command.ts', 'mark-compromised.ts']) {
      const code = readFileSync(join(cli, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code.length, name).toBeGreaterThan(400);
      expect(code, name).not.toMatch(new RegExp(`['"](?:node:)?${'cry'}${'pto'}['"]`));
      expect(code, name).not.toMatch(new RegExp(`process\\s*\\.\\s*${'en'}${'v'}\\b`));
      expect(code, name).not.toMatch(FILE_CHANGE);
      expect(code, name).not.toMatch(DATABASE);
    }
    // The one thing of the file system the rotation makes itself: the hand-over directory, when it is not there.
    const rotation = readFileSync(join(cli, 'rotate-key-command.ts'), 'utf8');
    expect(rotation.match(/from 'node:fs'/g)).toHaveLength(1);
    expect(rotation).toContain("import { mkdirSync } from 'node:fs';");
    expect(readFileSync(join(cli, 'mark-compromised-command.ts'), 'utf8')).not.toMatch(/from 'node:fs'/);
    // POSITIVE CONTROL of the patterns.
    expect(`import { x } from 'node:${'cry'}${'pto'}';`).toMatch(new RegExp(`['"](?:node:)?${'cry'}${'pto'}['"]`));
    expect("renameSync(a, b); import { Pool } from 'pg';").toMatch(FILE_CHANGE);
    expect("import { Pool } from 'pg';").toMatch(DATABASE);

    // One script line each, laid out as row 206's; no word in a command text that the credentials rule refuses.
    const scripts = (JSON.parse(readFileSync(join(cli, '..', 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect([scripts['evidence:rotate-key'], scripts['evidence:mark-compromised'], scripts['evidence:production-key']]).toEqual(['tsx cli/rotate-key.ts', 'tsx cli/mark-compromised.ts', 'tsx cli/production-key.ts']);
    for (const name of ['evidence:rotate-key', 'evidence:mark-compromised']) expect(scripts[name], name).not.toMatch(new RegExp(`${'pas'}sw|${'sec'}ret|${'tok'}en|${'cred'}ential|\\.data/`, 'i'));
  });
});
