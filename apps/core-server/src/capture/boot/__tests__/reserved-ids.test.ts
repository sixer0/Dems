// Task 4 row 228b (review 230 R-4, review 221 C-4; decisions C71, C79, C84). Two things, held together because
// one is the reason of the other:
//
//   1. BOOT CHECK 4b-3 - a REAL_PRODUCTION start is refused by `CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS` when
//      the configured installation id is one of the ONE closed list `ReservedInstallationId`: the ids of the
//      repository's test fixtures and test configuration, of its published demonstration data and of its
//      documentation. As a decision, as mounted, and as static rules over the test support (a fixture takes its
//      id from the list by import; no test support names another installation id).
//   2. FIXTURE HYGIENE - the boot fixture (`realBootFixture`) provisions its key into a TEMPORARY directory of
//      the operating system, mode 0700, and its teardown leaves nothing; no test file and no test support of
//      this workspace hands the repository's data directory to a writer of signing-key material.
//
// EVERY KEY BELOW IS MADE BY THE TEST, in a temporary directory the case removes. No key file is read as text.
// The reserved ids are named here through the list only (a forbidden literal is built from pieces, so that the
// static rules do not find this file).
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { TEST_CAPTURE_HOST, testHostPrograms, testListingStandIns } from '../../../../test/support/capture-host';
import { unitTestConfig } from '../../../../test/support/config';
import { REPOSITORY, WORKSPACE, isTestFile, readTree, stripComments, type SourceFile } from '../../../../test/static/scan';
import { parseInstallationDeviceId } from '../../../config';
import { BootError, createReadiness } from '../../../plugins/readiness';
import { CaptureOperation } from '../../adapters/kinds';
import type { ProgramFacts } from '../../adapters/local';
import { captureOperationDecisionOf } from '../../fence/operation';
import { createSystemTimers } from '../../timers';
import {
  CAPTURE_WORKER_VERSION,
  CaptureBootError,
  CaptureBootRefusal,
  RESERVED_INSTALLATION_ID_REASON,
  ReservedInstallationId,
  isReservedInstallationId,
  runCaptureBootChecks,
  type CaptureBootDeps,
  type EvidenceVolumeFacts,
} from '../checks';
import { InstallationBindingProblem, mountCaptureBootChecks, type CaptureBootMount } from '../index';
import { FIXTURE_DIRECTORY_PREFIX, FIXTURE_INSTALLATION_ID, FIXTURE_NOW, FIXTURE_PROGRAMS_ROOT, realBootFixture, recordedSinks, type RealBootFixture } from './support';

const RESERVED = CaptureBootRefusal.INSTALLATION_ID_RESERVED;
const MISMATCH = CaptureBootRefusal.SIGNING_KEY_INSTALLATION_MISMATCH;
const RESERVED_IDS = Object.values(ReservedInstallationId) as readonly string[];
/** This suite's own installation: a synthetic id, not a reserved one. */
const SUITE_INSTALLATION_ID = 'DEMS-TEST-228B';
/** The folder of the repository no test writes a key into, built from pieces. */
const DATA_FOLDER = ['.', 'data'].join('');

const fixtures: RealBootFixture[] = [];
const fixtureOf = (label: string, installationId?: string): RealBootFixture => {
  const made = installationId === undefined ? realBootFixture(label) : realBootFixture(label, installationId);
  fixtures.push(made);
  return made;
};
afterAll(() => {
  for (const made of fixtures.splice(0)) made.remove();
});

// ── 1a. the decision ──────────────────────────────────────────────────────────────────────────────────────────

const SERVER_UID = 501;
const PROGRAM: ProgramFacts = {
  absolute: true,
  exists: true,
  regularFile: true,
  symbolicLink: false,
  file: { ownerUid: SERVER_UID, mode: 0o755 },
  directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }],
  directoriesResolved: [{ ownerUid: 0, mode: 0o755 }],
  serverUid: SERVER_UID,
};
const VOLUME: EvidenceVolumeFacts = {
  absolute: true,
  present: true,
  directory: true,
  ownerUid: SERVER_UID,
  mode: 0o700,
  serverUid: SERVER_UID,
  exclusiveCreate: true,
  exclusiveRefusesSecond: true,
  synced: true,
  hardLink: true,
  linkRefusesExisting: true,
  cleaned: true,
  totalBytes: 1_000_000_000_000,
  freeBytes: 400_000_000_000,
};

