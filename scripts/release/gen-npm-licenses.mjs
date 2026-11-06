#!/usr/bin/env node
// Generates a plain-text licence list for the npm PRODUCTION dependency tree of one workspace.
// Node built-ins only; reads the local node_modules tree; no network access.
//
// Usage (from the repository root):
//   node scripts/release/gen-npm-licenses.mjs --workspace @dems/mobile \
//        --out release/android/licenses/THIRD-PARTY-LICENSES.txt [--title "..."]
//
// Source of the package set: `npm ls --omit=dev --all --json --long -w <workspace>`.
// For every unique name@version it prints the licence named in package.json and the text of the
// LICENSE / LICENCE / COPYING / NOTICE files found in the package root.
// The output is deterministic (sorted, no timestamp, no absolute paths) so its SHA-256 is stable.
//
// Exit codes: 0 = written; 1 = failure (message on stderr, nothing half-written: the file is
// written to a temporary name first and then renamed).

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, renameSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const RULE = '='.repeat(100);
const LICENCE_FILE = /^(licen[sc]e|copying|notice|unlicense)([-._].*)?$/i;
const MAX_FILE_BYTES = 512 * 1024; // guard: a "LICENSE" larger than this is not a licence text

function fail(message) {
  process.stderr.write(`gen-npm-licenses: ERROR: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { workspace: null, out: null, title: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--workspace') { out.workspace = value; i += 1; }
    else if (key === '--out') { out.out = value; i += 1; }
    else if (key === '--title') { out.title = value; i += 1; }
    else fail(`unknown argument: ${key}`);
  }
  if (!out.workspace || !out.out) fail('usage: --workspace <name> --out <file> [--title <text>]');
  return out;
}

// package.json "license" can be a string, an object {type}, or the legacy "licenses" array.
function licenceName(pkg) {
  const one = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' && v.type ? String(v.type) : null);
  const direct = one(pkg.license);
  if (direct) return direct;
  if (Array.isArray(pkg.licenses)) {
    const names = pkg.licenses.map(one).filter(Boolean);
    if (names.length) return names.join(' OR ');
  }
  return 'UNKNOWN (no licence field in package.json)';
}

function repositoryUrl(pkg) {
  const r = pkg.repository;
  const url = typeof r === 'string' ? r : r && typeof r === 'object' ? r.url : null;
  return url || pkg.homepage || '(none stated)';
}

function authorName(pkg) {
  const a = pkg.author;
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object' && a.name) return String(a.name);
  return null;
}

function readLicenceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const name of entries.filter((n) => LICENCE_FILE.test(n)).sort()) {
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      const text = readFileSync(full, 'utf8').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
      if (text) files.push({ name, text });
    } catch {
      // unreadable file: treated as absent; the package is then listed under "no licence text"
    }
  }
  return files;
}

const args = parseArgs(process.argv.slice(2));

// npm exits 1 (ELSPROBLEMS) for peer-range mismatches but still prints the full JSON tree.
const ls = spawnSync('npm', ['ls', '--omit=dev', '--all', '--json', '--long', '-w', args.workspace], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
});
if (ls.error) fail(`cannot run npm ls: ${ls.error.message}`);
let tree;
try {
  tree = JSON.parse(ls.stdout);
} catch (error) {
  fail(`npm ls did not return JSON (exit ${ls.status}): ${error instanceof Error ? error.message : error}`);
}
const start = tree.dependencies && tree.dependencies[args.workspace];
if (!start) fail(`workspace ${args.workspace} is not in the npm ls tree`);

// Walk the tree; keep the first path seen for each name@version.
const packages = new Map();
const firstParty = new Set();
(function walk(node) {
  for (const [name, dep] of Object.entries(node.dependencies || {})) {
    if (!dep || !dep.version || !dep.path) continue; // unmet optional/peer dependency: not installed
    const inNodeModules = dep.path.split(sep).includes('node_modules');
    const real = inNodeModules ? dep.path : null;
    if (!real || (dep.resolved && String(dep.resolved).startsWith('file:'))) {
      firstParty.add(`${name}@${dep.version}`); // workspace package: first-party, only its deps are listed
    } else if (!packages.has(`${name}@${dep.version}`)) {
      packages.set(`${name}@${dep.version}`, { name, version: dep.version, path: dep.path });
    }
    walk(dep);
  }
})(start);
if (packages.size === 0) fail('no third-party packages found');

const sorted = [...packages.values()].sort(
  (a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en', { numeric: true }),
);

const byLicence = new Map();
const withoutText = [];
const blocks = [];
for (const p of sorted) {
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(join(p.path, 'package.json'), 'utf8'));
  } catch {
    // package.json unreadable: licence name is reported as UNKNOWN below
  }
  const licence = licenceName(pkg);
  byLicence.set(licence, (byLicence.get(licence) || 0) + 1);
  const files = readLicenceFiles(p.path);
  if (files.length === 0) withoutText.push(`${p.name}@${p.version} (${licence})`);
  const lines = [RULE, `${p.name}@${p.version}`, `Licence:    ${licence}`, `Repository: ${repositoryUrl(pkg)}`];
  const author = authorName(pkg);
  if (author) lines.push(`Author:     ${author}`);
  lines.push(`Location:   ${relative(ROOT, p.path).split(sep).join('/')}`, RULE, '');
  if (files.length === 0) {
    lines.push(`(The package ships no LICENSE/NOTICE file. Licence as declared in its package.json: ${licence}.)`, '');
  } else {
    for (const f of files) lines.push(`----- ${f.name} -----`, f.text, '');
  }
  blocks.push(lines.join('\n'));
}

const summary = [...byLicence.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
const head = [
  args.title || `Third-party licences: npm production dependencies of ${args.workspace}`,
  '',
  `Source:   npm ls --omit=dev --all --json --long -w ${args.workspace}  (local node_modules; no network)`,
  `Scope:    every installed package in the PRODUCTION dependency tree of ${args.workspace}.`,
  '          This is a superset of what is compiled into the app: build-time-only and',
  '          web/Node-only packages in that tree are listed too. devDependencies are not listed.',
  `Packages: ${sorted.length} unique name@version`,
  `Without a licence file in the package: ${withoutText.length} (licence named from package.json; listed at the end)`,
  `First-party workspace packages (not listed): ${[...firstParty].sort().join(', ') || 'none'}`,
  `npm ls problems reported: ${(tree.problems || []).length}`,
  '',
  'Licence summary (count  licence)',
  ...summary.map(([name, count]) => `${String(count).padStart(6)}  ${name}`),
  '',
  'Package index',
  ...sorted.map((p) => `  ${p.name}@${p.version}`),
  '',
];
const tail = [RULE, 'Packages without a licence file in the package root', RULE, ...(withoutText.length ? withoutText.map((x) => `  ${x}`) : ['  (none)']), ''];

const outPath = resolve(ROOT, args.out);
const body = `${head.join('\n')}\n${blocks.join('\n')}\n${tail.join('\n')}`;
try {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(`${outPath}.tmp`, body, 'utf8');
  renameSync(`${outPath}.tmp`, outPath);
} catch (error) {
  fail(`cannot write ${args.out}: ${error instanceof Error ? error.message : error}`);
}
process.stdout.write(
  `gen-npm-licenses: ${sorted.length} packages, ${withoutText.length} without licence file, ` +
    `${Buffer.byteLength(body)} bytes -> ${relative(ROOT, outPath).split(sep).join('/')}\n`,
);
