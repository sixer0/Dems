// FIX WAVE K, driver S1 - the supported, reversible rig for the blocked seal (decision D220; re-gate
// 75 section 4.6: "NOT PROVEN LIVE, no supported rig is named").
//
// The rig is test support (`test/support/lane-seal-rig.ts`), put in front of the fragment sealer by
// the lane launcher. Proven here:
//   the rule    the switch grammar; OFF does nothing; an armed switch binds to ONE session (written
//               into the switch file) and touches no later one; a session that did not record from
//               generated (FAKE) sources only is NEVER touched; a rigged attempt never reaches the
//               real sealer (no key is made);
//   the fence   REAL_PRODUCTION is refused before anything starts; SIMULATED installs nothing; the
//               sealing host itself refuses a development sealer outside REAL_DEVELOPMENT;
//   the outcome on the REAL pipeline and the REAL way out, on generated recordings:
//               UNSEALABLE -> three attempts, cause SESSION_KEY_NOT_OF_SESSION, quarantine, the
//               session ended once;  BLOCKED -> retried, then the blocked notice with
//               SESSION_KEY_STORE_UNAVAILABLE, nothing moved; RELEASED -> the product's own retry
//               seals the session.
// No key file is planted anywhere: the harness sealer is the product-shaped one of the pipeline
// tests, and the rig throws before it is called.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  LANE_SEAL_RIG_FAILURE,
  LANE_SEAL_RIG_IN_PRODUCTION,
  LaneSealRigError,
  createLaneSealRig,
  fakeSourcesOnly,
  laneSealRigSwitchOf,
  prepareLaneSealRig,
  riggedSealer,
  type LaneSealRigPorts,
} from '../../../test/support/lane-seal-rig';
import { unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { CredentialStoreFailure } from '../../credential-store';
import { SEALING_QUARANTINE_DIR, SEAL_RETRY_DEFAULTS, createSealWayOut, sealBlockedNotice, type SealOutcome, type SealWayOut } from '../../sealing';
import { removePackages } from '../../sealing/__tests__/package-support';
import { harnessOf, recordSession, removeRecordings, type Harness, type Recording } from '../../sealing/__tests__/pipeline-support';
import { DEV_SEAL_RIG_REFUSED_CODE, sealingHost } from '../index';

afterAll(() => {
  removeRecordings();
  removePackages();
});

const FAKE_ROWS = [{ adapter_kind: 'FAKE' }, { adapter_kind: 'FAKE' }, { adapter_kind: 'FAKE' }, { adapter_kind: 'FAKE' }];

/** A switch "file" in memory, the START record of each session, and what the rig said. */
function switchOf(initial: string | null, sources: Record<string, readonly { adapter_kind: string }[]> = {}) {
  const file = { text: initial };
  const said: { level: string; code: string; context: Record<string, string | null> }[] = [];
  let asked = 0;
  const ports: LaneSealRigPorts = {
    read: () => file.text,
    write: (text) => void (file.text = text),
    sources: async (sessionId) => {
      asked += 1;
      return sources[sessionId] ?? FAKE_ROWS;
    },
    report: (level, code, _message, context) => void said.push({ level, code, context }),
  };
  return { file, said, ports, asked: () => asked, rig: createLaneSealRig(ports) };
}

describe('the seal rig: the switch and the rule', () => {
  it('the switch grammar: OFF / empty / no file are off; a mode alone is armed; a mode and a session is bound; anything else is OFF and named unknown', () => {
    expect(laneSealRigSwitchOf('OFF\n')).toEqual({ value: null, unknown: false });
    expect(laneSealRigSwitchOf('  \n')).toEqual({ value: null, unknown: false });
    expect(laneSealRigSwitchOf('UNSEALABLE\n')).toEqual({ value: { mode: 'UNSEALABLE', sessionId: null }, unknown: false });
    expect(laneSealRigSwitchOf('BLOCKED SES-20261011-0003\n')).toEqual({ value: { mode: 'BLOCKED', sessionId: 'SES-20261011-0003' }, unknown: false });
    for (const text of ['blocked', 'ON', 'BLOCKED ../../x', 'BLOCKED SES-1', 'UNSEALABLE SES-20261011-0003 extra']) expect(laneSealRigSwitchOf(text)).toEqual({ value: null, unknown: true });
    expect(LANE_SEAL_RIG_FAILURE).toEqual({ UNSEALABLE: CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION, BLOCKED: CredentialStoreFailure.STORE_UNAVAILABLE });
  });

  it('OFF, no file and an unknown word: the real sealer runs; nothing is asked of the database for OFF', async () => {
    for (const text of [null, 'OFF\n', '']) {
      const rig = switchOf(text);
      expect(await rig.rig.decide('SES-20261011-0001')).toBeNull();
      expect(rig.asked()).toBe(0);
      expect(rig.said).toEqual([]);
    }
    const unknown = switchOf('SOMETHING\n');
    expect(await unknown.rig.decide('SES-20261011-0001')).toBeNull();
    expect(await unknown.rig.decide('SES-20261011-0001')).toBeNull();
    expect(unknown.said.map((line) => line.code)).toEqual(['LANE_SEAL_RIG_SWITCH_UNKNOWN']); // said once
  });

  it('armed -> BOUND to the first session (written into the switch file); the same session keeps failing; a LATER session is not touched', async () => {
    const rig = switchOf('UNSEALABLE\n');
    expect(await rig.rig.decide('SES-20261011-0001')).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
    expect(rig.file.text).toBe('UNSEALABLE SES-20261011-0001\n');
    expect(rig.said).toEqual([{ level: 'warn', code: 'LANE_SEAL_RIG_BOUND', context: { sessionId: 'SES-20261011-0001', mode: 'UNSEALABLE' } }]);
    expect(await rig.rig.decide('SES-20261011-0001')).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
    expect(await rig.rig.decide('SES-20261011-0002')).toBeNull();
    expect(rig.file.text).toBe('UNSEALABLE SES-20261011-0001\n');
    expect(rig.asked()).toBe(1); // the START record is read once per session
    expect(rig.said).toHaveLength(1);
  });

  it('BLOCKED fails with the retriable store failure until the switch is released; the release takes effect at the next call, without a restart', async () => {
    const rig = switchOf('BLOCKED\n');
    expect(await rig.rig.decide('SES-20261011-0001')).toBe(CredentialStoreFailure.STORE_UNAVAILABLE);
    expect(await rig.rig.decide('SES-20261011-0001')).toBe(CredentialStoreFailure.STORE_UNAVAILABLE);
    rig.file.text = 'OFF\n';
    expect(await rig.rig.decide('SES-20261011-0001')).toBeNull();
  });

  it('NEVER a session that is not generated-sources-only: a LOCAL_DEVICE or production source, or no START record, lets the seal through, stays armed and says so once', async () => {
    expect(fakeSourcesOnly(FAKE_ROWS)).toBe(true);
    expect(fakeSourcesOnly([])).toBe(false);
    expect(fakeSourcesOnly([{ adapter_kind: 'FAKE' }, { adapter_kind: 'LOCAL_DEVICE' }])).toBe(false);
    expect(fakeSourcesOnly([{ adapter_kind: 'ONVIF_RTSP' }])).toBe(false);
    for (const rows of [[{ adapter_kind: 'FAKE' }, { adapter_kind: 'LOCAL_DEVICE' }], [{ adapter_kind: 'ONVIF_RTSP' }], []]) {
      const rig = switchOf('UNSEALABLE\n', { 'SES-20261011-0001': rows });
      expect(await rig.rig.decide('SES-20261011-0001')).toBeNull();
      expect(await rig.rig.decide('SES-20261011-0001')).toBeNull();
      expect(rig.file.text).toBe('UNSEALABLE\n'); // not bound: still armed for the next generated-source session
      expect(rig.said.map((line) => line.code)).toEqual(['LANE_SEAL_RIG_NOT_A_FAKE_SESSION']);
      expect(await rig.rig.decide('SES-20261011-0002')).toBe(CredentialStoreFailure.SESSION_KEY_NOT_OF_SESSION);
    }
    // A hand-written binding to such a session is not obeyed either.
    const planted = switchOf('BLOCKED SES-20261011-0001\n', { 'SES-20261011-0001': [{ adapter_kind: 'LOCAL_DEVICE' }] });
    expect(await planted.rig.decide('SES-20261011-0001')).toBeNull();
  });

  it('a rigged attempt never reaches the real sealer (no key is made); an untouched one is the real sealer\'s own answer', async () => {
    const calls: string[] = [];
    const base = { seal: (sessionId: string) => (calls.push(sessionId), { ciphertext: new Uint8Array(1), gcmIv: 'iv', gcmTag: 'tag', keyId: `KID-${sessionId}` }) };
    const rig = switchOf('UNSEALABLE\n');
    const sealer = riggedSealer(base, rig.rig);
    await expect(sealer.seal('SES-20261011-0001', { trackId: 'VIDEO-01', seq: 1, byteOffset: 0 }, new Uint8Array(1))).rejects.toMatchObject({ code: 'CREDENTIAL_SESSION_KEY_NOT_OF_SESSION' });
    expect(calls).toEqual([]);
    await expect(sealer.seal('SES-20261011-0002', { trackId: 'VIDEO-01', seq: 1, byteOffset: 0 }, new Uint8Array(1))).resolves.toMatchObject({ keyId: 'KID-SES-20261011-0002' });
    expect(calls).toEqual(['SES-20261011-0002']);
  });
});

describe('the seal rig: refused outside development capture', () => {
  const appOf = (config: Parameters<typeof unitTestConfig>[0]) => buildApp({ config: unitTestConfig(config), logStream: { write: () => {} } });

  it('REAL_PRODUCTION: the fence throws before anything is started (the launcher ends in the boot\'s final line)', () => {
    const app = appOf({ captureMode: 'real', captureDevSources: false, demoControls: false });
    let thrown: unknown = null;
    try {
      prepareLaneSealRig(app, '/nonexistent/switch');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LaneSealRigError);
    expect((thrown as LaneSealRigError).code).toBe(LANE_SEAL_RIG_IN_PRODUCTION);
    // Even without a switch file path: a production configuration is never started by a launcher that carries the rig.
    expect(() => prepareLaneSealRig(app, null)).toThrow(LaneSealRigError);
  });

  it('SIMULATED: not admitted, nothing is installed; and without a switch file path the rig is inert', () => {
    const simulated = prepareLaneSealRig(appOf({}), '/nonexistent/switch');
    expect(simulated).toMatchObject({ operation: 'SIMULATED', admitted: false });
    const none = prepareLaneSealRig(appOf({ captureMode: 'real', captureDevSources: true, demoControls: false }), null);
    expect(none).toMatchObject({ operation: 'REAL_DEVELOPMENT', admitted: false });
  });

  it('THE SEALING HOST refuses a development sealer outside REAL_DEVELOPMENT, by name, and takes it in development capture', async () => {
    const production = appOf({ captureMode: 'real', captureDevSources: false, demoControls: false });
    await production.ready();
    expect(sealingHost(production).mounted).toBe(true);
    expect(() => sealingHost(production).replace({ developmentSealer: (base) => base })).toThrow(expect.objectContaining({ code: DEV_SEAL_RIG_REFUSED_CODE }) as Error);
    await production.close();

    const development = appOf({ captureMode: 'real', captureDevSources: true, demoControls: false });
    await development.ready();
    expect(() => sealingHost(development).replace({ developmentSealer: (base) => base })).not.toThrow();
    await development.close();
  });
});

// ── The outcome, on the real pipeline and the real way out ──────────────────────────────────────

type Blocked = { readonly sessionId: string; readonly cause: string; readonly step: string; readonly message: string; readonly detail?: string };

function laneOf(recording: Recording, initial: string) {
  const h: Harness = harnessOf(recording);
  const control = switchOf(initial);
  const real = h.ports.sealer;
  let realCalls = 0;
  Object.assign(h.ports, { sealer: riggedSealer({ seal: (...args: Parameters<typeof real.seal>) => ((realCalls += 1), real.seal(...args)) }, control.rig) });
  const outcomes: SealOutcome[] = [];
  const ended: { sessionId: string; cause: string; quarantinedFiles: number }[] = [];
  const blocked: Blocked[] = [];
  const unblocked: string[] = [];
  const running = new Set<Promise<unknown>>();
  const run = async (): Promise<SealOutcome> => {
    const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    outcomes.push(outcome);
    await wayOut.after(outcome);
    return outcome;
  };
  const wayOut: SealWayOut = createSealWayOut({
    settings: () => SEAL_RETRY_DEFAULTS,
    timer: h.clock.timer,
    journal: h.journal,
    now: h.clock.now,
    log: h.log,
    retry: () => {
      const under = run();
      running.add(under);
      void under.finally(() => running.delete(under));
      return under;
    },
    tell: (input) => h.ports.engine.applySealingProgress(input),
    end: async (input) => void ended.push({ ...input }),
    packageDir: h.ports.packageDir,
    stagingDir: h.ports.stagingDir,
    quarantineDir: h.ports.quarantineDir,
    blocked: async (input) => void blocked.push({ ...input }),
    unblocked: async (sessionId) => void unblocked.push(sessionId),
  });
  return {
    h,
    control,
    outcomes,
    ended,
    blocked,
    unblocked,
    wayOut,
    realCalls: () => realCalls,
    run,
    async advance(ms: number) {
      h.clock.advance(ms);
      for (let turn = 0; turn < 50; turn += 1) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (running.size === 0) break;
        await Promise.allSettled(running);
      }
    },
  };
}

