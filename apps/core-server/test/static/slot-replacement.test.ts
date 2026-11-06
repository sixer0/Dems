// Static guard: no production path can replace a seam or a request stage (checkpoint findings
// CPB1-5 and CPS1-2; fix round B2b item 4).
//
// The mechanism is in `src/app.ts`: `replace` throws unless the app was built from a TEST
// CONFIGURATION, one that `testConfiguration(config)` of `src/test-configuration.ts` marked
// before `buildApp` was called. `buildApp` reads the mark once, before it registers a unit. The
// behaviour is tested in `src/__tests__/slot-replacement.test.ts`. What makes it hold for the
// server that runs are four facts about the SOURCES, and this test keeps them:
//
//   1. no production source names `testConfiguration` (the function that marks), except the
//      file that defines it;
//   2. `buildApp(` is called by ONE production source, the entry point, once, with the
//      configuration `loadConfig` returned and the file of the error log, and nothing else;
//   3. the mark is read in one place, the app factory, and handed to both slot registries;
//   4. the first statement of `replace` is the refusal, and nothing else writes the map of
//      replaced slots.
//
// The older rule of the guard row (`plugins/permission-guard/__tests__/static.test.ts`: no
// production source holds the text `stages.replace(` or `seams.replace(`) stays. It is a search
// for one spelling; this is why it is no longer the only protection.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from './scan';

const APP = 'src/app.ts';
const ENTRY_POINT = 'src/index.ts';
const MARK_FILE = 'src/test-configuration.ts';

// Built from fragments, so that this file does not find itself.
const MARK = new RegExp(`\\b${'test'}${'Configuration'}\\b`, 'g');
const MARK_READ = new RegExp(`\\b${'isTest'}${'Configuration'}\\b`, 'g');
const FACTORY_CALL = new RegExp(`\\b${'build'}${'App'}\\s*\\(`, 'g');
const FACTORY_CALL_OF_ENTRY_POINT = new RegExp(`\\b${'build'}${'App'}\\(\\{ config, errorLogFile: DEFAULT_ERROR_LOG_FILE \\}\\)`, 'g');
const FACTORY_DEFINITION = new RegExp(`\\bexport function ${'build'}${'App'}\\(`, 'g');

const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path)));
const textOf = (path: string, files: readonly SourceFile[] = production): string => files.find((file) => file.path === path)?.text ?? '';
const filesOf = (places: readonly string[]): string[] => [...new Set(places.map((place) => place.replace(/:\d+$/, '')))];

