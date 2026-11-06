# Research 04: UI Design Analysis (ui_design/*.png as build input for the Core web console)

| Field | Value |
|---|---|
| Task | 2026-09-30_dems_demo_stack_setup |
| Produced by | image-analyst (parallel run) |
| Date | 2026-10-01 |
| Status | complete, with the limitations in §0 |
| Narrative tier | 2: what is in the design, why it matters for the build, how it was read (image and region) |
| Scope | 10 web pages: the 8 sidebar menus (D18), **Login** (D25) and **API Reference / Swagger** (D26); plus a mobile reference (D17, D20) |
| Inputs | `ui_design/` (5 PNGs); decisions D6, D10, D15 to D22, D25, D26; `research/01_explore.md` (Part C enumerations, §20.1, §21.2, suggested screen inventory); `research/03_analysis.md` (SD-24 to SD-35, V4, V6); `masterplan/01_specs.md` (mock-core health and WS contract) |
| Consumers | Row 6 blueprint refinement, `masterplan/01_specs.md` revision, the coder-execution rows that build the `apps/core-web` pages, the later motion spec, and the later mobile UI task (D20) |

---

## 0. Method, conventions and limitations

**Source codes used throughout**

| Code | File | Native size | Content |
|---|---|---|---|
| DS | `ui_design/DEMS-DesignSystem.png` | 1672x941 | 12 numbered sections: brand, palette, typography, buttons, forms, chips, cards, navigation, icons, alerts, tokens, data viz |
| D1 | `ui_design/DEMS-Dashboard1.png` | 1672x941 | Dashboard screen, full shell |
| SM | `ui_design/DEMS-SessionMonitor.png` | 1672x941 | Session Monitor screen, full shell |
| AS | `ui_design/DEMS-AssetSample.png` | 1536x1024 | Component catalogue inside a live-looking shell |
| MB | `ui_design/DEMS-Mobile.png` | 1536x1024 | 10 phone screens in 2 rows of 5, numbered 1 to 10 in captions |

**How the images were read**
- Each PNG was read once at native resolution with the Read tool.
- Regions are given as native pixel boxes `(x1–x2, y1–y2)`, read by eye. Tolerance is about ±10 px. That is good enough for layout and crop planning. Re-measure before any pixel-exact crop.

**Colour values**
- Hex values are quoted **as printed** only for the 9 DS swatches.
- Every other colour is marked **est.** (a visual estimate).
- This agent has no shell or image library, so no pixel sampling was done.
- **Recommended follow-up:** an agent with Bash samples these colours with python/PIL: panel fill, border alpha, glow, meter yellow and sealed purple.

**Kit names**
- HeroUI component names are the `dist/components/<dir>` directories of `@heroui/react@3.2.6`.
- Variant values come from `@heroui/styles@3.2.6` `*.styles.d.ts`.
- Both packages are already unpacked in this session's scratchpad (`.../scratchpad/tar/heroui/package`, `.../scratchpad/tar/hs/package`).
- Names are written in PascalCase here. Confirm the export identifiers at import time.

**Library and renderer claims that are hypotheses**
- Magic UI and Motion Primitives item names come from this agent's knowledge of those collections. They were not fetched from a registry in this task. Treat them as **candidates to verify at copy time**; this is the same caveat 03_analysis attaches to capability S18.
- Swagger UI and Scalar behaviour (§5.9) also comes from knowledge, not from fetched packages. It is marked as hypothesis for the spec revision to verify.

**Scale hypothesis (H-scale)**
- 1672x941 is 16:9, and 1672/1920 = 941/1080 = 0.871.
- So the desktop mockups are most likely 1920x1080 designs exported at 0.871 scale. The files carry no metadata to confirm this.
- Sizes below are given at mockup scale and, where useful, at 1920 (×1.148).

**Verified HeroUI v3.2.6 facts this document relies on**

| Fact | Evidence |
|---|---|
| The component directories include: accordion, alert, alert-dialog, autocomplete, avatar, avatar-group, badge, breadcrumbs, button, button-group, calendar, card, checkbox, checkbox-group, chip, close-button, combo-box, date-field, date-picker, date-range-picker, description, disclosure, drawer, dropdown, empty-state, field-error, fieldset, form, input, input-group, kbd, label, link, list-box, menu, meter, modal, number-field, pagination, popover, progress-bar, progress-circle, radio, radio-group, scroll-shadow, search-field, select, separator, skeleton, slider, spinner, surface, switch, table, tabs, tag, tag-group, textarea, textfield, time-field, toast, toggle-button, toggle-button-group, toolbar, tooltip, typography | Glob `scratchpad/tar/heroui/package/dist/components/*/index.d.ts` |
| There is **no** navbar, sidebar, stepper, timeline or chart component | Same listing (and 03_analysis F5) |
| Button `variant`: primary, secondary, tertiary, outline, ghost, danger, danger-soft. `size`: sm, md, lg. Also `isIconOnly` and `fullWidth` | `hs/package/dist/components/button/button.styles.d.ts` L3–L23 |
| Chip `color`: accent, danger, default, success, warning. `variant`: primary, secondary, soft, tertiary. `size`: sm, md, lg | `chip/chip.styles.d.ts` L3–L44 |
| Card `variant`: default, secondary, tertiary, transparent. Slots: header, title, description, content, footer | `card/card.styles.d.ts` L3–L23 |
| Alert `status`: accent, danger, default, success, warning. Slots: indicator, title, description, content | `alert/alert.styles.d.ts` L3–L25 |
| There is **no** `--info`, purple or violet theme variable | Grep `--(info\|purple\|violet)` in `hs/package` returned 0 matches |

**Consequence:** the design's **Info Blue** and the purple used for **Sealed** have no HeroUI semantic slot. Both need a token extension: custom CSS variables plus Tailwind utilities, or a `tailwind-variants` extension of Chip, Alert and Button. The API method colours in §5.9 need the same treatment.

---

## Key takeaways

1. **The design system is complete enough to build from.** DS provides 9 printed colours, an 8-role type scale and printed spacing, radius, stroke and elevation tokens. AS catalogues almost every component used on D1 and SM.
2. **Almost everything maps to HeroUI v3 components.** Only five elements need compositions on top of kit primitives and Motion (D6-compliant, like S12 in 03_analysis):
   - the SYSTEM READY ring (reused on Login)
   - the segmented dBFS bar meters
   - the session timeline
   - the Start-Session stepper
   - the app shell (HeroUI has no sidebar or navbar)
3. **The swatches leave out the most visible surface values:**
   - the warm brown-black panel fill
   - the gold border alpha and the glow
   - the meter yellow
   - the purple used for Sealed

   The printed Charcoal `#1F262E` is a cool blue-grey that does not match the warm panels as rendered.
