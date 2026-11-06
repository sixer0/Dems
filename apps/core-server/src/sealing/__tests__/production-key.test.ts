// Task 4 row 206 (package X1-1; U19; SX-05, SX-06, SX-07, SX-08; R-X1-1 to R-X1-9): the production key
// command `evidence:production-key`.
//
// EVERY KEY OF THIS FILE IS MADE BY THE TEST, in a fresh directory of the temporary folder that the
// test removes (also after a failure: `afterAll`). No case names the repository's `.data/` or a
// default data directory, and the organisation of a test key is one fixed, obviously synthetic text.
//
// THE ONE DOUBLE OF THE FILE SYSTEM: the directories ABOVE the test's own root. On this host the
// temporary folder lies below a directory every user may write (the system's sticky one), which the
// directory rule refuses - rightly, for a data directory. `aboveIsSound` answers "a directory of
// root, mode 0755" for those steps ONLY; the root and everything below it is the file system as it
// is (`lstat`). The cases of the rule itself plant their link or their open directory BELOW the root.
import { createPrivateKey } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { inspect as show } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import { terminalPorts } from '../../../cli/production-key';
import { WORKSPACE, isProductionSource, readTree } from '../../../test/static/scan';
import { unitTestConfig } from '../../../test/support/config';
import { loadSoftwareSigner, verifyEd25519 } from '../../capture';
import type { ProgramFacts } from '../../capture/adapters/local';
import { CAPTURE_BOOT_STEP, CaptureBootError, CaptureBootRefusal, mountCaptureBootChecks, type CaptureBootSinks, type EvidenceVolumeFacts } from '../../capture/boot';
import { ReservedInstallationId } from '../../capture/boot/checks';
import { createSystemTimers } from '../../capture/timers';
import { BootError, createReadiness } from '../../plugins/readiness';
import { runDevKeyCommand } from '../dev-key-cli';
import {
  HANDOVER_RECORD_NAME,
  PROVISIONING_RECORD_NAME,
  PROVISION_WORD,
  ProductionKeyRefusal,
  SELF_SIGNED_LIMITS,
  SIGNER_STORE_NAMES,
  installationDeviceIdOf,
  installationIdIsReserved,
  organisationOf,
  productionKeySubjectOf,
  runProductionKeyCommand,
  type EntryFacts,
  type ProductionKeyPorts,
  type ProductionKeyRun,
} from '../../../cli/production-key-command';
import { isDevelopmentSigningCertificate, loadSealingSigner } from '../signing';

const NOW = 1_791_900_000_000;
const UID = typeof process.getuid === 'function' ? process.getuid() : -1;
/** One fixed, obviously synthetic organisation (SX-19) and installation. */
const ORGANISATION = 'SYNTHETIC TEST ORG - NOT AN INSTALLATION';
const INSTALLATION = 'DEMS-TEST-206';
const SUBJECT = `CN=CORE-KEY-EVSIGN-01,OU=Evidence signing ${INSTALLATION},O=${ORGANISATION}`;
const KEY = 'CORE-KEY-EVSIGN-01';

