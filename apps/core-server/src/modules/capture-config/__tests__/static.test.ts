// Static rules of the read path of the stored camera credential (task 4 blueprint row 45, WP-06a;
// design addendum 04 section 2.3 steps 1 and 2, section 2.6 "Static"; security check 04, AD-03 (1);
// SEC35-02; migration `0005_capture_privileges.sql`, which names the reveal module's path).
//
//   R-1  THE REVEAL FUNCTION HAS ONE CALLER. No production source outside the migration set names
//        the function, except `credential-reveal.ts` of this folder (the twin of the transcriber's
//        rule, `modules/stt-config/__tests__/static.test.ts` rule 1).
//   R-2  THE REVEAL MODULE HAS ONE IMPORTER, the credential reader beside it, and imports nothing
//        of the server itself.
//   R-3  THE READER'S IMPORTERS ARE A CLOSED LIST (AD-03 (1)): the wiring file that builds the
//        handout, and nothing else; a holder receives its reader as a parameter. The list is EMPTY
//        today: no wiring exists before rows 144, 50 and 85. An entry is a decision, not an edit.
//        It follows that no commissioning file (the set-IP job, decisions C1 and C7) imports it.
//   R-4  NEITHER FILE LOGS, READS A SECRET MEMBER OR MAKES THE INJECTION RESULT; the reader's
//        errors take no cause.
//
// Each rule has a control on a planted source that must be found.
import { describe, expect, it } from 'vitest';
import { relativeImports } from '../../../../test/static/imports';
import { logCalls } from '../../../../test/static/log-calls';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';

const FOLDER = 'src/modules/capture-config/';
/** Built from parts, so that this file is not itself an occurrence. */
const REVEAL_FUNCTION = ['dems', 'capture', 'credential', 'reveal'].join('_');
const REVEAL_MODULE = `${FOLDER}credential-reveal`;
const READER_MODULE = `${FOLDER}credential-reader`;
/** Where the function is defined and described: the migration set, never a caller. */
const DEFINED_IN = 'src/db/migrations/';

/** The production sources that may name the reveal function: ONE file. A second entry is a second reader of the camera credential. */
const CAPTURE_REVEAL_CALLERS: readonly string[] = [`${REVEAL_MODULE}.ts`];
/** The production sources that may import the reveal module: the reader. */
const CAPTURE_REVEAL_IMPORTERS: readonly string[] = [`${READER_MODULE}.ts`];
const HOLDERS_MODULE = `${FOLDER}credential-holders`;
/**
 * The production sources that may import the credential reader (AD-03 (1)): the wiring that builds
 * the handout and takes the two readers (row 144). ONE file; a holder receives its reader as a
 * parameter and never imports this module.
 */
const CAPTURE_CREDENTIAL_READER_IMPORTERS: readonly string[] = [`${HOLDERS_MODULE}.ts`];
/**
 * The production sources that may import the WIRING, i.e. that can obtain a pair of readers
 * (rule R-6). EMPTY today: the production camera adapter is a class-C stub without an opener and
 * no boot path builds the readers. The production composition (row 85) and the stored-credential
 * connection test (row 50) add their file here, each by a decision; never a file of the
 * commissioning set (decisions C1, C7) and never the module index.
 */
const CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS: readonly string[] = [];
/**
 * The production sources that write one of the three reveal reasons as a text (rule R-5): the
 * reader, which binds each to its holder; the audit writer's closed set; the audit fixture. A
 * fourth file would be a caller that says a reason.
 */