4. **Storage "80%" contradicts its label.** It is labelled "STORAGE USED", but the numbers printed with it (3.2 TB free of 4.0 TB, 804 GB used) make 80% the **free** share. This must be decided before the ring is built (§9 #4).
5. **The mockups describe a world, not a consistent dataset:**
   - three time zones (UTC+01:00, UTC+10:00, UTC+07:00)
   - three different "current" sessions
   - mixed EN/ID vocabulary (Tersangka/Saksi, "AKP" vs "Det.")

   The simulator seed data (D19) should canonicalise one dataset.
6. **Web and mobile disagree on primary-button text.** Web uses white text on gold/bronze: about 1.5:1 on `#FFC86B` and 2.0:1 on `#FF9F3D`, which fails WCAG AA. Mobile uses dark text on gold (about 12.7:1). Recommend dark text on web as well.
7. **Proposed shell sizes:**
   - sidebar 232 px at 1920 and 216 px at 1440
   - top bar 80 / 72 px
   - gutter 16 / 12 px
   - icon rail below 1280 px, Drawer below 1024 px
8. **Logo, topographic texture and hero photo must be recreated.** The emblem is a raster of at most about 90 px with its glow baked in, and the photos have UI overlays and text baked in. Camera photos can be cropped only as placeholders. Looped synthetic clips (S5) are the real answer.
9. **The icons match Lucide**: about 2 px stroke on a 24 px grid, round caps and joins. Lucide is already chosen (SD-34). A few glyphs are drawn filled (active home, gear) and need `fill="currentColor"`.
10. **The two added pages (D25, D26) derive cleanly from existing design language:**
    - **Login** is a full-viewport split. The brand side reuses the D1 hero photo, tagline and glow ring around a large emblem. The auth card is modelled on MB 1 and adds the §20.1 lockout states. A successful sign-in hands off into the shell with a shared-element emblem flight.
    - **API Reference** is its own sidebar item in a lower "Developer" group. The OpenAPI renderer sits inside an L2 panel and takes the tokens listed in §5.9, with method colours mapped onto the palette. A live WebSocket heartbeat panel sits beside it, because OpenAPI cannot describe `/ws`.

---

## 1. Design tokens as seen

### 1.1 Printed palette (DS section 02, region (420–1660, 83–250))

| # | Name (printed) | Hex (printed) | Usage (printed) | Swatch region | What the mockups show | Why it matters / mapping |
|---|---|---|---|---|---|---|
| 1 | Primary Gold | `#FFC86B` | Brand, Primary Actions, Highlights | (452–542, 115–160) | Light peach-gold. Used for the top-bar clock, "READY", "View All" links, icons, ring arcs and the SECURE text | HeroUI `--accent` |
| 2 | Secondary Bronze | `#FF9F3D` | Secondary Actions, Accents, Icons | (571–662, 115–160) | The orange in button gradients, the active nav fill, panel borders and glows | Second accent and the base colour for glow and border |
| 3 | Success Green | `#22C55E` | Success States, Online, Ready | (692–782, 115–160) | Status dots, READY labels, chips, meter bars | `--success`. It equals Tailwind green-500 (hypothesis: the designer used Tailwind defaults) |
| 4 | Warning Amber | `#F59E0B` | Warnings, Attention | (813–904, 115–160) | Warning chip and alert, amber event dots, timeline note nodes | `--warning` (= Tailwind amber-500) |
| 5 | Error Red | `#EF4444` | Errors, Critical Alerts | (934–1025, 115–160) | REC dot, destructive buttons, error alert, Tersangka chip | `--danger` (= Tailwind red-500) |
| 6 | Info Blue | `#3B82F6` | Information, Links, Updates | (1057–1147, 115–160) | Info chip and alert, NEW badge, mobile Saksi and Exported chips | **No HeroUI slot**; add custom `--info` (= Tailwind blue-500) |
| 7 | Neutral Gray | `#9CA3AF` | Muted Text, Icons, Placeholders | (1179–1268, 115–160) | Captions, "Logged in as", placeholders, Offline dot | `--muted` (= Tailwind gray-400) |
| 8 | Charcoal | `#1F262E` | Cards, Surfaces, Elevated Backgrounds | (1297–1438, 115–160) | A cool blue-grey that does **not** match the warm panels in D1, SM and AS | See §1.4; this needs a decision |
| 9 | Background Black | `#0B0D0F` | App Background, Main Canvas | (1462–1640, 115–160) | Matches the canvas | `--background` |

**Contrast from the printed hex.** Computed by hand with the WCAG 2.x relative-luminance formula; accuracy about ±0.1.

| Pair | Ratio | Result |
|---|---|---|
| Gold on black | 12.7:1 | Pass |
| Neutral Gray on black | 7.7:1 | Pass |
| Green on black | 8.5:1 | Pass |
| Blue on black | 5.3:1 | Pass |
| Red on black | 5.2:1 | Pass |
| White on Gold | 1.5:1 | Fail |
| White on Bronze | 2.0:1 | Fail |
| White on Red | 3.8:1 | Large text only |
| Black on Gold | 12.7:1 | Pass |
| Black on Bronze | 9.5:1 | Pass |

### 1.2 Colours used in the mockups that the swatches do not cover

| Colour | Where it appears (region) | Est. value | Why it matters | Proposal |
|---|---|---|---|---|
| **Sealed purple** | DS chip "Sealed" (350–428, 565–597); AS badge SEALED (165–226, 893–924) | Violet: est. `#8B5CF6` border/text on an est. `#2E1F4F` fill | Not a swatch and not a HeroUI slot. It also conflicts with the gold "Sealed" chip on mobile (MB 5, MB 6) | Decide between a custom `--sealed` violet and Primary Gold plus a lock icon (as on mobile). Recommend violet: gold already means brand/primary, and a distinct colour per lifecycle state scans faster |
| **Meter "hot" yellow** | Top lit bar of each dBFS meter: DS Audio Level Card (1300–1390, 570–640); D1 MIC tiles (1320–1390, 505–565); SM Audio Monitor | Est. `#FACC15`/`#EAB308`, yellower than Warning Amber | Meter zones read as green (safe), yellow (hot), and red (clip, not drawn) | Use Warning Amber for the hot zone to stay inside the palette, or add `--meter-hot`. Clip zone = Error Red |
| **Warm panel fill** | Every panel in D1, SM and AS | Est. warm brown-black `#14100C` to `#1A140F` | The dominant surface colour of the product | Define `--surface` warm (§1.4) |
| **Gold panel border** | Panel outlines everywhere | Est. Secondary Bronze at 35–55% alpha, brighter near corners | The signature look | Est. `--border: rgb(255 159 61 / .40)` |
| **Glow** | Panels, active nav, primary button, rings, video frame | Est. bronze/gold outer blur of 8–24 px at 15–45% alpha | Carries elevation | §1.6 elevation |
| **Warm white text** | Headings, values, nav labels | Est. `#F3EDE4`, slightly warm rather than pure white | Base foreground | Est. `--foreground: #F5F0E8` |
| **Muted gold text** | "Digital Evidence Recording Controller" (D1 117–377, 44–60); letter-spaced "SECURE / RECORD / PRESERVE / PROTECT" (DS 290–360, 125–208) | Est. `#C9A86A` | Tertiary and brand-caption text | Custom `--accent-muted` |
| **Soft success chip fill** | D1 Security panel chips ACTIVE, SYNCHRONIZED, CONNECTED, SECURE (720–1240, 742–760) | Est. green at about 15% over the panel | The soft-chip pattern | HeroUI Chip `color="success" variant="soft"` (verify its visuals) |
| **Red-tint destructive fill** | DS Destructive Button (612–845, 457–497); SM End Session (1418–1657, 562–622); AS Stop Recording (1370–1518, 267–311) | Est. red at 15–20% fill with a 1 px red border | Destructive style | Button `variant="danger-soft"` |
| **Photo grade** | D1 hero (600–1672, 68–320); every camera thumbnail | Warm sepia/amber, low saturation, dark | Makes photos harmonise with the gold UI | CSS grade (§7) |
| **Topographic texture** | D1 sidebar bottom (0–200, 575–810); SM (0–200, 560–800) | Bronze contour lines with glow | Brand texture | SVG recreation (§7) |
| **Canvas light streaks** | DS header band (0–1672, 0–75); D1/SM top-bar background | Diagonal warm streaks and radial glow | Depth | CSS gradients |
| **Subject-type colours** | MB 3 segment "Tersangka" (red outline); MB 5 chips Tersangka (red) and Saksi (blue) | Error Red and Info Blue, soft | Subject-type colour coding | Map `SubjectType` to a colour in the shared status-token map (S8) |

### 1.3 Glow and border treatment

| Element | Border | Glow | Gradient direction | Source (region) |
|---|---|---|---|---|
| Panel (card) | 1 px bronze, est. 35–55% alpha, slightly brighter near corners and along the top edge | Outer, est. 8–16 px blur at 10–25% bronze | Border brightness fades from top-left to bottom-right (est.) | D1 all panels, e.g. Storage & Evidence (218–683, 636–795) |
| Panel header | Same frame; the header strip is slightly lighter than the body | none | — | D1 Active Session header (218–795, 405–445) |
| Chamfered corners | Some corners look angled: Active Session top-right, Devices & Inputs top-left, the ring card edge, the end of the top-bar logo zone | — | — | D1 (770–830, 405–430), **low confidence**. Optional; implement with CSS `clip-path` or an SVG frame |
| Active nav item | 1 px gold | Strong, est. 12–20 px at 35–50% | Fill runs horizontally, bright bronze at the left to near-black at the right | D1 (0–200, 80–133); AS (18–225, 105–155) |
| Primary button | 1 px gold | Est. 10–16 px at 30–40% | Amber-to-bronze fill with a lighter top highlight | DS (612–845, 297–336); D1 (275–508, 580–620) |
| Secondary button | 1–1.5 px gold/bronze on dark | Faint | — | DS (612–845, 350–390) |
| Ghost button | 1 px neutral bronze at low alpha | none | — | DS (612–845, 402–442) |
| Icon button | 1 px gold; radius est. 10–12 | Faint | — | DS (878–1085, 297–350) |
| Inset tile | 1 px bronze, est. 20–30% | none (glow rises on hover, proposal) | — | D1 device tiles (812–1650, 452–615) |
| Ring gauge | Arc stroke est. 8–10 px at mockup scale, rounded caps; dark bronze track | Bloom on the arc | Angular, bronze to gold | D1 Storage ring (236–330, 690–785) |
| SYSTEM READY ring | Multi-layer (§3.1 A) | The strongest bloom in the UI, est. 20–30 px | Angular | D1 (230–590, 78–398) |
| SECURE pill | 1–1.5 px gold; radius est. 10 | Soft | — | D1 (1452–1660, 10–60) |
| Video frame | 1.5–2 px bronze/gold | Est. 12 px | — | SM (228–945, 214–542) |
| Status dot | none | Halo est. 4–6 px, same colour at about 40% | — | D1 events (238–250, 836–921) |
| Wordmark and page titles | — | Slight | Vertical, white at the top to gold at the bottom | D1 (118–430, 14–42); SM (312–752, 92–128) |
| Chart bars | — | Slight | Vertical, bronze at the bottom to gold at the top | D1 (1495–1620, 710–765) |
| Top bar | Bottom hairline, about 1 px gold at low alpha | — | Logo zone has a lighter gradient | D1 (0–1672, 66–70) |
| Sidebar | Right hairline | — | — | D1 (198–202, 68–941) |

### 1.4 Surface layering

| Layer | Est. value | Where (region) | HeroUI variable |
|---|---|---|---|
| L0 canvas | `#0B0D0F` (printed) plus warm radial glows and diagonal streaks | Behind everything | `--background` |
| L1 shell (top bar, sidebar) | Canvas plus an est. 2–4% warm lift; hairline borders | D1 top bar (0–1672, 0–68), sidebar (0–200, 68–941) | Custom `--shell` |
| L2 panel | Est. warm `#14100C`–`#1A140F`, 1 px gold border, glow, radius about 12 | All panels | `--surface` |
| L3 inset | Darker than the panel, est. `#0E0B08`–`#110D0A`; 1 px low-alpha border; radius about 8 | Device tiles, metric tiles, key-value rows (SM 975–1295, 220–475), form fields, quick-action cards | `--surface-secondary`, `--field-background` |
| L4 media overlay | Black chips at 50–65% | "1080p - 25 fps" (D1 820–905, 590–612), "REC 00:18:42" (SM 780–930, 225–248) | Custom |
| L5 floating | Alerts: a semantic tint at 10–15% with a 1 px semantic border. Menus and popovers are not drawn | DS alerts (1265–1650, 700–800) | `--overlay` |

**Charcoal `#1F262E`.** Panels in D1, SM and AS render warm, not cool. Two options:
- use Charcoal only for L5 (menus, popovers, tooltips), or
- replace it with a warm equivalent.

This is decision Q6 in §10.

### 1.5 Typography (DS section 03, region (12–585, 262–515))

| Role (printed) | Sample (printed) | Spec (printed) | Where it is used in the screens (sizes at mockup scale) | Build note |
|---|---|---|---|---|
| Display | TRUSTED RECORDING FOR A SAFER TOMORROW | Orbitron / Eurostile Bold 32/40, Tracking 1% | Wordmark "DEMS EDGE CLIENT" (D1 118–430, 14–42, about 28 px, upright); hero tagline (D1 728–1228, 140–210, about 34 px, **italic/oblique**); page title "SESSION MONITOR" (SM 312–752, 92–128, about 38 px, italic); "READY" in the ring (D1 382–500, 242–278, about 34 px) | Orbitron (OFL) has **no italic**, so titles need synthetic oblique (`skewX(-8deg to -10deg)`). Eurostile is commercial; do not ship it |
| Heading 1 | System Ready | Inter Bold 24/32 | KPI "7" (D1 1365–1385, 700–728, about 30 px); "No active session" (about 17 px, smaller than spec) | — |
| Heading 2 | Active Session | Inter SemiBold 20/28 | "3.2 TB Free" (D1 350–443, 718–738, about 18 px) | — |
| Heading 3 | Device Status | Inter SemiBold 16/24 | Quick-action titles; "SECURE" in the pill | — |
| Body | Secure interview recording, evidence handling and integrity monitoring. | Inter Regular 14/20 | Hero paragraph (about 16 px); session-detail values; event text (about 11–12 px in lists) | — |
| Caption | Last updated 2 minutes ago | Inter Regular 12/16 | "Interview Room 1", "Logged in as", legend rows, action subtitles | — |
| Label | CAMERA 1 | Inter Medium 11/16, Uppercase, Tracking 5% | "READY" under device names; Security-panel chips | — |
| Mono / Data | 1080p - 25 fps - UTC 14:27:32 | JetBrains Mono / Roboto Mono 12/16, Tracking 2% | Printed, but **not visibly used**. IDs (SES-20250526-0017), times and timers render in a proportional sans on D1 and SM | Use JetBrains Mono (or Inter with `tabular-nums`) for timers, clocks, IDs, hashes, dBFS values, API paths and JSON so ticking digits do not jitter |

**Present in the screens but missing from the printed scale**

| Style | Appearance | Where (region) | Proposal |
|---|---|---|---|
| Panel title | Uppercase, tracking est. 8–10%, Inter SemiBold about 14–15 px | D1 "ACTIVE SESSION" (276–398, 419–433) | New token `title-panel` |
| Nav label | Inter Regular/Medium, about 15 px | D1 (68–166, 98–114) | — |
| Top-bar clock | Bold gold, about 26 px; the face is ambiguous (Inter Bold or Orbitron) | D1 (868–958, 22–48) | A tabular face: JetBrains Mono SemiBold, or Orbitron after checking its digit widths |
| Wide-tracked micro labels | Overline at est. 40–50% tracking; footer lines at about 25% | Overline "DIGITAL EVIDENCE RECORDING CONTROLLER" (D1 725–1142, 118–130); footer "SECURE RECORDING…" (D1 25–165, 865–905) | — |

**Fonts to self-host:** Orbitron, Inter and JetBrains Mono. They replace Geist per D16, which supersedes SD-35. 03_analysis collected no package pins for these three families, so pins are a **gap for data-collector**. The `@fontsource` / `@fontsource-variable` package names are a hypothesis.

### 1.6 Spacing, radius, stroke, elevation (DS section 11, region (12–930, 850–935))

| Token group | Printed values | Observed usage in D1 / SM / AS | Proposed defaults |
|---|---|---|---|
| Spacing (px) | 4, 8, 12, 16, 24, 32, 48 (squares at (30–255, 880–915)) | Panel gutter about 10–12 at mockup scale (about 12–14 at 1920). Panel padding about 12–16. Event-row pitch about 19 (D1) | Gutter 12 (1440) / 16 (1920); panel padding 16; tile gap 8; row pitch 32 at 1920 |
| Border radius | 4, 8, 12, 16, Full ((305–500, 880–915)) | Badges 4 (AS). Buttons and inputs 8. Tiles 8–10. Panels 12. SECURE pill 10–12. Ring and hero card 16. Chips and dots Full | Panel 12, tile 8, button/input 8, chip full, badge 4 |
| Stroke / border | 1px, 1.5px, 2px ((540–690, 880–915)) | 1 px: panels and tiles. 1.5 px: secondary buttons, SECURE pill. 2 px: video frame, selected tab | Add a 2 px gold **focus ring**; the mockups show no focus state |
| Elevation / shadow | 0, 1, 2, 3 (glow squares (735–905, 880–915)) | 0: inset tiles. 1: tile hover. 2: panels. 3: active nav, primary button, ring | Est. e1 `0 0 6px rgb(255 159 61 / .15)`, e2 `0 0 12px rgb(255 159 61 / .25)`, e3 `0 0 20px rgb(255 159 61 / .40)` |

### 1.7 Proposed token mapping to HeroUI variables

The variable names are those 03_analysis V6 found in both HeroUI web and HeroUI Native, so one token file themes both apps (SD-38).

| Variable | Proposed value | Basis |
|---|---|---|
| `--background` | `#0B0D0F` | Printed |
| `--foreground` | Est. `#F5F0E8` | Visual |
| `--accent` | `#FFC86B` | Printed |
| `--accent-foreground` | `#0B0D0F` | 12.7:1 contrast; matches the mobile buttons |
| `--surface` | Est. warm `#16110D` | Visual |
| `--surface-secondary` / `--field-background` | Est. `#0F0C09` | Visual |
| `--muted` | `#9CA3AF` | Printed |
| `--border` | Est. `rgb(255 159 61 / .40)` | Visual |
| `--success` / `--warning` / `--danger` | `#22C55E` / `#F59E0B` / `#EF4444` | Printed |
| `--focus` | `#FFC86B` | Proposal |
| `--link` | `#FFC86B` | The mockups draw links gold, although DS prints Info Blue as "Links" (§9 #22) |
| `--radius` | 12px | Panels |
| Custom `--info` | `#3B82F6` | Printed; no HeroUI slot |
| Custom `--sealed` | Est. `#8B5CF6` | Pending decision Q4 |
| Custom `--bronze` | `#FF9F3D` | Printed |
| Custom `--charcoal` | `#1F262E` | Printed; L5 use only (Q6) |
| Custom `--method-get/post/put/delete/ws` | `#3B82F6` / `#22C55E` / `#F59E0B` / `#EF4444` / `#FF9F3D` | §5.9 proposal; all printed palette hex |

---

## 2. App shell

### 2.1 Top bar (D1 region (0–1672, 0–68); identical in SM (0–1672, 0–68) and AS (0–1536, 0–65))

Left to right:

| # | Element | Contents as seen | D1 region | Build mapping | Notes |
|---|---|---|---|---|---|
| 1 | Logo lockup | Shield-and-fingerprint emblem (gold, glowing); "DEMS EDGE CLIENT" (display face, white-to-gold); "Digital Evidence Recording Controller" (muted gold, about 15 px) | (28–432, 8–62) | SVG emblem plus live text | Clicking it goes to the Dashboard. It is also the landing target of the Login hand-off (§5.8) |
| 2 | Flexible space | Darker area; possibly an angled edge where the logo zone ends | (440–700, 0–68) | — | Low confidence on the angle |
| 3 | Date | "Mon, 26 May 2025" (about 16 px, warm white) | (716–840, 26–46) | Text | Driven by the simulator clock |
| 4 | Divider | 1 px vertical | x ≈ 855 | Separator (vertical) | — |
| 5 | Clock | "14:27:32" (gold, bold, about 26 px) | (868–958, 20–48) | Text with digit animation | Needs tabular digits |
| 6 | Divider | — | x ≈ 985 | Separator | — |
| 7 | Device ID block | Monitor icon; "Device ID" (caption); "DEMS-IR-01" (about 15 px); "Interview Room 1" (caption) | (1008–1142, 16–62) | Text plus Tooltip (full identity: serial, firmware) | — |
| 8 | Divider | — | x ≈ 1200 | Separator | — |
| 9 | User | User icon; "Logged in as" (caption); "Investigator" (about 16 px); chevron-down | (1218–1400, 18–50) | Dropdown, triggered by a ghost Button, with an Avatar | Proposed menu: profile, role, lock console, **sign out** (returns to Login, §5.8) |
| 10 | Divider | — | x ≈ 1425 | Separator | — |
| 11 | SECURE pill | Gold padlock; "SECURE" (gold, uppercase, about 16 px); "All systems operational" (about 11 px); glowing green dot at the right | (1452–1660, 10–60) | Button `variant="outline"` (restyled) opening a Popover that lists the integrity checks | States: SECURE, ATTENTION, CRITICAL, UNKNOWN (the AS shield set) |

**Present in the DS Top Bar snippet but missing on the desktop top bar.** The snippet (DS (262–712, 712–752)) has a hamburger (collapses the sidebar) and a notification bell. Recommend adding the bell between the clock group and the user block, fed by the alert and audit stream. The hamburger belongs to the collapsed layouts in §2.5.

### 2.2 Sidebar (D1 region (0–200, 68–941))

| Element | As seen | Region | Build mapping |
|---|---|---|---|
| 8 items | Dashboard (house), Session Monitor (monitor), Evidence (file-text), Devices & Inputs (camera), Storage (database), Network & Time (network), Security & Audit (shield), System & Maintenance (gear; the label wraps to two lines) | Label y-centres ≈ 106, 163, 220, 279, 335, 391, 450, 512 | Composition: TanStack Router `Link` plus a Motion `layoutId` indicator. HeroUI has no sidebar; ListBox is optional for arrow-key navigation |
| **9th item (proposed, D26)** | Not in any mockup. "API Reference" in a separate lower group: a Separator, a micro label "DEVELOPER", then the item with Lucide `braces` and a small "DEV" Chip. Same active treatment, visually secondary (muted icon at rest) | Below System & Maintenance, above the topographic texture (about y 560–600 at mockup scale) | Same composition. Decision Q12 in §10 |
| Item metrics | Height about 52; pitch about 57; icon about 24 px at x ≈ 34; label at x ≈ 68, about 15 px | — | With a 9th item at 1440x900 (pitch 54): 9 × 54 + group gap 32 = 518 px, which fits under a 72 px top bar and leaves about 300 px for texture and footer |
| Active style in D1 and SM | Full-bleed from the screen edge: horizontal bronze-to-dark gradient, gold border, glow, white icon and label; right corners rounded | D1 (0–200, 80–133); SM (0–200, 135–187) | See §9 #21 |
| Active style in AS and DS | Inset rounded card (radius about 8) with the same fill | AS (18–225, 105–155); DS (25–235, 700–730) | **Recommended**: it also works in the collapsed icon rail |
| Inactive items | Gold/beige outline icon, light label, no fill; AS adds thin separators between items | AS (18–230, 160–530) | — |
| Topographic texture | Bronze contour "mountains" with glow | D1 (0–200, 575–810) | SVG (§7); shrinks or crops when the 9th item is present |
| Footer | "DEMS EDGE CLIENT" (tracked, grey, about 13 px); "v2.4.1"; "SECURE RECORDING / TRUSTED EVIDENCE / SAFER COMMUNITIES" (about 10 px, tracked about 25%); a short gold rule | D1 (25–165, 815–920) | Text; take the version from `package.json` |

Login (§5.8) is the 10th page. It sits **outside** the shell and has no sidebar item.

### 2.3 Proportions at 1672x941 (measured on D1)

| Measure | px | % of the dimension |
|---|---|---|
| Top-bar height | ≈ 68 | 7.2% of 941 |
| Sidebar width | ≈ 200 | 12.0% of 1672 |
| Gap from sidebar to content | ≈ 18 | 1.1% |
| Panel gutter | ≈ 10–12 | 0.6–0.7% |
| Right and bottom margin | ≈ 11–12 | 0.7% |
| Content box | x 218–1660 (1442 px = 86.2%), y 78–930 | — |
| Dashboard row heights | Hero 332 (35.3%), row 2 223 (23.7%), row 3 159 (16.9%), row 4 127 (13.5%) | — |

### 2.4 Proposed sizes at the two target viewports

| Token | 1672 mockup | 1920x1080 (×1.148, snapped to 4/8) | 1440x900 |
|---|---|---|---|
| Top bar | 68 | 80 | 72 |
| Sidebar | 200 | 232 | 216 |
| Nav item height / pitch | 52 / 57 | 56 / 64 | 48 / 54 |
| Page padding | 12–18 | 16 | 12 |
| Gutter | 10–12 | 16 | 12 |
| Content width | 1442 | 1920 − 232 − 32 = 1656 | 1440 − 216 − 24 = 1200 |
| Content height (no scroll) | 862 | 1000 | 828 |
| Dashboard row heights | 332 / 223 / 159 / 127 | 340 / 256 / 180 / 148; with 3×16 gutters = 972 ≤ 1000 | 280 / 216 / 156 / 128; with 3×12 gutters = 816 ≤ 828 |

**Type size.** Keep type at the printed px on both viewports; do not scale body text with the viewport. Only Display uses `clamp()`. The shell stays fixed and only the content area scrolls, which covers heights below 900.

**12-column grid.** Measured column fractions and their 12-column equivalents:

| Screen / row | Measured fractions | Columns |
|---|---|---|
| Dashboard hero | 26.5 / 73.5 | 3 \| 9 |
| Dashboard row 2 | 40 / 59 | 5 \| 7 |
| Dashboard row 3 | 32 / 38.5 / 27.6 | 4 \| 5 \| 3 |
| Dashboard row 4 | 50 / 49 | 6 \| 6 |
| Session Monitor row A | 51 / 23.6 / 23.8 | 6 \| 3 \| 3 |
| Session Monitor action bar | Six equal buttons | 6 × 2 |
| Session Monitor row C | 44.7 / 30 / 23.8 | 5 \| 4 \| 3 |

### 2.5 Collapse behaviour for narrower widths (proposal)

| Viewport width | Sidebar | Top bar | Grid |
|---|---|---|---|
| ≥ 1600 | Full, 232 px | All elements | 12 columns |
| 1280–1599 | Full, 216 px | Below 1366: hide the tagline under the wordmark and the "Interview Room 1" subline | 12 columns |
| 1024–1279 | Icon rail, 72 px. Labels become Tooltips. The active item is an inset gold square | Date hidden (the clock stays). The user block collapses to an Avatar. The SECURE pill becomes icon plus dot | 8 columns; Dashboard row 3 wraps to 2 + 1 |
| 768–1023 | Hidden; a HeroUI Drawer (placement left) opened by the hamburger from the DS snippet | Hamburger, emblem, clock, bell, avatar, SECURE dot | Stack of 1–2 columns |
| < 768 | Optional bottom tab bar as in MB (Home, Sessions, Evidence, Devices, More). The real phone UI is the native app (D17, D20) | Compact | 1 column |

Persist the rail state in `localStorage`. Add a keyboard toggle (proposal: `[`). Login has its own breakpoints (§5.8).

---

## 3. Screen specs

State names come from 01_explore Part C:
- SessionState: CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED
- LensState: READY, FAULT
- MicState: READY, NO SIGNAL, CLIP
- StorageState: READY, LOW, FULL
- TimeSource: GNSS, NTP, RTC
- SecurityState: READY, FAULT
- CoreLinkState: ONLINE, OFFLINE

Field names are camelCase **proposals** for `packages/shared` types.

### 3.1 Dashboard (D1)

```
+ top bar ------------------------------------------------------------------+
| side | [A SYSTEM READY ring  3] [B hero photo + tagline                9] |
| bar  |                          [C status strip, overlapping B       ~8] |
|      | [D ACTIVE SESSION     5] [E DEVICES & INPUTS                    7] |
|      | [F STORAGE & EVID. 4] [G SECURITY, TIME & NETWORK 5] [H SEALED  3] |
|      | [I RECENT EVENTS               6] [J QUICK ACTIONS              6] |
+------+-------------------------------------------------------------------+
```

| ID | Panel (region) | Contents and data fields | States | Kit mapping |
|---|---|---|---|---|
| A | **SYSTEM READY ring** (230–590, 78–398) | **Layers:** (1) an outer hairline ring with segment and tick marks; (2) two bright "bracket" arcs at about 9 and 3 o'clock with heavy bloom; (3) an inner solid gold ring. **Centre:** shield-check emblem (405–475, 140–215); "SYSTEM" (tracked, about 16 px); "READY" (display face, gold, about 34 px); "SECURE • HEALTHY • OPERATIONAL"; the caption "All core services are running and the system is ready for recording." The ring sits in a card whose edge curves into the hero. **Data:** `systemState`, flags `secure/healthy/operational`, `message` | As drawn: READY. **Proposed:** ATTENTION (amber), CRITICAL (red), UNKNOWN (grey), matching the AS shield set; RECORDING (red arcs, "RECORDING" and the timer in the centre) | **Custom composition**: SVG and Motion inside Card `variant="transparent"`; Lucide `shield-check`. Build it as one reusable `GlowRing` so the Login page (§5.8) can reuse it around the emblem |
| B | **Hero** (600–1672, 68–320) | A room photo fading from dark at the left. Overline "DIGITAL EVIDENCE RECORDING CONTROLLER" (gold, tracked, (725–1142, 118–130)). Two-line italic display title (728–1228, 140–210). Paragraph (728–1090, 222–262). Gold rule (728–860, 280–286). A vertical "RECORD / PRESERVE / PROTECT" stack at the right edge (1598–1662, 140–210), drawn like text etched on glass; build it as live text. **Data:** static copy (i18n keys) | Proposal: switch the copy to "Session in progress" while recording | Composition: `img` with Typography; Motion Primitives TextEffect (candidate). Login reuses the photo and copy |
| C | **Status strip** (680–1628, 318–392) | Six cells separated by dividers. Each has an icon in a gold-ringed circle, a label, a status dot and a value: 2 Cameras • Ready; 2 Microphones • Ready; Storage • 3.2 TB Free; GNSS / Time • Synchronized; Security • Secure; Network • Connected. **Data:** `cameras{count,state}`, `mics{count,state}`, `storage{freeBytes,state}`, `time{source,quality}`, `security{state}`, `network{state}` | Per cell: green, amber, red or grey, taken from the Part C enums | Card `variant="secondary"` with vertical Separators; each cell is a `Link` to its page (Devices, Storage, Network & Time, Security). Same content as the AS metric cards |
| D | **ACTIVE SESSION** (218–795, 405–628) | **Idle as drawn:** header icon and title; a camera icon in a gold ring (466–548, 440–522); "No active session"; the sub-copy "The system is ready to begin a new recording session when required."; a split primary button "Start New Session" with a separate chevron segment (275–508, 580–620); a secondary "Open Evidence Queue" (527–740, 580–620). **Data:** `session` is null or `{id, caseNumber, subjectType, subjectName, investigator, room, profile, state, startedAt, elapsedMs}` | IDLE (drawn). **Proposed, driven by SessionState:** CREATE/PRECHECK/ARMED ("Continue setup" with gate progress); RECORDING (the AS Session Card: REC thumbnail, timer, Case, Investigator, Subject, Start, and "Open Session Monitor"); STOPPING/FINALIZING (step list with progress); SEALED (summary with hash and "View evidence") | Card; EmptyState for idle; ButtonGroup of Button `variant="primary"` plus a Dropdown triggered by `isIconOnly` for the split button; Button `variant="outline"` for the queue; Magic UI Ripple (candidate) behind the icon |
| E | **DEVICES & INPUTS** (806–1660, 405–628) | Header plus the link "View All Devices →" (1518–1632, 422–436). Four tiles: **Camera 1** (812–1008, 452–615): dot, name, "READY", kebab, thumbnail, overlay chip "1080p - 25 fps". **Camera 2** (1016–1212, 452–615). **MIC 1** (1226–1422, 452–615): dot, "MIC 1", "READY", kebab, mic icon in a ring, a staircase bar meter (about 8 bars: 5 green, 1 yellow, 2 unlit), "-18 dBFS". **MIC 2** (1434–1650, 452–615): "-16 dBFS". **Data:** `camera{id,name,state,resolution,fps,previewSrc}`, `mic{id,name,role,state,levelDbfs,peakDbfs,clip}` | Camera: READY; FAULT ("NO SIGNAL" overlay, red dot); OFFLINE (grey, frozen frame); RECORDING (REC dot). Mic: READY; NO SIGNAL (flat grey meter); CLIP (red latch) | Card `variant="secondary"` per tile; Dropdown on a ghost `isIconOnly` Button (proposed: Details, Test signal, Restart, all simulated); `<video>`/`<img>`. **The meter is a custom composition** with `role="meter"` ARIA: HeroUI Meter is a single continuous bar and cannot draw the segmented staircase |
| F | **STORAGE & EVIDENCE** (218–683, 636–795) | Header plus "View Storage →". Ring "80%" (236–330, 690–785); "3.2 TB Free" / "of 4.0 TB"; a legend with dots and hairline row dividers: Used 804 GB, Free 3.2 TB, Sealed Evidence 7, Pending 1. **Data:** `totalBytes, usedBytes, freeBytes, sealedCount, pendingCount, state` | Proposed ring colour: gold (READY), amber (LOW), red (FULL); thresholds are gap G8. **The 80% label needs fixing (§9 #4)** | ProgressCircle, or Magic UI AnimatedCircularProgressBar (candidate); legend composition; Link |
| G | **SECURITY, TIME & NETWORK** (696–1250, 636–795) | Header with "● All systems secure" at the right. Four columns: **TPM / Secure Boot**: green shield-check, chip ACTIVE, "TPM 2.0 Verified", "Secure Boot Enabled". **GNSS / Time Sync**: green clock, chip SYNCHRONIZED, "26 May 2025 14:27", "UTC +01:00". **Network Status**: gold network icon, chip CONNECTED, "192.168.10.21", "Interview LAN". **Security Posture**: gold shield, chip SECURE, "All controls active", "No issues detected". **Data:** `tpm{state,version,secureBoot}`, `time{source,quality,lastSync,tzOffset,offsetMs}`, `network{state,ip,name}`, `posture{state,message}` | Chips can be success, warning or danger; the header shows the worst state | Card with Separators; Chip `color="success" variant="soft" size="sm"`; Tooltip for details. AS shows the same header as a standalone "section header" (§4 #17) |
| H | **SEALED EVIDENCE TODAY** (1262–1660, 636–795) | Header plus "View All →". A database icon in a circle; "7"; "Items sealed today"; a bar chart with about 14 gold bars and x ticks 00 04 08 12 16 20 (1400–1620, 700–785). **Data:** `sealedToday`, `hourly[{hour,count}]` | A new seal increments the count | Card; Magic UI NumberTicker (candidate); Recharts `BarChart` with gradient fill and no Y axis |
| I | **RECENT EVENTS** (218–940, 803–930) | Header plus "View All Events →". Five rows of dot, date, time, event and detail. **Data:** `event{id,ts,severity,kind,message,detail,actor}` | Severity dot: green, amber, red or grey. Row 3 ("Evidence sealed…") looks lighter or amber (low confidence). New rows get a highlight | HeroUI Table (compact, header hidden), or a list inside Card with ScrollShadow; Magic UI AnimatedList (candidate) for insertions |
| J | **QUICK ACTIONS** (952–1660, 803–930) | Four gold-bordered cards, each with an icon, title, subtitle and chevron: Run Diagnostics / Full system health check; Review Audit / View system audit logs; Export Evidence / Secure export & verify; Open Maintenance / System configuration & tools | Hover and pressed; disabled when RBAC denies (S20) | Pressable Card or Button `variant="outline"` with a custom layout. Routes: System & Maintenance (diagnostics), Security & Audit, Evidence (export wizard), System & Maintenance |

### 3.2 Session Monitor (SM)

```
| [K page header: icon + SESSION MONITOR + subtitle ........ [status banner] 12] |
| [L LIVE SESSION FEED            6] [M SESSION DETAILS 3] [N EVIDENCE INTEGRITY 3] |
|                                                          [O AUDIO MONITOR      3] |
| [P action bar: 6 equal buttons                                               12] |
| [Q SESSION TIMELINE      5] [R CAMERA & INPUT STATUS 4] [T LIVE AUDIT EVENTS   3] |
|                             [S STORAGE DURING SESSION 4]                          |
```

| ID | Panel (region) | Contents and data fields | States | Kit mapping |
|---|---|---|---|---|
| K | **Page header** (218–1660, 80–165) | A camera-on-tripod glyph (245–285, 95–140). "SESSION MONITOR" in italic display with a white-to-gold gradient. Subtitle "Live interview session supervision, recording control, and evidence integrity tracking." A status banner (1187–1642, 95–150): a large glowing green dot, "SESSION ACTIVE & SECURE" (green, tracked), "Recording in progress • All integrity checks passing" | ACTIVE & SECURE (drawn). **Proposed:** ATTENTION (amber, e.g. mic clip or time fallback), FAULT (red), NO SESSION (grey, with a "Start New Session" CTA), FINALIZING (gold progress) | Card `variant="transparent"`; banner as Alert `status="success"` with a custom layout, or Card plus an animated dot. **This header becomes the template for every derived page (§5)** |
| L | **LIVE SESSION FEED** (218–952, 178–548) | Video frame (233–940, 218–538) with four overlays. Top-left: "Camera 1 - Interview Room 1". Top-right: "● REC 00:18:42" (red dot, bold). Bottom-left: "1080p • 25 fps • H.264". Bottom-right: fullscreen icon (910–930, 513–530). **Data:** `activeCameraId, recState, elapsedMs, codec, resolution, fps` | REC (red pulse); PREVIEW (a "PREVIEW" chip replaces REC); NO SIGNAL overlay; reconnecting (spinner). **Proposed:** a camera switch (Camera 1 \| Camera 2), not in the mockup | Card; looped `<video>` (S5); Chip `color="danger"` for REC; ghost `isIconOnly` Button for fullscreen (Fullscreen API or a full-size Modal); ToggleButtonGroup for the camera switch |
| M | **SESSION DETAILS** (965–1305, 178–548) | Key-value rows with hairline dividers: Session ID SES-20250526-0017; Case Number CR-2025-0146; Investigator Det. A. Carter; Subject Type Witness Interview; Interview Room Interview Room 1; Start Time 26 May 2025 14:08:50; Duration **00:18:42** (gold); Recording Profile Standard (1080p / 25 fps) | Values update live (Duration) | Card with a description-list composition (Label, Description, Separator); mono for ID and times |
| N | **EVIDENCE INTEGRITY** (1317–1660, 178–378) | Four rows, each with a green check: Encryption Active — AES-256; Hash Chain Active — SHA-256; Secure Timestamp Synced — NTP (UTC+10:00); Storage Write Verified — Continuous | Per row: pass (green check), pending (spinner), warn (amber), fail (red x) | Card with a list (ListBox, read-only) and Lucide `circle-check`; Spinner |
| O | **AUDIO MONITOR** (1317–1660, 386–548) | Two halves: "● MIC 1 - Interviewer" and "● MIC 2 - Subject". Each has a mic icon in a ring, a staircase meter and a value (-18 / -16 dBFS) | READY, NO SIGNAL, CLIP; peak hold | Card with the same custom meter as E |
| P | **Action bar** (221–1657, 560–622) | Six buttons, each with an icon, title and subtitle: (1) "Pause Montioring" [sic] / Keep recording, highlighted gold (221–461); (2) Add Marker / Important event (472–690); (3) Session Note / Add investigator note (703–926); (4) Snapshot / Capture image (938–1158); (5) Open Evidence Queue / View recorded files (1170–1405); (6) End Session / Stop recording, destructive (1418–1657) | (1) toggles to "Resume Monitoring". All are disabled without a session. (6) needs confirmation | Toolbar holding: (1) ToggleButton; (2)–(5) Button `variant="outline"`; (6) Button `variant="danger-soft"`. Add Marker opens a Popover with a label field. Session Note opens a Drawer with TextArea. Snapshot shows a Toast. End Session opens an AlertDialog with a mandatory reason (S21), with optional hold-to-confirm |
| Q | **SESSION TIMELINE** (218–862, 635–920) | Header plus "View All Events →". A vertical line with seven nodes (time, title, detail): 14:08:50 Recording Started; 14:11:23 Investigator Note Added; 14:13:07 Audio Peak Detected (MIC 2 -3.1 dBFS, within threshold); 14:15:42 Camera Health Normal; 14:17:18 Evidence Auto-Save (Segment 1 saved, 2.4 GB); 14:18:05 Investigator Note Added; 14:18:42 System Check. Node styles: green filled (system OK), orange hollow ring (investigator note), orange filled (audio peak). **Data:** `timelineEvent{ts, kind: START\|NOTE\|AUDIO_PEAK\|HEALTH\|AUTOSAVE\|CHECK\|MARKER\|SNAPSHOT, title, detail, severity}` | New node; current node | **Custom composition** (HeroUI has no timeline) inside Card with ScrollShadow |
| R | **CAMERA & INPUT STATUS** (873–1305, 635–805) | Header plus "View All Inputs →". A 2×2 grid of mini tiles: Camera 1 and Camera 2 (thumbnail, READY, "1080p • 25 fps"); MIC 1 and MIC 2 (READY, -18 / -16 dBFS, horizontal mini meter) | As in E | Card with Card `variant="tertiary"` mini tiles, Chip, and a custom mini meter |
| S | **STORAGE DURING SESSION** (873–1305, 812–920) | Ring 80%; "3.2 TB Free of 4.0 TB"; Write Speed 120 MB/s; Session Size 2.4 GB; Est. Remaining 31h 26m | LOW or FULL escalation | ProgressCircle plus key-values |
| T | **LIVE AUDIT EVENTS** (1317–1660, 635–920) | Header plus "View All →". Twelve rows of time and message, from 14:27:10 "Video frame hash recorded" down to 14:08:50 "Recording session started". Dots are mostly green; some are amber, e.g. 14:22:11 "Investigator note added" (which rows are amber is medium confidence) | Streaming insertion | List inside Card with ScrollShadow; Magic UI AnimatedList (candidate); Link to Security & Audit |

---

## 4. AssetSample component catalogue (AS, plus components shown only in DS)

### 4.1 Components in AS

| # | Component | Variants and states seen | AS region | Build mapping | Notes |
|---|---|---|---|---|---|
| 1 | Top bar | As D1 | (0–1536, 0–65) | §2.1 | — |
| 2 | Navigation menu (sidebar) | 8 items; Dashboard active as an inset rounded card; separators between items | (18–230, 80–545) | §2.2 | The active style differs from D1 (§9 #21) |
| 3 | SYSTEM READY ring | READY | (255–548, 100–348) | Custom composition | Reused on Login |
| 4 | Status LED dots | Online (green), Warning (amber), Error (red), Offline (grey). Each is a filled dot inside a dark ring with a halo | (560–810, 112–175) | `StatusDot` composition; Motion pulse | Shared token map (S8) |
| 5 | Shield states | Secure (green shield with check), Attention (amber shield with inner mark), Critical (red shield with inner mark), Unknown (grey shield, drawn with a check) | (560–820, 205–272) | Lucide `shield-check`, `shield-alert`, `shield-x`, `shield-question`, gradient-filled | Use `shield-question` for Unknown: a grey check reads as "OK" |
| 6 | State pills | Ready (green dot), Recording (red dot, red tint), Paused (amber dot), Stop (grey dot) | (540–836, 308–342) | Chip (`success` / `danger` / `warning` / `default`, `variant="soft"`, dot as start content) | PAUSED is not a SessionState (§9 #26) |
| 7 | Metric cards / info boxes | Six cards, each with an icon on top, a label, a dot and a value: 2 Cameras Ready; 2 Microphones Ready; Storage 3.2 TB Free; GNSS / Time Synchronized; Security Secure; Network Connected | (853–1518, 105–217) | Card `variant="secondary"` plus a dot label; pressable | Same data as D1 C. Reused as the Login device strip (§5.8) |
| 8 | Quick stat cards | (a) Ring 80% with "3.2 TB Free of 4.0 TB" (853–1000, 262–405). (b) Database icon, "7", "Items sealed today" and a bar chart (1015–1163, 262–405) | (853–1165, 238–405) | ProgressCircle; NumberTicker (candidate) with a Recharts BarChart | — |
| 9 | Buttons | Start New Session: primary, play icon (1190–1358, 267–311). Stop Recording: red-tinted with a red square icon (1370–1518, 267–311). Open Evidence Queue: outline with folder icon (1190–1335, 333–373). View All ›: ghost/outline (1347–1428, 333–373). ‹ and › icon-only (1441–1518, 333–373) | (1190–1518, 240–375) | Button `primary`, `danger-soft`, `outline`, `ghost`, `isIconOnly`; Pagination for ‹ › in lists | Primary text colour: §9 #20 |
| 10 | Camera / device thumbnail | Camera 1 and Camera 2, both READY: dot, name, READY label, kebab, image, resolution chip | (255–632, 438–577) | Card, Dropdown, Chip | — |
| 11 | Audio input card | MIC 1 at -18 dBFS and MIC 2 at -16 dBFS: dot, name, READY, kebab, mic icon, meter | (648–1000, 438–577) | Card with a custom meter | — |
| 12 | Progress & storage | Ring 65%; "Recording Storage / 65% used / 2.6 TB / 4.0 TB"; a linear bar at about 65% | (1018–1285, 438–570) | ProgressCircle and ProgressBar | This one is internally consistent, unlike the 80% card |
| 13 | Small chart | Gold bar chart, x ticks 00–20 | (1297–1518, 438–570) | Recharts BarChart | — |
| 14 | Session card | Header "ACTIVE SESSION" with a user icon. A thumbnail with "● REC" and "00: :12:36" [sic]. Case Number LP/2025/0526-0007; Investigator AKP Andi Pratama; Subject Tersangka; Start Time 26 May 2025 14:14:12 | (18–533, 608–745) | Card, Chip `danger`, key-values | This is the RECORDING state of D1 panel D |
| 15 | Event list / activity log | Five rows: dot, date, time, event, actor (System, System, Investigator, Investigator, System). Dots: green, green, amber, amber, green | (552–1082, 612–745) | Table (compact) | Adds an "actor" column that D1 does not have |
| 16 | Device status tile | A 2×2 grid: Camera 1 Ready; Microphone 1 Ready; PoE Switch Connected; Storage Healthy | (1100–1518, 612–745) | Card `variant="tertiary"` with an icon and a dot label | "Healthy" is a fourth status word (§9 #28) |
| 17 | Section header / panel | Gear icon, "SECURITY, TIME & NETWORK", "● All systems secure", chevron › | (18–612, 783–850) | A Card header acting as a `Link`, or a Disclosure / Accordion trigger | The chevron implies navigation or expand; the mockups do not say which |
| 18 | Quick actions | Four cards, as D1 J | (637–1518, 783–850) | As D1 J | — |
| 19 | Badges & tags | NEW (blue, solid), URGENT (red, solid), SEALED (purple, solid), IN REVIEW (amber, outline), EXPORTED (green, outline), ARCHIVED (grey, outline). Radius about 4; uppercase; about 11 px | (18–485, 893–924) | Chip `size="sm"` with a solid and an outline variant (check which HeroUI variant renders outlined; a `className` override is acceptable); colour extension for blue and purple | Pattern observed: solid = attention flags (NEW, URGENT) and SEALED; outline = lifecycle states. The same badge shape serves the API method pills (§5.9) |
| 20 | Form elements | Case Type (Select, "Select Case Type"); Investigator (Select, "Select Investigator"); Date (DatePicker, "26 May 2025", calendar icon); Search (SearchField, "Search session, case, or subject..."). Small grey labels above each field | (527–1518, 890–940) | Select, DatePicker, SearchField, Label | This is the Evidence filter bar (§5.1) |
| 21 | Icon library (common) | 15 icon tiles, about 44 px square, radius about 6: house (**filled gold**), monitor, file-text, camera, database, network, shield, settings, folder, upload/share, clock, chart-column, user, sliders-horizontal, info | (18–825, 965–1015) | Lucide (§7) | The filled first tile suggests an "active" icon state |
| 22 | Alert / notification | Success: "Operation completed / Evidence sealed successfully." (filled check-circle). Warning: "Storage almost full / Only 10% storage remaining." (triangle). Error: "Device disconnected / Camera 2 is offline." (filled x-circle). Each has a close × | (845–1518, 968–1015) | Toast for transient messages; Alert `status="success" / "warning" / "danger"` inline; CloseButton | The Info variant comes from DS §10 and needs the custom `--info`. Login errors and lockout use these alerts |

### 4.2 Components shown only in DS

| DS section (region) | Component and states | Build mapping |
|---|---|---|
| 04 Buttons (597–1123, 262–515) | Primary, Secondary, Ghost and Destructive, each with a leading icon and a trailing chevron. Icon buttons (camera, mic, gear). Disabled. Loading (spinner with "Loading... / Please wait") | Button `primary` / `secondary` or `outline` / `ghost` / `danger-soft`; `isIconOnly`; `isDisabled`; Spinner inside a Button for loading (the Login Sign In pending state) |
| 05 Form elements (1135–1660, 262–515) | Text Input with mail icon ("Enter text..."). Dropdown ("Select option"). Search Field ("Search devices..."). Date Field ("26 May 2025"). Toggle Switch ("Enabled", gold track). Checkbox ("Selected", orange fill). Radio (Option 1 selected, Option 2 not) | InputGroup/TextField (the pattern for the Login username and password fields), Select, SearchField, DatePicker, Switch, Checkbox, RadioGroup/Radio |
| 06 Status badges & chips (12–570, 527–658) | Ready, Recording, Offline, Sealed (purple), Secure (shield); Connected (wifi), Warning, Info, Under Review, Archived. Full radius; leading dot or icon; tinted fill with a semantic border | Chip with a start icon; colour extension for Info and Sealed |
| 07 Cards & panels (583–1660, 527–658) | Storage-used ring card; Status Card ("SYSTEM STATUS", shield, "Secure", "All systems operational"); Device Card; Audio Level Card; Storage Card (EVIDENCE STORAGE, 3.2 TB Free of 4.0 TB, bar at 80%) | Card with ProgressCircle / ProgressBar; the custom meter |
| 08 Navigation (12–720, 670–838) | Sidebar snippet (5 items). Top-bar snippet (hamburger, emblem, wordmark, bell, user "Investigator" with a chevron). Breadcrumbs "Home > Evidence > Session 1234" (last item gold). Tabs: Overview (active, gold-bordered box), Devices, Evidence, Audit Log, Settings | Breadcrumbs, Tabs (restyle the selected tab as a bordered box), Dropdown |
| 09 Icon library (732–1243, 670–838) | Twelve labelled icons: Security, Storage, Camera, Microphone, Session, Evidence, Audit, Network, Maintenance, Export, User, Time | Lucide (§7) |
| 10 Feedback / alerts (1255–1660, 670–838) | Success ("Operation completed successfully / Evidence sealed and stored."), Error ("Recording failed / Check device connection and try again."), Warning ("Device connection unstable / Camera 2 is experiencing high latency."), Info ("System update available / Version 2.4.1 is ready to install.") | Alert and Toast; Info needs `--info` |
| 12 Data visualization (942–1660, 850–935) | Donut 80% with legend (Used 804 GB, Free 3.2 TB, Sealed Evidence 7, Pending 1). Bar chart (x 00–20). Signal meter (-16 dBFS) | ProgressCircle or Recharts `PieChart`; Recharts `BarChart`; custom meter |

---

## 5. Derived pages (no web mockup exists; D18, D25, D26)

### 5.0 Common template and cross-reference

Every shell page reuses the SM page header (K): icon, italic display title, subtitle, and a right-side status banner. Below it sits a 12-column grid of L2 panels, built from the DS and AS components. This keeps all shell pages visually one product. Login is the exception: it is a full-viewport page outside the shell (§5.8).

| Page | 01_explore reference | Mobile or design content reference |
|---|---|---|
| Evidence | C8 Evidence Store, C9 Export Wizard | MB 5 (1228–1497, 8–545), MB 6 (44–312, 580–1003) |
| Devices & Inputs | C2 Rear Panel & Connectivity (port map), plus the device part of C4 | MB 7 (338–608, 580–1003) |
| Storage | C6 Storage & Retention | MB 8 (632–905, 580–1003) |
| Network & Time | C7 Time Sources, C15 Network Policy | MB 9 (932–1200, 580–1003) |
| Security & Audit | C10 Audit Log, C11 Security & Keys | MB 10 "Security & Privacy" entry; SM N and T |
| System & Maintenance | C3 Services Board, C5 Health & Diagnostics, C13 Secure Update, C14 Device Identity / SBOM, C12 Power-Fail Simulation, C17 Demo Control Panel, C1 Appliance twin (optional) | MB 10 (1228–1497, 580–1003) |
| **Login** (D25) | T1 Login & Device Pairing (L731); §20.1 rate limiting and pairing (L551–L558) | MB 1 (42–308, 8–545); D1 hero B and ring A |
| **API Reference** (D26) | §21.2 nine endpoints (L348–L368); gap G6 | `masterplan/01_specs.md` L170, L419–L435, L437–L468 (mock-core health and WS) |

### 5.1 Evidence (list and detail)

```
[Header: EVIDENCE | "Recorded, sealed and exported interview evidence" | banner "7 sealed today • 1 pending"]
[KPI cards: Total | Sealed | Recorded (unsealed) | Exported | Pending                                     12]
[Toolbar: SearchField | ToggleButtonGroup All/Recorded/Sealed/Exported/Under Review/Archived
          | Select Case Type | Select Investigator | DateRangePicker                                     12]
[Evidence table                                              8] [Detail preview (sticky)               4]
```

**Table**

- **Built with:** TanStack Table v8 rendered through HeroUI Table (SD-31), with Pagination and a Checkbox column for bulk export.
- **Columns** (from the MB 5 list items and the AS form elements):

| Column | Content |
|---|---|
| Thumbnail | Poster frame |
| Evidence ID | Mono, e.g. EV-2025-0526-0007 |
| Recorded | Date and time |
| Subject | Name plus subject-type chip (Tersangka red, Saksi blue, Lainnya neutral) |
| Case Number | — |
| Investigator | — |
| Duration | Mono |
| Size | — |
| Status | Chip: Recorded (green), Sealed (violet or gold per Q4), Exported (blue), Under Review (amber), Archived (grey) |
| Actions | Kebab Dropdown: View, Verify, Export, Archive |

**Detail** (route `/evidence/$id`, also used as the right preview; modelled on MB 6)

- **Header block:**
  - hero still with a "Sealed" chip
  - Evidence ID and the time range "26 May 2025 14:12:07 – 15:36:39"
  - key-values: Case Number, Subject with chip, Investigator, Location, Duration, File Size, Status
- **Tabs** (as MB 6 (60–297, 880–900)):
  - **Media:**
    - a track list VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02 (TrackId, Part C) with thumbnails or waveforms and durations
    - a player in a Modal, with the session markers on the scrub bar
  - **Metadata:**
    - manifest fields (§11.3)
    - session notes and markers
    - a JSON viewer (still gap S19)
  - **Hash & Integrity:**
    - per-track SHA-256 in mono with a copy button, plus the manifest signature
    - "Verify", which ends in a PASS or FAIL chip
    - a lifecycle stepper for EvidenceLifecycleStage §19.1 (CAPTURE → … → SEALED LOCAL EVIDENCE → AUTHORIZED REVIEW → AUTHORIZED EXPORT…)
    - the chain-of-custody log
- **Actions:**
  - Play (primary)
  - Export (outline): opens the Export Wizard (C9) in a Modal, with a mandatory reason (S21) and an RBAC denial path (S20)
  - More (Dropdown: Archive, Copy ID, Download manifest)

**States:**
- Skeleton while loading
- EmptyState "No evidence matches these filters"
- Spinner while verifying, then a PASS or FAIL chip
- An Alert `danger` when export is denied

### 5.2 Devices & Inputs

```
[Header: DEVICES & INPUTS | banner "All devices ready 6/6"]
[Camera Devices: Camera 1 live tile | Camera 2 live tile                 8] [Summary metric cards        4]
[Audio Inputs: MIC 1 - Interviewer (Ch 1) | MIC 2 - Subject (Ch 2)       8] [Other Devices list          4]
   (large meters, peak hold, clip latch, read-only gain per G13)              PoE Switch 4/4 ports; Recording
                                                                             Indicator Active; Tablet Control
                                                                             Connected (from MB 7)
[Port map (C2): PoE CAM 1 | PoE CAM 2/AUX | MGMT LAN | MIC IN 1/2 | GNSS SMA | Relay I/O, each with a link LED  12]
```

- **Clicking a device** opens a right-side Drawer with Tabs: Overview, Health (Recharts line of signal or link quality), Log.
- **Kebab Dropdown:** Test signal, Identify (blink), Restart. All are simulated.
- **States:**
  - per LensState and MicState
  - tablet ONLINE or OFFLINE (CoreLinkState). When the tablet is offline, show an Alert saying recording continues on the Core (S9).

### 5.3 Storage

```
[Header: STORAGE | banner READY / LOW / FULL]
[Capacity ring (large) + legend Used/Free/Sealed/Pending  5] [KPI cards: Write speed | Session size | Est. remaining | Retention days  7]
[Usage over 24 h (Recharts AreaChart)                     7] [Sealed per hour (BarChart, the D1 H chart enlarged)                     5]
[Volumes (C6): NVMe (recording), HDD (archive), each with a ProgressBar  6] [Recent Storage Activity list (MB 8)                    6]
[Retention calculator (S15): NumberField bitrate and hours/day -> GB/h and hours remaining, Meter                               12]
["Manage Storage" button (MB 8) -> Drawer: retention policy Select, auto-archive Switch, cleanup (sealed evidence is protected)]
```

The ring label must follow the resolution of §9 #4. Est. Remaining must be computed from the bitrate (§9 #17).

### 5.4 Network & Time

```
[Header: NETWORK & TIME | banner "Synchronized • Connected"]
[System Time hero: large clock, date, "UTC+07:00", Synchronized chip  5] [Time-source hierarchy (S22): GNSS -> NTP -> RTC, active tier
                                                                           highlighted; lock state, stratum, last sync, offset (+12 ms,
                                                                           from the D1 event), server 192.168.10.1                       7]
[Network Status: LAN Connected (192.168.10.21, Interview LAN); PoE Network Active;
 Bandwidth sparkline 12.4 Mbps / 3.1 Mbps (MB 9)                   6] [Network domains (C15): Camera, Management, Service/Update,
                                                                        Export/Transfer segmentation diagram                          6]
[Time-offset history (Recharts LineChart)                          6] [Network and time event log                                    6]
```

### 5.5 Security & Audit

```
[Header: SECURITY & AUDIT | banner shield state]
[Posture: large shield (Secure/Attention/Critical/Unknown, AS #5) + summary  4] [Controls checklist: TPM 2.0 Verified, Secure Boot Enabled,
                                                                                 Encryption AES-256, Hash chain SHA-256, Secure timestamp,
                                                                                 Storage write verified (D1 G + SM N)                       8]
[Audit log: TanStack Table (time, event, actor, category chip, hash-chain link status); SearchField, Select category,
 DateRangePicker; a "Live" Switch streams new rows (SM T style)                                                                  12]
[Hash-chain strip: the last N blocks as linked chips; discontinuity Alert (EVT-30)  8] [Keys & certificates (C11): device cert,
                                                                                          key references, expiry                    4]
```

- "Export audit" is RBAC-gated: disabled, with a Tooltip naming the required role (S20; role names are gap G1).
- Sign-in events from the Login page (success, failure, lockout) appear here as AuthenticationEvent rows (§21.3).

### 5.6 System & Maintenance

```
[Header: SYSTEM & MAINTENANCE | banner "All core services running"]
[Quick actions (D1 J reused): Run Diagnostics | Review Audit | Export Evidence | Software Update                                  12]
[Services board (C3): 16 Core services as rows with status Chips      8] [Health (C5): CPU, zone temperatures, fan RPM mini charts   4]
[Software update (C13): installed v2.4.1, slot A/B, update stepper    6] [About / identity (C14): DEMS-IR-01, version, SBOM, build  6]
[Settings (MB 10): App Preferences, Notifications, Security & Privacy, Device Settings, Storage Management, Network & Time
 as chevron rows; the forms use Switch / Checkbox / RadioGroup / Select from DS 05                                                12]
[Demo Control Panel (C17, demo-only, behind a Switch): inject camera loss, MIC clip, storage full, GNSS loss, tamper, power fail  12]
```

- Run Diagnostics opens a Modal with one ProgressBar per check and a summary Alert at the end.
- If Q12 chooses option B, the API Reference becomes a tab here. §5.9 recommends option A.

### 5.7 Start New Session: 3-step flow for the web

**Entry points:**
- the D1 split button, with a proposed chevron menu: "Start with last profile", "Start from template…"
- the AS "Start New Session" button
- the SM "no session" state

**Container:** a large Modal or a route `/session/new`. The header is a **custom stepper**, modelled on MB 3 (650–885, 85–130): ① Session Info → ② Devices Check → ③ Ready. HeroUI has no stepper (F5); compose it from Chip, Separator and Motion.

**Step 1: Session Info.** Fields are from MB 3 (650–885, 150–470). Validation uses RHF and zod (S10).

| Field | Control | Notes |
|---|---|---|
| Case Number | TextField, plus an icon button for scanning | Format validation, e.g. `LP/…` |
| Subject Type | ToggleButtonGroup, segmented: Tersangka / Saksi / Lainnya | EN equivalents Suspect / Witness / Other per the language decision (Q3). Colours red / blue / neutral |
| Subject Name | TextField | — |
| Investigator | ComboBox / Autocomplete with a search icon | Defaults to the logged-in user |
| Room / Location | Select | Defaults from the Device ID room |
| Recording Profile | Select, "Standard (1080p / 25 fps)" | Proposal, taken from SM M |
| Notes (Optional) | TextArea | — |

"Next" (primary) stays disabled until the form is valid.

**Step 2: Devices Check.** This is the pre-recording gate (§5.3 of the book).
- Eight checks resolve one by one to a PASS, WARN or BLOCK Chip: Core link, Camera 1, Camera 2, MIC 1, MIC 2, Storage, Time, Security.
- Beside the list: two live preview tiles and the dual meters, with a "speak to test" hint.
- A WARN needs an acknowledgement Checkbox. A BLOCK disables Next and shows an Alert `danger` with the reason.

**Step 3: Ready.**
- A summary card: case, subject with chip, investigator, room, profile, and "all devices ready".
- A mini SYSTEM READY ring.
- A large "Start Recording" primary button, with an optional 3-2-1 countdown.
- Starting moves the state machine ARMED → RECORDING and navigates to Session Monitor.

**Other states:**
- Cancelling after data entry opens an AlertDialog.
- Field errors use FieldError.
- Creating the session shows a Spinner.

### 5.8 Login (web; D25)

**What the sources give.**
- **MB 1** (42–308, 8–545):
  - a dimmed full-bleed photo (uniformed officer, "POLRI" visible, top right)
  - the shield-and-fingerprint emblem (143–207, 100–185)
  - "DEMS EDGE CLIENT" and "Digital Evidence Recording Controller" (90–260, 188–248)
  - Username field with user icon (66–286, 270–302)
  - Password field with lock icon and eye toggle (66–286, 313–345)
  - gold "Sign In" with **dark** text (66–286, 365–400)
  - fingerprint icon in a ring with "Use biometric login" (135–220, 415–470)
  - "v2.4.1" (160–190, 520–530)
- **D1:**
  - the hero language: overline, italic tagline "TRUSTED RECORDING FOR A SAFER TOMORROW", paragraph, gold rule, "RECORD / PRESERVE / PROTECT" (B (600–1672, 68–320))
  - the glow ring (A (230–590, 78–398))
- **01_explore:**
  - T1 "Login & Device Pairing … lockout after repeated failures" (L731)
  - §20.1: "certificate-bound pairing for Tablet-to-Core control is preferred", "Rate limiting / brute-force protection for authentication endpoints", "no credentials in logs" (L551–L558)
- **D25:** simulated auth with synthetic demo operators.

**Why it matters.** Login is the first screen in a demo. It sets the luxury tone, and its success transition is the entry into the shell. The mobile screen gives content only. It has no error, lockout, offline or role states, and no desktop layout.

**Desktop layout (≥ 1280).** Full viewport with no shell. A 12-column split: brand side 7 columns (about 58%), auth side 5 columns (about 42%).

```
+--------------------------------------------------------------+--------------------------------+
| BRAND SIDE (7/12)                                             | AUTH SIDE (5/12)               |
|  interview-room still (same as D1 hero), graded,              |                                |
|  fading into the canvas toward the auth side                  |  [Auth card: L2 panel, w 440]  |
|                                                               |   Sign in            (H1)      |
|     [GlowRing (SYSTEM READY layers) around the emblem,        |   Authorised operators only    |
|      emblem ~160-180 px, ring ~320-360 px]                    |   [Username  (user icon)    ]  |
|                                                               |   [Password  (lock) (eye)   ]  |
|  DIGITAL EVIDENCE RECORDING CONTROLLER   (overline, tracked)  |   [      Sign In (gold)     ]  |
|  DEMS EDGE CLIENT                        (wordmark)           |   ---------- or ----------     |
|  TRUSTED RECORDING                                  RECORD    |   [ Use security key (sim.) ]  |
|  FOR A SAFER TOMORROW  (italic display)             PRESERVE  |   > Demo operators (Disclosure)|
|  ----- (gold rule)                                  PROTECT   |   -------------------------    |
|                                                               |   Console: DEMS-IR-01 •        |
|  [device strip: DEMS-IR-01 • Interview Room 1 • 14:27:32 •    |   paired (simulated)  (shield) |
|   GNSS Synchronized • Core ONLINE • SECURE]                   |                                |
|                                                               |  v2.4.1 • SECURE RECORDING •   |
|                                                               |  TRUSTED EVIDENCE • SAFER ...  |
+---------------------------------------------------------------+--------------------------------+
```

**Brand side**
- **Contents:**
  - the room still from D1 B, graded as in §7
  - the reusable `GlowRing` (§3.1 A) with the SVG emblem at its centre in place of the check-shield
  - the overline, wordmark, italic tagline and gold rule, all as live text
  - the vertical "RECORD / PRESERVE / PROTECT" at the right edge of the brand side
  - a device strip at the bottom: the §4.1 #7 metric-card pattern in a compact single row. It shows device, room, live clock, time sync, Core link and security, fed by the simulator and the mock-core heartbeat.
- **Why the device strip:** operators see that the appliance is healthy before they authenticate. It also carries the "trusted recording" message.

**Auth card: fields and controls**

| Element | Control | Notes |
|---|---|---|
| Title | "Sign in" (H1 Inter Bold 24/32) with caption "Authorised operators only" | — |
| Username | TextField / InputGroup with Lucide `user` start icon | `autocomplete="username"`. Required |
| Password | TextField / InputGroup with `lock` start icon and an `eye` / `eye-off` toggle (ghost `isIconOnly` Button) | `autocomplete="current-password"`. Required. A caps-lock hint (small warning text) is proposed |
| Sign In | Button `variant="primary"`, `fullWidth`, gold with **dark text** (Q5) | Spinner inside while pending |
| Alternative sign-in | Button `variant="outline"`, `fingerprint` icon: "Use security key" (WebAuthn-style, **simulated**), or hide it (Q15) | MB 1 "Use biometric login" has no direct desktop equivalent |
| Demo operators | Disclosure, collapsed by default, listing 2–3 synthetic operators, each with a role Chip. Clicking one fills the form | D25 synthetic operators. Role names are a demo assumption (book gap G1). Proposed examples: Investigator, Supervisor, Technician. Hide in "presentation mode" |
| Console trust line | `shield-check` icon + "Console: DEMS-IR-01 • paired (simulated)" + Tooltip citing §20.1 certificate-bound pairing | Tells the user which appliance they are signing into. It fits because §20.1 prefers certificate-bound pairing |
| Footer | Version (from `package.json`) and the tracked brand triplet from the sidebar footer | — |

**States**

| State | Trigger | Visual | Kit |
|---|---|---|---|
| Idle | Page load | As the wireframe; focus on Username | — |
| Validating | Blur or submit with empty or invalid fields | Inline FieldError under each field; red 1 px border | FieldError |
| Submitting | Valid submit | Button pending with Spinner; fields disabled; emblem fingerprint arcs pulse | Button, Spinner |
| Error (bad credentials) | Simulator rejects | Alert `danger`: "Invalid username or password." The message is generic so it does not reveal whether the user exists. Optional "2 attempts remaining" caption | Alert |
| Locked out / rate-limited (§20.1) | N failed attempts within a window (N and window are demo policy, e.g. 5 in 5 min) | Alert `warning` with `lock` icon: "Too many attempts. Try again in 04:59"; a live countdown; the form is disabled; the ring turns amber | Alert, Motion SlidingNumber |
| Core offline | Heartbeat lost (CoreLinkState OFFLINE) | Alert `danger`: "Core service unreachable at 127.0.0.1:4400", with Retry; Sign In is disabled; the device-strip dot turns red | Alert, Button |
| Signed out / session expired | Arriving from sign-out or timeout | Alert `accent` or info: "You have been signed out." | Alert |
| Success | Simulator accepts | The ring check draws and the ring flashes green, then gold; the hand-off transition runs (§8) and lands on the redirect target or Dashboard | Motion |

**Routing and security notes**
- **Routes:**
  - `/login` sits outside the shell layout route.
  - A TanStack Router guard redirects unauthenticated users to `/login?redirect=…`.
  - Sign-out (top-bar user Dropdown, §2.1) returns to `/login`.
- **Security:**
  - never put credentials in the URL, logs or analytics (§20.1 "no credentials in logs")
  - the lockout countdown is authoritative in the simulator, not the component
  - every attempt is emitted as an AuthenticationEvent audit row (§21.3), visible in Security & Audit

**Responsive behaviour**

| Width | Layout |
|---|---|
| 1024–1279 | 6/6 split; ring about 260 px; the tagline shrinks via `clamp()` |
| 768–1023 | Stacked: a brand band about 280 px tall (ring, wordmark, one-line tagline) above the auth card |
| < 768 | Mirrors MB 1: full-bleed backdrop with the card over it |

**Kit summary:**
- **HeroUI:** Card, Form, TextField, InputGroup, Button, Spinner, Alert, FieldError, Disclosure, Chip, Tooltip, Separator, Link
- **Compositions:** GlowRing (reused) and the SVG emblem
- **Magic UI (candidates):** BorderBeam; optional Particles for very subtle gold dust

### 5.9 API Reference / Swagger (web; D26)

**What the sources give**

| Source | Content |
|---|---|
| 01_explore §21.2 (L348–L361) | Nine endpoints: `POST /api/v1/session`, `POST /api/v1/session/{id}/start`, `POST /api/v1/session/{id}/stop`, `GET /api/v1/session/current`, `GET /api/v1/device/health`, `GET /api/v1/audio/status`, `GET /api/v1/video/status`, `GET /api/v1/storage/status`, `POST /api/v1/evidence/{id}/export` ("RBAC + audit required") |
| 01_explore L364–L368 | The book does not define auth, pairing, metadata, evidence-list, audit-list or verify endpoints, the WS path and schema, or bodies. "OpenAPI" is the book's next gate |
| `masterplan/01_specs.md` L170, L422–L424 | mock-core serves `GET /api/v1/health` and WS `/ws` (1 Hz heartbeat) on `127.0.0.1:4400` |
| `masterplan/01_specs.md` L435 | `/api/v1/health` is service liveness and is distinct from `/api/v1/device/health` |
| `masterplan/01_specs.md` L441–L467 | Field lists of `HealthResponse` and `Heartbeat` |
| D26 | OpenAPI document authored in `packages/shared`; renderer Swagger UI or Scalar, themed (D6); "try it" hits mock-core where the endpoint exists, otherwise it is documented as simulated |

**Why it matters.** The page turns the demo's contract into something a reviewer can see. Its risk is visual: a stock renderer looks like a different product. The design work is therefore mostly **theming and framing**.

**Placement in the shell (decision Q12)**

| Option | Pros | Cons |
|---|---|---|
| **A (recommended):** its own sidebar item "API Reference" in a lower "DEVELOPER" group below System & Maintenance (§2.2). Lucide `braces` icon and a small "DEV" Chip | One click in a demo; D26 calls it a page; the renderer gets the full content width | A 9th nav item. It must look secondary: separator, micro label, muted icon at rest |
| B: a tab inside System & Maintenance | Keeps 8 items | Buried. The page's Tabs plus the renderer's own navigation make double navigation. Less width |

**Top bar:** unchanged; the full shell stays.

**Page header** (template K):
- title "API REFERENCE"
- subtitle "Core API v1 • OpenAPI • local mock-core 127.0.0.1:4400"
- a service banner driven by the existing HeartbeatProvider (specs L336):
  - "MOCK-CORE ONLINE • v0.1.0 • WS 1 Hz" (green)
  - "CONNECTING" (amber)
  - "OFFLINE — try-it disabled" (red)

**Layout (≥ 1440)**

```
[Page header: icon + API REFERENCE + subtitle ........................................ [service banner]]  12
[Server strip: base URL chip (mono) | spec version | Download openapi.json | Copy base URL |
 legend chips LIVE / SIMULATED / RBAC + AUDIT | Switch "Show simulated endpoints"]                           12
[OpenAPI renderer inside an L2 panel (tag nav + endpoint list + detail/try-it)                9] [Realtime  3]
                                                                                                  WS /ws panel
```

Below 1440 the Realtime panel moves under the renderer, full width.

**Endpoint inventory shown in the renderer**

| Tag | Method | Path | Source | Try-it | Badges |
|---|---|---|---|---|---|
| Service | GET | `/api/v1/health` | specs L170, L422 | **Live** against mock-core (CORS allowed, SPEC-C1) | LIVE |
| Session | POST | `/api/v1/session` | §21.2 | Simulated | SIMULATED |
| Session | POST | `/api/v1/session/{id}/start` | §21.2 | Simulated | SIMULATED |
| Session | POST | `/api/v1/session/{id}/stop` | §21.2 | Simulated | SIMULATED |
| Session | GET | `/api/v1/session/current` | §21.2 | Simulated | SIMULATED |
| Device | GET | `/api/v1/device/health` | §21.2 | Simulated | SIMULATED. Its description must say it differs from `/api/v1/health` (specs L435) |
| Device | GET | `/api/v1/audio/status` | §21.2 | Simulated | SIMULATED |
| Device | GET | `/api/v1/video/status` | §21.2 | Simulated | SIMULATED |
| Storage | GET | `/api/v1/storage/status` | §21.2 | Simulated | SIMULATED |
| Evidence | POST | `/api/v1/evidence/{id}/export` | §21.2 | Simulated | SIMULATED, RBAC + AUDIT (lock icon) |
| Realtime | WS | `/ws` | specs L423 | **Live**, in the custom side panel | LIVE. OpenAPI 3.x does not model WebSockets, so the renderer shows only a description entry |

- **Book gaps.** An info Alert at the top of the reference lists the endpoints the design book does not define (01_explore L364–L367), so reviewers do not assume they were forgotten.
- **Try-it for simulated endpoints** is decision Q13. Either disable it with a Tooltip ("Simulated in-browser (D19); no network call"), or route the request to the in-browser simulator and show its response marked SIMULATED.

**Design tokens the renderer must take**

| Token | Value | Applies to |
|---|---|---|
| Page canvas | `--background` `#0B0D0F` | Around the panel |
| Renderer background | `--surface` (warm, est. `#16110D`) | Renderer root, so it reads as an L2 panel |
| Inset | `--surface-secondary` (est. `#0F0C09`) | Request/response samples, schema boxes, code blocks |
| Text | `--foreground` (est. `#F5F0E8`); muted `--muted` `#9CA3AF` | All renderer text |
| Primary / accent | `#FFC86B` with `#0B0D0F` text | Send / Test Request button, selected endpoint, links, active tag |
| Border and radius | `--border` (bronze alpha, 1 px); radius 8 inset, 12 panel | Endpoint rows, cards, inputs |
| Focus | 2 px gold ring | Keyboard focus |
| UI font | Inter | Headings and body inside the renderer. Orbitron only in the page title, never inside the renderer |
| Code font | JetBrains Mono | Paths, JSON, schemas, curl snippets, header values |
| Method GET | Info Blue `#3B82F6` | Read-only calls |
| Method POST | Success Green `#22C55E` | Create and state-changing calls |
| Method PUT / PATCH | Warning Amber `#F59E0B` | Reserved (none in §21.2) |
| Method DELETE | Error Red `#EF4444` | Reserved (none in §21.2) |
| WS | Secondary Bronze `#FF9F3D` | `/ws` |
| HEAD / OPTIONS | Neutral Gray `#9CA3AF` | Reserved |
| Response status | 2xx green, 3xx blue, 4xx amber, 5xx red | Response code chips |
| JSON syntax | strings gold `#FFC86B`; numbers bronze `#FF9F3D`; booleans and null blue `#3B82F6`; keys warm white; punctuation muted | Samples and responses |
| Method pill shape | AS badge shape (#19): radius 4, uppercase, about 11 px, soft fill with 1 px border | Consistent with the design's badges |
| Scrollbars | Thin, bronze thumb on the inset colour | Long schemas |

**Why this method-colour choice.** Reference users expect conventional method colours: GET blue, POST green, and warm colours for mutating or destructive methods. That convention is what Swagger-style references use (hypothesis from knowledge; verify during spec revision). Taking the hex from the printed palette keeps the pills inside the design system. Gold stays reserved for the primary action, so a method pill is never confused with the Send button.

**Renderer-fit notes for the spec revision.** All of these are hypotheses to verify when the renderer is chosen.
- **Scalar API Reference:**
  - themed through CSS custom properties (a `--scalar-*` family) plus custom CSS
  - built-in dark mode and a multi-pane layout close to the panel grid, so less override work
  - verify that it can be configured **not** to load fonts from a CDN and **not** to send try-it requests through a hosted proxy. Both must be off: no external requests, and no data leaves the machine.
- **Swagger UI:**
  - themed by overriding its class-level CSS (per-method operation-block classes)
  - light by default, so a larger dark restyle is needed
  - its submit-methods configuration can limit "Try it out" to the live GET
- **Either renderer:**
  - self-hosted from npm with no CDN
  - hide its own top bar and branding
  - render inside our Card, not as a full page
  - the theme lives in one stylesheet generated from `tokens.ts` (SD-38)

**Realtime side panel (custom, kit components)**
- **Contents:**
  - connection Chip (ONLINE / CONNECTING / OFFLINE)
  - WS URL `ws://127.0.0.1:4400/ws` in mono, with a copy button
  - live fields from `Heartbeat` (specs L458–L467): `seq` (mono, ticking), `serverTime`, `uptimeMs` formatted, `clients`, `intervalMs`, `sessionState` (null in this phase)
  - the last 5 messages as pretty-printed JSON, newest on top
  - Connect / Disconnect toggle
- **Kit:** Card, Chip, Button, Tooltip, ScrollShadow, Switch; data from `useHeartbeat()` (specs L335).

**States**

| State | Visual |
|---|---|
| Spec loading | Skeleton |
| Spec invalid | Alert `danger` |
| mock-core offline | Red banner; the live try-it is disabled with a Tooltip ("mock-core unreachable at 127.0.0.1:4400"); the Realtime panel shows reconnect progress |
| Request pending | Spinner in Send |
| Response | Status chip, latency in ms, headers, body |
| Simulated endpoint | Per Q13 |
| RBAC-gated export | Lock badge; if try-it runs through the simulator, a denied response follows the current demo role (S20) |

---

## 6. Mobile reference (for the later phase, D20)

**Navigation (phone).**
- A bottom tab bar with Home, Sessions, Evidence, Devices and More. The active icon and label turn gold (MB 2 (350–595, 495–530)).
- "More" leads to Storage, Network & Time and Settings; MB 8 and MB 10 show More highlighted.
- There is no Session Monitor tab. A live session is reached from Home or Sessions.

**Tablet (D17).** Replace the tab bar with a left navigation rail that mirrors the web sidebar's 8 items. Add a persistent live-session mini-bar while recording (proposal).

| # | Screen (MB region) | Content | Tab | Tablet multi-pane expansion |
|---|---|---|---|---|
| 1 | Login (42–308, 8–545) | Dimmed photo of a uniformed officer with "POLRI" visible; emblem; wordmark; Username; Password with eye toggle; gold "Sign In" (**dark text**); fingerprint "Use biometric login"; "v2.4.1" | none | The web Login split from §5.8: brand side with ring on the left, card on the right. Keep the biometric option on devices that support it |
| 2 | Dashboard (338–606, 8–545) | Header (emblem, "DEMS EDGE CLIENT", bell, avatar "IR"). System Status card "Ready for Recording / All systems operational". Three tiles: Camera 1/1, Microphone 2/2, Storage 80%. Quick Actions: Start Session, View Evidence. Recent Sessions (3) with subject chips | Home | Two columns: status, quick actions and device tiles on the left; recent sessions on the right. Or mirror the web dashboard rows |
| 3 | Start Session (634–903, 8–545) | Stepper 1-2-3 (Session Info, Devices Check, Ready); the Session Information form (§5.7); "Next →" (gold, dark text) | none (modal flow) | Vertical stepper rail on the left, form on the right. Step 2 shows both previews side by side |
| 4 | Session Monitor, live (932–1200, 8–545) | "● Recording" and "00:24:18"; video (CAM 1 - Interview Room 1, 1080p • 25 fps); MIC 1 and MIC 2 meter cards (-18 / -16 dBFS); Snapshot, Bookmark, Audio Monitor, Settings; red "Stop Session" | none | Landscape: video on the left at about 60%; timer, meters, integrity and actions in the right column; Stop pinned bottom-right. Portrait: video on top, two columns below |
| 5 | Evidence List (1228–1497, 8–545) | Search; filter chips All / Recorded / Sealed / Exported; 5 items (thumbnail, ID, date/time, name, subject chip, duration, status chip, kebab) | Evidence | Master-detail: list at about 40%, detail (screen 6) at about 60% |
| 6 | Evidence Detail (44–312, 580–1003) | Hero with a gold "Sealed" chip; EV-2025-0526-0007 and its time range; key-values; Tabs Media / Metadata / Hash & Integrity; media thumbnails; Play, Export, More | (Evidence) | The detail pane of 5 |
| 7 | Devices & Inputs (338–608, 580–1003) | Camera Devices (Camera 1 only); Audio Inputs (MIC 1 - Investigator Ch 1; MIC 2 - Subject Ch 2); Other Devices (PoE Switch 4/4 Ports Active; Recording Indicator Active; Tablet Control Connected) | Devices | List on the left; device detail with live preview or meter on the right |
| 8 | Storage (632–905, 580–1003) | Ring 80% with "3.2 TB Free of 4.0 TB"; legend; Recent Storage Activity (5 rows); "Manage Storage" | More | Ring and legend on the left, activity on the right |
| 9 | Network & Time (932–1200, 580–1003) | Network Status (LAN Connected, PoE Active, Bandwidth 12.4 Mbps / 3.1 Mbps sparkline); Time Synchronization (GNSS / NTP Synchronized UTC +07:00, Last Sync, Time Source GPS (GNSS Stratum-1), Server 192.168.10.1); System Time (Mon, 26 May 2025 14:27:32, Synchronized) | not visible in the frame | Network and Time as two side-by-side cards |
| 10 | Settings (1228–1497, 580–1003) | Account (IR, Investigator, AKP Budi Santoso). Application: App Preferences, Notifications, Security & Privacy. System: Device Settings, Storage Management, Network & Time, System Maintenance, About DEMS | More | Master-detail: categories on the left, content on the right |

**Mobile-specific observations:**
- Primary buttons use dark text on gold.
- "Sealed" is gold with a lock.
- The status bar shows "9:41", the iOS marketing convention; the target is Android (D17).
- Kit mapping for later: HeroUI Native Card, Chip, Button, TextField, Tabs, Toast, BottomSheet, Select, Skeleton (03_analysis F3 / 02 L306). The meters use Skia or Reanimated (capability S3).

---

## 7. Asset list

| Asset | Where seen (region) | Can it be cropped? | Recommendation |
|---|---|---|---|
| **Logo emblem** (shield with fingerprint, gold) | DS header (30–100, 3–70); DS Brand, the largest desktop instance at about 85 px (115–200, 108–198); D1 (28–84, 8–64); SM (28–84, 8–64); MB 1 (143–207, 100–185); MB 2 (355–385, 42–75) | **No.** At most about 90 px, the glow is baked in, there is no alpha, and it sits on a textured background | **Recreate as SVG:** a double-stroke shield path with 5–6 concentric fingerprint arcs; vertical gold gradient (est. `#FFE2A6` → `#FFC86B` → `#C9802F`); glow via CSS `drop-shadow`. **The Login page shows it at about 160–180 px**, so the SVG needs clean arc detail at display size, and the arcs should be separate paths so the scan and draw animations (§8) can target them. Export 16, 32, 180 and 512 px for favicon and app icon. Lucide `shield` and `fingerprint` are an acceptable geometric first pass |
| **Wordmark** "DEMS EDGE CLIENT" | D1 (118–430, 14–42); DS (120–520, 8–40) | Not needed | Live text: Orbitron 800/900 with a white-to-gold gradient via `background-clip: text` |
| **Hero room photo** (Dashboard hero and **Login brand side**) | D1 (600–1672, 68–320), about 1072×252 | **No, except as a placeholder.** The overline, title, paragraph, rule and status strip are baked in, as is the etched "RECORD PRESERVE PROTECT". Only the strip right of the text, (1240–1672, 68–310) at about 430×240, is clean-ish | **Recreate:** a licensed stock or generated interview-room image with no people and no text. **It must serve two crops:** the wide Dashboard band (about 1400×340 at 1920) and the tall Login brand side (about 1120×1080 at 1920). Source at **≥ 2560×1440** with a centred subject and use `object-position` per page. Grade in CSS (brightness about .55, sepia about .35, saturate about .8, warm overlay) and add a fade to the canvas |
| **Live camera frame** | SM (235–940, 220–537), about 705×317; overlays in all 4 corners; wall text baked in at (843–905, 288–357) | Placeholder only: inner crop (300–830, 262–500), about 530×238 | Use two **looped synthetic clips** (S5), 1280×720, H.264 plus WebM, each with a poster frame. They serve the live feed, tiles and evidence media |
| **Camera thumbnails** | D1 Cam 1 (815–1005, 487–612); D1 Cam 2 (1020–1210, 487–612), overlay chip below y ≈ 588; SM mini (885–937, 675–727) and (1097–1135, 675–727); AS Cam 1 (262–437, 478–575); AS Cam 2 (455–630, 478–575); AS session thumbnail (35–235, 648–735), with REC overlay; DS Device Card (1000–1205, 580–650); MB 4 video (948–1185, 122–300) | Placeholder only: about 190×125, soft, overlays present | Generate stills from the looped clips |
| **Evidence thumbnails** | MB 5 list items (1245–1305, 145–475); MB 6 media strip (60–297, 905–955) | No: about 50×40 px | Generate from the clips |
| **Mobile login background** | MB 1 (50–300, 15–540) | **Do not crop or reuse.** It shows an identifiable uniformed officer with POLRI insignia; use needs authorisation | The web Login uses the room still instead (above). For mobile, use an abstract brand texture, or a licensed image cleared by the user |
| **Topographic texture** | D1 (0–200, 575–810), about 200×235; SM (0–200, 560–800) | Technically possible, but it would blur at 232 px and carries the baked background | **Recreate as SVG** contour paths, generated from noise or hand-drawn: 1 px bronze strokes at 15–40% alpha with a bottom-up radial glow. Optional slow drift. The same SVG can sit faintly behind the Login auth card |
| **Canvas and header light streaks** | DS (0–1672, 0–75); D1 and SM top bar | No | CSS radial and linear gradients (also used on Login) |
| **Mobile composite background** | MB, behind the phones | n/a | Presentation backdrop, not an app asset |
| **API renderer theme** (D26) | No mockup | n/a | **New asset: one stylesheet** that maps the §5.9 token table onto the chosen renderer (Scalar variables or Swagger UI class overrides), generated from or kept in sync with `tokens.ts`. Plus the method and status colour tokens (§1.7) and the JSON syntax palette |
| **OpenAPI document** (D26) | No mockup | n/a | Authored in `packages/shared` per D26. It is a content asset, not a visual one. Listed here because the page cannot render without it |
| **Icon set** | DS 09 (732–1243, 670–838); AS icon library (18–825, 965–1015); sidebar; panel headers | n/a | **Lucide** (lucide-react 1.49.0, SD-34) is the closest match; see below |
| **Fonts** | DS 03 | n/a | Orbitron, Inter and JetBrains Mono, self-hosted (OFL); pins to be collected. Both new pages use only these three |

**Icon-set match**

The mockup icons have these properties:
- outline glyphs with about 2 px stroke on a 24 px grid
- round caps and joins
- simple geometric forms

That matches **Lucide** (default `strokeWidth` 2). By visual judgement, Phosphor Regular is lighter (about 1.5 px at 24) and Phosphor Bold is heavier.

A few glyphs are drawn **filled**: the active house in AS #21 (18–60, 968–1012), the sidebar gear, and the status shields. For these, use Lucide with `fill="currentColor"` or an SVG gradient `fill`. Staying on Lucide keeps web and mobile parity (SD-19, SD-34). Verify every name below against lucide-react 1.49.0, because names have changed across versions (e.g. `home` became `house`).

| Use | Lucide candidate |
|---|---|
| Sidebar: Dashboard, Session Monitor, Evidence, Devices & Inputs, Storage, Network & Time, Security & Audit, System & Maintenance, **API Reference** | `house`, `monitor` (or `monitor-play`), `file-text`, `camera`, `database`, `network`, `shield-check`, `settings` (drawn filled), **`braces`** (alternatives: `file-code-2`, `book-open-text`) |
| Top bar: Device ID, user, menu chevron, SECURE, bell, hamburger, sign out | `monitor`, `circle-user`, `chevron-down`, `lock`, `bell`, `menu`, `log-out` |
| Status strip: cameras, mics, storage, time, security, network | `cctv` or `video`, `mic`, `database`, `clock`, `shield`, `network` |
| Panel headers, D1: Active Session, Devices & Inputs, Storage & Evidence, Security Time & Network, Sealed Today, Recent Events, Quick Actions | `users` or `presentation` (low confidence), `cpu` or `cable` (glyph unclear), `database`, `settings`, `layers`, `inbox`, `plus` |
| Panel headers, SM: page, Live Feed, Session Details, Evidence Integrity, Audio Monitor, Timeline, Camera & Input, Storage, Live Audit | `cctv` or `webcam` (the tripod glyph has no exact match), `cctv`, `bot` or `clipboard-list` (robot-like glyph, low confidence), `shield-check`, `volume-2`, `clock`, `video`, `database`, `shield` |
| Session actions: pause, marker, note, snapshot, evidence queue, end, fullscreen, kebab | `pause`, `map-pin`, `notebook-pen`, `camera`, `folder-open`, `square`, `maximize`, `ellipsis-vertical` |
| Quick actions: diagnostics, audit, export, maintenance | `stethoscope`, `file-text` or `clipboard-list`, `upload` or `share`, `settings` |
| Buttons and forms: play, trash, mail, search, calendar, view all | `play`, `trash-2`, `mail`, `search`, `calendar`, `arrow-right` |
| Alerts and chips: success, warning, error, info, close, connected, archived, sealed, under review | `circle-check`, `triangle-alert`, `circle-x`, `info`, `x`, `wifi`, `archive`, `lock` or `stamp`, `scan-eye` or `clock` |
| **Login** | `user`, `lock`, `eye` / `eye-off`, `fingerprint`, `key-round` (security key), `shield-check` (console trust), `log-in` |
| **API Reference** | `braces`, `download` (openapi.json), `copy` / `check`, `radio-tower` or `activity` (WS realtime), `lock` (RBAC badge), `send` (Send) |
| Mobile extras: case scan, bookmark, refresh, list | `scan-line`, `bookmark`, `refresh-cw`, `list` |
| AS library extras: folder, chart, user, sliders | `folder`, `chart-column`, `user`, `sliders-horizontal` |

---

## 8. Animation opportunities (input for the later motion spec; not a spec)

**What the mockups imply for motion:**
- The look is a "luxury control room".
- Ambient motion should be slow: glows that breathe over 3–6 s, rotations over tens of seconds.
- State feedback should be fast, about 150–250 ms.
- Data motion should be tied to real simulator ticks (D19).

**Constraints to carry into the spec:**
- Honour `prefers-reduced-motion`.
- Drive the meters through Motion values or CSS transforms, not React re-renders (S3).
- Library items named below are candidates (§0).

| Area | Element | Opportunity | Purpose | Candidate |
|---|---|---|---|---|
| Shell | App entry (without Login, e.g. a reload while signed in) | Emblem stroke-draw (shield, then fingerprint arcs); wordmark tracking settles; gold rule wipes; shell fades in; panels stagger | A luxury first impression | Motion `pathLength`; Motion Primitives TextEffect |
| Shell | Sidebar active indicator | The indicator slides between items with a glow trail; icon colour cross-fades; a light sweep on hover | Clear sense of location | Motion `layoutId`; Motion Primitives AnimatedBackground |
| Shell | Sidebar ↔ rail | Width spring; labels fade and slide; Tooltips appear in rail mode | Smooth responsiveness | Motion layout |
| Shell | Topographic texture | Very slow drift or contour shimmer on a 20–40 s loop | Ambient depth | Motion or CSS |
| Shell | Top-bar clock | The seconds digit rolls; the colon softly blinks | Liveness | Motion Primitives SlidingNumber / AnimatedNumber |
| Shell | SECURE pill | The dot breathes (about 2.5 s). On a state change: colour morph and one ring pulse. When degraded: a travelling amber or red border | Attention without noise | Magic UI BorderBeam |
| Shell | Bell (proposed) | Badge pops and the bell swings briefly on a new alert | Notification | Motion |
| Shell | Route change | Content fades and rises 8–12 px; panels stagger about 40 ms; the page title plays a text effect; the shell stays still | Continuity | Motion AnimatePresence with TanStack Router |
| **Login** | Page entry | The room still fades up from black with a slow Ken Burns start. The GlowRing layers sweep in one after another. The emblem draws its shield stroke, then the fingerprint arcs one by one like a scan, then blooms. The wordmark tracking settles, the tagline reveals line by line, and "RECORD / PRESERVE / PROTECT" fades in staggered. The auth card rises 12 px and fades in last, with one BorderBeam lap around it | The luxury first impression of the whole demo | Motion `pathLength`; Motion Primitives TextEffect; Magic UI BorderBeam |
| **Login** | Ambient | Slow ring rotation; bracket arcs breathe; optional very sparse gold particles on the brand side; device-strip clock ticks and status dots breathe | "The appliance is alive" | Motion; Magic UI Particles (optional); SlidingNumber |
| **Login** | Field interaction | Focus: the gold focus ring grows with a soft glow and the start icon brightens. Password reveal: the eye icon morphs. Hover on "Use security key": a scan line sweeps across the fingerprint icon | Tactile polish | Motion |
| **Login** | Submitting | Button shimmer; fingerprint arcs pulse in sequence like a verification scan | Feedback while waiting | Magic UI ShimmerButton (or a CSS shimmer); Motion |
| **Login** | Error | A small horizontal shake of the card (about 6 px, 300 ms, **no shake under reduced motion**); a red flash on the field borders; the attempts caption ticks | Clear failure | Motion |
| **Login** | Locked out | The lock-icon shackle closes; the ring morphs to amber; the countdown digits roll; when it reaches zero the form re-enables with a soft gold pulse | Explains the rate limit (§20.1) | Motion; SlidingNumber |
| **Login** | Core offline | Device-strip dot turns red with a slow pulse; the Alert slides in; Retry shows a Spinner | Honest state | Motion |
| **Login** | **Success hand-off into the shell** | The ring check draws and the ring flashes green, then gold. The card collapses and fades. The emblem flies as a **shared element** (`layoutId`) from the ring centre to the top-bar logo slot. The brand-side photo cross-fades into the Dashboard hero (same image, continuity). The top bar drops in from the top, the sidebar slides in from the left, and the Dashboard panels stagger in, with the SYSTEM READY ring sweep playing last | The signature "luxury" moment; ties Login to Dashboard | Motion `layoutId`, AnimatePresence |
| **Login** | Sign out | The reverse: panels fade out, the emblem flies back to the ring centre, and the card rises | Symmetry | Motion `layoutId` |
| Dashboard | SYSTEM READY ring | On mount the arcs sweep in one after another (dashoffset). The outer segmented ring rotates slowly (about 60 s per turn). The bracket arcs breathe. The check-mark draws. "READY" blurs in. A state change morphs the colour; RECORDING turns the arcs red with a pulse | The hero moment | Motion SVG |
| Dashboard | Hero photo and tagline | Slow Ken Burns zoom (1.00 → 1.06 over about 30 s, alternating); line-by-line reveal of the tagline; the gold rule grows; "RECORD / PRESERVE / PROTECT" fades in staggered | Luxury | Motion; Motion Primitives TextEffect |
| Dashboard | Status strip | Staggered entry. A value change ticks the number and pulses the dot once. Hover lifts the cell | Clarity of change | Magic UI NumberTicker |
| Dashboard | Active Session, idle | Ripple rings around the camera icon; a shimmer or shine on the primary button every few seconds | Invites the primary action | Magic UI Ripple, ShimmerButton / ShineBorder |
| Dashboard | Active Session, idle → recording | The panel morphs into the recording card with shared elements (icon → REC thumbnail) | Explains the state change | Motion layout |
| Dashboard | Device tiles | Thumbnails fade in from blur; the READY dot breathes; hover raises the glow from e2 to e3; meters update at 20–30 Hz with a decaying peak hold and a clip flash | Live feel | Motion values |
| Dashboard | Storage ring and legend | The ring sweeps from 0 to its value; legend rows stagger; numbers tick | Readability | Magic UI AnimatedCircularProgressBar / NumberTicker |
| Dashboard | Security, Time & Network | Icons draw in; chips glint once; the "All systems secure" dot breathes | Reassurance | Motion |
| Dashboard | Sealed Evidence Today | The count ticks from 0 to 7; bars grow from the baseline, staggered. A new seal bumps its bar, shows a Toast and increments the count | Delight tied to data | NumberTicker; Recharts animation |
| Dashboard | Recent Events | New rows slide in at the top with a gold highlight that fades over about 1.5 s; the oldest row exits | Stream clarity | Magic UI AnimatedList |
| Dashboard | Quick actions | Hover spotlight or travelling border; icon micro-motion (gear turns 45°, export arrow nudges up, stethoscope swings) | Affordance | Motion Primitives Spotlight / BorderTrail |
| Session Monitor | Page header | The title shimmers once on entry; the status dot pulses; the banner morphs colour on a state change | State at a glance | Motion Primitives TextShimmer |
| Session Monitor | Live feed | REC dot pulses at 1 Hz; timer digits slide; the frame glow breathes; fullscreen expands as a shared element; switching camera cross-fades | Recording confidence | Motion; SlidingNumber |
| Session Monitor | Session details | Duration ticks; values flash briefly when they change | Change awareness | Motion |
| Session Monitor | Evidence integrity | Checks draw one by one on mount; a light verification sweep crosses the rows in sync with "hash recorded" audit events | Makes integrity visible | Motion |
| Session Monitor | Audio monitor | Meters, a red clip flash, and a peak marker held for about 1.5 s | Operational clarity | Motion values |
| Session Monitor | Action bar | Pressed depth. Pause ↔ Resume icon morph. Add Marker: a chip flies into the timeline and a node pops in. Snapshot: a white shutter flash over the feed, then the thumbnail flies to "Open Evidence Queue" with a count badge. Session Note: Drawer slides in. End Session: a hold-to-confirm fill (about 1.5 s), then the AlertDialog | Feedback and safety | Motion layout / shared elements |
| Session Monitor | Timeline | A new node extends the line; the newest node pulses; the list auto-scrolls | Chronology | Motion AnimatePresence |
| Session Monitor | Storage during session | Session Size ticks; a write-speed mini sparkline | Liveness | NumberTicker; Recharts |
| Session Monitor | Live audit events | Streaming insertion. For hash events, a short hash scrambles and resolves. The dot flashes | "Evidence being made" feel | Magic UI AnimatedList; Motion Primitives TextScramble |
| Flow | Start New Session | The stepper connector fills; step content slides in the direction of travel; step-2 checks resolve one by one (spinner → check-draw, amber or red); step 3 pulses a "Ready" ring and runs an optional 3-2-1; then the preview tile transitions into the Session Monitor feed as a shared element | Guided, confident start | Motion Primitives TransitionPanel; Motion layout |
| Flow | End → finalization | Step list (finalize, hash, manifest, encrypt, sign, seal) with progress, then a "SEALED" stamp (scale 1.2 → 1 with a glow) | Makes chain of custody tangible | Motion |
| Evidence | List and detail | Rows stagger on first load; the list re-flows on filter change; the detail slides in; the Tabs indicator slides; Verify scrambles then resolves with a PASS chip pop; the export-wizard stepper animates | Clarity | Motion layout; TextScramble |
| Devices | Tiles and ports | Port LEDs blink with link activity; the recording-indicator lamp ("SEDANG MEREKAM") glows while recording | Hardware realism | Motion / CSS |
| Storage | Charts | The ring and area chart draw on mount; retention-calculator values tween | Readability | Recharts; NumberTicker |
| Network & Time | Live widgets | The bandwidth sparkline scrolls live; orbiting satellites while GNSS is locked; on fallback, the active tier visibly moves down GNSS → NTP → RTC | Explains the time hierarchy | Magic UI OrbitingCircles |
| Security & Audit | Chain and shield | The shield morphs between states; hash-chain links light up in sequence; a discontinuity shows a red pulse on the broken link | Tamper evidence made visible | Motion |
| System & Maintenance | Diagnostics and update | Per-check progress bars; the update stepper animates; fault injection makes the matching panels react (a live demo showcase) | Demo storytelling | Motion; HeroUI ProgressBar |
| **API Reference** | Page entry | The standard route transition; the server strip and the Realtime panel stagger in; the service-banner dot starts breathing on the first heartbeat | Continuity | Motion AnimatePresence |
| **API Reference** | Endpoint expand | Our control is limited **inside** the renderer: it can take CSS transitions from the theme stylesheet, not Motion. Height transition on expand; chevron rotates 90°; the method pill brightens (glint) on hover; the selected endpoint gets the gold left border and a soft glow | Scannability | CSS transitions in the renderer theme |
| **API Reference** | Try-it request → response reveal | Send shows a Spinner and a progress shimmer. The response panel slides open; the status-code chip pops in its colour (2xx green, 4xx amber, 5xx red); the latency number ticks up; the JSON body fades in line-staggered (short bodies only); Copy morphs into a check | Makes the call tangible | Renderer CSS; Motion in our wrapper where the renderer exposes a response slot (verify) |
| **API Reference** | Simulated endpoint | A brief "SIMULATED" badge shimmer on the response, so reviewers never mistake it for a real Core call | Honesty | CSS |
| **API Reference** | Realtime (WS) panel | The connection dot pulses once per heartbeat (1 Hz), in sync with each message; `seq` rolls with SlidingNumber; a new message slides in at the top and the oldest fades out; on disconnect the Chip morphs to red, then a reconnect spinner, then green with a pulse when back | Makes the live channel visible | Motion AnimatePresence; SlidingNumber; Magic UI AnimatedList |
| Global | Toasts and alerts | Slide in from the top-right with a severity-coloured countdown line; critical alerts keep a slow red glow until acknowledged | Severity hierarchy | HeroUI Toast with Motion |
| Global | Loading | Gold shimmer skeletons instead of spinners on first data load | Perceived speed | HeroUI Skeleton |
| Global | Reduced motion | Turn off the loops (ring rotation, Ken Burns, topo drift, breathing, particles). Keep the functional meters, optionally at a lower rate. Replace slides with fades. Replace the Login card shake with a colour change. Reduce the Login hand-off to a cross-fade | Accessibility | `useReducedMotion` |

---

## 9. Inconsistencies and gaps in the mockups

| # | Issue | Evidence (image, region) | Impact on the build | Proposed resolution |
|---|---|---|---|---|
| 1 | Every mockup is dated **Mon, 26 May 2025**; today is 2026-10-01 | D1 (716–840, 26–46); SM; AS (607–720, 22–42); MB 9 | Hard-coding it would look stale | Drive date and time from the simulator clock; format as e.g. "Thu, 1 Oct 2026" |
| 2 | Typo **"Pause Montioring"** | SM (320–432, 577–594) | Copy | "Pause Monitoring" |
| 3 | Mixed EN/ID vocabulary. Tersangka / Saksi / Lainnya vs "Witness Interview". Rank "AKP" vs "Det.". Case numbers "LP/…" vs "CR-2025-0146" | MB 3 (660–880, 243–263); MB 5; MB 6; AS (250–305, 713–728); SM (1118–1222, 322–338), (1118–1197, 291–307), (1118–1175, 260–275) | Labels, seed data, i18n (S27, A10) | Decide the UI language (EN with Indonesian domain terms, or full ID) and one naming convention (Q3) |
| 4 | **Storage 80% semantics.** DS labels it "STORAGE USED 80%", but 3.2 TB of 4.0 TB is free and 804 GB is used, so 80% is the free share (about 20% used). The AS card "65% used, 2.6 / 4.0 TB" is internally consistent | DS (600–740, 568–650); D1 F (236–660, 690–785); SM S; MB 8 | A wrong gauge on a storage page | Show used % (20%) or label it "80% free" (Q1). Also: an 804 GB used vs 3.2 TB free split is shown as 80% of a full ring |
| 5 | **Three time zones**: "UTC +01:00", "NTP (UTC+10:00)" and "UTC +07:00" | D1 (862–935, 780–792); SM (1545–1637, 300–315); MB 9 (1100–1175, 830–842) | Timestamp credibility | One configured zone. The Indonesian context (POLRI, AKP, LP/…) suggests UTC+07:00 WIB (hypothesis; Q2) |
| 6 | The active time source differs: GNSS (D1), NTP (SM), GPS/GNSS Stratum-1 with an NTP server (MB 9) | D1 G; SM N; MB 9 | Time widget | The simulator follows the book: GNSS first, NTP as fallback, RTC last (§2.2 of the book); show the active tier |
| 7 | **Camera count**: 2 on the web vs "Camera Online 1/1" on mobile, and MB 7 lists only Camera 1 | D1 C and E; MB 2 (360–425, 175–225); MB 7 | Seed data | 2 cameras (TrackId VIDEO-01 and VIDEO-02) |
| 8 | MIC 1 role: "Interviewer" vs "Investigator" | SM (1362–1470, 428–444); MB 7 (410–495, 752–765) | Labels | Pick one |
| 9 | **Sealed colour**: purple (DS, AS) vs gold with a lock (MB). Purple is not in the palette | DS (350–428, 565–597); AS (165–226, 893–924); MB 5; MB 6 | Status token map (S8) | Q4 |
| 10 | "Under Review" (grey chip) vs "IN REVIEW" (amber badge) | DS (330–447, 610–642); AS (237–310, 893–924) | Enum label and colour | One label, amber |
| 11 | Exported: green outline badge (AS) vs blue chip (MB) | AS (322–398, 893–924); MB 5 EV-…-0004 (1410–1465, 365–380) | Status token map | One colour; recommend Info Blue |
| 12 | **Three different "current" sessions**. SM: SES-20250526-0017, CR-2025-0146, Det. A. Carter, 14:08:50, 00:18:42. AS: LP/2025/0526-0007, AKP Andi Pratama, 14:14:12, 00:12:36. MB 4: 00:24:18. MB 3: LP/123/2025, AKP Budi Santoso, Ahmad Fauzi | SM M; AS #14; MB 3; MB 4 | Demo coherence | One canonical seed dataset in the `packages/shared` simulator (D19; Q7). The Login demo operators must match the investigator names in that dataset |
| 13 | The AS session-card timer renders **"00: :12:36"**, and 14:14:12 + 12:36 = 14:26:48, not 14:27:32 | AS (120–215, 672–695) | Artefact | Ignore; compute the timer |
| 14 | D1 and SM show the **same instant** (14:27:32). D1 says "No active session"; SM says it has been recording since 14:08:50. D1 Recent Events has no "Recording Started" | D1 D and I; SM K and Q | Two states, not two facts | Derive both screens from one state machine; D1 panel D shows the RECORDING variant while a session is live |
| 15 | **Event timestamp collisions** across screens: 14:24:12 is "System health check completed" (D1) and "Session recorded EV-2025-0526-0007" (MB 8); 14:21:03 is GNSS sync vs "File sealed and encrypted"; 14:12:07 is "Evidence sealed" vs "Evidence exported"; 11:48:21 is "Investigator login" vs "Session recorded EV-…-0006". EV-…-0007 is recorded 14:12:07–15:36:39 (MB 6), ending after "now", yet D1 says it was sealed at 14:12:07 | D1 (271–880, 836–921); MB 8 (650–885, 805–900); MB 6 (65–245, 735–745) | Seed data | Generate every list from one event stream |
| 16 | Inside SM, the **timeline and the audit feed disagree**. Notes: 14:11:23 and 14:18:05 (timeline) vs 14:22:11 (audit). Auto-save: 14:17:18 vs 14:15:12. The last timeline entry, "System Check 14:18:42", equals the Duration 00:18:42, which suggests the designer conflated the two | SM Q (283–330, 688–875); SM T (1363–1410, 675–897) | Coherence | One event stream |
| 17 | **Est. Remaining 31h 26m** follows from neither 3.2 TB at 120 MB/s (about 7.4 h) nor 2.4 GB per 18:42 (about 2.1 MB/s, about 415 h) | SM (1215–1290, 893–906) | Credibility | The simulator computes it from the recording bitrate |
| 18 | Session Size 2.4 GB at 18:42 equals "Segment 1 saved (2.4 GB)" logged 9 minutes earlier | SM S; SM Q (573–715, 803–817) | Coherence | Computed |
| 19 | The Info alert says "Version 2.4.1 is ready to install", but v2.4.1 is already installed | DS (1470–1650, 764–790); D1 (25–55, 836–846); MB 1 | Copy | e.g. "Version 2.5.0 is ready to install" |
| 20 | **Primary button text**: white on gold/bronze on the web (about 1.5–2.0:1, fails AA) vs dark on gold on mobile | DS (612–845, 297–336); D1 (275–508, 580–620); MB 1 Sign In (66–286, 365–400); MB 3 Next (653–885, 485–520) | Accessibility | Dark text (`--accent-foreground: #0B0D0F`) (Q5). The Login Sign In follows MB 1 (dark text) |
| 21 | **Sidebar active style**: full-bleed in D1 and SM vs an inset rounded card in AS and DS | D1 (0–200, 80–133); AS (18–225, 105–155) | Shell | Inset card (Q6) |
| 22 | Info Blue is printed as "Links", but every link is drawn gold | DS (1060–1145, 212–236); D1 (1518–1632, 422–436) | `--link` | Gold links; blue for info only (and for the GET method on the API page) |
| 23 | Charcoal `#1F262E` (cool) vs the warm panels as rendered | DS swatch vs D1 panels | Surface tokens | §1.4 (Q6) |
| 24 | The mono font is printed but not used for data values | DS 03 vs SM M | Digit jitter in live values | Use mono or tabular numerals for live values, API paths and JSON |
| 25 | The display face is given as "Orbitron / Eurostile Bold". Eurostile is commercial, and the titles are italic while Orbitron has no italic | DS (440–565, 296–320); D1 B; SM K | Fonts | Orbitron with synthetic oblique |
| 26 | **PAUSED**: AS shows a "Paused" pill, and SM offers "Pause Monitoring — Keep recording". The book's SessionState has no PAUSED (01_explore Part C) | AS (704–770, 308–342); SM P1 | State model | "Pause Monitoring" pauses only the preview and meters UI while recording continues. Drop "Paused" as a session state, or label it a demo assumption (Q8) |
| 27 | One action, several labels: "Stop Recording" (AS), "End Session / Stop recording" (SM), "Stop Session" (MB 4). Also "Start New Session" (web) vs "Start Session" (MB 2) | AS; SM; MB | Copy | One verb pair |
| 28 | **Status vocabularies diverge**. DS chips: Ready, Recording, Offline, Sealed, Secure, Connected, Warning, Info, Under Review, Archived. AS badges: NEW, URGENT, SEALED, IN REVIEW, EXPORTED, ARCHIVED. MB filters: All, Recorded, Sealed, Exported. Also "Healthy" (AS #16) and "Online" (MB) | DS 06; AS #19; MB 5 | Enums | One EvidenceStatus mapped to the book's lifecycle (§19.1) and one DeviceStatus (Part C) in the shared token map (S8) |
| 29 | Mobile avatar "IR" does not match the user AKP Budi Santoso ("BS") | MB 2 (563–588, 45–68); MB 10 (1250–1280, 673–703) | Copy | Initials from the user's name |
| 30 | The mobile status bar reads "9:41" (iOS convention); the in-app time is 14:27:32; the target is Android | MB, all screens | Emulator screenshots will differ | None needed |
| 31 | The same concept has three glyphs: Session Monitor sidebar (monitor), DS "Session" (video), SM page icon (tripod camera) | D1 (22–46, 152–175); DS (1100–1125, 710–735); SM (245–285, 95–140) | Icon consistency | One glyph per concept |
| 32 | The DS navigation snippet shows 5 of 8 items | DS (25–235, 700–838) | None; it is a snippet | AS and D1 confirm 8 |
| 33 | "Open Evidence Queue" names a "queue" that no screen defines | D1 D; SM P5; AS #9 | Routing | Route to Evidence filtered to Recorded / Pending |
| 34 | Recent Events repeats the full date on every row | D1 (271–330, 836–921) | Noise | Group rows by day (proposal) |
| 35 | Sample copy conflicts with the seed: "Only 10% storage remaining" vs 80% free | AS (1120–1255, 995–1007) | Sample only | Keep the seed coherent |
| 36 | The mobile Storage tile reads "Healthy / 80%" without saying used or free | MB 2 (520–590, 175–225) | Same issue as #4 | Q1 |
| 37 | The desktop top bar lacks the bell and hamburger shown in the DS Top Bar snippet | DS (262–712, 712–752) vs D1 top bar | Shell | Add the bell; use the hamburger at < 1024 (§2.5) |
| 38 | **States that are never drawn**: loading, empty lists, camera NO SIGNAL / FAULT, tablet-offline banner (S9), finalizing, RBAC denied, keyboard focus | All | The build must design them | Use DS alerts and chips, HeroUI Skeleton and EmptyState, and a 2 px gold focus ring |
| 39 | The first icon in the AS library (house) is filled gold while the rest are outline; the state is not explained | AS (18–60, 968–1012) | Icon states | Treat filled gold as "active" |
| 40 | **Login (D25) has no web mockup**, and MB 1 shows only the idle state: no validation, bad-credential, lockout (§20.1), Core-offline or signed-out state, and no role or pairing cue | MB 1 (42–308, 8–545) | The build must design them | §5.8 state table |
| 41 | MB 1 "Use biometric login" has no direct desktop equivalent | MB 1 (135–220, 415–470) | Scope | Simulated "Use security key", or omit it on web (Q15) |
| 42 | **API Reference (D26) has no mockup.** A stock OpenAPI renderer is light-themed and visually foreign. The book defines no bodies, no WS schema and no auth endpoints, and OpenAPI cannot describe `/ws` | 01_explore L364–L368; specs L423 | Visual consistency; content gaps | §5.9 token table, a custom Realtime panel, and the "not defined in the design book" info Alert |

---

## 10. Decision candidates for the controller (recommendations only; not decided here)

| # | Question | Recommendation | Why |
|---|---|---|---|
| Q1 | Storage ring semantics | Show **used %** (20%), with "3.2 TB free of 4.0 TB" beside it | Consistent with the AS 65%-used card; an operator reads a storage gauge as fullness |
| Q2 | Canonical time zone | UTC+07:00 (WIB), labelled as a hypothesis | Indonesian context in MB and AS |
| Q3 | UI language and naming | EN UI with Indonesian domain terms kept for subject type (Tersangka / Saksi / Lainnya) and ranks (AKP), with i18n keys from day one | Matches the mockups; S27 readiness |
| Q4 | Sealed colour | Violet custom token `--sealed` | Distinct from brand gold; DS and AS use purple |
| Q5 | Web primary-button text | Dark `#0B0D0F` on gold | 12.7:1 vs about 1.5:1; matches mobile (and the Login Sign In) |
| Q6 | Surface tokens and sidebar active style | Warm `--surface`; Charcoal for L5 only; inset active card | Matches the rendered look; works in the rail |
| Q7 | Seed dataset | One canonical session, case, investigator and event stream in the simulator, including the Login demo operators | Removes §9 #12–#18 |
| Q8 | PAUSED | UI-only "Pause Monitoring"; no PAUSED session state | Book state machine |
| Q9 | Font pins | data-collector pins Orbitron, Inter and JetBrains Mono (self-hosted, OFL) | Replaces SD-35 per D16 |
| Q10 | Media sourcing | Generate the looped clips and one hero still at ≥ 2560×1440 that serves both Dashboard and Login (no people, no insignia); do not reuse the MB 1 officer photo | Licensing and privacy |
| Q11 | Colour precision | An agent with Bash pixel-samples the non-swatch colours | This analysis estimates them by eye (§0) |
| Q12 | API Reference placement | **Option A:** its own sidebar item in a lower "DEVELOPER" group, below System & Maintenance | One click in a demo; full width for the renderer; no double navigation |
| Q13 | Try-it on simulated endpoints, and renderer choice | Route simulated calls to the in-browser simulator with a SIMULATED badge (richer demo), or disable them with a Tooltip (simpler). The renderer (Scalar vs Swagger UI) is chosen in the spec revision; for design fit, Scalar looks like less theming work (hypothesis). Whichever is chosen must have CDN fonts and hosted proxies turned off | D26; no external requests |
| Q14 | Login demo operators and roles | Two or three synthetic operators (e.g. Investigator, Supervisor, Technician), labelled as demo assumptions (book gap G1), shown in a collapsible Disclosure, with a "presentation mode" that hides them | D25; enables the RBAC paths (S20) |
| Q15 | Biometric option on web | Show a simulated "Use security key" button, or omit it | MB 1 parity vs desktop realism |

---

## Sources

- `/Users/gsp-budi/Documents/DEMS/ui_design/DEMS-DesignSystem.png`, `DEMS-Dashboard1.png`, `DEMS-SessionMonitor.png`, `DEMS-AssetSample.png`, `DEMS-Mobile.png`: each read once with the Read tool at native resolution.
- `decisions/decisions.md`: D6, D10, D15 to D22, D25, D26 (L28–L29).
- `research/01_explore.md`:
  - §21.2 (L348–L368)
  - §20.1 (L551–L558)
  - Part C (L641–L666) and Part D (L668–L685)
  - stack capability needs S1 to S29 (L689–L723)
  - suggested screen inventory, including T1 (L725–L768)
- `research/03_analysis.md`: V4 (L148), V6 (L150), SD-31 to SD-35 (L306–L310), F5 (L205–L207), capability matrix (L358–L388).
- `masterplan/01_specs.md`:
  - L62 (SPEC-C1 CORS)
  - L170 (mock-core surface)
  - L335–L336 (heartbeat hook and provider)
  - L419–L435 (constants and path distinction)
  - L437–L468 (`HealthResponse`, `Heartbeat`)
- HeroUI component list: Glob of `/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/tar/heroui/package/dist/components/*/index.d.ts` (`@heroui/react` 3.2.6, per package.json L2–L3).
- HeroUI variants: `.../scratchpad/tar/hs/package/dist/components/{button,chip,card,alert}/*.styles.d.ts` (`@heroui/styles` 3.2.6, per package.json L3).
- The absence of an info/purple theme variable: Grep `--(info|purple|violet)[\w-]*\s*:` in `.../scratchpad/tar/hs/package`, 0 matches.

*Generated 2026-10-01 by image-analyst; updated the same day for D25 (Login) and D26 (API Reference). No web tool calls. No image data left this machine.*
