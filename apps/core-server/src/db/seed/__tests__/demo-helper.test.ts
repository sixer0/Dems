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
import { ChildProcess } from 'node:child_process';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ProgramFacts, ProgramInspector } from '../../../capture/adapters/local';
import { helperProgramProblemOf } from '../../../capture/fence';
import { SeedHelperProblem, runSeedHelper, seedHelperProblemOf } from '../demo-helper';

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

// Task 4, integration pass I-3 (finding of row 21, request of row 180): a signal sent through the handle of a child
// whose start failed goes to process ID 0, the caller's whole process group. THE REPRODUCTION IS SAFE: the signal
// call of every child handle and the signal call of the process are replaced for this case, so nothing real is sent.
describe('the seed helper is signalled only while it is a process', () => {
  it('a helper that could not be started is never signalled: not by the exit handler in the turn of the start, not by the time limit; the run answers HELPER_NOT_STARTED', async () => {
    const handleSignal = vi.spyOn(ChildProcess.prototype, 'kill').mockImplementation(() => true);
    const processSignal = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const before = new Set(process.listeners('exit'));
    const ownExitHandlers = () => process.listeners('exit').filter((listener) => !before.has(listener));
    try {
      // A time limit of 1 ms: were the limit to pass before the failure is reported, its signal is held by the same guard.
      const run = runSeedHelper('/nonexistent/dems/ffmpeg', [], 1).catch((caught: unknown) => caught);
      // The same turn as the start: the failure has not been reported yet, the exit handler is registered.
      const atExit = ownExitHandlers();
      expect(atExit).toHaveLength(1);
      for (const handler of atExit) (handler as () => void)();
      expect(handleSignal.mock.calls).toEqual([]);
      expect(processSignal.mock.calls).toEqual([]);
      // The helper's existing answer for a program that was not started, and this process is still here to read it.
      expect(await run).toMatchObject({ name: 'SeedHelperError', code: 'HELPER_NOT_STARTED' });
      expect(ownExitHandlers()).toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(handleSignal.mock.calls).toEqual([]);
      expect(processSignal.mock.calls).toEqual([]);
    } finally {
      handleSignal.mockRestore();
      processSignal.mockRestore();
    }
  });
});
