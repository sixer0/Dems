// Task 4 row 215c (code review 222, finding F-01; SX-16 second half; decision C64 "ONE load per boot
// run"): THE ONE-LOAD WIRING OF THE MOUNT is pinned.
//
// `one-load.test.ts` (row 211) proves the property on `storedSigningKeyReaders`. Nothing proved that
// the MOUNTED boot step is wired to those readers: with the mount put back to two separate reads of
// the store, every test stayed green. This file counts the calls of the store's loader THROUGH THE
// MOUNTED STEP - `mountCaptureBootChecks`, the step run by the readiness plugin's own `boot()` - with
// no seam of the signing key handed in, so the step's own readers are the ones that run.
//
// THE ONE MODULE DOUBLE: the signer unit as the boot unit imports it (`../signer`) is the real one,
// whole; only `loadSoftwareSigner` is wrapped, and the wrapper counts and then calls the real loader.
// The mount has no seam for the loader and this row adds none (`boot/index.ts` is not edited here).
//
// EVERY KEY OF THIS FILE IS MADE BY THE TEST in a fresh directory of the temporary folder, removed
// after each case and asserted gone at the end. No case names the repository's `.data/` (security
// review 221, caution C-4: the fixture of row 61 is not used here), and the organisation and the
// installation are fixed, obviously synthetic texts. The checks before the key (1 to 3) are answered
// by passing facts and the worker launcher throws: no program is inspected or started, no port bound.
import { lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { unitTestConfig } from '../../../../test/support/config';
import { BootError, createReadiness } from '../../../plugins/readiness';
import type { ProgramFacts } from '../../adapters/local';
import { provisionSigningKey } from '../../signer';
import { createSystemTimers } from '../../timers';
import { CAPTURE_BOOT_STEP, CaptureBootError, CaptureBootRefusal, SIGNING_STORE_SUBPATH } from '../checks';
import { mountCaptureBootChecks, type CaptureBootMount, type CaptureBootSinks, type EvidenceVolumeFacts } from '../index';

/** Every call of the store's loader that went through the signer unit's door, by the directory it was asked for. */
const counted = vi.hoisted(() => ({ loads: [] as string[] }));
vi.mock('../../signer', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const real = actual['loadSoftwareSigner'] as (options: { readonly dir: string; readonly now: number }) => unknown;
  return {
    ...actual,
    loadSoftwareSigner: (options: { readonly dir: string; readonly now: number }) => {
      counted.loads.push(options.dir);
      return real(options);
    },
  };
});

const NOW = 1_791_900_000_000;
const UID = typeof process.getuid === 'function' ? process.getuid() : -1;
const ORGANISATION = 'SYNTHETIC TEST ORG - NOT AN INSTALLATION';
const INSTALLATION = 'DEMS-TEST-215C';
/** The unit a production certificate carries: the text the key command of row 206 writes. */
const UNIT = `Evidence signing ${INSTALLATION}`;

const roots: string[] = [];
function dataDirectory(): string {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row215c-'));
  roots.push(root);
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return dataDir;
}
const signerOf = (dataDir: string): string => `${dataDir}/${SIGNING_STORE_SUBPATH}`;
const made: string[] = [];
afterEach(() => {
  counted.loads.length = 0;
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
    made.push(root);
  }
});
afterAll(() => {
  expect(made.length).toBeGreaterThan(0);
  for (const root of made) expect(() => lstatSync(root)).toThrow();
});

const program: ProgramFacts = { absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: UID, mode: 0o755 }, directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }], directoriesResolved: [{ ownerUid: 0, mode: 0o755 }], serverUid: UID };
const volume: EvidenceVolumeFacts = { absolute: true, present: true, directory: true, ownerUid: UID, mode: 0o700, serverUid: UID, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true, totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 };

/**
 * The boot step as the capture unit mounts it, for REAL_PRODUCTION, run by the readiness plugin. NO
 * seam of the signing key is handed in (`signingKeyProblem`, `signingKeyIsDevelopment` and the units
 * reader are absent): the step's own readers of the store run. Check 4c - the first check AFTER the
 * checks of the key - is told "7 operators", so a start that is refused THERE has asked every check
 * of the key, and no worker was started. `seams` adds a seam for the cases that say so.
 */
