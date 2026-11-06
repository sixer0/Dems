// Task 4 row 226b (decision C69 (1)): THE RUNNING CORE AND A KEY THAT WAS JUST MARKED COMPROMISED.
//
// `sealing-host/index.ts` loads the signer once and keeps it (`signingNow`); the commands
// `evidence:mark-compromised` and `evidence:rotate-key` touch no database and see no process. What
// holds the mark for a Core that runs is the signer of the store, which asks the mark and the
// pointer again before each signature (`capture/signer/host-key.ts`, "A LOADED SIGNER").
//
// Here that is shown where it matters, with ONE signer object held across two seals - exactly
// what the running signer host holds:
//
//   1. a seal AFTER the mark is refused at SIGN_MANIFEST with the existing code `SIGNER_FAILED`
//      (cause `KEY_COMPROMISED`): no manifest, no signature, no item;
//   2. NOTHING ALREADY SEALED IS TOUCHED: every file of the package sealed before the mark is
//      byte-identical, and that package still verifies;
//   3. a TRANSCRIPT REVISION likewise: the loader a revision request calls refuses the marked key,
//      and a signer taken before the mark refuses the revision digest;
//   4. after a ROTATION the running signer signs nothing (`ACTIVE_KEY_CHANGED`) - it does not go
//      over to the new key; a Core that is started again (a new load) seals with the new key.
//
// SECRETS: every key is generated here, in a temporary directory removed in `afterAll`.
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PackageFile } from '@dems/shared/evidence-package';
import { afterAll, describe, expect, it } from 'vitest';
import { SignerError, activateSigningKey, markSigningKeyCompromised, provisionSigningKey, type LoadedSigner } from '../../capture';
import { WORKSPACE } from '../../../test/static/scan';
import { loadSealingSigner, sealingSignerDir } from '../signing';
import { removePackages } from './package-support';
import { CLOCK_START, harnessOf, recordSession, removeRecordings } from './pipeline-support';

const FIRST = 'CORE-KEY-EVSIGN-01';
const SECOND = 'CORE-KEY-EVSIGN-02';

const roots: string[] = [];
afterAll(() => {
  removeRecordings();
  removePackages();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  for (const root of roots) expect(() => lstatSync(root)).toThrow();
});

/** A data directory of this test with a first key (no development mark: it signs any package), and the signer a Core that started on it holds. */
function runningCore(): { dataDir: string; held: LoadedSigner } {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row226b-seal-'));
  roots.push(root);
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  provisionSigningKey({ dir: sealingSignerDir(dataDir), now: CLOCK_START - 100_000 });
  return { dataDir, held: loadSealingSigner({ dataDir, now: CLOCK_START }) };
}

/** Every file below a folder: relative name -> size and bytes (hex). */
function tree(dir: string, prefix = ''): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) Object.assign(found, tree(path, `${prefix}${name}/`));
    else found[`${prefix}${name}`] = readFileSync(path).toString('hex');
  }
  return found;
}

const codeOf = (run: () => unknown): string => {
  try {
    run();
    return 'NO_REFUSAL';
  } catch (error) {
    return error instanceof SignerError ? error.code : 'ANOTHER_ERROR';
  }
};

