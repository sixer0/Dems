// The root both reset guards read (controller decision D165; `dbc-3` §E.2; a safety defect found by
// integration pass D11), against PostgreSQL, the REAL engine and the REAL routine.
//
// THE DEFECT. The caller-side guard and the routine's own guard read `<dataDir>/media/sessions`.
// The Core seals into `config.mediaStoreDir`, which an installation may point elsewhere
// (`DEMS_MEDIA_DIR`). On such an installation a sealed package on disk was invisible to the guard,
// and a reset could run beside it.
//
// THIS FILE: one server whose media root lies OUTSIDE its data directory, a SIGNED package of
// production sources in that root (real bytes, hashes, Ed25519 of a throw-away key; the tables hold
// no row for it - the half the disk side alone can see), and a reset asked for through HTTP.
//
//   1  the caller-side guard reads the configured root: 409, nothing stopped, the epoch the same.
//      CONTROL: the old path logic (the root below the data directory) finds nothing and would
//      have permitted the reset.
//   2  the ROUTINE's guard reads the configured root too: the package is put there after the
//      caller-side guard passed (at the routine's first checkpoint), and R-3 refuses.
//      CONTROL: the store root named in the routine's refusal is the configured one.
//
// WHICH DATABASE IS RESET. This file's own clone, and in fact none: both cases are refusals.
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { evidenceStoreRoot, evidenceStoreRootOf, readEvidenceStore } from '../../../db/commands/evidence-store';
import { findRealSealedEvidence } from '../../../db/reset';
import { chainFacts, dropOwn, maintenancePool, resetApplicationName } from '../../../../test/support/reset';
import { packageFolderName } from '@dems/shared/evidence-package';
import { readSealedSourceMark } from '../../../evidence-verify';
import { buildPackage, removeScratch } from '../../../evidence-verify/__tests__/support';
import { demoControl } from '../index';
import { RESET, demoApp, errorOf, outcome, testRoutine, type DemoApp } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'd165root' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const SESSION_ID = 'SES-20261010-0165';
/** Outside the data directory of the run: where this installation keeps its sealed packages. */
const mediaRoot = mkdtempSync(join(tmpdir(), 'dems-d165-media-'));
const FOLDER = packageFolderName(SESSION_ID);

let server: DemoApp;
let maintenance: Pool;
let packageSource = '';

const owner = (): Pool => db.ownerPool();
const names = (): string[] => [db.name, `${db.name}_next`, `${db.name}_prev`];
const plant = (): void => cpSync(packageSource, join(mediaRoot, FOLDER), { recursive: true });
const unplant = (): void => rmSync(join(mediaRoot, FOLDER), { recursive: true, force: true });
const marksSince = (from: number): string[] =>
  server.log
    .lines()
    .slice(from)
    .flatMap((line) => (line['msg'] === 'readiness hold' ? [`hold ${String(line['held'])}`] : line['msg'] === 'engine stopped' ? ['engine stopped'] : line['msg'] === 'engine started' ? [`engine started (${String(line['mode'])})`] : []));

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  // The media root is NOT below the data directory: the case of the defect.
  expect(relative(db.run.dataDir, mediaRoot).startsWith('..')).toBe(true);
  server = await demoApp(db, { demoControls: true, dataDir: db.run.dataDir, mediaStoreDir: mediaRoot });
  expect(server.app.config.mediaStoreDir).toBe(mediaRoot);
  demoControl(server.app).replace({ routine: testRoutine(db.database, { runPrefix: db.run.identity.prefix, applicationName: resetApplicationName(db.run.identity.stamp, 'd165root'), maintenance }) });
  // A signed package of PRODUCTION sources, as a seal writes one.
  const built = await buildPackage({
    sessionId: SESSION_ID,
    folderName: FOLDER,
    fragments: 2,
    fragmentBytes: 64,
    sourceRows: [
      { slot: 'VIDEO-01', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
      { slot: 'VIDEO-02', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
      { slot: 'MIC-PRIMARY', deviceId: 'MIC-01', adapterKind: 'USB_AUDIO' },
      { slot: 'MIC-STANDBY', deviceId: 'MIC-02', adapterKind: 'USB_AUDIO' },
    ],
    beforeSeal: (input) => {
      const loose = input as unknown as { tracks: { deviceId: string }[]; audio: { sourceIntervals: { micDeviceId: string }[] } };
      loose.tracks.forEach((track) => (track.deviceId = 'CAM-07'));
      loose.audio.sourceIntervals.forEach((interval, index) => (interval.micDeviceId = index === 0 ? 'MIC-01' : 'MIC-02'));
    },
  });
  expect(built.manifest.developmentSources).toBe(false);
  // It IS a signed package: the verify unit reads its source mark with the anchors of its own manifest.
  const mark = await readSealedSourceMark(built.dir, { sessionId: SESSION_ID, evidenceId: built.manifest.evidenceId, manifestSha256: built.manifest.manifestSha256 });
  expect(JSON.stringify(mark)).not.toMatch(/"developmentSources":true/);
  packageSource = built.dir;
  mkdirSync(mediaRoot, { recursive: true });
});

afterAll(async () => {
  await server?.app.close();
  await db.database.closeResources();
  for (const name of names().reverse()) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
  removeScratch();
  rmSync(mediaRoot, { recursive: true, force: true });
});

