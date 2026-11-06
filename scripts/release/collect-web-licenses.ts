/**
 * Licence collector for the web packages (security review F-62-02; step 95b, decision D124).
 *
 * Builds the content of `licenses/` that every web package carries next to THIRD_PARTY_NOTICES.md:
 *
 *   OFL-<Font>.txt               the SIL Open Font License text of each bundled font, copied
 *                                unchanged from node_modules/@fontsource-variable/<font>/LICENSE
 *   THIRD-PARTY-LICENSES.txt     the npm production dependency tree of @dems/core-web, one entry per
 *                                package@version: licence name (package.json) plus the text of every
 *                                LICENSE / LICENCE / COPYING / NOTICE file the package ships
 *
 * The tree comes from `npm ls --omit=dev --all --json -w @dems/core-web`. That is the set of packages
 * the bundler may draw from, so it is a superset of what ends up in the bundle (tree-shaken or
 * Node-only packages are listed too). Listing more licences than strictly needed is harmless.
 *
 * Node built-ins only. The output has no timestamp, so the same tree gives the same bytes.
 *
 * Standalone:  node --import tsx scripts/release/collect-web-licenses.ts --out <dir>
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKSPACE = '@dems/core-web';
const LICENSE_FILE = /^(licen[sc]e|copying|unlicense)([-._].*)?$/i;
const NOTICE_FILE = /^notice([-._].*)?$/i;
const RULE = '='.repeat(100);
const THIN = '-'.repeat(100);

export const FONT_LICENSES: Array<{ pkg: string; file: string; family: string }> = [
  { pkg: '@fontsource-variable/inter', file: 'OFL-Inter.txt', family: 'Inter' },
  { pkg: '@fontsource-variable/jetbrains-mono', file: 'OFL-JetBrains-Mono.txt', family: 'JetBrains Mono' },
  { pkg: '@fontsource-variable/orbitron', file: 'OFL-Orbitron.txt', family: 'Orbitron' },
];

interface LsNode {
  version?: string;
  resolved?: string;
  dependencies?: Record<string, LsNode>;
}

interface LsRoot extends LsNode {
  problems?: string[];
}

export interface CollectedPackage {
  name: string;
  version: string;
  license: string;
  dir: string;
  files: string[];
}

export interface CollectResult {
  /** Files written into the output directory (names only, sorted). */
  written: string[];
  /** Third-party packages listed in THIRD-PARTY-LICENSES.txt. */
  packages: number;
  /** Packages that ship at least one licence file. */
  withText: number;
  /** package@version of the packages that ship no licence file (licence name only). */
  withoutText: string[];
  /** Licence name -> package count, most common first. */
  byLicense: Array<[string, number]>;
  /** Tree nodes that could not be found on disk, or whose version differs (should be empty). */
  unresolved: string[];
  /** Optional peer dependencies that are not installed (empty npm ls nodes; informational). */
  notInstalled: string[];
  /** `problems` reported by npm ls (informational). */
  npmProblems: string[];
  sha256: Record<string, string>;
  bytes: Record<string, number>;
}

function sha256(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** Node resolution: look for `name` in `from`/node_modules, then in each parent directory up to the repo root. */
function findPackageDir(name: string, from: string): string | null {
  let dir = from;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dir === ROOT) return null;
    const parent = dirname(dir);
    if (parent === dir || !dir.startsWith(ROOT)) return null;
    dir = parent;
  }
}

function licenseName(pkg: Record<string, unknown>): string {
  const l = pkg.license;
  if (typeof l === 'string' && l.trim()) return l.trim();
  if (l && typeof l === 'object' && typeof (l as { type?: unknown }).type === 'string') return String((l as { type: string }).type);
  const legacy = pkg.licenses;
  if (Array.isArray(legacy)) {
    const names = legacy.map((x) => (x && typeof x === 'object' && typeof (x as { type?: unknown }).type === 'string' ? String((x as { type: string }).type) : '')).filter(Boolean);
    if (names.length) return names.join(' OR ');
  }
  return 'UNKNOWN (no licence field in package.json)';
}

function repositoryUrl(pkg: Record<string, unknown>): string {
  const r = pkg.repository;
  const raw = typeof r === 'string' ? r : r && typeof r === 'object' && typeof (r as { url?: unknown }).url === 'string' ? String((r as { url: string }).url) : '';
  if (raw) return raw.replace(/^git\+/, '').replace(/\.git$/, '');
  return typeof pkg.homepage === 'string' ? pkg.homepage : '';
}

