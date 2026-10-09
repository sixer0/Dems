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

---

## npm packages of the Live mode release, @dems/core-server 0.2.0 (step 107)

Appended on 2026-10-04 by step 107 (plan row W85; decision D9 DN-2, which allows this file to be extended append-only). Nothing above this section was changed. The text at the top of this file says that npm dependencies are "not listed here". That held for the 0.1.0 demo. For the packages that the task "DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing" added (release `@dems/core-server` 0.2.0, "Live mode"), this section lists them, and the text at the top is left as it was. Workspace-internal packages (`@dems/shared`, and `@dems/core-server` itself) are not third-party and are not listed. Log paths are relative to `docs/2026-10-04_dems_backend_rbac_pairing/`:
- "03": `implementation/03_npm_slot_n1_server_shared.md` (step 25: server, shared and PostgreSQL binaries);
- "13": `implementation/13_npm_slot_n3_mobile_native.md` (step 35: `expo-secure-store`);
- "14": `implementation/14_npm_slot_n2_web.md` (step 36: `qrcode.react`);
- "85": `implementation/85_third_party_notices.md` (this step: the commands and outputs behind every version, licence identifier and licence file name below).

**How the entries were read.** On 2026-10-04 the version, the licence identifier and the licence file name of every package below were read from the package itself, in `node_modules/<name>/` (its `package.json` and its licence file); nothing was fetched from a registry. Every package sits in the hoisted folder `node_modules/<name>/`, except the one nested copy named in its own row; `apps/core-server/node_modules` holds no package (85). The copyright line is copied from the licence file, without change. For every package that has a licence file, the identifier in `package.json` and the licence text agree (0 mismatches, 85). The licence texts are not reproduced here: each package carries its own, as the text at the top of this file says, except the three packages that carry none (note 1 below).

### Direct dependencies added by this task

Every package below was added to a manifest after commit `acaff20`, or is installed by one that was (`@embedded-postgres/darwin-arm64`). "Installed version" is the version in the package's own `package.json`; it equals the pin in the manifest (03 §5.1; 13; 14), except that `expo-secure-store` is declared with a `~` range (note 4).

| Package | Installed version | Licence (`package.json`) | Licence file in the package | Copyright line in that file | Declared in |
|---|---|---|---|---|---|
| `embedded-postgres` | 18.4.0-beta.17 | MIT | `LICENSE.md` | `Copyright (c) 2022 Lei Nelissen` | root (dev) |
| `@embedded-postgres/darwin-arm64` | 18.4.0-beta.17 | MIT | `LICENSE.md` | `Copyright (c) 2022 Lei Nelissen` | installed by `embedded-postgres` (optional dependency `^18.4.0-beta.17`); no DEMS manifest names it |
| `pg` | 8.23.1 | MIT | `LICENSE` | `Copyright (c) 2010 - 2021 Brian Carlson` | root (dev); `@dems/core-server` |
| `qrcode.react` | 4.2.0 | ISC | `LICENSE` | `Copyright (c) 2015, Paul O’Shannessy` | `@dems/core-web` |
| `expo-secure-store` | 57.0.4 | MIT | `LICENSE` | `Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)` | `@dems/mobile` `~57.0.4` |
| `@fastify/cookie` | 11.1.2 | MIT | `LICENSE` | `Copyright (c) 2017-present The Fastify team <https://github.com/fastify/fastify#team>` | `@dems/core-server` |
| `@fastify/helmet` | 13.1.1 | MIT | `LICENSE` | `Copyright (c) 2017-present The Fastify team <https://github.com/fastify/fastify#team>`; `Copyright (c) 2012-2017 Evan Hahn, Adam Baldwin` | `@dems/core-server` |
| `@fastify/rate-limit` | 11.2.0 | MIT | `LICENSE` | `Copyright (c) 2018-present The Fastify team <https://github.com/fastify/fastify#team>` | `@dems/core-server` |
| `@fastify/swagger` | 9.9.1 | MIT | `LICENSE` | `Copyright (c) 2017-present The Fastify team <https://github.com/fastify/fastify#team>` | `@dems/core-server` |
| `drizzle-orm` | 0.45.3 | Apache-2.0 | none found | no licence file in the package | `@dems/core-server` |
| `fastify-type-provider-zod` | 7.0.0 | MIT | `LICENSE` | `Copyright (c) 2022-2024 turkerdev` | `@dems/core-server` |
| `openapi-types` | 12.1.3 | MIT | `LICENSE` | `Copyright (c) 2018 Kogo Softare LLC` | `@dems/core-server` |
| `rate-limiter-flexible` | 11.2.1 | ISC | `LICENSE.md` | `Copyright 2019 Roman Voloboev` | `@dems/core-server` |
| `@types/pg` | 8.23.1 | MIT | `LICENSE` | `Copyright (c) Microsoft Corporation.` | `@dems/core-server` (dev) |
| `@vitest/coverage-v8` | 5.0.3 | MIT | `LICENSE` | `Copyright (c) 2021-Present VoidZero Inc. and Vitest contributors` | `@dems/core-server` (dev) |
| `drizzle-kit` | 0.31.11 | MIT | none found | no licence file in the package | `@dems/core-server` (dev) |

