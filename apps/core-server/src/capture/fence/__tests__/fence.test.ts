// The capture fence without a database (blueprint row 136; checks M4-SEC-FENCE-1, M4-SEC-HELPER-1,
// M4-LOCAL-SEL-1 registry half, M4-LOCAL-PLAN-1, M4-DEVSRC-* data half). The statements themselves
// run as `dems_app` in `fence.db.test.ts`.
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { REPOSITORY } from '../../../../test/static/scan';
import { assertRecordableSelector, buildCapturePlan, CapturePlanError } from '../../../modules/capture-config';
import { CaptureAdapterError, CaptureOperation, createCaptureDeviceRegistry, type CaptureDeviceRegistry } from '../../adapters';
import { inspectProgram, type HelperDoor, type ProgramFacts } from '../../adapters/local';
import { LIVING_PROGRESS, deviceListText, exitOf, manualTimers, scriptedDoor, trustedInspector } from '../../adapters/local/__tests__/mic-support';
import type { CaptureTimers } from '../../types';
import {
  BOOT_AUDIT_OPERATIONS,
  CaptureFenceError,
  DEVELOPMENT_FENCE_REFUSALS,
  DevelopmentSourceLabel,
  assertSessionSourcesOfOperation,
  buildDevelopmentRegistry,
  buildProductionRegistry,
  buildSessionCaptureSources,
  captureOperationDecisionOf,
  captureOperationOf,
  developmentSourceLabelOf,
  deviceSourceFieldsOf,
  storedDeviceListingOf,
  helperProgramProblemOf,
  runCaptureFenceBoot,
  type CaptureFenceOutcome,
} from '../index';
import { HELPER, LOCAL, PRODUCTION, PRODUCTION_SELECTOR, SEEDED, SEEDED_SELECTOR, configOf, fakeTables, keptSinks, type FakeTables, type FenceConfig, type KeptSinks } from './support';

const trusted = trustedInspector();
const refusedFacts = (): ProgramFacts => ({ ...trusted(), directoriesAsWritten: [{ ownerUid: 0, mode: 0o775 }] });

interface Booted {
  readonly outcome: CaptureFenceOutcome | null;
  readonly error: CaptureFenceError | null;
  readonly tables: FakeTables;
  readonly sinks: KeptSinks;
}

async function boot(config: FenceConfig, tables: FakeTables, inspect: () => ProgramFacts = trusted, listed = true): Promise<Booted> {
  const sinks = keptSinks();
  try {
    const outcome = await runCaptureFenceBoot({ config, inUnit: tables.inUnit, inspect, labels: { CAMERA: 'MacBook Air Camera', MIC: 'MacBook Air Microphone' }, listed: async () => listed, sinks });
    return { outcome, error: null, tables, sinks };
  } catch (error) {
    if (!(error instanceof CaptureFenceError)) throw error;
    return { outcome: null, error, tables, sinks };
  }
}

/** A refused boot: the code, one error line and one persisted entry with it, no audit row, no registration. */
function expectRefused(booted: Booted, code: string, deviceIds: readonly string[] = []): void {
  expect(booted.outcome).toBeNull();
  expect(booted.error?.code).toBe(code);
  expect(booted.error?.deviceIds).toEqual(deviceIds);
  expect(booted.sinks.lines.filter((line) => line.level === 'error').map((line) => line.fields['code'])).toEqual([code]);
  expect(booted.sinks.persisted.map((entry) => [entry.level, entry.code])).toEqual([['error', code]]);
  expect(booted.tables.bootAudits).toEqual([]);
  expect(booted.tables.devices.filter((row) => row.adapterKind === 'LOCAL_DEVICE' && !LOCAL.some((known) => known.id === row.id))).toEqual([]);
}

function expectBooted(booted: Booted, operation: CaptureOperation): void {
  expect(booted.error).toBeNull();
  expect(booted.outcome?.operation).toBe(operation);
  // SEC35-41 (b): exactly one audit row per boot of a real operation, naming it. A simulated boot writes none until the ruling this row asks for.
  expect(booted.tables.bootAudits).toEqual(operation === 'SIMULATED' ? [] : [operation]);
  expect(booted.sinks.persisted).toEqual([]);
}

describe('the one capture-operation function (spec §A.1.2; G-R15)', () => {
  it('rows 1, 2, 3 and 5: the three operations', () => {
    expect(captureOperationDecisionOf(configOf())).toEqual({ operation: 'SIMULATED', refusal: null, demoControls: true });
    expect(captureOperationDecisionOf(configOf({ demoControls: false }))).toEqual({ operation: 'SIMULATED', refusal: null, demoControls: false });
    expect(captureOperationDecisionOf(configOf({ captureMode: 'real', demoControls: false }))).toEqual({ operation: 'REAL_PRODUCTION', refusal: null, demoControls: false });
    expect(captureOperationDecisionOf(configOf({ captureMode: 'real', demoControls: false, captureDevSources: true }))).toEqual({ operation: 'REAL_DEVELOPMENT', refusal: null, demoControls: false });
  });

  it('rows 4, 6 and 10: a refused combination answers SIMULATED, never a real operation', () => {
    const refused: readonly (readonly [Partial<FenceConfig>, string])[] = [
      [{ captureMode: 'real', demoControls: true }, 'REAL_CAPTURE_WITH_DEMO_CONTROLS'],
      [{ captureMode: 'real', demoControls: true, captureDevSources: true }, 'REAL_CAPTURE_WITH_DEMO_CONTROLS'],
      [{ captureDevSources: true }, 'DEV_SOURCES_NEED_REAL_CAPTURE'],
      [{ demoControls: false, captureDevSources: true }, 'DEV_SOURCES_NEED_REAL_CAPTURE'],
      [{ captureMode: 'real', demoControls: false, captureDevSources: true, host: '0.0.0.0' }, 'DEV_FLAG_WITH_LAN_LISTENER'],
      [{ captureDevSources: true, host: '192.168.1.10' }, 'DEV_FLAG_WITH_LAN_LISTENER'],
    ];
    for (const [patch, code] of refused) {
      expect(captureOperationDecisionOf(configOf(patch)), code).toEqual({ operation: 'SIMULATED', refusal: code, demoControls: false });
      expect(captureOperationOf(configOf(patch))).toBe('SIMULATED');
    }
  });

  it('the flag is on for the literal true alone', () => {
    for (const value of [1, '1', 'true', {}, null, undefined]) {
      expect(captureOperationOf({ ...configOf({ captureMode: 'real', demoControls: false }), captureDevSources: value as unknown as boolean })).toBe('REAL_PRODUCTION');
    }
  });
});

