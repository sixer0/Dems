// One-command setup of the development helper program (task 3 blueprint row 136; decision D108;
// capture spec §A.1.2 row 9, §A.6.4 HL-2; SEC35-43 (a)).
//
//   npm run capture:dev-setup            copies the FFmpeg found on the PATH
//   npm run capture:dev-setup -- <path>  copies the FFmpeg at <path>
//
// WHY. In development capture (`DEMS_CAPTURE_MODE=real DEMS_CAPTURE_DEV_SOURCES=1`) the Core runs
// FFmpeg as the helper of the local camera, the local microphone and the test sources. It starts
// the program named by `DEMS_CAPTURE_HELPER_FFMPEG` and refuses, at boot, a program whose file or
// any directory on the way to it is writable by its group or by others, or is owned by anybody but
// root and the user of the server: such a program can be replaced by another local user, and it
// runs with this Mac's camera and microphone permission. A package manager's FFmpeg does not pass
// (`/opt/homebrew` and its `bin` are group-writable). There is NO development exception to the
// rule (decision D108): this script makes a private copy that passes it.
//
// WHAT IT DOES. Copies the program to `<repository>/.data/helpers/ffmpeg` (git-ignored), mode
// 0755 in a directory of mode 0700, runs `ffmpeg -version` from there, holds the path against the
// same rule the Core holds it to, and prints the path. No sudo. Nothing of the package manager is
// changed. Run it again after an FFmpeg upgrade: the copy is not updated by itself.
//
// LIMITATION, stated plainly. The copy is the PROGRAM FILE only. It still loads the shared
// libraries of the installation it was copied from (for Homebrew: under `/opt/homebrew`), which
// stay group-writable. The rule protects the file the Core starts, not what that file links to.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, realpathSync, renameSync, rmSync, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(REPOSITORY, '.data');
const HELPERS_DIR = join(DATA_DIR, 'helpers');
const TARGET = join(HELPERS_DIR, 'ffmpeg');
const GROUP_OR_OTHER_WRITE = 0o022;

function stop(message) {
  console.error(`capture:dev-setup: ${message}`);
  process.exit(1);
}

/** The FFmpeg to copy: the argument, or the first `ffmpeg` on the PATH. */
function findSource(argument) {
  if (argument !== undefined) {
    if (!isAbsolute(argument)) stop('the path of the FFmpeg to copy must be absolute.');
    if (!existsSync(argument)) stop('no file at the path that was given.');
    return argument;
  }
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    if (folder === '' || !isAbsolute(folder)) continue;
    const candidate = join(folder, 'ffmpeg');
    if (existsSync(candidate)) return candidate;
  }
  return stop('no ffmpeg on the PATH. Install FFmpeg first, or pass the absolute path of one: npm run capture:dev-setup -- /path/to/ffmpeg');
}

/** The rule of the Core (`apps/core-server/src/capture/adapters/local/helper-program.ts`), held here on the copy. */
function ruleProblem(path) {
  const uid = process.getuid();
  const trusted = (status) => status.uid === 0 || status.uid === uid;
  const file = statSync(path);
  if (!file.isFile()) return 'NOT_A_FILE';
  if (!trusted(file)) return 'FILE_OWNER';
  if ((file.mode & GROUP_OR_OTHER_WRITE) !== 0) return 'FILE_WRITABLE';
  if ((file.mode & 0o111) === 0) return 'NOT_EXECUTABLE';
  for (const start of new Set([dirname(path), dirname(realpathSync(path))])) {
    for (let folder = start; ; folder = dirname(folder)) {
      const status = statSync(folder);
      if (!trusted(status)) return `DIRECTORY_OWNER (${folder})`;
      if ((status.mode & GROUP_OR_OTHER_WRITE) !== 0) return `DIRECTORY_WRITABLE (${folder})`;
      if (dirname(folder) === folder) break;
    }
  }
  return null;
}

if (typeof process.getuid !== 'function') stop('this setup is for macOS and Linux.');
const source = realpathSync(findSource(process.argv[2]));
if (!statSync(source).isFile()) stop('the FFmpeg to copy is not a regular file.');

mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
mkdirSync(HELPERS_DIR, { recursive: true, mode: 0o700 });
chmodSync(HELPERS_DIR, 0o700);
// Written beside the target and moved over it: an earlier copy (which may be read-only) is replaced whole.
const fresh = `${TARGET}.new`;
rmSync(fresh, { force: true });
copyFileSync(source, fresh);
chmodSync(fresh, 0o755);
renameSync(fresh, TARGET);

let version;
try {
  version = execFileSync(TARGET, ['-version'], { encoding: 'utf8', env: {}, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 }).split('\n')[0];
} catch {
  stop(`the copy at ${TARGET} does not run (-version failed). The FFmpeg it was copied from may need files beside it that a copy does not bring.`);
}

const problem = ruleProblem(TARGET);
if (problem !== null) {
  stop(
    `the copy at ${TARGET} is refused by the helper-program rule: ${problem}. ` +
      'Every directory from the root to the repository must be owned by root or by you and must not be writable by group or others; this script changes no directory outside .data/helpers.',
  );
}

console.log(`copied  ${source}`);
console.log(`to      ${TARGET}  (mode 0755, directory 0700)`);
console.log(`runs    ${version}`);
console.log('rule    passes: owner and write bits of the file and of every directory on the way');
console.log('note    the copy still loads the shared libraries of the installation it was copied from');
console.log('');
console.log('Start the Core in development capture with:');
console.log(`  DEMS_CAPTURE_MODE=real DEMS_CAPTURE_DEV_SOURCES=1 DEMS_CAPTURE_HELPER_FFMPEG=${TARGET}`);
