---
task_id: 2026-09-30_dems_demo_stack_setup
step: 60b
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D121 (launch), D74 (review 40 finding m2), D51, D64
---

# 77: THIRD_PARTY_NOTICES.md corrections (micro step 60b)

**Outcome: COMPLETE.** One section was appended to `THIRD_PARTY_NOTICES.md`: "Demo media, synthetic speech, packaged Node.js runtime and build tools (step 60b)", lines 121–177 (`diff`: `120a121,177`). No existing line changed. No other repository file was edited, `release/` was not touched, and nothing was committed. Run 2026-10-01, 10:55–11:10 WIB.

## 1. What was appended (each item → its source)

| # | Content | Sources |
|---|---|---|
| 1 | A dated correction note to the "Media assets" preamble (line 73, "never baked into the files"); the original line is kept. A row for the derived demo media: Pexels 3906592, Leandro Alamino, Pexels License, stored at `packages/shared/assets/demo-media/**` and `apps/mobile/assets/media/**`, and where it ships | `64_demo_media.md` §1, §3, §4; `45_mobile_brand_media.md` §1 (line 33); `65_demo_evidence.md` §1, §3; `verification/06_foundation_review.md` line 99 (m2); §2 checks C3–C5 |
| 2 | eSpeak NG 1.52.0 (`id`, formant), GPL-3.0-or-later; output not a derivative (GNU GPL FAQ `#GPLOutput`); no macOS system voices; Piper rejected | `64_demo_media.md` §2 (formula table), §3; D51; D64; installed `README.md` and `COPYING` (§2 C1); generator `gen-demo-media.ts:41`, `:1357` (C2) |
| 3 | Node v26.8.2 official binaries, MIT plus 44 bundled-licence entries; `licenses/NODE-LICENSE.txt` present in all 5 packages that ship a Node binary and absent from any-os-node (no binary); known issue: the packaged notices copy is stale | `70_web_packager.md` §2, §3 W4; `release/web/BUILD-INFO.txt`; `scripts/release/build-web-packages.ts:50`, `:351-354`; §2 C6–C8 |
| 4 | ffmpeg 9.0.2: build-time only, not stored, not shipped | `64_demo_media.md` §2, §4; §2 C9 |

## 2. Checks (2026-10-01, step 60b)

