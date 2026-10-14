// Task 4 row 208 (package X1-1, M11; design 05 sections 2.10 and 2.11; SX-05, SX-17): THE PROOF of the
// production key command against the REAL boot function and the seal. Tests only.
//
// Row 206 held "OK means checks 4 and 4b pass" on a hand-made mount whose checks 1 to 3 were answered by
// stated facts and whose check 4c was told a number: the start was refused AT 4c, and 4 and 4b were passed
// by inference. This file goes further and states nothing about a check:
//
//   - THE BOOT is the real app factory (`buildApp`) on a throw-away clone of the seed, in REAL_PRODUCTION.
//     The boot checks are mounted by the capture unit itself (`src/capture/index.ts` hands `timers` and
//     `sinks` only), so NO seam of the mount exists here: `runCaptureBootChecks` is called by the boot step
//     with its own readers of the stored key (the defaults of `capture/boot/index.ts` behind the seams
//     `signingKeyProblem` and `signingKeyIsDevelopment`, which nothing here hands in), its own inspector,
//     its own probe of the evidence volume, its own count of the demo passwords on PostgreSQL and its own
//     worker handshake. The file names no internal of the boot folder, so it holds before and after row
//     211 (one loaded certificate for checks 4 and 4b).
//   - THE STORE is the one `runProductionKeyCommand` made; the configuration's data directory IS the
//     command's `--data-dir`.
//   - THE NEGATIVE CONTROL is the same configuration on the same kind of clone with ONE difference: the
//     store was made by the development command.
//   - THE SEAL is the real pipeline (`createSealingPipeline`), its real step SIGN_MANIFEST, with the signer
//     the seal's own loader (`loadSealingSigner`) reads from the very store the boot just accepted; the
//     package is then judged by the real verifier against the fingerprint THE COMMAND PRINTED.
//
// WHERE THE SEAL PROOF STOPS (said in the record too). "All-production sources" are STATED here, as four
// rows handed to the pipeline through its session port - the port `createSealSessionReader`
// (`sealing-host/session-reader.ts`) fills in the product from `session_capture_sources`. No product path
// can write such rows before the class-C lift (row 88): the production kinds have no opener, and the
// registry refuses to open them (`SOURCE_KIND_NOT_RECORDABLE`). So the proof begins at the pipeline's
// session port and covers everything after it; the rows' way from a recording to that port is not proven.
//
// WHAT IS A DOUBLE HERE, and nothing else is:
//   1. the host facts of steps 4d and 4e (`provideTestCaptureHost`, decision C46) and the two stand-in
//      delivered programs (`testHostPrograms`, C55 DD-3);
//   2. the worker program: row 61's stand-in script that says one HELLO;
//   3. the directories ABOVE the test's own root, for the COMMAND's directory rule only (row 206's one
//      double: on this host the temporary folder lies below a directory every user may write);
//   4. the recorded media and the session facts of the seal (the sealing unit's own harness).
// The three stand-in programs lie in row 61's fixture directory because the boot's path rule (real here)
// refuses a program below the temporary folder. NO KEY IS EVER PUT THERE: every key of this file is made
// by the test in a fresh directory of the temporary folder, which the test removes - also after a failure
// (`afterAll`, which then asserts that each directory is gone). The test reads no key file: what it
// compares of a store are names, modes and sizes (`lstat`), and certificates.
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { PackageFile, type SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import { pemCertificateSha256, verifyPackageV2 } from '@dems/shared/evidence-verify';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PROVISION_WORD, runProductionKeyCommand, type EntryFacts } from '../../../cli/production-key-command';
import { useTestDatabase } from '../../../test/helpers/db';
import { provideTestCaptureHost, testHostPrograms } from '../../../test/support/capture-host';
import { FIXED_NOW, engineApp, type EngineApp } from '../../../test/support/engine';
import { CAPTURE_BOOT_STEP, CaptureBootError, CaptureBootRefusal, captureBootControl, type HostProfileStatement } from '../../capture/boot';
import { hostProfileNotAskedOf } from '../../sealing-host/session-reader';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { CAPTURE_FENCE_BOOT_STEP } from '../../capture/fence';
import type { ConfigInput } from '../../config';
import { corePorts } from '../../evidence-verify';
import { hashPassword } from '../../modules/identity/password-hash/password-hash';
import { BootError } from '../../plugins/readiness';
import { runDevKeyCommand } from '../dev-key-cli';
import { isDevelopmentSigningCertificate, loadSealingSigner, sealingFailureReason } from '../index';
import { removePackages } from './package-support';
import { CLOCK_START, harnessOf, recordSession, removeRecordings, type Recording } from './pipeline-support';