const roots: string[] = [];
/** A fresh root of this test, with an empty data directory in it. */
function scene(): { root: string; dataDir: string } {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row206-'));
  roots.push(root);
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return { root, dataDir };
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
/** See the header: only the steps ABOVE `root` are stated; the root and what is below it are read. */
const aboveIsSound =
  (root: string) =>
  (path: string): EntryFacts | null =>
    root !== path && (path === sep || root.startsWith(`${path}${sep}`)) ? { kind: 'directory', ownerUid: 0, mode: 0o755 } : real(path);

interface Run {
  readonly run: ProductionKeyRun;
  readonly prompts: string[];
  readonly out: string[];
}
async function command(root: string, args: readonly string[], typed: ReadonlyArray<string | null>, overrides: Partial<ProductionKeyPorts> = {}, onAsk: (prompt: string) => void = () => undefined): Promise<Run> {
  const answers = [...typed];
  const prompts: string[] = [];
  const out: string[] = [];
  let tick = 0;
  const run = await runProductionKeyCommand(args, {
    now: () => NOW + tick++,
    uid: () => UID,
    out: (line) => void out.push(line),
    ask: async (prompt) => {
      prompts.push(prompt);
      onAsk(prompt);
      return answers.length === 0 ? null : (answers.shift() ?? null);
    },
    inspect: aboveIsSound(root),
    ...overrides,
  });
  return { run, prompts, out };
}
const GOOD = [ORGANISATION, INSTALLATION, PROVISION_WORD];

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

describe('evidence:production-key provisions a key a production boot accepts (X1-1)', () => {
  it('on a fresh directory: exit 0, modes 0700 / 0600 / 0600 / 0644, the store loads and the parsed subject is the expected text', async () => {
    const { root, dataDir } = scene();
    const signer = join(dataDir, 'signer');
    let existedWhenAsked: boolean | null = null;
    const { run, prompts, out } = await command(root, ['--data-dir', dataDir], GOOD, {}, (prompt) => {
      if (prompt.includes(PROVISION_WORD)) existedWhenAsked = real(signer) !== null || readdirSync(dataDir).length > 0;
    });
    expect(run.lines.filter((line) => line.startsWith('evidence:production-key: '))).toEqual([
      'evidence:production-key: about to provision the PRODUCTION evidence signing key of this installation',
      'evidence:production-key: OK, the PRODUCTION evidence signing key was provisioned and loads',
    ]);
    expect([run.code, run.refusal]).toEqual([0, null]);
    // The word is asked BEFORE any key - or anything at all - exists.
    expect(existedWhenAsked).toBe(false);
    expect(prompts).toHaveLength(3);
    expect(out).toEqual(run.lines);

    expect(modeOf(signer)).toBe(0o700);
    expect(modeOf(join(signer, `${KEY}.p8`))).toBe(0o600);
    expect(modeOf(join(signer, `${KEY}.wrap`))).toBe(0o600);
    expect(modeOf(join(signer, `${KEY}.crt`))).toBe(0o644);
    expect(readdirSync(signer).sort()).toEqual([`${KEY}.crt`, `${KEY}.p8`, PROVISIONING_RECORD_NAME, `${KEY}.wrap`].sort());
    expect(readdirSync(join(dataDir, 'handover'))).toEqual([HANDOVER_RECORD_NAME]);
    expect(readdirSync(dataDir).sort()).toEqual(['handover', 'signer']);
    for (const name of readdirSync(signer)) expect(lstatSync(join(signer, name)).uid, name).toBe(UID);

    // The store loads through the loader of a boot and of the seal, and signs.
    const boot = loadSoftwareSigner({ dir: signer, now: NOW + 1_000 });
    const seal = loadSealingSigner({ dataDir, now: NOW + 1_000 });
    expect(boot.certificate.subject).toBe(SUBJECT);
    expect(productionKeySubjectOf(ORGANISATION, INSTALLATION)).toBe(SUBJECT);
    expect(seal.certificate.sha256).toBe(boot.certificate.sha256);
    expect([isDevelopmentKeySubject(boot.certificate.subject), isDevelopmentSigningCertificate(boot.certificate)]).toEqual([false, false]);
    expect([boot.certificate.notBefore, boot.certificate.notAfter]).toEqual([NOW, NOW + 1_825 * 86_400_000]);
    const message = new Uint8Array(32).fill(9);
    expect(verifyEd25519(boot.certificate.publicKey, message, boot.signer.sign(message) as Uint8Array)).toBe(true);

    // What it prints: the public facts, the fingerprint and the limits - and the two records say the same.
    const printed = run.lines.join('\n');
    expect(printed).toContain(`  subject:           ${SUBJECT}`);
    expect(printed).toContain(`  certificate:       sha256 ${boot.certificate.sha256}`);
    expect(printed).toContain(`  hand-over record:  ${join(dataDir, 'handover', HANDOVER_RECORD_NAME)}`);
    for (const limit of SELF_SIGNED_LIMITS) expect(printed.split(limit).length - 1, limit).toBe(2);
    const record = JSON.parse(readFileSync(join(signer, PROVISIONING_RECORD_NAME), 'utf8')) as Record<string, unknown>;
    expect(record).toMatchObject({ keyId: KEY, algorithm: 'Ed25519', selfSigned: true, certificateSha256: boot.certificate.sha256, subject: SUBJECT, serialNumber: boot.certificate.serialNumber, uid: UID, command: 'evidence:production-key' });
    expect(Object.keys(record).sort()).toEqual(['algorithm', 'certificateSha256', 'command', 'commandVersion', 'keyId', 'notAfter', 'notBefore', 'note', 'provisionedAt', 'record', 'selfSigned', 'serialNumber', 'subject', 'uid']);
    const handover = readFileSync(join(dataDir, 'handover', HANDOVER_RECORD_NAME), 'utf8');
    expect(handover).toContain(boot.certificate.pemText.trimEnd());
    expect(handover).toContain(`--trust ${boot.certificate.sha256}`);
    for (const limit of SELF_SIGNED_LIMITS) expect(handover, limit).toContain(limit);
    expect([modeOf(join(signer, PROVISIONING_RECORD_NAME)), modeOf(join(dataDir, 'handover', HANDOVER_RECORD_NAME))]).toEqual([0o644, 0o644]);
  });

  it('a second run answers KEY_EXISTS with the names that exist, and the directory is byte-identical', async () => {
    const { root, dataDir } = scene();
    expect((await command(root, ['--data-dir', dataDir], GOOD)).run.code).toBe(0);
    const before = tree(root);
    const second = await command(root, ['--data-dir', dataDir], GOOD);
    expect([second.run.code, second.run.refusal]).toEqual([1, ProductionKeyRefusal.KEY_EXISTS]);
    expect(second.run.lines.slice(0, 4)).toEqual([
      'evidence:production-key: REFUSED, KEY_EXISTS',
      `  present:     ${KEY}.p8, ${KEY}.wrap, ${KEY}.crt`,
      `  absent:      ${KEY}.compromised`,
      '  store loads: yes',
    ]);
    // Refused before anything is asked: the installer types nothing for a store that is there.
    expect(second.prompts).toEqual([]);
    expect(tree(root)).toEqual(before);
    expect(SIGNER_STORE_NAMES).toEqual([`${KEY}.p8`, `${KEY}.wrap`, `${KEY}.crt`, `${KEY}.compromised`]);
  });

  it('SX-07: an INCOMPLETE store is refused and never completed; a development store is named as one', async () => {
    // Each of the three files alone, and each pair: KEY_EXISTS, said not to load, nothing written.
    for (const kept of [['p8'], ['wrap'], ['crt'], ['p8', 'wrap'], ['p8', 'crt'], ['wrap', 'crt']]) {
      const { root, dataDir } = scene();
      expect(runDevKeyCommand(['--data-dir', dataDir], NOW).code).toBe(0);
      for (const extension of ['p8', 'wrap', 'crt']) if (!kept.includes(extension)) rmSync(join(dataDir, 'signer', `${KEY}.${extension}`));
      const before = tree(root);
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD);
      expect([run.code, run.refusal, prompts.length], kept.join('+')).toEqual([1, ProductionKeyRefusal.KEY_EXISTS, 0]);
      expect(run.lines[1], kept.join('+')).toBe(`  present:     ${kept.map((extension) => `${KEY}.${extension}`).join(', ')}`);
      expect(run.lines[3], kept.join('+')).toMatch(/^ {2}store loads: no \((KEY_ABSENT|CERTIFICATE_INVALID)\)$/);
      expect(tree(root), kept.join('+')).toEqual(before);
    }
    // A compromise mark alone is key material of the id as well.
    const marked = scene();
    mkdirSync(join(marked.dataDir, 'signer'), { mode: 0o700 });
    symlinkSync('/nonexistent/dems-row206', join(marked.dataDir, 'signer', `${KEY}.compromised`));
    expect((await command(marked.root, ['--data-dir', marked.dataDir], GOOD)).run.refusal).toBe(ProductionKeyRefusal.KEY_EXISTS);
    // A whole DEVELOPMENT store: refused, and said to be one.
    const development = scene();
    expect(runDevKeyCommand(['--data-dir', development.dataDir], NOW).code).toBe(0);
    const before = tree(development.root);
    const { run } = await command(development.root, ['--data-dir', development.dataDir], GOOD);
    expect(run.refusal).toBe(ProductionKeyRefusal.KEY_EXISTS);
    expect(run.lines[3]).toBe('  store loads: yes - it is a DEVELOPMENT key: a production installation uses its own data directory');
    expect(tree(development.root)).toEqual(before);
    // A record without a key: nothing is replaced either.
    const noted = scene();
    mkdirSync(join(noted.dataDir, 'handover'), { mode: 0o700 });
    symlinkSync('/nonexistent/dems-row206', join(noted.dataDir, 'handover', HANDOVER_RECORD_NAME));
    expect((await command(noted.root, ['--data-dir', noted.dataDir], GOOD)).run.refusal).toBe(ProductionKeyRefusal.RECORD_EXISTS);
  });
});

