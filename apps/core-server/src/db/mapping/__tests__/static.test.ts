// Static guards of plan row W20, over the two folders the row owns (`src/db/mapping`,
// `src/db/seed`). Database-free, so they run in every later row's gate.
//
//   - the mapping is pure: no database, no clock, no random source, no file, no process state;
//   - the demo password is read by import, in one file, and handed to the hasher only; its
//     VALUE, and the value of the demo pairing code, occur in no file of the two folders
//     (the two constants are read into variables here, and only counts are reported);
//   - the seed copies no dataset value into its own source (SD-1): no operator or subject name;
//   - the seed programs print through the command's output only, and the template hook imports
//     nothing of Vitest.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_OPERATOR_PASSWORD, DEMO_PAIRING_CODE, EVIDENCE_HISTORY, OPERATORS, RECORDING_SCENARIO, TODAY_HISTORY } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';

const DB_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Source {
  /** Relative to `src/db`, with forward slashes. */
  readonly path: string;
  readonly text: string;
  /** The text without comments (a sentence about a thing is not a use of it). */
  readonly code: string;
}

function stripComments(text: string): string {
  let out = '';
  let state: 'code' | 'line' | 'block' | "'" | '"' | '`' = 'code';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';
    const next = text[index + 1] ?? '';
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
        index += 1;
      } else if (char === '/' && next === '*') {
        state = 'block';
        index += 1;
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
        index += 1;
      } else if (char === '\n') out += char;
    } else {
      out += char;
      if (char === '\\') {
        out += next;
        index += 1;
      } else if (char === state || (char === '\n' && state !== '`')) state = 'code';
    }
  }
  return out;
}

function read(folder: string, out: Source[] = []): Source[] {
  for (const name of readdirSync(folder)) {
    const full = join(folder, name);
    if (statSync(full).isDirectory()) read(full, out);
    else if (/\.(ts|md|json|sql)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      out.push({ path: relative(DB_FOLDER, full).split('\\').join('/'), text, code: stripComments(text) });
    }
  }
  return out;
}

const sources = [...read(join(DB_FOLDER, 'mapping')), ...read(join(DB_FOLDER, 'seed'))].sort((a, b) => a.path.localeCompare(b.path));
const isTest = (source: Source): boolean => source.path.includes('__tests__/');
const production = sources.filter((source) => !isTest(source));
const mapping = production.filter((source) => source.path.startsWith('mapping/'));
const seed = production.filter((source) => source.path.startsWith('seed/'));

function hits(files: readonly Source[], pattern: RegExp, where: 'text' | 'code' = 'code'): string[] {
  return files.flatMap((file) => [...file[where].matchAll(pattern)].map((match) => `${file.path}:${file[where].slice(0, match.index).split('\n').length}`));
}

describe('the two folders', () => {
  it('are read: the files the row wrote, and nothing else under them', () => {
    expect(mapping.map((file) => file.path)).toEqual([
      'mapping/audit-verify.ts',
      'mapping/changes.ts',
      'mapping/exports.ts',
      'mapping/from-rows.ts',
      'mapping/guards.ts',
      'mapping/health-snapshot.ts',
      'mapping/index.ts',
      'mapping/rbac.ts',
      'mapping/rows.ts',
      'mapping/slices.ts',
      'mapping/to-rows.ts',
    ]);
    // Integration pass E3 added three: the v2 demo items of a seed (pure), the Core a command seeds for, and the command's one-shot helper run.
    // REVISED 2026-10-30 (principal): `seed/factory.ts` is one file of this folder more — the writer of a unit's
    // database (the two vendor identities, no row of the demonstration dataset). It joins the list; nothing else moved.
    expect(seed.map((file) => file.path)).toEqual(['seed/cli.ts', 'seed/dataset.ts', 'seed/demo-core.ts', 'seed/demo-helper.ts', 'seed/demo-packages.ts', 'seed/factory.ts', 'seed/index.ts', 'seed/seed.ts']);
    expect(sources.filter(isTest).length).toBeGreaterThanOrEqual(8);
  });
});

describe('the mapping is pure', () => {
  it('imports no database driver, no query builder, no file or network module, and nothing of the seed', () => {
    const imports = mapping.flatMap((file) =>
      [...file.code.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)';/gms)].map((match) => ({
        file: file.path,
        typeOnly: match[1] !== undefined,
        from: match[2] ?? '',
      })),
    );
    expect(imports.length).toBeGreaterThan(20);
    const runtime = imports.filter((entry) => !entry.typeOnly).map((entry) => entry.from);
    // What the mapping loads at run time: the shared simulator, one Node utility, its own files.
    expect([...new Set(runtime)].filter((from) => !from.startsWith('./')).sort()).toEqual(['@dems/shared/sim', 'node:util']);
    // The typed schema is used for its row TYPES only: the table objects are never loaded here.
    for (const entry of imports.filter((candidate) => candidate.from.startsWith('../schema'))) expect(entry.typeOnly, entry.file).toBe(true);
    expect(hits(mapping, /from\s+'(?:pg|drizzle-orm[^']*|node:(?:fs|net|crypto|child_process|http|https)|\.\.\/seed[^']*|\.\.\/commands[^']*)'/g)).toEqual([]);
  });

  it('reads no clock, no random source and no process state, and sends no statement', () => {
    expect(hits(mapping, /\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bperformance\b|\bMath\s*\.\s*random\b|\bprocess\s*\./g)).toEqual([]);
    expect(hits(mapping, /\.\s*(?:query|execute|transaction)\s*\(/g)).toEqual([]);
    expect(hits(mapping, /\b(?:pool|client|executor|connection)\b/gi)).toEqual([]);
    expect(hits(mapping, /\bconsole\s*\./g)).toEqual([]);
    expect(hits(mapping, /\b(?:async|await)\b/g)).toEqual([]);
  });

  it('positive control: the same patterns find a clock, a statement and a driver import when they are there', () => {
    const planted: Source[] = [
      { path: 'x.ts', text: '', code: "import { Pool } from 'pg';\nconst now = Date.now();\nawait pool.query('SELECT 1');" },
    ];
    expect(hits(planted, /from\s+'(?:pg|drizzle-orm[^']*)'/g)).toEqual(['x.ts:1']);
    expect(hits(planted, /\bDate\s*\.\s*now\b/g)).toEqual(['x.ts:2']);
    expect(hits(planted, /\.\s*(?:query|execute)\s*\(/g)).toEqual(['x.ts:3']);
  });
});

