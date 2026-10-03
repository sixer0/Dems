---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
step: 94b
date: 2026-10-01
agent: coder-execution
source: verification/09_mobile_security.md (F63-01, F63-03); decisions/decisions.md D125
status: complete
tier: 3
---

# 79 - Android release docs and licences (step 94b, D125)

Closes F63-01 and F63-03 without rebuilding the APK. Work window 11:16-11:24 WIB.

## 1. What changed

| File | Change | Purpose |
|---|---|---|
| `release/android/INSTALL-ANDROID.md` | modify (+18 lines, 0 removed) | F63-01 "After installing" steps, EN + ID; pointer to `licenses/` |
| `release/android/licenses/THIRD_PARTY_NOTICES.md` | new (copy of repo root file) | F63-03 |
| `release/android/licenses/OFL-1.1-Inter.txt`, `OFL-1.1-Orbitron.txt`, `OFL-1.1-JetBrainsMono.txt` | new (copies of `node_modules/@expo-google-fonts/<font>/LICENSE_FONT`) | F63-03, OFL-1.1 must travel with the fonts |
| `release/android/licenses/Apache-2.0-MaterialSymbols.txt` | new (copy of `@expo-google-fonts/material-symbols/LICENSE_FONT`) | Extra finding, see section 3 |
| `release/android/licenses/THIRD-PARTY-LICENSES.txt` | new (generated, 1,440,578 B, 28,910 lines) | F63-03, npm production dependency licences |
| `release/android/licenses/README.txt` | new (index; maps the 9 `res/*.ttf` to licence files; states limits) | F63-03 |
| `release/android/SHA256SUMS.txt` | modify (APK line unchanged; +7 `licenses/` lines) | Task item 3 |
| `scripts/release/gen-npm-licenses.mjs` | new (Node built-ins only, no network) | Generator; reusable with `--workspace <name> --out <file>` |

Not changed: the APK, `DEMS-Demo-0.1.0.apk.sha256`, `BUILD-INFO.txt`, `release/web/**`, `release/RUN-ON-ANOTHER-PC.md`.

## 2. F63-01 - install guide

- Method A, new step 7: unplug, turn *USB debugging* off, tap *Revoke USB debugging authorisations*; on again only for an update.
- Method B, new step 5: Android 8+ turn off *Allow from this source* for *Files* (and any other app used); Android 7 turn *Unknown sources* off; turn off *USB debugging* if it was on.
- Section 8 (Indonesian summary): two "Setelah terpasang" bullets (Cara A, Cara B) and one licences bullet.
- No section was renumbered, so existing references (`section 2, step 6`, `section 3`) still hold.

## 3. F63-03 - licences

- Fonts in the APK: `unzip -l` shows 9 `res/*.ttf`. Each was matched by SHA-256 to its source file: Inter 400/500/600/700, Orbitron 700, JetBrains Mono 400/500 (all OFL-1.1), **Material Symbols Regular** (`P1.ttf`, 966,544 B, from `expo-symbols -> @expo-google-fonts/material-symbols@0.4.48`, Apache-2.0) and a **Roboto Medium numerals subset** (`RV.ttf`, 3,316 B, identical to `media3-ui-1.9.0/res/font/roboto_medium_numbers.ttf` in the Gradle cache; AndroidX Media3, Apache-2.0).
  - Finding F63-03 named only three font families ("9 `res/*.ttf`" as Inter, Orbitron, JetBrains Mono). Two of the nine are Apache-2.0 fonts; the Apache-2.0 text is now shipped too.
