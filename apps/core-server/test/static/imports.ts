/**
 * Support for the static guard of imports (`imports.test.ts`; not a test file). It reads the
 * relative import specifiers of source files as text and says which unit of the scaffold a path
 * lies in.
 *
 * A unit is a folder of the scaffold: `src/core`, `src/engine`, `src/realtime`, each
 * `src/plugins/<name>`, each `src/modules/<name>`, each `src/db/<name>`. A file directly under
 * `src/` (`app.ts`, `config.ts`) is in no unit.
 */
import { posix } from 'node:path';
import { isTestFile, type SourceFile } from './scan';

/** Folders under `src/` whose sub-folders are the units. Every other folder under `src/` is a unit itself. */
const UNIT_GROUPS: ReadonlySet<string> = new Set(['plugins', 'modules', 'db']);

export interface RelativeImport {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  /** The specifier resolved against the importing file: a path from the workspace, without extension. */
  readonly target: string;
}

// `… from './x'` (an import or a re-export), `import './x'` (for its effect) and `import('./x')`.
const SPECIFIER = /\bfrom\s*(['"])(\.{1,2}\/[^'"\n]*|\.{1,2})\1|\bimport\s*\(?\s*(['"])(\.{1,2}\/[^'"\n]*|\.{1,2})\3/g;

/** Every relative import of the files, in file order. Give it sources without their comments. */
export function relativeImports(files: readonly SourceFile[]): RelativeImport[] {
  const found: RelativeImport[] = [];
  for (const file of files) {
    for (const match of file.text.matchAll(SPECIFIER)) {
      const specifier = match[2] ?? match[4] ?? '';
      const line = file.text.slice(0, match.index).split('\n').length;
      const target = posix.normalize(posix.join(posix.dirname(file.path), specifier)).replace(/\.[cm]?[jt]sx?$/, '');
      found.push({ file: file.path, line, specifier, target });
    }
  }
  return found;
}

/** The folders directly under `src/` of a tree. */
export function topFoldersOf(files: readonly SourceFile[]): ReadonlySet<string> {
  return new Set(
    files.flatMap((file) => {
      const parts = file.path.split('/');
      return parts[0] === 'src' && parts.length > 2 && parts[1] !== undefined ? [parts[1]] : [];
    }),
  );
}

/** The unit a path lies in, or null for a path that is in none (`src/app`, anything outside `src/`). */
export function unitOf(path: string, topFolders: ReadonlySet<string>): string | null {
  const [root, first, second] = path.split('/');
  if (root !== 'src' || first === undefined) return null;
  if (UNIT_GROUPS.has(first)) return second === undefined ? null : `src/${first}/${second}`;
  return topFolders.has(first) ? `src/${first}` : null;
}

/** True for a unit of the list. An entry that ends with `/` names a whole group (`src/plugins/`). */
export function isListed(unit: string, units: readonly string[]): boolean {
  return units.some((listed) => (listed.endsWith('/') ? unit.startsWith(listed) : unit === listed));
}

/** The imports that reach test code: a `__tests__` folder, anything under `test/`, a test file. */
export function testCodeImports(imports: readonly RelativeImport[]): string[] {
  return imports
    .filter((entry) => isTestFile(`${entry.target}.ts`) || /(?:^|\/)__tests__(?:\/|$)/.test(entry.target) || entry.target === 'test')
    .map((entry) => `${entry.file}:${entry.line} imports test code: ${entry.specifier}`);
}

/**
 * The imports that name a file INSIDE one of the closed units from outside that unit.
 *
 * `exposed` lists the paths inside a closed unit that its owner offers beside the unit's index
 * (a sub-folder of another row with an index of its own, or one named file), each without an
 * extension: an import of exactly that path, or of its `/index`, is no deep import.
 */
export function deepImports(
  imports: readonly RelativeImport[],
  closedUnits: readonly string[],
  topFolders: ReadonlySet<string>,
  exposed: readonly string[] = [],
): string[] {
  const out: string[] = [];
  for (const entry of imports) {
    const to = unitOf(entry.target, topFolders);
    if (to === null || !isListed(to, closedUnits)) continue;
    if (unitOf(entry.file, topFolders) === to) continue;
    if (entry.target === to || entry.target === `${to}/index`) continue;
    if (exposed.some((path) => entry.target === path || entry.target === `${path}/index`)) continue;
    const index = posix.relative(posix.dirname(entry.file), to);
    out.push(`${entry.file}:${entry.line} reaches into ${to}: ${entry.specifier} (import the unit's index, '${index}')`);
  }
  return out;
}

// ── The unit graph (value imports) ─────────────────────────────────────────────────────────────

/** `import … from './x'` and `export … from './x'`, with the clause between the keyword and `from`. */
const CLAUSE = /\b(import|export)\s+(type\s+)?([^'";]*?)\s*\bfrom\s*(['"])(\.{1,2}\/[^'"\n]*|\.{1,2})\4/g;
/** `import './x'` (for its effect) and `import('./x')`: always a value import. */
const BARE = /\bimport\s*\(?\s*(['"])(\.{1,2}\/[^'"\n]*|\.{1,2})\1/g;

/** True for a clause that imports types only: `import type …`, or `{ type A, type B }`. */
function typeOnly(typeKeyword: string | undefined, clause: string): boolean {
  if (typeKeyword !== undefined) return true;
  const names = clause.trim();
  if (!names.startsWith('{') || !names.endsWith('}')) return false;
  const members = names
    .slice(1, -1)
    .split(',')
    .map((member) => member.trim())
    .filter((member) => member !== '');
  return members.length > 0 && members.every((member) => member.startsWith('type '));
}

/**
 * The relative imports that load a module when the program runs: every import and re-export
 * that is not of types only. A type-only import is erased by the compiler, so it creates no
 * dependency at run time and takes no part in a cycle.
 */
export function valueImports(files: readonly SourceFile[]): RelativeImport[] {
  const found: RelativeImport[] = [];
  for (const file of files) {
    const add = (specifier: string, index: number): void => {
      const line = file.text.slice(0, index).split('\n').length;
      const target = posix.normalize(posix.join(posix.dirname(file.path), specifier)).replace(/\.[cm]?[jt]sx?$/, '');
      found.push({ file: file.path, line, specifier, target });
    };
    for (const match of file.text.matchAll(CLAUSE)) {
      if (!typeOnly(match[2], match[3] ?? '')) add(match[5] ?? '', match.index);
    }
    // After `import` comes a quote or a parenthesis here, so an `import … from` is not read twice.
    for (const match of file.text.matchAll(BARE)) add(match[2] ?? '', match.index);
  }
  return found.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
}

export interface UnitEdge {
  readonly from: string;
  readonly to: string;
  /** `file:line` of every import that makes the edge. */
  readonly where: readonly string[];
}

/** The edges between units that value imports make. A file outside every unit (`src/app.ts`) makes none. */
export function unitEdges(imports: readonly RelativeImport[], topFolders: ReadonlySet<string>): UnitEdge[] {
  const edges = new Map<string, { from: string; to: string; where: string[] }>();
  for (const entry of imports) {
    const from = unitOf(entry.file.replace(/\.[cm]?[jt]sx?$/, ''), topFolders);
    const to = unitOf(entry.target, topFolders);
    if (from === null || to === null || from === to) continue;
    const key = `${from} -> ${to}`;
    const edge = edges.get(key) ?? { from, to, where: [] };
    edge.where.push(`${entry.file}:${entry.line}`);
    edges.set(key, edge);
  }
  return [...edges.values()].sort((a, b) => `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`));
}

/** The groups of units that import each other in a circle, each sorted; empty when the graph has no cycle. */
export function unitCycles(edges: readonly UnitEdge[]): string[][] {
  const next = new Map<string, Set<string>>();
  for (const edge of edges) {
    next.set(edge.from, (next.get(edge.from) ?? new Set()).add(edge.to));
    if (!next.has(edge.to)) next.set(edge.to, new Set());
  }
  // Tarjan's strongly connected components.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const groups: string[][] = [];
  let counter = 0;
  const visit = (unit: string): void => {
    index.set(unit, counter);
    low.set(unit, counter);
    counter += 1;
    stack.push(unit);
    onStack.add(unit);
    for (const target of next.get(unit) ?? []) {
      if (!index.has(target)) {
        visit(target);
        low.set(unit, Math.min(low.get(unit) ?? 0, low.get(target) ?? 0));
      } else if (onStack.has(target)) {
        low.set(unit, Math.min(low.get(unit) ?? 0, index.get(target) ?? 0));
      }
    }
    if (low.get(unit) === index.get(unit)) {
      const group: string[] = [];
      for (;;) {
        const member = stack.pop();
        if (member === undefined) break;
        onStack.delete(member);
        group.push(member);
        if (member === unit) break;
      }
      if (group.length > 1) groups.push(group.sort());
    }
  };
  for (const unit of [...next.keys()].sort()) if (!index.has(unit)) visit(unit);
  return groups.sort((a, b) => a.join().localeCompare(b.join()));
}