| # | Command (abridged) | Output |
|---|---|---|
| C1 | `espeak-ng --version`; `sed -n '/^## License Information/,/^## /p' /opt/homebrew/Cellar/espeak-ng/1.52.0/README.md`; `head COPYING*` | `eSpeak NG text-to-speech: 1.52.0`; "released under the [GPL version 3](COPYING) or later license"; `COPYING` = GNU GPL v3; also `COPYING.APACHE`, `COPYING.BSD2`, `COPYING.UCD` |
| C2 | `grep -n -E "\bsay\b\|voice.*(auto\|espeak\|synthetic)" packages/shared/scripts/gen-demo-media.ts` | `say` appears only in comments and README text saying it is not used (lines 20, 1288). Voice options at :41 and :1357 are `auto`, `espeak`, `synthetic` only |
| C3 | `cmp` of each `packages/shared/assets/demo-media/mobile/*` with `apps/mobile/assets/media/<same name>` | `identical 84/84`; `find packages/shared/assets/demo-media -type f \| wc -l` = 198 |
| C4 | SHA-256 of every `.mp4`/`.m4a` in `DEMS-Web-Demo-0.1.0-any-os-node.zip` (`unzip -p`) against the 112 demo-media A/V hashes | `hit=56 miss=1`. The miss (`AUDIO-02-TZTxN0XB.m4a`, `6fdd78d1…91c8`) matches `packages/shared/assets/demo-evidence/SESSION-SES-20260930-0015/media/AUDIO-02.m4a` (the EV 0005 tamper copy) |
| C5 | Same against `release/android/DEMS-Demo-0.1.0.apk` | `apk hit=56 miss=0` |
| C6 | `unzip -l` on each zip, `tar -tzf` on the tarball, `grep -i "licen\|notice"` | `licenses/NODE-LICENSE.txt` in macos-arm64, macos-x64, linux-x64, windows-x64, windows-x64-signed-runtime; absent in any-os-node; `licenses/THIRD_PARTY_NOTICES.md` (11,623 B) in all 6 |
| C7 | `unzip -p … \| shasum -a 256` (no extraction to disk) vs `.cache/release/node-v26.8.2/extract-*/…/LICENSE` | Packaged copies equal the archive LICENSE: `5888dbb9…2ace` (darwin-arm64, darwin-x64, linux-x64), `ed34dd8e…f8e9` (win-x64, CRLF; `tr -d '\r'` gives `5888dbb9…2ace`). Packaged notices copy = `4c5cbdfd…0ceb3` in all 6 (pre-60b file) |
| C8 | `head -4`, `grep -c '^- .*, located at'`, `wc -l` on the Node LICENSE | MIT text ("Permission is hereby granted…"); 44 entries; 2,946 lines |
| C9 | `unzip -Z1`/`tar -tzf` on all packages, `grep -i -E "ffmpeg\|espeak\|libav\|x264"`; `find . (-iname "*ffmpeg*" -o -iname "*espeak*")` excluding node_modules, .cache, docs | 0 hits in all 6 web packages. APK: 3 hits, all `libavif_android.so` (AVIF image decoder, not ffmpeg). Repository: no hits |
| C10 | `curl https://www.gnu.org/licenses/gpl-faq.html`; WebFetch of the same URL | `curl: (28) Connection timed out after 30006 milliseconds`; WebFetch failed with no output. So the `#GPLOutput` citation rests on step 92's reading (`64_demo_media.md` §3), and the notices section says this |
| C11 | `(cd release/web && shasum -a 256 -c SHA256SUMS.txt)` after the edit | 6× `OK`: `release/` is unchanged |

## 3. Verification of the edit

| Check | Output |
|---|---|
| Before the edit | `THIRD_PARTY_NOTICES.md` 11,623 B, SHA-256 `4c5cbdfd5b06098283af2420da1969ac094e345fb2afa6a76a5e34a5f660ceb3` (mtime 03:23:43, step 37). `git diff --stat` vs HEAD: `53 insertions(+)` (from earlier steps), 0 deletions |
| `head -c 11623 THIRD_PARTY_NOTICES.md \| cmp - <backup>` | "first 11623 B identical to pre-edit file": every existing line is byte-identical |
| `tail -c +11624 … \| cmp - <section file>` | "tail == appended section" |
| `git diff --stat THIRD_PARTY_NOTICES.md` | ` THIRD_PARTY_NOTICES.md \| 110 +++…`, `1 file changed, 110 insertions(+)` (53 earlier + 57 new); `git diff --numstat` = `110 0`; removed lines = 0 |
| After the edit | 20,004 B, 177 lines, SHA-256 `4cbdec5c7db06edc1592e8b2c66a01f150e560aacdbe2e579265f8c9c5d7920f` |

No test, build or lint command applies: this is a Markdown-only change.

## 4. Hand-overs

- **Next package rebuild (owner: packaging, steps 94/95 or their successor).** Every `release/web/` package carries the pre-60b notices copy (`4c5cbdfd…`). The packager picks up the current file on its next run (`build-web-packages.ts:50`, `:354`). No rebuild was done here, because `release/` was out of scope.
- **APK (informational).** `release/android/DEMS-Demo-0.1.0.apk` contains no copy of `THIRD_PARTY_NOTICES.md` (C6-style listing: 0 matches for `THIRD_PARTY`), but it ships the 56 derived A/V files (C5). The Pexels License does not require attribution, so this is not a compliance gap. Whether the APK should carry the notices is for the next APK build owner to decide.
- **Step 62** checks this section, as D74 assigns.

---
*Generated: 2026-10-01 11:10 WIB*
