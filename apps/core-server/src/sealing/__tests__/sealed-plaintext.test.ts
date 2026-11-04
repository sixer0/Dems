// Fix pass F-M7c (review row 88, R88-05 the open MAJOR, with R88-15):
//
//   PLAINTEXT NEVER OUTLIVES A SEALED OUTCOME WITH NOBODY TOLD.
//   (i)   a start of the Core finishes the pending removals of EVERY sealed session - not only the
//         current one - under the proof rule: the signed manifest names the file, it is a regular
//         file directly in the session folder, the sealed counterpart is there, its bytes hash to
//         the manifest's plaintext hash; and (R88-15) when the removal runs in a LATER attempt
//         than the seal, the sealed file is decrypted and held against the recording-time digests
//         AGAIN before the only other copy goes;
//   (ii)  the orphan `.part` files under `.sealing/<id>/orphans/` of a sealed session are removed,
//         under a containment rule;
//   (iii) a plaintext file that must be KEPT is never one log line: it is MOVED to
//         `<mediaStoreRoot>/.quarantine/<sessionId>/` and the engine is told ONCE (one alert + one
//         audit row, `sealing-notice-doors`).
//
// Evidence integrity: every rule has its control; the mutation proof of the MAJOR is in the note
// of this pass (the repeated decrypt-and-compare switched off -> the wrong-content case turns red).
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { declaredPackageFiles } from '@dems/shared/evidence-package';
import { VERIFY_V2_CHECKS, verifyPackageV2, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { afterAll, describe, expect, it } from 'vitest';
import { corePorts } from '../../evidence-verify';
import { SEALING_QUARANTINE_DIR, SEALING_STEP_ORDER, SealingStop, createSealingPipeline, sweepSealedSession, type KeptPlaintextNote, type SealOutcome, type SealedSessionSweepPorts } from '../index';
import { listPackageFiles } from '../pipeline/camera-files';
import { removePackages } from './package-support';
import { TRACKS, harnessOf, recordSession, removeRecordings, sha256Hex, type Harness } from './pipeline-support';

afterAll(() => {
  removeRecordings();
  removePackages();
});

const ALL = VERIFY_V2_CHECKS.map((check) => check.id);
const verify = (h: Harness): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(h.recording.packageDir, h.recording.opener, 256), { plaintext: 'REQUIRED', expected: h.anchors() });
const passing = (result: PackageVerifyResult): string[] => result.checks.filter((check) => check.status === 'PASS').map((check) => check.id);
const sealedOf = (outcome: SealOutcome): Extract<SealOutcome, { status: 'SEALED' }> => {
  if (outcome.status !== 'SEALED') throw new Error(`not sealed: ${JSON.stringify(outcome)}`);
  return outcome;
};
const rowOf = (h: Harness, step: string) => h.journal.rows.get(`${h.recording.sessionId}#${step}`);
const quarantineOf = (h: Harness): string => join(h.recording.mediaDir, SEALING_QUARANTINE_DIR, h.recording.sessionId);
const orphansOf = (h: Harness): string => join(h.recording.stagingDir, 'orphans');

/** The engine side of the notice: what it was told, and - like the door - only ONCE per session while the alert is active. */
function notices(): { readonly told: KeptPlaintextNote[]; readonly note: (input: KeptPlaintextNote) => Promise<boolean> } {
  const told: KeptPlaintextNote[] = [];
  return {
    told,
    note: async (input) => {
      if (told.some((entry) => entry.sessionId === input.sessionId)) return false;
      told.push(structuredClone(input) as KeptPlaintextNote);
      return true;
    },
  };
}