function scene(overrides: Partial<Omit<CaptureBootDeps, 'sinks' | 'decision'>> & { readonly captureDevSources?: boolean; readonly captureMode?: 'real' | 'simulated' } = {}) {
  const calls: string[] = [];
  const recorded = recordedSinks();
  const { captureDevSources = false, captureMode = 'real', ...members } = overrides;
  const deps: CaptureBootDeps = {
    decision: captureOperationDecisionOf({ captureMode, demoControls: false, captureDevSources, host: '127.0.0.1' }),
    workerProgram: '/opt/dems/capture-worker',
    inspect: () => PROGRAM,
    probeEvidenceVolume: () => VOLUME,
    signingKeyProblem: () => null,
    signingKeyIsDevelopment: () => false,
    signingKeyInstallationProblem: () => (calls.push('binding'), null),
    demoPasswordOperators: async () => (calls.push('operators'), 0),
    handshake: async () => (calls.push('handshake'), { outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION }),
    ...members,
    sinks: recorded.sinks,
  };
  const refusal = (): Promise<[string, string | null]> =>
    runCaptureBootChecks(deps).then(
      () => ['NOT REFUSED', null],
      (error: unknown) => {
        if (!(error instanceof CaptureBootError)) throw error;
        return [error.code, error.reason];
      },
    );
  return { deps, calls, recorded, refusal };
}

