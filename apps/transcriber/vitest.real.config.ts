import { defineConfig } from 'vitest/config';

/**
 * The runs against the REAL engines (blueprint row 76 Verification): `whisper-cli -ng` under
 * `.cache/stt/`, and the oMLX server of this Mac when a person has started it. One file at a time,
 * one worker, never in the default `npm test`: CPU STT is heavy and oMLX is a shared host service
 * (D7(d)). No duration is measured or printed (D230); the bound below only stops a hung engine.
 */
export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 1,
    fileParallelism: false,
    include: ['test/real/**/*.real.test.ts'],
    testTimeout: 1_800_000,
    hookTimeout: 120_000,
  },
});