const db = useTestDatabase({ template: 'seed' });
const UID = typeof process.getuid === 'function' ? process.getuid() : -1;
const KEY = 'CORE-KEY-EVSIGN-01';
/** One fixed, obviously synthetic organisation and installation (SX-19). */
const ORGANISATION = 'SYNTHETIC TEST ORG - NOT AN INSTALLATION';
const INSTALLATION = 'DEMS-TEST-208';
/** The instant both commands provision at: before the boot's clock and before the seal's. */
const PROVISIONED_AT = FIXED_NOW;
const BOOT_AT = FIXED_NOW + 60_000;

// ── Everything this file makes on disk, and its removal ─────────────────────────────────────────────
const roots: string[] = [];
const recordingRoots: string[] = [];
/** Row 61's fixture directory: the worker stand-in and the two stand-in delivered programs. Never a key. */
const programs = realBootFixture('row208');
afterAll(() => {
  removeRecordings();
  removePackages();
  programs.remove();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  for (const gone of [...roots, ...recordingRoots, programs.dataDir]) expect(() => lstatSync(gone), gone).toThrow();
});

type Clone = Awaited<ReturnType<typeof db.another>>;
/** Every clone is dropped when its case ends, with the app registered on it - also when the case failed. */
const caseClones: Clone[] = [];
afterEach(async () => {
  const problems: unknown[] = [];
  for (const target of caseClones.splice(0).reverse()) {
    try {
      await target.drop();
    } catch (error) {
      problems.push(error);
    }
  }
  if (problems.length > 0) throw problems[0];
});

/** A fresh root of this test in the temporary folder, with an empty private data directory in it. */
function scene(): { root: string; dataDir: string } {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row208-'));
  roots.push(root);
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return { root, dataDir };
}

const entryOf = (path: string): EntryFacts | null => {
  try {
    const status = lstatSync(path);
    return { kind: status.isSymbolicLink() ? 'link' : status.isDirectory() ? 'directory' : status.isFile() ? 'file' : 'other', ownerUid: status.uid, mode: status.mode & 0o7777 };
  } catch {
    return null;
  }
};
/** Double 3 of the header: only the steps ABOVE `root` are stated; the root and what is below it are read. */
const aboveIsSound =
  (root: string) =>
  (path: string): EntryFacts | null =>
    root !== path && (path === sep || root.startsWith(`${path}${sep}`)) ? { kind: 'directory', ownerUid: 0, mode: 0o755 } : entryOf(path);

/** The production command on a fresh data directory, and THE FINGERPRINT IT PRINTED (read from its output, nowhere else). */
async function productionStore(): Promise<{ dataDir: string; printedSha256: string; printedSubject: string }> {
  const { root, dataDir } = scene();
  const typed = [ORGANISATION, INSTALLATION, PROVISION_WORD];
  const run = await runProductionKeyCommand(['--data-dir', dataDir], {
    now: () => PROVISIONED_AT,
    uid: () => UID,
    out: () => undefined,
    ask: async () => typed.shift() ?? null,
    inspect: aboveIsSound(root),
  });
  expect([run.code, run.refusal]).toEqual([0, null]);
  const ok = run.lines.indexOf('evidence:production-key: OK, the PRODUCTION evidence signing key was provisioned and loads');
  expect(ok).toBeGreaterThan(-1);
  const after = run.lines.slice(ok);
  const printedSha256 = after.map((line) => /^ {2}certificate: +sha256 ([0-9a-f]{64})$/.exec(line)?.[1]).find((found) => found !== undefined);
  const printedSubject = after.map((line) => /^ {2}subject: +(.+)$/.exec(line)?.[1]).find((found) => found !== undefined);
  if (printedSha256 === undefined || printedSubject === undefined) throw new Error('the command printed no certificate fingerprint or no subject');
  return { dataDir, printedSha256, printedSubject };
}

