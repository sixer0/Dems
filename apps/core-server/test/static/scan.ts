/**
 * Support for the static guard tests (not a test file). It reads source trees as text and
 * reports where a pattern occurs, as `path:line`.
 *
 * The guard tests run in the database-free project, so they are part of every later row's gate
 * (02_plan §11.1 GR-7). A forbidden text is always built from fragments in the test files, so
 * that the tests do not find themselves.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `apps/core-server`. */
export const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The workspace root of the repository. */
export const REPOSITORY = resolve(WORKSPACE, '..', '..');

/** Never read: dependencies, build output, generated native projects, caches (also `.cache/`, git-ignored scratch), logs, media. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'coverage',
  'logs',
  'dist',
  'build',
  'android',
  'ios',
  'assets',
  '.vitest',
  '.turbo',
  '.expo',
  '.gradle',
  '.cache',
  '.git',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.sh',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.env',
  '.txt',
]);

export interface SourceFile {
  /** Relative to the root that was read, with forward slashes. */
  readonly path: string;
  readonly text: string;
}

function walk(directory: string, root: string, out: SourceFile[]): void {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    // Removed by another row while this test walks the tree: nothing to read.
    return;
  }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(full, root, out);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
      try {
        out.push({ path: relative(root, full).split(sep).join('/'), text: readFileSync(full, 'utf8') });
      } catch {
        // As above.
      }
    }
  }
}

/** Every text file below `root`, sorted by path. */
export function readTree(root: string): SourceFile[] {
  const out: SourceFile[] = [];
  walk(root, root, out);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** A test file: `*.test.ts`, anything in a `__tests__` folder, anything under `test/`. */
export function isTestFile(path: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(path) || path.includes('__tests__/') || path.startsWith('test/');
}

/** Production sources of the server: `src/**` without test files. */
export function isProductionSource(path: string): boolean {
  return path.startsWith('src/') && !isTestFile(path);
}

/**
 * The text without its comments, with the line breaks kept so that line numbers stay right.
 * For the rules about what code does (a call, a property read): a sentence in a comment that
 * names the thing is not a use of it. String literals are kept. Regular-expression literals are
 * not recognised, so a `//` inside one cuts the rest of that line: the guard can then miss
 * something on that line, but it never reports something that is not there.
 */
export function stripComments(text: string): string {
  let out = '';
  let state: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? '';
    const next = text[i + 1] ?? '';
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        i += 1;
      } else if (char === '/' && next === '*') {
        state = 'block';
        i += 1;
      } else {
        if (char === "'" || char === '"' || char === '`') state = char;
        out += char;
      }
    } else if (state === 'line') {
      if (char === '\n') {
        state = 'code';
        out += char;
      }
    } else if (state === 'block') {
      if (char === '*' && next === '/') {
        state = 'code';
        i += 1;
      } else if (char === '\n') {
        out += char;
      }
    } else {
      out += char;
      if (char === '\\') {
        out += next;
        i += 1;
      } else if (char === state || (char === '\n' && state !== '`')) {
        state = 'code';
      }
    }
  }
  return out;
}

/** The same files with their comments removed. */
export function codeOnly(files: readonly SourceFile[]): SourceFile[] {
  return files.map((file) => ({ path: file.path, text: stripComments(file.text) }));
}

/** A regular expression for a literal text. */
export function literal(text: string, flags = 'g'): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
}

/**
 * Where `pattern` occurs: `path:line` for every match in every file that `where` accepts.
 * `pattern` must be global; it may span lines.
 */
export function occurrences(
  files: readonly SourceFile[],
  pattern: RegExp,
  where: (path: string) => boolean = () => true,
): string[] {
  if (!pattern.global) throw new Error('occurrences() needs a global pattern');
  const found: string[] = [];
  for (const file of files) {
    if (!where(file.path)) continue;
    for (const match of file.text.matchAll(pattern)) {
      const line = file.text.slice(0, match.index).split('\n').length;
      found.push(`${file.path}:${line}`);
    }
  }
  return found;
}

