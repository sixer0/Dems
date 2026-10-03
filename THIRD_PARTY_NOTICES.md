# Third-Party Notices

Source files copied into this repository from third-party registries (copy-in model; `shadcn init` is never run, 03 SD-27, F4). Each item keeps its original licence. npm dependencies carry their own licence files inside `node_modules` and are not listed here.

| Item | Collection | Licence | Source URL | Retrieved | Copied to |
|---|---|---|---|---|---|
| BorderBeam | Magic UI | MIT | `https://magicui.design/r/border-beam.json` | 2026-10-01 | `apps/core-web/src/components/ui/border-beam.tsx` |
| SlidingNumber | Motion Primitives | MIT | `https://motion-primitives.com/c/sliding-number.json` | 2026-10-01 | `apps/core-web/src/components/ui/sliding-number.tsx` (one local change: `as const` on `TRANSITION` for TypeScript 6 literal typing) |

Licence texts below were retrieved on 2026-10-01 from the upstream repositories: Magic UI `https://raw.githubusercontent.com/magicuidesign/magicui/main/LICENSE.md`; Motion Primitives `https://raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md`.

---

## Magic UI

```
MIT License

Copyright (c) Magic UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Motion Primitives

```
MIT License

Copyright (c) 2024 ibelick

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
app/page.tsx
```

---

## Media assets

Third-party media stored in this repository. Each file keeps its source licence. The files are only resized and re-encoded. Colour grading (brightness, sepia, saturation, warm overlay) and the camera-feed crops are applied at runtime in CSS or canvas, never baked into the files.

| Item | Source | Author | Licence | Source URL | Retrieved | Stored at | Used by |
|---|---|---|---|---|---|---|---|
| Hero room still: an empty meeting room with a table and chairs (no people, no insignia, no readable text) | Pexels, photo 3906592 | Leandro Alamino (`https://www.pexels.com/@leandroalamino/`) | Pexels License | `https://www.pexels.com/photo/black-leather-office-rolling-chairs-beside-brown-wooden-table-3906592/` | 2026-10-01 | `packages/shared/assets/hero/room-2560.jpg` (2560×1706) and `packages/shared/assets/hero/room-1600.jpg` (1600×1066) | `apps/core-web`: Dashboard hero, Login brand side, procedural CameraFeed crops and posters. `apps/mobile`: the 1600 px variant (copied by the mobile brand-media row to `apps/mobile/assets/images/hero/`) for the hero backdrop, CameraFeed and thumbnails |

Hero still details:
- **Original download:** `https://images.pexels.com/photos/3906592/pexels-photo-3906592.jpeg`, 6000×4000, sRGB, SHA-256 `58b7f0d69e8ac390cb9fcb5bb277fdf1af876bd71600b61a925ec6ec3d375ec0`. The original is not stored in the repository.
- **Derivatives:** macOS `sips --resampleWidth <2560|1600> -s format jpeg -s formatOptions 80`, both resampled from the original.
  - `room-2560.jpg`: SHA-256 `93d04e0062f93710d426a45febb23ca471e7f953f8b873405f471108fcb676db`.
  - `room-1600.jpg`: SHA-256 `c8f8721cf737611f566532b6a2ac738e6bafd7dc0968655d457d4d06397066a3`.
- **Licence terms** (Pexels License, `https://www.pexels.com/license/`, read on 2026-10-01):
  - Free to use and to modify. Attribution is not required; the credit above is given voluntarily.
  - Not allowed: selling unaltered copies; redistributing on stock or wallpaper platforms; implying endorsement by people or brands shown; using the image in a trade mark, design mark, trade name, business name or service mark.
  - Here the photo is only a UI background inside a demo application, so none of these restrictions applies.

---

## Magic UI and Motion Primitives items (step 37)

Thirteen more items copied in the same way as BorderBeam and SlidingNumber above: no `shadcn init`, no `components.json`, and no new npm package. Every item depends only on `motion` (13.4.6, already installed) or on nothing. Both collections are MIT. Their licence texts are the two reproduced above; on 2026-10-01 both upstream licence files were fetched again and are byte-identical to those texts. GitHub reports `MIT` for both repositories.

Only free, open-source items are used. Each one was checked against the upstream MIT repository, at `magicuidesign/magicui` commit `d7207e5692d14c00dceafa8488d6d01f197fa0e4` and `ibelick/motion-primitives` commit `120f64f6ca60348e251f929e9c81f11ccbe45eda`. No Magic UI Pro item is used, and nothing under Commons Clause, AGPL or any other paid licence.

