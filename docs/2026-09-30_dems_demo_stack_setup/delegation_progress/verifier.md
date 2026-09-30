---
task_id: 2026-09-30_dems_demo_stack_setup
agent: verifier
blueprint_row: 13
date: 2026-10-01
status: complete
---

# Delegation progress: verifier (row 13, environment readiness check)

| Date | Row | Status | Artifacts | Notes |
|---|---|---|---|---|
| 2026-10-01 00:23-00:30 WIB | 13 | complete | `initialization/01_env_check.md`, `delegation_progress/verifier.md` | PASS: 25/25 blocking items (24 executed, 1 by reference to 05_avds.md), 0 FAIL; Graft non-blocking PASS. `~/Documents` NOT iCloud-synced (`brctl`: `Desktop & Documents: current=NO lastEnabled=(never)`). Read-only; no emulator boot |

## Milestones

- Fresh `zsh -l -c` check of node 26.8.2, npm 11.19.1, JDK 17.0.20.1 (aarch64, `JAVA_HOME` valid), `ANDROID_HOME`, cmdline-tools 23.0, the 7 SDK packages, adb 37.0.1, emulator 37.1.11, AVDs `dems_phone` and `dems_tablet`, the `~/.zprofile` blocks, backup and only-additions diff, git (`main`, no remote, `.docx` ignored), 710 GiB free.
- Clean-environment (`env -i`) login-shell cross-check: same results, and `JAVA_TOOL_OPTIONS` is unset outside the agent session.
- iCloud R6/H5 resolved: not synced. Four methods agree (brctl, Finder prefs, CloudDocs container, `~/Documents` attributes).

## Blockers

None.

## Decisions and findings for the controller to record

| ID | Item | Suggested record |
|---|---|---|
| F1 | `sdkmanager --no-metrics` is rejected (`Unknown option`, rc=1); `--no-metrics` exists only on the `android` binary | Amend D23: use `android --no-metrics --sdk="$ANDROID_HOME" sdk ...` for SDK queries and installs; update AC-04 accordingly |
| F2 | AC-01 `head -1` catches the agent-only `Picked up JAVA_TOOL_OPTIONS` line | Reword AC-01 to `grep version` |
| F3 | Backup name in AC-11, 01_specs §6.4 and HI-3 lacks the `-235451` suffix | Update to `~/.zprofile.bak.dems-2026-09-30-235451` |
| F4 | AC-06/AC-07 still say `dems_tablet_api36` | Apply D23 names in row 5/6 |
| F5 | Graft 0.21.1 available (0.18.0 installed) | No action (global npm change is out of scope, HI-9) |
| F6 | `masterplan/02_plan.md` does not exist yet, so no plan tracking row could be updated | Controller marks row 13 done in `status_tasks.md` |
| R6 | iCloud risk | Close R6 as "not synced"; 02_structured decision item 5 needs no user decision |

## Sandbox use

Four commands ran unsandboxed after an observed sandbox denial: `android --no-metrics ... sdk list` (x2; `~/.android/cli/bundles/lock` EPERM), `emulator -version` (D24 neon abort), and `brctl status com.apple.CloudDocs` (brctl refuses under a sandbox). No state change resulted: the metrics spool stayed at 5 and `last_update_check` was unchanged.
