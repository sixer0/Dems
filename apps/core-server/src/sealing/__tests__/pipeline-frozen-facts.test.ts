// Fix pass F-M7 (review row 88, R88-03; decision D178): `MANIFEST_NOT_REPRODUCIBLE` was PERMANENT
// although nothing was signed - the session reader takes live state (the time-source lock, the
// software version, the operator's name and role, camera names) and a restart between
// BUILD_MANIFEST and SIGN_MANIFEST could change it.
//
// RULED: the inputs of the manifest are frozen ONCE, in the BUILD_MANIFEST checkpoint; every
// resume builds from that snapshot and can no longer disagree. Control: before that checkpoint
// exists, a resume reads the session record as it is then.
import { readFileSync } from 'node:fs';
import { PackageFile, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { verifyPackageV2 } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { SealingStop, type SealOutcome, type SealingHookPoint, type SealingStepId } from '../index';
import { removePackages } from './package-support';
import { harnessOf, recordSession, removeRecordings, type Harness, type Recording } from './pipeline-support';

afterAll(() => {
  removeRecordings();
  removePackages();
});

const manifestOf = (recording: Recording): ManifestV2 => parseManifestV2(JSON.parse(readFileSync(recording.path(PackageFile.MANIFEST), 'utf8')));
const stopAt = (step: SealingStepId, phase: SealingHookPoint['phase']) => (point: SealingHookPoint) => {
  if (point.step === step && point.phase === phase) throw new SealingStop(point);
};
const sealedOf = (outcome: SealOutcome): Extract<SealOutcome, { status: 'SEALED' }> => {
  if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
  return outcome;
};
/** What a restart may find changed: a software upgrade, a time source not locked yet, a renamed operator, a renamed camera. */
function afterRestart(h: Harness): void {
  h.facts = {
    ...h.facts,
    device: { ...h.facts.device, softwareVersion: '9.9.9-upgraded' },
    timeSource: { ...h.facts.timeSource, state: 'UNLOCKED' },
    operator: { ...h.facts.operator, displayName: 'Renamed Operator' },
    tracks: [{ ...h.facts.tracks[0]!, name: 'Renamed camera' }, h.facts.tracks[1]!], // D60 (2026-11-04): tracks is a 1..4 array now, not a fixed pair
  };
}
async function stoppedThenResumed(step: SealingStepId, phase: SealingHookPoint['phase']) {
  const recording = recordSession();
  const h = harnessOf(recording);
  const before = structuredClone({ device: h.facts.device, timeSource: h.facts.timeSource, operator: h.facts.operator, name: h.facts.tracks[0]!.name }); // D60: indexed read of the 1..4 track array
  h.hook = stopAt(step, phase);
  await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
  afterRestart(h);
  h.hook = null;
  const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
  return { recording, h, before, outcome };
}

describe('R88-03: the inputs of the manifest are frozen once, in the BUILD_MANIFEST checkpoint', () => {
  it.each([
    ['BUILD_MANIFEST', 'AFTER_CHECKPOINT'],
    ['BUILD_MANIFEST', 'AFTER_WORK'],
    ['SIGN_MANIFEST', 'BEFORE'],
  ] as const)('the Core stops at %s %s and live state differs at the restart: the seal COMPLETES with the values of the snapshot, and verifies', async (step, phase) => {
    const { recording, h, before, outcome } = await stoppedThenResumed(step, phase);
    const sealed = sealedOf(outcome);
    expect(sealed.attempt).toBe(2);
    const manifest = manifestOf(recording);
    // The manifest states the session as it was when the manifest was first built - not as the restart found it.
    expect(manifest.device.softwareVersion).toBe(before.device.softwareVersion);
    expect(manifest.timeline.timeSource.state).toBe(before.timeSource.state);
    expect(manifest.operator.displayName).toBe(before.operator.displayName);
    expect(manifest.tracks[0]?.name).toBe(before.name);
    expect(manifest.device.softwareVersion).not.toBe('9.9.9-upgraded');
    const result = await verifyPackageV2(corePorts(recording.packageDir, recording.opener, 256), { plaintext: 'REQUIRED', expected: h.anchors() });
    expect([result.ok, result.overall]).toEqual([true, 'PASS']);
    expect(h.engine.sealed).toHaveLength(1);
  });

  it('the snapshot is IN the checkpoint row (and holds no fragment table: that is `fragments.json`, read again and held to the digest)', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_CHECKPOINT');
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    const checkpoint = h.journal.rows.get(`${recording.sessionId}#BUILD_MANIFEST`)?.checkpoint as Record<string, unknown>;
    expect(checkpoint).toMatchObject({ input: { sessionId: recording.sessionId, device: { softwareVersion: h.facts.device.softwareVersion } } });
    expect((checkpoint.input as Record<string, unknown>).files).toBeUndefined();
    expect(Array.isArray(checkpoint.sourceRows)).toBe(true);
  });

  it('CONTROL: stopped BEFORE the checkpoint exists (after FINALIZE_TRANSCRIPT) - the first build reads the session record as it is THEN', async () => {
    const { recording, outcome } = await stoppedThenResumed('FINALIZE_TRANSCRIPT', 'AFTER_CHECKPOINT');
    sealedOf(outcome);
    expect(manifestOf(recording).device.softwareVersion).toBe('9.9.9-upgraded');
    expect(manifestOf(recording).operator.displayName).toBe('Renamed Operator');
  });

  it('CONTROL: what is NOT a snapshot matter still stops the signer - a fragment table changed after the build is not the digest of the checkpoint, and nothing is signed', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    h.hook = stopAt('BUILD_MANIFEST', 'AFTER_CHECKPOINT');
    await expect(h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
    const { writeFileSync } = await import('node:fs');
    const table = JSON.parse(readFileSync(recording.path(PackageFile.FRAGMENTS_JSON), 'utf8')) as { files: { fragments: { durableAt: number }[] }[] };
    table.files[0]!.fragments[0]!.durableAt += 1;
    const { canonicalJson } = await import('@dems/shared/evidence-package');
    writeFileSync(recording.path(PackageFile.FRAGMENTS_JSON), canonicalJson(table));
    h.hook = null;
    const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', step: 'SIGN_MANIFEST', code: 'MANIFEST_NOT_REPRODUCIBLE' });
    expect(h.engine.sealed).toHaveLength(0);
  });
});
