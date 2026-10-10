// Fix F-M4 (review row 69, question 5 / finding R69-06): the seed commands start the helper
// program. The server's boot refuses a helper whose file or whose directories another user could
// replace (SEC35-43 (a): `helperProgramRefusal`, owner and write-permission of the file and of both
// directory chains); the seed asked only "absolute, a regular file, executable" - a path the server
// refuses to start, the seed started, with the rights of the developer's Terminal. ONE rule now.
//
// No program is started here and no device is named: the check reads what a path IS.
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { ProgramFacts, ProgramInspector } from '../../../capture/adapters/local';
import { helperProgramProblemOf } from '../../../capture/fence';
import { SeedHelperProblem, seedHelperProblemOf } from '../demo-helper';

const root = mkdtempSync(join(tmpdir(), 'dems-fm4-seed-helper-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const me = typeof process.getuid === 'function' ? process.getuid() : 0;
/** A program as the set-up script leaves it: the user's own file in the user's own private directories. */
const trusted = (more: Partial<ProgramFacts> = {}): ProgramFacts => ({
  absolute: true,
  exists: true,
  regularFile: true,
  symbolicLink: false,
  file: { ownerUid: me, mode: 0o755 },
  directoriesAsWritten: [{ ownerUid: me, mode: 0o700 }, { ownerUid: 0, mode: 0o755 }],
  directoriesResolved: [{ ownerUid: me, mode: 0o700 }, { ownerUid: 0, mode: 0o755 }],
  serverUid: me,
  ...more,
});
const facts = (given: ProgramFacts): ProgramInspector => () => given;

describe('question 5: the seed applies the boot\'s rule to the helper program', () => {
  it('a program in a directory another user can write is refused BY THE REAL INSPECTOR (it was started before this fix)', () => {
    const open = join(root, 'open');
    mkdirSync(open);
    chmodSync(open, 0o777);
    const program = join(open, 'ffmpeg');
    writeFileSync(program, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    expect(seedHelperProblemOf(program)).toBe(SeedHelperProblem.DIRECTORY_WRITABLE);
  });

  it('each refusal of the boot is a refusal of the seed, with the boot\'s code under the prefix HELPER_', () => {
    const cases: [ProgramFacts, string][] = [
      [trusted({ file: { ownerUid: me, mode: 0o775 } }), 'HELPER_FILE_WRITABLE'],
      [trusted({ file: { ownerUid: me + 1, mode: 0o755 } }), 'HELPER_FILE_OWNER'],
      [trusted({ directoriesResolved: [{ ownerUid: me + 1, mode: 0o755 }] }), 'HELPER_DIRECTORY_OWNER'],
      [trusted({ directoriesAsWritten: [{ ownerUid: me, mode: 0o757 }] }), 'HELPER_DIRECTORY_WRITABLE'],
      [trusted({ regularFile: false }), 'HELPER_NOT_A_FILE'],
      [trusted({ exists: false, file: null }), 'HELPER_NOT_FOUND'],
      [trusted({ absolute: false }), 'HELPER_NOT_ABSOLUTE'],
      [trusted({ file: { ownerUid: me, mode: 0o644 } }), 'HELPER_NOT_EXECUTABLE'],
    ];
    for (const [given, code] of cases) {
      expect(seedHelperProblemOf('/x/ffmpeg', facts(given)), code).toBe(code);
      // The same facts, asked of the boot: never one answer here and another there.
      expect(`HELPER_${String(helperProgramProblemOf('/x/ffmpeg', facts(given)))}`).toBe(code);
    }
    expect([seedHelperProblemOf(null), seedHelperProblemOf('')]).toEqual(['HELPER_NOT_SET', 'HELPER_NOT_SET']);
  });

  it('CONTROL - the user\'s own program in private directories may be started', () => {
    expect(seedHelperProblemOf('/x/ffmpeg', facts(trusted()))).toBeNull();
    expect(seedHelperProblemOf('/x/ffmpeg', facts(trusted({ file: { ownerUid: 0, mode: 0o755 } })))).toBeNull();
  });
});
