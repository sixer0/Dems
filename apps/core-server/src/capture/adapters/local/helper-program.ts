/**
 * The rule for the helper program path (blueprint row 134; capture spec §A.6.4 HL-2, erratum
 * PE-128-63; SEC35-43; check `M4-SEC-HELPER-1`).
 *
 * The helper is started by an absolute path, never by a name looked up on a search path. The
 * path is refused when
 *   - it is relative, or names nothing, or names something that is not a regular file;
 *   - the file (after links are followed) is not owned by root or by the server's user, or is
 *     writable by its group or by others;
 *   - a directory on the way - of the path as written AND of the file it resolves to, so that a
 *     symbolic link into a writable place is caught - is not owned by root or by the server's
 *     user, or is writable by its group or by others.
 *
 * A pure function of facts (`ProgramFacts`): the file system is read by the door only.
 */
import type { PathStepFacts, ProgramFacts } from './process-door';

export const HelperProgramRefusal = {
  NOT_ABSOLUTE: 'NOT_ABSOLUTE',
  NOT_FOUND: 'NOT_FOUND',
  NOT_A_FILE: 'NOT_A_FILE',
  FILE_OWNER: 'FILE_OWNER',
  FILE_WRITABLE: 'FILE_WRITABLE',
  DIRECTORY_OWNER: 'DIRECTORY_OWNER',
  DIRECTORY_WRITABLE: 'DIRECTORY_WRITABLE',
} as const;
export type HelperProgramRefusal = (typeof HelperProgramRefusal)[keyof typeof HelperProgramRefusal];

const GROUP_OR_OTHER_WRITE = 0o022;

/** The first reason the path is refused for, or null when it may be started. */
export function helperProgramRefusal(facts: ProgramFacts): HelperProgramRefusal | null {
  if (!facts.absolute) return HelperProgramRefusal.NOT_ABSOLUTE;
  if (!facts.exists || facts.file === null) return HelperProgramRefusal.NOT_FOUND;
  if (!facts.regularFile) return HelperProgramRefusal.NOT_A_FILE;
  const trusted = (step: PathStepFacts): boolean => step.ownerUid === 0 || (facts.serverUid >= 0 && step.ownerUid === facts.serverUid);
  if (!trusted(facts.file)) return HelperProgramRefusal.FILE_OWNER;
  if ((facts.file.mode & GROUP_OR_OTHER_WRITE) !== 0) return HelperProgramRefusal.FILE_WRITABLE;
  const directories = [...facts.directoriesAsWritten, ...facts.directoriesResolved];
  if (directories.length === 0) return HelperProgramRefusal.NOT_FOUND;
  if (!directories.every(trusted)) return HelperProgramRefusal.DIRECTORY_OWNER;
  if (directories.some((step) => (step.mode & GROUP_OR_OTHER_WRITE) !== 0)) return HelperProgramRefusal.DIRECTORY_WRITABLE;
  return null;
}
