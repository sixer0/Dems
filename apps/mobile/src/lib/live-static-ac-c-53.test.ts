// Plan row W87 (step 109): the app-wide static test of AC-C-53 for the mobile app
// (04_client_integration_spec §13.5 AC-C-53, §12.2 TS-15).
//
// AC-C-53: "No production file under ... `apps/mobile/src/features` or `apps/mobile/src/auth` imports
// `useSimActions` or reads `.actions` from a `Sim`". Each screen row proved it for its own folder
// (client gate CLG item (c)); this file proves it once for every folder under `src/features` and for
// `src/auth`, so that a folder added after its row, or a file a later round moved, is still covered.
//
// | Rule | How it is read |
// |------|----------------|
// | No `useSimActions` in a production file | The identifier, in code (comments and quoted text left out) |
// | No `.actions` read on a `Sim` | Any `<expression>.actions` or `<expression>?.actions` in code, and any `{ actions } = <expression>`. Two receivers are no `Sim` and are named: a `StyleSheet` the same file creates (`styles.actions`) and a timing table the same file declares (`BEAT.actions`) |
// | The fake transport stays out of production (TS-15) | No production file of `src` imports `@dems/shared/live/testing`; the test beds under `testing/` folders are harness files |
//
// It reads source text: what a file names, not what it does at run time.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(__dirname, '..');
const SCOPES = ['features', 'auth'] as const;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const posix = (path: string): string => relative(SRC, path).split(sep).join('/');

/** A test, a test folder, or a harness folder (`testing/`): not production. */
const isTestOrHarness = (file: string): boolean => /\.test\.tsx?$/.test(file) || /(?:^|\/)(?:testing|__tests__)\//.test(file);

interface Source {
  readonly file: string;
  readonly text: string;
}