describe('every refused input leaves nothing behind', () => {
  const refusedWithNothing = async (label: string, typed: ReadonlyArray<string | null>, expected: ProductionKeyRefusal, notRepeated: string | null = null): Promise<void> => {
    const { root, dataDir } = scene();
    const { run } = await command(root, ['--data-dir', dataDir], typed);
    expect([run.code, run.refusal], label).toEqual([1, expected]);
    expect(tree(root), label).toEqual(['data/ 700']);
    // A refused value is not repeated in the output.
    if (notRepeated !== null && notRepeated.trim().length > 3) expect(run.lines.join('\n'), label).not.toContain(notRepeated);
  };

  it('SX-06: the organisation is ASCII, bounded and of a closed character set; anything else is refused before a key exists', async () => {
    const forms: Array<readonly [string, string]> = [
      ['a comma', 'Acme, Inc'],
      ['an equals sign', 'O=Acme'],
      ['a line break', 'Acme\nOU=Evidence signing X'],
      ['a carriage return', 'Acme\r'],
      ['a quote', 'Acme "Lab"'],
      ['a plus', 'Acme+Lab'],
      ['a slash', 'Acme/Lab'],
      ['a backslash', 'Acme\\Lab'],
      ['a tab', 'Acme\tLab'],
      ['a NUL', 'Acme\u0000Lab'],
      ['a letter outside ASCII', 'Kepolisiän'],
      ['a non-breaking space', 'Acme Lab'],
      ['a leading space', ' Acme'],
      ['a trailing space', 'Acme '],
      ['two spaces', 'Acme  Lab'],
      ['a leading hyphen', '-Acme'],
      ['one character', 'A'],
      ['65 characters', 'A'.repeat(65)],
      ['empty', ''],
      ['the development mark', 'DEVELOPMENT KEY - NOT FOR PRODUCTION'],
      ['the development mark in another case, inside a name', 'Acme development key - not for production unit'],
    ];
    for (const [label, value] of forms) {
      expect(organisationOf(value), label).toBeNull();
      await refusedWithNothing(label, [value, INSTALLATION, PROVISION_WORD], ProductionKeyRefusal.ORGANISATION_REFUSED, value);
    }
    // CONTROL: the bounds themselves are accepted.
    for (const value of ['AB', 'A'.repeat(64), 'Polda Metro Jaya - Ditreskrimum Unit 3.2', '4th Lab']) expect(organisationOf(value), value).toBe(value);
  });

  it('SX-06: the installation device id is held to the pattern of the configuration loader', async () => {
    for (const value of ['dems-jkt-07', '7DEMS', 'DEMS JKT 07', 'DEMS_JKT', `D${'A'.repeat(32)}`, '', 'DEMS-JKT-07,O=Other', 'DEMS-JKT-07\n']) {
      expect(installationDeviceIdOf(value), value).toBeNull();
      await refusedWithNothing(`id ${JSON.stringify(value)}`, [ORGANISATION, value, PROVISION_WORD], ProductionKeyRefusal.INSTALLATION_ID_REFUSED, value);
    }
    for (const value of ['D', 'DEMS-JKT-07', `D${'A'.repeat(31)}`]) expect(installationDeviceIdOf(value), value).toBe(value);
    // The pattern is the loader's own, called and not copied: the source holds no second copy of it.
    const source = readFileSync(join(__dirname, '..', '..', '..', 'cli', 'production-key-command.ts'), 'utf8');
    expect(source).toContain("import { ENV_INSTALLATION_DEVICE_ID, parseInstallationDeviceId } from '../src/config';");
    expect(source).not.toContain('[A-Z][A-Z0-9-]');
  });

  it('the confirmation word, and a command without a terminal', async () => {
    for (const word of ['provision', 'PROVISION ', ' PROVISION', 'yes', '']) await refusedWithNothing(`word ${JSON.stringify(word)}`, [ORGANISATION, INSTALLATION, word], ProductionKeyRefusal.NOT_CONFIRMED);
    await refusedWithNothing('no line at all', [], ProductionKeyRefusal.NOT_A_TERMINAL);
    await refusedWithNothing('the input ends after the organisation', [ORGANISATION], ProductionKeyRefusal.NOT_A_TERMINAL);
    await refusedWithNothing('the input ends before the word', [ORGANISATION, INSTALLATION], ProductionKeyRefusal.NOT_A_TERMINAL);
    // The real ports of the entry, in this test process (standard input is no terminal): no line is read.
    expect(await terminalPorts().ask('never shown: ')).toBeNull();
  });

  it('uid 0 (through the port) and an unknown user are refused', async () => {
    for (const [uid, expected] of [
      [0, ProductionKeyRefusal.ROOT_REFUSED],
      [-1, ProductionKeyRefusal.USER_UNKNOWN],
    ] as const) {
      const { root, dataDir } = scene();
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD, { uid: () => uid });
      expect([run.code, run.refusal, prompts.length]).toEqual([1, expected, 0]);
      expect(tree(root)).toEqual(['data/ 700']);
    }
  });

  it('usage: --data-dir only, required, absolute, as written; exit 2', async () => {
    const { root, dataDir } = scene();
    for (const args of [[], ['--data-dir'], ['--data-dir', ''], ['--data-dir', 'relative/data'], ['--data-dir', `${dataDir}/`], ['--data-dir', `${dataDir}/../data`], ['--data-dir', dataDir, '--organisation', 'X'], ['--data-dir', dataDir, 'extra'], ['--password', 'x'], ['--key-id', 'OTHER']]) {
      const { run, prompts } = await command(root, args, GOOD);
      expect([run.code, run.refusal, prompts.length, run.lines.length], args.join(' ')).toEqual([2, null, 0, 1]);
      expect(run.lines[0]).toMatch(/^evidence:production-key: usage: /);
    }
    expect(tree(root)).toEqual(['data/ 700']);
  });

  it('R-X1-7, SX-05: a link at the data directory, at `signer` or at `handover`, and an ancestor writable by group or others', async () => {
    // A link at the data directory itself: the target stays empty.
    const linked = scene();
    symlinkSync(linked.dataDir, join(linked.root, 'data-link'));
    const viaLink = await command(linked.root, ['--data-dir', join(linked.root, 'data-link')], GOOD);
    expect([viaLink.run.refusal, viaLink.prompts.length]).toEqual([ProductionKeyRefusal.DATA_DIR_LINK, 0]);
    expect(tree(linked.root)).toEqual(['data/ 700', 'data-link link']);

    // A link at `signer`, to a directory the caller owns: the key would have been written THERE.
    for (const [entry, expected] of [
      ['signer', ProductionKeyRefusal.SIGNER_LINK],
      ['handover', ProductionKeyRefusal.HANDOVER_LINK],
    ] as const) {
      const { root, dataDir } = scene();
      mkdirSync(join(root, 'elsewhere'), { mode: 0o700 });
      symlinkSync(join(root, 'elsewhere'), join(dataDir, entry));
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD);
      expect([run.code, run.refusal, prompts.length], entry).toEqual([1, expected, 0]);
      expect(tree(root), entry).toEqual(['data/ 700', `data/${entry} link`, 'elsewhere/ 700']);
    }

    // A link on the way: the directory ABOVE the data directory is a link.
    const way = scene();
    mkdirSync(join(way.root, 'real', 'data'), { recursive: true, mode: 0o700 });
    symlinkSync(join(way.root, 'real'), join(way.root, 'alias'));
    expect((await command(way.root, ['--data-dir', join(way.root, 'alias', 'data')], GOOD)).run.refusal).toBe(ProductionKeyRefusal.ANCESTOR_LINK);
    expect(readdirSync(join(way.root, 'real', 'data'))).toEqual([]);

    // An ancestor that group, or others, may write - with the REAL inspector too (no double at all).
    for (const bits of [0o770, 0o707, 0o777, 0o1777]) {
      const { root } = scene();
      const open = join(root, 'open');
      mkdirSync(join(open, 'data'), { recursive: true, mode: 0o700 });
      chmodSync(open, bits);
      const doubled = await command(root, ['--data-dir', join(open, 'data')], GOOD);
      expect([doubled.run.refusal, doubled.prompts.length], bits.toString(8)).toEqual([ProductionKeyRefusal.ANCESTOR_WRITABLE, 0]);
      const undoubled = await command(root, ['--data-dir', join(open, 'data')], GOOD, { inspect: undefined });
      expect([ProductionKeyRefusal.ANCESTOR_WRITABLE, ProductionKeyRefusal.ANCESTOR_LINK], bits.toString(8)).toContain(undoubled.run.refusal);
      expect(readdirSync(join(open, 'data'))).toEqual([]);
    }

    // The data directory itself: open to group, of another user (stated by the port), absent, a file.
    const loose = scene();
    chmodSync(loose.dataDir, 0o775);
    expect((await command(loose.root, ['--data-dir', loose.dataDir], GOOD)).run.refusal).toBe(ProductionKeyRefusal.DATA_DIR_WRITABLE);
    const foreign = scene();
    const stated = aboveIsSound(foreign.root);
    expect((await command(foreign.root, ['--data-dir', foreign.dataDir], GOOD, { inspect: (path) => (path === foreign.dataDir ? { kind: 'directory', ownerUid: UID + 1, mode: 0o700 } : stated(path)) })).run.refusal).toBe(ProductionKeyRefusal.DATA_DIR_OWNER);
    expect((await command(foreign.root, ['--data-dir', join(foreign.root, 'absent')], GOOD)).run.refusal).toBe(ProductionKeyRefusal.DATA_DIR_NOT_FOUND);
    // A file where the data directory is named (row 215c, review F-02: the case this comment listed and the file did not hold).
    writeFileSync(join(foreign.root, 'plain'), 'not a directory\n', { mode: 0o600 });
    const asFile = await command(foreign.root, ['--data-dir', join(foreign.root, 'plain')], GOOD);
    expect([asFile.run.refusal, asFile.prompts.length]).toEqual([ProductionKeyRefusal.DATA_DIR_NOT_A_DIRECTORY, 0]);
    expect(readFileSync(join(foreign.root, 'plain'), 'utf8')).toBe('not a directory\n');
    for (const scenes of [loose, foreign]) expect(readdirSync(scenes.dataDir)).toEqual([]);

    // An existing `signer` that is not private, or not the caller's: refused, untouched.
    const wide = scene();
    mkdirSync(join(wide.dataDir, 'signer'), { mode: 0o700 });
    chmodSync(join(wide.dataDir, 'signer'), 0o755);
    expect((await command(wide.root, ['--data-dir', wide.dataDir], GOOD)).run.refusal).toBe(ProductionKeyRefusal.SIGNER_MODE);
    expect(tree(wide.root)).toEqual(['data/ 700', 'data/signer/ 755']);
  });

  // ── Row 215c, review F-02: the codes of the directory rule that no case named ─────────────────────
  it('the nine codes of the directory rule that had no case: each by ONE stated fact of the `inspect` port, refused before anything is asked or made', async () => {
    const directory = (ownerUid: number, mode: number): EntryFacts => ({ kind: 'directory', ownerUid, mode });
    const file: EntryFacts = { kind: 'file', ownerUid: UID, mode: 0o600 };
    type Where = 'above' | 'data' | 'signer' | 'handover';
    const table: ReadonlyArray<readonly [ProductionKeyRefusal, Where, EntryFacts | null]> = [
      [ProductionKeyRefusal.ANCESTOR_NOT_FOUND, 'above', null],
      [ProductionKeyRefusal.ANCESTOR_NOT_A_DIRECTORY, 'above', file],
      // Neither root's nor the caller's.
      [ProductionKeyRefusal.ANCESTOR_OWNER, 'above', directory(UID + 1, 0o755)],
      [ProductionKeyRefusal.DATA_DIR_NOT_A_DIRECTORY, 'data', { kind: 'other', ownerUid: UID, mode: 0o700 }],
      [ProductionKeyRefusal.SIGNER_NOT_A_DIRECTORY, 'signer', file],
      // Root's is refused here too: the store is the caller's own, unlike a directory above it.
      [ProductionKeyRefusal.SIGNER_OWNER, 'signer', directory(0, 0o700)],
      [ProductionKeyRefusal.HANDOVER_NOT_A_DIRECTORY, 'handover', file],
      [ProductionKeyRefusal.HANDOVER_OWNER, 'handover', directory(UID + 1, 0o700)],
      [ProductionKeyRefusal.HANDOVER_WRITABLE, 'handover', directory(UID, 0o770)],
    ];
    expect(new Set(table.map(([code]) => code)).size).toBe(9);
    for (const [expected, where, facts] of table) {
      const { root, dataDir } = scene();
      const target = { above: root, data: dataDir, signer: join(dataDir, 'signer'), handover: join(dataDir, 'handover') }[where];
      const stated = aboveIsSound(root);
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD, { inspect: (path) => (path === target ? facts : stated(path)) });
      expect([run.code, run.refusal, prompts.length], expected).toEqual([1, expected, 0]);
      expect(run.lines[0], expected).toBe(`evidence:production-key: REFUSED, ${expected}`);
      expect(tree(root), expected).toEqual(['data/ 700']);
    }
    // CONTROL: the same double with the entry as it is refuses nothing of the rule (the word is then withheld).
    const { root, dataDir } = scene();
    const stated = aboveIsSound(root);
    expect((await command(root, ['--data-dir', dataDir], [ORGANISATION, INSTALLATION, 'no'], { inspect: (path) => stated(path) })).run.refusal).toBe(ProductionKeyRefusal.NOT_CONFIRMED);
  });
});

