/**
 * Web packager (masterplan/06_packaging_spec.md §3.2, §3.6, §3.7, §4; blueprint step 95).
 *
 * Run from the repo root:  node --import tsx scripts/release/build-web-packages.ts [options]
 *
 *   --skip-gate         skip the typecheck/lint/test gate (it was run separately)
 *   --skip-web-build    reuse .cache/release/web-dist (no vite build)
 *   --skip-smoke        skip the macOS arm64 extract + --self-test + start/stop smoke
 *   --gate-only         run preflight + gate and stop
 *   --verify-inputs     build nothing: compare the build inputs in the tree with
 *                       release/web/BUILD-INPUTS.txt (exit 1 on any difference)
 *
 * Node built-ins plus system tar, unzip, zip, ditto, codesign and git only. No npm install, no
 * package.json edit (P1). Node binaries come only from https://nodejs.org/dist/v26.8.2/ and are
 * verified against SHASUMS256.txt, failing closed on any mismatch. gpg is not available on the
 * build host, so the signature of SHASUMS256.txt itself is not checked (recorded in BUILD-INFO).
 *
 * Step 95b (D124, security review step 62): every package carries licenses/ with the current
 * THIRD_PARTY_NOTICES.md, the OFL texts of the bundled fonts and THIRD-PARTY-LICENSES.txt
 * (collect-web-licenses.ts); the any-OS sh scripts clear NODE_OPTIONS before any node call; and
 * BUILD-INFO records the git status and a fingerprint of the build inputs.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statfsSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packagedCsp } from '../../apps/core-web/src/lib/packaged-csp.ts';
import { collectWebLicenses } from './collect-web-licenses.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERSION = '0.1.0';
const NODE_VERSION = 'v26.8.2';
const NODE_DIST = `https://nodejs.org/dist/${NODE_VERSION}`;
const CACHE = join(ROOT, '.cache', 'release');
const NODE_CACHE = join(CACHE, `node-${NODE_VERSION}`);
const WEB_DIST = join(CACHE, 'web-dist');
const MANIFEST = join(CACHE, 'web-manifest.json');
const STAGE = join(CACHE, 'stage');
const RELEASE = join(ROOT, 'release');
const RELEASE_WEB = join(RELEASE, 'web');
const LAUNCHER = join(ROOT, 'apps', 'mock-core', 'standalone', 'dems-web-launcher.cjs');
const NOTICES = join(ROOT, 'THIRD_PARTY_NOTICES.md');
const LICENSES = join(CACHE, 'licenses');
const SELF = fileURLToPath(import.meta.url);
const COLLECTOR = join(ROOT, 'scripts', 'release', 'collect-web-licenses.ts');
const TASK_DOCS = join(ROOT, 'docs', '2026-09-30_dems_demo_stack_setup');
const FUSE_ON = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2:1';
const MARKER = `DEMS_WEB_LAUNCHER_BUILD=${VERSION}`;
const INPUT_STEPS: Array<{ step: string; file: string }> = [
  { step: '100 (web Core origin + CSP)', file: 'implementation/73_web_core_origin.md' },
  { step: '54 (sim gap closure, web)', file: 'implementation/33_sim_gap_closure_web.md' },
];

const args = new Set(process.argv.slice(2));
const started = new Date();
const log = (msg: string) => process.stdout.write(`[build-web-packages] ${msg}\n`);
const info: string[] = [];
const record = (line: string) => info.push(line);

function fail(msg: string): never {
  process.stderr.write(`[build-web-packages] FAIL: ${msg}\n`);
  process.exit(1);
}

function sha256File(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

function run(cmd: string, argv: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  const res = spawnSync(cmd, argv, { cwd: opts.cwd ?? ROOT, env: opts.env ?? process.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (res.status !== 0) {
    fail(`${cmd} ${argv.join(' ')} exited ${String(res.status)}\n${res.stdout ?? ''}\n${res.stderr ?? ''}`);
  }
  return `${res.stdout ?? ''}${res.stderr ?? ''}`;
}

function wib(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${t.toISOString().replace('T', ' ').slice(0, 19)} WIB`;
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.DS_Store') continue;
    const abs = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) out.push(...walk(abs, base));
    else if (e.isFile()) out.push(relative(base, abs).split('\\').join('/'));
  }
  return out.sort();
}

const launcherModule = createRequire(import.meta.url)(LAUNCHER) as { mimeFor: (p: string) => string; cspHeader: (port: number) => string };

// -------------------------------------------------------------------------------------------
// 1. Preflight
// -------------------------------------------------------------------------------------------
function preflight(): { head: string; dirty: number; status: string } {
  if (process.version !== NODE_VERSION) fail(`builder Node is ${process.version}, need ${NODE_VERSION} (SEA blob format)`);
  const ignored = spawnSync('git', ['check-ignore', '-q', 'release/probe'], { cwd: ROOT });
  if (ignored.status !== 0) fail('release/ is not git-ignored (needs-review; .gitignore belongs to step 100)');
  const fsStat = statfsSync(ROOT);
  const freeGb = (fsStat.bavail * fsStat.bsize) / 1024 ** 3;
  if (freeGb < 3) fail(`only ${freeGb.toFixed(1)} GB free`);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const dirty = status.split('\n').filter(Boolean).length;
  log(`preflight OK: node ${process.version}, HEAD ${head}, dirty ${dirty}, free ${freeGb.toFixed(0)} GB`);
  return { head, dirty, status };
}

// -------------------------------------------------------------------------------------------
// 1b. Provenance (F-62-08): git status and a fingerprint of the build inputs
// -------------------------------------------------------------------------------------------
/** The trees and files the packages are built from (a superset: tests under src/ are included). */
const INPUT_ROOTS: string[] = [
  'apps/core-web/src',
  'apps/core-web/public',
  'apps/core-web/index.html',
  'apps/core-web/vite.config.ts',
  'apps/core-web/package.json',
  'packages/shared/src',
  'packages/shared/assets',
  'packages/shared/theme',
  'packages/shared/openapi',
  'packages/shared/package.json',
  'apps/mock-core/standalone/dems-web-launcher.cjs',
  'scripts/release/build-web-packages.ts',
  'scripts/release/collect-web-licenses.ts',
  'THIRD_PARTY_NOTICES.md',
  'package.json',
  'package-lock.json',
];

interface Fingerprint {
  digest: string;
  files: number;
  bytes: number;
  hashes: Map<string, string>;
  roots: Array<{ root: string; files: number; bytes: number; newest: string; newestMs: number }>;
}

function fingerprint(): Fingerprint {
  const hashes = new Map<string, string>();
  const roots: Fingerprint['roots'] = [];
  let bytes = 0;
  for (const root of INPUT_ROOTS) {
    const abs = join(ROOT, root);
    if (!existsSync(abs)) fail(`build input missing: ${root}`);
    const list = statSync(abs).isDirectory() ? walk(abs).map((f) => `${root}/${f}`) : [root];
    let rootBytes = 0;
    let newest = '';
    let newestMs = 0;
    for (const f of list) {
      const st = statSync(join(ROOT, f));
      hashes.set(f, sha256File(join(ROOT, f)));
      rootBytes += st.size;
      if (st.mtimeMs > newestMs) {
        newestMs = st.mtimeMs;
        newest = f;
      }
    }
    bytes += rootBytes;
    roots.push({ root, files: list.length, bytes: rootBytes, newest, newestMs });
  }
  const listing = fingerprintListing(hashes);
  return { digest: createHash('sha256').update(listing).digest('hex'), files: hashes.size, bytes, hashes, roots };
}

