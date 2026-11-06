// Task 4 row 211 (GATE SX-17; SX-16 second half; R-X2-11): boot checks 4 and 4b judge ONE loaded
// certificate. The readers of the mounted boot step (`storedSigningKeyReaders`) are driven through the
// REAL decision (`runCaptureBootChecks`) with a counting double around the store's loader. The existing
// tests of checks 4, 4b and 4c (`checks.test.ts`, `boot.test.ts`) are not edited by this row.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { captureOperationDecisionOf } from '../../fence/operation';
import { SignerError, loadSoftwareSigner, provisionSigningKey } from '../../signer';
import { CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, runCaptureBootChecks, type CaptureBootDeps } from '../checks';
import { storedSigningKeyReaders } from '../index';
import { FIXTURE_NOW, recordedSinks } from './support';

type Load = NonNullable<Parameters<typeof storedSigningKeyReaders>[0]>;
type Readers = ReturnType<typeof storedSigningKeyReaders>;

const SERVER_UID = 501;
const DIRECTORY = '/nowhere/signer';
const made: string[] = [];
afterEach(() => {
  for (const directory of made.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function counting(load: Load): { readonly load: Load; loads(): number } {
  let loads = 0;
  return { load: (options) => ((loads += 1), load(options)), loads: () => loads };
}

/** A REAL_PRODUCTION decision whose every other check passes; the count of check 4c is the parameter. */
function production(readers: Readers, directory: string, operators: number): CaptureBootDeps {
  const directories = [{ ownerUid: 0, mode: 0o755 }, { ownerUid: SERVER_UID, mode: 0o755 }];
  return {
    decision: captureOperationDecisionOf({ captureMode: 'real', demoControls: false, captureDevSources: false, host: '127.0.0.1' }),
    workerProgram: '/opt/dems/capture-worker',
    inspect: () => ({ absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: SERVER_UID, mode: 0o755 }, directoriesAsWritten: directories, directoriesResolved: directories, serverUid: SERVER_UID }),
    probeEvidenceVolume: () => ({ absolute: true, present: true, directory: true, ownerUid: SERVER_UID, mode: 0o700, serverUid: SERVER_UID, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true, totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 }),
    signingKeyProblem: () => readers.problem(directory, FIXTURE_NOW),
    signingKeyIsDevelopment: () => readers.isDevelopment(directory, FIXTURE_NOW),
    demoPasswordOperators: async () => operators,
    handshake: async () => ({ outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION }),
    sinks: recordedSinks().sinks,
  };
}

async function refusalOf(deps: CaptureBootDeps): Promise<CaptureBootError> {
  const failure = await runCaptureBootChecks(deps).then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof CaptureBootError)) throw new Error('the boot checks did not refuse');
  return failure;
}

describe('row 211: checks 4 and 4b judge one loaded certificate', () => {
  it('a REAL store: the decision passes 4 and 4b (it stops at 4c, by its own code) and the store was loaded ONCE', async () => {
    const directory = join(mkdtempSync(join(tmpdir(), 'dems-row211-')), 'signer');
    made.push(join(directory, '..'));
    provisionSigningKey({ dir: directory, now: FIXTURE_NOW });
    const counted = counting(loadSoftwareSigner);
    const deps = production(storedSigningKeyReaders(counted.load), directory, 3);
    expect(deps.decision.operation).toBe('REAL_PRODUCTION');
    const refusal = await refusalOf(deps);
    expect(refusal.code).toBe(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION);
    expect(refusal.reason).toBe('operators=3');
    expect(counted.loads()).toBe(1);
    // With no operator left, every check passes, and it is still one load.
    const again = counting(loadSoftwareSigner);
    await expect(runCaptureBootChecks(production(storedSigningKeyReaders(again.load), directory, 0))).resolves.toMatchObject({ operation: 'REAL_PRODUCTION' });
    expect(again.loads()).toBe(1);
  });

  it('a certificate with the development mark: refused by check 4b on the certificate check 4 loaded (one load)', async () => {
    const counted = counting(() => ({ certificate: { subject: 'CN=K,OU=DEVELOPMENT KEY - NOT FOR PRODUCTION,O=DEMS Core' } }) as ReturnType<Load>);
    const refusal = await refusalOf(production(storedSigningKeyReaders(counted.load), DIRECTORY, 0));
    expect(refusal.code).toBe(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY);
    expect(counted.loads()).toBe(1);
  });

  it('a store that does not load: check 4 refuses with the signer code; the fail-closed answers are kept and no second load is made', async () => {
    const counted = counting(() => {
      throw new SignerError('KEY_ABSENT', 'K');
    });
    const readers = storedSigningKeyReaders(counted.load);
    const refusal = await refusalOf(production(readers, DIRECTORY, 0));
    expect(refusal.code).toBe(CaptureBootRefusal.SIGNING_KEY_UNUSABLE);
    expect(refusal.reason).toBe('KEY_ABSENT');
    expect(readers.isDevelopment(DIRECTORY, FIXTURE_NOW)).toBe(false);
    expect(readers.problem(DIRECTORY, FIXTURE_NOW)).toBe('KEY_ABSENT');
    expect(counted.loads()).toBe(1);
    const other = storedSigningKeyReaders(() => {
      throw new Error('a text of the operating system');
    });
    expect(other.problem(DIRECTORY, FIXTURE_NOW)).toBe('UNREADABLE');
    expect(other.isDevelopment(DIRECTORY, FIXTURE_NOW)).toBe(false);
  });

  it('CONTROL: the double counts - two sets of readers are two loads', () => {
    const counted = counting(() => ({ certificate: { subject: 'CN=K,OU=Evidence signing,O=DEMS Core' } }) as ReturnType<Load>);
    expect(storedSigningKeyReaders(counted.load).problem(DIRECTORY, FIXTURE_NOW)).toBeNull();
    expect(storedSigningKeyReaders(counted.load).isDevelopment(DIRECTORY, FIXTURE_NOW)).toBe(false);
    expect(counted.loads()).toBe(2);
  });
});