Each file keeps an attribution header. That header lists every local change, and each change is also marked `// DEMS:` in the code. The local changes adapt the items to the design tokens (`@dems/shared/tokens`) and to the step-36 motion policy (`apps/core-web/src/motion`: reduced motion, proof mode, and the ambient-loop registry with a cap of 4). They also make the items compile under the app's TypeScript 6 settings. Where an item used a registry CSS `@keyframes` rule, it was re-expressed with Motion, because the copy-in model never edits the global stylesheet. The per-item change list is in `docs/2026-09-30_dems_demo_stack_setup/implementation/18_copy_in_items.md`.

Every item was retrieved on 2026-10-01 (03:16 WIB).

| Item | Collection | Licence | Source URL | Upstream file (MIT repository) | Upstream SHA-256 (source text) | Copied to |
|---|---|---|---|---|---|---|
| AnimatedNumber | Motion Primitives | MIT | `https://motion-primitives.com/c/animated-number.json` | `components/core/animated-number.tsx` (identical) | `3b4a9f3262cb79527fba01a76576e920e340137f0643bf34a7732f7f8b1ff792` | `apps/core-web/src/components/ui/animated-number.tsx` |
| TextEffect | Motion Primitives | MIT | `https://motion-primitives.com/c/text-effect.json` | `components/core/text-effect.tsx` (identical) | `4b93c0ea6b9d747d69b7a244d5279f790a11a784e73713f3fe17a636abf53484` | `apps/core-web/src/components/ui/text-effect.tsx` |
| TextShimmer | Motion Primitives | MIT | `https://motion-primitives.com/c/text-shimmer.json` | `components/core/text-shimmer.tsx` (identical) | `a294c8a1092296a38e28128ad8f2953401fcca85b5ae29ee479bd71bfac3348e` | `apps/core-web/src/components/ui/text-shimmer.tsx` |
| TextScramble | Motion Primitives | MIT | `https://raw.githubusercontent.com/ibelick/motion-primitives/main/components/core/text-scramble.tsx` | Same file. The registry JSON `https://motion-primitives.com/c/text-scramble.json` is one revision behind: it lacks upstream fix #182 (commit `92586e6`), which derives the displayed text from `children` | `119cda3b695ee97235ab7aaa62698a98e881d5bdc8b9c96d2597730cd07aeff2` | `apps/core-web/src/components/ui/text-scramble.tsx` |
| TransitionPanel | Motion Primitives | MIT | `https://motion-primitives.com/c/transition-panel.json` | `components/core/transition-panel.tsx` (identical) | `1b3c67058a09a560a034b7fe52ad1c205b589a63ed80055900e8a66830db0be2` | `apps/core-web/src/components/ui/transition-panel.tsx` |
| AnimatedBackground | Motion Primitives | MIT | `https://motion-primitives.com/c/animated-background.json` | `components/core/animated-background.tsx` (identical) | `fa592713c408eaf58b21976c20737d84239c42a0b7e47cf9e7843121b1c0852c` | `apps/core-web/src/components/ui/animated-background.tsx` |
| Spotlight | Motion Primitives | MIT | `https://motion-primitives.com/c/spotlight.json` | `components/core/spotlight.tsx` (identical) | `04419912db5ebe72a03199a39265a3db33398b3c48c0e854e9fb5be604700041` | `apps/core-web/src/components/ui/spotlight.tsx` |
| AnimatedList (with AnimatedListItem; item variants edited per motion spec M-C-07) | Magic UI | MIT | `https://magicui.design/r/animated-list.json` | `apps/www/registry/magicui/animated-list.tsx` (identical) | `9363c5afa61d7aab1919b4500f7325cc8871b35103d5dd60a2a1625fe5e7dc58` | `apps/core-web/src/components/ui/animated-list.tsx` |
| Ripple | Magic UI | MIT | `https://magicui.design/r/ripple.json` | `apps/www/registry/magicui/ripple.tsx` (identical) | `1ac207017c0f4e993f83a1ead8b8a1b4a92286ef1595a297aba79782b2616eaf` | `apps/core-web/src/components/ui/ripple.tsx` |
| ShineBorder | Magic UI | MIT | `https://magicui.design/r/shine-border.json` | `apps/www/registry/magicui/shine-border.tsx` (identical) | `c9344b563c2427f26393f6f5e2fe5c72d6a3fcb4b90b8f073ebad515e963c46c` | `apps/core-web/src/components/ui/shine-border.tsx` |
| OrbitingCircles | Magic UI | MIT | `https://magicui.design/r/orbiting-circles.json` | `apps/www/registry/magicui/orbiting-circles.tsx` (identical) | `859b88b6c22144e5cd4bf04ab49d339090eea13b422d3085a80584e6b9d4da68` | `apps/core-web/src/components/ui/orbiting-circles.tsx` |
| AnimatedBeam | Magic UI | MIT | `https://magicui.design/r/animated-beam.json` | `apps/www/registry/magicui/animated-beam.tsx` (identical) | `6afa2ee1d01694a428eb8517d48deebe5c6b532dc0ee871800bb9d92aae43e79` | `apps/core-web/src/components/ui/animated-beam.tsx` |
| Particles | Magic UI | MIT | `https://magicui.design/r/particles.json` | `apps/www/registry/magicui/particles.tsx` (identical) | `f768e19deca7c0ba9c424b4683b62cae3eedd11ef3dac8b0363e65c2773f236e` | `apps/core-web/src/components/ui/particles.tsx` |