Notes:
1. **No licence file in the package.** `drizzle-orm`, `drizzle-kit` and (in the transitive table below) `@drizzle-team/brocli` ship no `LICENSE`, `LICENCE`, `COPYING` or `NOTICE` file. Their folders were searched to a depth of three levels, and `README.md` has no licence statement either. The identifier in the table is the `license` field of the package's own `package.json` and nothing more; no licence text was written for them. (The only licence file found below `drizzle-kit` belongs to the `esbuild` copy nested in it.)
2. **Two copyright holders.** The `LICENSE` of `@fastify/helmet` also carries the copyright of the `helmet` code it wraps; both lines are in the table.
3. **Bundled code in `qrcode.react`.** Its `LICENSE` says the package bundles the QR Code generator library, available under the MIT licence, and points to `src/third-party/qrcodegen`. That folder is not in the installed package. The compiled file `lib/index.js` carries, in the block at lines 66 to 70, the notice `Copyright (c) Project Nayuki.` with `SPDX-License-Identifier: MIT`. The text of that MIT licence is not in the package.
4. **`expo-secure-store`** is declared as `~57.0.4` (the form Expo's bundled module list gives); 57.0.4 is installed (13).
5. **`@types/pg`** had no version in the plan; the install resolved it to 8.23.1 (03 §5.1).
6. **`@embedded-postgres/darwin-arm64`** holds the PostgreSQL 18.4 binaries and is covered, together with `embedded-postgres`, in the last subsection.

### Tools and libraries already installed at `acaff20`, used by the new workspace

These were installed before this task (they are in the lockfile at `acaff20`) and the manifest of `apps/core-server` now declares them (03 §5.2; for `react`, 14). They are listed because the new workspace uses them at run time or build time. The first four are the tools named by gap GP-05 of the plan; the others are the remaining packages that the new manifest declares.

| Package | Installed version | Licence (`package.json`) | Licence file in the package | Copyright line in that file | Named by | Declared in `@dems/core-server` |
|---|---|---|---|---|---|---|
| `tsx` | 4.23.15 | MIT | `LICENSE` | `Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>` | gap GP-05 | run time |
| `typescript` | 6.0.3 | Apache-2.0 | `LICENSE.txt` | none in the file (it holds the Apache License 2.0 text only) | gap GP-05 | dev |
| `oxlint` | 1.86.0 | MIT | `LICENSE` | `Copyright (c) 2024-present VoidZero Inc. & Contributors`; `Copyright (c) 2023 Boshen` | gap GP-05 | dev |
| `@types/node` | 26.6.3 | MIT | `LICENSE` | `Copyright (c) Microsoft Corporation.` | gap GP-05 | dev |
| `fastify` | 5.12.5 | MIT | `LICENSE` | `Copyright (c) 2016-present The Fastify team <https://github.com/fastify/fastify#team>` | `apps/core-server/package.json` only | run time |
| `@fastify/websocket` | 11.3.1 | MIT | `LICENSE` | `Copyright (c) 2017-present The Fastify team <https://github.com/fastify/fastify#team>` | `apps/core-server/package.json` only | run time |
| `ws` | 8.22.0 | MIT | `LICENSE` | `Copyright (c) 2011 Einar Otto Stangvik <einaros@gmail.com>`; `Copyright (c) 2013 Arnout Kazemier and contributors`; `Copyright (c) 2016 Luigi Pinca and contributors` | `apps/core-server/package.json` only | dev |
| `@types/ws` | 8.18.2 | MIT | `LICENSE` | `Copyright (c) Microsoft Corporation.` | `apps/core-server/package.json` only | dev |
| `zod` | 4.6.5 | MIT | `LICENSE` | `Copyright (c) 2025 Colin McDonnell` | `apps/core-server/package.json` only | run time |
| `vitest` | 5.0.3 | MIT | `LICENSE.md` | `Copyright (c) 2021-Present VoidZero Inc. and Vitest contributors` (first line; the file also lists the licences of bundled code) | `apps/core-server/package.json` only | dev |
| `react` | 19.2.3 | MIT | `LICENSE` | `Copyright (c) Meta Platforms, Inc. and affiliates.` | `apps/core-server/package.json` only | run time |

### Transitive packages flagged by an npm slot

The slot log of step 25 flags these two for this section (03 §6 and §11: F-8; §12: DN-5). Neither is a direct dependency.

| Package | Installed version | Licence (`package.json`) | Licence file in the package | Copyright line in that file | Required by | Installed at |
|---|---|---|---|---|---|---|
| `fast-uri` (nested copy) | 3.1.8 | BSD-3-Clause | `LICENSE` | `Copyright (c) 2011-2021, Gary Court until https://github.com/garycourt/uri-js/commit/a1acf730b4bba3f1097c9f52e7d9d3aba8cdcaae`; `Copyright (c) 2021-present The Fastify team <https://github.com/fastify/fastify#team>` | `json-schema-resolver` 3.0.0 (from `@fastify/swagger`; `json-schema-resolver` declares `fast-uri` `^3.0.5`) | `node_modules/json-schema-resolver/node_modules/fast-uri/` |
| `@drizzle-team/brocli` | 0.10.2 | Apache-2.0 | none found | no licence file in the package | `drizzle-kit` 0.31.11 (declares `@drizzle-team/brocli` `^0.10.2`) | `node_modules/@drizzle-team/brocli/` |

Notes:
1. **`fast-uri`.** Three copies are on disk. This task added only the nested copy under `json-schema-resolver` (3.1.8, reached through `@fastify/swagger`); it is the one read for the row above. The other two were already in the lockfile at `acaff20`: `node_modules/fast-uri` 4.2.1 and `node_modules/ajv/node_modules/fast-uri` 3.1.8, both BSD-3-Clause in their `package.json`. The licence file of the nested copy has the three conditions of the BSD 3-clause licence (the third one names "contributors" instead of the owner).
2. **`@drizzle-team/brocli`** (required by `drizzle-kit`) ships no licence file; see note 1 of the first table.

### PostgreSQL 18.4 binaries (`embedded-postgres` and `@embedded-postgres/darwin-arm64`)

- **What is installed.** `embedded-postgres` 18.4.0-beta.17 is a small Node.js wrapper. Its optional dependency `@embedded-postgres/darwin-arm64` 18.4.0-beta.17 holds the PostgreSQL 18.4 binaries for this host (`native/bin/postgres`; `postgres --version` prints `postgres (PostgreSQL) 18.4`, checked on 2026-10-04, 85). The project starts them with its own scripts in `scripts/pg/`; the wrapper's lifecycle code is not imported (decision D11, TD-02). Both packages live in the git-ignored `node_modules/`. Neither is stored in the repository, and no package of this task ships them (decisions D4 Q7 and D11 TD-13: no live package for another PC in this task).
- **Install script.** The platform package declares one `postinstall` script (`scripts/hydrate-symlinks.js`). It was read before it was approved, by exact name and version (03 §7.3; decision D27).

**Packaging licence of the two npm packages, as the packages state it** (read on 2026-10-04, 85):

| Package | `license` in `package.json` | Licence file | Copyright line in that file | Statement in `README.md` |
|---|---|---|---|---|
| `embedded-postgres` 18.4.0-beta.17 | MIT | `LICENSE.md` | `Copyright (c) 2022 Lei Nelissen` | binaries: Apache License 2.0; the package's own code: MIT (`README.md` lines 191 to 192) |
| `@embedded-postgres/darwin-arm64` 18.4.0-beta.17 | MIT | `LICENSE.md` | `Copyright (c) 2022 Lei Nelissen` | binaries: Apache License 2.0; the package's own code: MIT (`README.md` lines 62 to 63) |

- The two `LICENSE.md` files are byte-identical (SHA-256 `e094f576ecd150e7cad723e0bd56c13bd42ce9f4df61af14f439d852b39ad4d4`).
- **Packaging licence, as stated.** The wrapper's own code is MIT (`package.json` and `LICENSE.md` of both packages). The `README.md` of both packages says, in its section "Credits and Licensing", that the binaries are made available under the Apache License 2.0 and the package's own code under the MIT licence; it says the packaging is based on zonky's `embedded-postgres-binaries`. The two statements are kept as found. **No file with the text of the Apache License 2.0 is in either package.**
- **PostgreSQL's own licence: the PostgreSQL License.** That the PostgreSQL server itself is under the PostgreSQL License is stated by the plan (02_plan §3.1) and the decision record (D5, D11), not by either npm package. **The text of the PostgreSQL License is not reproduced here, because it is not on disk.** Searched on 2026-10-04 (85): the file names `COPYRIGHT*`, `LICENSE*`, `LICENCE*`, `COPYING*` and `NOTICE*` under `node_modules/@embedded-postgres/darwin-arm64/` and under `node_modules/embedded-postgres/` (only the two `LICENSE.md` files above exist); every text file of the platform package for the licence wording; and every text file under `node_modules/`, `docs/`, `scripts/`, `apps/` and `packages/` for the distinctive sentence of the licence (no match). The text has to be added from the PostgreSQL source distribution; it has not been written from memory.
- **PostgreSQL copyright notices that do ship with the binaries.** Five text files of the platform package carry the notice of the PostgreSQL Global Development Group (first matching line of each, with its line number):
  - `native/share/postgresql/errcodes.txt`, line 5: `# Copyright (c) 2003-2025, PostgreSQL Global Development Group`
  - `native/share/postgresql/information_schema.sql`, line 5: `* Copyright (c) 2003-2025, PostgreSQL Global Development Group`
  - `native/share/postgresql/snowball_create.sql`, line 5: `* Copyright (c) 2007-2025, PostgreSQL Global Development Group`
  - `native/share/postgresql/system_functions.sql`, line 4: `* Copyright (c) 1996-2025, PostgreSQL Global Development Group`
  - `native/share/postgresql/system_views.sql`, line 4: `* Copyright (c) 1996-2025, PostgreSQL Global Development Group`

### PostgreSQL License text, fetched from PostgreSQL's own source

This sub-section supersedes the bullet above that says the text of the PostgreSQL License "is not reproduced here, because it is not on disk": the text was not in either npm package, and it was fetched from PostgreSQL's own source instead. The text below is the file `COPYRIGHT` at the root of the PostgreSQL source tree, tag `REL_18_4`, read from `https://raw.githubusercontent.com/postgres/postgres/REL_18_4/COPYRIGHT` on 2026-10-04 at 11:08:15 WIB (one anonymous request, made by the task's controller; 1,198 bytes; SHA-256 `3d6af92ff8a4c2cdf69afb1cf44edea727922f5cd0cf8b5f72b11cdecac8fdfd`), and is stored unchanged at `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/85_postgresql_COPYRIGHT.txt`.

