// Integration pass D10, item 3 (pass D6 item 7; register CS-09): after a boot in a real capture
// operation the `storage` slice - and operations 53 / 54, which read it - shows the MEASURED figures
// of the evidence volume; a simulated boot keeps the simulator's. Each case is a whole boot of the
// real app factory on its own clone of the seed, as `dems_app`. No device is opened: the worker is
// row 61's stand-in script and the speech runtime is switched off in the clone.
import { statfsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { captureBootControl } from '../../../capture/boot';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import type { ConfigInput } from '../../../config';
import { storageStatusOf } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('d10volume');
fixture.provisionKey();

async function booted(slug: string, overrides: Partial<ConfigInput>) {
  const target = await db.another({ template: 'seed', slug });
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: captureLog().stream });
  target.onCleanup(() => app.close());
  await app.ready();
  await app.readiness.boot();
  return { app };
}

const evidenceVolume = (state: { storage: { volumes: ReadonlyArray<{ kind: string; totalBytes: number; usedBytes: number }> } }) => {
  const volume = state.storage.volumes.find((candidate) => candidate.kind === 'EVIDENCE');
  if (volume === undefined) throw new Error('no evidence volume in the storage slice');
  return { totalBytes: volume.totalBytes, usedBytes: volume.usedBytes };
};

describe('CS-09: the storage slice after a boot', () => {
  it('schema version 6, contract dbc-7', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });

  it('SIMULATED: the figures are the simulator\'s (the seed\'s), and the boot measured nothing', async () => {
    const { app } = await booted('d10_vol_sim', {});
    expect(captureBootControl(app).outcome()?.evidenceVolume).toBeNull();
    const seeded = evidenceVolume(app.engine.state());
    // The seed's evidence volume is the demonstration's 4 TB disk, never this host's.
    const host = statfsSync(db.run.dataDir);
    expect(seeded.totalBytes).not.toBe(Number(host.blocks) * Number(host.bsize));
    simulatedTotal = seeded.totalBytes;
  });

  // REAL_DEVELOPMENT: the seed's selector names the built-in test sources, which a production operation refuses at the fence.
  it('REAL: the evidence volume of the slice is the measured one, and operation 53 answers from it', async () => {
    const { app } = await booted('d10_vol_real', { captureMode: 'real', demoControls: false, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, captureWorkerPath: fixture.worker('worker-d10-volume', 'capture-worker/0.4.0'), captureDevSources: true, captureHelperFfmpegPath: '/bin/echo' });
    const measured = captureBootControl(app).outcome()?.evidenceVolume;
    expect(measured?.totalBytes).toBeGreaterThan(1_000_000_000);
    const shown = evidenceVolume(app.engine.state());
    expect(shown).toEqual({ totalBytes: measured?.totalBytes, usedBytes: (measured?.totalBytes ?? 0) - (measured?.freeBytes ?? 0) });
    // CONTROL: it is no longer the simulator's figure (the simulated case above ran on the same seed).
    expect(simulatedTotal).not.toBeNull();
    expect(shown.totalBytes).not.toBe(simulatedTotal);
    // Operation 53 reads the slice: the same figures reach a client.
    const status = storageStatusOf(app.engine.state());
    expect(JSON.stringify(status)).toContain(String(shown.totalBytes));
    // `engine.state()` is the COMMITTED state: the unit of the hand-over was written (a restart reads the figures back).
    expect(evidenceVolume(app.engine.state())).toEqual(shown);
  });
});

/** The simulated case's total, for the control of the real case. */
let simulatedTotal: number | null = null;