describe('row 228b, check 4b-3 as a decision: a reserved installation id never starts a production Core', () => {
  it('THE LIST is closed and is exactly the three ids of the tests, the demonstration data and the documentation; each is an id the configuration would take', () => {
    expect(ReservedInstallationId).toEqual({
      TEST_CONFIGURATION: ['DEMS', 'TEST', '01'].join('-'),
      DEMONSTRATION: ['DEMS', 'IR', '01'].join('-'),
      DOCUMENTED_EXAMPLE: ['DEMS', 'JKT', '07'].join('-'),
    });
    for (const id of RESERVED_IDS) {
      // Reserving an id the configuration refuses anyway would hold nothing.
      expect(parseInstallationDeviceId(id), id).toBe(id);
      expect(isReservedInstallationId(id), id).toBe(true);
    }
    for (const free of [SUITE_INSTALLATION_ID, 'DEMS-JKT-08', 'DEMS-TEST-011', 'DEMS-TEST-0', 'dems-test-01', ` ${RESERVED_IDS[0]}`, '', null, undefined]) expect(isReservedInstallationId(free), String(free)).toBe(false);
  });

  it.each(RESERVED_IDS)('REAL_PRODUCTION configured as %s is refused by the named code and a fixed word, after the binding was judged and before any operator is read or any worker is started', async (id) => {
    const refused = scene({ installationId: () => id });
    expect(await refused.refusal()).toEqual([RESERVED, RESERVED_INSTALLATION_ID_REASON]);
    expect(RESERVED).toBe('CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS');
    expect(refused.calls).toEqual(['binding']);
    expect(refused.recorded.lines).toEqual([{ level: 'error', fields: { code: RESERVED, operation: 'REAL_PRODUCTION', reason: RESERVED_INSTALLATION_ID_REASON }, message: 'the capture boot checks refuse this start: the server does not start' }]);
    expect(refused.recorded.persisted).toEqual([{ level: 'error', source: 'capture.boot', code: RESERVED }]);
    // The id is said nowhere: neither the log nor the error log nor the sentence of the refusal holds it.
    const failure = await runCaptureBootChecks(scene({ installationId: () => id }).deps).catch((error: unknown) => error as CaptureBootError);
    expect(JSON.stringify(refused.recorded) + (failure as CaptureBootError).message).not.toContain(id);
  });

  it('CONTROLS: an id of an installation passes; no id passes THIS check (4b-2 is what refuses it); a decision without the member is not asked', async () => {
    for (const installationId of [() => SUITE_INSTALLATION_ID, () => 'DEMS-JKT-08', () => null]) {
      const passing = scene({ installationId });
      expect(await passing.refusal()).toEqual(['NOT REFUSED', null]);
      expect(passing.calls).toEqual(['binding', 'operators', 'handshake']);
    }
    expect(await scene().refusal()).toEqual(['NOT REFUSED', null]);
  });

  it('a key of ANOTHER installation is named first: 4b-2 keeps its place and its code, the reserved id is asked only after it', async () => {
    let asked = 0;
    const other = scene({ signingKeyInstallationProblem: () => InstallationBindingProblem.OTHER_INSTALLATION, installationId: () => ((asked += 1), RESERVED_IDS[0] ?? null) });
    expect(await other.refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
    expect(asked).toBe(0);
  });

  it('REAL_DEVELOPMENT and SIMULATED never ask: a reader that throws is not reached, and a reserved id starts both', async () => {
    const thrower = (): string | null => {
      throw new Error('asked');
    };
    for (const [config, operation] of [[{ captureDevSources: true }, CaptureOperation.REAL_DEVELOPMENT], [{ captureMode: 'simulated' }, CaptureOperation.SIMULATED]] as const) {
      await expect(runCaptureBootChecks(scene({ ...config, installationId: thrower }).deps)).resolves.toMatchObject({ operation });
      await expect(runCaptureBootChecks(scene({ ...config, installationId: () => RESERVED_IDS[0] ?? null }).deps)).resolves.toMatchObject({ operation });
    }
  });
});

// ── 1b. as mounted: the real key store, the real mount, the fixture ───────────────────────────────────────────

describe('row 228b, check 4b-3 as mounted: the fixture\'s default key and the test configuration\'s id do not start a production Core', () => {
  const core = (fixture: RealBootFixture, seams: Partial<CaptureBootMount>, captureDevSources = false) => {
    const recorded = recordedSinks();
    const log = { info() {} } as unknown as Parameters<typeof createReadiness>[0];
    const config = unitTestConfig({ dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, captureMode: 'real', captureDevSources, captureWorkerPath: fixture.worker('worker-row228b'), ...testHostPrograms(fixture.programsDir) });
    const app = { config, stages: {}, readiness: createReadiness(log), clock: { now: () => FIXTURE_NOW + 1_000 } } as unknown as FastifyInstance;
    const control = mountCaptureBootChecks(app, { sinks: recorded.sinks, timers: createSystemTimers(), helloTimeoutMs: 3_000, host: { ...TEST_CAPTURE_HOST, systemListingPrograms: testListingStandIns(fixture.dataDir) }, /* bench-port seam 2026-11-04: the faked darwin host needs the listing pair as stand-ins */ demoPasswordOperators: async () => 0, ...seams });
    const refusal = (): Promise<[string, string | null]> =>
      app.readiness.boot().then(
        () => ['NOT REFUSED', null],
        (error: unknown) => {
          const cause = error instanceof BootError ? error.cause : error;
          if (!(cause instanceof CaptureBootError)) throw error;
          return [cause.code, cause.reason];
        },
      );
    return { control, recorded, refusal, config };
  };

  it('the DEFAULT fixture (its key names the reserved test id) with the id of the test configuration: REAL_PRODUCTION is refused by the reserved code; REAL_DEVELOPMENT boots as before', async () => {
    const fixture = fixtureOf('row228b-default');
    fixture.provisionKey();
    expect([fixture.installationId, FIXTURE_INSTALLATION_ID]).toEqual([ReservedInstallationId.TEST_CONFIGURATION, ReservedInstallationId.TEST_CONFIGURATION]);
    const production = core(fixture, {});
    // What the product does: the unit that holds the identity hands the CONFIGURED id in through the door.
    expect(production.config.installationDeviceId).toBe(ReservedInstallationId.TEST_CONFIGURATION);
    production.control.provideInstallationId(production.config.installationDeviceId);
    expect(await production.refusal()).toEqual([RESERVED, RESERVED_INSTALLATION_ID_REASON]);
    expect(production.control.judgedSigningKey()).toBeNull();
    expect(JSON.stringify(production.recorded)).not.toContain(ReservedInstallationId.TEST_CONFIGURATION);
    const development = core(fixture, { installationId: ReservedInstallationId.TEST_CONFIGURATION }, true);
    expect(await development.refusal()).toEqual(['NOT REFUSED', null]);
    expect(development.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_DEVELOPMENT });
  });

  it.each(RESERVED_IDS)('a key that NAMES %s and a Core configured with it: 4b-2 passes (the key is of that installation) and 4b-3 refuses', async (id) => {
    const fixture = fixtureOf('row228b-named', id);
    fixture.provisionKey();
    expect(await core(fixture, { installationId: id }).refusal()).toEqual([RESERVED, RESERVED_INSTALLATION_ID_REASON]);
  });

  it('a test that states an id of its own and makes its key for it through the fixture boots REAL_PRODUCTION; the same key under a reserved id is a key of another installation', async () => {
    const fixture = fixtureOf('row228b-own', SUITE_INSTALLATION_ID);
    fixture.provisionKey();
    const own = core(fixture, { installationId: SUITE_INSTALLATION_ID });
    expect(await own.refusal()).toEqual(['NOT REFUSED', null]);
    expect(own.control.outcome()).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION, workerVersion: CAPTURE_WORKER_VERSION });
    expect(await core(fixture, { installationId: ReservedInstallationId.TEST_CONFIGURATION }).refusal()).toEqual([MISMATCH, 'OTHER_INSTALLATION']);
  });
});