describe('the boot audit row (SEC35-41 (b))', () => {
  it('is written for the two real operations; SIMULATED is not in the list yet (the ruling this row asks for)', () => {
    expect([...BOOT_AUDIT_OPERATIONS]).toEqual(['REAL_PRODUCTION', 'REAL_DEVELOPMENT']);
  });
});

describe('M4-SEC-FENCE-1: every cell of the allowed-combinations table', () => {
  const REAL = { captureMode: 'real', demoControls: false } as const;
  const DEVELOPMENT = { ...REAL, captureDevSources: true, captureHelperFfmpegPath: HELPER } as const;

  it('the five refusals of the development fence are these five codes', () => {
    expect([...DEVELOPMENT_FENCE_REFUSALS].sort()).toEqual(['DEV_FLAG_WITH_LAN_LISTENER', 'DEV_FLAG_WITH_PRODUCTION_SOURCE', 'DEV_HELPER_PROGRAM_UNUSABLE', 'DEV_SOURCES_NEED_REAL_CAPTURE', 'DEV_SOURCE_WITHOUT_FLAG']);
  });

  it('row 1: simulated with demo controls boots SIMULATED, whatever is stored, and reads no registry', async () => {
    for (const [devices, selector] of [[SEEDED, SEEDED_SELECTOR], [[...SEEDED, ...LOCAL], { ...SEEDED_SELECTOR, video01: 'CAM-03', primary: 'MIC-03' }], [[...SEEDED, ...PRODUCTION], PRODUCTION_SELECTOR], [[], null]] as const) {
      const booted = await boot(configOf(), fakeTables(devices, selector));
      expectBooted(booted, 'SIMULATED');
      // Inert: not one statement ran, nothing was registered.
      expect(booted.tables.statements).toEqual([]);
      expect(booted.outcome).toMatchObject({ devices: [], local: null, inserted: [], helperProgram: null });
    }
  });

  it('row 5: simulated without demo controls boots SIMULATED (row 61 decides whether it stays so)', async () => {
    expectBooted(await boot(configOf({ demoControls: false }), fakeTables(SEEDED, SEEDED_SELECTOR)), 'SIMULATED');
  });

  it('row 2: real, no flag, production sources only (or none assigned) boots REAL_PRODUCTION', async () => {
    const assigned = await boot(configOf(REAL), fakeTables([...SEEDED, ...PRODUCTION], PRODUCTION_SELECTOR));
    expectBooted(assigned, 'REAL_PRODUCTION');
    expect(assigned.outcome).toMatchObject({ local: null, inserted: [], helperProgram: null });
    expect(assigned.tables.devices).toHaveLength(9);
    expectBooted(await boot(configOf(REAL), fakeTables(SEEDED, null)), 'REAL_PRODUCTION');
  });

  it('row 3: real with the flag, development sources only, a usable helper boots REAL_DEVELOPMENT and registers the two local devices', async () => {
    const booted = await boot(configOf(DEVELOPMENT), fakeTables(SEEDED, SEEDED_SELECTOR));
    expectBooted(booted, 'REAL_DEVELOPMENT');
    expect(booted.outcome).toMatchObject({ local: { cameraId: 'CAM-03', micId: 'MIC-03' }, inserted: ['CAM-03', 'MIC-03'], helperProgram: HELPER });
    expect(booted.sinks.lines).toEqual([{ level: 'info', fields: { code: 'CAPTURE_FENCE_PASSED', operation: 'REAL_DEVELOPMENT', registered: 'CAM-03,MIC-03', local: 'CAM-03,MIC-03' }, message: 'capture fence passed' }]);
  });

  it('row 4: real with demo controls is refused, with and without the flag', async () => {
    expectRefused(await boot(configOf({ captureMode: 'real', demoControls: true }), fakeTables(SEEDED, SEEDED_SELECTOR)), 'REAL_CAPTURE_WITH_DEMO_CONTROLS');
    expectRefused(await boot(configOf({ ...DEVELOPMENT, demoControls: true }), fakeTables(SEEDED, SEEDED_SELECTOR)), 'REAL_CAPTURE_WITH_DEMO_CONTROLS');
  });

  it('row 6: the flag with capture mode simulated is refused (DEV_SOURCES_NEED_REAL_CAPTURE), before anything is read', async () => {
    for (const demoControls of [true, false]) {
      const booted = await boot(configOf({ demoControls, captureDevSources: true, captureHelperFfmpegPath: HELPER }), fakeTables(SEEDED, SEEDED_SELECTOR));
      expectRefused(booted, 'DEV_SOURCES_NEED_REAL_CAPTURE');
      expect(booted.tables.statements).toEqual([]);
      expect(booted.error?.message).toContain('DEMS_CAPTURE_MODE=real');
    }
  });

  it('row 7: real without the flag and an assigned development source is refused (DEV_SOURCE_WITHOUT_FLAG); the message names the ids and the remedy', async () => {
    const seeded = await boot(configOf(REAL), fakeTables(SEEDED, SEEDED_SELECTOR));
    expectRefused(seeded, 'DEV_SOURCE_WITHOUT_FLAG', ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']);
    expect(seeded.error?.message).toContain('Devices: CAM-01, CAM-02, MIC-01, MIC-02.');
    expect(seeded.error?.message).toContain('start once with DEMS_CAPTURE_DEV_SOURCES=1, unassign them');
    // A stored LOCAL_DEVICE row, assigned, in a production configuration: refused, and named.
    const local = await boot(configOf(REAL), fakeTables([...SEEDED, ...PRODUCTION, ...LOCAL], { ...PRODUCTION_SELECTOR, video01: 'CAM-03' }));
    expectRefused(local, 'DEV_SOURCE_WITHOUT_FLAG', ['CAM-03']);
    // ... registered but NOT assigned: ignored, the Core boots (negative control of the line above).
    expectBooted(await boot(configOf(REAL), fakeTables([...SEEDED, ...PRODUCTION, ...LOCAL], PRODUCTION_SELECTOR)), 'REAL_PRODUCTION');
  });

  it('row 8: the flag with an assigned production source is refused (DEV_FLAG_WITH_PRODUCTION_SOURCE) and registers nothing', async () => {
    const booted = await boot(configOf(DEVELOPMENT), fakeTables([...SEEDED, ...PRODUCTION], { ...SEEDED_SELECTOR, video02: 'CAM-12' }));
    expectRefused(booted, 'DEV_FLAG_WITH_PRODUCTION_SOURCE', ['CAM-12']);
    expect(booted.tables.devices).toHaveLength(9);
    expect(booted.tables.statements.some((text) => text.startsWith('INSERT'))).toBe(false);
  });

  it('row 9: the flag without a usable helper program is refused (DEV_HELPER_PROGRAM_UNUSABLE); the message says what to run and holds no file-system location', async () => {
    const unset = await boot(configOf({ ...DEVELOPMENT, captureHelperFfmpegPath: null }), fakeTables(SEEDED, SEEDED_SELECTOR));
    expectRefused(unset, 'DEV_HELPER_PROGRAM_UNUSABLE');
    expect(unset.error?.helperProblem).toBe('NOT_SET');
    const writable = await boot(configOf(DEVELOPMENT), fakeTables(SEEDED, SEEDED_SELECTOR), refusedFacts);
    expectRefused(writable, 'DEV_HELPER_PROGRAM_UNUSABLE');
    expect(writable.error?.helperProblem).toBe('DIRECTORY_WRITABLE');
    expect(writable.error?.message).toContain('npm run capture:dev-setup');
    expect(writable.error?.message).toContain('Reason: DIRECTORY_WRITABLE.');
    expect(writable.error?.message).not.toContain(HELPER);
    expect(JSON.stringify([writable.sinks.lines, writable.sinks.persisted])).not.toContain(HELPER);
  });

  it('row 10: the flag with a listener outside loopback is refused (DEV_FLAG_WITH_LAN_LISTENER)', async () => {
    expectRefused(await boot(configOf({ ...DEVELOPMENT, host: '0.0.0.0' }), fakeTables(SEEDED, SEEDED_SELECTOR)), 'DEV_FLAG_WITH_LAN_LISTENER');
  });
});

describe('a production configuration cannot be switched into development sources', () => {
  /** A production configuration: capture mode real, no demo controls, no flag, production sources assigned. */
  const base: FenceConfig = configOf({ captureMode: 'real', demoControls: false });
  const keys: Readonly<Record<string, Partial<FenceConfig>>> = {
    DEMS_CAPTURE_MODE: { captureMode: 'simulated' },
    DEMS_DEMO_CONTROLS: { demoControls: true },
    DEMS_CAPTURE_DEV_SOURCES: { captureDevSources: true },
    DEMS_CAPTURE_HELPER_FFMPEG: { captureHelperFfmpegPath: HELPER },
  };
  const names = Object.keys(keys);
  const changes = [...names.map((name) => [name]), ...names.flatMap((first, index) => names.slice(index + 1).map((second) => [first, second]))];
  const production = (): FakeTables => fakeTables([...SEEDED, ...PRODUCTION], PRODUCTION_SELECTOR);

  it.each(changes.map((change) => [change.join(' + '), change] as const))('by %s', async (_label, change) => {
    const config = change.reduce<FenceConfig>((current, name) => ({ ...current, ...keys[name] }), base);
    const booted = await boot(config, production());
    // Either the start is refused, or what boots is not development: nothing registered, no development registry to build.
    if (booted.outcome !== null) {
      expect(booted.outcome.operation).not.toBe('REAL_DEVELOPMENT');
      expect(booted.outcome).toMatchObject({ local: null, inserted: [], helperProgram: null });
    }
    expect(booted.tables.devices.some((row) => row.adapterKind === 'LOCAL_DEVICE')).toBe(false);
    // Where the flags alone name development, it is the stored production source that stops the start (row 8).
    if (captureOperationOf(config) === 'REAL_DEVELOPMENT') expect(booted.error?.code).toBe('DEV_FLAG_WITH_PRODUCTION_SOURCE');
  });

  it('the ten changes end as stated: three boot (none of them development), seven are refused', async () => {
    const results: Record<string, string> = {};
    for (const change of changes) {
      const booted = await boot(change.reduce<FenceConfig>((current, name) => ({ ...current, ...keys[name] }), base), production());
      results[change.join(' + ')] = booted.error?.code ?? `boots ${booted.outcome?.operation ?? ''}`;
    }
    expect(results).toEqual({
      DEMS_CAPTURE_MODE: 'boots SIMULATED',
      DEMS_DEMO_CONTROLS: 'REAL_CAPTURE_WITH_DEMO_CONTROLS',
      DEMS_CAPTURE_DEV_SOURCES: 'DEV_FLAG_WITH_PRODUCTION_SOURCE',
      DEMS_CAPTURE_HELPER_FFMPEG: 'boots REAL_PRODUCTION',
      'DEMS_CAPTURE_MODE + DEMS_DEMO_CONTROLS': 'boots SIMULATED',
      'DEMS_CAPTURE_MODE + DEMS_CAPTURE_DEV_SOURCES': 'DEV_SOURCES_NEED_REAL_CAPTURE',
      'DEMS_CAPTURE_MODE + DEMS_CAPTURE_HELPER_FFMPEG': 'boots SIMULATED',
      'DEMS_DEMO_CONTROLS + DEMS_CAPTURE_DEV_SOURCES': 'REAL_CAPTURE_WITH_DEMO_CONTROLS',
      'DEMS_DEMO_CONTROLS + DEMS_CAPTURE_HELPER_FFMPEG': 'REAL_CAPTURE_WITH_DEMO_CONTROLS',
      'DEMS_CAPTURE_DEV_SOURCES + DEMS_CAPTURE_HELPER_FFMPEG': 'DEV_FLAG_WITH_PRODUCTION_SOURCE',
    });
  });

  it('CONTROL: the same two keys on a database without production sources DO boot development (the check above can fail)', async () => {
    const booted = await boot({ ...base, captureDevSources: true, captureHelperFfmpegPath: HELPER }, fakeTables(SEEDED, SEEDED_SELECTOR));
    expect(booted.outcome?.operation).toBe('REAL_DEVELOPMENT');
    expect(booted.tables.devices.filter((row) => row.adapterKind === 'LOCAL_DEVICE').map((row) => row.id)).toEqual(['CAM-03', 'MIC-03']);
  });
});

describe('registration of the local devices (in memory; the statements run in fence.db.test.ts)', () => {
  const config = configOf({ captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER });

  it('is idempotent across two boots, takes the next free ids, and never touches a built-in', async () => {
    const tables = fakeTables(SEEDED, SEEDED_SELECTOR);
    const first = await boot(config, tables, trusted, false);
    expect(first.outcome?.inserted).toEqual(['CAM-03', 'MIC-03']);
    // `enabled` is what the device list said at the registration: here, not listed.
    expect([...tables.enabled]).toEqual([['CAM-03', false], ['MIC-03', false]]);
    const second = await boot(config, tables);
    expect(second.outcome).toMatchObject({ inserted: [], local: { cameraId: 'CAM-03', micId: 'MIC-03' } });
    expect(tables.devices.map((row) => `${row.id}:${row.adapterKind}`).sort()).toEqual(['CAM-01:FAKE', 'CAM-02:FAKE', 'CAM-03:LOCAL_DEVICE', 'MIC-01:FAKE', 'MIC-02:FAKE', 'MIC-03:LOCAL_DEVICE', 'POE-SWITCH:FAKE']);
    expect(tables.bootAudits).toEqual(['REAL_DEVELOPMENT', 'REAL_DEVELOPMENT']);
    expect(tables.statements.filter((text) => /\bUPDATE\b/i.test(text))).toEqual([]);
  });

  it('skips ids that are taken (an adopted camera holds CAM-03)', async () => {
    const tables = fakeTables([...SEEDED, { id: 'CAM-03', kind: 'CAMERA', adapterKind: 'FAKE', model: null }], SEEDED_SELECTOR);
    expect((await boot(config, tables)).outcome?.local).toEqual({ cameraId: 'CAM-04', micId: 'MIC-03' });
  });
});

describe('M4-SEC-HELPER-1: the helper program rule at boot (strict: no development exception, D108)', () => {
  const facts = (patch: Partial<ProgramFacts>) => (): ProgramFacts => ({ ...trusted(), ...patch });

  it('unset, relative, missing, not a file, foreign owner, writable file, writable or foreign directory, not executable: each refused by name', () => {
    expect(helperProgramProblemOf(null, trusted)).toBe('NOT_SET');
    expect(helperProgramProblemOf('', trusted)).toBe('NOT_SET');
    expect(helperProgramProblemOf('ffmpeg', inspectProgram)).toBe('NOT_ABSOLUTE');
    expect(helperProgramProblemOf('/nonexistent/dems/ffmpeg', inspectProgram)).toBe('NOT_FOUND');
    expect(helperProgramProblemOf(HELPER, facts({ regularFile: false }))).toBe('NOT_A_FILE');
    expect(helperProgramProblemOf(HELPER, facts({ file: { ownerUid: 777, mode: 0o755 } }))).toBe('FILE_OWNER');
    expect(helperProgramProblemOf(HELPER, facts({ file: { ownerUid: 0, mode: 0o775 } }))).toBe('FILE_WRITABLE');
    expect(helperProgramProblemOf(HELPER, facts({ directoriesResolved: [{ ownerUid: 777, mode: 0o755 }] }))).toBe('DIRECTORY_OWNER');
    expect(helperProgramProblemOf(HELPER, facts({ directoriesAsWritten: [{ ownerUid: 0, mode: 0o775 }] }))).toBe('DIRECTORY_WRITABLE');
    expect(helperProgramProblemOf(HELPER, facts({ file: { ownerUid: 0, mode: 0o644 } }))).toBe('NOT_EXECUTABLE');
    expect(helperProgramProblemOf(HELPER, trusted)).toBeNull();
  });

  // The real file system. A copy can pass only below a directory chain nobody else may write: the
  // git-ignored data directory of the repository (the temporary directory of the host is world-writable).
  const dataDir = join(REPOSITORY, '.data');
  const root = existsSync(dataDir) ? mkdtempSync(join(dataDir, 'fence-test-')) : null;
  afterAll(() => {
    if (root !== null) rmSync(root, { recursive: true, force: true });
  });

  it.runIf(root !== null)('on disk: a private copy is accepted; the same copy group-writable, in a group-writable directory, or reached through a link into one is refused', () => {
    const base = root ?? '';
    const privateDir = join(base, 'private');
    const sharedDir = join(base, 'shared');
    mkdirSync(privateDir, { mode: 0o700 });
    mkdirSync(sharedDir, { mode: 0o700 });
    const good = join(privateDir, 'helper');
    copyFileSync('/bin/echo', good);
    chmodSync(good, 0o755);
    expect(helperProgramProblemOf(good, inspectProgram)).toBeNull();

    chmodSync(good, 0o775);
    expect(helperProgramProblemOf(good, inspectProgram)).toBe('FILE_WRITABLE');
    chmodSync(good, 0o644);
    expect(helperProgramProblemOf(good, inspectProgram)).toBe('NOT_EXECUTABLE');
    chmodSync(good, 0o755);

    const shared = join(sharedDir, 'helper');
    copyFileSync('/bin/echo', shared);
    chmodSync(shared, 0o755);
    chmodSync(sharedDir, 0o770);
    expect(helperProgramProblemOf(shared, inspectProgram)).toBe('DIRECTORY_WRITABLE');
    // A link that stands in the private directory and resolves into the group-writable one.
    const link = join(privateDir, 'linked');
    symlinkSync(shared, link);
    expect(helperProgramProblemOf(link, inspectProgram)).toBe('DIRECTORY_WRITABLE');
    // The private copy is still accepted: the refusals above are about the other paths.
    expect(helperProgramProblemOf(good, inspectProgram)).toBeNull();
  });

  const HOMEBREW = '/opt/homebrew/bin/ffmpeg';
  it.runIf(existsSync(HOMEBREW))('on this host: the package manager\'s FFmpeg is refused (DIRECTORY_WRITABLE) and boots nothing', async () => {
    expect(helperProgramProblemOf(HOMEBREW, inspectProgram)).toBe('DIRECTORY_WRITABLE');
    const booted = await boot(configOf({ captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HOMEBREW }), fakeTables(SEEDED, SEEDED_SELECTOR), () => inspectProgram(HOMEBREW));
    expectRefused(booted, 'DEV_HELPER_PROGRAM_UNUSABLE');
  });

  const COPY = join(dataDir, 'helpers', 'ffmpeg');
  it.runIf(existsSync(COPY))('on this host: the copy made by `npm run capture:dev-setup` is accepted', () => {
    expect(helperProgramProblemOf(COPY, inspectProgram)).toBeNull();
  });
});

// ── The registry of the running operation, the plan, the four source rows ─────────────────────────

/** Timers that fire at the next turn: a helper "settles" at once. */
const soon: CaptureTimers = {
  after(_delayMs, callback) {
    const handle = setImmediate(callback);
    return () => clearImmediate(handle);
  },
};
const LIST = deviceListText(['MacBook Air Microphone'], ['MacBook Air Camera', 'MacBook Air Desk View Camera', 'Capture screen 0']);

/**
 * The stand-in of a LIVING helper (integration pass D3): it runs until it is signalled AND reports
 * progress like the real program (`-progress pipe:1`), which is what the no-delivery bound of
 * `camera-helper.ts` waits for. `SILENT` lives but never reports (the bound must then name it).
 */
const LIVING = { lives: true, reports: LIVING_PROGRESS } as const;
const SILENT = { lives: true } as const;

function development(door: HelperDoor = scriptedDoor(LIST, () => LIVING).door) {
  return buildDevelopmentRegistry({ devices: [...SEEDED, ...LOCAL], local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 1_760_000_000_000, timers: soon, door, inspect: trusted });
}
const DEVELOPMENT_SELECTOR = {
  cameras: [{ trackId: 'VIDEO-01' as const, deviceId: 'CAM-03', profile: 'H264_720P30' }, { trackId: 'VIDEO-02' as const, deviceId: 'CAM-02', profile: 'H264_720P30' }],
  mics: [{ deviceId: 'MIC-03', role: 'PRIMARY' as const }, { deviceId: 'MIC-02', role: 'STANDBY' as const }],
};
const SESSION = 'SES-20261009-0001';

describe('M4-LOCAL-SEL-1 (registry half): development sources exist in REAL_DEVELOPMENT only', () => {
  it('REAL_DEVELOPMENT lists the two local devices and the test sources, with kind, class and opener', () => {
    const { registry } = development();
    expect(registry.list().map((entry) => `${entry.id} ${entry.adapterKind} ${entry.sourceClass} ${entry.hasOpener}`)).toEqual([
      'CAM-01 FAKE DEVELOPMENT true',
      'CAM-02 FAKE DEVELOPMENT true',
      'CAM-03 LOCAL_DEVICE DEVELOPMENT true',
      'MIC-01 FAKE DEVELOPMENT true',
      'MIC-02 FAKE DEVELOPMENT true',
      'MIC-03 LOCAL_DEVICE DEVELOPMENT true',
      'POE-SWITCH FAKE DEVELOPMENT false',
    ]);
    expect(registry.openerKinds()).toEqual(['FAKE', 'LOCAL_DEVICE']);
    expect(registry.assertAssignable('CAMERA', 'CAM-03').adapterKind).toBe('LOCAL_DEVICE');
    expect(registry.assertAssignable('MIC', 'MIC-03').adapterKind).toBe('LOCAL_DEVICE');
  });

  it('REAL_PRODUCTION lists 0 development sources and refuses to assign one; a development kind cannot even be registered there', () => {
    const { registry } = buildProductionRegistry();
    expect(registry.list()).toEqual([]);
    for (const [deviceClass, id] of [['CAMERA', 'CAM-03'], ['CAMERA', 'CAM-02'], ['MIC', 'MIC-03']] as const) expect(() => registry.assertAssignable(deviceClass, id)).toThrow(CaptureAdapterError);
    const [localCamera] = development().registry.cameraAdapters().filter((adapter) => adapter.kind === 'LOCAL_DEVICE');
    expect(localCamera).toBeDefined();
    if (localCamera !== undefined) expect(() => registry.register(localCamera)).toThrow('this adapter kind is not registered in the running capture operation');
  });

  it('a stored production device gets no adapter in REAL_DEVELOPMENT: it is not assignable there', () => {
    const built = buildDevelopmentRegistry({ devices: [...SEEDED, ...LOCAL, ...PRODUCTION], local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 0, timers: soon, door: scriptedDoor(LIST, () => LIVING).door, inspect: trusted });
    expect(built.registry.list().map((entry) => entry.id)).not.toContain('CAM-11');
    expect(() => built.registry.assertAssignable('CAMERA', 'CAM-11')).toThrow(CaptureAdapterError);
  });
});

describe('the development test sources (kind FAKE) feed the worker from a generated input; nothing is listed or opened', () => {
  it('the test camera pushes the generated picture to the loopback listener: no device list call, no device name, no avfoundation', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const built = development(scripted.door);
    const handle = await built.registry.resolve('CAMERA', 'CAM-02').openSource('CAM-02', { ingestUrl: 'rtsp://127.0.0.1:8556/live/CAM-02', profile: 'H264_720P30' } as never, new AbortController().signal);
    expect(scripted.calls).toHaveLength(1);
    const [call] = scripted.calls;
    expect(call?.command).toBe(HELPER);
    expect(call?.args).toContain('testsrc2=size=1280x720:rate=30,realtime,settb=1/1000000');
    expect(call?.args).toContain('libx264');
    expect(call?.args.join(' ')).toContain('-b:v 4M -maxrate 4M -bufsize 4M');
    expect(call?.args.join(' ')).not.toMatch(/avfoundation|MacBook|list_devices|Capture screen/);
    expect(call?.env ?? {}).toEqual({});
    await handle.close();
    await built.closeAll();
  });

  it('CONTROL: the local camera reads the device list first and is opened by its exact name', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const built = development(scripted.door);
    const handle = await built.registry.resolve('CAMERA', 'CAM-03').openSource('CAM-03', { ingestUrl: 'rtsp://127.0.0.1:8555/live/CAM-03', profile: 'H264_720P30' } as never, new AbortController().signal);
    expect(scripted.calls.map((call) => call.args.includes('-list_devices'))).toEqual([true, false]);
    expect(scripted.calls[1]?.args).toContain('MacBook Air Camera:none');
    expect(built.openSources()).toEqual(['CAM-03']);
    await handle.close();
    expect(built.openSources()).toEqual([]);
  });

  it('OPPOSITE CASE: a helper that lives but never reports is stopped at the bound and the loss is named OPEN_FAILED / NO_FRAME_WITHIN_8S', async () => {
    // Timers fired by hand, in the order of the clock: the settle time (1.5 s) first, the first-frame bound (8 s) after it.
    const timers = manualTimers();
    const scripted = scriptedDoor(LIST, () => SILENT);
    const lost: Array<[string, string, string]> = [];
    const built = buildDevelopmentRegistry({ devices: [...SEEDED, ...LOCAL], local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 1_760_000_000_000, timers, door: scripted.door, inspect: trusted, onSourceLost: (deviceId, error) => lost.push([deviceId, error.code, error.reason]) });
    const opening = built.registry.resolve('CAMERA', 'CAM-03').openSource('CAM-03', { ingestUrl: 'rtsp://127.0.0.1:8555/live/CAM-03', profile: 'H264_720P30' } as never, new AbortController().signal);
    await vi.waitFor(() => expect(timers.pending()).toEqual(expect.arrayContaining([1_500, 8_000])));
    expect(timers.fire(1_500)).toBe(true);
    await opening;
    expect(built.openSources()).toEqual(['CAM-03']);
    expect(lost).toEqual([]);
    // 8 s after the start: no report came -> killed, reported once, by name.
    expect(timers.fire(8_000)).toBe(true);
    await vi.waitFor(() => expect(lost).toEqual([['CAM-03', 'OPEN_FAILED', 'NO_FRAME_WITHIN_8S']]));
    expect(scripted.ffmpeg[1]?.signals).toEqual(['SIGKILL']);
    expect(built.openSources()).toEqual([]);
  });

  it('CONTROL of the opposite case: the same order of timers with a helper that reports - the bound finds a delivering helper and nothing is lost', async () => {
    const timers = manualTimers();
    const scripted = scriptedDoor(LIST, () => LIVING);
    const lost: string[] = [];
    const built = buildDevelopmentRegistry({ devices: [...SEEDED, ...LOCAL], local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 1_760_000_000_000, timers, door: scripted.door, inspect: trusted, onSourceLost: (deviceId) => lost.push(deviceId) });
    const opening = built.registry.resolve('CAMERA', 'CAM-03').openSource('CAM-03', { ingestUrl: 'rtsp://127.0.0.1:8555/live/CAM-03', profile: 'H264_720P30' } as never, new AbortController().signal);
    await vi.waitFor(() => expect(timers.pending()).toEqual(expect.arrayContaining([1_500, 8_000])));
    timers.fire(1_500);
    const handle = await opening;
    expect(timers.fire(8_000)).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(scripted.ffmpeg[1]?.signals).toEqual([]);
    expect(lost).toEqual([]);
    expect(built.openSources()).toEqual(['CAM-03']);
    await handle.close();
  });

  it('M4-LOCAL-ERR-1: a local camera that is not in the list is DEVICE_NOT_FOUND, 0 helpers started, and no test source takes its slot', async () => {
    const scripted = scriptedDoor(deviceListText([], ['MacBook Air Desk View Camera', 'Capture screen 0']), () => ({ ends: exitOf() }));
    const built = development(scripted.door);
    await expect(built.registry.resolve('CAMERA', 'CAM-03').openSource('CAM-03', { ingestUrl: 'rtsp://127.0.0.1:8555/live/CAM-03', profile: 'H264_720P30' } as never, new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_NOT_FOUND', deviceId: 'CAM-03' });
    expect(scripted.pushes()).toEqual([]);
    // The registry still answers the local device for its id: nothing replaced it.
    expect(built.registry.describe('CAM-03').adapterKind).toBe('LOCAL_DEVICE');
    expect(built.openSources()).toEqual([]);
  });
});

describe('M4-LOCAL-PLAN-1: the development plan and the four session_capture_sources rows', () => {
  const rowsOf = (registry: CaptureDeviceRegistry, selector: typeof DEVELOPMENT_SELECTOR = DEVELOPMENT_SELECTOR) =>
    buildSessionCaptureSources({ sessionId: SESSION, operation: registry.operation, slots: assertRecordableSelector(selector, registry).slots, recordedAt: 1_760_000_000_000 });

  it('camera 1 = this Mac\'s camera, camera 2 = test source, microphone 1 = this Mac\'s microphone, microphone 2 = test source', () => {
    const { registry } = development();
    expect(rowsOf(registry).map((row) => `${row.slot} ${row.deviceId} ${row.adapterKind} ${row.sourceClass}`)).toEqual([
      'VIDEO-01 CAM-03 LOCAL_DEVICE DEVELOPMENT',
      'VIDEO-02 CAM-02 FAKE DEVELOPMENT',
      'MIC-PRIMARY MIC-03 LOCAL_DEVICE DEVELOPMENT',
      'MIC-STANDBY MIC-02 FAKE DEVELOPMENT',
    ]);
    expect(rowsOf(registry).every((row) => row.sessionId === SESSION && row.recordedAt === 1_760_000_000_000)).toBe(true);
    // The plan of row 66 names the same four subjects, by device id.
    const plan = buildCapturePlan({
      selector: DEVELOPMENT_SELECTOR,
      registry,
      cameras: { 'VIDEO-01': { ingestUrl: 'rtsp://127.0.0.1:8555/live/a', outputPath: '/data/dems/media/a.mp4' }, 'VIDEO-02': { ingestUrl: 'rtsp://127.0.0.1:8556/live/b', outputPath: '/data/dems/media/b.mp4' } },
      mics: { 'MIC-03': { kind: 'PCM_FIFO', path: '/data/dems/run/capture/a.pcm' }, 'MIC-02': { kind: 'PCM_FIFO', path: '/data/dems/run/capture/b.pcm' } },
      pcmTapPath: null,
    });
    expect([...plan.cameras.map((camera) => camera.deviceId), ...plan.mics.map((mic) => mic.deviceId)]).toEqual(['CAM-03', 'CAM-02', 'MIC-03', 'MIC-02']);
  });

  it('a mixed production plan is refused: by the plan builder, and by the builder of the rows on its own', () => {
    const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
    // Row 66's check, on a registry that holds no production source: the production camera is not recordable.
    expect(() => assertRecordableSelector({ ...DEVELOPMENT_SELECTOR, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: 'H264_1080P25' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_720P30' }] }, development().registry)).toThrow(CapturePlanError);
    // The builder trusts no caller: handed four slots that mix the classes, it writes no row.
    const slot = (name: 'VIDEO-01' | 'VIDEO-02' | 'PRIMARY' | 'STANDBY', id: string, deviceClass: 'CAMERA' | 'MIC', adapterKind: 'FAKE' | 'LOCAL_DEVICE' | 'ONVIF_RTSP' | 'USB_AUDIO', hasOpener = true) => ({ slot: name, descriptor: { id, deviceClass, adapterKind, hasOpener } });
    const mixed = [slot('VIDEO-01', 'CAM-11', 'CAMERA', 'ONVIF_RTSP'), slot('VIDEO-02', 'CAM-02', 'CAMERA', 'FAKE'), slot('PRIMARY', 'MIC-03', 'MIC', 'LOCAL_DEVICE'), slot('STANDBY', 'MIC-02', 'MIC', 'FAKE')];
    for (const operation of [CaptureOperation.REAL_DEVELOPMENT, CaptureOperation.REAL_PRODUCTION]) {
      expect(() => buildSessionCaptureSources({ sessionId: SESSION, operation, slots: mixed, recordedAt: 1 })).toThrow('no opener exists for this source kind');
    }
    // An all-production set: refused in REAL_PRODUCTION (no opener in this phase, SEC35-40) and in REAL_DEVELOPMENT.
    const production = [slot('VIDEO-01', 'CAM-11', 'CAMERA', 'ONVIF_RTSP'), slot('VIDEO-02', 'CAM-12', 'CAMERA', 'ONVIF_RTSP'), slot('PRIMARY', 'MIC-11', 'MIC', 'USB_AUDIO'), slot('STANDBY', 'MIC-12', 'MIC', 'USB_AUDIO')];
    for (const operation of [CaptureOperation.REAL_DEVELOPMENT, CaptureOperation.REAL_PRODUCTION]) {
      expect(() => buildSessionCaptureSources({ sessionId: SESSION, operation, slots: production, recordedAt: 1 })).toThrow(CaptureAdapterError);
    }
    // A development set in REAL_PRODUCTION, a source that states no opener, three slots, a microphone in a video slot: refused.
    const good = [slot('VIDEO-01', 'CAM-03', 'CAMERA', 'LOCAL_DEVICE'), slot('VIDEO-02', 'CAM-02', 'CAMERA', 'FAKE'), slot('PRIMARY', 'MIC-03', 'MIC', 'LOCAL_DEVICE'), slot('STANDBY', 'MIC-02', 'MIC', 'FAKE')];
    expect(() => buildSessionCaptureSources({ sessionId: SESSION, operation: CaptureOperation.REAL_PRODUCTION, slots: good, recordedAt: 1 })).toThrow(CaptureAdapterError);
    expect(() => buildSessionCaptureSources({ sessionId: SESSION, operation: CaptureOperation.REAL_DEVELOPMENT, slots: [slot('VIDEO-01', 'CAM-03', 'CAMERA', 'LOCAL_DEVICE', false), ...good.slice(1)], recordedAt: 1 })).toThrow(CaptureAdapterError);
    expect(() => buildSessionCaptureSources({ sessionId: SESSION, operation: CaptureOperation.REAL_DEVELOPMENT, slots: good.slice(0, 3), recordedAt: 1 })).toThrow(CaptureAdapterError);
    expect(() => buildSessionCaptureSources({ sessionId: SESSION, operation: CaptureOperation.REAL_DEVELOPMENT, slots: [slot('VIDEO-01', 'MIC-03', 'MIC', 'LOCAL_DEVICE'), ...good.slice(1)], recordedAt: 1 })).toThrow(CaptureAdapterError);
    expect(() => buildSessionCaptureSources({ sessionId: 'SES-1', operation: CaptureOperation.REAL_DEVELOPMENT, slots: good, recordedAt: 1 })).toThrow(CaptureAdapterError);
    // CONTROL: the good set in REAL_DEVELOPMENT is four rows.
    expect(buildSessionCaptureSources({ sessionId: SESSION, operation: CaptureOperation.REAL_DEVELOPMENT, slots: good, recordedAt: 1 })).toHaveLength(4);
    expect(registry.list()).toEqual([]);
  });

  it('MR-S3: in SIMULATED all four rows are FAKE whatever stands behind the devices', () => {
    const slots = [
      { slot: 'VIDEO-01' as const, descriptor: { id: 'CAM-11', deviceClass: 'CAMERA' as const, adapterKind: 'ONVIF_RTSP' as const, hasOpener: false } },
      { slot: 'VIDEO-02' as const, descriptor: { id: 'CAM-03', deviceClass: 'CAMERA' as const, adapterKind: 'LOCAL_DEVICE' as const, hasOpener: false } },
      { slot: 'PRIMARY' as const, descriptor: { id: 'MIC-01', deviceClass: 'MIC' as const, adapterKind: 'FAKE' as const, hasOpener: false } },
      { slot: 'STANDBY' as const, descriptor: { id: 'MIC-12', deviceClass: 'MIC' as const, adapterKind: 'USB_AUDIO' as const, hasOpener: false } },
    ];
    expect(buildSessionCaptureSources({ sessionId: SESSION, operation: CaptureOperation.SIMULATED, slots, recordedAt: 5 }).map((row) => `${row.slot} ${row.deviceId} ${row.adapterKind}`)).toEqual(['VIDEO-01 CAM-11 FAKE', 'VIDEO-02 CAM-03 FAKE', 'MIC-PRIMARY MIC-01 FAKE', 'MIC-STANDBY MIC-12 FAKE']);
  });

  it('MR-S6: the rows read back are held to the running operation', () => {
    const rows = rowsOf(development().registry);
    expect(() => assertSessionSourcesOfOperation(rows, CaptureOperation.REAL_DEVELOPMENT)).not.toThrow();
    // The same rows under a production boot (the flag was taken away between the write and the read): refused.
    expect(() => assertSessionSourcesOfOperation(rows, CaptureOperation.REAL_PRODUCTION)).toThrow('the source class of the device is not the class of the running capture operation');
    expect(() => assertSessionSourcesOfOperation(rows, CaptureOperation.SIMULATED)).toThrow(CaptureAdapterError);
    expect(() => assertSessionSourcesOfOperation(rows.slice(1), CaptureOperation.REAL_DEVELOPMENT)).toThrow(CaptureAdapterError);
    expect(() => assertSessionSourcesOfOperation([...rows.slice(0, 3), { slot: 'MIC-STANDBY', deviceId: 'MIC-12', adapterKind: 'USB_AUDIO' }], CaptureOperation.REAL_DEVELOPMENT)).toThrow('no opener exists for this source kind');
  });
});

describe('what a client is told about a source (C3 §2.6; ruling R-2, D91)', () => {
  it('adapter and source class come from the stored kind; a development device is not listed in REAL_PRODUCTION', () => {
    expect(deviceSourceFieldsOf('REAL_DEVELOPMENT', 'LOCAL_DEVICE')).toEqual({ adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', listed: true });
    expect(deviceSourceFieldsOf('REAL_PRODUCTION', 'LOCAL_DEVICE')).toEqual({ adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', listed: false });
    expect(deviceSourceFieldsOf('REAL_PRODUCTION', 'FAKE').listed).toBe(false);
    expect(deviceSourceFieldsOf('REAL_PRODUCTION', 'ONVIF_RTSP')).toEqual({ adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', listed: true });
    expect(deviceSourceFieldsOf('SIMULATED', 'FAKE')).toEqual({ adapter: 'FAKE', sourceClass: 'DEVELOPMENT', listed: true });
    expect(deviceSourceFieldsOf('SIMULATED', 'LOCAL_DEVICE').listed).toBe(true);
  });

  // Finding R69-03: the rule above had no caller. This is its caller, the reader of the stored registry.
  it('the stored-registry rule: REAL_PRODUCTION lists no camera or microphone of a development kind; REAL_DEVELOPMENT lists them (control); SIMULATED filters nothing', () => {
    const rows = [
      { id: 'CAM-01', kind: 'CAMERA', adapterKind: 'FAKE' },
      { id: 'CAM-03', kind: 'CAMERA', adapterKind: 'LOCAL_DEVICE' },
      { id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP' },
      { id: 'MIC-03', kind: 'MIC', adapterKind: 'LOCAL_DEVICE' },
      { id: 'MIC-11', kind: 'MIC', adapterKind: 'USB_AUDIO' },
      { id: 'POE-SWITCH', kind: 'POE', adapterKind: 'FAKE' },
      { id: 'CAM-99', kind: 'CAMERA', adapterKind: 'NOT_A_KIND' },
    ];
    const listedIn = (operation: Parameters<typeof storedDeviceListingOf>[0]): string[] => {
      const rule = storedDeviceListingOf(operation);
      return rows.filter((row) => rule === null || rule(row)).map((row) => row.id);
    };
    expect(listedIn('REAL_PRODUCTION')).toEqual(['CAM-11', 'MIC-11', 'POE-SWITCH']);
    expect(listedIn('REAL_DEVELOPMENT')).toEqual(rows.map((row) => row.id));
    expect(storedDeviceListingOf('SIMULATED')).toBeNull();
  });

  it('the development label is drawn in real capture only: never in SIMULATED, never in a production configuration', () => {
    expect(developmentSourceLabelOf('REAL_DEVELOPMENT', 'CAMERA', 'LOCAL_DEVICE')).toBe(DevelopmentSourceLabel.LOCAL_CAMERA);
    expect(developmentSourceLabelOf('REAL_DEVELOPMENT', 'MIC', 'LOCAL_DEVICE')).toBe(DevelopmentSourceLabel.LOCAL_MICROPHONE);
    expect(developmentSourceLabelOf('REAL_DEVELOPMENT', 'CAMERA', 'FAKE')).toBe(DevelopmentSourceLabel.TEST_SOURCE);
    expect(developmentSourceLabelOf('REAL_DEVELOPMENT', 'POE', 'FAKE')).toBe(DevelopmentSourceLabel.TEST_SOURCE);
    expect(developmentSourceLabelOf('REAL_DEVELOPMENT', 'CAMERA', 'ONVIF_RTSP')).toBeNull();
    for (const operation of [CaptureOperation.SIMULATED, CaptureOperation.REAL_PRODUCTION]) {
      for (const kind of ['FAKE', 'LOCAL_DEVICE', 'ONVIF_RTSP'] as const) expect(developmentSourceLabelOf(operation, 'CAMERA', kind), `${operation} ${kind}`).toBeNull();
    }
  });
});