function npmLs(): LsRoot {
  // npm exits 1 when it reports `problems` (for example an "invalid" peer range); the JSON is still complete.
  const res = spawnSync('npm', ['ls', '--omit=dev', '--all', '--json', '-w', WORKSPACE], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (!res.stdout) throw new Error(`npm ls produced no output (exit ${String(res.status)}): ${res.stderr ?? ''}`);
  try {
    return JSON.parse(res.stdout) as LsRoot;
  } catch (err) {
    throw new Error(`npm ls output is not JSON (exit ${String(res.status)}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Collects the font licence files and writes THIRD-PARTY-LICENSES.txt into `outDir`.
 * Throws when npm ls fails outright or a font licence file is missing (the packager fails closed).
 */
export function collectWebLicenses(outDir: string): CollectResult {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];

  for (const f of FONT_LICENSES) {
    const src = join(ROOT, 'node_modules', f.pkg, 'LICENSE');
    if (!existsSync(src)) throw new Error(`font licence missing: ${relative(ROOT, src)}`);
    if (!/SIL Open Font License/i.test(readFileSync(src, 'utf8'))) throw new Error(`${relative(ROOT, src)} is not an OFL text`);
    copyFileSync(src, join(outDir, f.file));
    written.push(f.file);
  }

  const tree = npmLs();
  const start = tree.dependencies?.[WORKSPACE];
  if (!start) throw new Error(`npm ls has no ${WORKSPACE} node`);
  const startDir = findPackageDir(WORKSPACE, ROOT);
  if (!startDir) throw new Error(`${WORKSPACE} not found under node_modules`);

  const found = new Map<string, CollectedPackage>();
  const unresolved: string[] = [];
  const notInstalled = new Set<string>();
  const visit = (node: LsNode, dir: string): void => {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      // npm ls prints an empty node for an optional peer dependency that is not installed: nothing to bundle.
      if (!child.version) {
        notInstalled.add(name);
        continue;
      }
      const childDir = findPackageDir(name, dir);
      if (!childDir) {
        unresolved.push(`${name}@${child.version} (not found from ${relative(ROOT, dir)})`);
        continue;
      }
      const pkg = JSON.parse(readFileSync(join(childDir, 'package.json'), 'utf8')) as Record<string, unknown>;
      const version = String(pkg.version ?? '');
      if (child.version !== version) unresolved.push(`${name}: npm ls says ${child.version}, ${relative(ROOT, childDir)} has ${version}`);
      const firstParty = name.startsWith('@dems/');
      const key = `${name}@${version}`;
      if (!firstParty && !found.has(key)) {
        const files = readdirSync(childDir, { withFileTypes: true })
          .filter((e) => e.isFile() && (LICENSE_FILE.test(e.name) || NOTICE_FILE.test(e.name)))
          .map((e) => e.name)
          .sort();
        found.set(key, { name, version, license: licenseName(pkg), dir: childDir, files });
      }
      visit(child, childDir);
    }
  };
  visit(start, startDir);

  const pkgs = [...found.values()].sort((a, b) => (a.name === b.name ? a.version.localeCompare(b.version, 'en', { numeric: true }) : a.name < b.name ? -1 : 1));
  const counts = new Map<string, number>();
  for (const p of pkgs) counts.set(p.license, (counts.get(p.license) ?? 0) + 1);
  const byLicense = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const hasText = (p: CollectedPackage) => p.files.some((f) => LICENSE_FILE.test(f));
  const withoutText = pkgs.filter((p) => !hasText(p)).map((p) => `${p.name}@${p.version}`);

  const out: string[] = [
    'DEMS Web Demo - third-party licences of the web console (npm packages)',
    '',
    `This file lists the production dependency tree of the web console (${WORKSPACE}) as reported by`,
    `"npm ls --omit=dev --all --json -w ${WORKSPACE}". The web bundle is built from these packages, so the`,
    'list is a superset of what the bundle contains (packages removed by tree-shaking, or used only at',
    'build time, are listed too). Each entry gives the licence named in the package\'s package.json and the',
    'text of every licence and notice file the package ships. Where a package ships no licence file, only',
    'the licence name is given.',
    '',
    'Not in this file: the fonts (OFL-*.txt next to this file), the Node.js runtime (NODE-LICENSE.txt,',
    'where the package carries Node.js), and the media, copied-in components and tools (THIRD_PARTY_NOTICES.md).',
    '',
    `Packages: ${pkgs.length} (${pkgs.length - withoutText.length} with a licence file, ${withoutText.length} with the licence name only)`,
    '',
    'Licences (packages):',
    ...byLicense.map(([l, n]) => `  ${String(n).padStart(4)}  ${l}`),
    '',
    'Index:',
    ...pkgs.map((p) => `  ${p.name}@${p.version}  -  ${p.license}${hasText(p) ? '' : '  (no licence file in the package)'}`),
    '',
  ];
  for (const p of pkgs) {
    const pkg = JSON.parse(readFileSync(join(p.dir, 'package.json'), 'utf8')) as Record<string, unknown>;
    const repo = repositoryUrl(pkg);
    out.push(RULE, `${p.name}@${p.version}`, `Licence: ${p.license}`);
    if (repo) out.push(`Source: ${repo}`);
    if (!p.files.length) out.push('Licence text: the package ships no licence file; the licence named above applies.');
    for (const f of p.files) {
      out.push(THIN, `${f}:`, '', readFileSync(join(p.dir, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, ''), '');
    }
    out.push('');
  }
  const main = 'THIRD-PARTY-LICENSES.txt';
  writeFileSync(join(outDir, main), `${out.join('\n')}\n`);
  written.push(main);
  written.sort();

  const hashes: Record<string, string> = {};
  const bytes: Record<string, number> = {};
  for (const f of written) {
    hashes[f] = sha256(join(outDir, f));
    bytes[f] = statSync(join(outDir, f)).size;
  }
  return { written, packages: pkgs.length, withText: pkgs.length - withoutText.length, withoutText, byLicense, unresolved, notInstalled: [...notInstalled].sort(), npmProblems: tree.problems ?? [], sha256: hashes, bytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const outDir = i >= 0 ? process.argv[i + 1] : undefined;
  if (!outDir) {
    process.stderr.write('usage: node --import tsx scripts/release/collect-web-licenses.ts --out <dir>\n');
    process.exit(2);
  }
  try {
    const r = collectWebLicenses(resolve(outDir));
    process.stdout.write(`${JSON.stringify(r, null, 1)}\n`);
    process.exit(r.unresolved.length ? 1 : 0);
  } catch (err) {
    process.stderr.write(`[collect-web-licenses] FAIL: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exit(1);
  }
}
