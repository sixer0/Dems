---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 13
milestone: M1
class: B
tier: 3
date: 2026-10-07
agent: coder-execution
deliverable: initialization/03_gstreamer_install.md
status: blocked-needs-decision
installs_performed: 0
upgrades_performed: 0
sudo_used: false
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md
last_updated: 2026-10-07 16:05 (+07:00)
---

# Row 13 - GStreamer (gst-plugins-rs / `isofmp4mux`) via Homebrew

## 0. Verdict

| Item | Result |
|---|---|
| Install executed | **NO** - halted pre-install on a hard-rule collision, escalated to the controller (board ASK `board_1d632fc4-da21-4664-94a2-09bc20e437bf`) |
| `gst-inspect-1.0 isofmp4mux` gate | **NOT RUN** - no install, nothing to inspect (exit code cannot be produced honestly) |
| `gst-inspect-1.0 input-selector` gate | **NOT RUN** - same reason |
| Host state changed | **NONE** - 66 formulae before and after, no `Cellar/gstreamer`, no `gst-*` on PATH, listener set byte-identical |
| Repository changed by this row | **NONE** - `git status --porcelain -- package.json package-lock.json` empty before and after, and no source file written (one unrelated in-flight sibling edit is itemised in section 10) |
| Uninstall command recorded | YES (section 8), plus a captured limitation: uninstall does **not** revert the 11 library upgrades |
| SKIPPED branch available | YES - section 13 gives the decision options; the recommendation is decline (B) or defer (C) |

The row's Verification column (identification/02_structured.md:193) demands `gst-inspect-1.0 isofmp4mux` **and** `gst-inspect-1.0 input-selector` exit 0, an uninstall command recorded, **or** a SKIPPED record citing the decision ID. The gates cannot be met without an install; the install cannot be met without violating this row's own hard rule. Section 5 is the proof.

## 1. Before state (probe table)

All probes read-only. Exit codes are from the shell, quoted verbatim.

| # | Command | Output | Exit |
|---|---|---|---|
| 1 | `command -v brew` | `/opt/homebrew/bin/brew` | 0 |
| 2 | `brew --prefix` | `/opt/homebrew` | 0 |
| 3 | `brew --version` | `Homebrew 7.0.8` (section 11 quotes `brew config`) | 0 |
| 4 | `brew list --versions gstreamer` | *(no output - formula not installed)* | 1 |
| 5 | `which -a gst-inspect-1.0 gst-launch-1.0` | `gst-inspect-1.0 not found` / `gst-launch-1.0 not found` | 1 |
| 6 | `ls -d /opt/homebrew/Cellar/gstreamer*` | `zsh:1: no matches found: /opt/homebrew/Cellar/gstreamer*` | 1 |
| 7 | `brew list --formula \| wc -l` | `66` | 0 |
| 8 | `brew list --cask \| wc -l` | `0` | 0 |
| 9 | `brew leaves` | 12 entries: `colima docker docker-compose espeak-ng ffmpeg git jundot/omlx/omlx kilo-org/tap/kilo openjdk@17 rtk rust vladkens/tap/macmon` | 0 |
| 10 | `brew leaves \| grep -c gstreamer` | `0` | 1 |
| 11 | `ps -Axo pid,etime,command \| grep -E "(^\|/)brew( \|$)\|gst-launch\|gst-inspect" \| grep -v grep` | *(no output)* | 1 |
| 12 | `git status --porcelain -- package.json package-lock.json` | *(empty)* | 0 |
| 13 | `lsof -nP -iTCP -sTCP:LISTEN \| wc -l` | `51` | 0 |
| 14 | `lsof -nP -iTCP -sTCP:LISTEN \| grep -cE "TCP .*\.(5173\|5174\|5175) "` | `0` (SMART WMS not running at the time of this row - nothing to disturb) | 1 |
| 15 | `lsof -nP -iTCP -sTCP:LISTEN \| grep -cE "TCP .*\.(855[4-9]\|856[0-4]) "` | `0` (spike ports free) | 1 |
| 16 | `lsof -nP -iTCP -sTCP:LISTEN \| grep -cE "TCP .*\.8000 "` | `0` (oMLX server down, matches D7/D10 hand-over state) | 1 |

