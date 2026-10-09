import { defineConfig } from 'vitest/config';

/**
 * The automated suite of `@dems/transcriber` (test strategy §B.4: two workers at most). It needs no
 * engine, no model, no listening port and no oMLX server: the `cpu-local` backend runs against a
 * stand-in executable written by the test, the `omlx-server` backend against an in-process answerer
 * at the `fetch` seam. The runs against the real engines live under `test/real/` and are selected
 * only by `vitest.real.config.ts`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 2,
    include: ['src/**/*.test.ts'],
  },
});