describe('row 215c, review F-02: after the word - what was written is read back, and a failure LEAVES it', () => {
  const LEFT = '  What was written is LEFT as it is: nothing is removed by this command. Do not hand any fingerprint over.';
  const STORE = [`${KEY}.crt`, `${KEY}.p8`, `${KEY}.wrap`];
  const keyIsThere = (dataDir: string): boolean => real(join(dataDir, 'signer', `${KEY}.p8`)) !== null;
  /** Nothing of a provisioned key was handed out: no "OK", no fingerprint line, no record, no hand-over folder. */
  const nothingHandedOver = (run: ProductionKeyRun, dataDir: string): void => {
    const printed = run.lines.join('\n');
    expect(printed).not.toContain('evidence:production-key: OK');
    expect(printed).not.toMatch(/sha256 [0-9a-f]{64}/);
    expect(readdirSync(join(dataDir, 'signer')).sort()).toEqual(STORE);
    expect(real(join(dataDir, 'handover'))).toBeNull();
  };

  it('R-X1-3, STORE_NOT_AS_WRITTEN: an entry that is not of the kind, the owner or the mode it was written with ends the command - the files are left, nothing is handed over', async () => {
    type Name = 'signer' | 'p8' | 'wrap' | 'crt';
    const table: ReadonlyArray<readonly [string, Name, (facts: EntryFacts) => EntryFacts | null]> = [
      ['the key file readable by the group', 'p8', (facts) => ({ ...facts, mode: 0o640 })],
      ['the key file gone', 'p8', () => null],
      ['the wrap file of another user', 'wrap', (facts) => ({ ...facts, ownerUid: UID + 1 })],
      ['the wrap file readable by others', 'wrap', (facts) => ({ ...facts, mode: 0o604 })],
      ['the certificate a link', 'crt', (facts) => ({ ...facts, kind: 'link' })],
      ['the certificate writable by the group', 'crt', (facts) => ({ ...facts, mode: 0o664 })],
      ['the store directory open to others', 'signer', (facts) => ({ ...facts, mode: 0o755 })],
      ['the store directory of another user', 'signer', (facts) => ({ ...facts, ownerUid: UID + 1 })],
    ];
    for (const [label, name, changed] of table) {
      const { root, dataDir } = scene();
      const signer = join(dataDir, 'signer');
      const target = name === 'signer' ? signer : join(signer, `${KEY}.${name}`);
      const stated = aboveIsSound(root);
      // The entry is answered as it is until the key was made; only the read-back sees the changed fact.
      const inspect = (path: string): EntryFacts | null => {
        const facts = stated(path);
        return path === target && facts !== null && keyIsThere(dataDir) ? changed(facts) : facts;
      };
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD, { inspect });
      expect([run.code, run.refusal, prompts.length], label).toEqual([1, ProductionKeyRefusal.STORE_NOT_AS_WRITTEN, 3]);
      expect(run.lines.slice(-2), label).toEqual(['evidence:production-key: REFUSED, STORE_NOT_AS_WRITTEN', LEFT]);
      nothingHandedOver(run, dataDir);
    }
    // CONTROL: the same double with every fact as it is provisions (exit 0) - the read-back is what refused above.
    const { root, dataDir } = scene();
    const stated = aboveIsSound(root);
    const control = await command(root, ['--data-dir', dataDir], GOOD, { inspect: (path) => stated(path) });
    expect([control.run.code, control.run.refusal]).toEqual([0, null]);
  });

  it('SUBJECT_MISMATCH: a store EXCHANGED between the write and the load - for a development key, or for another key of the same subject - is not announced as provisioned', async () => {
    const exchange = (from: string, to: string): void => {
      // Onto the existing files: their owner and modes stay as written, so the read-back and the loader accept the form.
      for (const name of STORE) writeFileSync(join(to, 'signer', name), readFileSync(join(from, 'signer', name)));
    };
    const development = scene();
    expect(runDevKeyCommand(['--data-dir', development.dataDir], NOW).code).toBe(0);
    const twin = scene();
    expect((await command(twin.root, ['--data-dir', twin.dataDir], GOOD)).run.code).toBe(0);
    for (const [label, other] of [
      ['a development key', development],
      ['another key with the same subject', twin],
    ] as const) {
      const { root, dataDir } = scene();
      const stated = aboveIsSound(root);
      let exchanged = false;
      // The LAST question of the read-back (the certificate) is answered, and then the store is another one.
      const inspect = (path: string): EntryFacts | null => {
        const facts = stated(path);
        if (!exchanged && path === join(dataDir, 'signer', `${KEY}.crt`) && keyIsThere(dataDir)) {
          exchanged = true;
          exchange(other.dataDir, dataDir);
        }
        return facts;
      };
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD, { inspect });
      expect(exchanged, label).toBe(true);
      expect([run.code, run.refusal, prompts.length], label).toEqual([1, ProductionKeyRefusal.SUBJECT_MISMATCH, 3]);
      expect(run.lines.slice(-2), label).toEqual(['evidence:production-key: REFUSED, SUBJECT_MISMATCH', LEFT]);
      nothingHandedOver(run, dataDir);
      // The store that is there DOES load - it is the other key: only the comparison with what was made refused it.
      const there = loadSealingSigner({ dataDir, now: NOW + 1_000 }).certificate;
      expect(there.sha256, label).toBe(loadSealingSigner({ dataDir: other.dataDir, now: NOW + 1_000 }).certificate.sha256);
      expect(there.subject === SUBJECT, label).toBe(other === twin);
    }
  });

  it('a provisioning that fails says FAILED with a code of the signer or one fixed word, never a text of the operating system; what is there is left', async () => {
    // (a) The store holds a key the `inspect` port does not show. Row K6: the STORE is asked for its next key id before anything
    // is asked of the installer, so this ends REFUSED, KEY_EXISTS with no prompt (before row K6: three prompts, then FAILED).
    const hidden = scene();
    expect((await command(hidden.root, ['--data-dir', hidden.dataDir], GOOD)).run.code).toBe(0);
    const before = tree(hidden.root);
    const stated = aboveIsSound(hidden.root);
    const blind = (path: string): EntryFacts | null => (path.startsWith(`${join(hidden.dataDir, 'signer')}${sep}`) || path.startsWith(`${join(hidden.dataDir, 'handover')}${sep}`) ? null : stated(path));
    const second = await command(hidden.root, ['--data-dir', hidden.dataDir], GOOD, { inspect: blind });
    expect([second.run.code, second.run.refusal, second.prompts.length]).toEqual([1, ProductionKeyRefusal.KEY_EXISTS, 0]);
    expect(second.run.lines.slice(0, 2)).toEqual(['evidence:production-key: REFUSED, KEY_EXISTS', `  The key id ${KEY} is SPENT: the store names a later key of the series, in an entry or in its pointer.`]);
    expect(tree(hidden.root)).toEqual(before);
    // (a2) An entry of the key id that appears AFTER the look and the store's answer - planted while the word is asked (a text,
    // not a key): the store's own refusal at the provisioning (KEY_EXISTS), after the word. FAILED, and what is there is left.
    const late = scene();
    const lateSigner = join(late.dataDir, 'signer');
    const raced = await command(late.root, ['--data-dir', late.dataDir], GOOD, {}, (prompt) => {
      if (!prompt.includes(PROVISION_WORD)) return;
      mkdirSync(lateSigner, { mode: 0o700 });
      writeFileSync(join(lateSigner, `${KEY}.crt`), 'NOT A CERTIFICATE\n', { mode: 0o644 });
    });
    expect([raced.run.code, raced.run.refusal, raced.prompts.length]).toEqual([1, ProductionKeyRefusal.KEY_EXISTS, 3]);
    expect(raced.run.lines.slice(-2)).toEqual(['evidence:production-key: FAILED, KEY_EXISTS', LEFT]);
    expect(tree(late.root)).toEqual(['data/ 700', 'data/signer/ 700', `data/signer/${KEY}.crt 644 ${Buffer.from('NOT A CERTIFICATE\n').toString('hex')}`]);

    // (b) The store directory cannot be made (the data directory takes no entry): the fixed word, no refusal code, nothing made.
    const closed = scene();
    chmodSync(closed.dataDir, 0o500);
    try {
      const { run, prompts } = await command(closed.root, ['--data-dir', closed.dataDir], GOOD);
      expect([run.code, run.refusal, prompts.length]).toEqual([1, null, 3]);
      expect(run.lines.slice(-2)).toEqual(['evidence:production-key: FAILED, UNREADABLE', LEFT]);
      expect(run.lines.join('\n')).not.toMatch(/EACCES|EPERM|permission|denied|mkdir/i);
      expect(tree(closed.root)).toEqual(['data/ 500']);
    } finally {
      chmodSync(closed.dataDir, 0o700);
    }
  });
});

