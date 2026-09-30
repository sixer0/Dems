# Delegation Progress: image-analyst

| Field | Value |
|---|---|
| Agent | image-analyst |
| Run | Parallel. This agent did not write to `delegation_progress_report.md` or `status_tasks.md` |
| Date | 2026-10-01 |
| Status | **complete** (colour values outside the 9 printed swatches are visual estimates; see Blockers) |
| Assignment | Turn `ui_design/*.png` into a build-ready design analysis for the Core web console, plus a mobile reference section. **Mid-task scope addition (D25, D26):** 10 web pages, adding Login and API Reference / Swagger |

## Files created

| Path | Content |
|---|---|
| `research/04_ui_design_analysis.md` | Method (§0); 10 key takeaways; §1 tokens; §2 app shell (now with the 9th "API Reference" nav item); §3 Dashboard and Session Monitor specs; §4 AssetSample catalogue; §5 derived pages: Evidence, Devices & Inputs, Storage, Network & Time, Security & Audit, System & Maintenance, the Start New Session flow, **§5.8 Login**, **§5.9 API Reference**; §6 mobile reference; §7 asset list; §8 animation opportunities (Login and API rows added); §9 42 inconsistencies and gaps; §10 15 decision candidates; Sources |
| `delegation_progress/image_analyst.md` | This file |

No other files were created, modified, renamed or deleted. The images and reference documents were read only.

## Milestones

1. All 5 PNGs were read once at native resolution.
2. The component mapping was checked against the unpacked tarballs already in the session scratchpad:
   - component names from `@heroui/react@3.2.6`
   - variant values from `@heroui/styles@3.2.6` for Button, Chip, Card and Alert
3. Verified kit facts:
   - HeroUI has no sidebar, navbar, stepper, timeline or chart component.
   - Its semantic colours are only accent, danger, default, success and warning. There is **no info colour and no purple** (Grep found 0 matches).
4. All 9 swatches were transcribed with the hex exactly as printed. The 8-role type scale and the spacing, radius, stroke and elevation tokens were transcribed.
5. Shell proportions were measured. Proposed sizes:
   - 1920x1080: sidebar 232 px, top bar 80 px, gutter 16 px
   - 1440x900: sidebar 216 px, top bar 72 px, gutter 12 px
   - below 1280: icon rail; below 1024: Drawer
6. Specs were written for 10 Dashboard panels and 10 Session Monitor zones. Every panel is mapped to a kit component. Only 5 custom compositions remain: the ring, the meters, the timeline, the stepper and the shell.
7. **The D25 Login page was specified.** Sources: MB 1, the D1 hero and ring, and §20.1.
   - Desktop layout: full-viewport 7/5 split.
   - Auth card with fields and controls.
   - 8 states: idle, validating, submitting, error, locked out, Core offline, signed out, success.
   - Security notes and responsive breakpoints.
   - A shared-element hand-off from Login into the shell.
8. **The D26 API Reference page was specified.**
   - Placement options, with option A recommended.
   - An endpoint inventory: the 9 §21.2 endpoints plus `GET /api/v1/health` and WS `/ws`, marked LIVE, SIMULATED or RBAC.
   - The token table the renderer must take, with method colours mapped onto the printed palette.
   - A live WebSocket heartbeat side panel, because OpenAPI cannot model `/ws`.
   - Renderer-fit notes flagged as hypotheses.
9. The asset list and the animation section were extended for both pages:
   - the hero still must be sourced at ≥ 2560×1440 so one image serves both the Dashboard and Login
   - the emblem SVG must hold detail at 160–180 px, with animatable arcs
   - a new renderer-theme stylesheet asset
   - Login and API Lucide glyphs

## Blockers

- **None blocking.**
- **Limitation:** there is no shell or image library in this agent, so no pixel sampling was done. The panel fill, border alpha, glow, meter yellow and sealed purple are visual estimates marked "est.". Follow-up Q11 recommends pixel-sampling with an agent that has Bash.
- **Hypotheses:**
  - Magic UI and Motion Primitives item names are candidates, not fetched from a registry.
  - Lucide icon names must be verified against lucide-react 1.49.0.
  - Swagger UI and Scalar theming and config behaviour come from knowledge, not fetched packages. This includes whether CDN fonts and a hosted try-it proxy can be turned off. The spec revision must verify it.

## Decisions and findings for the controller to record

These are recommendations only. Nothing below is decided.

| Ref | Finding | Needs |
|---|---|---|
| Q1 | Storage "80%" is labelled "USED" but is the free share (3.2 of 4.0 TB free, 804 GB used) | User or controller decision; recommendation: show used % |
| Q2 | Three time zones appear in the mockups (UTC+01, UTC+10, UTC+07) | Decision; recommendation: UTC+07:00 (WIB), as a hypothesis |
| Q3 | Mixed EN/ID vocabulary (Tersangka/Saksi, AKP vs Det., LP/… vs CR-…) | Language decision (ties to A10 and S27) |
| Q4 | "Sealed" is purple in DS and AS but gold on mobile; purple is not in the palette or in HeroUI | Decision; recommendation: violet `--sealed` token |
| Q5 | White text on gold/bronze web buttons fails WCAG AA (about 1.5–2.0:1) | Recommendation: dark text, as on mobile and the Login Sign In |
| Q6 | Charcoal `#1F262E` is cool; rendered panels are warm. Active nav style differs between mockups | Recommendation: warm `--surface`; inset active card |
| Q7 | Three different "current" sessions and colliding event timestamps across screens | Recommendation: one canonical seed dataset in the simulator (fits D19), including the Login demo operators |
| Q8 | The "Paused" pill and "Pause Monitoring" have no PAUSED session state in the book | Recommendation: a UI-only pause; recording continues |
| Q9 | Fonts Orbitron, Inter and JetBrains Mono have no pins collected (Geist was SD-35; D16 overrides it) | data-collector follow-up |
| Q10 | The logo, hero photo and topographic texture must be recreated. One hero still at ≥ 2560×1440 serves Dashboard and Login. Camera photos are placeholder crops only. The mobile login photo shows POLRI insignia: do not reuse | Asset-sourcing row in the blueprint |
| Q11 | Pixel-sample the non-swatch colours | Optional follow-up row |
| Q12 | Where to place the API Reference | Recommendation: its own sidebar item in a lower "DEVELOPER" group (option A) |
| Q13 | Try-it on simulated endpoints, and the renderer | Simulator-routed with a SIMULATED badge, or disabled; the spec revision picks Scalar or Swagger UI. CDN fonts and hosted proxies must be off either way |
| Q14 | Login demo operators and roles | 2–3 synthetic operators with role chips, labelled demo assumptions (gap G1) |
| Q15 | The biometric option on web | Simulated "Use security key", or omit |

**Blueprint impact (input for row 6).** The web build needs these implementation units:
- a token extension: `--info`, `--sealed`, method colours, warm surfaces, glow elevations
- five compositions: ring, meter, timeline, stepper, shell; the ring is reused on Login
- six derived shell pages, the Start Session modal, the **Login page** (outside the shell) and the **API Reference page** (renderer, theme stylesheet and Realtime panel)
- asset recreation: SVG emblem at display quality, SVG topographic texture, one ≥ 2560×1440 hero still, two looped camera clips

Library swaps: none; everything fits the D10 stack. The renderer choice is still open (D26) and is an addition within the web decision area.
