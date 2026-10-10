// Row 82c, item 3: the seed-time generator of the v2 demo packages with the REAL helper program
// and REAL generated H.264 (`.data/helpers/ffmpeg`, the private development helper; its argument
// list is exactly `demoCameraFileArguments`). Nothing is recorded live: no worker, no listener, no
// device, no socket - the helper writes four short files into a throw-away data directory.
//
// WHAT THIS FILE ADDS to `demo-seed.test.ts`: the box walk of the product reads a file the helper
// wrote (the muxer flags of the worker), the script holds on real media (generate -> verify clean
// PASS -> tamper -> verify names (VIDEO-02, 3)), and THE SIZES ARE MEASURED: one demo package is
// under 10 MB and every fragment is far below the 64 MiB bound of the pipeline and its verifier.
// The measured numbers are written to `DEMS_DEMO_SEED_OUT` when that names a file (the row's note).
//
// Skipped only when the helper program is not there (`npm run capture:dev-setup`).
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PackageFile, parseManifestV2 } from '@dems/shared/evidence-package';
import { VERIFY_V2_CHECKS } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { SEALING_MAX_FRAGMENT_BYTES } from '../../sealing';
import { DEMO_CLIP_SECONDS, DEMO_PACKAGE_MAX_BYTES, demoCameraFileBytesBound, sealDemoPackages, type DemoSealOptions } from '../demo-seed';
import { demoCore, demoItem, removeDemoCores } from './demo-seed-support';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const HELPER = join(REPOSITORY, '.data/helpers/ffmpeg');
const ALL = VERIFY_V2_CHECKS.map((check) => check.id);

afterAll(() => removeDemoCores());

/** The helper door of this test: the program, exactly the argument list it is given, an empty environment, no shell. */
const synthesise: DemoSealOptions['synthesise'] = (request) =>
  new Promise<void>((done, failed) => {
    execFile(HELPER, [...request.args], { env: {}, timeout: 60_000 }, (error) => (error === null ? done() : failed(error)));
  });

describe.skipIf(!existsSync(HELPER))('the v2 demo packages from the REAL generated source at a camera-realistic bitrate (row 82c)', () => {
  it('one clean item and EV 0005: sealed by the product pipeline, a few MB each, clean PASS, and the tampered one names (VIDEO-02, 3)', { timeout: 180_000 }, async () => {
    const core = demoCore('generated');
    const [clean, tampered] = await sealDemoPackages({ ...core.options(), synthesise }, [demoItem(1), demoItem(5)]);
    if (clean === undefined || tampered === undefined) throw new Error('two items were asked');

    const measured = [clean, tampered].map((sealed) => {
      const dir = core.packageDir(sealed.sessionId);
      const manifest = parseManifestV2(JSON.parse(readFileSync(join(dir, PackageFile.MANIFEST), 'utf8')));
      const fragments = manifest.files.flatMap((file) => file.fragments.map((fragment) => fragment.byteLength));
      return {
        evidenceId: sealed.evidenceId,
        packageBytes: sealed.bytes,
        cameraFileBytes: manifest.tracks.map((track) => statSync(join(dir, 'fragments', track.file)).size),
        fragmentsPerFile: sealed.fragmentsPerFile,
        largestFragmentBytes: Math.max(...fragments),
        smallestFragmentBytes: Math.min(...fragments),
        mediaMsPerFile: manifest.tracks.map((track) => track.durationMs),
        keyframeAligned: manifest.tracks.map((track) => track.keyframeAligned),
        verify: sealed.verify,
      };
    });
    const out = process.env.DEMS_DEMO_SEED_OUT;
    if (out !== undefined && out !== '') writeFileSync(out, `${JSON.stringify({ seconds: DEMO_CLIP_SECONDS, helper: '.data/helpers/ffmpeg', measured }, null, 2)}\n`);

    for (const entry of measured) {
      // THE SIZE RULE of decision D155: one package under 10 MB (a few MB by the rate).
      expect(entry.packageBytes).toBeLessThan(DEMO_PACKAGE_MAX_BYTES);
      // Each camera file is what the rate gives, within the container's overhead and the encoder's tolerance.
      for (const bytes of entry.cameraFileBytes) expect(bytes).toBeLessThan(demoCameraFileBytesBound(DEMO_CLIP_SECONDS) * 1.25);
      // 8 s at the worker's 2 s fragment quantum: 4 fragments per file, each starting on a keyframe.
      expect(entry.fragmentsPerFile).toEqual([4, 4]);
      expect(entry.keyframeAligned).toEqual([true, true]);
      // A fragment is about 1 MB: more than 30 times below the one bound of the pipeline and its verifier.
      expect(entry.largestFragmentBytes).toBeLessThan(SEALING_MAX_FRAGMENT_BYTES / 30);
    }

    // The script, judged by the verifier of operation 41 called here.
    const cleanVerdict = await core.verify(clean);
    expect(cleanVerdict.ok).toBe(true);
    expect(cleanVerdict.checks.filter((check) => check.status === 'PASS').map((check) => check.id)).toEqual(ALL);
    const verdict = await core.verify(tampered);
    expect({ ok: verdict.ok, overall: verdict.overall }).toEqual({ ok: false, overall: 'TAMPERED' });
    expect(verdict.fragments.map((fragment) => [fragment.trackId, fragment.seq])).toEqual([['VIDEO-02', 3]]);
    expect(verdict.files.find((file) => file.trackId === 'VIDEO-02')?.chainBrokenFromSeq).toBe(3);
    expect(verdict.checks.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual(['V-04', 'V-06', 'V-08']);
    for (const report of [cleanVerdict, verdict]) {
      expect(report.sources).toMatchObject({ code: 'DEVELOPMENT', development: true });
      expect(report.signature).toMatchObject({ ok: true, developmentKey: true });
    }
  });
});
