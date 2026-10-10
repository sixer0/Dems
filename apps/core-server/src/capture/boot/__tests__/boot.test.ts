// The boot step `capture.boot` as mounted (blueprint row 61; check M3-BC-1): the readiness runner,
// the control, and the DEFAULT wiring - the real path inspector, the real probe of the media root,
// the real key store and the real process channel - on a fixture below `.data/`. The worker is a
// stand-in shell script that says one HELLO (no capture worker is started here: that is
// `worker-probe.real.ts`, a check for the test runner). No database: the step needs none.
import { chmodSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { unitTestConfig } from '../../../../test/support/config';
import type { ConfigInput } from '../../../config';
import { BootError, createReadiness } from '../../../plugins/readiness';
import { CaptureOperation } from '../../adapters/kinds';
import { createSystemTimers } from '../../timers';
import { CAPTURE_BOOT_STEP, CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, SIMULATED_WITHOUT_DEMO_CONTROLS, captureBootControl, mountCaptureBootChecks, type CaptureBootControl } from '../index';
import { FIXTURE_NOW, realBootFixture, recordedSinks } from './support';

const fixture = realBootFixture('boot');
afterAll(() => fixture.remove());

interface Mounted {
  readonly control: CaptureBootControl;
  readonly recorded: ReturnType<typeof recordedSinks>;
  boot(): Promise<void>;
  refusal(): Promise<CaptureBootError>;
}
function mounted(overrides: Partial<ConfigInput>): Mounted {
  const recorded = recordedSinks();
  const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
  const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
  const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000 });
  expect(captureBootControl(app)).toBe(control);
  const boot = (): Promise<void> => app.readiness.boot();
  return {
    control,
    recorded,
    boot,
    async refusal() {
      const failure = await boot().then(
        () => null,
        (error: unknown) => error,
      );
      if (!(failure instanceof BootError) || !(failure.cause instanceof CaptureBootError)) throw new Error('the boot was not refused by the capture boot checks');
      expect(failure.stepId).toBe(CAPTURE_BOOT_STEP);
      return failure.cause;
    },
  };
}

describe('the boot step, with nothing replaced', () => {
  it('SIMULATED (the default of every test app): passes with no worker, no media root and no key; nothing is created', async () => {
    const app = mounted({ dataDir: `${fixture.dataDir}/never-created` });
    expect(app.control.outcome()).toBeNull();
    await app.boot();
    expect(app.control.outcome()).toEqual({ operation: CaptureOperation.SIMULATED, label: SIMULATED_WITHOUT_DEMO_CONTROLS, workerVersion: null, evidenceVolume: null });
    expect(() => statSync(`${fixture.dataDir}/never-created`)).toThrow();
  });

  it('real, nothing configured: refused for the missing key', async () => {
    const failure = await mounted({ captureMode: 'real' }).refusal();
    expect(failure.code).toBe(CaptureBootRefusal.WORKER_NOT_CONFIGURED);
  });

  it('real with demo controls on: refused, whatever else is configured', async () => {
    const failure = await mounted({ captureMode: 'real', demoControls: true, captureWorkerPath: fixture.worker('worker-demo') }).refusal();
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.OPERATION_REFUSED, 'REAL_CAPTURE_WITH_DEMO_CONTROLS']);
  });

  it('real, a worker path that is not there, and one that others can write: refused by the path rule, on real files', async () => {
    expect((await mounted({ captureMode: 'real', captureWorkerPath: `${fixture.dataDir}/no-such-worker` }).refusal()).reason).toBe('NOT_FOUND');
    const loose = fixture.worker('worker-loose');
    chmodSync(loose, 0o777);
    expect((await mounted({ captureMode: 'real', captureWorkerPath: loose }).refusal()).reason).toBe('FILE_WRITABLE');
    const plain = fixture.worker('worker-plain');
    chmodSync(plain, 0o600);
    expect((await mounted({ captureMode: 'real', captureWorkerPath: plain }).refusal()).reason).toBe('NOT_EXECUTABLE');
  });

  it('real, a usable worker, no signing key yet: refused KEY_ABSENT, and the media root was probed and left empty', async () => {
    const failure = await mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-nokey') }).refusal();
    expect([failure.code, failure.reason]).toEqual([CaptureBootRefusal.SIGNING_KEY_UNUSABLE, 'KEY_ABSENT']);
    expect(readdirSync(fixture.mediaStoreDir)).toEqual([]);
  });

  it('real, everything there: passes in both source classes; then a PROOF build of the same worker is refused at HELLO', async () => {
    fixture.provisionKey();
    for (const [captureDevSources, operation] of [[false, CaptureOperation.REAL_PRODUCTION], [true, CaptureOperation.REAL_DEVELOPMENT]] as const) {
      const app = mounted({ captureMode: 'real', captureDevSources, captureWorkerPath: fixture.worker('worker-good') });
      await app.boot();
      const outcome = app.control.outcome();
      expect(outcome).toMatchObject({ operation, label: null, workerVersion: CAPTURE_WORKER_VERSION });
      expect(outcome?.evidenceVolume?.totalBytes).toBeGreaterThan(1_000_000_000);
      expect(app.recorded.persisted).toEqual([]);
    }
    const proof = mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-proof', 'capture-worker/0.3.0-PROOF') });
    expect((await proof.refusal()).code).toBe(CaptureBootRefusal.WORKER_PROOF_BUILD);
    expect(proof.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: CaptureBootRefusal.WORKER_PROOF_BUILD }]);
    // A program that is no worker at all, and a worker of another protocol version.
    const silent = `${fixture.dataDir}/worker-silent`;
    writeFileSync(silent, '#!/bin/sh\nexit 3\n', { mode: 0o700 });
    expect((await mounted({ captureMode: 'real', captureWorkerPath: silent }).refusal()).code).toBe(CaptureBootRefusal.WORKER_NO_HANDSHAKE);
    expect((await mounted({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-old', 'capture-worker/0.2.0', 2) }).refusal()).code).toBe(CaptureBootRefusal.WORKER_PROTOCOL_MISMATCH);
  });
});