// Row K6 (decisions C84, C86; the left-over requests of rows 226d and 228b). Planted entries are TEXTS, never keys; the keys of
// the two control runs are made by the command in the scene's temporary root, removed in `afterAll`.
describe('row K6: a reserved installation id is refused as it is typed; a spent or unreadable store is refused before the first prompt', () => {
  const RESERVED_LINES = [
    'evidence:production-key: REFUSED, INSTALLATION_ID_RESERVED',
    '  This installation device id is reserved for tests and demonstration data: no installation may carry it, and a production start refuses it.',
    '  No key was made and nothing was written. Give the installation an id of its own and run the command again.',
  ];

  it('each id of the boot checks\' closed list ends INSTALLATION_ID_RESERVED after the second prompt: no word asked, no key, nothing written, the id not repeated', async () => {
    // The list is the boot check's own, imported by the command - and it is these three.
    expect(Object.values(ReservedInstallationId).sort()).toEqual(['DEMS-IR-01', 'DEMS-JKT-07', 'DEMS-TEST-01']);
    for (const id of Object.values(ReservedInstallationId)) {
      const { root, dataDir } = scene();
      const { run, prompts, out } = await command(root, ['--data-dir', dataDir], [ORGANISATION, id, PROVISION_WORD]);
      expect([run.code, run.refusal, prompts.length], id).toEqual([1, ProductionKeyRefusal.INSTALLATION_ID_RESERVED, 2]);
      expect(run.lines, id).toEqual(RESERVED_LINES);
      expect(out, id).toEqual(RESERVED_LINES);
      expect(run.lines.join('\n'), id).not.toContain(id);
      expect(tree(root), id).toEqual(['data/ 700']);
      // The form rule is as it was: the id is well-formed, and it is the LIST that refuses it.
      expect(installationDeviceIdOf(id), id).toBe(id);
      expect(installationIdIsReserved(id), id).toBe(true);
    }
    const source = readFileSync(join(__dirname, '..', '..', '..', 'cli', 'production-key-command.ts'), 'utf8');
    expect(source).toContain("import { isReservedInstallationId } from '../src/capture/boot/checks';");
    for (const id of Object.values(ReservedInstallationId).filter((value) => value !== ReservedInstallationId.DOCUMENTED_EXAMPLE)) expect(source, id).not.toContain(id);
    // CONTROL: an id beside the list is not reserved, and the command makes its key.
    for (const free of ['DEMS-JKT-08', 'DEMS-TEST-011', 'DEMS-TEST-0']) expect(installationIdIsReserved(free), free).toBe(false);
    const free = scene();
    const made = await command(free.root, ['--data-dir', free.dataDir], [ORGANISATION, 'DEMS-JKT-08', PROVISION_WORD]);
    expect([made.run.code, made.run.refusal, made.prompts.length]).toEqual([0, null, 3]);
  });

  it('a store whose first key id is SPENT - a later id in an entry, a copy, a record, or the pointer - is refused KEY_EXISTS with NO prompt; a pointer that cannot be taken is STORE_REFUSED', async () => {
    const SPENT = [
      'evidence:production-key: REFUSED, KEY_EXISTS',
      `  The key id ${KEY} is SPENT: the store names a later key of the series, in an entry or in its pointer.`,
      '  A key id is never used for a second key, and this command makes the FIRST key of an installation only.',
      '  Nothing was asked and nothing was written. What was removed from a store by hand is put back by hand: no command repairs it.',
    ];
    const planted: ReadonlyArray<readonly [string, string, number]> = [
      ['CORE-KEY-EVSIGN-02.crt', 'NOT A CERTIFICATE\n', 0o644],
      ['CORE-KEY-EVSIGN-03.crt.bak', 'NOT A CERTIFICATE\n', 0o644],
      ['CORE-KEY-EVSIGN-02.provisioned.json', '{}\n', 0o644],
      ['CORE-KEY-EVSIGN-02.compromised', '', 0o600],
      ['ACTIVE', `${KEY}\n`, 0o600],
      ['ACTIVE', 'CORE-KEY-EVSIGN-02\n', 0o600],
    ];
    for (const [name, text, mode] of planted) {
      const { root, dataDir } = scene();
      mkdirSync(join(dataDir, 'signer'), { mode: 0o700 });
      writeFileSync(join(dataDir, 'signer', name), text, { mode });
      chmodSync(join(dataDir, 'signer', name), mode);
      const before = tree(root);
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD);
      expect([run.code, run.refusal, prompts.length], `${name} ${JSON.stringify(text)}`).toEqual([1, ProductionKeyRefusal.KEY_EXISTS, 0]);
      expect(run.lines, name).toEqual(SPENT);
      expect(tree(root), name).toEqual(before);
    }
    // A pointer that cannot be taken: the store does not say which id is next. Refused by name, not repaired, nothing asked.
    for (const [text, mode] of [['garbage\n', 0o600], [`${KEY}\n`, 0o640], ['', 0o600]] as const) {
      const { root, dataDir } = scene();
      mkdirSync(join(dataDir, 'signer'), { mode: 0o700 });
      writeFileSync(join(dataDir, 'signer', 'ACTIVE'), text, { mode });
      chmodSync(join(dataDir, 'signer', 'ACTIVE'), mode);
      const before = tree(root);
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD);
      expect([run.code, run.refusal, prompts.length, run.lines.slice(0, 2)], JSON.stringify(text)).toEqual([1, ProductionKeyRefusal.STORE_REFUSED, 0, ['evidence:production-key: REFUSED, STORE_REFUSED', '  the store says: ACTIVE_KEY_POINTER_INVALID']]);
      expect(run.lines).toHaveLength(4);
      expect(tree(root), JSON.stringify(text)).toEqual(before);
    }
    // CONTROLS: an empty store directory, and an entry that names no key id of the series, spend nothing - the first key is made.
    for (const other of [null, 'CORE-KEY-EVSIGN-0.note', 'OTHER-KEY-02.crt']) {
      const { root, dataDir } = scene();
      mkdirSync(join(dataDir, 'signer'), { mode: 0o700 });
      if (other !== null) writeFileSync(join(dataDir, 'signer', other), 'a note\n', { mode: 0o644 });
      const { run, prompts } = await command(root, ['--data-dir', dataDir], GOOD);
      expect([run.code, run.refusal, prompts.length], String(other)).toEqual([0, null, 3]);
    }
  });
});

