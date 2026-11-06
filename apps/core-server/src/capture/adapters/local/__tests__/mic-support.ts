// Test support of the microphone helper (blueprint row 135): manual timers, a scripted process door
// that hands `mkfifo` to the real door and plays the FFmpeg program from a script, and the text of
// the device list in the shape the real program prints. Not a test file; nothing here is shipped.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CaptureTimers } from '../../../types';
import type { HelperDoor, HelperExit, HelperProcess, HelperProcessOptions } from '../process-door';
import { startHelperProcess } from '../process-door';

export const FFMPEG = '/opt/homebrew/bin/ffmpeg';
export const MKFIFO = '/usr/bin/mkfifo';

export interface ManualTimers extends CaptureTimers {
  /** The delays of the timers that are pending, in order of creation. */
  pending(): number[];
  /** Fires the pending timer with exactly this delay, if there is one. True when one fired. */
  fire(delayMs: number): boolean;
}

export function manualTimers(): ManualTimers {
  const timers: { delayMs: number; callback: () => void; live: boolean }[] = [];
  return {
    after(delayMs, callback) {
      const timer = { delayMs, callback, live: true };
      timers.push(timer);
      return () => {
        timer.live = false;
      };
    },
    pending: () => timers.filter((timer) => timer.live).map((timer) => timer.delayMs),
    fire(delayMs) {
      const timer = timers.find((entry) => entry.live && entry.delayMs === delayMs);
      if (timer === undefined) return false;
      timer.live = false;
      timer.callback();
      return true;
    },
  };
}

/** The list the real program prints for `-list_devices true` (on standard error), in its real shape. */
export function deviceListText(audio: readonly string[], video: readonly string[] = []): string {
  const lines = ['[AVFoundation indev @ 0x7ad1020140] AVFoundation video devices:'];
  video.forEach((name, index) => lines.push(`[AVFoundation indev @ 0x7ad1020140] [${index}] ${name}`));
  lines.push('[AVFoundation indev @ 0x7ad1020140] AVFoundation audio devices:');
  audio.forEach((name, index) => lines.push(`[AVFoundation indev @ 0x7ad1020140] [${index}] ${name}`));
  lines.push('[in#0 @ 0x7ad1020000] Error opening input: Input/output error', 'Error opening input file .', 'Error opening input files: Input/output error');
  return `${lines.join('\n')}\n`;
}

export const exitOf = (patch: Partial<HelperExit> = {}): HelperExit => ({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '', ...patch });

/** What a scripted process does. `lives` = it runs until it is signalled. */
export interface ProcessScript {
  /** It ends by itself right away with this exit. */
  readonly ends?: HelperExit;
  /** It runs until killed. */
  readonly lives?: boolean;
  /** `lives` only: SIGTERM does nothing (a helper blocked at the pipe), so only SIGKILL ends it. */
  readonly ignoresTerm?: boolean;
  /**
   * `lives` only: what the helper writes to standard output right after its start, handed to the
   * caller's `onOutput` like the real door does. `LIVING_PROGRESS` is the report of a helper that
   * delivers (the no-delivery bound of `camera-helper.ts` waits for it). Absent = it never reports.
   */
  readonly reports?: string;
}

/** One block of the program's `-progress` report after a first frame / first bytes: the signal of a helper that delivers. */
export const LIVING_PROGRESS = 'frame=1\nfps=0.00\ntotal_size=4096\nout_time_us=33333\nprogress=continue\n';

export interface ScriptedProcess extends HelperProcess {
  readonly signals: string[];
  /** Ends the process on its own, as a crash would. */
  endNow(exit: HelperExit): void;
}

export function scriptedProcess(script: ProcessScript, pid = 4242): ScriptedProcess {
  let over = false;
  let finish: (exit: HelperExit) => void = () => {};
  const ended = new Promise<HelperExit>((resolve) => {
    finish = (exit) => {
      if (over) return;
      over = true;
      resolve(exit);
    };
  });
  const signals: string[] = [];
  if (script.ends !== undefined) queueMicrotask(() => finish(script.ends as HelperExit));
  return {
    pid,
    ended,
    signals,
    alive: () => !over,
    kill(signal) {
      signals.push(signal);
      if (over) return;
      if (signal === 'SIGTERM' && script.ignoresTerm === true) return;
      finish(exitOf({ exitCode: null, signal }));
    },
    endNow: (exit) => finish(exit),
  };
}

export interface DoorCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>> | undefined;
}

export interface ScriptedDoor {
  readonly door: HelperDoor;
  /** Every process the door was asked to start, mkfifo included. */
  readonly calls: DoorCall[];
  /** The FFmpeg processes only, in order. */
  readonly ffmpeg: ScriptedProcess[];
  /** The calls to FFmpeg whose arguments are not a device list. */
  pushes(): DoorCall[];
}

/**
 * A door for the helper under test: `mkfifo` runs for real (the pipe must exist), the FFmpeg program
 * is played from `script(call, index)`. `list` is the text printed for the device-list call, or a
 * function of the number of list calls so far (it may also return a script, e.g. a list call that hangs).
 */
export function scriptedDoor(list: string | ((listCall: number) => string | ProcessScript), script: (call: DoorCall, index: number) => ProcessScript): ScriptedDoor {
  const calls: DoorCall[] = [];
  let listCalls = 0;
  const ffmpeg: ScriptedProcess[] = [];
  const door: HelperDoor = (options: HelperProcessOptions) => {
    const call: DoorCall = { command: options.command, args: [...options.args], env: options.env };
    calls.push(call);
    if (options.command === MKFIFO) return startHelperProcess(options);
    const isList = options.args.includes('-list_devices');
    let played: ProcessScript;
    if (isList) {
      const answer = typeof list === 'string' ? list : list((listCalls += 1) - 1);
      played = typeof answer === 'string' ? { ends: exitOf({ exitCode: 251, diagnostics: answer }) } : answer;
    } else {
      played = script(call, ffmpeg.length);
    }
    const process = scriptedProcess(played, 4000 + ffmpeg.length);
    ffmpeg.push(process);
    // The report arrives after the start, as from a real child: never inside the door call itself.
    const { reports } = played;
    if (reports !== undefined && played.lives === true) queueMicrotask(() => options.onOutput?.(Buffer.from(reports)));
    return process;
  };
  return { door, calls, ffmpeg, pushes: () => calls.filter((call) => call.command !== MKFIFO && !call.args.includes('-list_devices')) };
}

/** A throw-away directory for the pipes of one test file. */
export function temporaryRoot(): { readonly root: string; readonly runDir: string; remove(): void } {
  const root = mkdtempSync(join(tmpdir(), 'dems-mic-'));
  return { root, runDir: join(root, 'run', 'capture'), remove: () => rmSync(root, { recursive: true, force: true }) };
}

/** The program facts of a path that passes the rule (root-owned, closed to writing), for tests of the helper's logic. */
export const trustedInspector = (serverUid = 501) => () => ({
  absolute: true,
  exists: true,
  regularFile: true,
  symbolicLink: false,
  file: { ownerUid: 0, mode: 0o755 },
  directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }],
  directoriesResolved: [{ ownerUid: 0, mode: 0o755 }],
  serverUid,
});
