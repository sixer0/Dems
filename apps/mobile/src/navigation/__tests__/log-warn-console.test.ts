// Post-review fix FXR-M, finding W93-14 (code review W93, decision D243; the DX-6 rule of D203).
//
// Before the runtime log installs its sinks (and for callers outside React: `+native-intent.tsx`, the
// tab-root fallback), the navigation and motion logs print to the dev console. Their `warn` records still went
// to `console.warn`, which raises LogBox's yellow "Open debugger to view warnings" bar over the operator's
// screen (F80). Like `runtime/log.ts` since DX-6: `warn` -> `console.info`, only `error` -> `console.error`.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { reportMotionIssue, setMotionLogSink } from '@/motion/log';
import { reportNavigationIssue, setNavigationLogSink } from '../log';

let warn: jest.SpiedFunction<typeof console.warn>;
let info: jest.SpiedFunction<typeof console.info>;
let error: jest.SpiedFunction<typeof console.error>;
let restoreNav: ReturnType<typeof setNavigationLogSink>;
let restoreMotion: ReturnType<typeof setMotionLogSink>;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  restoreNav = setNavigationLogSink(null); // the dev-console default
  restoreMotion = setMotionLogSink(null);
});
afterEach(() => {
  setNavigationLogSink(restoreNav);
  setMotionLogSink(restoreMotion);
  warn.mockRestore();
  info.mockRestore();
  error.mockRestore();
});

describe('W93-14: a warn record of the navigation or motion log never reaches console.warn', () => {
  it.each([
    ['navigation', () => reportNavigationIssue('warn', 'navigation.tabRoot.fallback', 'fell back (test)')],
    ['motion', () => reportMotionIssue('warn', 'motion.prefs.read', 'fell back (test)')],
  ])('%s: warn -> console.info (the record keeps its level); error still -> console.error', (_name, report) => {
    report();
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect((info.mock.calls[0]![1] as { level: string }).level).toBe('warn');
  });

  it('an error record still goes to console.error', () => {
    reportNavigationIssue('error', 'navigation.test', 'fault (test)');
    reportMotionIssue('error', 'motion.test', 'fault (test)');
    expect(error).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });
});
