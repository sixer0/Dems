// Self-check fixture (see vitest.selfcheck.config.ts): its global setup fails, so this test
// must never run. If the marker below appears in the output, a database test ran, or was
// reported as passed or skipped, although PostgreSQL was unreachable.
import { expect, it } from 'vitest';

it('must never run', () => {
  console.log('[selfcheck] MARKER: a test ran although PostgreSQL was unreachable');
  expect(true).toBe(true);
});