// ── 2a. the fixture: a temporary directory, removed ───────────────────────────────────────────────────────────

describe('row 228b, the boot fixture: its key lies in a temporary directory of the operating system and its teardown leaves nothing', () => {
  const temporaryRoot = realpathSync(tmpdir());
  const namesOf = (directory: string): string[] => (existsSync(directory) ? readdirSync(directory) : []);

  it('the data directory is a 0700 directory of the temporary root, outside the repository; the key is written below it; the stand-in programs lie apart and hold no key; remove() removes both', () => {
    const fixture = realBootFixture('row228b-hygiene', SUITE_INSTALLATION_ID);
    try {
      expect(fixture.dataDir.startsWith(`${temporaryRoot}/${FIXTURE_DIRECTORY_PREFIX}row228b-hygiene-${process.pid}-`)).toBe(true);
      expect(fixture.dataDir.startsWith(`${REPOSITORY}/`)).toBe(false);
      const facts = lstatSync(fixture.dataDir);
      expect([facts.isDirectory(), facts.isSymbolicLink(), facts.mode & 0o777, facts.uid]).toEqual([true, false, 0o700, process.getuid?.()]);
      fixture.provisionKey();
      // Names only: the store is below the temporary directory. No file of it is opened here.
      expect(namesOf(join(fixture.dataDir, 'signer')).some((name) => name.endsWith('.crt'))).toBe(true);
      const worker = fixture.worker('worker-hygiene');
      expect(worker.startsWith(`${FIXTURE_PROGRAMS_ROOT}/`)).toBe(true);
      expect(FIXTURE_PROGRAMS_ROOT).toBe(resolve(REPOSITORY, '.cache', 'test-row61-programs'));
      expect(namesOf(fixture.programsDir)).toEqual(['worker-hygiene']);
      expect(lstatSync(fixture.programsDir).mode & 0o777).toBe(0o700);
    } finally {
      const { dataDir, programsDir } = fixture;
      fixture.remove();
      expect([existsSync(dataDir), existsSync(programsDir)]).toEqual([false, false]);
      // A second call is harmless.
      fixture.remove();
    }
    // Nothing of the fixture is in the repository's data folder (other sessions of this host may write there meanwhile: names, not a count).
    expect(namesOf(join(REPOSITORY, DATA_FOLDER)).filter((name) => name.includes('row228b-hygiene'))).toEqual([]);
  });

  it('a fixture whose programs were never asked makes no programs directory at all', () => {
    const fixture = realBootFixture('row228b-noprograms');
    const programs = join(FIXTURE_PROGRAMS_ROOT, fixture.dataDir.slice(`${temporaryRoot}/${FIXTURE_DIRECTORY_PREFIX}`.length).replace(/-[^-]+$/, ''));
    expect(existsSync(programs)).toBe(false);
    fixture.remove();
    expect(existsSync(fixture.dataDir)).toBe(false);
  });
});

// ── the static rules ──────────────────────────────────────────────────────────────────────────────────────────