/** True when `path` lies in one of the folders (each ends with `/`) or is one of the files. */
export function under(path: string, places: readonly string[]): boolean {
  return places.some((place) => (place.endsWith('/') ? path.startsWith(place) : path === place));
}

/** One folder a scan is meant to read, as the rule R1 of `scanCoverage` walks it. */
export interface ScanRoot {
  /** From the workspace, with forward slashes; a trailing `/` is allowed. */
  readonly folder: string;
  /** Sub-folders too (the default). `false`: the files of the folder itself only. */
  readonly recursive?: boolean;
  /** The file endings the scan reads. Default: `.ts`. */
  readonly extensions?: readonly string[];
  /** Sub-folders (from the workspace, ending with `/`) or files that belong to another scan. */
  readonly without?: readonly string[];
}

export interface ScanCoverage {
  /** Production files the folder holds and the scan did not read. */
  readonly missing: string[];
  /** Files the scan read that the folder does not hold as production files. */
  readonly unexpected: string[];
  /** True when the walk found no production file at all: an empty scan proves nothing. */
  readonly empty: boolean;
}

/**
 * The production files below one folder, found WITHOUT the scanner above: one recursive
 * directory listing of the operating system, no list of skipped folders, no list of text
 * endings. A production file is a file that is no test (`*.test.*`) and lies in no `__tests__`
 * folder and in no `node_modules`.
 */
function walkedProductionFiles(root: ScanRoot, workspace: string): string[] {
  const folder = root.folder.replace(/\/+$/, '');
  const extensions = root.extensions ?? ['.ts'];
  let names: string[];
  try {
    names = readdirSync(join(workspace, folder), { recursive: root.recursive !== false, encoding: 'utf8' });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const name of names) {
    const path = `${folder}/${name.split(sep).join('/')}`;
    const parts = path.split('/');
    if (parts.includes('__tests__') || parts.includes('node_modules')) continue;
    if (/\.test\.[a-z]+$/.test(path)) continue;
    if (!extensions.some((extension) => path.endsWith(extension))) continue;
    if ((root.without ?? []).some((place) => (place.endsWith('/') ? path.startsWith(place) : path === place))) continue;
    if (!statSync(join(workspace, path), { throwIfNoEntry: false })?.isFile()) continue;
    found.push(path);
  }
  return found;
}

/**
 * RULE R1 of the static guards (test-suite consolidation, test/14): A SCAN READS ITS FOLDER.
 *
 * A guard of the form "no file does X" is worth what its scan reads: a filter that skips a file,
 * or reads nothing, passes every rule. The guards used to prove their reach with a list of file
 * names, which turned red on every new file and said nothing new. The rule instead: what the
 * guard scanned EQUALS an independent walk of the folder it names (`walkedProductionFiles`), and
 * that walk is not empty. A new production file is covered the moment it exists; a scan that
 * loses a file is named with the file.
 *
 * `scanned`: the files (or paths, from the workspace) the guard holds its rules against.
 * `roots`: the folder or folders it means to cover. `workspace`: only the tests of this rule
 * pass another one.
 *
 * Use: `expect(scanCoverage(all, ['src/modules/alerts/'])).toEqual(SCAN_COVERS);`
 */
export function scanCoverage(scanned: readonly (SourceFile | string)[], roots: readonly (ScanRoot | string)[], workspace: string = WORKSPACE): ScanCoverage {
  const read = new Set(scanned.map((file) => (typeof file === 'string' ? file : file.path)));
  const walked = new Set(roots.flatMap((root) => walkedProductionFiles(typeof root === 'string' ? { folder: root } : root, workspace)));
  return {
    missing: [...walked].filter((path) => !read.has(path)).sort(),
    unexpected: [...read].filter((path) => !walked.has(path)).sort(),
    empty: walked.size === 0,
  };
}

/** What `scanCoverage` answers for a scan that reads its folder, the whole of it and nothing else. */
export const SCAN_COVERS: ScanCoverage = { missing: [], unexpected: [], empty: false };