/** The process ends INSIDE the last step, right after the engine committed the item: no removal, no DONE row. */
async function killedAfterCommit(h: Harness): Promise<void> {
  const point = { step: 'STORE_SEALED_PACKAGE', phase: 'AFTER_WORK', attempt: 1 } as const;
  const pipeline = createSealingPipeline({
    ...h.ports,
    engine: {
      ...h.ports.engine,
      completeSeal: async (input, transcript) => {
        await h.ports.engine.completeSeal(input, transcript);
        throw new SealingStop(point);
      },
    },
  });
  await expect(pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' })).rejects.toBeInstanceOf(SealingStop);
}

/** What the composition hands the sweep for a session that is NOT the current one. */
function sweepPortsOf(h: Harness, note: (input: KeptPlaintextNote) => Promise<boolean>): SealedSessionSweepPorts {
  return {
    packageDir: h.ports.packageDir,
    stagingDir: h.ports.stagingDir,
    quarantineDir: h.ports.quarantineDir,
    opener: h.ports.opener,
    fragments: h.ports.fragments,
    journal: h.ports.journal,
    log: h.ports.log,
    now: h.ports.now,
    chunkBytes: 512,
    noteKeptPlaintext: note,
  };
}
const manifestDigestOf = (h: Harness): string => h.engine.sealed.at(-1)!.input.manifestSha256;
const sweep = (h: Harness, note: (input: KeptPlaintextNote) => Promise<boolean>) => sweepSealedSession(sweepPortsOf(h, note), { sessionId: h.recording.sessionId, manifestSha256: manifestDigestOf(h) });

describe('R88-05 (i): the boot sweep finishes the pending removal of a sealed session that is NOT the current one', () => {
  it('killed between the commit and the removal, and another session is current since: the sweep removes both recordings by proof, closes the journal, tells nobody', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    await killedAfterCommit(h);
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'RUNNING', attempt: 1 });
    const n = notices();

    const done = await sweep(h, n.note);

    expect(done).toMatchObject({ touched: true, recordingsRemoved: 2, recordingsKept: 0, journalClosed: true });
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(false);
    expect(await listPackageFiles(h.recording.packageDir)).toEqual([...declaredPackageFiles({ transcript: false, tracks: TRACKS })].sort()); // D60 (2026-11-04): the camera files are the manifest's own list - the default without one declares all four
    expect(SEALING_STEP_ORDER.map((step) => rowOf(h, step)?.status)).toEqual(Array.from({ length: 6 }, () => 'DONE'));
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ attempt: 2, checkpoint: { committed: 'ALREADY_SEALED', recordingsRemoved: 2, recordingsKept: 0, finishedBy: 'BOOT_SWEEP' } });
    expect(n.told).toEqual([]);
    expect(existsSync(quarantineOf(h))).toBe(false);
    const result = await verify(h);
    expect(passing(result)).toEqual(ALL);
    // A second sweep finds nothing to do.
    expect(await sweep(h, n.note)).toMatchObject({ touched: false });
  });

  it('CONTROL: the manifest digest the Core holds for the item is ANOTHER one - the folder is not this item\'s package: nothing is removed, nothing is moved, the journal stays open', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    await killedAfterCommit(h);
    const n = notices();
    const done = await sweepSealedSession(sweepPortsOf(h, n.note), { sessionId: h.recording.sessionId, manifestSha256: sha256Hex(Buffer.from('another manifest')) });
    expect(done).toMatchObject({ touched: false, refused: 'MANIFEST_NOT_OF_ITEM' });
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.status).toBe('RUNNING');
    expect(h.log.entries.some((entry) => entry.code === 'SEALING_SWEEP_REFUSED')).toBe(true);
  });

  it('CONTROL: a sealed session whose folder is the package and nothing else is not touched (no row written, no file read twice)', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    sealedOf(await h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    const before = rowOf(h, 'STORE_SEALED_PACKAGE');
    const n = notices();
    expect(await sweep(h, n.note)).toMatchObject({ touched: false });
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toEqual(before);
  });
});

