---
task_id: 2026-09-30_dems_demo_stack_setup
agent: data-analyst
delegation: packaging specification for D94 (written in parallel with blueprint rev 5)
status: complete
started: 2026-10-01 09:2x WIB
finished: 2026-10-01 10:1x WIB
narrative_tier: 3
---

# data-analyst: packaging spec (D94)

## Status

**complete**

- Specification only. No builds, installs, servers or repo edits outside `docs/`.
- The only executions were read-only probes:
  - version and help output;
  - `aapt2`/`unzip` reads of the existing debug APK;
  - `codesign -dv` / `lipo` / `strings` on the system Node;
  - one hermesc compile of a one-line file in the session scratchpad (Hermes magic bytes);
  - `curl` of `SHASUMS256.txt` plus HEAD requests to nodejs.org.

## Files created

| Path | Content |
|---|---|
| `masterplan/06_packaging_spec.md` | Tier 1 spec, 1,194 lines: §0 5W1H and decision summary; §1 facts register F-01..F-70; §2 APK; §3 web packager; §4 release layout and guides; §5 step-96 plan; §6 blueprint rows and review additions; §7 deviations; §8 risks and hypotheses; §10 sources |
| `delegation_progress/data_analyst_packaging.md` | This file |

Not written, by contract: `delegation_progress_report.md`, `status_tasks.md`.

## Decisions taken (for the controller to record)

| ID | Decision |
|---|---|
| PK-01 | `expo prebuild` (no `--clean`) + `gradlew assembleRelease` under `gradle.lock`; no EAS |
| PK-02 | Local DEMO PKCS12 keystore. Its random password lives in a git-ignored `apps/mobile/signing/release-signing.properties`. A local config plugin appends an idempotent signing block. Release builds fail fast without the properties file |
| PK-03 | Universal APK with `arm64-v8a`, `armeabi-v7a` and `x86_64` (`x86` dropped) |
| PK-05 | versionName 0.1.0 / versionCode 100 (MAJOR×10000 + MINOR×100 + PATCH) |
| PK-06/07 | Simulated-only release, no network security config; `allowBackup` false; 3 permissions blocked |
| PK-10 | **Primary:** SEA for macOS arm64, Windows x64 and Linux x64; runtime bundle for macOS x64. **Fallbacks:** Windows signed-runtime (Smart App Control) and an any-OS node zip |
| PK-11 | One dependency-free launcher on port 4410 (falling back to 4411–4419, then OS-assigned). Binds 127.0.0.1 only. Host and Origin allowlists, CSP, single instance, `--self-test` |
| PK-12 | `VITE_DEMS_CORE_ORIGIN=same-origin` at packaging time only; `base` stays `/`; dev mode unchanged |

## Deviations from rev-5 / D94 wording (MINOR; for the controller)

1. **3 ABIs, not 4.**
2. **macOS x64 is a runtime bundle.** Node SEA does not support macOS x64.
3. **The plain static `dist` zip is replaced by the any-OS node zip.** Static-only cannot sign in: `login-model.ts:56,266`.
4. **New Windows signed-runtime fallback.**
5. **New step 100** (same-origin web change plus the `.gitignore` lines) runs before the end pass. Additions to steps 91, 60 and 66.

## Blockers

None for this delegation.

## Open items for the user or controller

- **Android developer verification has been live in Indonesia since 30 Sep 2026.** Tap-install of the DEMO-signed APK needs the one-time 24-hour advanced flow; ADB install is exempt. The free limited-distribution account is not used (D5/D6); that stays the user's choice.
- **Runtime of the Windows, Linux and macOS x64 artifacts cannot be executed on this Mac.** There is no Rosetta and no Wine, and Docker belongs to other workloads. An optional Docker check needs the user's explicit OK.