describe('row 226b: a Core that RUNS does not sign with a key that was marked compromised', () => {
  it('a seal after the mark is refused by name, and nothing already sealed is touched', async () => {
    const { dataDir, held } = runningCore();

    // Before the mark: the running Core seals.
    const first = recordSession();
    const sealedBefore = harnessOf(first, { signer: held });
    expect((await sealedBefore.pipeline.run({ sessionId: first.sessionId, cause: 'STOPPED' })).status).toBe('SEALED');
    const packageBefore = tree(first.packageDir);
    expect(Object.keys(packageBefore)).toEqual(expect.arrayContaining([PackageFile.MANIFEST, PackageFile.SIGNATURE, PackageFile.CERTIFICATE]));

    // The installer marks the key while the Core runs. The Core holds the SAME signer object.
    markSigningKeyCompromised({ dir: sealingSignerDir(dataDir), keyId: FIRST, at: CLOCK_START + 1_000 });

    const second = recordSession();
    const afterMark = harnessOf(second, { signer: held });
    const outcome = await afterMark.pipeline.run({ sessionId: second.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'SIGN_MANIFEST', code: 'SIGNER_FAILED', retriable: true });
    // Nothing was signed and nothing was committed for the second session.
    expect(existsSync(second.path(PackageFile.MANIFEST))).toBe(false);
    expect(existsSync(second.path(PackageFile.SIGNATURE))).toBe(false);
    expect(afterMark.engine.sealed).toHaveLength(0);
    // The cause is in the persistent error log, by its code; no place of the store and no key material is.
    const logged = JSON.stringify(afterMark.log.entries);
    expect(logged).toContain('KEY_COMPROMISED');
    expect(logged).not.toContain(dataDir);
    // The recording of the refused session is untouched: it is sealed after a rotation and a restart.
    expect(existsSync(second.recordingFile('VIDEO-01'))).toBe(true);
    // A second try of the same run is refused again (the way out retries; the mark stays).
    expect(await afterMark.again().run({ sessionId: second.sessionId, cause: 'STOPPED' })).toMatchObject({ status: 'FAILED', step: 'SIGN_MANIFEST', code: 'SIGNER_FAILED' });

    // NOTHING ALREADY SEALED IS TOUCHED: the first package, byte for byte, and its item.
    expect(tree(first.packageDir)).toEqual(packageBefore);
    expect(sealedBefore.engine.sealed).toHaveLength(1);
  });

  it('a transcript revision likewise: the loader of a revision request refuses the marked key, and a signer taken before the mark refuses the digest', async () => {
    const { dataDir, held } = runningCore();
    const digest = new Uint8Array(32).fill(3);
    // Before the mark both halves work (the control).
    expect(codeOf(() => loadSealingSigner({ dataDir, now: CLOCK_START }))).toBe('NO_REFUSAL');
    expect((await held.signer.sign(digest)).length).toBe(64);

    markSigningKeyCompromised({ dir: sealingSignerDir(dataDir), keyId: FIRST, at: CLOCK_START + 1_000 });

    // `loadCoreSigner` of `modules/transcripts/routes.ts` is this call, made at EACH request.
    expect(codeOf(() => loadSealingSigner({ dataDir, now: CLOCK_START + 2_000 }))).toBe('KEY_COMPROMISED');
    // A request that had loaded its signer just before the mark: the signature of the revision digest is refused.
    expect(codeOf(() => held.signer.sign(digest))).toBe('KEY_COMPROMISED');

    // The route's two lines, as they stand: the load per request, and a signature that fails is the named refusal.
    const routes = readFileSync(join(WORKSPACE, 'src/modules/transcripts/routes.ts'), 'utf8');
    expect(routes).toContain('const loadCoreSigner: RevisionSignerLoader = (app, now) => loadSealingSigner({ dataDir: app.config.dataDir, now });');
    expect(routes).toContain('signer = (signerLoaders.get(app) ?? loadCoreSigner)(app, now);');
    expect(routes).toMatch(/await signer\.signer\.sign\(digest\)\)\);\s*\} catch \(err\) \{\s*persist\(request, TranscriptReason\.SIGNING_KEY_UNAVAILABLE/);
  });

  it('after a rotation the running Core signs nothing until it is started again; it never goes over to the new key by itself', async () => {
    const { dataDir, held } = runningCore();
    const dir = sealingSignerDir(dataDir);
    provisionSigningKey({ dir, now: CLOCK_START - 50_000, keyId: SECOND });
    activateSigningKey({ dir, keyId: SECOND, now: CLOCK_START });

    const recording = recordSession();
    const running = harnessOf(recording, { signer: held });
    const outcome = await running.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'SIGN_MANIFEST', code: 'SIGNER_FAILED', retriable: true });
    expect(JSON.stringify(running.log.entries)).toContain('ACTIVE_KEY_CHANGED');
    expect(existsSync(recording.path(PackageFile.SIGNATURE))).toBe(false);
    expect(running.engine.sealed).toHaveLength(0);

    // STARTED AGAIN: a new load answers the new active key, and a session is sealed under it.
    const restarted = loadSealingSigner({ dataDir, now: CLOCK_START });
    expect(restarted.signer.keyId).toBe(SECOND);
    const next = recordSession();
    const afterRestart = harnessOf(next, { signer: restarted });
    expect((await afterRestart.pipeline.run({ sessionId: next.sessionId, cause: 'STOPPED' })).status).toBe('SEALED');
    expect(afterRestart.engine.sealed[0]?.input.signature.keyId).toBe(SECOND);
  });
});