Notes:
- **Repository roots.** Magic UI paths are relative to `https://github.com/magicuidesign/magicui/blob/main/`. Motion Primitives paths are relative to `https://github.com/ibelick/motion-primitives/blob/main/`.
- **Registry keyframes.** The Magic UI registry entries for Ripple, ShineBorder and OrbitingCircles also carry CSS keyframes (`ripple`, `shine` and `orbit`). Their timing and geometry were reproduced in Motion inside each copied file.
- **Trailing line in the licence file.** The Motion Primitives licence text above ends with the line `app/page.tsx`. That line is present in the upstream `LICENCE.md` itself (re-checked on 2026-10-01) and was kept as found.

---

## Demo media, synthetic speech, packaged Node.js runtime and build tools (step 60b)

Appended on 2026-10-01 by controller micro step 60b (decision D121). This section applies review finding m2 of step 40 (decision D74) and records the packaging work of step 95. Nothing above this section was changed. Log paths are relative to `docs/2026-09-30_dems_demo_stack_setup/`:
- "64": `implementation/64_demo_media.md` (step 92: demo media generator and host install);
- "65": `implementation/65_demo_evidence.md` (step 93: demo evidence packages);
- "45": `implementation/45_mobile_brand_media.md` (step 72: mobile media copy);
- "70": `implementation/70_web_packager.md` (step 95: web packages);
- "06": `verification/06_foundation_review.md` (step 40 review, finding m2);
- "77": `implementation/77_notices_update.md` (this step: the commands and outputs behind every "checked on 2026-10-01" below).

**Correction note (2026-10-01) to the "Media assets" preamble.** That preamble says the files "are only resized and re-encoded" and that grading and crops are "never baked into the files". This holds only for the two hero stills (`room-2560.jpg`, `room-1600.jpg`). It does not hold for the demo media listed below: their crops, colour grade, camera motion, noise, vignette, scanline band and on-screen display (OSD) are baked into the video and image files (64 §4; 06 m2). The original sentence is kept as written.

### Demo media derived from the Pexels hero still

| Item | Derived from | Licence | Stored at | Generator |
|---|---|---|---|---|
| Demo interview videos, posters and thumbnails for evidence items EV 0001–0013, and the live loops of session 0024 (desktop set 1280×720; mobile subset 640×360) | Pexels photo 3906592 by Leandro Alamino, through `packages/shared/assets/hero/room-2560.jpg` (the hero row under "Media assets" above) | Pexels License (terms summarised under "Media assets" above) | `packages/shared/assets/demo-media/**` (198 files, including `media-index.json` and `README.md`; 64 §1) and `apps/mobile/assets/media/**` (84 files, byte copies of `packages/shared/assets/demo-media/mobile/*`; 45 §1; 84 of 84 still identical, checked on 2026-10-01, 77) | `packages/shared/scripts/gen-demo-media.ts` (step 92; 64 §4) |

- **How the pictures are derived.** Camera 1 is a 16:9 band of the room still; camera 2 is a mirrored reverse-angle crop. Both are colour graded (dark-warm) and get a slow push-in and drift, seeded noise, a vignette, a scanline band and the OSD. They are then encoded with ffmpeg (64 §4). No other image source is used. The OSD font is a hand-authored 5x7 bitmap inside the generator, so no font licence applies (64 §2 "Capability finding"; 64 §3).
- **Where they ship.** Each `release/web/` package carries 57 audio and video files. 56 are byte-identical to files in `packages/shared/assets/demo-media/`. The 57th is the deliberately altered copy of EV 0005 `AUDIO-02` used by the tamper demonstration, `packages/shared/assets/demo-evidence/SESSION-SES-20260930-0015/media/AUDIO-02.m4a` (65 §1, §3). `release/android/DEMS-Demo-0.1.0.apk` carries 56 audio and video files, all byte-identical to the mobile subset (checked on 2026-10-01, 77).
- **Licence fit.** The Pexels License allows modification and does not require attribution; the credit is given voluntarily. The restrictions listed under "Media assets" do not apply here, for the same reason as for the hero still: the media are demo footage and backgrounds inside a demo application.

### Synthetic speech (interview audio)