/** The development command on a fresh data directory: a store of the same form, with the development mark. */
function developmentStore(): { dataDir: string; printedSha256: string } {
  const { dataDir } = scene();
  const run = runDevKeyCommand(['--data-dir', dataDir], PROVISIONED_AT);
  expect(run.code).toBe(0);
  const printedSha256 = run.lines.map((line) => /^ {2}certificate: sha256 ([0-9a-f]{64})$/.exec(line)?.[1]).find((found) => found !== undefined);
  if (printedSha256 === undefined) throw new Error('the development command printed no certificate fingerprint');
  return { dataDir, printedSha256 };
}

/** The names, modes, owners and sizes of a store (`lstat` only: no file of the store is opened by the test). */
const storeFacts = (dataDir: string): string[] =>
  readdirSync(join(dataDir, 'signer'))
    .sort()
    .map((name) => {
      const status = lstatSync(join(dataDir, 'signer', name));
      return `${name} ${(status.mode & 0o7777).toString(8)} uid=${status.uid} ${status.size} ${status.mtimeMs}`;
    });

/**
 * A password of the operators' own for a REAL_PRODUCTION clone (check 4c, D241): built at run time, kept
 * nowhere; the stored hash sets of the clone are replaced by one the product's hasher derived from it.
 */
let ownRecord: ReturnType<typeof hashPassword> | null = null;
async function ownCredentials(owner: Pool): Promise<void> {
  ownRecord ??= hashPassword(['own', 'row208', String(process.pid), 'k7Qd'].join('-'));
  const record = await ownRecord;
  await owner.query('UPDATE public.operator_credentials SET algorithm = $1, memory_kib = $2, passes = $3, parallelism = $4, salt = $5, hash = $6', [record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);
}

/**
 * A clone a production Core can start on: no speech-to-text (a test host has no speech runtime), an empty
 * selector (the seed's devices are simulated ones, which the fence refuses in production) and no operator
 * with the published demo password. The owner writes it, as a fixture.
 */
async function productionClone(slug: string): Promise<Clone> {
  const target = await db.another({ template: 'seed', slug });
  caseClones.push(target);
  const owner = target.ownerPool();
  await owner.query('UPDATE public.stt_config SET enabled = false');
  await owner.query('UPDATE public.capture_config SET video_01_device_id = NULL, video_01_profile = NULL, video_02_device_id = NULL, video_02_profile = NULL, mic_primary_id = NULL, mic_standby_id = NULL');
  await ownCredentials(owner);
  return target;
}

interface Booted {
  readonly host: EngineApp;
  readonly failure: BootError | null;
  /** The boot steps that passed, in order. */
  readonly steps: readonly string[];
  /** The codes of the lines the boot checks wrote. */
  readonly codes: readonly string[];
}

/** THE SAME configuration for every boot of this file: only `dataDir` - the store - differs between two boots. */
// Task 4 row 228 (boot check 4b-2): the Core is configured as THE installation the command was told - the id typed at its prompt.
const productionConfig = (dataDir: string): Partial<ConfigInput> => ({ captureMode: 'real', demoControls: false, dataDir, installationDeviceId: INSTALLATION, captureWorkerPath: programs.worker('capture-worker'), ...testHostPrograms(programs.programsDir) });

/** The real app on a clone, in REAL_PRODUCTION, with the explicit test host, booted. A refused boot is returned, not thrown. */
async function bootOn(target: Clone, dataDir: string, other: Partial<ConfigInput> = {}): Promise<Booted> {
  const host = await engineApp(target, dataDir, { startAt: BOOT_AT, logLevel: 'info', config: { ...productionConfig(dataDir), ...other } });
  expect(captureBootControl(host.app).decision).toMatchObject({ operation: 'REAL_PRODUCTION', refusal: null });
  provideTestCaptureHost(host.app);
  let failure: BootError | null = null;
  try {
    await host.app.readiness.boot();
  } catch (error) {
    if (!(error instanceof BootError)) throw error;
    failure = error;
  }
  const lines = host.log.lines();
  return {
    host,
    failure,
    steps: lines.filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step'])),
    codes: lines.map((line) => line['code']).filter((code): code is string => typeof code === 'string' && code.startsWith('CAPTURE_')),
  };
}

/** The device ids are those of the harness's session facts (the manifest builder holds the rows to its tracks); the KINDS are the production ones. */
const PRODUCTION_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'ONVIF_RTSP' },
  { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'ONVIF_RTSP' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'USB_AUDIO' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'USB_AUDIO' },
];
function recorded(): Recording {
  const recording = recordSession();
  recordingRoots.push(dirname(recording.mediaDir));
  return recording;
}