- npm list: `node scripts/release/gen-npm-licenses.mjs --workspace @dems/mobile --out release/android/licenses/THIRD-PARTY-LICENSES.txt --title "..."`.
  - Source: `npm ls --omit=dev --all --json --long -w @dems/mobile`. npm exits 1 with `ELSPROBLEMS` (`invalid: ajv-formats@3.0.1`), but prints the full tree; the script accepts that and records "npm ls problems reported: 1".
  - Result: **819** unique name@version; **76** ship no licence file (licence name from `package.json`, listed at the end); 0 with unknown licence. `@dems/shared` (first-party) is not listed.
  - Licence counts: MIT 690, ISC 53, BSD-3-Clause 23, Apache-2.0 14, BSD-2-Clause 12, BlueOak-1.0.0 6, MPL-2.0 6, "MIT AND OFL-1.1" 3, other 12 (0BSD, Unlicense, CC0-1.0, CC-BY-4.0 `caniuse-lite`, Python-2.0 `argparse`, `node-forge` "(BSD-3-Clause OR GPL-2.0)" and three dual MIT forms).
  - Output is deterministic: a second run gave the same SHA-256. It contains no absolute path (`grep -c "/Users/"` = 0).
- No reusable script from step 95b existed at 11:18 (`scripts/release/` held only `build-web-packages.ts`), so a new one was written. Step 95b can call it with `--workspace @dems/core-web`.

## 4. Verification (run at 11:22-11:23 WIB)

`cd release/android && shasum -a 256 -c SHA256SUMS.txt`:

```
DEMS-Demo-0.1.0.apk: OK
licenses/Apache-2.0-MaterialSymbols.txt: OK
licenses/OFL-1.1-Inter.txt: OK
licenses/OFL-1.1-JetBrainsMono.txt: OK
licenses/OFL-1.1-Orbitron.txt: OK
licenses/README.txt: OK
licenses/THIRD-PARTY-LICENSES.txt: OK
licenses/THIRD_PARTY_NOTICES.md: OK
```

| Check | Command | Result |
|---|---|---|
| APK unchanged | `shasum -a 256 release/android/DEMS-Demo-0.1.0.apk` | `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd`; mtime still 10:41:26 |
| Notices copy current | `shasum -a 256` root file and copy | both `4cbdec5c7db06edc1592e8b2c66a01f150e560aacdbe2e579265f8c9c5d7920f` |
| Font licence copies | `shasum -a 256` source and copy | identical for all four (`5b9321a4…`, `ab609b0e…`, `b2fe5e89…`, `58d1e17f…`) |
| Generator deterministic | second run to a scratch file | `cea29c2439f40e68…` both times |
| Script syntax | `node --check scripts/release/gen-npm-licenses.mjs` | ok |
| Guide diff | `diff` against the pre-edit copy | 18 lines added, 0 removed |
| Test servers | `lsof -iTCP:<port> -sTCP:LISTEN` | 5173, 4400, 8081 still listening (PIDs 42998, 42967, 43101); not touched |

## 5. Open points for the controller

| # | Point | Status |
|---|---|---|
| 1 | `release/RUN-ON-ANOTHER-PC.md` (section 8 and the ID summary) does not yet say "turn USB debugging off afterwards". It is **generated** by `scripts/release/build-web-packages.ts:523-654` and step 95b was active (progress file mtime 11:14:51), so it was left alone. It already points to `android/INSTALL-ANDROID.md` for the full steps. Add one line in the generator after 95b finishes, if wanted | not done (by rule) |
| 2 | Android (Maven) libraries such as AndroidX and Kotlin are not listed one by one. `licenses/README.txt` states this gap | known issue |
| 3 | The APK's *Settings > About* text still says "at the root of the repository" (`apps/mobile/src/features/settings/i18n.ts:99-105`). The guide and `licenses/README.txt` explain where the file is in this package. Reword at the next APK build | known issue |
| 4 | `SHA256SUMS.txt` lists the APK and `licenses/*` only (as instructed), not `INSTALL-ANDROID.md` or `BUILD-INFO.txt` | by design |
| 5 | `THIRD-PARTY-LICENSES.txt` covers the whole npm production tree, which is more than what is in the APK (for example the Scalar packages under `@dems/shared`) | by design, stated in the file header |
| 6 | Shared tracking files (`masterplan/02_plan.md`, `status_tasks.md`, `99_implementation_report.md`) were not written (parallel run) | controller to synthesise |

---
*Generated: 2026-10-01 11:24 WIB*
