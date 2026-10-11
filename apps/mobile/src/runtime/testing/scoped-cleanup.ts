/**
 * Test-only (never import from app code): keeps the order "unmount, then the file's own `afterEach`"
 * for a group of cases that was a test file of its own before the consolidation of the suite (D233).
 *
 * `@testing-library/react-native` unmounts every rendered tree in an `afterEach` it registers at the
 * root of a test file, when it is imported - so BEFORE any `afterEach` the file itself writes at its
 * top level, and Jest runs the hooks of one level in the order they were registered. A file's own
 * `afterEach` therefore always ran on an unmounted tree: it could restore a spied hook
 * (`jest.restoreAllMocks()`), go back to the real timers or stop a test bed without a mounted
 * component rendering once more under the changed world.
 *
 * Moved into a `describe`, the same `afterEach` would run BEFORE the root one (inner levels first),
 * on a tree that is still mounted. A group calls this as its first statement, so that its first
 * `afterEach` is the unmount, exactly as the library does it at the root (a turn of the real event
 * loop, then `cleanupAsync`). The library's own root hook then finds nothing left to unmount.
 */
import { afterEach } from '@jest/globals';
import { cleanupAsync } from '@testing-library/react-native';

/** The real `setImmediate`, taken when this module loads: a group may run under Jest's fake timers. */
const realSetImmediate = setImmediate;

export function unmountBeforeTheHooksOfThisGroup(): void {
  afterEach(async () => {
    await new Promise<void>((resolve) => {
      realSetImmediate(resolve);
    });
    await cleanupAsync();
  });
}
