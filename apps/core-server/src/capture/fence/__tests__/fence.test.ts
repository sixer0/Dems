// The capture fence without a database (blueprint row 136; checks M4-SEC-FENCE-1, M4-SEC-HELPER-1,
// M4-LOCAL-SEL-1 registry half, M4-LOCAL-PLAN-1, M4-DEVSRC-* data half). The statements themselves
// run as `dems_app` in `fence.db.test.ts`.
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { REPOSITORY } from '../../../../test/static/scan';
import { assertRecordableSelector, buildCapturePlan, CapturePlanError, CapturePlanReason } from '../../../modules/capture-config';
import { CaptureAdapterError, CaptureOperation, CaptureSourceClass, OPENER_CAPABLE_KINDS, createCaptureDeviceRegistry, sourceClassOf, type CaptureDeviceRegistry, CaptureAdapterRefusal } from '../../adapters';
import { inspectProgram, type HelperDoor, type ProgramFacts } from '../../adapters/local';
import { LIVING_PROGRESS, deviceListText, exitOf, manualTimers, scriptedDoor, trustedInspector } from '../../adapters/local/__tests__/mic-support';
import type { CaptureTimers } from '../../types';
import { CORRECT_GENERATED_SOURCE_PROFILES } from '../fake-profile';
import {
  BOOT_AUDIT_OPERATIONS,
  CaptureFenceError,
  DEVELOPMENT_FENCE_REFUSALS,
  DevelopmentSourceLabel,
  MIC_SOURCE_FACT_KEYS,
  NO_SOURCE_FACTS,
  SOURCE_FACTS_MAX_BYTES,
  assertSessionSourcesOfOperation,
  audioCardStatementOf,
  micSourceFactsOf,
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
  type CaptureFenceOutcome, CaptureDeviceAdmission,
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
    // No built-in is touched: NO statement updates `capture_devices`. Fix wave K, reconcile pass (G89b-01; ruling of 2026-10-11): the
    // ONE update of a development boot is the selector line of a generated source (`fake-profile.ts`), once per boot, on `capture_config` only.
    const updates = tables.statements.filter((text) => /\bUPDATE\b/i.test(text));
    expect(updates).toEqual([CORRECT_GENERATED_SOURCE_PROFILES, CORRECT_GENERATED_SOURCE_PROFILES]);
    expect(CORRECT_GENERATED_SOURCE_PROFILES).toMatch(/^UPDATE public\.capture_config c SET video_01_profile = .*, video_02_profile = .*, revision = c\.revision \+ 1, updated_at = /);
    expect(CORRECT_GENERATED_SOURCE_PROFILES).not.toMatch(/UPDATE public\.capture_devices|SET[^;]*adapter_kind\s*=(?!\s*\$2)|DELETE|INSERT/i);
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

describe('G70b-01: admission to the development registry after the boot (wave I, driver A2)', () => {
  // FIX WAVE I, DRIVER A2 - finding G70b-01 (re-gate 70): the registry of a development Core takes a
  // device that was registered AFTER the boot (`admit`), with the adapter a boot would give its
  // stored row. No database, no process: a helper door that fails the test when it is called -
  // admitting a device opens nothing and lists nothing.

  const soon: CaptureTimers = {
    after(_delayMs, callback) {
      const handle = setImmediate(callback);
      return () => clearImmediate(handle);
    },
  };
  const neverCalled: HelperDoor = (() => {
    throw new Error('admitting a device must start no helper process');
  }) as unknown as HelperDoor;

  const development = () =>
    buildDevelopmentRegistry({ devices: [...SEEDED, ...LOCAL], local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 1_760_000_000_000, timers: soon, door: neverCalled, inspect: trustedInspector() });
  const ADOPTED = { id: 'CAM-04', kind: 'CAMERA', adapterKind: 'FAKE', model: 'FAKE-CAM-1' } as const;

  describe('G70b-01: a camera registered after the boot is admitted to the development registry', () => {
    it('RED BEFORE THE FIX: unknown to the registry until it is admitted; then described, listed, assignable, recordable and probed like a stored test camera', () => {
      const built = development();
      // The state of the finding: the registry was filled at boot only.
      expect(() => built.registry.assertAssignable('CAMERA', 'CAM-04')).toThrow(CaptureAdapterError);
      expect(built.probeAdapters()?.cameras.flatMap((camera) => camera.devices.map((device) => device.id))).not.toContain('CAM-04');

      expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.ADMITTED);
      expect(built.registry.assertAssignable('CAMERA', 'CAM-04')).toMatchObject({ id: 'CAM-04', deviceClass: 'CAMERA', label: 'FAKE-CAM-1', adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT', hasOpener: true });
      expect(built.registry.assertRecordable('CAM-04').hasOpener).toBe(true);
      expect(built.registry.list().map((entry) => entry.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'POE-SWITCH']);
      expect(built.registry.resolve('CAMERA', 'CAM-04').devices.map((device) => device.id)).toEqual(['CAM-04']);
      // The pre-check's reachability probe asks it as well.
      expect(built.probeAdapters()?.cameras.flatMap((camera) => camera.devices.map((device) => device.id))).toContain('CAM-04');
      // The devices of the boot are untouched.
      expect(built.registry.describe('CAM-02')).toMatchObject({ adapterKind: 'FAKE', hasOpener: true });
      expect(built.openSources()).toEqual([]);
    });

    it('a repeat is no error and registers nothing twice; a device of the boot is ALREADY_SERVED', () => {
      const built = development();
      expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.ADMITTED);
      expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.ALREADY_SERVED);
      expect(built.admit({ id: 'CAM-01', kind: 'CAMERA', adapterKind: 'FAKE', model: null })).toBe(CaptureDeviceAdmission.ALREADY_SERVED);
      expect(built.registry.list().filter((entry) => entry.id === 'CAM-04')).toHaveLength(1);
      expect(built.probeAdapters()?.cameras.filter((camera) => camera.devices.some((device) => device.id === 'CAM-04'))).toHaveLength(1);
    });

    it('NEGATIVE CONTROL: a production camera and a second local device get NO adapter - they stay refused, each by name', () => {
      const built = development();
      expect(built.admit({ id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: 'Vendor X' })).toBe(CaptureDeviceAdmission.NOT_SERVED);
      expect(built.admit({ id: 'CAM-12', kind: 'CAMERA', adapterKind: 'LOCAL_DEVICE', model: 'Another camera' })).toBe(CaptureDeviceAdmission.NOT_SERVED);
      for (const id of ['CAM-11', 'CAM-12']) {
        let refusal: unknown = null;
        try {
          built.registry.assertAssignable('CAMERA', id);
        } catch (error) {
          refusal = error;
        }
        expect(refusal).toBeInstanceOf(CaptureAdapterError);
        expect((refusal as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.DEVICE_UNKNOWN);
      }
      expect(built.registry.list().map((entry) => entry.id)).not.toContain('CAM-11');
    });

    it('REAL_PRODUCTION in this phase serves nothing: an adopted camera is NOT_SERVED and no development source appears', () => {
      const built = buildProductionRegistry();
      expect(built.admit(ADOPTED)).toBe(CaptureDeviceAdmission.NOT_SERVED);
      expect(built.admit({ id: 'CAM-11', kind: 'CAMERA', adapterKind: 'ONVIF_RTSP', model: null })).toBe(CaptureDeviceAdmission.NOT_SERVED);
      expect(built.registry.list()).toEqual([]);
    });
  });
});

describe('task 4 row 71: the source facts of a microphone slot (closed keys, every text through the card text rule, bounded; S13-13, AD-07 (1))', () => {
  const CARD = { product: 'Scarlett 18i20 USB', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 3, nativeChannels: 18, sampleRateHz: 48_000, sampleBits: 24 };

  it('a full statement gives exactly the eight keys; no statement gives the one empty map; the result is frozen', () => {
    const facts = micSourceFactsOf(CARD);
    expect(facts).toEqual({ model: 'Scarlett 18i20 USB', usbId: '1235:8215', cardId: 'USB', cardDevice: 0, inputNumber: 3, nativeChannels: 18, sampleRate: 48_000, sampleBits: 24 });
    expect(Object.keys(facts).sort()).toEqual([...MIC_SOURCE_FACT_KEYS].sort());
    expect(Object.isFrozen(facts)).toBe(true);
    for (const nothing of [null, undefined, 'a card', 7] as const) expect(micSourceFactsOf(nothing as never)).toBe(NO_SOURCE_FACTS);
    expect(Object.isFrozen(NO_SOURCE_FACTS)).toBe(true);
  });

  it('a key outside the list is never a fact, whatever the statement carries (no free JSON)', () => {
    const facts = micSourceFactsOf({ ...CARD, password: 'x', username: 'admin', mediaUrl: 'rtsp://camera/1', onvifUuid: 'urn:uuid:1', nested: { a: 1 }, note: 'free' } as never);
    expect(Object.keys(facts).every((key) => (MIC_SOURCE_FACT_KEYS as readonly string[]).includes(key))).toBe(true);
    expect(Object.keys(facts)).toHaveLength(8);
  });

  it.each([
    ['64 characters pass', 'M'.repeat(64), 'M'.repeat(64)],
    ['65 characters: the fixed word, never the first 64 (a text is not cut to fit)', 'M'.repeat(65), 'UNKNOWN'],
    ['beyond a line of a listing', 'M'.repeat(5_000), 'UNKNOWN'],
    ['a control character', 'Mic\u0007', 'UNKNOWN'],
    ['an escape sequence', '\u001b[2JMic', 'UNKNOWN'],
    ['a bidirectional mark', 'Mic‮cod', 'UNKNOWN'],
    ['a zero-width mark', 'Mi​c', 'UNKNOWN'],
    ['a character beyond ASCII', 'Mikrofon ä', 'UNKNOWN'],
    ['a tag', '<b>Mic</b>', 'UNKNOWN'],
    ['empty', '', 'UNKNOWN'],
    ['no string', 42, 'UNKNOWN'],
    ['the spaces at both ends are dropped', '  USB Audio  ', 'USB Audio'],
  ] as const)('the product name - %s', (_name, product, model) => {
    expect(micSourceFactsOf({ ...CARD, product }).model).toBe(model);
  });

  it('the USB id and the card id: the id, the fixed id, or no key; the numbers: inside the bound of their column, or no key', () => {
    expect(micSourceFactsOf({ ...CARD, usbId: null })).not.toHaveProperty('usbId');
    expect(micSourceFactsOf({ ...CARD, usbId: '1235:821G' }).usbId).toBe('0000:0000');
    expect(micSourceFactsOf({ ...CARD, usbId: '1235:8215\n' }).usbId).toBe('0000:0000');
    expect(micSourceFactsOf({ ...CARD, cardId: 'USB_1' }).cardId).toBe('USB_1');
    for (const cardId of ['', 'a b', '../x', 'C'.repeat(33), 5, null]) expect(micSourceFactsOf({ ...CARD, cardId })).not.toHaveProperty('cardId');
    const edges = micSourceFactsOf({ ...CARD, cardDevice: 31, inputNumber: 64, nativeChannels: 64, sampleRateHz: 192_000, sampleBits: 32 });
    expect(edges).toMatchObject({ cardDevice: 31, inputNumber: 64, nativeChannels: 64, sampleRate: 192_000, sampleBits: 32 });
    const beyond = micSourceFactsOf({ ...CARD, cardDevice: 32, inputNumber: 0, nativeChannels: 65, sampleRateHz: 7_999, sampleBits: 20 });
    expect(Object.keys(beyond).sort()).toEqual(['cardId', 'model', 'usbId']);
    const notNumbers = micSourceFactsOf({ ...CARD, cardDevice: '0', inputNumber: 1.5, nativeChannels: Number.NaN, sampleRateHz: Number.POSITIVE_INFINITY, sampleBits: '24' });
    expect(Object.keys(notNumbers).sort()).toEqual(['cardId', 'model', 'usbId']);
  });

  it('the largest map the builder can make is far inside the bound of the column, and every text of it inside 120 characters', () => {
    const largest = micSourceFactsOf({ product: '~'.repeat(64), usbId: 'ffff:ffff', cardId: 'Z'.repeat(32), cardDevice: 31, inputNumber: 64, nativeChannels: 64, sampleRateHz: 192_000, sampleBits: 32 });
    expect(Object.keys(largest)).toHaveLength(8);
    expect(Buffer.byteLength(JSON.stringify(largest), 'utf8')).toBeLessThan(260);
    expect(SOURCE_FACTS_MAX_BYTES).toBe(2_048);
    for (const value of Object.values(largest)) if (typeof value === 'string') expect(value.length).toBeLessThanOrEqual(120);
  });

  it('the statement is read through the adapter member by its name: absent, not a function, or answering nothing is "no statement"; what the member throws is thrown', () => {
    expect(audioCardStatementOf({ sourceFacts: (inputId: string) => (inputId === 'MIC-01' ? CARD : null) }, 'MIC-01')).toBe(CARD);
    expect(audioCardStatementOf({ sourceFacts: () => null }, 'MIC-01')).toBeNull();
    expect(audioCardStatementOf({ sourceFacts: () => 'a card' }, 'MIC-01')).toBeNull();
    for (const adapter of [{}, { sourceFacts: CARD }, null, undefined, 'adapter']) expect(audioCardStatementOf(adapter, 'MIC-01')).toBeNull();
    expect(() => audioCardStatementOf({ sourceFacts: () => { throw new Error('gone'); } }, 'MIC-01')).toThrow('gone');
    // The member is called on its adapter (an adapter written as a class keeps its `this`).
    const adapter = { held: CARD, sourceFacts(): typeof CARD { return this.held; } };
    expect(audioCardStatementOf(adapter, 'MIC-01')).toBe(CARD);
  });
});

// ── Task 4 row 33 (WP-13a): THE 21-STATE TABLE of design addendum 1.5 / 1.7, without a database ──────
// Security addendum 3.1 (the enumeration re-derived; state S-5), requirement AD-10 (4); decisions
// C14, C18, C21 (6), C25. TESTS ONLY: no file of the fence is edited by this row.
//
// A slot of the selector is U (unassigned: NULL in the stored row), D (a development kind: FAKE,
// LOCAL_DEVICE) or P (a production kind: ONVIF_RTSP, USB_AUDIO). Every selector is in exactly one
// of seven categories; three capture operations give 21 states. THE EXPECTED COLUMNS BELOW ARE
// WRITTEN OUT BY HAND, state by state - they are not computed from a rule, so the table cannot
// agree with the code by construction.
//
// Per state, three lines of defence are asked, each ON ITS OWN (the later ones as if the earlier
// had been bypassed):
//   boot   the fence (`runCaptureFenceBoot`) on the double of the two tables: passes, or the code
//          and the registry ids it names; one `SYSTEM_BOOT` row for a real boot that passes, none
//          for a refused one;
//   plan   `assertRecordableSelector` (`modules/capture-config/plan.ts`) against the registry the
//          product builds for the operation;
//   rows   `buildSessionCaptureSources` (`sources.ts`) handed slots that CLAIM an opener behind
//          every assigned device - the builder trusts no caller.
// The session start as an operator meets it (the pre-check, the HTTP answer, the worker, the stored
// rows) is `fence.db.test.ts`, block "task 4 row 33".
//
// THE DOUBLE: `fakeTables` answers the fence's statements as PostgreSQL does; an unassigned slot is
// `null` and yields no row, as the JOIN of `READ_ASSIGNED_SOURCES` does (held on PostgreSQL in the
// database file). `SIMULATED` has no registry in the product (`captureFenceControl.registry()` is
// null and the session start returns before it asks); the empty registry of that operation stands
// in here to show that nothing could be recorded there even if it were asked.
describe('task 4 row 33: the 21-state table - seven selector categories by the three capture operations (addendum 1.5, 1.7; AD-10 (4); C21 (6), C25)', () => {
  type Slot = 'VIDEO-01' | 'VIDEO-02' | 'PRIMARY' | 'STANDBY';
  type Lines = Readonly<Record<Slot, string | null>>;
  type Category = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '2 (S-5)' | '3 (S-5)';
  const SLOT_ORDER: readonly Slot[] = ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'];
  const STORED = [...SEEDED, ...LOCAL, ...PRODUCTION];
  const U = null;
  /** D: CAM-01, CAM-02, MIC-01, MIC-02 (FAKE). P: CAM-11, CAM-12 (ONVIF_RTSP), MIC-11, MIC-12 (USB_AUDIO). */
  const CATEGORY: Readonly<Record<Category, { readonly title: string; readonly lines: Lines }>> = {
    '1': { title: 'all four U', lines: { 'VIDEO-01': U, 'VIDEO-02': U, PRIMARY: U, STANDBY: U } },
    '2': { title: 'some U, the rest D (VIDEO-02 and PRIMARY held)', lines: { 'VIDEO-01': U, 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: U } },
    '3': { title: 'some U, the rest P (VIDEO-01 and a lone STANDBY held)', lines: { 'VIDEO-01': 'CAM-11', 'VIDEO-02': U, PRIMARY: U, STANDBY: 'MIC-12' } },
    '4': { title: 'some U, D and P (STANDBY empty)', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: U } },
    '5': { title: 'four assigned, all D (the seeded selector)', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: 'MIC-02' } },
    '6': { title: 'four assigned, all P', lines: { 'VIDEO-01': 'CAM-11', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: 'MIC-12' } },
    '7': { title: 'four assigned, D and P', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: 'MIC-02' } },
    // State S-5 of the security addendum (AD-10 (4)): three slots assigned, ONLY the STANDBY microphone not. Members of categories 2 and 3.
    '2 (S-5)': { title: 'three D, a lone unassigned STANDBY', lines: { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: U } },
    '3 (S-5)': { title: 'three P, a lone unassigned STANDBY', lines: { 'VIDEO-01': 'CAM-11', 'VIDEO-02': 'CAM-12', PRIMARY: 'MIC-11', STANDBY: U } },
  };

  const SIM = CaptureOperation.SIMULATED;
  const DEV = CaptureOperation.REAL_DEVELOPMENT;
  const PROD = CaptureOperation.REAL_PRODUCTION;
  const CONFIG_OF: Readonly<Record<CaptureOperation, FenceConfig>> = {
    SIMULATED: configOf(),
    REAL_DEVELOPMENT: configOf({ captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER }),
    REAL_PRODUCTION: configOf({ captureMode: 'real', demoControls: false }),
  };

  const BOOTS = 'BOOTS';
  const NO_FLAG = 'DEV_SOURCE_WITHOUT_FLAG';
  const WITH_FLAG = 'DEV_FLAG_WITH_PRODUCTION_SOURCE';
  const SHAPE = CapturePlanReason.SELECTOR_SHAPE;
  const NO_ADAPTER = CapturePlanReason.NO_ADAPTER;
  const RECORDABLE = 'RECORDABLE';
  /** The builder's refusal of anything that is not four slots: `SOURCE_KIND_NOT_RECORDABLE`. */
  const NOT_FOUR = CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE;
  /** The builder refuses; which of its two codes depends on whether a production kind has an opener yet (see `REFUSALS`). */
  const REFUSED = 'REFUSED';
  /** Four rows, all `FAKE`: what `SIMULATED` states whatever stands behind the devices (MR-S3). */
  const FOUR_FAKE = 'FOUR_FAKE';
  /** Four rows of the stored kinds, all of the class named. */
  const FOUR_DEVELOPMENT = 'FOUR_DEVELOPMENT';
  /** THE cell the lift moves: refused while no production kind has an opener, four PRODUCTION rows once both have one. */
  const PRODUCTION_ONCE_LIFTED = 'PRODUCTION_ONCE_LIFTED';
  const REFUSALS: readonly string[] = [CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED];
  const productionOpens = (['ONVIF_RTSP', 'USB_AUDIO'] as const).every((kind) => OPENER_CAPABLE_KINDS.includes(kind));

  interface State {
    readonly category: Category;
    readonly operation: CaptureOperation;
    /** `BOOTS`, or the refusal code of the fence. */
    readonly boot: string;
    /** The registry ids a refused boot names, in id order. */
    readonly named: readonly string[];
    /** `RECORDABLE`, or the reason of the plan builder's refusal, and the device it names. */
    readonly plan: string;
    readonly planDevice: string | null;
    readonly rows: string;
  }
  const state = (category: Category, operation: CaptureOperation, boot: string, named: readonly string[], plan: string, planDevice: string | null, rows: string): State => ({ category, operation, boot, named, plan, planDevice, rows });

  /** THE TABLE: 7 categories x 3 operations = 21 states, in the order of addendum 1.5. */
  const TABLE: readonly State[] = [
    state('1', PROD, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('1', DEV, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('1', SIM, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('2', PROD, NO_FLAG, ['CAM-02', 'MIC-01'], SHAPE, null, NOT_FOUR),
    state('2', DEV, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('2', SIM, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('3', PROD, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('3', DEV, WITH_FLAG, ['CAM-11', 'MIC-12'], SHAPE, null, NOT_FOUR),
    state('3', SIM, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('4', PROD, NO_FLAG, ['CAM-01'], SHAPE, null, NOT_FOUR),
    state('4', DEV, WITH_FLAG, ['CAM-12', 'MIC-11'], SHAPE, null, NOT_FOUR),
    state('4', SIM, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('5', PROD, NO_FLAG, ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'], NO_ADAPTER, 'CAM-01', REFUSED),
    state('5', DEV, BOOTS, [], RECORDABLE, null, FOUR_DEVELOPMENT),
    state('5', SIM, BOOTS, [], NO_ADAPTER, 'CAM-01', FOUR_FAKE),
    state('6', PROD, BOOTS, [], NO_ADAPTER, 'CAM-11', PRODUCTION_ONCE_LIFTED),
    state('6', DEV, WITH_FLAG, ['CAM-11', 'CAM-12', 'MIC-11', 'MIC-12'], NO_ADAPTER, 'CAM-11', REFUSED),
    state('6', SIM, BOOTS, [], NO_ADAPTER, 'CAM-11', FOUR_FAKE),
    state('7', PROD, NO_FLAG, ['CAM-01', 'MIC-02'], NO_ADAPTER, 'CAM-01', REFUSED),
    state('7', DEV, WITH_FLAG, ['CAM-12', 'MIC-11'], NO_ADAPTER, 'CAM-12', REFUSED),
    state('7', SIM, BOOTS, [], NO_ADAPTER, 'CAM-01', FOUR_FAKE),
  ];
  /** State S-5 in each operation: beside the 21, not counted with them. */
  const S5: readonly State[] = [
    state('2 (S-5)', PROD, NO_FLAG, ['CAM-01', 'CAM-02', 'MIC-01'], SHAPE, null, NOT_FOUR),
    state('2 (S-5)', DEV, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('2 (S-5)', SIM, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('3 (S-5)', PROD, BOOTS, [], SHAPE, null, NOT_FOUR),
    state('3 (S-5)', DEV, WITH_FLAG, ['CAM-11', 'CAM-12', 'MIC-11'], SHAPE, null, NOT_FOUR),
    state('3 (S-5)', SIM, BOOTS, [], SHAPE, null, NOT_FOUR),
  ];

  const kindOf = (id: string) => {
    const found = STORED.find((row) => row.id === id);
    if (found === undefined) throw new Error(`the bed holds no device ${id}`);
    return found.adapterKind;
  };
  const assignedOf = (lines: Lines): { readonly slot: Slot; readonly id: string }[] =>
    SLOT_ORDER.flatMap((slot) => {
      const id = lines[slot];
      return id === null ? [] : [{ slot, id }];
    });
  /** The selector as the engine holds it: a line per ASSIGNED slot and none for an empty one (rows 29, 166). */
  const selectorOf = (lines: Lines) => ({
    cameras: assignedOf(lines).filter(({ slot }) => slot === 'VIDEO-01' || slot === 'VIDEO-02').map(({ slot, id }) => ({ trackId: slot as 'VIDEO-01' | 'VIDEO-02', deviceId: id, profile: 'H264_1080P25' })),
    mics: assignedOf(lines).filter(({ slot }) => slot === 'PRIMARY' || slot === 'STANDBY').map(({ slot, id }) => ({ deviceId: id, role: slot as 'PRIMARY' | 'STANDBY' })),
  });
  /** The registry the product builds for an operation (`fence/index.ts`); for `SIMULATED`, where it builds none, the empty registry of that operation. */
  const registryOf = (operation: CaptureOperation): CaptureDeviceRegistry => {
    if (operation === DEV) return buildDevelopmentRegistry({ devices: STORED, local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: HELPER, runDir: '/data/dems/run/capture', now: () => 1_760_000_000_000, timers: soon, door: scriptedDoor(LIST, () => LIVING).door, inspect: trusted }).registry;
    if (operation === PROD) return buildProductionRegistry().registry;
    return createCaptureDeviceRegistry({ operation: SIM });
  };

  interface Observed {
    readonly boot: string;
    readonly named: readonly string[];
    readonly bootAudits: readonly CaptureOperation[];
    readonly statements: number;
    readonly plan: string;
    readonly planDevice: string | null;
    /** The rows the builder made, as `slot device kind class`; empty when it refused. */
    readonly rows: readonly string[];
    readonly rowsRefusal: string | null;
  }

  async function observe(of: State): Promise<Observed> {
    const { lines } = CATEGORY[of.category];
    // 1. The boot.
    const tables = fakeTables(STORED, { video01: lines['VIDEO-01'], video02: lines['VIDEO-02'], primary: lines.PRIMARY, standby: lines.STANDBY });
    const booted = await boot(CONFIG_OF[of.operation], tables);
    if (of.boot === BOOTS) expectBooted(booted, of.operation);
    else expectRefused(booted, of.boot, of.named);
    // 2. The plan builder, against the registry of the operation.
    let plan: string = RECORDABLE;
    let planDevice: string | null = null;
    try {
      assertRecordableSelector(selectorOf(lines), registryOf(of.operation));
    } catch (error) {
      if (!(error instanceof CapturePlanError)) throw error;
      plan = error.reason;
      planDevice = error.deviceId;
    }
    // 3. The builder of the rows, handed slots that claim an opener behind every assigned device.
    let rows: readonly string[] = [];
    let rowsRefusal: string | null = null;
    try {
      rows = buildSessionCaptureSources({
        sessionId: SESSION,
        operation: of.operation,
        slots: assignedOf(lines).map(({ slot, id }) => ({ slot, descriptor: { id, deviceClass: slot === 'VIDEO-01' || slot === 'VIDEO-02' ? ('CAMERA' as const) : ('MIC' as const), adapterKind: kindOf(id), hasOpener: true } })),
        recordedAt: 1,
      }).map((row) => `${row.slot} ${row.deviceId} ${row.adapterKind} ${row.sourceClass}`);
    } catch (error) {
      if (!(error instanceof CaptureAdapterError)) throw error;
      rowsRefusal = error.code;
    }
    return { boot: booted.error?.code ?? BOOTS, named: booted.error?.deviceIds ?? [], bootAudits: tables.bootAudits, statements: tables.statements.length, plan, planDevice, rows, rowsRefusal };
  }

  const classesOf = (rows: readonly string[]): string[] => [...new Set(rows.map((row) => row.split(' ')[3] ?? ''))];
  const kindsOf = (rows: readonly string[]): string[] => [...new Set(rows.map((row) => row.split(' ')[2] ?? ''))];

  function expectState(of: State, seen: Observed): void {
    const label = `${of.category} x ${of.operation}`;
    expect([seen.boot, seen.named], label).toEqual([of.boot, of.named]);
    // SEC35-41 (b): one `SYSTEM_BOOT` row for a real boot that passes; none for a refused boot; none in SIMULATED, which reads no table at all.
    expect(seen.bootAudits, label).toEqual(of.boot === BOOTS && of.operation !== SIM ? [of.operation] : []);
    if (of.operation === SIM) expect(seen.statements, label).toBe(0);
    expect([seen.plan, seen.planDevice], label).toEqual([of.plan, of.planDevice]);
    if (of.rows === NOT_FOUR) expect([seen.rows, seen.rowsRefusal], label).toEqual([[], NOT_FOUR]);
    else if (of.rows === REFUSED) {
      expect(seen.rows, label).toEqual([]);
      expect(REFUSALS, label).toContain(seen.rowsRefusal);
      // TODAY (no production kind has an opener): the refusal is "no opener", before the class is even looked at.
      if (!productionOpens && of.operation === PROD) expect(seen.rowsRefusal, label).toBe(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE);
    } else if (of.rows === FOUR_FAKE) {
      expect(seen.rows, label).toHaveLength(4);
      expect(kindsOf(seen.rows), label).toEqual(['FAKE']);
    } else if (of.rows === FOUR_DEVELOPMENT) {
      expect(seen.rows, label).toEqual(['VIDEO-01 CAM-01 FAKE DEVELOPMENT', 'VIDEO-02 CAM-02 FAKE DEVELOPMENT', 'MIC-PRIMARY MIC-01 FAKE DEVELOPMENT', 'MIC-STANDBY MIC-02 FAKE DEVELOPMENT']);
    } else if (productionOpens) {
      // After the lift: four rows of the stored production kinds.
      expect(seen.rows, label).toEqual(['VIDEO-01 CAM-11 ONVIF_RTSP PRODUCTION', 'VIDEO-02 CAM-12 ONVIF_RTSP PRODUCTION', 'MIC-PRIMARY MIC-11 USB_AUDIO PRODUCTION', 'MIC-STANDBY MIC-12 USB_AUDIO PRODUCTION']);
    } else {
      // TODAY: `REAL_PRODUCTION` is refused outright while no production kind is opener-capable (`sources.ts` `assertOperationRecordable`).
      expect([seen.rows, seen.rowsRefusal], label).toEqual([[], CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE]);
    }
  }

  it('the table is the whole enumeration: 7 categories x 3 operations = 21 states, each once; the bed puts every selector into the category it is listed under', () => {
    expect(TABLE).toHaveLength(21);
    expect(new Set(TABLE.map((of) => `${of.category} ${of.operation}`)).size).toBe(21);
    expect([...new Set(TABLE.map((of) => of.category))]).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    for (const category of ['1', '2', '3', '4', '5', '6', '7'] as const) expect(TABLE.filter((of) => of.category === category).map((of) => of.operation)).toEqual([PROD, DEV, SIM]);
    // The category of a selector, said by the bed from the stored kinds - not by any function under test.
    const shapeOf = (lines: Lines): string => {
      const assigned = assignedOf(lines);
      const classes = new Set(assigned.map(({ id }) => sourceClassOf(kindOf(id))));
      const d = classes.has(CaptureSourceClass.DEVELOPMENT);
      const p = classes.has(CaptureSourceClass.PRODUCTION);
      if (assigned.length === 0) return '1';
      if (assigned.length < 4) return d && p ? '4' : d ? '2' : '3';
      return d && p ? '7' : d ? '5' : '6';
    };
    expect(Object.entries(CATEGORY).map(([name, { lines }]) => [name, shapeOf(lines)])).toEqual([['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['2 (S-5)', '2'], ['3 (S-5)', '3']]);
  });

  it.each(TABLE.map((of) => [`${of.category}. ${CATEGORY[of.category].title}`, of.operation, of.boot === BOOTS ? 'boots' : `boot refused ${of.boot}`, of.plan, of] as const))('%s x %s: %s; the plan builder says %s', async (_category, _operation, _boot, _plan, of) => {
    expectState(of, await observe(of));
  });

  it.each(S5.map((of) => [CATEGORY[of.category].title, of.operation, of] as const))('state S-5 (AD-10 (4)) - %s x %s: `SELECTOR_SHAPE` stays "exactly four", and the builder of the rows writes none', async (_title, _operation, of) => {
    const seen = await observe(of);
    expectState(of, seen);
    expect([seen.plan, seen.rowsRefusal]).toEqual([SHAPE, NOT_FOUR]);
  });

  it('over the 21 states (and S-5): 13 boot and 8 are refused; NO state records a development source in REAL_PRODUCTION or a production source in REAL_DEVELOPMENT, none mixes the classes, none records with a slot unassigned', async () => {
    const all = await Promise.all([...TABLE, ...S5].map(async (of) => ({ of, seen: await observe(of) })));
    const table = all.filter(({ of }) => TABLE.includes(of));
    expect(table).toHaveLength(21);
    expect(table.filter(({ seen }) => seen.boot === BOOTS)).toHaveLength(13);
    expect(table.filter(({ seen }) => seen.boot === NO_FLAG).map(({ of }) => `${of.category} ${of.operation}`)).toEqual(['2 REAL_PRODUCTION', '4 REAL_PRODUCTION', '5 REAL_PRODUCTION', '7 REAL_PRODUCTION']);
    expect(table.filter(({ seen }) => seen.boot === WITH_FLAG).map(({ of }) => `${of.category} ${of.operation}`)).toEqual(['3 REAL_DEVELOPMENT', '4 REAL_DEVELOPMENT', '6 REAL_DEVELOPMENT', '7 REAL_DEVELOPMENT']);
    // SIMULATED boots in all seven categories, reading nothing (every stored kind is inert).
    expect(table.filter(({ of, seen }) => of.operation === SIM && seen.boot === BOOTS)).toHaveLength(7);

    for (const { of, seen } of all) {
      const label = `${of.category} x ${of.operation}`;
      const incomplete = assignedOf(CATEGORY[of.category].lines).length < 4;
      // A SLOT UNASSIGNED: neither line lets it through, in any operation - the STANDBY alone included (C25, S-5).
      if (incomplete) expect([seen.plan, seen.rows, seen.rowsRefusal], label).toEqual([SHAPE, [], NOT_FOUR]);
      // ONE CLASS: whatever rows a state yields are of one class ...
      expect(classesOf(seen.rows).length, label).toBeLessThanOrEqual(1);
      // ... and of the class the operation records: no D row in REAL_PRODUCTION, no P row in REAL_DEVELOPMENT.
      if (of.operation === PROD) expect(classesOf(seen.rows), label).not.toContain(CaptureSourceClass.DEVELOPMENT);
      if (of.operation === DEV) expect(classesOf(seen.rows), label).not.toContain(CaptureSourceClass.PRODUCTION);
      // SIMULATED states the simulator's media only: `FAKE`, whatever is stored (MR-S3) - and no adapter is registered there (rule RG-1).
      if (of.operation === SIM) {
        expect(kindsOf(seen.rows).filter((kind) => kind !== 'FAKE'), label).toEqual([]);
        expect(seen.plan, label).not.toBe(RECORDABLE);
      }
      // A state whose boot is refused would not record even with the boot bypassed: the plan builder refuses it too.
      if (seen.boot !== BOOTS) expect(seen.plan, label).not.toBe(RECORDABLE);
    }
    // THE STATES IN WHICH A REAL SOURCE IS RECORDED: the boot passes AND the plan builder admits AND the rows are written.
    const recording = table.filter(({ of, seen }) => of.operation !== SIM && seen.boot === BOOTS && seen.plan === RECORDABLE && seen.rows.length === 4).map(({ of, seen }) => `${of.category} ${of.operation} ${classesOf(seen.rows).join()}`);
    // Development sources record in exactly one state. Production sources: in none TODAY - state 6 x REAL_PRODUCTION boots and its
    // start is refused, because the production registry serves no device yet (`buildProductionRegistry`: NO adapter) and no production
    // kind is in `OPENER_CAPABLE_KINDS`. It is the one state the lift moves, and the only one that may join this list.
    expect(recording.filter((entry) => entry !== '6 REAL_PRODUCTION PRODUCTION')).toEqual(['5 REAL_DEVELOPMENT DEVELOPMENT']);
    if (!productionOpens) expect(recording).toEqual(['5 REAL_DEVELOPMENT DEVELOPMENT']);
  });

  it('the read-back of the written rows (MR-S6) refuses fewer than four rows in every operation: the third line behind the plan builder and the builder of the rows', () => {
    for (const category of ['1', '2', '3', '4', '2 (S-5)', '3 (S-5)'] as const) {
      const rows = assignedOf(CATEGORY[category].lines).map(({ slot, id }) => ({ slot: ({ 'VIDEO-01': 'VIDEO-01', 'VIDEO-02': 'VIDEO-02', PRIMARY: 'MIC-PRIMARY', STANDBY: 'MIC-STANDBY' } as const)[slot], deviceId: id, adapterKind: kindOf(id) }));
      for (const operation of [PROD, DEV, SIM]) {
        let refusal: unknown = null;
        try {
          assertSessionSourcesOfOperation(rows, operation);
        } catch (error) {
          refusal = error;
        }
        expect(refusal, `${category} x ${operation}`).toBeInstanceOf(CaptureAdapterError);
        expect((refusal as CaptureAdapterError).code, `${category} x ${operation}`).toBe(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE);
      }
    }
  });
});
