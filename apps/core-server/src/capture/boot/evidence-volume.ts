/**
 * THE PROBE OF THE EVIDENCE STORE (blueprint row 61 / M3-W5; register CS-22 "writable evidence
 * store", CS-09 "real volume figures"; capture spec §H; decisions D72(b), D85 R-5, D127).
 *
 * THE ONE FILE OF THE BOOT CHECKS THAT TOUCHES THE FILE SYSTEM (pinned by name in the allowlist of
 * static rule G-R2, SEC35-25). It returns FACTS; the rule is `evidenceStoreProblemOf` (`checks.ts`).
 *
 * WHAT IT DOES, in the directory the worker will write camera files to:
 *   1. creates the directory when it is not there (mode 0700, parents included);
 *   2. creates ONE new file EXCLUSIVELY, writes a few bytes, syncs it;
 *   3. tries to create the same name exclusively again - that MUST be refused;
 *   4. links a second name to the file (`link()`), and checks that both names are one file;
 *   5. tries to link onto the name that exists - that MUST be refused (the worker's "a final name
 *      that exists is never replaced" rests on exactly this, capture spec §C.5);
 *   6. removes both names, and reads the figures of the volume.
 *
 * This is the sequence of the worker's first fragment (`apps/capture-worker/src/sink.c`: exclusive
 * create of the `.part`, sync, `link()` to the final name), on the SAME volume, before any session.
 *
 * WHAT IT NEVER DOES: it opens no existing file for writing, removes nothing but the two names it
 * created itself in this call, follows no name it did not create, and reports no path: a failure
 * is a `false` in the facts, never a text of the operating system.
 *
 * The probe names are `.dems-boot-probe.<process id>.<counter>` and the same with `.link`: a
 * leading dot and a prefix no session folder (`SES-...`) can have.
 */
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, statSync, statfsSync, unlinkSync, writeSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { EvidenceVolumeFacts } from './checks';

const PROBE_PREFIX = '.dems-boot-probe.';
const PRIVATE_DIRECTORY = 0o700;
const PRIVATE_FILE = 0o600;
const PROBE_BYTES = 'dems evidence store probe\n';
/** How many names are tried when one is taken (a probe a killed server left behind is never removed: it is not this call's). */
const NAME_ATTEMPTS = 8;

let counter = 0;

const attempt = <Value>(work: () => Value): Value | null => {
  try {
    return work();
  } catch {
    return null;
  }
};

/** Probes `directory`. Never throws. */
export function probeEvidenceVolume(directory: string): EvidenceVolumeFacts {
  const serverUid = typeof process.getuid === 'function' ? process.getuid() : -1;
  const facts = {
    absolute: isAbsolute(directory) && !directory.includes('\0'),
    present: false,
    directory: false,
    ownerUid: null as number | null,
    mode: null as number | null,
    serverUid,
    exclusiveCreate: false,
    exclusiveRefusesSecond: false,
    synced: false,
    hardLink: false,
    linkRefusesExisting: false,
    cleaned: false,
    totalBytes: null as number | null,
    freeBytes: null as number | null,
  };
  if (!facts.absolute) return facts;

  // 1. The directory. `recursive` makes a directory that is there already no error.
  attempt(() => mkdirSync(directory, { recursive: true, mode: PRIVATE_DIRECTORY }));
  const status = attempt(() => statSync(directory));
  if (status === null) return facts;
  facts.present = true;
  facts.directory = status.isDirectory();
  facts.ownerUid = status.uid;
  facts.mode = status.mode & 0o7777;
  if (!facts.directory) return facts;

  const volume = attempt(() => statfsSync(directory));
  if (volume !== null) {
    facts.totalBytes = volume.blocks * volume.bsize;
    // What the server's user may use, not what root may.
    facts.freeBytes = volume.bavail * volume.bsize;
  }

  // 2. One new file, exclusively. `wx` is O_CREAT | O_EXCL | O_WRONLY: a name that exists is refused, never opened.
  let first: string | null = null;
  let descriptor: number | null = null;
  for (let tried = 0; tried < NAME_ATTEMPTS && descriptor === null; tried += 1) {
    counter += 1;
    const candidate = join(directory, `${PROBE_PREFIX}${process.pid}.${counter}`);
    descriptor = attempt(() => openSync(candidate, 'wx', PRIVATE_FILE));
    if (descriptor !== null) first = candidate;
  }
  if (first === null || descriptor === null) return facts;
  const created = first;
  const second = `${created}.link`;
  const written = attempt(() => writeSync(descriptor, PROBE_BYTES));
  facts.exclusiveCreate = written === PROBE_BYTES.length;
  facts.synced = attempt(() => (fsyncSync(descriptor), true)) === true;
  attempt(() => closeSync(descriptor));

  // 3. The same name, exclusively, again: refused on a volume that honours the flag.
  const again = attempt(() => openSync(created, 'wx', PRIVATE_FILE));
  if (again === null) facts.exclusiveRefusesSecond = true;
  else attempt(() => closeSync(again));

  // 4. A hard link: two names, one file.
  const linked = attempt(() => (linkSync(created, second), true)) === true;
  if (linked) {
    const one = attempt(() => lstatSync(created));
    const two = attempt(() => lstatSync(second));
    facts.hardLink = one !== null && two !== null && one.ino === two.ino && one.dev === two.dev && one.nlink === 2 && two.isFile();
    // 5. A link onto a name that exists: refused, the existing name is not replaced.
    facts.linkRefusesExisting = attempt(() => (linkSync(created, second), true)) === null;
  }

  // 6. Both names of THIS call are removed; nothing else is.
  const removedSecond = !linked || attempt(() => (unlinkSync(second), true)) === true;
  const removedFirst = attempt(() => (unlinkSync(created), true)) === true;
  facts.cleaned = removedFirst && removedSecond;
  return facts;
}