Probe 11 satisfies the single-writer rule (D8): no `brew` process and no GStreamer process was running at any point in this row; this session never launched one.

## 2. Reuse-before-install check (D7 posture)

| Check | Result |
|---|---|
| GStreamer formula installed | No (probe 4, probe 6, probe 10) |
| `gst-*` binaries on PATH | No (probe 5) |
| Another installed formula providing GStreamer | `brew list --formula` has no entry matching `gst`/`gstreamer` (grep exit 1); `ls /opt/homebrew/opt \| grep -i gst` exit 1 |
| Homebrew's own view of the plugin packages | `brew list --versions gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-plugins-rs gst-libav` returns only rename warnings, no versions: `Warning: Formula gst-plugins-base was renamed to gstreamer.` (same for good, bad, ugly, **rs**, libav), exit 1 |

The last line is new, local confirmation of F-64/F-65: Homebrew has folded `gst-plugins-rs` (and base/good/bad/ugly/libav) into **one** `gstreamer` formula, so there is no smaller "just the Rust plugins" install to fall back on. Reuse is impossible; the row genuinely requires the install or the skip.

## 3. Planned install command (as approved by Q-INSTALL item 3)

`brew install gstreamer` - user-space only (prefix `/opt/homebrew`, owned by `gsp-budi:admin`), no `sudo`, no `--force`, no `HOMEBREW_*` overrides, no config edits, no `brew upgrade` of anything else, no source build.

Pre-flight inspection used the supported read-only planner:

```
$ brew install --dry-run gstreamer
==> Would install 1 formula:
gstreamer 1.28.7_2
==> Downloading https://ghcr.io/v2/homebrew/core/gstreamer/manifests/1.28.7_2
Already downloaded: /Users/gsp-budi/Library/Caches/Homebrew/downloads/6b6216df3f61ea4614990d8a3d5c14dcec424b1ee9db96cb752897f622aab3a8--gstreamer-1.28.7_2.bottle_manifest.json
==> Would install 62 dependencies for gstreamer:
aom faac faad2 libogg flac gdk-pixbuf graphene dbus libxfixes libxi libxtst at-spi2-core
fribidi gsettings-desktop-schemas hicolor-icon-theme libepoxy libdatrie libthai pango gtk+3
librsvg gtk4 imath json-glib libunibreak libass gmp libidn2 libtasn1 nettle p11-kit gnutls
libnice libvorbis speex theora libshout libsndfile libsodium glib-networking libnghttp2 libpsl
libsoup libusrsctp opencore-amr libdeflate openjph openexr openjpeg orc python@3.14
gobject-introspection py3cairo pygobject3 rtmpdump srt srtp utf8cpp taglib libcuefile
libreplaygain musepack
==> Would upgrade 11 dependencies for gstreamer:
libpng pcre2 glib xorgproto ca-certificates openssl@3 sdl3 sdl2-compat xz harfbuzz readline
```