/** `shasum -a 256` format, sorted by path. Its SHA-256 is the "build inputs" digest in BUILD-INFO. */
function fingerprintListing(hashes: Map<string, string>): string {
  return [...hashes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([f, h]) => `${h}  ${f}\n`).join('');
}

const INPUTS_FILE = 'BUILD-INPUTS.txt';

/** `--verify-inputs`: has any build input changed (or appeared, or gone) since the packages were built? */
function verifyInputs(): never {
  const path = join(RELEASE_WEB, INPUTS_FILE);
  if (!existsSync(path)) fail(`${rel(path)} missing: build the packages first`);
  const built = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (m) built.set(m[2]!, m[1]!);
  }
  const now = fingerprint();
  const changed = [...built.keys()].filter((f) => now.hashes.has(f) && now.hashes.get(f) !== built.get(f)).sort();
  const gone = [...built.keys()].filter((f) => !now.hashes.has(f)).sort();
  const added = [...now.hashes.keys()].filter((f) => !built.has(f)).sort();
  log(`build inputs at build time: ${built.size} files, digest ${sha256File(path)}`);
  log(`build inputs now:           ${now.files} files, digest ${now.digest}`);
  for (const f of changed) log(`  changed: ${f}`);
  for (const f of gone) log(`  removed: ${f}`);
  for (const f of added) log(`  added:   ${f}`);
  const same = !changed.length && !gone.length && !added.length;
  log(same ? 'OK: no build input changed since the packages were built' : `DIFFERENT: ${changed.length} changed, ${gone.length} removed, ${added.length} added`);
  process.exit(same ? 0 : 1);
}

function gitStatusSummary(status: string): string[] {
  const lines = status.split('\n').filter(Boolean);
  const byCode = new Map<string, number>();
  const byArea = new Map<string, number>();
  for (const l of lines) {
    const code = l.slice(0, 2).trim() || '?';
    byCode.set(code, (byCode.get(code) ?? 0) + 1);
    const path = l.slice(3).replace(/^"/, '');
    const parts = path.split('/');
    const area = parts.length > 1 && (parts[0] === 'apps' || parts[0] === 'packages' || parts[0] === 'docs' || parts[0] === 'scripts') ? `${parts[0]}/${parts[1]}` : (parts[0] ?? path);
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  const fmt = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k} ${n}`).join(', ');
  const inputs = lines.filter((l) => {
    const path = l.slice(3).replace(/^"/, '').replace(/"$/, '');
    return INPUT_ROOTS.some((r) => path === r || path.startsWith(`${r}/`) || r.startsWith(path));
  });
  return [
    `git status --porcelain: ${lines.length} paths, sha256 ${createHash('sha256').update(status).digest('hex')} (of the raw output at build start)`,
    `  by status code: ${fmt(byCode)}`,
    `  by area: ${fmt(byArea)}`,
    `  entries that touch a build input (${inputs.length}):`,
    ...inputs.map((l) => `    ${l}`),
  ];
}

// -------------------------------------------------------------------------------------------
// 2. Gate
// -------------------------------------------------------------------------------------------
function gate(): void {
  log('gate: core-web typecheck, lint, vitest (--maxWorkers=2); mock-core typecheck + launcher tests');
  run('npm', ['run', 'typecheck', '-w', '@dems/core-web']);
  run('npm', ['run', 'lint', '-w', '@dems/core-web']);
  const t = run('node', ['../../node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2'], { cwd: join(ROOT, 'apps', 'core-web') });
  const summary = t.split('\n').filter((l) => /Test Files|Tests\s/.test(l)).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim());
  record(`gate core-web vitest: ${summary.join(' | ')}`);
  run('npm', ['run', 'typecheck', '-w', '@dems/mock-core']);
  run('node', ['../../node_modules/typescript/bin/tsc', '-p', 'standalone/tsconfig.json'], { cwd: join(ROOT, 'apps', 'mock-core') });
  const l = run('node', ['../../node_modules/vitest/vitest.mjs', 'run', 'test/standalone-launcher.test.ts', '--maxWorkers=2'], { cwd: join(ROOT, 'apps', 'mock-core') });
  const ls = l.split('\n').filter((x) => /Test Files|Tests\s/.test(x)).map((x) => x.replace(/\x1b\[[0-9;]*m/g, '').trim());
  record(`gate launcher tests: ${ls.join(' | ')}`);
  log('gate OK');
}

// -------------------------------------------------------------------------------------------
// 3. Web build + 4. manifest
// -------------------------------------------------------------------------------------------
function buildWeb(): void {
  log('vite build with VITE_DEMS_CORE_ORIGIN=same-origin');
  run('node', ['../../node_modules/vite/bin/vite.js', 'build', '--outDir', WEB_DIST, '--emptyOutDir'], {
    cwd: join(ROOT, 'apps', 'core-web'),
    env: { ...process.env, VITE_DEMS_CORE_ORIGIN: 'same-origin' },
  });
}

function checkDist(): { files: string[]; bytes: number; hosts: string[] } {
  if (!existsSync(join(WEB_DIST, 'index.html'))) fail('web-dist/index.html missing');
  const files = walk(WEB_DIST);
  const maps = files.filter((f) => f.endsWith('.map'));
  if (maps.length) fail(`source maps in dist: ${maps.slice(0, 5).join(', ')}`);
  const html = readFileSync(join(WEB_DIST, 'index.html'), 'utf8');
  const metaRaw = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
  const meta = metaRaw?.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  if (meta !== packagedCsp({ delivery: 'meta' })) fail(`index.html CSP meta tag missing or different from packagedCsp({delivery:'meta'}): ${String(meta)}`);
  if (launcherModule.cspHeader(4410) !== packagedCsp({ delivery: 'header', port: 4410 })) fail('launcher CSP header differs from packagedCsp({delivery:"header"})');
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1] ?? '');
  const inline = scripts.filter((attrs) => !/\bsrc=/.test(attrs));
  if (inline.length) fail(`index.html has ${inline.length} inline <script> (blocked by script-src 'self')`);
  const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '');
  const external = refs.filter((r) => /^(https?:)?\/\//.test(r));
  if (external.length) fail(`index.html references external URLs: ${external.join(', ')}`);
  const scriptSrcs = scripts.map((a) => /\bsrc="([^"]+)"/.exec(a)?.[1] ?? '');
  if (scriptSrcs.some((s) => !s.startsWith('/assets/'))) fail(`index.html script outside /assets/: ${scriptSrcs.join(', ')}`);
  let bytes = 0;
  const hosts = new Set<string>();
  for (const f of files) {
    const p = join(WEB_DIST, f);
    bytes += statSync(p).size;
    if (/\.(js|css|html)$/.test(f)) {
      for (const m of readFileSync(p, 'utf8').matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|127\.0\.0\.1|localhost)(:\d+)?/g)) {
        hosts.add(`${m[1]}${m[2] ?? ''}`);
      }
    }
  }
  const mb = bytes / 1e6;
  record(`dist: ${files.length} files, ${bytes} B (${mb.toFixed(1)} MB); H-PK-13 range 36-45 MB: ${mb >= 36 && mb <= 45 ? 'inside' : 'OUTSIDE'}`);
  record(`index.html: CSP meta == packagedCsp({delivery:'meta'}); launcher header == packagedCsp({delivery:'header'}); inline <script>: 0; script src: ${scriptSrcs.join(', ')}; refs: ${refs.join(', ')}`);
  log(`dist OK: ${files.length} files, ${mb.toFixed(1)} MB`);
  return { files, bytes, hosts: [...hosts].sort() };
}

function writeManifest(files: string[]): string {
  const entries: Record<string, { size: number; sha256: string; type: string }> = {};
  for (const f of files) {
    const p = join(WEB_DIST, f);
    entries[f] = { size: statSync(p).size, sha256: sha256File(p), type: launcherModule.mimeFor(f) };
  }
  writeFileSync(MANIFEST, `${JSON.stringify({ version: 1, product: 'DEMS Web Demo', release: VERSION, files: entries }, null, 1)}\n`);
  const h = sha256File(MANIFEST);
  record(`web-manifest.json sha256: ${h}`);
  return h;
}

// -------------------------------------------------------------------------------------------
// 5. Node binaries (official, verified, fail closed)
// -------------------------------------------------------------------------------------------
const ARCHIVES = {
  'darwin-arm64': `node-${NODE_VERSION}-darwin-arm64.tar.gz`,
  'darwin-x64': `node-${NODE_VERSION}-darwin-x64.tar.gz`,
  'linux-x64': `node-${NODE_VERSION}-linux-x64.tar.gz`,
  'win-x64': `node-${NODE_VERSION}-win-x64.zip`,
} as const;
type Plat = keyof typeof ARCHIVES;

async function download(url: string, dest: string): Promise<void> {
  if (!url.startsWith(`${NODE_DIST}/`)) fail(`refusing non-nodejs.org URL ${url}`);
  log(`download ${url}`);
  const res = await fetch(url);
  if (!res.ok) fail(`GET ${url} -> ${res.status}`);
  writeFileSync(`${dest}.part`, Buffer.from(await res.arrayBuffer()));
  execFileSync('mv', [`${dest}.part`, dest]);
}

async function nodeBinaries(): Promise<Record<Plat, { bin: string; license: string }>> {
  mkdirSync(NODE_CACHE, { recursive: true });
  const sumsPath = join(NODE_CACHE, 'SHASUMS256.txt');
  if (!existsSync(sumsPath)) await download(`${NODE_DIST}/SHASUMS256.txt`, sumsPath);
  const sums = new Map<string, string>();
  for (const line of readFileSync(sumsPath, 'utf8').split('\n')) {
    const m = /^([0-9a-f]{64})\s+(\S+)$/.exec(line.trim());
    if (m) sums.set(m[2]!, m[1]!);
  }
  record(`SHASUMS256.txt: ${NODE_DIST}/SHASUMS256.txt sha256 ${sha256File(sumsPath)} (GPG signature NOT verified: gpg absent on build host)`);
  const out = {} as Record<Plat, { bin: string; license: string }>;
  for (const [plat, file] of Object.entries(ARCHIVES) as Array<[Plat, string]>) {
    const archive = join(NODE_CACHE, file);
    if (!existsSync(archive)) await download(`${NODE_DIST}/${file}`, archive);
    const want = sums.get(file);
    const got = sha256File(archive);
    if (!want || want !== got) fail(`checksum mismatch for ${file}: SHASUMS ${String(want)} vs file ${got}`);
    record(`archive ${file}: ${got} == SHASUMS256 line (OK)`);
    const dir = join(NODE_CACHE, `extract-${plat}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const top = file.replace(/\.(tar\.gz|zip)$/, '');
    if (plat === 'win-x64') {
      run('unzip', ['-q', '-o', archive, `${top}/node.exe`, `${top}/LICENSE`, '-d', dir]);
      const bin = join(dir, top, 'node.exe');
      const exeWant = sums.get('win-x64/node.exe');
      const exeGot = sha256File(bin);
      if (exeWant !== exeGot) fail(`node.exe from the zip ${exeGot} != SHASUMS win-x64/node.exe ${String(exeWant)}`);
      record(`win-x64 node.exe extracted: ${exeGot} == SHASUMS256 win-x64/node.exe (OK)`);
      out[plat] = { bin, license: join(dir, top, 'LICENSE') };
    } else {
      run('tar', ['-xzf', archive, '-C', dir, `${top}/bin/node`, `${top}/LICENSE`]);
      const bin = join(dir, top, 'bin', 'node');
      record(`${plat} bin/node extracted: ${sha256File(bin)}`);
      out[plat] = { bin, license: join(dir, top, 'LICENSE') };
    }
  }
  log('node binaries verified');
  return out;
}

