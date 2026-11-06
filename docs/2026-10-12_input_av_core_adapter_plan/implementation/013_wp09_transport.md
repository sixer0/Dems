# Row 13 - WP-09 unit check E-6 and the transport statement for production (T3)

Status: complete. Requirements: S4-1, S4-3 (E-6); WP-09.

## Changed
- `apps/core-server/src/capture/adapters/mic-transport.ts`: added the "sample-width statement for production" to the header (24-bit capture converted to 32-bit float at the pipe is exact; the stored audio is still resampled and AAC-encoded, no bit-exact promise; no second transport; a source wider than 24 bits is not covered), and two constants `MIC_EXACT_SOURCE_BITS = 24`, `MIC_PCM24_SCALE = 2^23`. `MIC_TRANSPORTS.PCM_FIFO` unchanged (its pin in the A-3 test still equal).
- `apps/core-server/src/capture/adapters/__tests__/static.test.ts` (home of the mic-transport tests, block A-3): one new test "E-6", loop over all signed 24-bit values (-8,388,608 to 8,388,607), raw (`Float32Array` round trip) and scaled (`n / 2^23`, times 2^23). Control: 2^24+1 does not survive.

## Result
- checked 16,777,216; equal raw 16,777,216; equal scaled 16,777,216 (assertions in the test; runtime about 1 s).
- Targeted run: `static.test.ts` 17 of 17 passed. Workspace typecheck (`tsc --noEmit`, core-server) clean.
- Double: none needed (pure computation). Unproven: the real USB microphone's conversion path and ffmpeg's actual output scale on hardware (hardware package, checks 9A/H-nn, not named by this row).

## Notes
- DRIVER DECISION: no `mic-transport.test.ts` exists (the header cited one); the existing home of its tests is `__tests__/static.test.ts`, so the test was added there as one new `it` in the A-3 block, with a claim line.
- Deviation: a second, filtered run (`-t E-6`) was made only to read the verbose line of the new test, after the first run passed.
