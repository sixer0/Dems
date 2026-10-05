/**
 * Support for the static guard tests (not a test file). It reads source trees as text and
 * reports where a pattern occurs, as `path:line`.
 *
 * The guard tests run in the database-free project, so they are part of every later row's gate
 * (02_plan §11.1 GR-7). A forbidden text is always built from fragments in the test files, so
 * that the tests do not find themselves.
 */
import { readdirSync, readFileSync } from 'node:fs';
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
