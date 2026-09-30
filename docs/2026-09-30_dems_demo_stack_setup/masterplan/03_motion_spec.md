---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: data-analyst
type: motion-specification
narrative_tier: 1
based_on:
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/research/04_ui_design_analysis.md (§8 animation opportunities; §2-§5 layouts)
  - /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/masterplan/01_specs.md (rev 3: §2.7 tokens, §14 web application)
decisions_applied: D6, D15 (all animation design delegated to Claude), D16-D28
status: complete
last_updated: 2026-10-01 00:50 WIB
---

# Motion Specification: DEMS Core Console (web) with mobile parity notes

## 0. Purpose, scope and method

### 5W1H

| Dimension | Content |
|---|---|
| **What** | The complete motion design for the 10-page Core web console and the Start New Session flow (01_specs §14). It covers principles, tokens, choreography rules, app-level transitions, per-component specs, per-page choreography, data-driven motion, the reduced-motion policy, the performance budget and the library mapping. Appendix A gives Reanimated equivalents for the next (mobile) task |
| **Who** | Author: data-analyst. Owner: the user, who delegated all animation design to us (D15: *"semua animasi kamu yang tentukan improvemenya"*). Implementers: the motion-system and page rows proposed in `masterplan/02_plan.md`. Verifiers: `verifier` (AC-24, AC-31, AC-70..AC-72) and `senior-code-reviewer` |
| **When** | Applies from the second approval gate (D22) onward. The scaffold rows (D27) only need §2 tokens and M-PX-01/02 |
| **Where** | `apps/core-web` (Motion, Magic UI, Motion Primitives, CSS, Recharts); shared tokens in `packages/shared/src/tokens/`; mobile parity in Appendix A |
| **Why** | The request's stated priority is a *luxurious, elegant, fully animated* UI (C2). This spec turns 04 §8's opportunities into one coherent system, so the demo reads as one product and never as a sampler of effects |
| **How** | (1) Every 04 §8 row is indexed as an opportunity O-01..O-53 (Appendix B). (2) One motion language is defined (§1, §2). (3) Each opportunity maps to a spec ID (M-…). (4) Everything is bound to the simulator's events (§7). (5) A reduced-motion variant (§8) and a performance rule (§9) are set for every item. Library items and props were verified against their registries (01_specs V43 plus this file's §10 prop notes) |

### Evidence and ID conventions

- `O-nn`: an opportunity row in 04 §8, numbered in table order (Appendix B).
- `M-APP` app level, `M-SH` shell, `M-C` component, `M-PG` page, `M-DATA` data-driven, `M-PX` proof mode.
- Token names refer to `packages/shared/src/tokens/tokens.ts` (01_specs §2.7). New motion tokens introduced here are marked **NEW** (§2.3) and are added by the motion-system row, not the scaffold.

---

## 1. Motion language: "Gilded Calm"

The console should feel like **light moving across polished metal in a quiet room**. Things arrive with weight, settle without bouncing, and glow rather than jump. Time is visible (ticking digits, a breathing REC lamp) but never noisy. Cinematic devices are used sparingly and with purpose.

| Cinematic device | Motion translation | Where it is used |
|---|---|---|
| **Rack focus** | Blur 6 px → 0 with an opacity rise, on small text only | Hero tagline, "READY", page titles |
| **Light sweep** | A gradient sheen travelling across a surface once | Primary button hover, sidebar hover, the SIMULATED badge |
| **Slow push-in** | Ken Burns, scale 1.00 → 1.06 over 30 s, alternating | Hero photo, camera feeds |
| **Bloom / iris** | Glow opacity breathing; arcs sweeping open | SYSTEM READY ring, SECURE pill |
| **Match cut** | Shared-element flights (`layoutId`) | Emblem Login → top bar, preview tile → live feed, marker → timeline |
| **Held beat** | A 120 ms pause before numbers tick | Every KPI after its card lands |

### Principles

| # | Principle | Rule of thumb |
|---|---|---|
| P1 | **Light before movement** | Prefer opacity, glow and sheen. Keep displacement small: ≤ 24 px for entries and ≤ 4 px for hovers |
| P2 | **Three tempos** | *Feedback* 90-180 ms (press, hover, focus). *Transition* 240-640 ms (enter, exit, route, dialog). *Ambient* 1.2-60 s loops (breathe, rotate, push-in) |
| P3 | **Motion means something** | Every animation answers "what changed?" or "what is alive?". There are at most **4 ambient loops per viewport** (§9.4). Nothing loops purely for decoration |
| P4 | **Weighted, not bouncy** | Default spring `gentle` (ζ ≈ 1.00). `snappy` is for tactile feedback. `bouncy` (ζ ≈ 0.56) is reserved for *completion* moments: SEALED stamp, PASS chip, badge pop |
| P5 | **Hierarchy and reading order** | Header → hero or primary panel → the rest, row by row, left to right. The shell never moves during route changes |
| P6 | **Continuity** | Identity carries across screens through shared elements (§3). A new screen never "blinks in" when an element already exists on screen |
| P7 | **Calm under pressure** | Escalations pulse **once**, then hold a steady colour. Critical states use a slow 2.4 s glow until acknowledged. There is no looping shake and no strobing |
| P8 | **Readable and safe** | Nothing flashes more than 3 times per second (WCAG 2.3.1). Text that must be read is never animated continuously. Live numbers use tabular figures, and fast-changing values (dBFS) update their text at ≤ 4 Hz |
| P9 | **Performance is luxury** | 60 fps. Composite-only properties (§9). A dropped frame breaks the illusion faster than a missing effect |

---

## 2. Motion tokens

### 2.1 From 01_specs §2.7 (unchanged)

| Group | Token | Value |
|---|---|---|
| Duration (ms) | `instant` | 90 |
| | `fast` | 160 |
| | `base` | 240 |
| | `slow` | 420 |
| | `slower` | 640 |
| | `beatIn` | 180 |
| | `beatOut` | 720 |
| | `ambient` | 1200 |
| Easing | `standard` | `[0.2, 0, 0, 1]` |
| | `luxe` | `[0.22, 1, 0.36, 1]` |
| | `emphasized` | `[0.16, 1, 0.3, 1]` |
| | `exit` | `[0.4, 0, 1, 1]` |
| Spring | `gentle` | `{ stiffness: 170, damping: 26, mass: 1 }`, ζ ≈ 1.00 |
| | `snappy` | `{ stiffness: 420, damping: 34, mass: 0.9 }`, ζ ≈ 0.87 |
| | `bouncy` | `{ stiffness: 260, damping: 18, mass: 1 }`, ζ ≈ 0.56 |
| Choreography | `stagger` | 60 ms |
| | `delayChildren` | 80 ms |
| Ambient (rev 2) | `glowBreath` | 2,400 ms |
| | `recPulse` | 1,200 ms |
| | `meterFrameMs` | 50 |
| Proof mode | `proofSlowFactor` | 10 |

### 2.2 Elevation glow levels

Elevation glow levels (01_specs §2.7 rev 3) are **states** that motion moves between. Glow is always changed by cross-fading the opacity of a pre-rendered glow layer, never by animating `box-shadow` (§9.2).

### 2.3 NEW tokens (added to `tokens.ts` by the motion-system row)

| Group | Token | Value | Use |
|---|---|---|---|
| Distance (px) | `riseSm` / `rise` / `riseLg` | 6 / 12 / 24 | Row reveal / panel enter / hero element enter |
| | `hoverLift` | 2 | Card hover |
| | `exitDrop` | 8 | Exit offset |
| Scale | `press` | 0.98 | Pressed buttons and cards |
| | `hover` | 1.01 | Media tiles only |
| | `enterFrom` | 0.98 | Panel and dialog enter |
| | `stampFrom` | 1.2 | SEALED stamp |
| Blur (px, small elements only) | `focusIn` | 6 | Rack-focus text enter |
| | `mediaIn` | 8 | Camera tile first paint |
| Spring | `counter` | `{ stiffness: 90, damping: 20, mass: 1 }` (ζ ≈ 1.05) | AnimatedNumber KPI ticks |
| | `meter` | `{ stiffness: 600, damping: 40, mass: 0.6 }` | Smoothing 20 Hz meter samples to 60 fps |
| | `indicator` | `{ stiffness: 380, damping: 36, mass: 1 }` (ζ ≈ 0.92) | Sidebar and tab indicators |
| Ambient periods (ms) | `ringRotate` | 60,000 | Ring rotation |
| | `kenBurns` | 30,000 | Hero and camera push-in |
| | `topoDrift` | 40,000 | Topographic drift |
| | `sheen` | 700 | Light sweep |
| | `scanline` | 6,000 (sweep 1,200) | Camera scanline |
| | `colonBreath` | 1,000 | Clock colon |
| | `heartbeatPulse` | 600 | Pulse on every mock-core heartbeat (1 Hz) |
| Thresholds | `flashMaxHz` | 3 | P8 |
| | `numberTextMaxHz` | 4 | P8 |
| | `ambientMaxPerViewport` | 4 | P3 |
| | `insertionMinGapMs` | 400 | Coalescing list insertions |
| | `staggerCap` | 8 items (then grouped) | Stagger length |