```
PostgreSQL Database Management System
(also known as Postgres, formerly known as Postgres95)

Portions Copyright (c) 1996-2026, PostgreSQL Global Development Group

Portions Copyright (c) 1994, The Regents of the University of California

Permission to use, copy, modify, and distribute this software and its
documentation for any purpose, without fee, and without a written agreement
is hereby granted, provided that the above copyright notice and this
paragraph and the following two paragraphs appear in all copies.

IN NO EVENT SHALL THE UNIVERSITY OF CALIFORNIA BE LIABLE TO ANY PARTY FOR
DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING
LOST PROFITS, ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS
DOCUMENTATION, EVEN IF THE UNIVERSITY OF CALIFORNIA HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

THE UNIVERSITY OF CALIFORNIA SPECIFICALLY DISCLAIMS ANY WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS FOR A PARTICULAR PURPOSE.  THE SOFTWARE PROVIDED HEREUNDER IS
ON AN "AS IS" BASIS, AND THE UNIVERSITY OF CALIFORNIA HAS NO OBLIGATIONS TO
PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
```

The fetched file gives the end year 2026 in its PostgreSQL Global Development Group line (1996-2026), while the five text files shipped with the binaries (listed above) end in 2025 (2003-2025, 2007-2025 and 1996-2025); both are kept as found. As checked on 2026-10-04 (85), this repository does not contain the PostgreSQL binaries and does not, by that check, redistribute them: `git ls-files` lists no path with `embedded-postgres/` in it, the binaries sit in the git-ignored `node_modules/`, and the entry names of the seven archives in the git-ignored `release/` (six web packages and the Android APK, listed without extracting them) include no file named for PostgreSQL; the check of the archives is by entry name only, and their contents were not opened.