describe('D165: both reset guards read the media root of the configuration, not a directory below the data directory', () => {
  it('1 - the caller-side guard: a signed production package in the configured root BLOCKS the reset (409, nothing stopped, the epoch the same); CONTROL: the old path logic finds nothing there and would have permitted it', async () => {
    plant();
    try {
      // CONTROL (the defect): the root the guards read before this change holds no package, so the guard let the reset on.
      const oldRoot = evidenceStoreRoot(db.run.dataDir);
      expect(oldRoot).not.toBe(mediaRoot);
      expect(readEvidenceStore(oldRoot).packages.map((entry) => entry.directory)).not.toContain(FOLDER);
      const old = await findRealSealedEvidence(owner(), { database: db.name, dataDir: db.run.dataDir });
      expect([old.storeRoot, old.blocked, old.unprovablePackages, old.diskSessions]).toEqual([oldRoot, false, [], []]);
      // The same question with the configured root: blocked, by the package and by nothing else (the tables hold no REAL row).
      const now = await findRealSealedEvidence(owner(), { database: db.name, storeRoot: server.app.config.mediaStoreDir });
      expect([now.storeRoot, now.blocked, now.dbSessions]).toEqual([mediaRoot, true, []]);
      expect([...now.unprovablePackages, ...now.diskSessions]).toHaveLength(1);

      const linesBefore = server.log.lines().length;
      const response = await server.post('SUPERVISOR', RESET);
      expect(outcome(response)).toEqual([409, 'RESET_BLOCKED_REAL_EVIDENCE']);
      expect(errorOf(response).details).toBeUndefined();
      expect(marksSince(linesBefore)).toEqual([]);
      expect(server.engine).toMatchObject({ running: true, epoch: 1 });
      expect((await chainFacts(owner())).epoch).toBe('1');
      // The module's own refusal names the root it read: the configured one.
      const said = server.log.lines().slice(linesBefore).find((line) => line['code'] === 'RESET_BLOCKED_REAL_EVIDENCE' && line['quiesced'] === false);
      expect(said).toMatchObject({ storeRoot: mediaRoot, storePresent: true, realRows: 0 });
      // The package is untouched.
      expect(readEvidenceStore(mediaRoot).packages.map((entry) => entry.directory)).toEqual([FOLDER]);
    } finally {
      unplant();
    }
  });

  it('2 - the routine\'s own guard (R-3) reads the same root: a package that appears after the caller-side guard passed stops the routine before anything is rebuilt; the server comes back; 409', async () => {
    let planted = false;
    demoControl(server.app).replace({
      routine: testRoutine(db.database, {
        runPrefix: db.run.identity.prefix,
        applicationName: resetApplicationName(db.run.identity.stamp, 'd165root'),
        maintenance,
        onCheckpoint: () => {
          // The first checkpoint of the routine: the caller-side guard has passed by now.
          if (!planted) plant();
          planted = true;
        },
      }),
    });
    try {
      const linesBefore = server.log.lines().length;
      const response = await server.post('SUPERVISOR', RESET);
      expect(planted).toBe(true);
      expect(outcome(response)).toEqual([409, 'RESET_BLOCKED_REAL_EVIDENCE']);
      const lines = server.log.lines().slice(linesBefore);
      // The caller-side guard did NOT refuse (no line of its own); the routine did, at R-3, with the database untouched ...
      expect(lines.filter((line) => line['code'] === 'RESET_BLOCKED_REAL_EVIDENCE' && line['quiesced'] === false)).toEqual([]);
      expect(lines.find((line) => line['routineCode'] !== undefined)).toMatchObject({ routineCode: 'RESET_BLOCKED_REAL_EVIDENCE', routineStep: 'R-3', targetUntouched: true });
      // ... and the root it read is the configured one (the routine's own log line of the refusal).
      expect(lines.find((line) => line['code'] === 'RESET_BLOCKED_REAL_EVIDENCE' && line['storeRoot'] !== undefined && line['quiesced'] === undefined)).toMatchObject({ storeRoot: mediaRoot });
      // The server was quiesced for it and is back; nothing was rebuilt (the chain is the one it had).
      expect(marksSince(linesBefore)).toEqual(['hold true', 'engine stopped', 'engine started (resync)', 'hold false']);
      expect(server.app.readiness.isReady()).toBe(true);
      expect(readEvidenceStore(mediaRoot).packages.map((entry) => entry.directory)).toEqual([FOLDER]);
    } finally {
      unplant();
    }
  });
});

describe('D165: the command line resolves the root by the configuration\'s own rule', () => {
  it('`DEMS_MEDIA_DIR` when it is set, the directory below the data directory when it is not; a value that is no absolute path is refused, never replaced by the default', () => {
    expect(evidenceStoreRootOf(db.run.dataDir, { DEMS_MEDIA_DIR: mediaRoot })).toBe(server.app.config.mediaStoreDir);
    expect(evidenceStoreRootOf(db.run.dataDir, {})).toBe(evidenceStoreRoot(db.run.dataDir));
    expect(evidenceStoreRootOf(db.run.dataDir, { DEMS_MEDIA_DIR: '' })).toBe(evidenceStoreRoot(db.run.dataDir));
    expect(() => evidenceStoreRootOf(db.run.dataDir, { DEMS_MEDIA_DIR: 'media/elsewhere' })).toThrow(/absolute/);
  });
});
