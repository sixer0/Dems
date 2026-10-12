#!/usr/bin/env node
/**
 * The count-only secret scan (decisions D190 and D257 of the backend task; task 4 blueprint row 5,
 * security item S13-16 (3)).
 *
 * A log, a record or a script output passes this scan before it enters a commit (root ignore file,
 * the comment above `!docs/** /assets/*.log`). IT PRINTS COUNTS AND FILE NAMES, NEVER A MATCHED LINE
 * AND NEVER A VALUE. Any hit keeps the file out, by name.
 *
 * Until task 4 the scan was a scratch script written per run; its pattern needles are the first
 * four below (the report of the backend task's final commit lists them). Task 4 adds two:
 *   - camera-credential: a camera locator with a user part (scheme, account, password, host);
 *   - ingest-secret: the form of the ingest secret of RC-2, a loopback RTSP address whose path
 *     holds an element of 22 or more URL-safe characters (128 bits need 22 in base64url, 32 in
 *     hexadecimal). A path element that is exactly a UUID is not counted: that is a session ID.
 *
 * The value needles of the scratch scans (database passwords read from the local data folder, the
 * published demo password) are NOT here: this file reads nothing but the files it is asked to scan.
 *
 * Usage, from the repository root:
 *   node scripts/secret-scan/count-only.mjs <file or folder> [...]     scan these (folders are walked)
 *   node scripts/secret-scan/count-only.mjs --ext=.log <folder>        only files with this ending
 *   node scripts/secret-scan/count-only.mjs --tracked                  every file git tracks
 *   node scripts/secret-scan/count-only.mjs --staged                   every file staged for the next commit
 * Exit code: 0 no hit, 1 at least one hit, 2 wrong usage.
 */
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const PATH_CHARACTER = '[A-Za-z0-9._~-]';

/** The needles. Each `re` is global; `countIn` resets it. */
export const NEEDLES = Object.freeze([
  { id: 'session-token', re: /\bses_[A-Za-z0-9_-]{16,}/g },
  { id: 'device-credential', re: /\bdvc_[A-Za-z0-9_-]{16,}/g },
  { id: 'biometric-token', re: /\bbio_[A-Za-z0-9_-]{16,}/g },
  { id: 'database-locator', re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/g },
  // S13-16 (3), first needle: scheme://account:password@ of a camera's media or service address.
  { id: 'camera-credential', re: /\b(?:rtsps?|https?):\/\/[^\s/@:]+:[^\s/@]+@/g },
  // S13-16 (3), second needle: the ingest address with a long random path element (RC-2).
  { id: 'ingest-secret', re: new RegExp(`\\brtsp://127\\.0\\.0\\.1:\\d{2,5}/(?:${PATH_CHARACTER}+/)*(?!${UUID}(?!${PATH_CHARACTER}))[A-Za-z0-9_-]{22,}`, 'g') },
]);

/** Files larger than this are not read; they are counted as skipped. */
export const SIZE_LIMIT_BYTES = 64 * 1024 * 1024;

/** Folders that are never walked: other people's code, git's own files, and the reference program's data. */
const NEVER_WALKED = ['.git', 'node_modules', join('apps', 'input-av', 'data')];

/** The number of matches of every needle in a text: `{ id: count }`, every needle present. */
export function countIn(text) {
  const counts = {};
  for (const needle of NEEDLES) {
    needle.re.lastIndex = 0;
    counts[needle.id] = (text.match(needle.re) ?? []).length;
  }
  return counts;
}

function isNeverWalked(path, root) {
  const inside = relative(root, path);
  return NEVER_WALKED.some((name) => inside === name || inside.endsWith(`${sep}${name}`) || inside.split(sep).includes(name));
}

/** Every regular file under the given paths (links are not followed). */
function filesUnder(paths, root, ending) {
  const out = [];
  const visit = (path, named) => {
    if (isNeverWalked(path, root)) return;
    let facts;
    try {
      facts = lstatSync(path);
    } catch {
      out.push({ path, unreadable: true });
      return;
    }
    if (facts.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name), false);
    } else if (facts.isFile() && (named || ending === null || path.endsWith(ending))) {
      out.push({ path, size: facts.size });
    }
  };
  for (const path of paths) visit(resolve(root, path), true);
  return out;
}

function gitList(root, args) {
  const answer = spawnSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (answer.status !== 0) return null;
  return answer.stdout.split('\0').filter((name) => name !== '');
}

/** Scans the files and returns totals. Reads each file as bytes, so a value inside a binary file is counted too. */
export function scan(files) {
  const totals = Object.fromEntries(NEEDLES.map((needle) => [needle.id, 0]));
  const withHits = [];
  let scanned = 0;
  let skipped = 0;
  for (const file of files) {
    if (file.unreadable === true || file.size > SIZE_LIMIT_BYTES) {
      skipped += 1;
      continue;
    }
    let text;
    try {
      text = readFileSync(file.path, 'latin1');
    } catch {
      skipped += 1;
      continue;
    }
    scanned += 1;
    const counts = countIn(text);
    const hits = Object.entries(counts).filter(([, count]) => count > 0);
    for (const [id, count] of hits) totals[id] += count;
    if (hits.length > 0) withHits.push({ path: file.path, hits });
  }
  return { scanned, skipped, totals, withHits };
}

function main(argv) {
  const root = process.cwd();
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const paths = argv.filter((arg) => !arg.startsWith('--'));
  const ending = flags.find((flag) => flag.startsWith('--ext='))?.slice('--ext='.length) ?? null;
  const known = flags.every((flag) => flag === '--tracked' || flag === '--staged' || flag.startsWith('--ext='));
  const fromGit = flags.includes('--tracked') ? ['ls-files', '-z'] : flags.includes('--staged') ? ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'] : null;
  if (!known || (fromGit === null && paths.length === 0) || (fromGit !== null && paths.length > 0)) {
    console.error('usage: count-only.mjs [--ext=<ending>] <file or folder> [...] | --tracked | --staged');
    return 2;
  }
  let files;
  if (fromGit === null) {
    files = filesUnder(paths, root, ending);
  } else {
    const names = gitList(root, fromGit);
    if (names === null) {
      console.error('count-only.mjs: the file list could not be read from git');
      return 2;
    }
    files = filesUnder(names.filter((name) => ending === null || name.endsWith(ending)), root, null);
  }
  const result = scan(files);
  const sum = Object.values(result.totals).reduce((all, count) => all + count, 0);
  console.log(`scanned ${result.scanned} file(s); skipped ${result.skipped} (not readable or above ${SIZE_LIMIT_BYTES} bytes)`);
  for (const needle of NEEDLES) console.log(`${needle.id}: ${result.totals[needle.id]}`);
  for (const file of result.withHits) console.log(`HIT ${relative(root, file.path)}: ${file.hits.map(([id, count]) => `${id}=${count}`).join(', ')}`);
  console.log(`TOTAL: ${sum} in ${result.withHits.length} file(s)`);
  return sum === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