---

## Speech-to-text engines used by `@dems/transcriber` (task 3, row 76; register DOC-05, first part)

Nothing in this section is copied into the repository or listed in `package.json`: the engine, its model and the development server live outside git (`.cache/`, git-ignored, and the host). They are listed because `apps/transcriber` starts or calls them. Licence facts are the row-4 findings of `docs/2026-10-07_dems_real_capture_sealing/research/04_collection_stt.md` (F numbers) as carried by `masterplan/07_transcript_spec.md` section F; licence texts are not reproduced here because no copy is distributed from this repository yet. The entries for Silero VAD, sherpa-onnx and the diarization assets are added by the rows that first use them (77, 78); the full DOC-05 list of 15 components is section F of the transcript spec.

| Component | Used as | Code licence | Model-weight licence | Where it lives | Source of the licence fact | Note |
|---|---|---|---|---|---|---|
| whisper.cpp 1.9.5 (`whisper-cli`) | backend `cpu-local`, the product path; built from source with every GPU backend off (row 107) | MIT | n/a | `.cache/stt/whisper.cpp/` (git-ignored) | F-19 | Keep the copyright notice in any distributed copy |
| ggml (inside the whisper.cpp source tree) | tensor library of whisper.cpp | MIT | n/a | same build tree | F-20 | Permissive |
| Whisper large-v3-turbo weights, ggml format | model of backend `cpu-local` (row 108) | n/a | MIT | `.cache/stt/models/` (git-ignored); SHA-256 recorded in `.cache/stt/ggml_expected.sha256` | F-78, F-70, F-71 | A converted ggml derivative inherits the MIT terms |
| oMLX server with `whisper-large-v3-turbo` | backend `omlx-server`: development and functional checks on this Mac only (D7) | not distributed with DEMS | MIT (same checkpoint class, F-78) | host install, shared with another project | D7; `initialization/02_stt_runtime_install.md` | Not shipped: it runs on the Apple GPU. DEMS calls it on loopback and never installs, upgrades or starts it |
| OmniVoice (`omnivoice-bfloat16`) | speech synthesis for the test fixture only (`TtsFixtureProvider`) | n/a | Apache-2.0; the HiggsAudio tokenizer carries an extended licence above 100k monthly users | host install | `initialization/02_stt_runtime_install.md` section 4; transcript spec section F | Development-side fixture only; must not ship in the Core product |