// Integration pass D10, item 3 (pass D6 item 7; register CS-09, second half): the figures the probe
// measured are handed to the engine's `applyStorageVolume` door by ONE statement of the boot step.
describe('CS-09: the measured evidence volume is handed over after the checks passed', () => {
  /** The signing key of the fixture: provisioned by the case above when the whole file runs, here when this block runs alone. */
  const keyThere = (): void => {
    try {
      fixture.provisionKey();
    } catch {
      // KEY_EXISTS: it is there.
    }
  };

  function mountedWithDoor(overrides: Partial<ConfigInput>, door: (volume: { readonly totalBytes: number; readonly freeBytes: number }) => Promise<unknown>) {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const app = { config: unitTestConfig({ dataDir: fixture.dataDir, ...overrides }), stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, applyStorageVolume: door });
    return { control, recorded, boot: (): Promise<void> => app.readiness.boot() };
  }

  it('a real boot hands over exactly what the probe measured, once; a simulated boot hands over nothing', async () => {
    keyThere();
    const handed: Array<{ totalBytes: number; freeBytes: number }> = [];
    const door = async (volume: { readonly totalBytes: number; readonly freeBytes: number }): Promise<void> => void handed.push({ ...volume });
    const real = mountedWithDoor({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-volume') }, door);
    await real.boot();
    const measured = real.control.outcome()?.evidenceVolume;
    expect(measured?.totalBytes).toBeGreaterThan(1_000_000_000);
    expect(handed).toEqual([{ totalBytes: measured?.totalBytes, freeBytes: measured?.freeBytes }]);
    expect(real.recorded.persisted).toEqual([]);

    // CONTROL: in SIMULATED nothing is measured, so the door is never called and the simulator's figures stay.
    const simulated = mountedWithDoor({}, door);
    await simulated.boot();
    expect(simulated.control.outcome()?.evidenceVolume).toBeNull();
    expect(handed).toHaveLength(1);
  });

  it('a hand-over that fails does not refuse the start: the checks passed; it is logged and persisted with a code', async () => {
    keyThere();
    const failing = mountedWithDoor({ captureMode: 'real', captureWorkerPath: fixture.worker('worker-volume-2') }, async () => {
      throw new Error('the engine is not running');
    });
    await failing.boot();
    expect(failing.control.outcome()?.operation).toBe(CaptureOperation.REAL_PRODUCTION);
    expect(failing.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: 'CAPTURE_BOOT_STORAGE_VOLUME_NOT_APPLIED' }]);
    expect(failing.recorded.lines.filter((line) => line.level === 'error')).toHaveLength(1);
  });
});