const REVEAL_REASON_WRITERS: readonly string[] = ['src/core/audit-details.ts', 'src/db/fixtures/operations.ts', `${READER_MODULE}.ts`];
const REVEAL_REASON_TEXT = /(['"`])(?:SESSION_OPEN|RELAY_RESTART|CONNECTION_TEST)\1/g;

const tree = readTree(WORKSPACE).filter((file) => /\.(?:[cm]?tsx?|sql)$/.test(file.path));
const production = tree.filter((file) => isProductionSource(file.path));
const productionCode = codeOnly(production.filter((file) => !file.path.endsWith('.sql')));
/** Everything that is not a production source (tests, support), without comments: who else imports the two files. */
const otherCode = codeOnly(tree.filter((file) => !isProductionSource(file.path) && !file.path.endsWith('.sql')));
const files = (places: readonly string[]): string[] => [...new Set(places.map((place) => place.replace(/:\d+$/, '')))];

const callersOf = (code: readonly SourceFile[]): string[] => files(occurrences(code, new RegExp(REVEAL_FUNCTION, 'g')).filter((place) => !place.startsWith(DEFINED_IN)));
const importersOf = (sources: readonly SourceFile[], target: string): string[] => files(relativeImports(sources).filter((entry) => entry.target === target).map((entry) => `${entry.file}:${entry.line}`));

/** A read of a secret member after any expression (rule A-2 of the adapter layer, its secret half). */
const SECRET_MEMBER = /\.\s*secret\b/g;
const INJECTION_CALL = /\bcredentialAtInjection\s*\(/g;
const ERROR_CAUSE = /\bcause\s*:/g;
const CONSOLE = /\bconsole\s*\./g;

describe('the scan itself', () => {
  it('reads the production sources of the folder, the two files of the read path among them, and the migration that defines the function', () => {
    const folder = production.filter((file) => file.path.startsWith(FOLDER));
    expect(scanCoverage(folder, [FOLDER])).toEqual(SCAN_COVERS);
    for (const path of [`${REVEAL_MODULE}.ts`, `${READER_MODULE}.ts`]) expect(folder.some((file) => file.path === path && file.text.length > 500), path).toBe(true);
    expect(production.filter((file) => file.text.includes(REVEAL_FUNCTION)).map((file) => file.path)).toContain('src/db/migrations/0005_capture_privileges.sql');
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const UP = '..';
    const planted: SourceFile[] = [
      { path: 'src/capture/adapters/camera/relay-start.ts', text: `const rows = await pool.query('SELECT * FROM public.${REVEAL_FUNCTION}($1)', [id]);\n` },
      { path: 'src/modules/capture-discovery/set-network.ts', text: `import { revealCaptureCredential } from '${UP}/capture-config/credential-reveal';\nimport { createCaptureCredentialReaders } from '${UP}/capture-config/credential-reader';\n` },
      { path: `${FOLDER}index.ts`, text: "export { createCaptureCredentialReaders } from './credential-reader';\n" },
      { path: `${READER_MODULE}.ts`, text: "import { revealCaptureCredential } from './credential-reveal';\nlog.info({ secret: opened.secret });\nconsole.log(x);\nthrow new Error('x', { cause: error });\nreturn credentialAtInjection(locator, sealed);\n" },
      // A sentence in a comment is not a call.
      { path: 'src/db/schema/capture.ts', text: `// read only through ${REVEAL_FUNCTION}\nexport const x = 1;\n` },
    ];
    const code = codeOnly(planted);
    expect(callersOf(code)).toEqual(['src/capture/adapters/camera/relay-start.ts']);
    expect(importersOf(code, REVEAL_MODULE)).toEqual(['src/modules/capture-discovery/set-network.ts', `${READER_MODULE}.ts`]);
    expect(importersOf(code, READER_MODULE)).toEqual(['src/modules/capture-discovery/set-network.ts', `${FOLDER}index.ts`]);
    const reader = code.filter((file) => file.path === `${READER_MODULE}.ts`);
    expect(occurrences(reader, SECRET_MEMBER)).toEqual([`${READER_MODULE}.ts:2`]);
    expect(occurrences(reader, CONSOLE)).toEqual([`${READER_MODULE}.ts:3`]);
    expect(occurrences(reader, ERROR_CAUSE)).toEqual([`${READER_MODULE}.ts:4`]);
    expect(occurrences(reader, INJECTION_CALL)).toEqual([`${READER_MODULE}.ts:5`]);
    expect(reader.flatMap((file) => logCalls(file.text))).toHaveLength(1);
  });
});

describe('R-1: the reveal function has one caller', () => {
  it('no production source outside the migration set names the function, except the reveal module', () => {
    // Code only: a sentence in a comment that names the function is not a call of it. A call sits
    // in a statement text, and string literals are kept by the scanner.
    const callers = callersOf(productionCode);
    console.info(`[row45] reveal-function callers outside ${DEFINED_IN}: ${callers.length === 0 ? '(none)' : callers.join(', ')} | allowed: ${CAPTURE_REVEAL_CALLERS.join(', ')}`);
    expect(callers).toEqual([...CAPTURE_REVEAL_CALLERS]);
    expect(CAPTURE_REVEAL_CALLERS).toHaveLength(1);
    // The path is the one the migration names as the single call site.
    const migration = production.find((file) => file.path === 'src/db/migrations/0005_capture_privileges.sql')?.text ?? '';
    expect(migration).toContain(`apps/core-server/${REVEAL_MODULE}.ts`);
  });

  it('the function is named once in that file: one statement, with a bind parameter', () => {
    const module = productionCode.filter((file) => file.path === `${REVEAL_MODULE}.ts`);
    expect(occurrences(module, new RegExp(REVEAL_FUNCTION, 'g'))).toHaveLength(1);
    expect(occurrences(module, new RegExp(`${REVEAL_FUNCTION}\\(\\$1\\)`, 'g'))).toHaveLength(1);
    // No value is ever part of a statement text (SR-67): no template with an interpolation in the file.
    expect(occurrences(module, /\$\{/g)).toEqual([]);
  });
});

describe('R-2: the reveal module has one importer and imports nothing of the server', () => {
  it('only the credential reader imports it; outside production only the tests of this folder', () => {
    expect(importersOf(productionCode, REVEAL_MODULE)).toEqual([...CAPTURE_REVEAL_IMPORTERS]);
    expect(importersOf(otherCode, REVEAL_MODULE).filter((path) => !path.startsWith(`${FOLDER}__tests__/`))).toEqual([]);
  });

  it('its one import is a type of the driver', () => {
    const module = productionCode.find((file) => file.path === `${REVEAL_MODULE}.ts`)?.text ?? '';
    expect([...module.matchAll(/^import\s+(type\s+)?[^;]*from\s+'([^']+)';/gm)].map((match) => [match[1]?.trim(), match[2]])).toEqual([['type', 'pg']]);
  });
});

describe('R-3: the importers of the credential reader are a closed list (AD-03 (1))', () => {
  it('the production importers equal the list; the module index does not hand the reader on', () => {
    const importers = importersOf(productionCode, READER_MODULE);
    console.info(`[row144] credential-reader importers: ${importers.length === 0 ? '(none)' : importers.join(', ')} | allowed: ${CAPTURE_CREDENTIAL_READER_IMPORTERS.join(', ')}`);
    expect(importers).toEqual([...CAPTURE_CREDENTIAL_READER_IMPORTERS]);
    expect(CAPTURE_CREDENTIAL_READER_IMPORTERS).not.toContain(`${FOLDER}index.ts`);
    // The wiring is one file per app; the two holders are handed their reader, they do not import it.
    expect(CAPTURE_CREDENTIAL_READER_IMPORTERS.length).toBeLessThanOrEqual(1);
    expect(CAPTURE_CREDENTIAL_READER_IMPORTERS.filter((path) => path.startsWith('src/capture/adapters/'))).toEqual([]);
  });

  it('outside production only the tests of this folder import it', () => {
    expect(importersOf(otherCode, READER_MODULE).filter((path) => !path.startsWith(`${FOLDER}__tests__/`))).toEqual([]);
  });
});

describe('R-5, R-6: the holders (AD-03 (1), row 144)', () => {
  const holders = productionCode.filter((file) => file.path === `${HOLDERS_MODULE}.ts`);

  it('finds a caller that says a reason, a second importer of the wiring and a third `take` when they are present (positive control)', () => {
    const UP = '..';
    const planted = codeOnly([
      { path: 'src/capture/adapters/camera/relay-start.ts', text: "const credential = await reader.read(deviceId, 'SESSION_OPEN');\n// 'RELAY_RESTART' in a comment is not a caller\n" },
      { path: 'src/modules/capture-discovery/set-network.ts', text: `import { wireCaptureCredentialHolders } from '${UP}/capture-config/credential-holders';\n` },
      { path: `${HOLDERS_MODULE}.ts`, text: 'handout.take(A);\nhandout.take(B);\nhandout.take(C);\n' },
    ]);
    expect(files(occurrences(planted, REVEAL_REASON_TEXT))).toEqual(['src/capture/adapters/camera/relay-start.ts']);
    expect(importersOf(planted, HOLDERS_MODULE)).toEqual(['src/modules/capture-discovery/set-network.ts']);
    expect(occurrences(planted, /\.take\s*\(/g)).toHaveLength(3);
  });

  it('R-5: no holder passes a reason - the three reasons are written as a text by the reader, the audit writer and its fixture only', () => {
    const writers = files(occurrences(productionCode, REVEAL_REASON_TEXT)).sort();
    console.info(`[row144] files that write a reveal reason: ${writers.join(', ')}`);
    expect(writers).toEqual([...REVEAL_REASON_WRITERS].sort());
    // The wiring names holders, never a reason.
    expect(occurrences(holders, REVEAL_REASON_TEXT)).toEqual([]);
  });

  it('R-6: the wiring is the one file that takes a reader, twice; no production source imports it today, and the module index does not hand it on', () => {
    expect(holders).toHaveLength(1);
    expect(occurrences(productionCode, /\.take\s*\(\s*CaptureCredentialHolder\./g).map((place) => place.replace(/:\d+$/, ''))).toEqual([`${HOLDERS_MODULE}.ts`, `${HOLDERS_MODULE}.ts`]);
    expect(occurrences(holders, /\bcreateCaptureCredentialReaders\s*\(/g)).toHaveLength(1);
    const importers = importersOf(productionCode, HOLDERS_MODULE);
    console.info(`[row144] credential-holders importers: ${importers.length === 0 ? '(none: no boot path builds the readers)' : importers.join(', ')} | allowed: ${CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS.join(', ') || '(none yet: rows 85, 50)'}`);
    expect(importers).toEqual([...CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS]);
    expect(CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS).not.toContain(`${FOLDER}index.ts`);
    expect(importersOf(otherCode, HOLDERS_MODULE).filter((path) => !path.startsWith(`${FOLDER}__tests__/`))).toEqual([]);
    // Its one import is the reader; it logs nothing, reads no secret member and names one statement with one bind parameter.
    expect(relativeImports(holders).map((entry) => entry.target)).toEqual([READER_MODULE]);
    expect(holders.flatMap((file) => logCalls(file.text))).toEqual([]);
    expect([occurrences(holders, CONSOLE), occurrences(holders, SECRET_MEMBER), occurrences(holders, INJECTION_CALL), occurrences(holders, /\$\{/g)]).toEqual([[], [], [], []]);
    expect(occurrences(holders, /\$1\b/g)).toHaveLength(1);
  });

  it('the stub is not an opener: no file under src/capture/ imports the reader, the wiring or the reveal module', () => {
    const capture = productionCode.filter((file) => file.path.startsWith('src/capture/'));
    expect(capture.length).toBeGreaterThan(20);
    expect(relativeImports(capture).filter((entry) => [READER_MODULE, HOLDERS_MODULE, REVEAL_MODULE].includes(entry.target))).toEqual([]);
  });
});

describe('R-4: the two files log nothing, read no secret member and do not make the injection result', () => {
  const both = productionCode.filter((file) => file.path === `${REVEAL_MODULE}.ts` || file.path === `${READER_MODULE}.ts`);

  it('no log call, no console, no read of a secret member, no call of the injection point, no error with a cause', () => {
    expect(both).toHaveLength(2);
    expect(both.flatMap((file) => logCalls(file.text))).toEqual([]);
    expect(occurrences(both, CONSOLE)).toEqual([]);
    expect(occurrences(both, SECRET_MEMBER)).toEqual([]);
    expect(occurrences(both, INJECTION_CALL)).toEqual([]);
    expect(occurrences(both, ERROR_CAUSE)).toEqual([]);
  });

  it('the reader reaches the adapter layer through its index and the store through a parameter: it imports no credential store', () => {
    const reader = both.filter((file) => file.path === `${READER_MODULE}.ts`);
    expect(relativeImports(reader).map((entry) => entry.target).sort()).toEqual(['src/capture/adapters', 'src/core', 'src/modules/capture-config/credential-reveal', 'src/plugins/logger']);
  });
});

// Task 4 row 187 (controller ruling C36 (1)). The hosted action gives a camera that is assigned into an empty slot without
// a profile a constant of the SIMULATOR (`packages/shared/src/sim/capture-config.ts`). In the Core the profile of a
// production camera is the statement of its own stream and no default stands in for it: operation 78 / 79 refuse the edit
// before the action (`routes.ts`). This rule holds the other half: NO FILE UNDER `apps/core-server/src` - production or
// test - names that constant in its code, so no later row can read the default into the Core.
describe('R-7: no file of the Core names the simulator\'s empty-slot profile constant (C36 (1))', () => {
  /** Built from parts, so that this file is not itself an occurrence. */
  const EMPTY_SLOT_CONSTANT = ['CAPTURE', 'CONFIG', 'EMPTY', 'SLOT', 'PROFILE'].join('_');
  const NAMED = new RegExp(`\\b${EMPTY_SLOT_CONSTANT}\\b`, 'g');
  const underSrc = codeOnly(tree.filter((file) => file.path.startsWith('src/') && !file.path.endsWith('.sql')));

  it('importers under apps/core-server/src: 0 - in production sources and in tests alike', () => {
    expect(underSrc.length).toBeGreaterThan(200);
    expect(underSrc.some((file) => file.path === `${FOLDER}routes.ts`)).toBe(true);
    expect(occurrences(underSrc, NAMED)).toEqual([]);
  });

  it('finds a planted import, a planted re-export and a planted use (positive control); a comment that names it is no import', () => {
    const planted: SourceFile[] = [
      { path: `${FOLDER}routes.ts`, text: `import { ${EMPTY_SLOT_CONSTANT} } from '@dems/shared/sim';\n` },
      { path: 'src/capture/adapters/camera/onvif-relay.ts', text: `\nexport { ${EMPTY_SLOT_CONSTANT} as DEFAULT_PROFILE } from '@dems/shared/sim';\n` },
      { path: 'src/capture-session/index.ts', text: `const profile = line.profile ?? sim.${EMPTY_SLOT_CONSTANT};\n` },
      { path: `${FOLDER}plan.ts`, text: `// the simulator's ${EMPTY_SLOT_CONSTANT} is not read here\nconst nothing = 0;\n` },
    ];
    expect(occurrences(codeOnly(planted), NAMED)).toEqual([`${FOLDER}routes.ts:1`, 'src/capture/adapters/camera/onvif-relay.ts:2', 'src/capture-session/index.ts:1']);
  });

  it('the constant is still the simulator\'s: defined once in the shared package, used there by the hosted action', () => {
    const shared = readTree(`${WORKSPACE}/../../packages/shared/src`).filter((file) => /\.tsx?$/.test(file.path));
    expect(occurrences(codeOnly(shared), NAMED).map((place) => place.replace(/:\d+$/, ''))).toEqual(['sim/capture-config.ts', 'sim/capture-config.ts']);
  });
});