/** What is wrong with the sources; empty when nothing is. One function, so that the positive control runs the rule itself. */
function problemsOf(files: readonly SourceFile[]): string[] {
  const problems: string[] = [];
  const app = textOf(APP, files);
  const entry = textOf(ENTRY_POINT, files);

  // 1. Who names the mark.
  for (const place of occurrences(files, MARK)) {
    if (!place.startsWith(`${MARK_FILE}:`)) problems.push(`${place}: a production source names the function that marks a test configuration`);
  }
  // 3. Who reads it.
  const reads = occurrences(files, MARK_READ).filter((place) => !place.startsWith(`${MARK_FILE}:`));
  if (filesOf(reads).join() !== APP) problems.push(`the mark is read in [${filesOf(reads).join(', ')}], expected ${APP} alone`);
  if (!/const replaceable = isTestConfiguration\(config\);\s*const seams = createSlots<Seams>\('seam', SEAM_PROVIDERS, replaceable\);\s*const stages = createSlots<StageHandlers>\('request stage', STAGE_PROVIDERS, replaceable\);/.test(app)) {
    problems.push(`${APP}: the mark is not read once and handed to both slot registries`);
  }
  // The definition and the two registries of `buildApp`: no third one, with another answer.
  if ((app.match(/\bcreateSlots\b/g) ?? []).length !== 3) problems.push(`${APP}: a slot registry is created in another place`);

  // 2. Who builds an app, and from what.
  const calls = occurrences(files, FACTORY_CALL).filter((place) => !(place.startsWith(`${APP}:`) && FACTORY_DEFINITION.test(app)));
  FACTORY_DEFINITION.lastIndex = 0;
  const callers = filesOf(calls.filter((place) => !place.startsWith(`${APP}:`)));
  if (callers.join() !== ENTRY_POINT) problems.push(`the app factory is called by [${callers.join(', ')}], expected ${ENTRY_POINT} alone`);
  if ((entry.match(FACTORY_CALL) ?? []).length !== 1 || (entry.match(FACTORY_CALL_OF_ENTRY_POINT) ?? []).length !== 1) {
    problems.push(`${ENTRY_POINT}: the app is not built once, from \`config\` and the file of the error log alone`);
  }
  const assignments = entry.match(/\bconfig\s*=[^=]/g) ?? [];
  if (assignments.length !== 1 || !/\bconfig = loadConfig\(\{ env: process\.env \}\);/.test(entry)) {
    problems.push(`${ENTRY_POINT}: \`config\` is not assigned once, from loadConfig`);
  }

  // 4. The refusal comes first, and the map has one writer.
  if (!/\breplace\(name, value\) \{\s*if \(!replaceable\) throw new SlotReplacementRefused\(kind, name\);\s*replaced\.set\(name, value\);\s*\},/.test(app)) {
    problems.push(`${APP}: replace() does not refuse first`);
  }
  if ((app.match(/\breplaced\s*\.\s*set\s*\(/g) ?? []).length !== 1) problems.push(`${APP}: the replaced slots are written in another place`);
  if (/\breplaceable\s*=[^=]/.test(app.replace('const replaceable = isTestConfiguration(config);', ''))) problems.push(`${APP}: \`replaceable\` is assigned in another place`);
  return problems;
}

describe('the rule itself', () => {
  const withFile = (path: string, change: (text: string) => string): SourceFile[] => production.map((file) => (file.path === path ? { path, text: change(file.text) } : file));
  const added = (path: string, text: string): SourceFile[] => [...production, { path, text }];

  it('finds each way around it when it is present (positive control)', () => {
    // A unit marks a configuration.
    expect(problemsOf(added('src/modules/x/index.ts', ["import { test", "Configuration } from '../../test-configuration';\nvoid test", 'Configuration(app.config);'].join('')))).toEqual([
      'src/modules/x/index.ts:1: a production source names the function that marks a test configuration',
      'src/modules/x/index.ts:2: a production source names the function that marks a test configuration',
    ]);
    // A second caller of the app factory.
    expect(problemsOf(added('src/modules/y/index.ts', ['const second = build', 'App({ config: marked });'].join('')))).toEqual([
      `the app factory is called by [${ENTRY_POINT}, src/modules/y/index.ts], expected ${ENTRY_POINT} alone`,
    ]);
    // The entry point passes something else, or builds its configuration another way.
    expect(problemsOf(withFile(ENTRY_POINT, (text) => text.replace('{ config, errorLogFile: DEFAULT_ERROR_LOG_FILE }', '{ config: marked(config), errorLogFile: DEFAULT_ERROR_LOG_FILE }')))).toEqual([
      `${ENTRY_POINT}: the app is not built once, from \`config\` and the file of the error log alone`,
    ]);
    expect(problemsOf(withFile(ENTRY_POINT, (text) => text.replace('config = loadConfig({ env: process.env });', 'config = marked(loadConfig({ env: process.env }));')))).toEqual([
      `${ENTRY_POINT}: \`config\` is not assigned once, from loadConfig`,
    ]);
    // The refusal is gone, or the app decides by something else.
    expect(problemsOf(withFile(APP, (text) => text.replace('if (!replaceable) throw new SlotReplacementRefused(kind, name);', '')))).toEqual([`${APP}: replace() does not refuse first`]);
    expect(problemsOf(withFile(APP, (text) => text.replace('const replaceable = isTestConfiguration(config);', 'const replaceable = true;')))).toEqual([
      `${APP}: the mark is not read once and handed to both slot registries`,
      `${APP}: \`replaceable\` is assigned in another place`,
    ]);
    // Another unit reads the mark, or writes the map.
    expect(problemsOf(added('src/core/z.ts', ['if (isTest', 'Configuration(app.config)) lenient();'].join('')))).toEqual(['the mark is read in [src/app.ts, src/core/z.ts], expected src/app.ts alone']);
    expect(problemsOf(withFile(APP, (text) => text.replace('has: (name) =>', 'force: (name: string, value: unknown) => void replaced.set(name, value),\n    has: (name) =>')))).toEqual([
      `${APP}: the replaced slots are written in another place`,
    ]);
  });
});

describe('CPB1-5, CPS1-2: replace is test-only by construction', () => {
  it('no production source marks a configuration, the entry point alone builds the app from loadConfig, and replace() refuses first', () => {
    expect(textOf(APP)).not.toBe('');
    expect(textOf(ENTRY_POINT)).not.toBe('');
    expect(textOf(MARK_FILE)).not.toBe('');
    expect(problemsOf(production)).toEqual([]);
  });

  it('the file of the mark imports nothing but a type, and exports the two functions', () => {
    const mark = textOf(MARK_FILE);
    expect([...mark.matchAll(/^import\b.*$/gm)].map((match) => match[0])).toEqual(["import type { CoreServerConfig } from './config';"]);
    expect([...mark.matchAll(/^export (?:function|const|class) (\w+)/gm)].map((match) => match[1])).toEqual(['testConfiguration', 'isTestConfiguration']);
    expect(occurrences([{ path: MARK_FILE, text: mark }], /\bTEST_CONFIGURATIONS\s*\.\s*add\s*\(/g)).toHaveLength(1);
  });
});
