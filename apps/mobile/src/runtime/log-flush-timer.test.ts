// W87-F1 (decision D189, closing-fix round C1): the runtime log's debounced flush timer must not
// keep a Node process alive. Before the fix the 2 s timer of a log that had just been written held
// the jest worker open after its suites ended ("A worker process has failed to exit gracefully").
//
// Precise under Node: a Timeout keeps the event loop active exactly while `hasRef()` is true (Node
// timers API), so the test reads that flag on the handle the log created, with real timers. It also
// checks that an unref'd timer still flushes on time while the process runs, so the fix does not
// cost the debounce. React Native returns a number from setTimeout; there the call is a no-op.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createRuntimeLog, toRuntimeLogRecord, type LogStorage } from './log';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the runtime log flush timer (W87-F1)', () => {
  it('is unref\'d, so a pending flush does not keep the process alive, and still flushes on time', async () => {
    const writes: string[] = [];
    let stored: () => void = () => undefined;
    const flushed = new Promise<void>((resolve) => {
      stored = resolve;
    });
    const storage: LogStorage = {
      getItem: async () => null,
      setItem: async (_key, value) => {
        writes.push(value);
        stored();
      },
    };
    const spy = jest.spyOn(globalThis, 'setTimeout');
    const log = createRuntimeLog({ storage, console: false, flushMs: 25 });

    log.write(toRuntimeLogRecord({ level: 'warn', source: 'runtime.test.flushTimer', error: 'pending', at: 0 }));

    expect(spy).toHaveBeenCalledTimes(1);
    const handle = spy.mock.results[0]?.value as NodeJS.Timeout;
    expect(typeof handle.hasRef).toBe('function');
    expect(handle.hasRef()).toBe(false);

    await flushed;
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0] ?? '[]')).toMatchObject([{ source: 'runtime.test.flushTimer', message: 'pending' }]);
  });
});
