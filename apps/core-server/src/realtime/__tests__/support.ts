/**
 * SHIM (decisions D113, D116; review finding CPB1-12). The test support of the realtime channel
 * moved to the neutral folder `apps/core-server/test/support/realtime.ts`, because tests of
 * several rows import it. This path re-exports it, so that test files written against it (two
 * acceptance tests among them, one in flight at the move) keep compiling unchanged. Import
 * `test/support/realtime` in new code; this file can go when nothing imports it any more.
 */
export * from '../../../test/support/realtime';