const SOURCES: readonly Source[] = filesUnder(SRC)
  .filter((path) => /\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts'))
  .map((path) => ({ file: posix(path), text: readFileSync(path, 'utf8') }))
  .sort((a, b) => a.file.localeCompare(b.file));
const PRODUCTION = SOURCES.filter(({ file }) => !isTestOrHarness(file));
const IN_SCOPE = PRODUCTION.filter(({ file }) => SCOPES.some((scope) => file.startsWith(`${scope}/`)));

/** Code without its comments, so that a rule can be worded in a doc comment. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}
/** Quoted text is no code: a translation key or a test ID that holds `.actions` is a word. */
function unquoted(text: string): string {
  return text.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

/** The simulator's action hook, put together here so that this file does not hold the name it looks for. */
const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
const HOOK = new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`);
/** A read of `actions` on an object, with the receiver: `x.actions`, `x?.actions`, `x().actions`, `a.b.actions`. */
const ACTIONS_READ = /([\w$.\])]*?[\w$\])])\??\.actions\b/g;
/** `actions` taken out of an object: `const { actions } = …`, `{ store, actions: a } = …`. */
const ACTIONS_DESTRUCTURED = /\{[^{}]*\bactions\b[^{}]*\}\s*=(?!=)/g;

const BY_FILE = new Map(SOURCES.map((source) => [source.file, source.text]));

/** The text of the module a relative import names, from the file that imports it; `null` for a package. */
function moduleText(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = posix(resolve(SRC, fromFile, '..', specifier));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const text = BY_FILE.get(candidate);
    if (text !== undefined) return text;
  }
  return null;
}

/**
 * Receivers that are no `Sim`, each only where the code makes it what it is: a React Native style
 * sheet the same file creates (`const styles = StyleSheet.create(`), or a constant table in capitals
 * declared as an object literal (`const HOME_BEATS = {`) in the same file or exported as one by the
 * relative module it is imported from (a timing table of the motion).
 */
function isNotASim(receiver: string, source: Source): boolean {
  if (receiver === 'styles') return /\bconst styles = StyleSheet\.create\(/.test(source.text);
  if (!/^[A-Z][A-Z0-9_]*$/.test(receiver)) return false;
  if (new RegExp(`\\bconst ${receiver} = \\{`).test(source.text)) return true;
  const imported = new RegExp(`import\\s+\\{[^}]*\\b${receiver}\\b[^}]*\\}\\s+from\\s+['"]([^'"]+)['"]`).exec(source.text);
  const module = imported ? moduleText(source.file, imported[1] ?? '') : null;
  return module !== null && new RegExp(`\\bexport const ${receiver} = \\{`).test(module);
}

/** What a production file says that AC-C-53 forbids, as `file: text` lines. */
function violationsOf(source: Source): string[] {
  const text = unquoted(code(source.text));
  const found: string[] = [];
  if (HOOK.test(text)) found.push(`${source.file}: ${SIM_ACTIONS_HOOK}`);
  for (const match of text.matchAll(ACTIONS_READ)) {
    if (isNotASim(match[1] ?? '', source)) continue;
    found.push(`${source.file}: ${match[0]}`);
  }
  for (const match of text.matchAll(ACTIONS_DESTRUCTURED)) found.push(`${source.file}: ${match[0].replace(/\s+/g, ' ')}`);
  return found;
}

describe('AC-C-53 over every folder of `src/features` and over `src/auth` (the app-wide static test of W87)', () => {
  it('reads every feature folder and the auth layer, sub-folders included', () => {
    const folders = readdirSync(join(SRC, 'features'))
      .filter((name) => statSync(join(SRC, 'features', name)).isDirectory())
      .sort();
    const read = [...new Set(IN_SCOPE.filter(({ file }) => file.startsWith('features/')).map(({ file }) => file.split('/')[1]))].sort();
    expect(read).toEqual(folders);
    expect(folders.length).toBeGreaterThanOrEqual(17);
    expect(IN_SCOPE.filter(({ file }) => file.startsWith('auth/')).length).toBeGreaterThanOrEqual(10);
    expect(IN_SCOPE.length).toBeGreaterThan(200);
    expect(IN_SCOPE.filter(({ file }) => isTestOrHarness(file))).toEqual([]);
  });

  it('the matcher finds what it looks for, and leaves words, style sheets and plain parameters alone', () => {
    const flagged = (text: string): string[] => violationsOf({ file: 'sample.tsx', text });
    for (const sample of [
      `const actions = ${SIM_ACTIONS_HOOK}();`,
      'sim.actions.signIn(username, password);',
      'mobile.live.actions.pair(code);',
      'useSim().actions.touch();',
      'source?.actions.signOut();',
      'const { store, actions } = sim;',
      'const { actions: a } = runtime;',
      'useSimStore((s) => s.actions);',
      // A receiver named like a style sheet is a read when the file does not create one.
      '<View style={styles.actions} />',
      // A constant in capitals is a read when nothing declares it as a table.
      'SIM.actions.signIn(username, password);',
    ]) {
      expect(flagged(sample)).not.toEqual([]);
    }
    for (const sample of [
      "t('common.actions.retry');",
      't("mobile.session.actions.end");',
      'const styles = StyleSheet.create({ actions: { gap: 8 } });\n<View style={styles.actions} />',
      'const BEAT = { feed: 80, actions: 200 } as const;\nconst delay = BEAT.actions;',
      'const actions = useCoreActions();',
      'settle(() => actions.setStoragePolicy(policy), handlers);',
      '// sim.actions.signIn() is what the predecessor called',
    ]) {
      expect(flagged(sample)).toEqual([]);
    }
  });

  it(`no production file of \`src/features\` or \`src/auth\` calls ${SIM_ACTIONS_HOOK} or reads \`.actions\` from a \`Sim\``, () => {
    expect(IN_SCOPE.flatMap(violationsOf)).toEqual([]);
  });

  it('the receivers left out are what the code makes them: style sheets and motion timing tables, nothing else', () => {
    const reads = IN_SCOPE.flatMap((source) =>
      [...unquoted(code(source.text)).matchAll(ACTIONS_READ)].map((match) => ({ file: source.file, receiver: match[1] ?? '', notASim: isNotASim(match[1] ?? '', source) })),
    );
    // There are such reads (the exception is not empty, so this test reads something).
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((read) => !read.notASim)).toEqual([]);
    // Each receiver left out is a style sheet or a constant table in capitals; a `sim`, `live`, `source` or `runtime` never is.
    for (const { receiver } of reads) expect(receiver === 'styles' || /^[A-Z][A-Z0-9_]*$/.test(receiver)).toBe(true);
    for (const receiver of ['sim', 'live', 'source', 'runtime', 'mobile.live']) expect(isNotASim(receiver, { file: 'features/x/y.tsx', text: '' })).toBe(false);
  });
});

describe('the fake transport stays out of production (TS-15)', () => {
  const importsFake = (text: string): boolean => /['"]@dems\/shared\/live\/testing['"]/.test(code(text));

  it('no production file of `src` imports `@dems/shared/live/testing`; its non-test importers are the test beds of `testing/` folders', () => {
    expect(PRODUCTION.filter(({ text }) => importsFake(text)).map(({ file }) => file)).toEqual([]);
    const beds = SOURCES.filter(({ file, text }) => !/\.test\.tsx?$/.test(file) && importsFake(text)).map(({ file }) => file);
    expect(beds.length).toBeGreaterThan(0);
    expect(beds.filter((file) => !/(?:^|\/)testing\//.test(file))).toEqual([]);
  });

  it('no production file imports a test bed or a harness folder', () => {
    const importsHarness = (text: string): string[] =>
      [...code(text).matchAll(/from\s+['"]([^'"]*\/testing(?:\/[^'"]*)?)['"]/g)].map((match) => match[1] ?? '').filter((specifier) => specifier !== '@dems/shared/live/testing');
    expect(PRODUCTION.flatMap(({ file, text }) => importsHarness(text).map((specifier) => `${file}: ${specifier}`))).toEqual([]);
  });
});