describe('R88-15: the removal in a LATER attempt repeats the decrypt-and-compare of the sealed file before the plaintext goes', () => {
  /** One byte of a sealed fragment changed, the file as long as before: the size check of the base tree passes. */
  const corruptSealed = (h: Harness, trackId: (typeof TRACKS)[number]): void => {
    const path = h.recording.cameraFile(trackId);
    const bytes = readFileSync(path);
    bytes[bytes.length - 40] = bytes[bytes.length - 40]! ^ 0x55;
    writeFileSync(path, bytes);
  };

  it('a sealed camera file of the right LENGTH and wrong CONTENT: the good plaintext copy is NOT deleted - it is moved to the quarantine and the engine is told once', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    await killedAfterCommit(h);
    const original = readFileSync(h.recording.recordingFile('VIDEO-02'));
    corruptSealed(h, 'VIDEO-02');
    const n = notices();

    const done = await sweep(h, n.note);

    expect(done).toMatchObject({ touched: true, recordingsRemoved: 1, recordingsKept: 1 });
    // The ONLY good copy of VIDEO-02 is kept, byte for byte, owner-only, outside the session folder.
    expect(existsSync(h.recording.recordingFile('VIDEO-02'))).toBe(false);
    const kept = join(quarantineOf(h), 'VIDEO-02.mp4');
    expect(readFileSync(kept).equals(original)).toBe(true);
    expect(statSync(kept).mode & 0o777).toBe(0o600);
    expect(statSync(quarantineOf(h)).mode & 0o777).toBe(0o700);
    // VIDEO-01 was proven and went.
    expect(existsSync(h.recording.recordingFile('VIDEO-01'))).toBe(false);
    expect(existsSync(join(quarantineOf(h), 'VIDEO-01.mp4'))).toBe(false);
    expect(n.told).toEqual([{ sessionId: h.recording.sessionId, files: [{ trackId: 'VIDEO-02', name: 'VIDEO-02.mp4', reason: 'SEALED_FILE_NOT_PROVEN' }] }]);
    expect(h.log.entries.filter((entry) => entry.code === 'SEALING_PLAINTEXT_QUARANTINED').map((entry) => [entry.context?.trackId, entry.context?.reason])).toEqual([['VIDEO-02', 'SEALED_FILE_NOT_PROVEN']]);
  });

  it('the same through the pipeline\'s own FINISH (the current session, attempt 2): the plaintext of the corrupt track is quarantined, the step is DONE and says so', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    await killedAfterCommit(h);
    const original = readFileSync(h.recording.recordingFile('VIDEO-01'));
    corruptSealed(h, 'VIDEO-01');
    const n = notices();
    const pipeline = createSealingPipeline({ ...h.ports, engine: { ...h.ports.engine, noteKeptPlaintext: n.note } });
    const outcome = sealedOf(await pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(outcome.attempt).toBe(2);
    expect(readFileSync(join(quarantineOf(h), 'VIDEO-01.mp4')).equals(original)).toBe(true);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'DONE', checkpoint: { committed: 'ALREADY_SEALED', recordingsRemoved: 1, recordingsKept: 1, recordingsQuarantined: 1 } });
    expect(n.told).toHaveLength(1);
  });

  it('CONTROL: in the SAME attempt as FINALIZE_HASHES nothing is decrypted twice (the opener is not asked again by the last step)', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    let opens = 0;
    let lastStep = false;
    const pipeline = createSealingPipeline({
      ...h.ports,
      opener: { hasKey: (keyId) => h.recording.opener.hasKey(keyId), open: (record, stored) => ((opens += lastStep ? 1 : 0), h.recording.opener.open(record, stored)) },
      hook: async (point) => {
        if (point.step === 'STORE_SEALED_PACKAGE' && point.phase === 'BEFORE') lastStep = true;
      },
    });
    sealedOf(await pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(opens).toBe(0);
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(false);
  });

  it('CONTROL: the session key is not there in the later attempt - a cause that may heal: nothing is removed AND nothing is moved; the failure is named', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    await killedAfterCommit(h);
    const n = notices();
    const done = await sweepSealedSession({ ...sweepPortsOf(h, n.note), opener: { hasKey: () => false, open: () => Promise.reject(new Error('no key')) as never } }, { sessionId: h.recording.sessionId, manifestSha256: manifestDigestOf(h) });
    expect(done).toMatchObject({ touched: false, refused: 'FRAGMENT_NOT_OPENABLE' });
    for (const trackId of TRACKS) expect(existsSync(h.recording.recordingFile(trackId))).toBe(true);
    expect(existsSync(quarantineOf(h))).toBe(false);
    expect(n.told).toEqual([]);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.status).toBe('RUNNING');
  });
});