/** Test files and test support of this workspace, comments removed. */
const testSources = (): SourceFile[] =>
  readTree(WORKSPACE)
    .filter((file) => /\.[cm]?ts$/.test(file.path) && isTestFile(file.path))
    .map((file) => ({ path: file.path, text: stripComments(file.text) }));
const isSupport = (path: string): boolean => !/\.test\.[cm]?ts$/.test(path);

/** A quoted text that is, as a whole, an id of the repository's naming (`DEMS-...`). */
const NAMED_ID = /(['"`])(DEMS-[A-Z0-9-]+)\1/g;
/**
 * Quoted texts of that naming in test support that are NOT installation ids, each with its reason. Closed: a new
 * one is added here by name, or it is an installation id and belongs in `ReservedInstallationId`.
 */
const NOT_INSTALLATION_IDS: Readonly<Record<string, string>> = Object.freeze({
  'DEMS-SN-0006A': 'a USB serial number of the audio-card fixtures',
  'DEMS-SN-0006B': 'a USB serial number of the audio-card fixtures',
});

/** `path:line id` of every installation id a test SUPPORT file names that is not a reserved one. */
function unreservedFixtureIds(files: readonly SourceFile[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    if (!isSupport(file.path)) continue;
    for (const match of file.text.matchAll(NAMED_ID)) {
      const id = match[2] ?? '';
      if (isReservedInstallationId(id) || id in NOT_INSTALLATION_IDS) continue;
      found.push(`${file.path}:${file.text.slice(0, match.index).split('\n').length} ${id}`);
    }
  }
  return found;
}

describe('row 228b, static: a fixture id cannot be added without being reserved', () => {
  const files = testSources();

  it('the boot fixture and the test configuration take their installation id FROM THE LIST, by import, and name no id themselves', () => {
    const textOf = (path: string): string => stripComments(readFileSync(join(WORKSPACE, path), 'utf8'));
    const support = textOf('src/capture/boot/__tests__/support.ts');
    expect(support).toMatch(/import \{[^}]*\bReservedInstallationId\b[^}]*\} from '\.\.\/checks';/);
    expect(support).toContain('export const FIXTURE_INSTALLATION_ID = ReservedInstallationId.TEST_CONFIGURATION;');
    expect(support).toContain('export function realBootFixture(label: string, installationId: string = FIXTURE_INSTALLATION_ID): RealBootFixture {');
    const config = textOf('test/support/config.ts');
    expect(config).toMatch(/import \{ ReservedInstallationId \} from '\.\.\/\.\.\/src\/capture\/boot\/checks';/);
    expect(config).toContain('installationDeviceId: ReservedInstallationId.TEST_CONFIGURATION,');
    for (const text of [support, config]) expect([...text.matchAll(NAMED_ID)].map((match) => match[2])).toEqual([]);
  });

  it('NO test support of this workspace names an installation id that is not reserved (a new fixture id is reserved, or the rule is red)', () => {
    expect(files.filter((file) => isSupport(file.path)).length).toBeGreaterThan(40);
    expect(unreservedFixtureIds(files)).toEqual([]);
  });

  it('the published demonstration data and the documented example are in the list: the seed\'s Core, the installer\'s prompt', () => {
    const dataset = readFileSync(join(REPOSITORY, 'packages/shared/src/sim/dataset.ts'), 'utf8');
    expect(/export const DEVICE_ID = '([^']+)';/.exec(dataset)?.[1]).toBe(ReservedInstallationId.DEMONSTRATION);
    // Whatever id the prompt prints as its example must be one no installation can carry (an installer who copies it is refused by name).
    const prompt = /for example ([A-Z][A-Z0-9-]+)/.exec(readFileSync(join(WORKSPACE, 'cli/production-key-command.ts'), 'utf8'))?.[1];
    expect(prompt).toBe(ReservedInstallationId.DOCUMENTED_EXAMPLE);
  });

  it('PLANTED: the rule sees an id of a fixture that is not reserved, in each quote form, and leaves a test file, a reserved id and a serial number alone', () => {
    const planted: SourceFile[] = [
      { path: 'src/x/__tests__/support.ts', text: `export const ID = '${['DEMS', 'TEST', '02'].join('-')}';\nconst other = "${['DEMS', 'LAB', '9'].join('-')}";` },
      { path: 'test/support/other.ts', text: `const id = \`${['DEMS', 'BDG', '01'].join('-')}\`;` },
      { path: 'test/support/fine.ts', text: `const id = '${RESERVED_IDS[0]}'; const serial = 'DEMS-SN-0006A'; const part = 'x DEMS-LAB-9 y';` },
      { path: 'src/x/__tests__/a.test.ts', text: `const INSTALLATION = '${SUITE_INSTALLATION_ID}';` },
    ];
    expect(unreservedFixtureIds(planted)).toEqual(['src/x/__tests__/support.ts:1 DEMS-TEST-02', 'src/x/__tests__/support.ts:2 DEMS-LAB-9', 'test/support/other.ts:1 DEMS-BDG-01']);
  });
});