- **Engine.** Every speech track was generated with **eSpeak NG 1.52.0**, Indonesian voice `id` (`poz/id`, formant synthesis) with built-in variants: MIC 1 `AUDIO-01`, MIC 2 `AUDIO-02` and the live-loop audio. No MBROLA voice was used (64 §3; D64). Step 92 installed it from the Homebrew bottle `espeak-ng/1.52.0` (64 §2). On 2026-10-01, `espeak-ng --version` prints `eSpeak NG text-to-speech: 1.52.0` (77).
- **Licence of the program: GPL-3.0-or-later.** Sources:
  - the installed `/opt/homebrew/Cellar/espeak-ng/1.52.0/README.md`, section "License Information" ("released under the GPL version 3 or later license");
  - the installed `COPYING` (the GNU GPL version 3 text);
  - Homebrew's licence field, recorded in 64 §2.

  The same tree also holds `COPYING.APACHE`, `COPYING.BSD2` (the Windows-only `getopt_long` code) and `COPYING.UCD` (Unicode data) for bundled parts (77).
- **The generated audio is not a derivative of the program.** eSpeak NG ran only as a build-time tool. Neither the program nor its voice data is stored in the repository or shipped in any package (64 §3; 77). The GNU GPL FAQ, entry `#GPLOutput` (`https://www.gnu.org/licenses/gpl-faq.html#GPLOutput`), says that the copyright status of a program's output follows the input it was generated from, not the program's licence. Here the input is the generator's own fictional script (64 §3). Formant synthesis uses no recorded human samples, so no voice-dataset licence applies (64 §3). Step 92 read the FAQ entry (64 §3). A re-fetch by step 60b on 2026-10-01 failed with a network timeout, so this citation rests on the step-92 reading (77).
- **No macOS system voices.** macOS `say` and the macOS System Voices were not used for any track. D51 rules them out: their output licence covers personal, non-commercial use only, and this is a client demo. The generator offers only `--voice auto|espeak|synthetic` (`packages/shared/scripts/gen-demo-media.ts:41`, `:1357`), and the published media use eSpeak NG (64 §3). Piper was considered and rejected, because its only Indonesian model has no verifiable permissive licence (64 §3; D64).

### Node.js runtime in the web packages (`release/web/`)

- **Version and source.** Step 95 built the packages with the official Node.js **v26.8.2** binaries from `https://nodejs.org/dist/v26.8.2/`. Every archive matched `SHASUMS256.txt`. The GPG signature was not checked, because gpg is absent on the build host (70 §3 W4; `release/web/BUILD-INFO.txt`).
- **Licence.** Node.js is MIT. Its `LICENSE` file also reproduces the licences of the third-party components it bundles: 44 entries of the form "- <name>, located at deps/…", for example Acorn and c-ares (`.cache/release/node-v26.8.2/extract-linux-x64/node-v26.8.2-linux-x64/LICENSE`, 2,946 lines; 77).
- **Licence file inside each package (checked on 2026-10-01, 77).** Step 95's log does not mention it, so the packages were listed with `unzip -l` and `tar -tzf` and the entries hashed, without modifying `release/`. Each copy is byte-identical to the `LICENSE` in the matching official archive; the Windows text is the same text with CRLF line ends. The packager copies it in `addLicenses()` (`scripts/release/build-web-packages.ts:351-354`).

| Package | Ships a Node binary | `licenses/NODE-LICENSE.txt` (SHA-256) |
|---|---|---|
| `DEMS-Web-Demo-0.1.0-macos-arm64.zip` (SEA) | yes | present, `5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace` |
| `DEMS-Web-Demo-0.1.0-macos-x64.zip` | yes | present, `5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace` |
| `DEMS-Web-Demo-0.1.0-linux-x64.tar.gz` (SEA) | yes | present, `5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace` |
| `DEMS-Web-Demo-0.1.0-windows-x64.zip` (SEA) | yes | present, `ed34dd8e3f0a78dbaf00d0444ce8e285b015b765379c2e17880455f70370f8e9` |
| `DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip` | yes | present, `ed34dd8e3f0a78dbaf00d0444ce8e285b015b765379c2e17880455f70370f8e9` |
| `DEMS-Web-Demo-0.1.0-any-os-node.zip` | no: it runs on the host's Node 22 or newer (70 §2) | absent, as expected |

- **Known issue for the next package rebuild.** Every package also carries `licenses/THIRD_PARTY_NOTICES.md`, but that copy is the earlier version of this file (11,623 B, SHA-256 `4c5cbdfd5b06098283af2420da1969ac094e345fb2afa6a76a5e34a5f660ceb3`) and lacks this section (77). Step 60b did not modify `release/`. The packager copies the current file on its next run (`scripts/release/build-web-packages.ts:50`, `:354`).

### Build-time tool

- ffmpeg 9.0.2 (Homebrew; GPL-3.0-or-later, encoding with libx264, GPL-2.0-or-later) was used only at build time to render and encode the demo media. It is not stored in the repository and is not shipped in any package (64 §2, §4; repository and package listings checked on 2026-10-01, 77).
