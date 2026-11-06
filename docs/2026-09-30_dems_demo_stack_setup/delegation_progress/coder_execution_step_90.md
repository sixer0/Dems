# Delegation progress: coder-execution, step 90 (Maestro CLI install)

This is a parallel-run file (P8); the controller synthesises it into the shared files. This agent did not write any of the following:
- `status_tasks.md`
- `delegation_progress_report.md`
- `masterplan/02_plan.md`
- `decisions/decisions.md`
- `implementation/99_implementation_report.md`

- **Status:** complete
- **Window:** 2026-10-01 02:12:03-02:20 WIB
- **Step log:** `implementation/62_maestro_install.md` (Tier 3)

## Verification (blueprint row 90)

| Check | Result | Evidence |
|---|---|---|
| sha256 computed = published | PASS | Both are `5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a`. `shasum -a 256 -c checksums_sha256.txt` → `maestro.zip: OK`. Also equal to the GitHub API asset digest. The checksums file's own sha256 `8960cb33…1b14` equals its API digest |
| `maestro --version` = 2.11.0 | PASS | `/Users/gsp-budi/.maestro/bin/maestro --version` → `2.11.0`, exit 0 (run with `MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true MAESTRO_DISABLE_UPDATE_CHECK=true`, JDK 17.0.20.1 from the login shell) |
| `test ! -e ~/.zshrc` (AC-10) | PASS | Exit 0 before and after. `~/.zprofile` sha256 unchanged. No profile edit; the curl installer was not used |
| Rollback recorded | PASS (widened) | `rm -rf /Users/gsp-budi/.maestro /Users/gsp-budi/Library/Logs/maestro` |
| Analytics off | PASS | First run made with the env var, so `~/.maestro/analytics.json` holds `"enabled" : false`. The opt-out semantics were confirmed in the 2.11.0 bytecode |
| D43 trivial launcher flow | PASS on both AVDs | `emulator-5554`: `[Passed] launcher_smoke (2s)`. `emulator-5556`: `[Passed] launcher_smoke (3s)`. JUnit `SUCCESS`. Screencaps are `implementation/assets/mobile/90_dems_{phone,tablet}_launcher_smoke.png` |
| Processes (P7) | Clean | adb server PID 61779 was started by this step and stopped with `adb kill-server` once both AVD locks were free. No Maestro JVM left. Emulators 51262 and 51273 untouched |
| AVDs as found | Yes | Maestro installs `dev.mobile.maestro` and `dev.mobile.maestro.test` per session and uninstalls them on close. After the runs there is no package, forward or reverse, and the default IME is LatinIME on both |

## Files

**Docs (workspace):**
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/implementation/62_maestro_install.md`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/implementation/assets/mobile/90_dems_phone_launcher_smoke.png`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/implementation/assets/mobile/90_dems_tablet_launcher_smoke.png`
- `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_step_90.md` (this file)

**Host (outside the workspace):**
- `/Users/gsp-budi/.maestro/`: `bin/`, `lib/` (198 files from the verified zip, 345 MiB), `analytics.json`, `deps/`, `sessions`.
- `/Users/gsp-budi/Library/Logs/maestro/`: 5 per-run debug zips, 20 KiB.

**Workspace side effect:** `/Users/gsp-budi/Documents/DEMS/.locks/{dems_phone,dems_tablet,mock-core,npm}.lock` were restored after INC-90-1 (below).

## Decisions and drift to record (proposed)

1. **DEC-90-1 (process, MINOR).**
   - The zip was unpacked in the session scratchpad, then moved with one guarded `mv` into `~/.maestro`, instead of `~/.maestro-tmp` (05 §6).
   - The content was proven byte-identical to the verified zip (manifest `cmp`; digest `d3d7ec43…abd3`).
2. **DEC-90-2 (env, MINOR).** `MAESTRO_DISABLE_UPDATE_CHECK=true` was added to the opt-outs.
   - The 2.11.0 binary fetches version and changelog data on every run unless the variable is exactly `true`.
   - Recommend step 67 add it to the `e2e` script, and step 60 add it to the README.
3. **DEC-90-3 (env, MINOR).** Maestro also writes `~/Library/Logs/maestro/<ts>_<pid>.zip` on every invocation (`maestro.debuglog.DebugLogStore`; no env switch found).
   - The footprint is therefore wider than the spec's `~/.maestro`.
   - The rollback becomes `rm -rf ~/.maestro ~/Library/Logs/maestro`.
   - Step 63 should include it.
4. **DEC-90-4 (process, MINOR).** The trivial launcher flow ran on both AVDs, not one, for step 57 evidence. Each AVD was locked separately, phone first.
5. **DEC-90-5 (fact).** The 04 §10.2 package-name hypothesis is confirmed.
   - The packages are `dev.mobile.maestro` and `dev.mobile.maestro.test`, plus IME `MaestroInputMethodService`.
   - They are auto-uninstalled on a normal close, so the AVD rollback is needed only after an aborted run.
6. **INC-90-1 (incident, process).** Lock probes `/usr/bin/lockf -t 0 <lock> true` were run **without `-k`** at 02:15:51 and 02:18.
   - lockf unlinked the empty lock files `dems_phone.lock`, `dems_tablet.lock`, `mock-core.lock` and `npm.lock`.
   - All four were restored at 02:18 with `touch` (only if absent). Only their mtimes changed.
   - Every probe got its lock immediately, so no holder or waiter was displaced.
   - **Proposed P3 amendment:** lock probes must use `-k` as well (`/usr/bin/lockf -k -t 0 …`).

## Hand-offs

- **Step 57:**
  - Every `maestro` call needs a per-command sandbox bypass: it writes `~/.maestro/deps` and `~/Library/Logs/maestro`, and uses adb. It fails even for `--help` inside the sandbox.
  - Use `--test-output-dir` and `--debug-output` to keep artefacts out of `~/.maestro/tests`.
  - Never use `cloud`, `login`, `mcp` or `--analyze`.
  - App flows must use the D43 reduced-motion switch. The launcher proof does not cover animated app screens.
- **Step 60:** use the absolute path, or `export PATH="$HOME/.maestro/bin:$PATH"` for the current shell only. Include the three env vars and the widened rollback.
- **Step 63:** use the footprint table (§6 of the step log), `"enabled" : false` and the manifest digest.
- **Step 67:** add `MAESTRO_DISABLE_UPDATE_CHECK=true` to the `e2e` script.

## Blockers

None.