async function refusalOf(dataDir: string, seams: Partial<CaptureBootMount> = {}): Promise<{ readonly code: string; readonly reason: string | null }> {
  const sinks: CaptureBootSinks = { info() {}, warn() {}, error() {}, persist() {} };
  const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
  const app = { config: unitTestConfig({ dataDir, captureMode: 'real', captureWorkerPath: '/opt/dems/capture-worker' }), stages: {}, readiness: createReadiness(log), clock: { now: () => NOW + 1_000 } } as unknown as FastifyInstance;
  const launcher = (): never => {
    throw new Error('a worker was started');
  };
  mountCaptureBootChecks(app, { sinks, timers: createSystemTimers(), inspect: () => program, probeEvidenceVolume: () => volume, demoPasswordOperators: async () => 7, launcher: launcher as never, installationId: INSTALLATION, ...seams });
  const failure = await app.readiness.boot().then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof BootError) || !(failure.cause instanceof CaptureBootError)) throw new Error('the boot was not refused by the capture boot checks');
  expect(failure.stepId).toBe(CAPTURE_BOOT_STEP);
  return { code: failure.cause.code, reason: failure.cause.reason };
}

/** A store a production boot accepts: the unit names the installation the mount is told. */
function productionStore(): string {
  const dataDir = dataDirectory();
  provisionSigningKey({ dir: signerOf(dataDir), now: NOW, subject: { organization: ORGANISATION, organizationalUnit: UNIT } });
  return dataDir;
}

describe('row 215c, F-01: the MOUNTED boot step loads the signing key store once per run', () => {
  it('a production store: every check of the key passes (the start is refused only at 4c) and the loader was called ONCE, for the store of this data directory', async () => {
    const dataDir = productionStore();
    // Provisioning is not a load: the count starts at 0.
    expect(counted.loads).toEqual([]);
    expect(await refusalOf(dataDir)).toEqual({ code: CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, reason: 'operators=7' });
    // THE PIN. A mount whose checks 4 and 4b each read the store answers 2 here (or more).
    expect(counted.loads).toEqual([signerOf(dataDir)]);
  });

  it('a development store: check 4b refuses it on the certificate check 4 loaded - two questions, ONE load', async () => {
    const dataDir = dataDirectory();
    // The mark the development command writes into the unit (`DEVELOPMENT_KEY_UNIT` of the sealing unit), as `one-load.test.ts` names it.
    provisionSigningKey({ dir: signerOf(dataDir), now: NOW, subject: { organizationalUnit: 'DEVELOPMENT KEY - NOT FOR PRODUCTION' } });
    expect(await refusalOf(dataDir)).toEqual({ code: CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, reason: null });
    expect(counted.loads).toEqual([signerOf(dataDir)]);
  });

  it('a store that does not load: check 4 refuses with the signer`s code, and the failed load is not made a second time', async () => {
    const dataDir = dataDirectory();
    expect(await refusalOf(dataDir)).toEqual({ code: CaptureBootRefusal.SIGNING_KEY_UNUSABLE, reason: 'KEY_ABSENT' });
    expect(counted.loads).toEqual([signerOf(dataDir)]);
  });

  it('one load PER RUN, never one for the process: a second mounted app loads its own store again', async () => {
    const first = productionStore();
    const second = productionStore();
    await refusalOf(first);
    await refusalOf(second);
    expect(counted.loads).toEqual([signerOf(first), signerOf(second)]);
  });

  it('CONTROL: the double counts what the step asks - with BOTH seams of checks 4 and 4b handed in, a step that is refused by 4b never reaches the store', async () => {
    const dataDir = productionStore();
    const refusal = await refusalOf(dataDir, { signingKeyProblem: () => null, signingKeyIsDevelopment: () => true });
    expect(refusal).toEqual({ code: CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, reason: null });
    expect(counted.loads).toEqual([]);
    // And the loader behind the door IS the counted one: a direct call through the signer unit counts.
    const { loadSoftwareSigner } = await import('../../signer');
    expect(loadSoftwareSigner({ dir: signerOf(dataDir), now: NOW + 1_000 }).certificate.subject).toContain(UNIT);
    expect(counted.loads).toEqual([signerOf(dataDir)]);
  });
});
