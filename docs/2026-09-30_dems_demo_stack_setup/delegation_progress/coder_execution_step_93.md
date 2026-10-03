---
step: 93
agent: coder-execution
status: complete
started: 2026-10-01T04:34+07:00
finished: 2026-10-01T04:56+07:00
---

# Step 93: dummy evidence data files (progress)

| Time (WIB) | Event |
|---|---|
| 04:34 | Inputs read: row 93, P1–P13, D50, D51, D61, D62, 64_demo_media.md, 13_sim_engine.md §2, src/sim/dataset.ts, events.ts, evidence.ts, explore §11.2–§11.4, §12.2, §19.2 and §19.3. `@noble/hashes` 2.4.0 is already a shared dependency. `@noble/curves` is not installed, so the pure helper checks Ed25519 through WebCrypto when the runtime has it (DR-93-1) |
| 04:38 | Probes: an Ed25519 self-signed X.509 built by hand in Node parses and verifies (`X509Certificate`, WebCrypto). The AAC frame rotation keeps the file decodable (ffmpeg exit 0). The simulator's `finalizing` scenario seals EV 0014 |
| 04:40–04:45 | Written: `src/demo-data/{types,verify,index}.ts` and `scripts/gen-demo-evidence.ts` |
| 04:45:56 | First preview run (scratch): 91 files. Fixed after review: codec labels, manifest key order, and no hashes for stills and mobile renditions |
| 04:48:40 | Repository run: 14 packages, 1 export zip (EV 0004, `EXP-000031`), 1 TAMPERED package (EV 0005, AUDIO-02). `test/demo-evidence.test.ts` written |
| 04:49 | Shared typecheck: `SubtleCrypto` was not assignable to `SubtleLike`; fixed with `Uint8Array<ArrayBuffer>` parameters. Typecheck and lint then exit 0. Tests: 18 of 18, and 393 of 393 for the whole shared suite |
| 04:49–04:50 | Determinism: 91 of 91 files byte-identical across three runs. `--as-of 2026-10-20` re-dates everything with the media hashes unchanged. Six invalid-argument runs exit 1 with no output. The mutation check fails 8 tests and passes again after regeneration. OpenSSL verifies the certificate and signatures. Consumer tsc (web DOM, Expo RN) exits 0 |
| 04:55 | Log `implementation/65_demo_evidence.md` written. A final fresh run: typecheck 0, lint 0, 393 of 393 tests, `node:` grep exit 1, published bytes unchanged |

**Status: complete**, with one needs-review relay:
- **R-93-1:** `packages/shared/package.json` needs `"./demo-data": "./src/demo-data/index.ts"` in `exports` before steps 47, 53 and 83 can import `@dems/shared/demo-data`. P1 forbids step 93 from editing it. It is one line and needs no install.

**Files written:**
- `packages/shared/scripts/gen-demo-evidence.ts`
- `packages/shared/src/demo-data/{types,verify,index}.ts` and `{packages,documents}.generated.ts`
- `packages/shared/assets/demo-evidence/**` (89 files)
- `packages/shared/test/demo-evidence.test.ts`
- `implementation/65_demo_evidence.md`
- this file

**Not written:** `src/sim/**`, the demo-media assets, `package.json` files and lockfiles, `src/index.ts`, and the shared tracking files. No npm install ran, no process is left running, nothing was committed, and no private-key file was written.