describe('the seal rig: the product\'s own way out runs (real pipeline, generated recordings)', () => {
  it('UNSEALABLE: three attempts with the cause SESSION_KEY_NOT_OF_SESSION, then the session ends UNSEALABLE - recordings MOVED to the quarantine, ended once, no blocked alert, the real sealer never called', async () => {
    const recording = recordSession();
    const lane = laneOf(recording, 'UNSEALABLE\n');
    await lane.run();
    expect(lane.outcomes[0]).toMatchObject({ status: 'FAILED', step: 'CLOSE_TRACKS', code: 'SEALER_FAILED', retriable: false, attempt: 1, detail: { cause: 'SESSION_KEY_NOT_OF_SESSION' } });
    expect(lane.control.file.text).toBe(`UNSEALABLE ${recording.sessionId}\n`);
    await lane.advance(5_000);
    await lane.advance(30_000);
    await lane.advance(600_000);
    expect(lane.outcomes.map((outcome) => (outcome as { attempt?: number }).attempt)).toEqual([1, 2, 3]);
    expect(lane.ended).toEqual([{ sessionId: recording.sessionId, cause: 'SESSION_KEY_NOT_OF_SESSION', quarantinedFiles: expect.any(Number) as number }]);
    expect(lane.blocked).toEqual([]);
    expect(lane.realCalls()).toBe(0);
    expect(readdirSync(join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId))).toEqual(expect.arrayContaining(['VIDEO-01.mp4', 'VIDEO-02.mp4']));
    expect(existsSync(lane.h.ports.packageDir(recording.sessionId))).toBe(false);
  });

  it('BLOCKED: retried by the product\'s bounds, then the blocked notice with SESSION_KEY_STORE_UNAVAILABLE - nothing ended, nothing moved; RELEASED: the product\'s own retry seals the session', async () => {
    const recording = recordSession();
    const lane = laneOf(recording, 'BLOCKED\n');
    await lane.run();
    await lane.advance(5_000);
    await lane.advance(30_000);
    await lane.advance(120_000);
    expect(lane.outcomes).toHaveLength(4);
    expect(lane.outcomes[3]).toMatchObject({ status: 'FAILED', code: 'SEALER_FAILED', retriable: true, detail: { cause: 'SESSION_KEY_STORE_UNAVAILABLE' } });
    expect(lane.blocked).toEqual([{ sessionId: recording.sessionId, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', detail: 'SESSION_KEY_STORE_UNAVAILABLE', message: sealBlockedNotice('SEALER_FAILED', { cause: 'SESSION_KEY_STORE_UNAVAILABLE' }) }]);
    expect(lane.ended).toEqual([]);
    expect(existsSync(join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId))).toBe(false);
    expect(lane.realCalls()).toBe(0);
    // Still blocked for as long as the switch is on: a retry on demand fails the same way.
    await lane.run();
    expect(lane.outcomes[4]).toMatchObject({ status: 'FAILED', detail: { cause: 'SESSION_KEY_STORE_UNAVAILABLE' } });

    // RELEASE - the switch file says OFF; the product's retry on demand (what the recovery action and a start run) completes the seal.
    lane.control.file.text = 'OFF\n';
    const sealed = await lane.run();
    expect(sealed).toMatchObject({ status: 'SEALED', sessionId: recording.sessionId });
    expect(lane.realCalls()).toBeGreaterThan(0);
    expect(lane.unblocked).toEqual([recording.sessionId]);
    expect(lane.ended).toEqual([]);
  });

  it('BLOCKED and released BEFORE the retries are used up: the next automatic retry seals, no blocked alert is ever raised', async () => {
    const recording = recordSession();
    const lane = laneOf(recording, 'BLOCKED\n');
    await lane.run();
    expect(lane.outcomes[0]).toMatchObject({ status: 'FAILED', retriable: true });
    lane.control.file.text = 'OFF\n';
    await lane.advance(5_000);
    expect(lane.outcomes.at(-1)).toMatchObject({ status: 'SEALED' });
    expect(lane.blocked).toEqual([]);
  });

  it('CONTROL - switch OFF: the same recording seals at the first attempt', async () => {
    const recording = recordSession();
    const lane = laneOf(recording, 'OFF\n');
    expect(await lane.run()).toMatchObject({ status: 'SEALED', attempt: 1 });
  });
});
