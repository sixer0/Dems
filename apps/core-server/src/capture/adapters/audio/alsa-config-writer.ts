/**
 * The writer of the shared-capture configuration (task 4 row 65, WP-08): the ONE file of the
 * sound configuration that touches the file system, admitted to the pinned lists of static rule
 * G-R2 by decision text SR-1, entry 2, FOR WRITING UNDER THE CORE'S RUN DIRECTORY ONLY.
 *
 * It writes ONE file, `<runDir>/alsa/dems-alsa.conf`, whose path is built by `alsaConfigPath`
 * from the run directory and two literals; a writer is bound to one run directory and refuses
 * any other path. No value of a sound card is part of a path (AD-07).
 *
 * ATOMIC, OWNER ONLY. The directory is made with mode 0700 and must then be a directory (not a
 * link), owned by the Core's account and closed to group and others. The text goes to a
 * staging name beside the target, created exclusively with mode 0600 (a leftover or a link at
 * that name is removed first and never followed), is forced to the disk, and is renamed onto the
 * target: a helper that opens the configuration sees the old text or the new one, never a part.
 *
 * It reads no file, starts no process and does not log (the capture folder logs in one place):
 * a failure is raised as `AlsaConfigWriteError`, which carries a short code and no path.
 *
 * NOT PROVEN ON THIS HOST: the directory on the target's file system and under the service
 * account (`9A/H-08`). The tests write below the system's temporary directory.
 */
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { alsaConfigPath, type AlsaConfigWriter } from './alsa-config';

export const ALSA_CONFIG_WRITE_FAILED = 'ALSA_CONFIG_WRITE_FAILED';

export const AlsaConfigWriteRefusal = {
  /** A path that is not the one file of this writer's run directory. */
  PATH: 'PATH',
  /** The directory is a link, another account's, or open to group or others. */
  DIRECTORY: 'DIRECTORY',
  /** A text that is empty or beyond the bound. */
  TEXT: 'TEXT',
} as const;

/** The configuration could not be written. Fixed text; `reason` is a refusal of the list above or the system's short code such as `EACCES`. */
export class AlsaConfigWriteError extends Error {
  readonly code: typeof ALSA_CONFIG_WRITE_FAILED = ALSA_CONFIG_WRITE_FAILED;
  readonly reason: string;
  constructor(reason: string) {
    super('the shared-capture configuration could not be written');
    this.name = 'AlsaConfigWriteError';
    this.reason = reason;
  }
}

const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;
const GROUP_OR_OTHERS = 0o077;
/** 32 cards of about 300 characters each fit many times; a longer text is not this unit's. */
export const ALSA_CONFIG_TEXT_MAX = 65_536;

function reasonOf(error: unknown): string {
  if (error instanceof AlsaConfigWriteError) return error.reason;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code) ? code : 'UNKNOWN';
}

/** The writer of one run directory. `account` is the numeric user the directory must belong to (the Core's own; a test states it). */
export function createAlsaConfigWriter(runDir: string, account: number | null = typeof process.getuid === 'function' ? process.getuid() : null): AlsaConfigWriter {
  const target = alsaConfigPath(runDir);
  const directory = target.slice(0, target.lastIndexOf('/'));
  const staging = `${directory}/dems-alsa.tmp`;

  return Object.freeze({
    async replace(path: string, text: string): Promise<void> {
      if (path !== target) throw new AlsaConfigWriteError(AlsaConfigWriteRefusal.PATH);
      if (typeof text !== 'string' || text.length === 0 || text.length > ALSA_CONFIG_TEXT_MAX) throw new AlsaConfigWriteError(AlsaConfigWriteRefusal.TEXT);
      // Nothing is removed below a directory that has not passed the check.
      let trusted = false;
      try {
        await mkdir(directory, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
        const facts = await lstat(directory);
        if (!facts.isDirectory() || (account !== null && facts.uid !== account) || (facts.mode & GROUP_OR_OTHERS) !== 0) throw new AlsaConfigWriteError(AlsaConfigWriteRefusal.DIRECTORY);
        trusted = true;
        await rm(staging, { force: true });
        const handle = await open(staging, 'wx', OWNER_ONLY_FILE);
        try {
          await handle.writeFile(text, 'utf8');
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(staging, target);
      } catch (error) {
        if (trusted) await rm(staging, { force: true }).catch(() => undefined);
        throw new AlsaConfigWriteError(reasonOf(error));
      }
    },
  });
}