describe('the schema this row was written against', () => {
  it('schema version 15, contract dbc-16', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([15, 'dbc-16']);
  });
});

describe('row 208: the store of evidence:production-key against the real boot function and the seal', () => {
  it('PROOF 1 and PROOF 3: a REAL_PRODUCTION start on the command\'s store passes checks 4 and 4b with the boot\'s own key readers (the whole step passes), and the seal\'s sign step signs all-production sources with that key - the signature verifies against the fingerprint the command printed', async () => {
    const store = await productionStore();
    const before = storeFacts(store.dataDir);
    const target = await productionClone('r208-production');

    // ── PROOF 1: the boot. Nothing of the mount is stated: the step's own readers load the stored key. ──
    let foundHostProfile: HostProfileStatement | undefined;
    const booted = await bootOn(target, store.dataDir);
    try {
      expect(booted.failure === null ? null : [booted.failure.stepId, (booted.failure.cause as { code?: unknown } | undefined)?.code, (booted.failure.cause as { reason?: unknown } | undefined)?.reason]).toBeNull();
      // The step of the boot checks passed, after the fence, and by its own line: every check of a real start ran.
      expect(booted.steps).toEqual(expect.arrayContaining([CAPTURE_FENCE_BOOT_STEP, CAPTURE_BOOT_STEP]));
      expect(booted.steps.indexOf(CAPTURE_FENCE_BOOT_STEP)).toBeLessThan(booted.steps.indexOf(CAPTURE_BOOT_STEP));
      expect(booted.codes).toContain('CAPTURE_BOOT_CHECKS_PASSED');
      // Neither refusal of the key was written, nor the one of check 4c that follows them.
      for (const refusal of [CaptureBootRefusal.SIGNING_KEY_UNUSABLE, CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION]) expect(booted.codes).not.toContain(refusal);
      expect(captureBootControl(booted.host.app).outcome()).toMatchObject({ operation: 'REAL_PRODUCTION' });
      expect(booted.host.app.config.dataDir).toBe(store.dataDir);
      // Task 4 row P1 (U21 (2)): what THIS boot found of its host profile - the test host is `darwin`: a production Core, profile not asked.
      foundHostProfile = captureBootControl(booted.host.app).outcome()?.hostProfile;
      expect(foundHostProfile).toEqual({ platform: 'darwin', asked: false });
    } finally {
      await booted.host.app.close();
    }
    // The boot loaded the key and left the store as the command wrote it.
    expect(storeFacts(store.dataDir)).toEqual(before);
    expect(before.map((line) => line.split(' ').slice(0, 3).join(' '))).toEqual(expect.arrayContaining([`${KEY}.crt 644 uid=${UID}`, `${KEY}.p8 600 uid=${UID}`, `${KEY}.wrap 600 uid=${UID}`]));

    // ── PROOF 3: the seal, with the signer the seal's own loader reads from THAT store. ──
    const signer = loadSealingSigner({ dataDir: store.dataDir, now: CLOCK_START });
    expect(signer.certificate.sha256).toBe(store.printedSha256);
    expect(signer.certificate.subject).toBe(store.printedSubject);
    expect(isDevelopmentSigningCertificate(signer.certificate)).toBe(false);
    const recording = recorded();
    // Row P1: the seal is handed what the product's reader hands it - the sealing host's own function over the outcome of the boot above.
    const hostProfileNotAsked = hostProfileNotAskedOf(foundHostProfile);
    expect(hostProfileNotAsked).toEqual({ platform: 'darwin' });
    const h = harnessOf(recording, { signer: signer as never, facts: { sourceRows: PRODUCTION_ROWS, ...(hostProfileNotAsked === null ? {} : { hostProfileNotAsked }) } });
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    // The sign step did not raise DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES - nor anything else.
    expect(outcome).toMatchObject({ status: 'SEALED' });
    // Row P1: THE SIGNED MANIFEST of a production Core on this Mac's platform states that its host profile was not asked (field 133);
    // the verdict below - every check PASS against the printed fingerprint - is the verdict of a manifest that carries the member.
    expect((JSON.parse(readFileSync(recording.path(PackageFile.MANIFEST), 'utf8')) as { hostProfileNotAsked?: unknown }).hostProfileNotAsked).toEqual({ platform: 'darwin' });
    expect(JSON.stringify(outcome)).not.toContain('DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES');
    // The rule was ASKED, not passed by: the package states that every source is a production source.
    expect(h.engine.sealed[0]?.input.developmentSources).toBe(false);
    expect([...h.journal.rows.values()].find((row) => row.step === 'SIGN_MANIFEST')).toMatchObject({ status: 'DONE', checkpoint: { keyId: KEY, certificateSha256: store.printedSha256 } });

    // The certificate THE VERIFIER READS is the package's own file; its SHA-256, by the verifier's own function, is the printed fingerprint.
    const packaged = readFileSync(recording.path(PackageFile.CERTIFICATE), 'utf8');
    expect(pemCertificateSha256(packaged)).toBe(store.printedSha256);
    expect(packaged).toBe(readFileSync(join(store.dataDir, 'signer', `${KEY}.crt`), 'utf8'));
    // The whole package verifies with ONLY the printed fingerprint trusted: the signature (V-09) is that key's.
    const anchors = h.anchors();
    const verdict = await verifyPackageV2(corePorts(recording.packageDir, recording.opener, 256), { plaintext: 'REQUIRED', expected: { ...anchors, trustedCertificateSha256: [store.printedSha256] } });
    expect([verdict.ok, verdict.overall, verdict.interrupted]).toEqual([true, 'PASS', false]);
    expect(verdict.checks.filter((check) => check.status !== 'PASS').map((check) => check.id)).toEqual([]);
    expect(verdict.sources).toMatchObject({ development: false });
    // CONTROL: the trust is what decides - another fingerprint (a development key made now) is not this package's.
    const other = developmentStore();
    expect(other.printedSha256).not.toBe(store.printedSha256);
    const distrusted = await verifyPackageV2(corePorts(recording.packageDir, recording.opener, 256), { plaintext: 'REQUIRED', expected: { ...anchors, trustedCertificateSha256: [other.printedSha256] } });
    expect(distrusted.ok).toBe(false);
    expect(JSON.stringify(distrusted)).toContain('CERTIFICATE_NOT_TRUSTED');
  });

  it('PROOF 2, THE NEGATIVE CONTROL: the same start on a store of the same form made by the DEVELOPMENT command stops at check 4b with CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION - and the seal refuses that key for all-production sources', async () => {
    const store = developmentStore();
    const before = storeFacts(store.dataDir);
    // The same form: the same three names with the same modes as the production store.
    expect(before.map((line) => line.split(' ').slice(0, 3).join(' '))).toEqual([`${KEY}.crt 644 uid=${UID}`, `${KEY}.p8 600 uid=${UID}`, `${KEY}.wrap 600 uid=${UID}`]);
    const target = await productionClone('r208-development');

    const booted = await bootOn(target, store.dataDir);
    try {
      expect(booted.failure).toBeInstanceOf(BootError);
      expect(booted.failure?.stepId).toBe(CAPTURE_BOOT_STEP);
      const cause = booted.failure?.cause;
      expect(cause).toBeInstanceOf(CaptureBootError);
      // AT 4b: the key LOADED (check 4 did not refuse: its code would be CAPTURE_SIGNING_KEY_UNUSABLE), and it is refused for its mark.
      expect([(cause as CaptureBootError).code, (cause as CaptureBootError).reason]).toEqual(['CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION', null]);
      expect((cause as CaptureBootError).code).toBe(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY);
      // The refusal is the ONE line of the boot checks: nothing after 4b ran (no host line, no program line, no pass), and the fence had passed.
      expect(booted.codes.filter((code) => code !== 'CAPTURE_FENCE_PASSED' && !code.startsWith('CAPTURE_FENCE_'))).toEqual(['CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION']);
      expect(booted.steps).toContain(CAPTURE_FENCE_BOOT_STEP);
      expect(booted.steps).not.toContain(CAPTURE_BOOT_STEP);
      expect(captureBootControl(booted.host.app).outcome()).toBeNull();
    } finally {
      await booted.host.app.close();
    }
    expect(storeFacts(store.dataDir)).toEqual(before);

    // The seal holds the same rule by itself: this key signs nothing whose sources are all production.
    const signer = loadSealingSigner({ dataDir: store.dataDir, now: CLOCK_START });
    expect(signer.certificate.sha256).toBe(store.printedSha256);
    expect(isDevelopmentSigningCertificate(signer.certificate)).toBe(true);
    const recording = recorded();
    const h = harnessOf(recording, { signer: signer as never, facts: { sourceRows: PRODUCTION_ROWS } });
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'SIGN_MANIFEST', code: 'DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES', retriable: false });
    expect(h.engine.progress.at(-1)?.steps.find((step) => step.id === 'SIGN_MANIFEST')?.detail).toBe(sealingFailureReason('DEVELOPMENT_KEY_FOR_PRODUCTION_SOURCES'));
    expect(h.engine.sealed).toHaveLength(0);
    expect(() => lstatSync(recording.path(PackageFile.SIGNATURE))).toThrow();
  });

  it('task 4 row 228 (check 4b-2), THROUGH THE REAL APP: the command\'s store - a production key that passes 4 and 4b - on a Core configured as ANOTHER installation stops with CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH; the id reached the check through the app\'s own wiring', async () => {
    const store = await productionStore();
    const before = storeFacts(store.dataDir);
    expect(store.printedSubject).toContain(`OU=Evidence signing ${INSTALLATION},`);
    const target = await productionClone('r228-other-installation');
    // ONE difference from PROOF 1: the installation the Core is configured as. Nothing of the mount is stated.
    const booted = await bootOn(target, store.dataDir, { installationDeviceId: 'DEMS-TEST-228' });
    try {
      expect(booted.failure?.stepId).toBe(CAPTURE_BOOT_STEP);
      const cause = booted.failure?.cause;
      expect(cause).toBeInstanceOf(CaptureBootError);
      expect([(cause as CaptureBootError).code, (cause as CaptureBootError).reason]).toEqual(['CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH', 'OTHER_INSTALLATION']);
      // The one line of the boot checks: the key loaded and has no development mark (4, 4b passed); nothing after 4b-2 ran.
      expect(booted.codes.filter((code) => !code.startsWith('CAPTURE_FENCE_'))).toEqual(['CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH']);
      expect(captureBootControl(booted.host.app).outcome()).toBeNull();
      // Neither id is in a line of the log.
      expect(JSON.stringify(booted.host.log.lines().filter((line) => line['code'] === 'CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH'))).not.toMatch(/DEMS-TEST-2[02]8/);
    } finally {
      await booted.host.app.close();
    }
    expect(storeFacts(store.dataDir)).toEqual(before);
  });
});