// -------------------------------------------------------------------------------------------
// 6. SEA targets
// -------------------------------------------------------------------------------------------
interface SeaTarget {
  id: 'macos-arm64' | 'windows-x64' | 'linux-x64';
  plat: Plat;
  exe: string;
}
const SEA_TARGETS: SeaTarget[] = [
  { id: 'macos-arm64', plat: 'darwin-arm64', exe: 'DEMS Web Demo' },
  { id: 'windows-x64', plat: 'win-x64', exe: 'DEMS Web Demo.exe' },
  { id: 'linux-x64', plat: 'linux-x64', exe: 'dems-web-demo' },
];

function buildSea(t: SeaTarget, base: string, files: string[]): string {
  const dir = join(CACHE, 'sea', t.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const baseNode = join(dir, t.plat === 'win-x64' ? 'base-node.exe' : 'base-node');
  copyFileSync(base, baseNode);
  chmodSync(baseNode, 0o755);
  if (t.id === 'macos-arm64') run('codesign', ['--remove-signature', baseNode]);
  const output = join(dir, t.exe);
  const assets: Record<string, string> = { 'web-manifest.json': MANIFEST };
  for (const f of files) assets[`web/${f}`] = join(WEB_DIST, f);
  const config = {
    main: LAUNCHER,
    mainFormat: 'commonjs',
    executable: baseNode,
    output,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    execArgvExtension: 'none',
    assets,
  };
  const configPath = join(dir, 'sea-config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 1));
  log(`SEA ${t.id}: node --build-sea`);
  run(process.execPath, ['--build-sea', configPath], { cwd: dir });
  if (!existsSync(output)) fail(`SEA output missing for ${t.id}`);
  chmodSync(output, 0o755);
  if (t.id === 'macos-arm64') {
    run('codesign', ['--sign', '-', '--force', output]);
    const v = run('codesign', ['--verify', '--strict', '--verbose=2', output]);
    record(`codesign --verify --strict ${t.exe}: ${v.trim().split('\n').join(' / ')}`);
    const dv = run('codesign', ['-dv', output]);
    record(`codesign -dv ${t.exe}: ${dv.split('\n').filter((l) => /^(Identifier|Format|CodeDirectory|Signature|TeamIdentifier)/.test(l)).join(' / ')}`);
  }
  const buf = readFileSync(output);
  const fuse = buf.indexOf(FUSE_ON) >= 0;
  const marker = buf.indexOf(MARKER) >= 0;
  if (!fuse || !marker) fail(`SEA proof failed for ${t.id}: fuse=${fuse} marker=${marker}`);
  const fileType = run('file', ['-b', output]).trim();
  record(`SEA ${t.id}: ${t.exe} ${buf.length} B, sha256 ${sha256File(output)}; fuse :1 present; marker present; file: ${fileType}`);
  const relConfig = JSON.stringify({ ...config, main: rel(config.main), executable: rel(config.executable), output: rel(config.output), assets: `{ web-manifest.json + ${files.length} web/* files from .cache/release/web-dist }` });
  record(`sea-config ${t.id}: ${relConfig}`);
  return output;
}

function rel(p: string): string {
  return relative(ROOT, p);
}

// -------------------------------------------------------------------------------------------
// 7.-9. Staging
// -------------------------------------------------------------------------------------------
function readmeFirst(kind: 'sea-win' | 'sea-mac' | 'sea-linux' | 'mac-x64' | 'win-runtime' | 'any-os'): string {
  const start: Record<typeof kind, [string, string]> = {
    'sea-win': ['Double-click "DEMS Web Demo.exe". If "Windows protected your PC" appears: More info -> Run anyway.', 'Klik dua kali "DEMS Web Demo.exe". Jika muncul "Windows protected your PC": More info -> Run anyway.'],
    'sea-mac': ['Double-click "DEMS Web Demo". If macOS blocks it: System Settings > Privacy & Security > Open Anyway.', 'Klik dua kali "DEMS Web Demo". Jika diblokir: System Settings > Privacy & Security > Open Anyway.'],
    'sea-linux': ['In a terminal: ./dems-web-demo', 'Di terminal: ./dems-web-demo'],
    'mac-x64': ['Double-click "DEMS Web Demo (Intel).command". If macOS blocks it: System Settings > Privacy & Security > Open Anyway.', 'Klik dua kali "DEMS Web Demo (Intel).command". Jika diblokir: System Settings > Privacy & Security > Open Anyway.'],
    'win-runtime': ['Double-click "Start DEMS Web Demo.cmd" (uses the official signed node.exe; for Smart App Control).', 'Klik dua kali "Start DEMS Web Demo.cmd" (memakai node.exe resmi bertanda tangan).'],
    'any-os': ['Needs Node.js 22 or newer. Windows: "Start (Windows).cmd". macOS: "Start (macOS).command". Linux: ./start-linux.sh', 'Perlu Node.js 22 atau lebih baru. Windows: "Start (Windows).cmd". macOS: "Start (macOS).command". Linux: ./start-linux.sh'],
  };
  const [en, id] = start[kind];
  return [
    `DEMS Web Demo ${VERSION} - DEMO with simulated data. Works offline. Sends nothing anywhere.`,
    '',
    `1. ${en}`,
    '2. A console window shows the address; the browser opens http://127.0.0.1:4410/ (or 4411-4419).',
    '3. Use Chrome or Edge. Sign in with a demo operator (password: demo-2026).',
    '4. Keep the console window open while presenting. To stop: Ctrl+C or close the window.',
    'Problems? Run it with --self-test from a terminal. Full guide: RUN-ON-ANOTHER-PC.md (in this folder).',
    '',
    `DEMS Web Demo ${VERSION} - DEMO dengan data simulasi. Berjalan offline. Tidak mengirim data ke mana pun.`,
    '',
    `1. ${id}`,
    '2. Jendela konsol menampilkan alamat; browser membuka http://127.0.0.1:4410/ (atau 4411-4419).',
    '3. Gunakan Chrome atau Edge. Masuk dengan operator demo (kata sandi: demo-2026).',
    '4. Biarkan jendela konsol terbuka selama presentasi. Untuk berhenti: Ctrl+C atau tutup jendela.',
    'Panduan lengkap: RUN-ON-ANOTHER-PC.md (di folder ini).',
    '',
  ].join('\r\n');
}

/** Files every package carries in licenses/ besides NODE-LICENSE.txt (filled by collectLicenses). */
let licenseFiles: string[] = [];

function collectLicenses(): void {
  rmSync(LICENSES, { recursive: true, force: true });
  let r: ReturnType<typeof collectWebLicenses>;
  try {
    r = collectWebLicenses(LICENSES);
  } catch (err) {
    fail(`licence collection failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (r.unresolved.length) fail(`licence collection: ${r.unresolved.length} unresolved packages: ${r.unresolved.slice(0, 5).join('; ')}`);
  licenseFiles = r.written;
  record(`THIRD_PARTY_NOTICES.md: sha256 ${sha256File(NOTICES)}, ${statSync(NOTICES).size} B, mtime ${wib(statSync(NOTICES).mtime)} (copied into licenses/ of every package)`);
  record(`licenses/THIRD-PARTY-LICENSES.txt: ${r.packages} npm packages (production tree of @dems/core-web; ${r.withText} with a licence file, ${r.withoutText.length} with the licence name only), ${r.bytes['THIRD-PARTY-LICENSES.txt']} B, sha256 ${r.sha256['THIRD-PARTY-LICENSES.txt']}`);
  record(`  licences: ${r.byLicense.map(([l, n]) => `${l} ${n}`).join(', ')}`);
  record(`  licence name only (no licence file in the package): ${r.withoutText.join(', ') || 'none'}`);
  record(`  npm ls problems (informational): ${r.npmProblems.join('; ') || 'none'}; optional peers not installed: ${r.notInstalled.length}`);
  for (const f of r.written.filter((x) => x.startsWith('OFL-'))) record(`licenses/${f}: ${r.bytes[f]} B, sha256 ${r.sha256[f]} (copied unchanged from node_modules/@fontsource-variable/*/LICENSE)`);
  log(`licences OK: ${r.packages} packages, ${r.written.length} files`);
}

function addLicenses(dir: string, nodeLicense: string | null): void {
  mkdirSync(join(dir, 'licenses'), { recursive: true });
  if (nodeLicense) copyFileSync(nodeLicense, join(dir, 'licenses', 'NODE-LICENSE.txt'));
  copyFileSync(NOTICES, join(dir, 'licenses', 'THIRD_PARTY_NOTICES.md'));
  if (!licenseFiles.length) fail('addLicenses called before collectLicenses');
  for (const f of licenseFiles) copyFileSync(join(LICENSES, f), join(dir, 'licenses', f));
}

function addApp(dir: string): void {
  const app = join(dir, 'app');
  mkdirSync(app, { recursive: true });
  copyFileSync(LAUNCHER, join(app, 'dems-web-launcher.cjs'));
  copyFileSync(MANIFEST, join(app, 'web-manifest.json'));
  cpSync(WEB_DIST, join(app, 'web'), { recursive: true });
}

function writeScript(p: string, lines: string[], crlf: boolean, exec: boolean): void {
  writeFileSync(p, lines.join(crlf ? '\r\n' : '\n') + (crlf ? '\r\n' : '\n'));
  if (exec) chmodSync(p, 0o755);
}

function touchAll(dir: string): void {
  const t = started;
  const visit = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) visit(p);
      utimesSync(p, t, t);
    }
  };
  visit(dir);
  utimesSync(dir, t, t);
}

interface Pkg {
  file: string;
  top: string;
  role: string;
  arch: 'zip' | 'tgz';
}

const GUIDE_NAME = 'RUN-ON-ANOTHER-PC.md';

function archive(top: string, file: string, kind: 'zip' | 'tgz'): void {
  const out = join(RELEASE_WEB, file);
  rmSync(out, { force: true });
  touchAll(join(STAGE, top));
  if (kind === 'zip') run('zip', ['-r', '-X', '-q', out, top, '-x', '*.DS_Store'], { cwd: STAGE });
  else run('tar', ['--no-mac-metadata', '--no-xattrs', '-czf', out, top], { cwd: STAGE, env: { ...process.env, COPYFILE_DISABLE: '1' } });
}

function stagePackages(sea: Record<SeaTarget['id'], string>, bins: Record<Plat, { bin: string; license: string }>): Pkg[] {
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });
  mkdirSync(RELEASE_WEB, { recursive: true });
  const pkgs: Pkg[] = [];

  // Primary SEA packages.
  const seaPkgs: Array<{ id: SeaTarget['id']; top: string; file: string; exe: string; kind: Parameters<typeof readmeFirst>[0]; plat: Plat; arch: 'zip' | 'tgz' }> = [
    { id: 'windows-x64', top: `DEMS-Web-Demo-${VERSION}-windows-x64`, file: `DEMS-Web-Demo-${VERSION}-windows-x64.zip`, exe: 'DEMS Web Demo.exe', kind: 'sea-win', plat: 'win-x64', arch: 'zip' },
    { id: 'macos-arm64', top: `DEMS-Web-Demo-${VERSION}-macos-arm64`, file: `DEMS-Web-Demo-${VERSION}-macos-arm64.zip`, exe: 'DEMS Web Demo', kind: 'sea-mac', plat: 'darwin-arm64', arch: 'zip' },
    { id: 'linux-x64', top: `dems-web-demo-${VERSION}-linux-x64`, file: `DEMS-Web-Demo-${VERSION}-linux-x64.tar.gz`, exe: 'dems-web-demo', kind: 'sea-linux', plat: 'linux-x64', arch: 'tgz' },
  ];
  for (const p of seaPkgs) {
    const dir = join(STAGE, p.top);
    mkdirSync(dir, { recursive: true });
    copyFileSync(sea[p.id], join(dir, p.exe));
    chmodSync(join(dir, p.exe), 0o755);
    writeFileSync(join(dir, 'README-FIRST.txt'), readmeFirst(p.kind));
    addLicenses(dir, bins[p.plat].license);
    pkgs.push({ file: p.file, top: p.top, role: `primary, SEA (${p.id})`, arch: p.arch });
  }

  // macOS x64 runtime bundle (official notarized node, unmodified).
  {
    const top = `DEMS-Web-Demo-${VERSION}-macos-x64`;
    const dir = join(STAGE, top);
    mkdirSync(join(dir, 'runtime'), { recursive: true });
    copyFileSync(bins['darwin-x64'].bin, join(dir, 'runtime', 'node'));
    chmodSync(join(dir, 'runtime', 'node'), 0o755);
    if (sha256File(join(dir, 'runtime', 'node')) !== sha256File(bins['darwin-x64'].bin)) fail('macos-x64 runtime/node differs from the official binary');
    addApp(dir);
    writeScript(join(dir, 'DEMS Web Demo (Intel).command'), ['#!/bin/sh', 'cd "$(dirname "$0")" || exit 1', 'exec env -u NODE_OPTIONS ./runtime/node app/dems-web-launcher.cjs "$@"'], false, true);
    writeFileSync(join(dir, 'README-FIRST.txt'), readmeFirst('mac-x64'));
    addLicenses(dir, bins['darwin-x64'].license);
    const file = `DEMS-Web-Demo-${VERSION}-macos-x64.zip`;
    pkgs.push({ file, top, role: 'primary, runtime bundle (macOS Intel)', arch: 'zip' });
  }

  // F1: Windows signed-runtime fallback (official Authenticode-signed node.exe, unmodified).
  {
    const top = `DEMS-Web-Demo-${VERSION}-windows-x64-signed-runtime`;
    const dir = join(STAGE, top);
    mkdirSync(join(dir, 'runtime'), { recursive: true });
    copyFileSync(bins['win-x64'].bin, join(dir, 'runtime', 'node.exe'));
    addApp(dir);
    writeScript(
      join(dir, 'Start DEMS Web Demo.cmd'),
      ['@echo off', 'cd /d "%~dp0"', 'set "NODE_OPTIONS="', '"runtime\\node.exe" "app\\dems-web-launcher.cjs" %*', 'if errorlevel 1 pause'],
      true,
      false,
    );
    writeFileSync(join(dir, 'README-FIRST.txt'), readmeFirst('win-runtime'));
    addLicenses(dir, bins['win-x64'].license);
    const file = `DEMS-Web-Demo-${VERSION}-windows-x64-signed-runtime.zip`;
    pkgs.push({ file, top, role: 'fallback F1 (Smart App Control / antivirus)', arch: 'zip' });
  }

  // F2: any-OS zip (needs Node >= 22 on the target).
  {
    const top = `DEMS-Web-Demo-${VERSION}-any-os-node`;
    const dir = join(STAGE, top);
    mkdirSync(dir, { recursive: true });
    addApp(dir);
    writeScript(
      join(dir, 'Start (Windows).cmd'),
      [
        '@echo off',
        'cd /d "%~dp0"',
        'set "NODE_OPTIONS="',
        'where node >nul 2>nul || (echo Node.js 22 or newer is required: https://nodejs.org & echo Perlu Node.js 22 atau lebih baru. & pause & exit /b 1)',
        'node -e "process.exit(Number(process.versions.node.split(\'.\')[0])>=22?0:1)" || (echo Node.js 22 or newer is required. & echo Perlu Node.js 22 atau lebih baru. & pause & exit /b 1)',
        'node "app\\dems-web-launcher.cjs" %*',
        'if errorlevel 1 pause',
      ],
      true,
      false,
    );
    const shBody = [
      '#!/bin/sh',
      'cd "$(dirname "$0")" || exit 1',
      // F-62-05: cleared before the version check below, which is itself a node process.
      'unset NODE_OPTIONS',
      'if ! command -v node >/dev/null 2>&1; then echo "Node.js 22 or newer is required (https://nodejs.org). / Perlu Node.js 22 atau lebih baru."; exit 1; fi',
      'if ! node -e "process.exit(Number(process.versions.node.split(\'.\')[0])>=22?0:1)"; then echo "Node.js 22 or newer is required. Found $(node --version). / Perlu Node.js 22 atau lebih baru."; exit 1; fi',
      'exec env -u NODE_OPTIONS node app/dems-web-launcher.cjs "$@"',
    ];
    writeScript(join(dir, 'Start (macOS).command'), shBody, false, true);
    writeScript(join(dir, 'start-linux.sh'), shBody, false, true);
    writeFileSync(join(dir, 'README-FIRST.txt'), readmeFirst('any-os'));
    addLicenses(dir, null);
    const file = `DEMS-Web-Demo-${VERSION}-any-os-node.zip`;
    pkgs.push({ file, top, role: 'fallback F2 (any OS with Node >= 22)', arch: 'zip' });
  }
  return pkgs;
}

// -------------------------------------------------------------------------------------------
// 11. Checksums + BUILD-INFO
// -------------------------------------------------------------------------------------------
function checksums(pkgs: Pkg[]): Array<Pkg & { sha256: string; size: number }> {
  const rows = pkgs.map((p) => ({ ...p, sha256: sha256File(join(RELEASE_WEB, p.file)), size: statSync(join(RELEASE_WEB, p.file)).size }));
  writeFileSync(join(RELEASE_WEB, 'SHA256SUMS.txt'), rows.map((r) => `${r.sha256}  ${r.file}\n`).join(''));
  for (const r of rows) writeFileSync(join(RELEASE_WEB, `${r.file}.sha256`), `${r.sha256}  ${r.file}\n`);
  return rows;
}

/**
 * Archives every staged package with RUN-ON-ANOTHER-PC.md inside it (F96-2). The guide lists the
 * package sizes, and the packages contain the guide, so the archives are written again until the
 * sizes the guide states are the sizes of the archives that carry it (two passes in practice).
 */
function archiveWithGuide(pkgs: Pkg[]): string {
  let sizes: Map<string, number> | null = null;
  for (let pass = 1; pass <= 4; pass++) {
    const md = guideText(sizes);
    for (const p of pkgs) {
      writeFileSync(join(STAGE, p.top, GUIDE_NAME), md);
      archive(p.top, p.file, p.arch);
    }
    const next = new Map(pkgs.map((p) => [p.file, statSync(join(RELEASE_WEB, p.file)).size]));
    if (guideText(next) === md) {
      record(`${GUIDE_NAME}: inside every package (top folder), sha256 ${createHash('sha256').update(md).digest('hex')}; sizes settled after ${pass} archive pass(es)`);
      log(`archives OK (${pass} passes)`);
      return md;
    }
    sizes = next;
  }
  fail(`${GUIDE_NAME}: the package sizes did not settle after 4 archive passes`);
}

/** Reads the guide and every licence file back out of each finished archive and compares them with their sources. */
function verifyArchiveDocs(pkgs: Pkg[], guide: string): void {
  const guideSha = createHash('sha256').update(guide).digest('hex');
  const want = new Map<string, string>([['THIRD_PARTY_NOTICES.md', sha256File(NOTICES)]]);
  for (const f of licenseFiles) want.set(f, sha256File(join(LICENSES, f)));
  for (const p of pkgs) {
    const out = join(RELEASE_WEB, p.file);
    const zip = p.file.endsWith('.zip');
    const listing = (zip ? run('unzip', ['-Z1', out]) : run('tar', ['-tzf', out])).split('\n');
    const hasNode = listing.includes(`${p.top}/licenses/NODE-LICENSE.txt`);
    const expectNode = !p.file.includes('any-os-node');
    if (hasNode !== expectNode) fail(`${p.file}: NODE-LICENSE.txt ${hasNode ? 'present' : 'missing'}, expected ${expectNode ? 'present' : 'absent'}`);
    for (const [f, h] of want) {
      const entry = `${p.top}/licenses/${f}`;
      const res = zip ? spawnSync('unzip', ['-p', out, entry], { maxBuffer: 64 * 1024 * 1024 }) : spawnSync('tar', ['-xzOf', out, entry], { maxBuffer: 64 * 1024 * 1024 });
      if (res.status !== 0) fail(`${p.file}: cannot read ${entry}`);
      const got = createHash('sha256').update(res.stdout).digest('hex');
      if (got !== h) fail(`${p.file}: ${entry} is ${got}, expected ${h}`);
    }
    const g = `${p.top}/${GUIDE_NAME}`;
    const gres = zip ? spawnSync('unzip', ['-p', out, g], { maxBuffer: 64 * 1024 * 1024 }) : spawnSync('tar', ['-xzOf', out, g], { maxBuffer: 64 * 1024 * 1024 });
    if (gres.status !== 0 || createHash('sha256').update(gres.stdout).digest('hex') !== guideSha) fail(`${p.file}: ${g} missing or different from the generated guide`);
  }
  record(`${GUIDE_NAME} read back from all ${pkgs.length} archives: byte-equal to release/${GUIDE_NAME}`);
  record(`licenses/ read back from all ${pkgs.length} archives: THIRD_PARTY_NOTICES.md + ${licenseFiles.join(' + ')} byte-equal to their sources; NODE-LICENSE.txt in the 5 packages that carry Node.js`);
}

// -------------------------------------------------------------------------------------------
// 12. Smoke (macOS arm64 from a copy outside the workspace)
// -------------------------------------------------------------------------------------------
async function smoke(): Promise<void> {
  const dir = join(process.env.TMPDIR ?? tmpdir(), `dems-web-smoke-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  run('ditto', ['-x', '-k', join(RELEASE_WEB, `DEMS-Web-Demo-${VERSION}-macos-arm64.zip`), dir]);
  const exe = join(dir, `DEMS-Web-Demo-${VERSION}-macos-arm64`, 'DEMS Web Demo');
  if (!(statSync(exe).mode & 0o111)) fail('exec bit lost after ditto -x -k');
  const st = spawnSync(exe, ['--self-test'], { encoding: 'utf8', timeout: 60000 });
  record(`smoke --self-test (macOS arm64 SEA, copy in ${dir}): exit ${String(st.status)}; ${(st.stdout ?? '').replace(/\s+/g, ' ').slice(0, 600)}`);
  if (st.status !== 0) fail(`self-test failed: ${st.stdout} ${st.stderr}`);
  const ver = spawnSync(exe, ['--version'], { encoding: 'utf8' });
  record(`smoke --version: ${(ver.stdout ?? '').trim()}`);
  log(`smoke self-test OK (${dir})`);
}

// -------------------------------------------------------------------------------------------
// 13. RUN-ON-ANOTHER-PC.md
// -------------------------------------------------------------------------------------------
function mb(n: number): string {
  return `${(n / 1e6).toFixed(0)} MB`;
}

function guideText(sizes: Map<string, number> | null): string {
  const size = (suffix: string) => {
    const hit = sizes ? [...sizes.entries()].find(([file]) => file.endsWith(suffix)) : undefined;
    return hit ? mb(hit[1]) : '?';
  };
  const v = VERSION;
  const apk = join(RELEASE, 'android', `DEMS-Demo-${v}.apk`);
  const apkSize = existsSync(apk) ? mb(statSync(apk).size) : 'see `android/`';
  const md = `# DEMS Demo ${v} - run it on another PC

## 1. What this is

A **DEMO with simulated data**. It works offline and sends nothing anywhere. The web console runs locally: a small program serves the app to your own browser at \`http://127.0.0.1:4410/\`. Nothing is installed, and other computers on the network cannot connect.

## 2. Which file do I need?

| Computer | File | Size | How to tell |
|---|---|---|---|
| Windows 10/11 (64-bit) | \`web/DEMS-Web-Demo-${v}-windows-x64.zip\` | ${size('windows-x64.zip')} | Settings > System > About shows "64-bit operating system" |
| Mac with Apple chip | \`web/DEMS-Web-Demo-${v}-macos-arm64.zip\` | ${size('macos-arm64.zip')} | Apple menu > About This Mac shows "Chip: Apple M..." |
| Mac with Intel | \`web/DEMS-Web-Demo-${v}-macos-x64.zip\` | ${size('macos-x64.zip')} | About This Mac shows "Processor: Intel..." |
| Linux (64-bit, glibc 2.28+) | \`web/DEMS-Web-Demo-${v}-linux-x64.tar.gz\` | ${size('linux-x64.tar.gz')} | \`uname -m\` prints \`x86_64\` |
| Android tablet or phone | \`android/DEMS-Demo-${v}.apk\` | ${apkSize} | Full steps: \`android/INSTALL-ANDROID.md\` |

Fallbacks (only if the main file does not work, see §10):

| When | File | Size |
|---|---|---|
| Windows blocks the app ("Smart App Control", antivirus) | \`web/DEMS-Web-Demo-${v}-windows-x64-signed-runtime.zip\` | ${size('signed-runtime.zip')} |
| Any computer that already has Node.js 22 or newer | \`web/DEMS-Web-Demo-${v}-any-os-node.zip\` | ${size('any-os-node.zip')} |

The any-OS zip has no program of its own: it uses the Node.js already on the computer. Extract it, then start **Start (Windows).cmd** (Windows, double-click), **Start (macOS).command** (macOS, double-click) or \`./start-linux.sh\` (Linux, in a terminal).

Copy only the file for your computer. Every package also holds a copy of this guide.

## 3. Before demo day

- Copy the file by **USB stick or a local network share**, not by cloud upload or chat (confidentiality). A USB copy usually avoids the security prompts below.
- **Test once on the target machine the day before.**
- Android in Indonesia: Android now asks for a verified developer for tap-installs on certified devices (from 30 Sep 2026). **Install with ADB from a laptop** (no waiting), or finish the one-time 24-hour "advanced flow" on the device **at least one day before**. See §8 and \`android/INSTALL-ANDROID.md\`.

## 4. Windows

1. Right-click the zip > **Extract All** > Extract.
2. Open the extracted folder and double-click **DEMS Web Demo.exe**.
3. If "Windows protected your PC" appears: click **More info**, then **Run anyway**. (Or before extracting: right-click the zip > Properties > tick **Unblock** > OK, then extract again.)
4. A black window shows the address, and the browser opens the demo.
5. To stop: press **Ctrl+C** in the black window, or close it.
6. If Windows says "**This app has been blocked for your protection**" (Smart App Control) or the antivirus removes the exe: use \`DEMS-Web-Demo-${v}-windows-x64-signed-runtime.zip\` and double-click **Start DEMS Web Demo.cmd**. It runs the official, signed Node.js program.

## 5. macOS (Apple chip)

1. Double-click the zip, open the folder, and double-click **DEMS Web Demo**. A Terminal window opens.
2. If macOS says it cannot verify the app: click **Done**, open **System Settings > Privacy & Security**, scroll down, click **Open Anyway**, then **Open** and enter your password if asked. macOS remembers the choice.
3. Or, once, in Terminal: \`xattr -dr com.apple.quarantine ~/Downloads/DEMS-Web-Demo-${v}-macos-arm64\` (adjust the folder path), then double-click again.
4. To stop: press **Ctrl+C** in the Terminal window, or close it.

## 6. macOS (Intel)

The same as §5, but double-click **DEMS Web Demo (Intel).command** in \`DEMS-Web-Demo-${v}-macos-x64\`. It uses the official notarized Node.js in \`runtime/\`. If it is blocked, use **Open Anyway** as in §5 step 2, or \`xattr -dr com.apple.quarantine <folder>\`.

## 7. Linux

\`\`\`sh
tar xzf DEMS-Web-Demo-${v}-linux-x64.tar.gz
cd dems-web-demo-${v}-linux-x64
./dems-web-demo
\`\`\`

Needs glibc 2.28 or later (Ubuntu 20.04+, Debian 10+, RHEL 8+). Start it from a terminal; file managers may not run programs on double-click. Stop with Ctrl+C.

## 8. Android (tablet or phone)

The APK is \`android/DEMS-Demo-${v}.apk\`; the full guide is \`android/INSTALL-ANDROID.md\`. In short:

- **Method A, recommended (works in Indonesia after 30 Sep 2026 with no waiting period): ADB from a laptop.**
  1. On the device: Settings > About tablet > tap **Build number** seven times; then Developer options > **USB debugging** on.
  2. Connect USB and accept **Allow USB debugging?**.
  3. On the laptop (Google's SDK Platform-Tools, downloaded from developer.android.com): \`adb devices\` must show \`device\`, then \`adb install -r DEMS-Demo-${v}.apk\`.
  4. If it fails with \`INSTALL_FAILED_UPDATE_INCOMPATIBLE\`, run \`adb uninstall com.dems.demo.tablet\` first (this removes the old build's demo data).
  5. Afterwards: unplug the cable, turn **USB debugging** off again in Developer options, and tap **Revoke USB debugging authorisations**. The app does not need USB debugging to run.
- **Method B, tap-install (no laptop):** copy the APK to the device and open it in Files; allow **Install unknown apps** for Files. On a certified device in Indonesia, a DEMO-signed app counts as from an *unverified developer*: do the one-time **advanced flow** (Developer options > Apps from unverified developers; confirm, restart, wait 24 hours, confirm with PIN or fingerprint, choose 7 days) **at least one day before**, then **Install anyway**.
- If Play Protect offers to send the app for scanning, choose the option that installs **without** sending it.
- In the app, leave **Core link = Simulated** (default). It works offline and in airplane mode. The tablet and the web console run separate simulators.

## 9. Using the web demo

- Use **Chrome or Edge**. Safari and Firefox are not verified.
- The address is \`http://127.0.0.1:4410/\`. If 4410 is busy it may be 4411-4419; the window always shows the real address.
- Sign in with a demo operator: \`budi.santoso\`, \`andi.pratama\` or \`rina.wijaya\`, password \`demo-2026\`. Presentation mode hides the operator list.
- Each run on a different port starts with fresh demo data (the browser keeps data per address).
- Leave the console window open while presenting. While it runs, the Login page shows **Core link: Online**.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Browser did not open | Copy the address from the console window into Chrome or Edge |
| Login shows **Core link: Offline** and Sign In is disabled | The console window was closed. Start the program again |
| Window closes at once (Windows) | Use \`Start DEMS Web Demo.cmd\` from the signed-runtime zip; it pauses on errors so you can read them |
| "This app has been blocked for your protection" / antivirus quarantine | Use the signed-runtime zip (§4 step 6) |
| Port in use | Close other copies. Starting a second copy just opens the first one in the browser |
| Page blank or odd in Safari | Use Chrome or Edge |
| Anything else | Run it from a terminal with \`--self-test\` (for example \`"./DEMS Web Demo" --self-test\` or \`"DEMS Web Demo.exe" --self-test\`). It prints a JSON report; \`"ok": true\` means the files, the health check and the heartbeat all work |

## 11. Verify the files (optional)

Each folder has \`SHA256SUMS.txt\`, and every package has a \`.sha256\` file.

| OS | Command |
|---|---|
| macOS | \`cd web && shasum -a 256 -c SHA256SUMS.txt\` |
| Linux | \`cd web && sha256sum -c SHA256SUMS.txt\` |
| Windows | \`certutil -hashfile <file> SHA256\`, or PowerShell \`Get-FileHash <file> -Algorithm SHA256\`; compare with the \`.sha256\` file by eye |

## Ringkasan (Bahasa Indonesia)

- Ini **DEMO dengan data simulasi**: berjalan offline dan tidak mengirim data ke mana pun.
- Pilih file sesuai komputer: Windows \`web/DEMS-Web-Demo-${v}-windows-x64.zip\`, Mac Apple chip \`...-macos-arm64.zip\`, Mac Intel \`...-macos-x64.zip\`, Linux \`...-linux-x64.tar.gz\`, Android \`android/DEMS-Demo-${v}.apk\`.
- Salin lewat **USB atau jaringan lokal**, jangan unggah ke cloud. Uji sekali sehari sebelum demo.
- Windows: Extract All, klik dua kali **DEMS Web Demo.exe**; jika muncul "Windows protected your PC" pilih **More info > Run anyway**. Jika diblokir Smart App Control/antivirus, pakai \`...-windows-x64-signed-runtime.zip\` > **Start DEMS Web Demo.cmd**.
- macOS: klik dua kali **DEMS Web Demo** (Intel: **DEMS Web Demo (Intel).command**); jika diblokir buka **System Settings > Privacy & Security > Open Anyway**.
- Linux: \`./dems-web-demo\` dari terminal.
- Cadangan untuk komputer yang sudah punya Node.js 22 atau lebih baru: \`...-any-os-node.zip\`, lalu jalankan **Start (Windows).cmd**, **Start (macOS).command**, atau \`./start-linux.sh\`.
- Buka di Chrome atau Edge: \`http://127.0.0.1:4410/\` (atau 4411-4419, lihat jendela konsol). Masuk dengan operator demo, kata sandi \`demo-2026\`.
- Untuk berhenti: tekan **Ctrl+C** atau tutup jendela konsol. Jangan tutup jendela selama presentasi. Selama berjalan, halaman Login menampilkan **Core link: Online**.
- Android: pasang lewat **ADB dari laptop** (\`adb install -r DEMS-Demo-${v}.apk\`, tanpa masa tunggu), atau selesaikan "advanced flow" 24 jam di perangkat **sehari sebelumnya**. Setelah terpasang lewat ADB, **matikan lagi USB debugging** di perangkat. Biarkan Core link pada **Simulated**. Panduan lengkap: \`android/INSTALL-ANDROID.md\`.
- Masalah? Jalankan dengan \`--self-test\` dari terminal; \`"ok": true\` berarti semua berfungsi.
`;
  return md;
}

/** Writes release/RUN-ON-ANOTHER-PC.md only when its text changes. */
function writeGuide(md: string): boolean {
  const guide = join(RELEASE, GUIDE_NAME);
  if (existsSync(guide) && readFileSync(guide, 'utf8') === md) return false;
  writeFileSync(guide, md);
  return true;
}

// -------------------------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------------------------
async function main(): Promise<void> {
  if (args.has('--verify-inputs')) verifyInputs();
  const { head, dirty, status } = preflight();
  const before = fingerprint();
  log(`build inputs: ${before.files} files, digest ${before.digest}`);
  const inputs = INPUT_STEPS.map((s) => ({ ...s, present: existsSync(join(TASK_DOCS, s.file)) }));
  for (const i of inputs) log(`input step ${i.step}: ${i.present ? 'present' : 'NOT YET IN'} (${i.file})`);
  if (!args.has('--skip-gate')) gate();
  else record('gate: skipped in this invocation (run separately; see the step log)');
  if (args.has('--gate-only')) return;
  if (!args.has('--skip-web-build')) buildWeb();
  else record('web build: reused .cache/release/web-dist (--skip-web-build)');
  const dist = checkDist();
  const manifestSha = writeManifest(dist.files);
  collectLicenses();
  const bins = await nodeBinaries();
  const sea = {} as Record<SeaTarget['id'], string>;
  for (const t of SEA_TARGETS) sea[t.id] = buildSea(t, bins[t.plat].bin, dist.files);
  const pkgs = stagePackages(sea, bins);
  const guide = archiveWithGuide(pkgs);
  const guideRewritten = writeGuide(guide);
  verifyArchiveDocs(pkgs, guide);
  const rows = checksums(pkgs);
  record(`release/${GUIDE_NAME}: ${guideRewritten ? 'rewritten (its text changed)' : 'unchanged (same text; it names files and sizes, not hashes)'}`);
  if (!args.has('--skip-smoke')) await smoke();
  const after = fingerprint();
  const changed = [...new Set([...before.hashes.keys(), ...after.hashes.keys()])].filter((f) => before.hashes.get(f) !== after.hashes.get(f)).sort();
  if (changed.length) log(`WARNING: ${changed.length} build input(s) changed during the build: ${changed.slice(0, 10).join(', ')}`);
  const newestMs = Math.max(...after.roots.map((r) => r.newestMs));
  writeFileSync(join(RELEASE_WEB, INPUTS_FILE), fingerprintListing(after.hashes));
  const finished = new Date();
  const asOf = 'step 92/93 default (no --as-of override for this build; dates align on any demo day per D84/F-50)';
  const buildInfo = [
    `DEMS Web Demo ${VERSION} - BUILD-INFO (web)`,
    `build start: ${wib(started)}  (${started.toISOString()})`,
    `build end:   ${wib(finished)}  (${finished.toISOString()})`,
    `git HEAD: ${head}  (working tree: ${dirty} changed/untracked paths; packages built from the working tree)`,
    `rebuild: step 95b (D124) - closes security review step 62 findings F-62-01, F-62-02, F-62-03, F-62-05, F-62-08 and package verification step 96 findings F96-1 (assetsInlineLimit 0, D127), F96-2, F96-3, F96-4; replaces the step 95 build of 2026-10-01 10:43 WIB`,
    `builder: node ${process.version} ${process.platform}-${process.arch}`,
    `web build: VITE_DEMS_CORE_ORIGIN=same-origin node ../../node_modules/vite/bin/vite.js build --outDir .cache/release/web-dist --emptyOutDir (cwd apps/core-web)`,
    `launcher: apps/mock-core/standalone/dems-web-launcher.cjs sha256 ${sha256File(LAUNCHER)}`,
    `web-manifest.json sha256: ${manifestSha}`,
    `demo data --as-of: ${asOf}`,
    'input steps:',
    ...inputs.map((i) => `  - step ${i.step}: ${i.present ? 'in' : 'NOT YET IN at build time'} (${i.file})`),
    '',
    'packages:',
    ...rows.map((r) => `  ${r.file}  ${r.size} B  sha256 ${r.sha256}  [${r.role}]`),
    '',
    'provenance and checks:',
    ...info.map((l) => `  ${l}`),
    '',
    'source provenance (F-62-08):',
    ...gitStatusSummary(status).map((l) => `  ${l}`),
    `  packager: scripts/release/build-web-packages.ts sha256 ${sha256File(SELF)}, mtime ${wib(statSync(SELF).mtime)}`,
    `  licence collector: scripts/release/collect-web-licenses.ts sha256 ${sha256File(COLLECTOR)}, mtime ${wib(statSync(COLLECTOR).mtime)}`,
    `  build inputs: ${after.files} files, ${after.bytes} B; digest sha256 ${after.digest}`,
    `    (digest = sha256 of release/web/${INPUTS_FILE}, which lists every input file with its sha256; check later from the repo root with`,
    `     "shasum -a 256 -c release/web/${INPUTS_FILE}" or "node --import tsx scripts/release/build-web-packages.ts --verify-inputs", which also reports added files)`,
    `  inputs at build start vs build end: ${changed.length ? `CHANGED DURING THE BUILD (${changed.length}): ${changed.join(', ')}; digest at start ${before.digest}` : 'identical (same digest; no input changed during the build)'}`,
    `  newest input mtime: ${wib(new Date(newestMs))}; build start ${wib(started)}: ${newestMs <= started.getTime() ? 'every input is older than the build start' : 'AN INPUT IS NEWER THAN THE BUILD START'}`,
    '  input roots (files, bytes, newest file and its mtime):',
    ...after.roots.map((r) => `    ${r.root}: ${r.files} files, ${r.bytes} B, newest ${r.newest} ${wib(new Date(r.newestMs))}`),
    '',
    'https?:// host strings in built JS/CSS/HTML (informational; licence/comment/doc URLs expected; runtime evidence is authoritative):',
    `  ${dist.hosts.join(', ')}`,
    '',
  ].join('\n');
  // Absolute build-host paths (they carry the user name) are reduced to repo-relative ones.
  writeFileSync(join(RELEASE_WEB, 'BUILD-INFO.txt'), buildInfo.split(`${ROOT}/`).join('').split(ROOT).join('.'));
  log('done');
  for (const r of rows) log(`${r.file}  ${r.size} B  ${r.sha256}`);
}

main().catch((err: unknown) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