Exit code 0. Two things this proves: a bottle exists for this host (`arm64_golden_gate`, macOS 27.0.1-arm64 - no source build needed, so F-64's "bottle available" holds), and the install is **not** additive-only: it forces 11 library upgrades. Spot-checks confirm the split: `aom`, `orc`, `libsoup` are absent (`brew list --versions` exit 1) while all 11 upgrade targets are present (section 4, column "installed").

## 4. The rule collision (why nothing was installed)

Hard rule for this row: **"no `brew upgrade` of anything else"** (and D7: never touch the installed oMLX TTS/STT stack). A plain `brew install gstreamer` performs 11 upgrades by itself - there is no supported flag to install a bottle against outdated dependencies (`--ignore-dependencies` would skip the 62 genuinely absent deps and yield a broken install, and the task forbids source builds and brew edits).

The 11 forced upgrades, with installed version, formula version, licence, and the installed formulae that depend on them (`brew uses --installed`, quoted per target):

| Upgrade target | Installed | Would become | Licence | Installed dependents (brew uses --installed) |
|---|---|---|---|---|
| libpng | 1.6.58 | 1.6.59 | libpng-2.0 | cairo, fontconfig, freetype, harfbuzz, libtiff, little-cms2, **openjdk@17**, webp |
| pcre2 | 10.48 | 10.49 | BSD-3-Clause | cairo, git, glib, harfbuzz, **kilo-org/tap/kilo**, **openjdk@17**, ripgrep |
| glib | 2.90.0 | 2.90.1 | LGPL-2.1-or-later | cairo, harfbuzz, **openjdk@17** |
| xorgproto | 2025.1 | 2026.1 | MIT | cairo, harfbuzz, libx11, libxau, libxcb, libxdmcp, libxext, libxrender, **openjdk@17** |
| ca-certificates | 2026-08-13 | 2026-09-25 | MPL-2.0 | **ffmpeg**, **jundot/omlx/omlx**, libgit2, libssh2, openssl@3, python@3.11, rust |
| openssl@3 | 3.6.4 | 3.6.5 | Apache-2.0 | **ffmpeg**, **jundot/omlx/omlx**, libgit2, libssh2, python@3.11, rust |
| sdl3 | 3.4.16 | 3.4.18 | Zlib | **ffmpeg**, sdl2-compat |
| sdl2-compat | 2.32.72 | 2.32.74 | Zlib | **ffmpeg** |
| xz | 5.8.3 | 5.8.4 | 0BSD AND GPL-2.0-or-later | **ffmpeg**, **jundot/omlx/omlx**, libtiff, little-cms2, llvm@22, **openjdk@17**, python@3.11, rust, zstd |
| harfbuzz | 14.5.0 | 14.6.0 | MIT | **openjdk@17** |
| readline | 8.3.3 | 8.3.6 | GPL-3.0-or-later | **jundot/omlx/omlx**, python@3.11, rust, sqlite |

Version/license pairs came from `brew info --json=v2 --formula <name>` (`versions.stable`, `license`); installed versions from `brew list --versions <name>` (all 11 confirmed installed, exit 0).

### 4.1 Blast radius on protected assets

| Protected asset | Why it is protected | Libraries this install would replace under it |
|---|---|---|
| `jundot/omlx/omlx` 0.6.4 | D7: the installed STT/TTS stack; its mlx-audio 0.5.3 patch is **manually re-applied inside the Cellar** (initialization/02_stt_runtime_install.md:51-55), so a reinstall equals data loss | ca-certificates, openssl@3, xz, readline |
| `ffmpeg` 9.0.2 | The engine behind spike S1/S2/S4 (rows 7/8/9) and the future M3 capture path; all row-3 capability facts (F-91) were captured against this exact build | ca-certificates, openssl@3, sdl3, sdl2-compat, xz |
| `openjdk@17` | Mobile builds for the class-A chain (rows 16-27, emulators) | libpng, pcre2, glib, xorgproto, harfbuzz |
| `kilo-org/tap/kilo` | This agent runtime itself | pcre2 |
| In-flight sibling work | Row 9 (spike S4) was running FFmpeg-based work in the same wave (W3, D11); rows 17/20 were running jest | all of the above swaps land at once |

Homebrew does not auto-reinstall dependents, but after upgrading a library it flags dependents as needing a reinstall. On this host that flag would name **omlx** and **ffmpeg** - the two things the row is told not to disturb. Reinstalling omlx would wipe the row-10 patch; leaving it unreinstalled means the D7-protected stack runs against swapped TLS/CA/readline/compression libraries. Both outcomes are outside what Q-INSTALL blanket approval covers: D4 approved *installs* into user space with an uninstall path, not *upgrades of the pre-existing toolchain*, and this row's hard rule bans them explicitly.

That is a scope conflict, not a technical failure, so it was escalated instead of self-approved.

## 5. Footprint (recorded as unexecuted)

| Measure | Value |
|---|---|
| New formulae (gstreamer itself) | 1 - `gstreamer 1.28.7_2` |
| New dependencies | 62 (list in section 3) |
| Existing formulae upgraded | 11 (table in section 4) |
| Leaves after hypothetical install | 13 (`gstreamer` would be the 13th leaf; today 12) |
| Installed size / added disk size | **Not measured - no install ran.** `ls -d /opt/homebrew/Cellar/gstreamer*` still returns "no matches found"; `brew list --formula \| wc -l` still 66 |
| Bottle compressed size | Not available from this Homebrew's API: `brew info --json=v2 --formula gstreamer` bottle entry keys are only `cellar,url,sha256` (no `size` field), so no honest figure is recorded |
| Bottle identity | `arm64_golden_gate` (the only bottle key in the API entry), url `https://ghcr.io/v2/homebrew/core/gstreamer/blobs/sha256:a6e736b6e1ab7a9da87b7c6c8d104becc1cf56fa878433a6e148dbb2c260d8ef`, sha256 `a6e736b6e1ab7a9da87b7c6c8d104becc1cf56fa878433a6e148dbb2c260d8ef` |
| Write outside the prefix | Homebrew's own download cache `~/Library/Caches/Homebrew/downloads/` (the manifest file quoted in section 3). Inherent to `brew`; no repo or project file touched |

## 6. Verification gates - status

| Gate (row 13 Verification) | Command | Status |
|---|---|---|
| `isofmp4mux` registered | `gst-inspect-1.0 isofmp4mux` | Not run - binary absent (`which -a` exit 1) |
| `input-selector` registered | `gst-inspect-1.0 input-selector` | Not run - binary absent |
| Supporting elements | `gst-inspect-1.0 rtspsrc`, `gst-inspect-1.0 qtdemux`, `gst-launch-1.0 --version` | Not run - binaries absent |
| GStreamer version | `gst-launch-1.0 --version` | Not obtainable; formula-side version is `1.28.7_2` (section 3) |

**The dry run does not satisfy these gates.** F-65/F-69 establish at *formula-source* level that the single Homebrew `gstreamer` recipe vendors `gst-plugins-rs` (`-Drs=enabled`) and that `isobmff` (the crate that provides `isofmp4mux`, F-67/F-68) defaults to the meson option `auto`. `auto` means the plugin is built **only if its build deps are present, and silently skipped otherwise** - a source-level fact cannot prove the shipped bottle contains `libgstisobmff`. So even after an approved install, `gst-inspect-1.0 isofmp4mux` remains the only acceptable evidence, and it has not been produced.

## 7. Licence record (input for DOC-05, rows 36/37)

| Item | Recorded value | Source |
|---|---|---|
| Formula aggregate licence | `LGPL-2.0-or-later AND LGPL-2.1-or-later AND MIT` | `brew info --json=v2 --formula gstreamer` -> `.formulae[0].license` |
| Actual build posture | the same recipe passes `-Dgpl=enabled` and pulls `x264`, `x265`, `ffmpeg` | F-92 (research/02_collection.md:171) - **unchanged, still applies** |
| Consequence | the install is **not** a licence-clean engine: the declared LGPL is an aggregate that the GPL-enabled build with GPL codecs contradicts in practice. DOC-05 must treat "GStreamer option" as GPL-encumbered on this host, alongside F-91 (this host's FFmpeg is a GPL build with `--enable-libx264 --enable-libx265`) | F-91, F-92, F-93 |
| `gst-inspect-1.0` licence lines for `isofmp4mux` / `input-selector` | **Not available** - no install, so no per-plugin licence string was printed. Expected plugin/package identity if installed: `isofmp4mux` -> plugin `isobmff`, package `gst-plugin-isobmff` (F-68); `input-selector` -> plugin `coreelements`, package `GStreamer` (F-70) | F-68, F-70 |
| gst-plugins-rs own licence (gap G-7) | **Still open** - not collected in this row; needed by rows 15 and DOC-05 | research/02_collection.md:570 |
| Licences of the 11 libraries this install would upgrade | libpng-2.0, BSD-3-Clause, LGPL-2.1-or-later, MIT, MPL-2.0, Apache-2.0, Zlib x2, 0BSD AND GPL-2.0-or-later (xz), MIT, GPL-3.0-or-later (readline) | section 4 table (`brew info` licence field) |

The readline (GPL-3.0-or-later) and xz (GPL-2.0-or-later component) entries matter for DOC-05 too: the hypothetical install would **upgrade GPL-licensed libraries under the oMLX stack**, not just add a new LGPL/GPL framework.

## 8. Uninstall command (recorded per Q-INSTALL, not run)

```
brew uninstall gstreamer
brew autoremove
```

| Check | Result |
|---|---|
| `brew uninstall --dry-run gstreamer` | **Not a supported option**: prints the usage block and `Error: invalid option: --dry-run`, exit 1 (uninstall also requires an *installed* formula). So no dry-run exists for step 1 |
| `brew autoremove --dry-run` | Supported: exit 0 with **zero output lines** today - nothing on this host is currently an orphan, so the paired command is correct and its effect is provably empty until gstreamer is installed |
| Completeness caveat | `brew uninstall` + `brew autoremove` removes the new formula and its now-orphan dependencies. It does **not** downgrade the 11 upgraded libraries and does not restore the previous `ca-certificates` / `openssl@3` / `xz` / `readline` / `sdl*` / `glib` / `libpng` / `pcre2` / `harfbuzz` / `xorgproto` versions. Reversibility is therefore **partial**, which is the second reason this install is not a zero-risk add-on |
| Suggested extra cleanup if installed later | `brew cleanup` (bottle cache under `~/Library/Caches/Homebrew/downloads/`) - only with controller approval |

## 9. Packaging fact for row 15 (x86 Linux portability score)

| Fact | Evidence |
|---|---|
| macOS path is single-formula: `gstreamer` 1.28.7_2 bundles base+good+bad+ugly+libav+rtsp-server+ges+devtools+tools **and** gst-plugins-rs | F-64, F-65, F-66; local rename warnings (section 2) |
| Cost of that convenience on this host | 62 new formulae + **11 forced library upgrades** touching ffmpeg/omlx/openjdk (sections 3-4) |
| Linux distro packaging for gst-plugins-rs | No Debian, Fedora, Arch, Alpine or AUR package found (F-73); on Linux the Rust plugins must be built from source with meson + cargo-c (F-74) |
| Net input to row 15's portability score | GStreamer is easy to *obtain* on macOS but expensive to *add* to an already-populated macOS prefix, and on the shipped x86 Linux Core it has **no package** - i.e. portability is worse than FFmpeg's, which is a single widely packaged build. Row 15 should also weight that the row-13 host install is currently blocked by the upgrade collision |

## 10. Proof that nothing was changed

| Proof | Command | Output |
|---|---|---|
| Repo lockfiles untouched | `git status --porcelain -- package.json package-lock.json` | *(empty)*, exit 0 - identical before (section 1 probe 12) and after |
| Repo source: row 13 made no edit | `git status --porcelain -- apps packages scripts release` | one entry: ` M apps/core-web/src/test/live-paired-devices-issue.test.tsx` (`git diff --stat`: 4 insertions, 3 deletions) - **not this row's**. Its mtime is 2026-10-07 15:54:44, five minutes after this session started at 15:49, and it is the file sibling row 20 (core-web B10 chain, W3 per D11) is editing; row 16's board note already lists `live-paired-devices-issue:373` as a row-20 target. Row 13 wrote nothing under `apps/`, `packages/`, `scripts/` or `release/` - the command log (section 14) has no edit or write against those paths |
| Formula count unchanged | `brew list --formula \| wc -l` | `66` before, `66` after |
| GStreamer absent after all probes | `ls -d /opt/homebrew/Cellar/gstreamer*` | `zsh:1: no matches found` |
| Binaries absent after all probes | `which -a gst-launch-1.0 gst-inspect-1.0` | `gst-launch-1.0 not found`, `gst-inspect-1.0 not found` |
| Leaves unchanged | `brew leaves` | the same 12 entries as before; `grep -c gstreamer` -> `0` |
| No orphan claim change | `brew autoremove --dry-run` | exit 0, 0 lines (same as before) |
| Ports unchanged | `lsof -nP -iTCP -sTCP:LISTEN` before vs after | 51 lines -> 51 lines; `diff` of the two captures reports no difference ("IDENTICAL"); SMART WMS 5173/5174/5175, spike ports 8554-8564 and oMLX 8000 were listening **0** times in both snapshots |
| No service started | `ps` scan for `brew`, `gst-launch`, `gst-inspect` | empty, exit 1 |
| Nothing written outside the task folder / prefix | only writes were: this file, `delegation_progress/coder-execution__row13.md`, and transient scratch under the system temp dir (`/var/folders/.../T/kilo/row13_*.{txt,log}`) used to capture command output; a first scratch file mistakenly placed in the task folder was moved out in the same step and the task folder now contains no other file from this row | n/a |

Hard-rule compliance: no `sudo`, no `--force`, no `brew upgrade` (of anything, including omlx), no source build, no alternative package manager, no brew config edit, no repo source edit, no service started, no SMART WMS / omlx / `~/.cache/huggingface` path touched.

## 11. Host context

```
$ brew config | grep -E "HOMEBREW_VERSION|macOS|CLT|Xcode|Rosetta|CPU|Homebrew prefix"
HOMEBREW_VERSION: 7.0.8
CPU: deca-core 64-bit arm_hidra
macOS: 27.0.1-arm64
CLT: 27.0.0.0.1788430756
Xcode: N/A
Rosetta 2: false

$ sw_vers
ProductName: macOS  ProductVersion: 27.0.1  BuildVersion: 26A434
$ ls -ld /opt/homebrew /opt/homebrew/Cellar
drwxr-xr-x  40 gsp-budi  admin  1280 Sep 11 21:58 /opt/homebrew
drwxrwxr-x  68 gsp-budi  admin  2176 Oct  1 02:53 /opt/homebrew/Cellar
```

Both prefix entries are user-writable by `gsp-budi:admin`, so an approved install would not need sudo.

## 12. Readiness statement for row 14 (GStreamer comparison prototype)

| Question | Answer |
|---|---|
| Can row 14 run a GStreamer prototype on this host right now? | **No.** No `gst-launch-1.0` / `gst-inspect-1.0` on the host (section 1 probes 5-6) |
| Is `isofmp4mux` proven available? | **No** - unverified (section 6). It would come from plugin `isobmff` / package `gst-plugin-isobmff` (F-67, F-68), built inside the single `gstreamer` formula (F-65) with meson option `auto` (F-69), which can skip it silently |
| What row 14 should do | (1) Wait for the controller decision on section 13. If approved, row 13 must be re-run to completion (install + the two `gst-inspect` gates + size/footprint) **before** row 14 builds a graph. (2) If declined or deferred, row 14 records SKIPPED citing row 13 (blueprint row 14 explicitly allows this: "or a SKIPPED record citing row 13"), and row 15 scores GStreamer as "not evaluated on host", using F-64..F-74 plus this row's footprint and collision evidence |
| Caveat to carry into row 14 even after a successful install | Verify `isofmp4mux` and `input-selector` with `gst-inspect-1.0` as the first step, and verify the fragmenting properties before designing around them; do not assume the bottle contains the Rust plugin set |
| Does any R-3 capability depend on row 14? | No. D10(c) already established the operator-triggered mic switch is achievable through the libavfilter API (FFmpeg side), so row 14 is a comparison input for row 15, not a dependency of the capture design |
| Timing advice | Do not run the install while rows 16-27 (mobile/emulator, `openjdk@17`) or any FFmpeg-based spike is in flight, and back up / record the omlx libexec patch state first (D7 red line) |

## 13. Decision options (escalated, unanswered at time of writing)

| Option | Action | Consequence |
|---|---|---|
| A | Approve the 11 implicit upgrades and let row 13 install | Meets the row gates; replaces CA/TLS/readline/compression/SDL/glib libraries under oMLX and FFmpeg, brew will flag both as needing reinstall, omlx reinstall would destroy the row-10 mlx-audio 0.5.3 patch. Needs an explicit user-level decision because D4's blanket approval covers installs, not upgrades |
| B | Decline; record SKIPPED citing this row | Zero host change; row 14 SKIPPED citing row 13; row 15 scores the GStreamer option on documented facts (F-64..F-74) plus this footprint/collision evidence instead of a live prototype. Loses only comparison data, and D10(c) shows the switch capability does not need GStreamer |
| C | Defer to a maintenance window with no sibling work in flight | Same evidence, lower blast radius; still requires approval for the 11 upgrades |

Recommendation: **B or C**. The install is comparison-only now, costs 63 new formulae plus 11 library upgrades under the stack the user told us to reuse (D7), and its own uninstall path cannot revert those upgrades (section 8).

## 14. Command log (audit trail)

| # | Command | Exit | Purpose |
|---|---|---|---|
| 1 | `command -v brew`; `brew --prefix` | 0 | prefix record (section 1) |
| 2 | `brew list --versions gstreamer gst-plugins-base ... gst-libav` | 1 | before-state + rename evidence (sections 1-2) |
| 3 | `which -a gst-inspect-1.0 gst-launch-1.0` | 1 | gate binaries absent |
| 4 | `brew list --versions gstreamer`; `brew desc gstreamer`; `ls -d /opt/homebrew/Cellar/gstreamer*`; `ps` scan | 1 / 0 / 1 / 1 | before-state, single-writer check |
| 5 | `brew list --formula \| wc -l`; `brew list --cask`; `brew --version`; `ls -ld /opt/homebrew /opt/homebrew/Cellar`; `git status --porcelain -- package.json package-lock.json` | 0 | baseline snapshot |
| 6 | `lsof -nP -iTCP -sTCP:LISTEN` (count, per-port greps) | 0 | listener baseline |
| 7 | `brew install --dry-run gstreamer` | 0 | **read-only planner** - the blocking evidence (section 3) |
| 8 | `brew list --versions <11 upgrade targets>`; `brew uses --installed <each of 11>` | 0 | upgrade targets + dependents (section 4) |
| 9 | `brew list --versions aom orc libsoup` | 1 | prove the 62 deps are genuinely absent |
| 10 | `brew info --json=v2 --formula gstreamer` (via `node -e`); `brew info` per upgrade target | 0 | licence, bottle key/url/sha, current vs target versions |
| 11 | `brew leaves`; `brew leaves \| grep -c gstreamer`; `brew autoremove --dry-run`; `brew uninstall --dry-run gstreamer` | 0 / 1 / 0 / 1 | footprint + uninstall path (sections 5, 8) |
| 12 | `brew config`; `sw_vers` | 0 | host context (section 11) |
| 13 | re-run of probes 2-6 + listener diff + `ps` scan | as before | after-state proof (section 10) |

No command in this log wrote to the Homebrew prefix, the repository, or any protected path.

## 15. Status

**blocked-needs-decision.** No install performed, no verification gates run, no SKIPPED record asserted as final: the row is one decision away from either outcome, and the decision (approve 11 library upgrades vs. decline) is above this worker's authority because it widens what Q-INSTALL blanket-approved. The artifact is complete as an evidence record: sections 4, 7, 8, 9, 12 are directly consumable by rows 14, 15 and DOC-05 (rows 36/37) without further probing.