describe('the demo password and the demo pairing code', () => {
  it('occur as VALUES in no file of the two folders, tests and comments included (counts only)', () => {
    const password: string = DEMO_OPERATOR_PASSWORD;
    const code: string = DEMO_PAIRING_CODE;
    expect(password.length).toBeGreaterThanOrEqual(8);
    expect(code).toMatch(/^[0-9]{6}$/);
    const counts = sources.map((file) => ({
      file: file.path,
      password: file.text.split(password).length - 1,
      code: file.text.split(code).length - 1,
    }));
    const holders = counts.filter((entry) => entry.password > 0 || entry.code > 0).map((entry) => entry.file);
    expect(holders).toEqual([]);
    expect(counts.length).toBe(sources.length);
  });

  it('the password constant is named by one production file, which hands it to the hasher and to nothing else', () => {
    const naming = production.filter((file) => /\bDEMO_OPERATOR_PASSWORD\b/.test(file.code)).map((file) => file.path);
    expect(naming).toEqual(['seed/seed.ts']);
    const program = seed.find((file) => file.path === 'seed/seed.ts');
    const uses = [...(program?.code ?? '').matchAll(/.*\bDEMO_OPERATOR_PASSWORD\b.*/g)].map((match) => match[0].trim());
    expect(uses).toEqual([
      "import { DEMO_OPERATOR_PASSWORD, GENESIS_HASH, type SimState } from '@dems/shared/sim';",
      'record = await hasher(DEMO_OPERATOR_PASSWORD);',
    ]);
    // The pairing code constant is named by no production file: the seed writes no pairing code.
    expect(production.filter((file) => /\bDEMO_PAIRING_CODE\b/.test(file.code))).toEqual([]);
  });

  it('no production file of the seed prints, logs or formats a credential column', () => {
    expect(hits(seed, /\bconsole\s*\./g)).toEqual([]);
    // The hash record is read in one place: where its members become the bind parameters of the
    // credentials row. Nothing renders a salt or a hash as text, and no output line names one.
    const program = seed.find((file) => file.path === 'seed/seed.ts')?.code ?? '';
    expect([...program.matchAll(/\brecord\s*\.\s*(salt|hash)\b/g)].map((match) => match[1])).toEqual(['salt', 'hash']);
    expect(hits(seed, /\.toString\(\s*'(?:hex|base64)'\s*\)/g)).toEqual([]);
    expect(hits(seed, /\bio\s*\.\s*(?:out|err)\([^;]*\b(?:salt|credentials|record|password)\b/gi)).toEqual([]);
  });
});

describe('SD-1, SR-62: the seed copies no dataset value into its own source', () => {
  it('no operator name, username or subject name of the shared dataset is written in a production file', () => {
    const names = [
      ...OPERATORS.flatMap((operator) => [operator.name, operator.username]),
      ...EVIDENCE_HISTORY.map((entry) => entry.subjectName),
      ...TODAY_HISTORY.map((entry) => entry.subjectName),
      RECORDING_SCENARIO.subjectName,
    ];
    expect(new Set(names).size).toBeGreaterThanOrEqual(19);
    const found = production.flatMap((file) => names.filter((name) => file.text.includes(name)).map((name) => `${file.path}: ${name}`));
    expect(found).toEqual([]);
    // No e-mail address either.
    expect(hits(production, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g, 'text')).toEqual([]);
  });
});

describe('the template hook of tpl_seed', () => {
  it('imports the helper for its type only and nothing of Vitest, and seeds a test database only', () => {
    const hook = sources.find((file) => file.path === 'seed/__tests__/template-hook.seed.ts');
    expect(hook).toBeDefined();
    const imports = [...(hook?.code ?? '').matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)';/gms)].map((match) => `${match[1] === undefined ? 'value' : 'type'} ${match[2]}`);
    expect(imports).toEqual(['type ../../../../test/helpers/db/hooks', 'value ../seed']);
    expect(hook?.code).toMatch(/export const templateHook: TemplateHook = async \(\{ pool \}\) =>/);
    expect(hook?.code).toMatch(/target: 'test'/);
  });
});