// ── 2b. static: no test writes key material below the repository's data directory ─────────────────────────────

/** A call that writes signing-key material into a directory handed to it. `.provisionKey(` is the fixture's, held by its own rule below. */
const KEY_WRITERS = ['provisionSigningKey', 'provisionDevelopmentSigningKey', 'activateSigningKey', 'markSigningKeyCompromised', 'runProductionKeyCommand', 'runRotateKeyCommand', 'runMarkCompromisedCommand'];
/** How a test names the repository's data directory: the folder as a path part, the helper's default, and the default of a database run. */
const REPOSITORY_DATA = new RegExp(`(['"\`/])\\${DATA_FOLDER}(['"\`/])|\\bDEFAULT_DATA_DIR\\b|\\brun\\.dataDir\\b`);

/** The text between the parenthesis at `open` and its partner. */
function argumentsAt(text: string, open: number): string {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  return text.slice(open + 1);
}

/**
 * `path:line writer` of every key-writer call whose arguments name the repository's data directory - directly, or
 * through a name: each name in the arguments is followed to its NEAREST declaration above the place it is used at
 * (`const` / `let` of the file), and that declaration's value is read the same way, eight steps deep.
 *
 * A reading of text, with the limits of one: a parameter of a function is not a declaration (the nearest `const`
 * of the same name above it is read instead), and a name before a colon is taken as a property key. What a run
 * really creates is measured by the row's before-and-after count, not by this rule.
 */