describe('R-X1-1, R-X1-2: nothing of the key is printed, logged, recorded or put into an error', () => {
  it('a sweep of standard output, standard error, the console, every line, both records and every error counts 0', async () => {
    const written: string[] = [];
    const capture = (chunk: unknown): boolean => {
      written.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('latin1'));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(capture as typeof process.stdout.write);
    vi.spyOn(process.stderr, 'write').mockImplementation(capture as typeof process.stderr.write);
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void written.push(parts.map((part) => show(part, { depth: 8 })).join(' ')));

    const { root, dataDir } = scene();
    const runs: ProductionKeyRun[] = [];
    const thrown: unknown[] = [];
    /** The entry's own ports - its `out` writes to standard output as a real run does - with typed lines and the stated ancestors. */
    const typedAt = (lines: ReadonlyArray<string | null>): ProductionKeyPorts => {
      const answers = [...lines];
      return { ...terminalPorts(), now: () => NOW, ask: async () => (answers.length === 0 ? null : (answers.shift() ?? null)), inspect: aboveIsSound(root) };
    };
    const attempt = async (args: readonly string[], lines: ReadonlyArray<string | null>, ports: Partial<ProductionKeyPorts> = {}): Promise<void> => {
      try {
        runs.push(await runProductionKeyCommand(args, { ...typedAt(lines), ...ports }));
      } catch (error) {
        thrown.push(error);
      }
    };
    await attempt(['--data-dir', dataDir], GOOD);
    // Every later run is made with the key IN the store: each refusal and each failure that can follow.
    await attempt(['--data-dir', dataDir], GOOD);
    await attempt(['--data-dir', dataDir], GOOD, { uid: () => 0 });
    await attempt(['--data-dir', dataDir, '--verbose'], GOOD);
    chmodSync(join(dataDir, 'signer', `${KEY}.p8`), 0o644);
    await attempt(['--data-dir', dataDir], GOOD);
    chmodSync(join(dataDir, 'signer', `${KEY}.p8`), 0o600);
    chmodSync(join(dataDir, 'signer'), 0o755);
    await attempt(['--data-dir', dataDir], GOOD);
    chmodSync(join(dataDir, 'signer'), 0o700);
    // A run that fails AFTER the key was made: the load is refused (the clock of the second read is before the validity), files left.
    const late = scene();
    let reads = 0;
    await attempt(['--data-dir', late.dataDir], GOOD, { now: () => (reads++ === 0 ? NOW : NOW - 10_000), inspect: aboveIsSound(late.root) });
    // A run that fails at the records: `handover` cannot take a file (it is read-only).
    const sealed = scene();
    mkdirSync(join(sealed.dataDir, 'handover'), { mode: 0o500 });
    await attempt(['--data-dir', sealed.dataDir], GOOD, { inspect: aboveIsSound(sealed.root) });
    chmodSync(join(sealed.dataDir, 'handover'), 0o700);
    vi.restoreAllMocks();

    expect(thrown).toEqual([]);
    expect(runs.map((run) => [run.code, run.refusal])).toEqual([
      [0, null],
      [1, ProductionKeyRefusal.KEY_EXISTS],
      [1, ProductionKeyRefusal.ROOT_REFUSED],
      [2, null],
      [1, ProductionKeyRefusal.KEY_EXISTS],
      [1, ProductionKeyRefusal.SIGNER_MODE],
      [1, ProductionKeyRefusal.LOAD_FAILED],
      [1, ProductionKeyRefusal.RECORD_NOT_WRITTEN],
    ]);
    expect(runs[4]?.lines[3]).toBe('  store loads: no (KEY_MODE)');
    expect(runs[6]?.lines.at(-2)).toBe('  the loader says: CERTIFICATE_NOT_VALID_NOW');
    // After a failure the files are LEFT (R-X1-3): never removed.
    expect(readdirSync(join(late.dataDir, 'signer')).sort()).toEqual([`${KEY}.crt`, `${KEY}.p8`, `${KEY}.wrap`]);
    expect(readdirSync(join(sealed.dataDir, 'signer')).sort()).toEqual([`${KEY}.crt`, `${KEY}.p8`, PROVISIONING_RECORD_NAME, `${KEY}.wrap`].sort());

    // THE NEEDLES: the key of each of the three stores, in every form the store handles or could give out.
    const needles: string[] = ['PRIVATE KEY'];
    for (const store of [dataDir, late.dataDir, sealed.dataDir]) {
      const secret = readFileSync(join(store, 'signer', `${KEY}.wrap`));
      const wrapped = readFileSync(join(store, 'signer', `${KEY}.p8`));
      const opened = createPrivateKey({ key: wrapped, format: 'der', type: 'pkcs8', passphrase: secret });
      const plain = opened.export({ format: 'der', type: 'pkcs8' });
      const seed = plain.subarray(16);
      expect([secret.length, seed.length]).toEqual([32, 32]);
      const pem = opened.export({ format: 'pem', type: 'pkcs8' }) as string;
      const jwk = opened.export({ format: 'jwk' }) as { d?: string };
      for (const bytes of [secret, wrapped, plain, seed]) needles.push(bytes.toString('hex'), bytes.toString('hex').toUpperCase(), bytes.toString('base64'), bytes.toString('base64url'), bytes.toString('latin1'));
      needles.push(pem.split('\n')[1] ?? 'no pem body', jwk.d ?? 'no jwk member');
      // Also half a value: a line that held the first or the second half of a secret would be found.
      needles.push(secret.toString('hex').slice(0, 32), secret.toString('hex').slice(32), seed.toString('hex').slice(0, 32), seed.toString('base64').slice(0, 22), wrapped.toString('base64').slice(0, 40));
    }
    expect(needles.every((needle) => needle.length >= 11)).toBe(true);

    const haystacks: Record<string, string> = {
      'standard output, standard error and the console': written.join(''),
      'every returned line': runs.flatMap((run) => run.lines).join('\n'),
      'the results as objects': runs.map((run) => `${show(run, { depth: 8 })}\n${JSON.stringify(run)}`).join('\n'),
    };
    for (const store of [dataDir, late.dataDir, sealed.dataDir]) {
      for (const [folder, name] of [
        ['signer', PROVISIONING_RECORD_NAME],
        ['signer', `${KEY}.crt`],
        ['handover', HANDOVER_RECORD_NAME],
      ] as const) {
        const file = join(store, folder, name);
        if (real(file) !== null) haystacks[`${folder}/${name} of ${store}`] = readFileSync(file, 'latin1');
      }
    }
    expect(haystacks['standard output, standard error and the console']).toContain('evidence:production-key: OK');
    expect(Object.keys(haystacks)).toHaveLength(9);
    const hits = (text: string): number => needles.reduce((count, needle) => count + (text.split(needle).length - 1), 0);
    for (const [where, text] of Object.entries(haystacks)) expect(hits(text), where).toBe(0);
    // POSITIVE CONTROL: the same count FINDS each needle in a text that holds it, and the key files themselves.
    for (const needle of needles) expect(hits(`x ${needle} y`), 'a planted needle').toBeGreaterThanOrEqual(1);
    expect(hits(readFileSync(join(dataDir, 'signer', `${KEY}.wrap`), 'latin1'))).toBeGreaterThanOrEqual(1);
    expect(hits(readFileSync(join(dataDir, 'signer', `${KEY}.p8`), 'latin1'))).toBeGreaterThanOrEqual(1);
  });

  it('R-X1-4, static: the command imports no cryptography module, reads no environment and has no random seam', () => {
    // The command is not the server: no production source under `src/` names either of its files, so the server cannot load it.
    const sources = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(300);
    expect(sources.filter((file) => /from\s+'[^']*production-key[^']*'/.test(file.text)).map((file) => file.path)).toEqual([]);
    for (const file of [join(__dirname, '..', '..', '..', 'cli', 'production-key-command.ts'), join(__dirname, '..', '..', '..', 'cli', 'production-key.ts')]) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(new RegExp(`['"](?:node:)?${'cry'}${'pto'}['"]`));
      expect(code, file).not.toMatch(new RegExp(`process\\s*\\.\\s*${'en'}${'v'}\\b`));
      expect(code, file).not.toMatch(/random|wrapSecrets|validityDays|unlink|rmSync|renameSync|rmdir|truncate|copyFile/i);
    }
    // POSITIVE CONTROL of the three patterns.
    expect(`import { x } from 'node:${'cry'}${'pto'}';`).toMatch(new RegExp(`['"](?:node:)?${'cry'}${'pto'}['"]`));
    expect(`process.${'en'}${'v'}.X`).toMatch(new RegExp(`process\\s*\\.\\s*${'en'}${'v'}\\b`));
  });
});

