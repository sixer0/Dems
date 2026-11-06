---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 13
agent: coder-execution
milestone: M1
class: B
tier: 3
date: 2026-10-07
status: blocked-needs-decision
installs_performed: 0
sudo_used: false
artifact: initialization/03_gstreamer_install.md
escalation: board ASK board_1d632fc4-da21-4664-94a2-09bc20e437bf (to main)
---

# Row 13 - GStreamer install: halted pre-install, decision requested

## Result

| Item | Value |
|---|---|
| Install | **Not performed** - `brew install gstreamer` would upgrade 11 already-installed formulae, which the row's hard rule ("no `brew upgrade` of anything else") and D7 (protect the installed oMLX stack) forbid |
| `gst-inspect-1.0 isofmp4mux` | Not run - binary absent (`which -a gst-inspect-1.0` -> "not found", exit 1) |
| `gst-inspect-1.0 input-selector` | Not run - same reason |
| Version that would install | `gstreamer 1.28.7_2`, bottle `arm64_golden_gate` available (no source build) |
| Size added | Not measured - 0 bytes written (`brew list --formula` 66 before / 66 after; `ls -d /opt/homebrew/Cellar/gstreamer*` -> no matches) |
| Uninstall command recorded | `brew uninstall gstreamer` + `brew autoremove` (autoremove dry-run verified: exit 0, 0 lines today; `brew uninstall --dry-run` is not a valid option - usage error captured; uninstall does **not** revert the 11 upgrades) |
| Repo / ports | `git status --porcelain -- package.json package-lock.json` empty; `lsof` listener set 51 lines identical before/after; 5173/5174/5175, 8554-8564, 8000 all 0 listeners in both. Note for the controller: `git status --porcelain -- apps packages scripts release` shows one entry, `M apps/core-web/src/test/live-paired-devices-issue.test.tsx` (mtime 15:54:44, 4 insertions / 3 deletions) - sibling row 20's in-flight core-web edit, not this row's; row 13 wrote no source file |

## Blocking evidence (all quoted in the artifact)

| Command | Output |
|---|---|
| `brew install --dry-run gstreamer` (exit 0) | "Would install 1 formula: gstreamer 1.28.7_2" / "Would install 62 dependencies for gstreamer" / "Would upgrade 11 dependencies for gstreamer: libpng pcre2 glib xorgproto ca-certificates openssl@3 sdl3 sdl2-compat xz harfbuzz readline" |
| `brew list --versions` (the 11) | all installed: libpng 1.6.58, pcre2 10.48, glib 2.90.0, xorgproto 2025.1, ca-certificates 2026-08-13, openssl@3 3.6.4, sdl3 3.4.16, sdl2-compat 2.32.72, xz 5.8.3, harfbuzz 14.5.0, readline 8.3.3 |
| `brew uses --installed <target>` | `jundot/omlx/omlx` depends on ca-certificates, openssl@3, xz, readline; `ffmpeg` depends on ca-certificates, openssl@3, sdl3, sdl2-compat, xz; `openjdk@17` on libpng, pcre2, glib, xorgproto, harfbuzz; `kilo-org/tap/kilo` on pcre2 |
| `brew list --versions gst-plugins-rs` | `Warning: Formula gst-plugins-rs was renamed to gstreamer.` (plus base/good/bad/ugly/libav) - confirms there is no smaller Rust-only install to fall back on (D8/F-64) |
| reuse check | `brew leaves` 12 entries, none gstreamer; `ls /opt/homebrew/opt \| grep -i gst` exit 1; gst binaries absent - so the row genuinely needs the install or the skip |

## Why this is an escalation and not a self-approval

D4 blanket-approved *installs* into user space with a logged uninstall path. It did not approve replacing TLS/CA, readline, xz, glib, libpng, pcre2, harfbuzz, xorgproto and both SDL libraries underneath the FFmpeg build that rows 7/8/9 measured and the oMLX stack the user asked us to reuse (D7). Reinstalling omlx - which Homebrew would flag after the upgrade - would destroy the manually re-applied mlx-audio 0.5.3 patch recorded in initialization/02_stt_runtime_install.md:51-55. The dry-run showed there is no supported way to install the bottle without those upgrades (`--ignore-dependencies` would leave 62 real deps uninstalled and broken), and the task forbids source builds and brew config edits.

## What rows 14 / 15 need from this

- Row 14: cannot run a GStreamer graph on this host yet; if the decision is decline/defer it records SKIPPED citing row 13 (its Verification allows exactly that). If the decision is approve, row 13 must be re-run to completion first, and row 14 must still verify `isofmp4mux`/`input-selector` with `gst-inspect-1.0` as step 1 - the dry run does **not** prove the bottle ships the Rust plugin set, because meson option `isobmff` defaults to `auto` (F-69) and can skip silently.
- Row 15: footprint/collision evidence (63 new formulae + 11 upgrades + partial reversibility) plus F-73/F-74 (no distro package for gst-plugins-rs on Debian/Fedora/Arch/Alpine/AUR) is the input to the install-footprint and x86-Linux-portability scores. Licence note for DOC-05: the formula declares `LGPL-2.0-or-later AND LGPL-2.1-or-later AND MIT` but builds `-Dgpl=enabled` with x264/x265/ffmpeg deps (F-92) - GPL-encumbered in practice.

## Decision requested (unanswered at time of writing)

| Option | Effect |
|---|---|
| A - approve the 11 implicit upgrades | Row 13 gates can be met; oMLX/ffmpeg/openjdk run against swapped libraries, brew flags them for reinstall |
| B - decline | Row 13 becomes a SKIPPED record citing D4+D7 and this dry-run; row 14 SKIPPED citing row 13; row 15 on documented facts |
| C - defer to a quiet maintenance window | Same evidence, lower blast radius, still needs upgrade approval |

Recommendation: B or C - the install is comparison-only after D10(c) (the operator-triggered mic switch works via the libavfilter API), and its uninstall path cannot revert the upgrades.

## Compliance

No sudo, no `--force`, no `brew upgrade` (omlx never touched), no source build, no alternative package manager, no brew config edit, no service started, no repo source edit, no writes outside the two deliverables plus system-temp scratch (moved out of the task folder in the same step). Single-writer rule honoured: `ps` scan showed no other `brew` process before, during or after.

## Next action

Controller answer to board ASK `board_1d632fc4-da21-4664-94a2-09bc20e437bf`. On A: re-run row 13 (install, both `gst-inspect` gates, `du -sh` footprint, uninstall record). On B/C: fold the SKIPPED outcome into row 14's dispatch and let row 15 score from this artifact.