These token values must stay in sync with 01_specs §2.7 (the source of truth for colour and type). Where this spec needs a value that §2.7 lacks, it lives in the NEW table above.

---

## 3. Choreography rules

| Rule | Specification |
|---|---|
| **R1 Enter** | Panels: `opacity 0 → 1`, `y rise → 0`, `scale enterFrom → 1`, spring `gentle`. Children stagger `stagger` (60 ms) after `delayChildren` (80 ms), in row-major reading order. At most `staggerCap` = 8 staggered items; items after the 8th enter together with the 8th |
| **R2 Exit** | `opacity → 0`, `y → -exitDrop`, duration `fast` (160), easing `exit`, **no stagger**. Exits are always faster than enters (P2) |
| **R3 Hierarchy** | One **hero moment** per screen (listed per page in §6). It starts first or finishes last, never in the middle. Secondary panels never out-animate the hero |
| **R4 Data after container** | Numbers and charts inside a card start `120 ms` after the card settles (the "held beat") |
| **R5 Shared elements** | `layoutId` inside one `LayoutGroup`, spring `gentle` for position and size, cross-fade `base` for content. Registered IDs: `brand-emblem`, `nav-active`, `tab-active-<group>`, `feed-<cameraId>`, `evidence-<id>-header`, `marker-chip`, `snapshot-thumb`, `time-tier` |
| **R6 Interruptible** | Every transition can be interrupted (Motion default). A route change cancels running page staggers. Nothing blocks input while it animates. There are no `await`-chained animations in event handlers |
| **R7 Direction** | Travel direction encodes meaning. Forward (next step, drill-in) enters from the right or below; back from the left or above. Stepper panels follow step order (`TransitionPanel` `custom` direction) |
| **R8 Attention budget** | Escalation (to warning or danger) gets **one** pulse, then a steady colour. De-escalation gets a colour transition only. Critical states hold a `glowBreath` glow until acknowledged. At most one attention animation runs per panel at a time |
| **R9 Streams** | List insertions coalesce: with more than one insertion per `insertionMinGapMs` (400 ms), items batch into one animated group. The newest highlight fades over 1,500 ms |
| **R10 Idle respect** | Ambient loops pause when the tab is hidden (`document.visibilityState`) and when the element is off-screen (IntersectionObserver), then resume in phase |

---

## 4. App-level transitions

### M-APP-01: Login → shell hand-off, the signature "emblem flight" (O-16)

**Trigger:** the simulator accepts the credentials (`auth.status = AUTHENTICATED`). **Total: about 1,600 ms** (reduced motion: 240 ms cross-fade).

| t (ms) | Element | Motion | Timing |
|---|---|---|---|
| 0 | GlowRing centre (Login) | The check path draws (`pathLength 0 → 1`) over the emblem | 300, `luxe` |
| 0 | GlowRing arcs | Colour → success green (CSS variable `--ring-color`), then back to gold at t = 450; one bloom pulse (glow layer opacity 0.6 → 1 → 0.6) | 450 + 450 |
| 150 | Auth card | `opacity → 0`, `scale → 0.96`, `y → 8` | 300, `exit` |
| 300 | Brand text (overline, tagline, vertical words) | `opacity → 0` | 240 |
| 450 | **Emblem** (`layoutId="brand-emblem"`) | Flies from the ring centre (≈170 px) to the top-bar logo slot (≈44 px): position and scale via layout projection | spring `gentle` (settles ≈ 700 ms) |
| 450 | Backdrop photo | Cross-fades into the Dashboard hero (same asset, §14.10). The Login full-bleed crop animates to the hero band crop through `clip-path: inset()` plus `object-position` | 700, `luxe` |
| 600 | Top bar | Drops in: `y -24 → 0`, `opacity 0 → 1`. The wordmark does a rack-focus (blur `focusIn` → 0) | 420, `gentle` |
| 680 | Sidebar | Slides in: `x -24 → 0`, `opacity`; items stagger 30 ms | 420, `gentle` |
| 800 | Dashboard panels | Standard page enter (M-PG-DASH, R1) | ≤ 800 |
| 1,200 | SYSTEM READY ring | Arc sweep (M-C-01), the last beat, landing as the "hero moment" | 900 |

**Implementation:**
- `__root.tsx` wraps the top-level outlet in `<LayoutGroup><AnimatePresence mode="sync" initial={false}>`, keyed by the top-level match (`/login` vs `_app`). Login and TopBar both render `<motion.div layoutId="brand-emblem">`.
- **Hypothesis H-M1:** TanStack Router can keep the exiting route mounted inside `AnimatePresence`. Pattern: render the matched element via a stable key and a "frozen" outlet.
- **Deterministic fallback:** a two-phase hand-off. Login plays its exit (t = 0-600) with the emblem scaling toward the top-left, then navigates. The shell's emblem enters from that same screen position (`initial` set from a stored `DOMRect`, the same spring). Visually equivalent; no cross-route layout projection needed.

### M-APP-02: Sign out (O-17)

The reverse of M-APP-01, compressed to about 900 ms:
1. Panels exit with no stagger (R2).
2. Sidebar and top bar exit.
3. The emblem flies back to the ring centre.
4. The ring arcs sweep in.
5. The card rises (`y 12 → 0`).

The Login alert "You have been signed out." enters last. Reduced motion: a cross-fade.

### M-APP-03: Cold entry while signed in, for example a reload (O-01)

1. The emblem strokes draw: `emblem-shield` first (500 ms), then `emblem-arc-1..6`, 70 ms apart (a scan).
2. At t = 600 the wordmark rack-focuses in.
3. The gold rule under the tagline wipes (`scaleX 0 → 1`, origin left, 420, `luxe`).
4. The shell fades in (240).
5. The page enter runs (R1).

Total ≤ 1,400 ms. **This is shown once per browser session** (`sessionStorage` flag); later reloads use the plain route enter.

### M-APP-04: Route transitions inside the shell (O-08)

- **Exit:** the content area only, `opacity → 0`, 160, `exit`.
- **Enter:** the page header title plays MP **TextEffect** `preset="fade-in-blur"` `per="word"` (speedReveal about 1.4). Panels enter per R1.
- The shell stays still.
- The scroll position resets to top *before* the enter starts.
- Cap: exit 160 + enter ≤ 900 ms.
- Browser back uses R7 back direction (`y -rise`).

### M-SH: Shell elements

| ID | Element | Motion | Tokens / library | O-ref |
|---|---|---|---|---|
| M-SH-01 | Sidebar hover | The item background follows the pointer: MP **AnimatedBackground** (`enableHover`, `transition` = `indicator` spring) behind the items, plus a one-shot light sweep across the hovered item (gradient `translateX -100% → 100%`, `sheen` 700, `luxe`). The icon brightens `fast` | MP AnimatedBackground; CSS | O-02 |
| M-SH-02 | **Active indicator** | The inset gold card is a `motion.div layoutId="nav-active"` that moves to the new item on navigation (spring `indicator`). Its glow layer fades e2 → e3 → e2 during travel ("glow trail"). The icon colour cross-fades `base` | Motion `layoutId` | O-02 |
| M-SH-03 | Sidebar ↔ rail | The container animates with Motion `layout` (FLIP transform, not a width transition). Labels fade and slide `x -8 → 0` (`fast`, staggered 20 ms). Tooltips appear in rail mode | Motion `layout` | O-03 |
| M-SH-04 | Top-bar clock | MP **SlidingNumber** on the time digits: only digits that change slide (240, `standard`). The colon breathes opacity 1 ↔ 0.55 (`colonBreath`, sine), never a hard blink (P8) | MP SlidingNumber; CSS | O-05 |
| M-SH-05 | SECURE pill | The status dot breathes (`glowBreath`). On a state change: colour transition 400 plus **one** ring pulse (scale 1 → 1.6, opacity 0.5 → 0, 600). While ATTENTION or CRITICAL, MU **BorderBeam** travels (duration 6 s; `colorFrom` amber or red, `colorTo` bronze). It stops on recovery | MU BorderBeam | O-06 |
| M-SH-06 | Bell | On a new alert, the badge pops (scale 0.6 → 1, `bouncy`) and the bell swings (rotate 0 → 12° → -8° → 0, spring `snappy`, ≈600 ms). Throttled to once per 5 s burst (R8) | Motion | O-07 |
| M-SH-07 | Topographic texture | Drift `translateY 0 ↔ -12 px` plus contour opacity shimmer 0.25 ↔ 0.4 over `topoDrift` 40 s, sine, alternating. Paused when off-screen or hidden (R10) | Motion | O-04 |
| M-SH-08 | Drawer navigation (< 1024 px) | HeroUI `Drawer` built-in transition (kit default, D6). The hamburger icon morphs to × (two lines rotate ±45°, `base`) | HeroUI; Motion | O-03 |