describe('"OK" means: boot checks 4 and 4b of a REAL_PRODUCTION start pass on this store', () => {
  const program: ProgramFacts = { absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: UID, mode: 0o755 }, directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }], directoriesResolved: [{ ownerUid: 0, mode: 0o755 }], serverUid: UID };
  const volume: EvidenceVolumeFacts = { absolute: true, present: true, directory: true, ownerUid: UID, mode: 0o700, serverUid: UID, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true, totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 };

  /**
   * The boot step as the capture unit mounts it, for REAL_PRODUCTION, with its OWN readers of the stored
   * key (neither `signingKeyProblem` nor `signingKeyIsDevelopment` is handed in). The checks before the
   * key (1 to 3) are answered by passing facts; check 4c - the one directly AFTER 4 and 4b - is told
   * "7 operators": a start that is refused THERE has passed 4 and 4b, and no worker was started.
   */
  async function refusalOf(dataDir: string): Promise<{ code: string; reason: string | null }> {
    const sinks: CaptureBootSinks = { info() {}, warn() {}, error() {}, persist() {} };
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir, captureMode: 'real', captureWorkerPath: '/opt/dems/capture-worker' }), stages: {}, readiness: createReadiness(log), clock: { now: () => NOW + 1_000 } } as unknown as FastifyInstance;
    const launcher = (): never => {
      throw new Error('a worker was started');
    };
    // Row 228 (check 4b-2) asks which installation this Core is: the mount is told the one the command was typed (row 215c kept this case green).
    mountCaptureBootChecks(app, { sinks, timers: createSystemTimers(), inspect: () => program, probeEvidenceVolume: () => volume, demoPasswordOperators: async () => 7, launcher: launcher as never, installationId: INSTALLATION });
    const failure = await app.readiness.boot().then(
      () => null,
      (error: unknown) => error,
    );
    if (!(failure instanceof BootError) || !(failure.cause instanceof CaptureBootError)) throw new Error('the boot was not refused by the capture boot checks');
    expect(failure.stepId).toBe(CAPTURE_BOOT_STEP);
    return { code: failure.cause.code, reason: failure.cause.reason };
  }

  it('the provisioned store passes 4 and 4b (the start goes on to 4c); a development store is still refused by 4b; an empty or incomplete one by 4', async () => {
    const { root, dataDir } = scene();
    expect((await command(root, ['--data-dir', dataDir], GOOD)).run.code).toBe(0);
    expect(await refusalOf(dataDir)).toEqual({ code: CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, reason: 'operators=7' });

    // NEGATIVE CONTROL: the check is not weakened - the same form of store from the DEVELOPMENT command stops at 4b.
    const development = scene();
    expect(runDevKeyCommand(['--data-dir', development.dataDir], NOW).code).toBe(0);
    expect(await refusalOf(development.dataDir)).toEqual({ code: CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, reason: null });

    // No store, and the provisioned store with one file gone: check 4.
    const empty = scene();
    expect(await refusalOf(empty.dataDir)).toEqual({ code: CaptureBootRefusal.SIGNING_KEY_UNUSABLE, reason: 'KEY_ABSENT' });
    const broken = scene();
    expect((await command(broken.root, ['--data-dir', broken.dataDir], GOOD)).run.code).toBe(0);
    rmSync(join(broken.dataDir, 'signer', `${KEY}.crt`));
    expect(await refusalOf(broken.dataDir)).toEqual({ code: CaptureBootRefusal.SIGNING_KEY_UNUSABLE, reason: 'CERTIFICATE_INVALID' });
  });
});