describe('R88-05 (iii): a plaintext file that must be kept is MOVED to the quarantine and told once - never one log line', () => {
  it('another file under a recording\'s name and a link under the other: both are in the quarantine (the link as the link it is), ONE notice names the session and both files; other files stay', async () => {
    const h = harnessOf(recordSession({ fragments: 3 }));
    await killedAfterCommit(h);
    const outside = mkdtempSync(join(tmpdir(), 'dems-fm7c-outside-'));
    try {
      const second = h.recording.recordingFile('VIDEO-02');
      const foreign = Buffer.from(readFileSync(second));
      foreign[foreign.length - 5] = foreign[foreign.length - 5]! ^ 0xff;
      writeFileSync(second, foreign);
      const first = h.recording.recordingFile('VIDEO-01');
      const target = join(outside, 'VIDEO-01.mp4');
      writeFileSync(target, readFileSync(first));
      rmSync(first);
      symlinkSync(target, first);
      writeFileSync(h.recording.path('notes.txt'), 'kept');
      const n = notices();

      const done = await sweep(h, n.note);

      expect(done).toMatchObject({ touched: true, recordingsRemoved: 0, recordingsKept: 2 });
      expect(existsSync(first)).toBe(false);
      expect(existsSync(second)).toBe(false);
      expect(lstatSync(join(quarantineOf(h), 'VIDEO-01.mp4')).isSymbolicLink()).toBe(true);
      // The link was never followed: what it points at is untouched.
      expect(existsSync(target)).toBe(true);
      expect(readFileSync(join(quarantineOf(h), 'VIDEO-02.mp4')).equals(foreign)).toBe(true);
      // A file the manifest knows nothing of is never looked at.
      expect(readFileSync(h.recording.path('notes.txt'), 'utf8')).toBe('kept');
      expect(n.told).toEqual([
        {
          sessionId: h.recording.sessionId,
          files: [
            { trackId: 'VIDEO-01', name: 'VIDEO-01.mp4', reason: 'NOT_A_REGULAR_FILE' },
            { trackId: 'VIDEO-02', name: 'VIDEO-02.mp4', reason: 'NOT_THE_SEALED_BYTES' },
          ],
        },
      ]);
      // Told ONCE: a second sweep (the journal is closed, nothing is left under a recording's name) tells nothing more.
      await sweep(h, n.note);
      expect(n.told).toHaveLength(1);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('the engine cannot be told (it refuses): NOTHING is moved - the file stays where it is and the next start tries again', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    await killedAfterCommit(h);
    const second = h.recording.recordingFile('VIDEO-02');
    writeFileSync(second, Buffer.concat([readFileSync(second).subarray(0, 100), Buffer.alloc(readFileSync(second).length - 100, 7)]));
    const done = await sweep(h, async () => {
      throw new Error('the engine is not running');
    });
    expect(done).toMatchObject({ touched: false, refused: 'NOTICE_NOT_WRITTEN' });
    expect(existsSync(second)).toBe(true);
    expect(existsSync(quarantineOf(h))).toBe(false);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.status).toBe('RUNNING');
  });
});

describe('R88-05 (ii): the orphan `.part` files of a SEALED session are removed, under a containment rule', () => {
  const plantOrphans = (h: Harness): void => {
    mkdirSync(orphansOf(h), { recursive: true, mode: 0o700 });
    writeFileSync(join(orphansOf(h), 'VIDEO-01.mp4.4242.part'), 'plaintext of a dead worker');
    writeFileSync(join(orphansOf(h), 'VIDEO-02.mp4.77.part'), 'plaintext of a dead worker');
  };

  it('the pipeline removes them after the commit of the item, and the empty staging folder with them', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    plantOrphans(h);
    sealedOf(await h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    expect(existsSync(orphansOf(h))).toBe(false);
    expect(existsSync(h.recording.stagingDir)).toBe(false);
    expect(rowOf(h, 'STORE_SEALED_PACKAGE')?.checkpoint).toMatchObject({ orphansRemoved: 2 });
  });

  it('CONTROL: a seal that FAILS keeps them (they go only when the session is sealed)', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    plantOrphans(h);
    writeFileSync(h.recording.path('stray.bin'), 'not declared');
    const outcome = await h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' });
    expect(outcome).toMatchObject({ status: 'FAILED', code: 'PACKAGE_NOT_CLEAN' });
    expect(readdirSync(orphansOf(h)).sort()).toEqual(['VIDEO-01.mp4.4242.part', 'VIDEO-02.mp4.77.part']);
  });

  it('the sweep removes the orphans of an older sealed session; CONTAINMENT: a name of another form, a link and a folder stay, and an `orphans` that is a link is never entered', async () => {
    const h = harnessOf(recordSession({ fragments: 2 }));
    sealedOf(await h.pipeline.run({ sessionId: h.recording.sessionId, cause: 'STOPPED' }));
    const outside = mkdtempSync(join(tmpdir(), 'dems-fm7c-orphans-'));
    try {
      plantOrphans(h);
      writeFileSync(join(orphansOf(h), 'notes.txt'), 'kept');
      writeFileSync(join(outside, 'target.part'), 'kept');
      symlinkSync(join(outside, 'target.part'), join(orphansOf(h), 'VIDEO-01.mp4.9.part'));
      mkdirSync(join(orphansOf(h), 'VIDEO-02.mp4.5.part'));
      const n = notices();
      const done = await sweep(h, n.note);
      expect(done).toMatchObject({ touched: true, orphansRemoved: 2 });
      expect(readdirSync(orphansOf(h)).sort()).toEqual(['VIDEO-01.mp4.9.part', 'VIDEO-02.mp4.5.part', 'notes.txt']);
      expect(readFileSync(join(outside, 'target.part'), 'utf8')).toBe('kept');
      expect(n.told).toEqual([]);

      // An `orphans` that is a LINK to another folder: nothing behind it is removed.
      const other = harnessOf(recordSession({ fragments: 2 }));
      sealedOf(await other.pipeline.run({ sessionId: other.recording.sessionId, cause: 'STOPPED' }));
      writeFileSync(join(outside, 'VIDEO-01.mp4.1.part'), 'kept');
      mkdirSync(other.recording.stagingDir, { recursive: true });
      symlinkSync(outside, orphansOf(other));
      expect(await sweep(other, n.note)).toMatchObject({ orphansRemoved: 0 });
      expect(readFileSync(join(outside, 'VIDEO-01.mp4.1.part'), 'utf8')).toBe('kept');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