### Voice activity detection and diarization model files (task 3, row 77; register DOC-05; OD-20, Q-INSTALL item 5)

Downloaded on 2026-10-09 into the git-ignored `.cache/stt/`. Nothing here is copied into the repository or listed in `package.json`. Each file was fetched into its own empty directory under `.cache/stt/downloads/row77/`, its size and SHA-256 were recorded, and only then was it placed where the code or a later row looks for it. Uninstall: `rm -rf .cache/stt/downloads/row77 .cache/stt/diarization .cache/stt/models/ggml-silero-v6.2.0.bin .cache/stt/whisper.cpp/build/bin/whisper-vad-speech-segments`.

| Component | Used as | Source (URL) | Size | SHA-256 | Licence | Where it lives | Source of the licence fact | Note |
|---|---|---|---|---|---|---|---|---|
| Silero VAD v6.2.0, ggml format (`ggml-silero-v6.2.0.bin`) | the VAD model of the transcript pipeline (`apps/transcriber/src/pipeline/silero-vad.ts`), row 77 | `https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin` (the address of whisper.cpp's own `models/download-vad-model.sh`) | 885,098 B | `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` | MIT (Silero Team; the LICENSE file governs, the stale CC BY-NC badge text of the README does not) | `.cache/stt/models/` | F-90, F-95, LB-4 | Redistributable; keep the copyright notice in a distributed copy |
| whisper.cpp 1.9.5 `vad-speech-segments` example (`whisper-vad-speech-segments`) | the program that runs the Silero model: built by row 77 from the SAME source tree and the SAME GPU-off configuration as `whisper-cli` (row 107); links only `libSystem` and `libc++` | already present: `.cache/stt/whisper.cpp/` (row 107) | 2,425,016 B | `4b5447ea9e446b37b2582a073895510f641e737125730635a09f2462fa179456` | MIT | `.cache/stt/whisper.cpp/build/bin/` | F-19 | No new download and no Homebrew change; one more build target |
| 3D-Speaker CAM++ speaker embedding, ONNX (`3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx`), as republished by sherpa-onnx | NOT USED BY ANY CODE YET: the embedding model for the diarization of row 78 | `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` (release tag `speaker-recongition-models`, spelling as published) | 29,596,978 B | `357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b` | Apache-2.0 per the source project `modelscope/3D-Speaker`; the release asset carries no licence file of its own (LB-3) | `.cache/stt/diarization/embedding/` | F-105, F-106, LB-3 | Record this exact checkpoint before any redistribution |
| Reverb diarization v1 segmentation model, ONNX (`sherpa-onnx-reverb-diarization-v1.tar.bz2`: `model.onnx` 9,512,223 B, `model.int8.onnx` 2,416,155 B) | **NOT USED AND NOT CLEARED.** Downloaded as the segmentation asset the transcript spec names (section A.4) | `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-reverb-diarization-v1.tar.bz2` | 10,918,585 B | `615761e980be1688da0ef81618c056134d63aa55ea0a5f1494c47393b9398eab` (archive); `8249e2e323f8fb0566a387d94b40a73d0b75d54ee60d02dcd729a56a5ba8ecea` (`model.onnx`) | **"Rev Model Non-Production License"** — the LICENSE file inside the archive (SHA-256 `68791425f9885ba32b7db32f7fcec7b309dd5a2453f220dea2f0cb39b756b180`); its section 3.2 limits use to testing, research, personal or evaluation purposes in non-production environments | `.cache/stt/diarization/segmentation/` with a `DO_NOT_USE__LICENCE_NOT_CLEARED.txt` beside it | the archive's own `LICENSE` and `README.md`, read on 2026-10-09 | **Correction to the transcript spec.** Section F and finding LB-5 recorded this asset as Apache-family and the combination as licence-clean; the file shipped with the asset says otherwise. It must not be used in the Core product or in row 78 before the user decides (another segmentation model, or labels left UNAVAILABLE). |

sherpa-onnx itself (Apache-2.0, F-101) is not installed and not used by row 77; its entry is added by the row that first runs it (78).