---

## 5. Component specifications

Every entry lists **Trigger → Motion → Timing → Library → Reduced motion → O-ref**.

### 5.1 Hero instruments

**M-C-01: SYSTEM READY GlowRing** (O-18, O-09, O-10). It has four SVG layers and a centre.

| Layer | Mount | Ambient | Reduced |
|---|---|---|---|
| Outer tick ring | Opacity 0 → 1 (420) | `rotate 0 → 360°` over `ringRotate` (60 s, linear), on the SVG group (`will-change: transform` while mounted) | Static |
| Bracket arcs (9 and 3 o'clock) | `pathLength 0 → 1`, 900 `luxe`, arcs 120 ms apart | A pre-blurred glow copy's opacity breathes 0.55 ↔ 1 over `glowBreath` (P1, §9.2) | Static at 0.8 |
| Inner solid ring | `pathLength 0 → 1`, 1,200 `luxe`, starting 200 | none | Drawn |
| Centre emblem or shield | The check path draws 600 `luxe` at t = 900 | none | Drawn |
| "SYSTEM" / "READY" | MP **TextEffect** `preset="fade-in-blur"` `per="char"` at t = 1,000 | none | Opacity only |

- **State morph:** `--ring-color` animates between gold / amber / red / grey (600, `standard`). Escalation adds one bloom pulse (R8).
- **RECORDING state:** the arcs turn red and pulse opacity at `recPulse`. The centre cross-fades ("READY" → REC dot plus SlidingNumber timer, `base`).
- **Modes:** `hero` (Dashboard, ≈320 px), `login` (≈340 px), `mini` (Start Session step 3, ≈120 px; ambient rotation off).

**M-C-02: Number tickers** (O-20, O-24, O-26, O-31, O-36, O-42)
- **Counters** (KPIs, counts, TB values) use MP **AnimatedNumber** with `springOptions = counter`. Mount: 0 → value after the held beat (R4). Updates spring from old to new.
- **Clocks and timers** use MP **SlidingNumber** (per-digit slide, 240 `standard`) with tabular figures.
- **Rule:** values that change more than once per second use SlidingNumber (timers). Everything else uses AnimatedNumber.
- **Reduced:** values jump to final.

**M-C-03: Donut / ProgressCircle sweep** (O-24, O-36, O-42)
- HeroUI `ProgressCircle`. The fill circle (slot class) gets `transition: stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)` from the generated theme CSS. It mounts at value 0 and sets the real value on the next frame.
- Threshold colour changes (READY / LOW / FULL) use a colour transition (400).
- The centre % uses AnimatedNumber.
- **Reduced:** no sweep; the final value is drawn.

### 5.2 Live signal components

**M-C-04: dBFS meter** (DbfsMeter; O-23, O-33, O-41, 01 S3)

| Aspect | Specification |
|---|---|
| Data path | `useAudioChannel(ch, onFrame)` (transient zustand subscription, 20 Hz) → `levelMV.set(dbfs)`. `useSpring(levelMV, meter)` interpolates to 60 fps. Each of the 10 segments' opacity comes from `useTransform(smoothed, [thresholdᵢ - 1, thresholdᵢ], [0.12, 1])`. **Zero React re-renders per frame** |
| Segments | Green ≤ -20, amber -14 / -9, red -5 / -2 (01_specs §14.6). Lit segments carry a soft inner glow (static CSS); only opacity animates |
| Peak hold | A 2 px marker positioned with `translateY` from the simulator's peak value. It holds 1.5 s, then falls at 20 dB/s (simulator ballistics, §14.7). Rendered as a motion value; no layout |
| Clip latch | On `clip = true`: the top segment locks red. A `Chip` "CLIP" pops (scale 0.8 → 1, `bouncy`) with **one** flash (opacity 1 → 0.4 → 1, 180 ms; P8). It stays latched until the operator clicks it (reset action). An alert and audit row are raised by the simulator |
| NO SIGNAL | Segments fade to 0.12 over 400 and a dashed flat line fades in. The label "NO SIGNAL" cross-fades in |
| Readout text | The dBFS number updates at ≤ `numberTextMaxHz` (4 Hz), throttled, with tabular figures (P8) |
| Monitoring paused (UI-only) | The meter container dims to 0.35 (`base`), with the overlay "Monitoring paused — recording continues" |
| Reduced | Spring off (direct `set`); updates throttled to 10 Hz; the clip flash is replaced by a static red border. The meter stays **functional** (it carries information) |

**M-C-05: REC indicator** (O-30, O-22)
- Dot: `opacity 1 → 0.35 → 1` plus `scale 1 → 0.9 → 1` over `recPulse` (1.2 s, sine), which is 0.83 Hz and well under `flashMaxHz`.
- Halo: once per cycle, a ring scales 1 → 2.2 while fading 0.5 → 0.
- The video-frame glow layer breathes over `glowBreath`.
- **Reduced:** a static red dot, no halo.

**M-C-06: Heartbeat pulse** (O-50, the stack-proof chip)
- On every mock-core heartbeat, the connection dot pulses once (scale 1 → 1.6, opacity 0.6 → 0, `heartbeatPulse` 600) and `seq` slides (SlidingNumber).
- On disconnect: the chip morphs to red (M-C-10), then a reconnect spinner, then green plus one pulse when back.

### 5.3 Streams and sequences

**M-C-07: Event and audit list insertion** (O-27, O-37, O-50)
- Uses MU **AnimatedListItem**, copied in with its variants **edited** (the vendor default enters from `scale: 0`, which is too springy for P4):
  - `initial { opacity: 0, y: -12, scale: 0.98 }` → `animate { opacity: 1, y: 0, scale: 1 }`;
  - spring `{ stiffness: 350, damping: 40 }` (the vendor value, ζ ≈ 1.07; kept);
  - `layout` for pushing the older rows down.
- The newest row gets a gold highlight layer fading 0.18 → 0 over 1,500 ms. The oldest row exits with opacity (160). Coalescing follows R9.
- **Hash events:** the short hash (first 8 hex) resolves with MP **TextScramble** (`duration 0.6`, `characterSet` `0-9a-f`).
- **Reduced:** rows appear instantly with the highlight only.

**M-C-08: SessionTimeline insertion** (O-35)
1. The line segment grows with `scaleY 0 → 1` (origin top, 320, `luxe`).
2. The node pops (scale 0 → 1, `bouncy`).
3. The title and detail rise 8 px (240).
4. The newest node's halo pulses twice (2 × 1.2 s), then rests.

Auto-scroll to the newest node uses a smooth scroll **only if** the user has not scrolled in the last 5 s. Marker and snapshot events arrive by shared-element flight (M-C-17, M-C-18). **Reduced:** instant, no halo.

**M-C-09: Stepper** (O-38, O-39, O-40, O-45; Start Session, Finalization, Export, Update, Lifecycle)
- **Connector fill:** `scaleX 0 → 1` (origin start, 420, `luxe`) when a step completes.
- **Badge:** pending → active (glow e2 fades in plus one pulse) → done (the check draws, `pathLength` 300) → warn or error (colour transition plus one pulse).
- **Wizard content:** MP **TransitionPanel** with direction-aware variants: enter `{ x: ±24, opacity: 0 }`, center `{ x: 0, opacity: 1 }`, exit `{ x: ∓24, opacity: 0 }`, spring `gentle` (R7).
- **Pipeline variant:** steps resolve in sequence, each with Spinner → check-draw (sim-timed, §14.7).
- **SEALED stamp** (finalization end): the violet "SEALED" chip scales `stampFrom` 1.2 → 1 (`bouncy`) with an e3 glow flash (400) and a single hairline ring expanding and fading (700).
- **Reduced:** instant state changes and a static stamp.

**M-C-10: Status chip morph** (O-20, O-25, O-29, O-44)
- The label cross-fades (`AnimatePresence mode="wait"`, 120).
- The fill and border colours transition (400, `standard`).
- **Escalation only:** one halo pulse (scale 1 → 1.35, opacity 0.5 → 0, 600).
- Security shields (Secure → Attention → Critical → Unknown) cross-fade icons (`base`) with a slight scale 0.9 → 1.

**M-C-11: Table reveals** (O-40, Security audit log, Services board)
- **First load:** rows stagger 30 ms (`riseSm` 6 px, opacity, 240). Only the first 10 rows stagger; the rest appear together.
- **Filter, sort and pagination:** rows use Motion `layout` (FLIP, 240 `standard`). Rows leaving fade (120). Page changes cross-fade (160).
- **Row hover:** a highlight layer fades (120).
- **Reduced:** no stagger and no FLIP.

### 5.4 Surfaces, media and overlays

**M-C-12: Camera tile / CameraFeed** (O-23, O-30, O-41)
- **Inside the canvas** (no CSS animation):
  - Ken Burns (scale 1.00 → 1.06, `kenBurns` 30 s, alternating; Cam 2 phase-shifted by 11 s);
  - film grain (seeded noise, 25 fps);
  - a scanline band (8% opacity, 1,200 ms sweep every `scanline` 6 s);
  - a burnt-in timestamp.
- **First paint:** the container eases from blur `mediaIn` (8 px) to 0 and opacity 0 → 1 (600, `luxe`), once.
- **Camera switch:** cross-fade 320.
- **Fullscreen:** the tile grows into the Modal through `layoutId="feed-<cameraId>"` (`gentle`).
- **NO SIGNAL:** the image fades to grey noise (400) and the label cross-fades in.
- **Hover (tiles only):** scale `hover` 1.01 plus the glow layer e1 → e2.
- **Reduced:** no Ken Burns or scanline; grain frozen (a single frame).

**M-C-13: Hero photo and tagline** (O-19, O-09)
- The image runs Ken Burns via `transform: scale()` (transform-origin 60% 40%, `kenBurns`, alternating).
- The overline rack-focuses in.
- The two-line italic title uses MP **TextEffect** `preset="fade-in-blur"` `per="line"` (lines 120 ms apart).
- The gold rule wipes (`scaleX`, 420, `luxe`).
- The vertical RECORD / PRESERVE / PROTECT fade in 120 ms apart.
- When recording, the copy switches with a cross-fade (`base`).
- **Reduced:** static image and opacity-only text.

**M-C-14: Toasts and alerts** (O-51)
- Placement: HeroUI `ToastProvider` default. Enter `y 16 → 0` plus opacity (`gentle`).
- A severity-coloured countdown line runs along the bottom edge (`scaleX 1 → 0`, linear, over the toast's timeout).
- **Critical** toasts are persistent and hold a red glow breathing over `glowBreath` until dismissed.
- Exit: opacity plus `x 24` (160, `exit`).
- Inline `Alert`s enter with height via `layout` in their container plus opacity (240).
- **Reduced:** opacity only; the countdown line stays (it is information).

**M-C-15: Dialogs, Drawers and Popovers** (O-34)
- HeroUI v3 animates overlays with CSS `[data-entering]` / `[data-exiting]` transitions (03_analysis 02 L501). **The kit defaults are kept (D6).**
- Our addition: the backdrop fades to 0.6 black with a 4 px `backdrop-filter: blur` **static** (never animated), and the panel takes glow e3 (static).
- If the kit exposes duration custom properties, they are set to `base` (enter) and `fast` (exit). Hypothesis H-M2; otherwise the kit timing is accepted.

**M-C-16: Hover, press and micro-interactions** (O-28, O-34, O-11)

| Element | Hover | Press | Notes |
|---|---|---|---|
| Card (pressable) | `y -hoverLift`, glow layer e1 → e2 (200, `standard`) | `scale press` (`snappy`) | Never animate `box-shadow` directly (§9.2) |
| Primary Button (gold) | A sheen sweep crosses once (`sheen` 700, `luxe`) | `scale 0.98` | Dark label on gold (D28/Q5) |
| Outline / ghost Button | Border brightens (`fast`) | `scale 0.98` | none |
| Quick-action cards | MP **Spotlight** (size 200, bronze at 12%) follows the pointer, plus an icon micro-motion: gear rotates 45°, export arrow rises 2 px, stethoscope swings ±8° (`snappy`) | `scale 0.98` | O-28 |
| Icon-only Button | Icon brightens | `scale 0.94` | none |
| Password eye | Icon cross-fade plus rotate 90° (160) | none | O-11 |

**M-C-17: Add Marker flight** (O-34)
- A chip with the marker label is created at the action button.
- It flies (`layoutId="marker-chip"`, `gentle`, ≈520 ms) into the timeline, where it becomes the node (M-C-08).
- **Reduced:** the node appears directly.

**M-C-18: Snapshot** (O-34)
1. A white shutter overlay on the feed: opacity 0 → 0.85 → 0 in 180 ms (**one** flash, P8).
2. A thumbnail (the canvas snapshot) flies (`layoutId="snapshot-thumb"`) to the "Open Evidence Queue" button.
3. The count badge there pops (`bouncy`).
4. A toast confirms.

**Reduced:** no flash (a subtle border highlight instead) and no flight.

**M-C-19: End Session hold-to-confirm** (O-34)
- While pressed, a fill runs `scaleX 0 → 1` over 1,500 ms (linear).
- Releasing early springs it back (`snappy`).
- On completion the `AlertDialog` opens (the mandatory reason is still required, S21).
- Keyboard users trigger the dialog directly with Enter (no hold needed).

**M-C-20: Pause Monitoring** (O-34; UI-only, D28/Q8)
- The icon morphs pause ↔ play (cross-fade plus rotate, 160).
- The feed and meters dim (M-C-04).
- The REC indicator **keeps pulsing**, because recording continues.

**M-C-21: Hash verification** (O-32, O-40, O-44)
- "Verify" runs a Spinner, then MP **TextScramble** over each shown hash (800 ms, characters `0-9a-f`) resolving to the recomputed value.
- The PASS chip pops (`bouncy`) with one green glow.
- FAIL: a red chip with one glow pulse (**no shake**, P7).
- **Hash-chain strip:** links light up in sequence (opacity 0.3 → 1, 80 ms stagger). A discontinuity holds a slow red `glowBreath` on the broken link until acknowledged.

**M-C-22: Login field and states** (O-11..O-15)
- **Focus:** the gold ring fades in (120) and the start icon brightens.
- **Caps-lock hint:** slides `y 4 → 0` (160).
- **Submitting:** the button sheen loops each 1.4 s while pending. The emblem's fingerprint arcs pulse in sequence (opacity 0.4 → 1, 150 ms apart, looping) like a verification scan.
- **Error:** a card shake of `x: [0, -6, 6, -4, 4, 0]` over 300 ms, **once** (P7 allows a single functional shake). Fields flash a red border once. The attempts caption ticks (AnimatedNumber).
- **Locked out:** the lock shackle closes (rotate 20° → 0, `snappy`). The ring morphs to amber (M-C-01). The countdown uses SlidingNumber. At zero, the form re-enables with one gold glow pulse.
- **Core offline:** the device-strip dot turns red and breathes slowly (`glowBreath`). The Alert slides in (240). Retry shows a Spinner.
- **Reduced:** no shake (a red border only) and no scan pulse.

**M-C-23: Ambient accents** (O-10, O-21, O-43, Network domains)

| Item | Where | Configuration | Stops when | Reduced |
|---|---|---|---|---|
| MU **Particles** | Login brand side | `quantity 24`, `staticity 60`, `ease 80`, `size 0.6`, `color #FFC86B` (≈30% effective alpha) | Tab hidden | Off |
| MU **Ripple** | Dashboard Active Session idle icon | `numCircles 5`, `mainCircleOpacity 0.18`, bronze | The session leaves idle | Off |
| MU **ShineBorder** | Idle "Start New Session" CTA | `duration 8`, `borderWidth 1`, `shineColor [#FFC86B, #FF9F3D]` | Not idle | Off |
| MU **BorderBeam** | Login card (**one lap**: `transition={{ repeat: 0 }}`); SECURE pill when degraded (M-SH-05) | `size 220`, `duration 6` | Lap done / recovered | Off |
| MU **OrbitingCircles** | Network & Time, GNSS tier | `radius 44`, `duration 20`, `iconSize 16`, `path` on | GNSS lost: fades out 600 | Static icons |
| MU **AnimatedBeam** | Network domains diagram | `duration 4`, gradient bronze → gold, `pathOpacity 0.15`. The Export path is dashed and animates only during an export | Idle export path | Static paths |
| Port LEDs / recording lamp | Devices | LED blink follows simulated link activity, capped at **2 Hz**. The "SEDANG MEREKAM" lamp breathes over `glowBreath` while recording | Link down / not recording | Steady on or off |

**M-C-24: Loading** (O-52)
- HeroUI `Skeleton` with a gold-tinted shimmer (CSS gradient `translateX`, 1.6 s linear), **only** during the first data load.
- Content replaces the skeleton with an opacity cross-fade (160).
- **Reduced:** a static skeleton.

**M-C-25: Focus rings** (accessibility)
- A 2 px gold ring (`--focus`) appears **instantly** (no delay for keyboard users). Its outer glow e2 fades in over 120.
- There is never a transition on `outline-width` or `outline-offset`.

### 5.5 API Reference renderer (Scalar) motion via `customCss` (O-46..O-49)

Our React Motion cannot reach inside the Scalar (Vue) tree. Motion there is CSS in the generated `theme/scalar.css` (01_specs §14.9):
- Operation chevrons rotate 90° (160, `standard`).
- Method pills brighten on hover (`filter: brightness(1.15)`, 120; the pills are small).
- The selected operation gets a gold left border plus a glow layer fade (200).
- A response status chip pops once (`@keyframes dems-pop`: scale 0.9 → 1, 240).
- The **SIMULATED** badge shimmers once when a response arrives (`@keyframes dems-sheen`, background-position, 1,200 ms).
- **Reduced:** `@media (prefers-reduced-motion: reduce)` disables the keyframes.

The Realtime WS panel outside the renderer uses M-C-06 and M-C-07.

---

## 6. Per-page choreography

Each page has a **hero moment**, an **enter timeline**, **≤ 4 ambient loops** (§9.4) and **data moments**. Times are relative to route enter; exits always follow R2.

### M-PG-LOGIN: Login (O-09..O-17)

| t (ms) | Beat |
|---|---|
| 0 | The canvas is black. The room still fades up (0 → 1, 900, `luxe`) and starts Ken Burns |
| 200 | GlowRing layers sweep in (M-C-01, `login` mode) |
| 500 | The emblem strokes draw (shield, then 6 arcs at 70 ms, like M-APP-03) and bloom |
| 900 | Overline, then wordmark (rack focus), then tagline lines (TextEffect `per="line"`), then gold rule wipe, then vertical words |
| 1,100 | The device strip rises (`riseSm`); its clock starts sliding |
| 1,200 | The auth card rises 12 px and fades in (`gentle`). BorderBeam runs one lap (6 s). Username takes focus once the card settles |

- **Hero moment:** the emblem scan-and-bloom.
- **Ambient (4):** ring rotation, bracket breathing, Ken Burns, Particles.
- **Data moments:** M-C-22 states; success → M-APP-01.

### M-PG-DASH: Dashboard (O-18..O-28)

| t (ms) | Beat |
|---|---|
| 0 | Hero photo (B) fades in and starts Ken Burns; overline rack-focus |
| 120 | Tagline lines (TextEffect), then gold rule, then vertical words |
| 250 | Status strip (C): cells stagger 50 ms, each value ticks after the held beat |
| 450 | Row 2: Active Session (D), then Devices & Inputs (E; tiles stagger; meters live immediately) |
| 650 | Row 3: Storage (F; ring sweep), Security/Time/Network (G; icons draw, chips glint once), Sealed Today (H; count ticks, bars grow via Recharts, `animationDuration 700`) |
| 850 | Row 4: Recent Events (I; rows stagger), Quick Actions (J; cards stagger) |
| 900 | **Hero moment:** the SYSTEM READY ring (A) sweep plays last and finishes at ≈1,800 |

- **Ambient (4):** ring rotation, ring breathing, hero Ken Burns, idle Ripple. ShineBorder counts as the idle-CTA accent; to stay at the cap, Ripple and ShineBorder alternate every 8 s.
- **Data moments:**
  - Idle → recording: panel D morphs. The EmptyState icon fades; the REC thumbnail grows from the icon's position (`layoutId`); key-values stagger in.
  - A new seal: bar H bumps, the count ticks +1, a success toast.
  - A new event: I inserts (M-C-07).
  - A device fault: E's tile chip escalates (M-C-10) and the ring goes to ATTENTION.

### M-PG-SM: Session Monitor (O-29..O-37)

| t (ms) | Beat |
|---|---|
| 0 | Page header (K): title TextEffect, then **TextShimmer once** (duration 2 s, then stops; P8); the banner dot starts breathing |
| 80 | Live feed (L): media-in blur (M-C-12); REC pulse starts; timer slides |
| 140 | Session details (M): key-value rows stagger 30 ms |
| 200 | Evidence integrity (N): checks draw one by one, 80 ms apart |
| 260 | Audio monitor (O): meters live at once, container fades in |
| 320 | Action bar (P): buttons stagger 40 ms |
| 400 | Timeline (Q): nodes stagger 50 ms (cap 8) |
| 460 | Camera & input status (R); 520 Storage (S; ring sweep); 580 Live audit (T; rows stagger 30 ms, cap 8) |

- **Hero moment:** the REC indicator and timer, with the feed's breathing frame glow.
- **Ambient (4):** REC pulse, feed frame glow, camera Ken Burns (in canvas), banner dot. The meters are functional, not ambient.
- **Data moments:**
  - A "hash recorded" audit event fires a light verification sweep across panel N (a 1 px gold gradient band travelling down the rows, 800 ms), synced to T's insertion.
  - MIC clip: M-C-04 latch, toast, banner → ATTENTION.
  - End Session: M-C-19, then the finalization Modal Stepper (M-C-09), then the SEALED stamp and the CTA "View evidence".
  - Monitoring paused: M-C-20.
  - NO SESSION state: the empty panels cross-fade, and a GlowRing `mini` invites "Start New Session".

### M-PG-NEW: Start New Session (O-38)

- Enter: the stepper first (badges stagger), then step content via TransitionPanel.
- **Step 1:** fields stagger 30 ms. Validation errors slide in (160). "Next" enables with a gold glow fade.
- **Step 2:** checks resolve in sequence: Spinner → check-draw (PASS), amber chip (WARN; the acknowledgement Checkbox slides in), or red chip plus `Alert` (BLOCK). Preview tiles fade in from blur; meters are live.
- **Step 3:** a summary card rises. The mini GlowRing sweeps (the **hero moment**). With the countdown enabled, a centred 3-2-1 plays (each digit rack-focuses in and scales 1.1 → 1 over 600, 1 s apart).
- **Start:** preview tile 1 flies (`layoutId="feed-VIDEO-01"`) into the Session Monitor live feed during the route change. The REC pulse starts on arrival.

### M-PG-EVID: Evidence list and detail (O-40)

- **List:** header, then KPI cards (stagger, counters), then toolbar, then table rows (M-C-11; the **hero moment** is the table reveal).
  - Filter changes re-flow rows (FLIP).
  - The status `ToggleButtonGroup` selection uses `layoutId="tab-active-status"`.
- **Detail:** the evidence header continues from the clicked row (`layoutId="evidence-<id>-header"`: ID, subject and status chip fly from the row). Tabs slide their indicator (`layoutId="tab-active-evidence"`); tab panels use TransitionPanel. Verify follows M-C-21. The lifecycle Stepper connectors fill up to the current stage on mount (M-C-09).
- **Export wizard:** a Modal with the Stepper; an RBAC denial shows the Alert slide (240) plus a lock-icon shackle close.

### M-PG-DEV: Devices & Inputs (O-41)

- Enter: camera tiles (media-in), then metric cards, then **audio inputs (hero moment: two large meters)**, then other devices, then the port map (LEDs switch on in sequence, 40 ms apart).
- **Ambient:** camera Ken Burns ×2 (in canvas), recording lamp (while recording), port LEDs (capped at 2 Hz).
- **Data moments:** tablet link OFFLINE: its chip escalates and the "recording continues" `Alert` slides in. Clicking a device opens the `Drawer` (kit), and its Health chart draws (Recharts).

### M-PG-STOR: Storage (O-42)

- Enter: the **capacity ring sweep (hero moment)**, then the legend (stagger), then KPI counters, then the AreaChart (draws, Recharts `animationDuration 900`) and BarChart (bars grow), then volume ProgressBars (fill 700), then the activity list.
- Retention calculator: outputs tween (AnimatedNumber) as inputs change; the Meter fill transitions (400).
- **Ambient:** none (a calm page). Session Size ticks live while recording.
- **Data moments:** LOW / FULL thresholds morph the ring colour with one pulse, plus a toast.

### M-PG-NET: Network & Time (O-43)

- Enter: the system time hero (SlidingNumber clock), then the time-source tiers (the active tier gets `layoutId="time-tier"` highlight), then network cards (sparkline draws), then the domains diagram (AnimatedBeam paths draw), then charts and log.
- **Hero moment:** the GNSS orbit.
- **Ambient (3):** OrbitingCircles (GNSS locked), AnimatedBeam, bandwidth sparkline scroll (streaming, `isAnimationActive=false`).
- **Data moments:** on GNSS loss the orbit fades out, the active highlight **moves down** to NTP (`time-tier`, `gentle`), and a toast plus audit row fire. On fallback to RTC it moves down again. Recovery moves it back up.

### M-PG-SEC: Security & Audit (O-44)

- Enter: the **posture shield (hero moment)** scales 0.9 → 1 with a glow bloom, then the controls checklist (checks draw), then the audit table (M-C-11), then the hash-chain strip (links light in sequence), then keys and certificates.
- **Ambient:** the chain-head link breathes (`glowBreath`, subtle).
- **Data moments:**
  - The "Live" switch streams audit rows (M-C-07).
  - A tamper injection (EVT-30) turns the broken link red, holds a slow pulse, slides in the discontinuity `Alert`, and escalates the shield to Critical (M-C-10).
  - Login attempts appear as AUTH rows.

### M-PG-SYS: System & Maintenance (O-45)

- Enter: quick actions (Spotlight), then the services board (rows stagger; chips colour in), then health mini charts, then the update card (Stepper), then About and Settings (Accordion, kit), then the Demo Control Panel (collapsed).
- **Hero moment:** Run Diagnostics. A Modal shows one ProgressBar per check filling in sequence (700 each), then a summary Alert with one success pulse.
- **Data moments:** every fault button triggers its matching reactions on *all* open panels and pages (§7). This is the live-demo showcase: pressing "MIC 2 clip" here shows the latch on this page's audio tile instantly, and on Session Monitor when navigated.
- **Ambient:** none besides health sparklines (streaming, no animation).

### M-PG-API: API Reference (O-46..O-50)

- Enter: the page header, then the server strip chips (stagger), then the renderer panel (fade 240; Scalar content renders at once, with no internal stagger), then the **Realtime panel (hero moment: first heartbeat pulse)**.
- **Ambient:** the heartbeat pulse at 1 Hz, which is data, not decoration.
- **Data moments:**
  - Try-it responses (§5.5).
  - The "Show simulated endpoints" switch filters operations. The panel content cross-fades (160), because Scalar re-renders.
  - A WS disconnect or reconnect morphs the chip (M-C-06).

---

## 7. Data-driven motion (simulator → motion)

Every row below is triggered by a simulator store change or event (01_specs §14.7). Components subscribe with selectors; high-frequency channels use transient subscriptions (§9.3).

| Simulator event / state | Where it shows | Motion (IDs) |
|---|---|---|
| `session.state` CREATE → PRECHECK | Start Session step 2 | Checks resolve in sequence (M-C-09 pipeline) |
| PRECHECK → ARMED | Step 3; Dashboard D | Stepper connector fill; GlowRing mini sweep; D shows "Armed" with a gold chip pulse |
| ARMED → RECORDING | SM, Dashboard D and A, top bar | Preview → feed flight (M-PG-NEW); REC pulse starts (M-C-05); ring → RECORDING (M-C-01); hero copy cross-fade (M-C-13); timeline START node (M-C-08); audit insertion |
| RECORDING → STOPPING → FINALIZING | SM | Hold-to-confirm (M-C-19), then AlertDialog, then the finalization Modal Stepper (M-C-09); REC pulse fades out (400) |
| FINALIZING → SEALED | SM, Evidence, Dashboard H | SEALED stamp (M-C-09); H bar bump and count tick; success toast; new Evidence row slides in at the top (M-C-11) |
| → FAULT (critical) | Every page | A critical toast that persists and breathes; SECURE pill → CRITICAL with BorderBeam (M-SH-05); ring → CRITICAL; banner morph; bell swing (M-SH-06) |
| FAULT → RECOVERY → idle | SM, Dashboard | A recovery Stepper (RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS); the session chip ends at "Incomplete" (amber, never sealed); ring → ATTENTION, then READY after acknowledgement |
| Fault CAMERA_LOSS | Feed, tiles, Devices | NO SIGNAL (M-C-12); chip escalation (M-C-10); toast; timeline FAULT node (red) |
| MIC_CLIP / MIC_NO_SIGNAL | Meters everywhere | M-C-04 clip latch / no-signal; banner → ATTENTION |
| STORAGE_LOW / FULL | Storage rings, Dashboard C and F, Start Session step 2 | Ring colour morph plus one pulse (M-C-03); FULL → Start Session step 2 BLOCK (red chip plus Alert) |
| GNSS_LOSS / RTC fallback | Network & Time, Dashboard C and G, top bar | Tier highlight moves down (`time-tier`); orbit fades out; chips escalate; toast |
| TAMPER / AUDIT_TAMPER | Security & Audit, SECURE pill | Broken link pulse (M-C-21); shield → Critical; pill BorderBeam |
| FAN_STALL | System health | Fan chart line turns red; chip escalation; toast |
| POWER_FAIL | All pages | A global dim overlay (opacity 0.6, 400) with the §18.1 step list (Stepper pipeline), then "reboot" (overlay fade), then RECOVERY |
| New event / audit row | Dashboard I, SM T, Security audit | M-C-07 (coalesced, R9) |
| New timeline item (note, marker, snapshot, peak) | SM Q | M-C-08, M-C-17, M-C-18 |
| mock-core heartbeat (1 Hz) | Stack-check, API Realtime panel, Login device strip | M-C-06 |
| Auth attempt result | Login | M-C-22 |
| Clock second tick | Top bar, timers | M-SH-04 / SlidingNumber |
| Storage bytes (1 Hz while recording) | Storage KPIs, SM S | AnimatedNumber (M-C-02); no animation on the text more than once per second |

---

## 8. Reduced-motion policy

- **Sources:** `prefers-reduced-motion: reduce` (the OS setting) **OR** an in-app override, a `Switch` "Reduce motion" in System & Maintenance → Settings, persisted in `localStorage` key `dems.motion.reduced`.
- **Wiring:** `<MotionConfig reducedMotion="user">` plus a `useMotionPolicy()` hook that returns `'full' | 'reduced'`. Components mark themselves `data-motion="reduced"` for AC-70.

| Category | Full | Reduced |
|---|---|---|
| Ambient loops (ring rotation, breathing, Ken Burns, topographic drift, Particles, Ripple, ShineBorder, BorderBeam, OrbitingCircles, AnimatedBeam) | On (≤ 4 per viewport) | **Off**, static final frame |
| Enters and exits (R1, R2) | Opacity plus translate or scale, springs | Opacity only, ≤ `fast` (160 ms), no stagger |
| Shared-element flights (emblem, feed, marker, snapshot, evidence header) | `layoutId` flights | **Cross-fade** at the destination |
| Route transitions | Exit 160 + enter ≤ 900 | Cross-fade 160 |
| Login hand-off (M-APP-01) | 1,600 ms flight | 240 ms cross-fade (AC-70) |
| Number tickers | Spring / slide | Jump to final |
| Meters | 60 fps spring interpolation | 10 Hz direct, **kept** (functional) |
| Flashes (shutter, clip flash) | One flash each | Replaced by a static colour or border change |
| Login error shake | One 300 ms shake | Red border only |
| REC indicator | Pulse plus halo | Static red dot (the timer still ticks) |
| Charts (Recharts) | Mount animations | `isAnimationActive={false}` |
| Focus rings | Instant ring plus 120 ms glow | Instant ring, no glow fade |
| Scalar renderer | `customCss` keyframes | Disabled by a media query |

---

## 9. Performance budget

### 9.1 Targets

These are measured by AC-71 on the demo Mac (Apple M5, V35) at 1920×1080 in Chrome:
- **≥ 55 fps average** (target 60) on every page;
- **≤ 3 long tasks over 50 ms** in 30 s of Session Monitor recording, after the first 2 s;
- first-load stagger done ≤ 1,800 ms after the route resolves (Dashboard is the longest).

### 9.2 Property rules (AC-72 enforces part of this)

| Allowed to animate | Conditions |
|---|---|
| `transform` (translate, scale, rotate), `opacity` | Always |
| `filter: blur()` / `brightness()` | Only on elements ≤ 160×160 px (text runs, icons, pills) or **once** on media first paint (M-C-12). Never looping, except the Scalar pill hover (tiny) |
| SVG `pathLength` / `stroke-dashoffset` | SVGs ≤ 400 px (GlowRing, ProgressCircle, emblem, checks) |
| CSS custom properties for colour (`--ring-color`) | Colour transitions (they repaint a small area) |
| `clip-path: inset()` | Once, in the Login → Dashboard photo crop (M-APP-01) |

**Never animated:** `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow`, `border-width`, `outline-*`, `letter-spacing`, `font-size`.
- Glow is changed by the **opacity of a pre-rendered glow layer** (an absolutely positioned pseudo-element or sibling carrying the elevation shadow).
- Size changes use Motion `layout` (FLIP transforms) only for: the sidebar rail, table rows, tab and nav indicators, and the shared elements in R5.

### 9.3 Rendering discipline

- **20 Hz data never re-renders React.** Meters subscribe transiently (`useAudioChannel`) into Motion values. Store updates at 20 Hz touch only the `audio` slice. Every other selector uses `useShallow`.
- React text updates happen at ≤ 4 Hz for fast values (P8) and ≤ 1 Hz for clocks.
- **Canvas feeds:** paint at 25 fps. At most 4 live canvases per page (SM: feed plus 2 mini = 3). Painting pauses when a canvas is off-screen (IntersectionObserver) or the tab is hidden. All canvases share one rAF scheduler.
- **`will-change: transform`** only on: the GlowRing rotating group, the sidebar indicator *while moving*, Ken Burns images, and meter segment containers. It is removed after transient animations (Motion manages this for `layout`). No blanket `will-change`.
- **Recharts:** streaming series (sparklines, health) use `isAnimationActive={false}`; mount animations only for static datasets.
- The Scalar chunk is lazy-loaded (AC-73) and never affects other pages.

### 9.4 Ambient loop count per viewport (cap 4, P3)

| Page | Ambient loops (count) |
|---|---|
| Login | Ring rotation, bracket breathing, Ken Burns, Particles (4) |
| Dashboard | Ring rotation, ring breathing, hero Ken Burns, Ripple/ShineBorder alternating (4) |
| Session Monitor | REC pulse, feed frame glow, camera Ken Burns (canvas), banner dot (4) |
| Devices | Camera Ken Burns ×2 (1 group), recording lamp, port LEDs (3) |
| Network & Time | Orbit, beams, sparkline stream (3) |
| Security & Audit | Chain-head breathe (1) |
| Storage, Evidence, System, API | 0-1 (the API heartbeat pulse is data) |
| Shell (every page) | Topographic drift and the SECURE dot. They count as **one** shell loop; the page budget above is 4 **including** the shell, so pages at 4 pause the topographic drift |

### 9.5 Measurement hooks

With `?debug=1`, an overlay shows:
- fps (a rAF counter over 1 s windows);
- meter frames per second per channel (AC-61);
- a long-task count (PerformanceObserver);
- the active ambient loops (from `useMotionPolicy` registration).

The overlay is **excluded from production builds** (`import.meta.env.DEV` or `?debug=1`).

---

## 10. Library mapping

| Need | Library | API / item (verified props) | Used by |
|---|---|---|---|
| Enter/exit, variants, springs, shared layout | **Motion 13.4.6** (`motion/react`) | `motion.*`, `AnimatePresence` (`mode`), `LayoutGroup`, `layoutId`, `layout`, `MotionConfig` (`reducedMotion`), `useMotionValue`, `useSpring`, `useTransform`, `animate()`, `useReducedMotion` | Everything React-side |
| Clocks and timers | MP **SlidingNumber** | `{ value, padStart?, decimalSeparator? }` (01_specs V27) | M-SH-04, M-C-02, M-C-05, M-C-06, M-C-22 |
| KPI counters | MP **AnimatedNumber** | `{ value, springOptions?, as? }` (V43; `springOptions = counter`) | M-C-02, M-C-03 |
| Text reveals | MP **TextEffect** | `{ per: 'word'\|'char'\|'line', preset: 'blur'\|'fade-in-blur'\|'scale'\|'fade'\|'slide', delay?, speedReveal?, trigger? }` (V43) | M-C-01, M-C-13, M-APP-04 |
| Title shimmer (once) | MP **TextShimmer** | as copied (V26 era) | M-PG-SM |
| Hash resolve | MP **TextScramble** | `{ duration?, speed?, characterSet?, trigger?, onScrambleComplete? }` | M-C-07, M-C-21 |
| Step content | MP **TransitionPanel** | `{ activeIndex, variants: {enter,center,exit}, transition? }` | M-C-09 |
| Hover-follow background | MP **AnimatedBackground** | `{ enableHover, transition?, defaultValue? }` | M-SH-01 |
| Pointer spotlight | MP **Spotlight** | `{ size?, springOptions? }` | M-C-16 |
| Live list insertion | MU **AnimatedListItem** (copied; variants edited) | Vendor spring `{ stiffness: 350, damping: 40 }`; vendor initial `scale: 0` **replaced** (M-C-07) | M-C-07 |
| Travelling border | MU **BorderBeam** | `{ size?, duration?, colorFrom?, colorTo?, reverse?, transition?, borderWidth? }` | M-C-23, M-SH-05 |
| Idle invitations | MU **Ripple**, MU **ShineBorder** | `{ mainCircleSize?, mainCircleOpacity?, numCircles? }`; `{ borderWidth?, duration?, shineColor? }` | M-C-23 |
| Orbit | MU **OrbitingCircles** | `{ radius?, duration?, reverse?, path?, iconSize?, speed? }` | M-PG-NET |
| Beams | MU **AnimatedBeam** | `{ containerRef, fromRef, toRef, curvature?, duration?, gradientStartColor?, gradientStopColor?, pathOpacity? }` | M-PG-NET |
| Particles | MU **Particles** | `{ quantity?, staticity?, ease?, size?, color?, vx?, vy? }` | M-PG-LOGIN |
| Overlays, tabs, switches | **HeroUI v3** built-in CSS transitions (`[data-entering]` / `[data-exiting]`) | Kit defaults kept (D6) | M-C-15 |
| Skeletons, sheen, colon breath, ProgressCircle sweep, Scalar | **CSS** keyframes and transitions, generated from tokens | `theme/heroui-web.css`, `theme/scalar.css` | M-C-03, M-C-16, M-C-24, §5.5 |
| Charts | **Recharts 3.10.1** | `isAnimationActive`, `animationDuration`, `animationEasing`, `animationBegin` | M-C-02 (H), M-PG-STOR, M-PG-NET |

**Not used:**
- Magic UI **NumberTicker**: it depends on in-view detection; MP AnimatedNumber covers counters with the shared `counter` spring.
- MU **AnimatedCircularProgressBar**: the kit `ProgressCircle` comes first (D6).
- Commons-Clause collections: excluded (03 SD-27).

---

## 11. Verification (motion-specific checks; they extend 01_specs AC-24, AC-31, AC-70..AC-73)

| # | Check | Pass condition |
|---|---|---|
| MS-01 | AC-72 grep for layout-property animation | No matches |
| MS-02 | `grep -rn "box-shadow" apps/core-web/src --include=*.tsx \| grep -E "animate\|transition"` | No matches (glow uses opacity layers, §9.2) |
| MS-03 | `grep -rnE "will-change" apps/core-web/src` | Only in the four places in §9.3 |
| MS-04 | `?debug=1` on each page | Ambient-loop count ≤ 4 (§9.4) |
| MS-05 | Flash audit: shutter, clip flash, REC pulse, LEDs | Each ≤ 3 Hz (`flashMaxHz`); the REC pulse is 0.83 Hz; LEDs ≤ 2 Hz |
| MS-06 | Reduced motion (AC-70) | The §8 table holds for each category (visual check with Chrome's "Emulate CSS prefers-reduced-motion") |
| MS-07 | Login hand-off recording (screen capture at 60 fps) | Emblem flight continuous, no jump; total ≤ 1.8 s; with the fallback (H-M1), the emblem starts and ends at the same positions |
| MS-08 | Meters at 20 Hz for 30 s (AC-61, AC-71) | React DevTools Profiler shows **0** commits from DbfsMeter per audio frame |
| MS-09 | O-coverage (Appendix B) | Every O-01..O-53 is realised or explicitly deferred |
| MS-10 | Proof mode (01_specs §4.5, §5.6, M-PX-01/02) | The mid-transition frame differs from the final frame |

---

## 12. Risks and hypotheses

| # | Item | Fallback |
|---|---|---|
| H-M1 | TanStack Router plus `AnimatePresence` can keep the exiting Login route mounted for the cross-route `layoutId` flight | Two-phase hand-off with a stored `DOMRect` (M-APP-01) |
| H-M2 | HeroUI v3 exposes overlay duration custom properties | Accept kit timings (they are CSS transitions already) |
| H-M3 | Scalar's DOM class names are stable enough for the `customCss` motion selectors | Keep the motion rules generic (attribute and role selectors); verify in the API page row |
| H-M4 | The canvas Ken Burns plus grain for 3 feeds stays under budget (01_specs H-S18) | 12.5 fps paint; freeze the grain |
| R-M1 | "Too much" motion undermines calm | Enforced by P3, R8, §9.4 caps and MS-04 |
| R-M2 | Emulator smoothness (mobile parity) is not representative (R3) | Appendix A defers judgement to a physical device |

### Proof modes kept from the scaffold

- **M-PX-01** (web, `?motion=slow`) and **M-PX-02** (mobile, `demsdemo://?motion=slow`) stay exactly as in 01_specs §4.5 and §5.6.
- The page rows extend `?motion=slow` to any route. Its multiplier is `proofSlowFactor` = 10 on every duration and stagger, and springs become tweens of `slower` × 10.

---

## Appendix A: Mobile parity (Reanimated 4.5.1; for the next task, D20)

| Web pattern | Reanimated / RN equivalent | Notes |
|---|---|---|
| R1 panel enter (opacity, y, scale) | `entering={FadeInDown.springify().stiffness(170).damping(26).mass(1)}`, with `.delay(i * 60)` for stagger (cap 8) | Same spring numbers (01_specs §2.7) |
| R2 exit | `exiting={FadeOutUp.duration(160).easing(Easing.bezier(0.4,0,1,1))}` | none |
| Springs `gentle` / `snappy` / `bouncy` / `counter` / `meter` / `indicator` | `withSpring(v, { stiffness, damping, mass })` | Identical parameter names |
| Durations and easings | `withTiming(v, { duration, easing: Easing.bezier(...) })` | none |
| Shared-element flights (R5) | Shared-element transitions are **experimental** (02 L399). Use layout animation (`LinearTransition.springify()`) within a screen, and cross-fade across screens | Emblem flight on mobile: Login → Home cross-fade plus scale |
| GlowRing | **Skia** `Path` with `start`/`end` (sweep) driven by shared values; rotation via `Group transform` with `withRepeat(withTiming(360, {duration: 60000, easing: Easing.linear}), -1)`; breathing via the opacity of a `BlurMask` copy | UI thread (worklets) |
| DbfsMeter | Skia `RoundedRect` segments whose opacity comes from `useDerivedValue` over a shared value fed by the sim's transient subscription (`runOnUI`); peak marker via `translateY` | 0 React renders per frame |
| REC pulse | `withRepeat(withSequence(withTiming(0.35,{duration:600}), withTiming(1,{duration:600})), -1)` | none |
| SlidingNumber / AnimatedNumber | Reanimated `Text` via `useAnimatedProps` (or `AnimateableText`) with per-digit `translateY` | Tabular figures via `fontVariant: ['tabular-nums']` |
| List insertion (M-C-07) | `entering={FadeInDown.duration(240)}` plus `layout={LinearTransition}` in `FlashList` | none |
| Toasts, dialogs, bottom sheet | HeroUI Native `Toast`, `Dialog`, `BottomSheet` built-in animations (02 L297, L306) | Keep kit defaults (D6) |
| Press feedback | Gesture Handler `Pressable` plus `withSpring(0.98, snappy)`, and `expo-haptics` `selectionAsync()` (clip latch: `notificationAsync(Warning)`) | Haptics add the "luxury" tactility on mobile |
| Reduced motion | `.reduceMotion(ReduceMotion.System)` on layout animations; `useReducedMotion()` to disable loops | Same §8 table |
| Performance | UI-thread worklets; Skia for rings and meters; 60 fps target on a physical tablet (R3) | The emulator is informational only |

## Appendix B: Opportunity coverage (04 §8 → this spec)

| O | 04 §8 row (area — element) | Realised by |
|---|---|---|
| O-01 | Shell — App entry | M-APP-03 |
| O-02 | Shell — Sidebar active indicator | M-SH-01, M-SH-02 |
| O-03 | Shell — Sidebar ↔ rail | M-SH-03, M-SH-08 |
| O-04 | Shell — Topographic texture | M-SH-07 |
| O-05 | Shell — Top-bar clock | M-SH-04 |
| O-06 | Shell — SECURE pill | M-SH-05 |
| O-07 | Shell — Bell | M-SH-06 |
| O-08 | Shell — Route change | M-APP-04 |
| O-09 | Login — Page entry | M-PG-LOGIN, M-C-01, M-C-13 |
| O-10 | Login — Ambient | M-C-01, M-C-23 (Particles), M-PG-LOGIN |
| O-11 | Login — Field interaction | M-C-22, M-C-16 |
| O-12 | Login — Submitting | M-C-22 |
| O-13 | Login — Error | M-C-22 |
| O-14 | Login — Locked out | M-C-22, M-C-01 |
| O-15 | Login — Core offline | M-C-22 |
| O-16 | Login — Success hand-off | **M-APP-01** |
| O-17 | Login — Sign out | M-APP-02 |
| O-18 | Dashboard — SYSTEM READY ring | M-C-01 |
| O-19 | Dashboard — Hero photo and tagline | M-C-13 |
| O-20 | Dashboard — Status strip | M-C-02, M-C-10, M-PG-DASH |
| O-21 | Dashboard — Active Session idle | M-C-23 (Ripple, ShineBorder) |
| O-22 | Dashboard — Idle → recording | M-PG-DASH data moment, M-C-05 |
| O-23 | Dashboard — Device tiles | M-C-12, M-C-04 |
| O-24 | Dashboard — Storage ring and legend | M-C-03, M-C-02 |
| O-25 | Dashboard — Security, Time & Network | M-C-10, M-PG-DASH |
| O-26 | Dashboard — Sealed Evidence Today | M-C-02, Recharts (M-PG-DASH) |
| O-27 | Dashboard — Recent Events | M-C-07 |
| O-28 | Dashboard — Quick actions | M-C-16 (Spotlight, icon micro-motion) |
| O-29 | Session Monitor — Page header | M-PG-SM (TextShimmer once), M-C-10 |
| O-30 | Session Monitor — Live feed | M-C-05, M-C-12 |
| O-31 | Session Monitor — Session details | M-C-02 |
| O-32 | Session Monitor — Evidence integrity | M-PG-SM (verification sweep), M-C-21 |
| O-33 | Session Monitor — Audio monitor | M-C-04 |
| O-34 | Session Monitor — Action bar | M-C-16..M-C-20 |
| O-35 | Session Monitor — Timeline | M-C-08 |
| O-36 | Session Monitor — Storage during session | M-C-03, M-C-02 |
| O-37 | Session Monitor — Live audit events | M-C-07 |
| O-38 | Flow — Start New Session | M-PG-NEW, M-C-09 |
| O-39 | Flow — End → finalization | M-C-19, M-C-09 (SEALED stamp) |
| O-40 | Evidence — List and detail | M-PG-EVID, M-C-11, M-C-21 |
| O-41 | Devices — Tiles and ports | M-PG-DEV, M-C-23 (LEDs, lamp) |
| O-42 | Storage — Charts | M-PG-STOR |
| O-43 | Network & Time — Live widgets | M-PG-NET, M-C-23 |
| O-44 | Security & Audit — Chain and shield | M-PG-SEC, M-C-21, M-C-10 |
| O-45 | System & Maintenance — Diagnostics and update | M-PG-SYS, M-C-09 |
| O-46 | API Reference — Page entry | M-PG-API |
| O-47 | API Reference — Endpoint expand | §5.5 (CSS) |
| O-48 | API Reference — Try-it response | §5.5 |
| O-49 | API Reference — Simulated endpoint | §5.5 (SIMULATED sheen) |
| O-50 | API Reference — Realtime (WS) panel | M-C-06, M-C-07 |
| O-51 | Global — Toasts and alerts | M-C-14 |
| O-52 | Global — Loading | M-C-24 |
| O-53 | Global — Reduced motion | §8 |

**Coverage:** 53 of 53 opportunities are realised. None are deferred.

---
*Generated: 2026-10-01 00:50 WIB by data-analyst (Step B of the rev-3 delegation)*
