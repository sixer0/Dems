// The loader of the class-C adapters refuses every operation but REAL_PRODUCTION before it
// imports anything (blueprint row 65; check M4-FAKE-1 "real adapters = class C, not executed").
// This is the ONE test file that may import the loader (static.test.ts pins it), and it never
// calls it for the operation that loads.
import { describe, expect, it } from 'vitest';
import { CaptureAdapterError } from '../errors';
import { loadProductionAdapters } from '../real';

describe('the class-C loader', () => {
  it('refuses SIMULATED and REAL_DEVELOPMENT with a typed error', async () => {
    const none = { cameras: [], mics: [], switches: [] };
    for (const operation of ['SIMULATED', 'REAL_DEVELOPMENT'] as const) {
      const attempt = loadProductionAdapters(operation, none);
      await expect(attempt).rejects.toBeInstanceOf(CaptureAdapterError);
      await expect(attempt).rejects.toMatchObject({ code: 'CAPTURE_REAL_ADAPTERS_REFUSED' });
    }
  });
});