function keyWritesBelowRepositoryData(files: readonly SourceFile[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const declarations = [...file.text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*([^;\n]+)/g)].map((match) => ({ name: match[1] ?? '', value: match[2] ?? '', at: match.index ?? 0 }));
    const names = (text: string, usedAt: number, depth: number): boolean => {
      if (REPOSITORY_DATA.test(text)) return true;
      if (depth === 0) return false;
      for (const reference of text.matchAll(/(?<![\w$.'"`])([A-Za-z_$][\w$]*)\b(?!\s*:(?!:))/g)) {
        const declared = declarations.filter((declaration) => declaration.name === reference[1] && declaration.at < usedAt).at(-1);
        if (declared !== undefined && names(declared.value, declared.at, depth - 1)) return true;
      }
      return false;
    };
    for (const writer of KEY_WRITERS) {
      for (const match of file.text.matchAll(new RegExp(`\\b${writer}\\(`, 'g'))) {
        const index = match.index ?? 0;
        // A declaration of the writer is not a call of it.
        if (/\bfunction\s+$/.test(file.text.slice(0, index))) continue;
        if (names(argumentsAt(file.text, index + writer.length), index, 8)) found.push(`${file.path}:${file.text.slice(0, index).split('\n').length} ${writer}`);
      }
    }
  }
  return found;
}

describe('row 228b, static: no test file and no test support writes key material below the repository\'s data directory', () => {
  const files = testSources();

  it('the boot fixture makes its data directory with mkdtemp below the temporary root and names the repository\'s data directory nowhere', () => {
    const support = stripComments(readFileSync(join(WORKSPACE, 'src/capture/boot/__tests__/support.ts'), 'utf8'));
    expect(support).toContain('const dataDir = mkdtempSync(join(realpathSync(tmpdir()), `${FIXTURE_DIRECTORY_PREFIX}${label}-${process.pid}-${serial}-`));');
    expect(support).toContain('dir: `${dataDir}/${SIGNING_STORE_SUBPATH}`,');
    expect(support).toContain("export const FIXTURE_PROGRAMS_ROOT = resolve(REPOSITORY, '.cache', 'test-row61-programs');");
    expect(REPOSITORY_DATA.test(support)).toBe(false);
    // The one key writer of the file writes below `dataDir`; the programs directory is handed to no writer of a key.
    expect([...support.matchAll(/\bprovision\w*SigningKey\(/g)]).toHaveLength(1);
    expect(support).not.toMatch(/provisionSigningKey\(\{[^}]*programs/);
  });

  it('no call of a key writer in a test file or a test support is handed the repository\'s data directory, by its name or through a name made from it', () => {
    const callers = files.filter((file) => KEY_WRITERS.some((writer) => new RegExp(`\\b${writer}\\(`).test(file.text)));
    // The rule read something: the suites of the key commands, of the signer and of the boot are among the callers.
    expect(callers.length).toBeGreaterThan(10);
    expect(keyWritesBelowRepositoryData(files)).toEqual([]);
  });

  it('every test file that makes a boot fixture removes it in a teardown (which runs after a failed case too)', () => {
    const makers = files.filter((file) => !isSupport(file.path) && /\brealBootFixture\(/.test(file.text));
    expect(makers.length).toBeGreaterThan(25);
    const withoutTeardown = makers.filter((file) => !/\b(?:afterAll|afterEach|onTestFinished)\(/.test(file.text) || !/\.remove\(\)/.test(file.text)).map((file) => file.path);
    expect(withoutTeardown).toEqual([]);
  });

  it('PLANTED: the rule sees the data directory handed to a writer directly, through a name, through a name of a name and as the default of a database run; a temporary directory and a read of a helper are left alone', () => {
    // The names of the default data directory, built from pieces so that this file does not hand them to a writer itself.
    const ofRun = ['db', 'run', 'dataDir'].join('.');
    const ofHelper = ['DEFAULT', 'DATA', 'DIR'].join('_');
    const planted: SourceFile[] = [
      { path: 'a.test.ts', text: `provisionSigningKey({ dir: resolve(REPOSITORY, '${DATA_FOLDER}', 'signer'), now });` },
      { path: 'b.test.ts', text: `const root = join(REPOSITORY, '${DATA_FOLDER}/x');\nconst dataDir = \`\${root}/y\`;\nprovisionDevelopmentSigningKey({ dataDir, now: 1 });` },
      { path: 'c.test.ts', text: `await runProductionKeyCommand(['--data-dir', ${ofRun}], ports);\nrunRotateKeyCommand(['--data-dir', ${ofHelper}], ports);` },
      // Left alone: a helper READ below the folder, a key in a temporary directory, the default directory of a simulated boot.
      { path: 'd.test.ts', text: `const HELPER = resolve(REPOSITORY, '${DATA_FOLDER}/helpers/ffmpeg');\nconst dataDir = mkdtempSync(join(tmpdir(), 'x-'));\nprovisionSigningKey({ dir: join(dataDir, 'signer'), now });\nconst simulated = ${ofRun};` },
      // Left alone: the declaration of a writer, the fixture's directory, and a name that is declared from the folder only BELOW its use here.
      { path: 'e.ts', text: `export function provisionSigningKey(options) {}\nconst root = mkdtempSync(join(tmpdir(), 'y-'));\n{ const dataDir = join(root, 'data'); provisionDevelopmentSigningKey({ dataDir: fixture.dataDir, now: Date.now() }); markSigningKeyCompromised({ dir: join(dataDir, 'signer'), at: 1 }); }\nconst dataDir = join(REPOSITORY, '${DATA_FOLDER}');` },
      // Seen again: the same name, used BELOW the declaration that makes it the folder.
      { path: 'f.test.ts', text: `const dataDir = join(REPOSITORY, '${DATA_FOLDER}');\nactivateSigningKey({ dir: \`\${dataDir}/signer\`, keyId, now });` },
    ];
    expect(keyWritesBelowRepositoryData(planted)).toEqual(['a.test.ts:1 provisionSigningKey', 'b.test.ts:3 provisionDevelopmentSigningKey', 'c.test.ts:1 runProductionKeyCommand', 'c.test.ts:2 runRotateKeyCommand', 'f.test.ts:2 activateSigningKey']);
  });
});
