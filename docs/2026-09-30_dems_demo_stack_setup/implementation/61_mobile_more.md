---
task_id: 2026-09-30_dems_demo_stack_setup
step: 89
plan_row: 05_mobile_plan §3 M-15 (part c); 04_mobile_specs §4.17
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete (phone-portrait device capture deferred to step 59, D112)
---

# Step 89: mobile More screen (fast lane, D75)

**Outcome: PASS on the JS gate. The device check was done on the tablet (D100). The phone capture is deferred (D112).**

| Check (row 89) | Result | Evidence |
|---|---|---|
| Render test lists every More destination, and each one navigates to its route | **PASS** | `more-screen.test.tsx`, 10/10 passed, 10:31:43–10:32:11 WIB. Navigation order: `/storage`, `/network-time`, `/audit`, `/settings`, `/pair`, `/settings/about`, `/dev-gallery`; `/session/recovery` on FAULT |
| Mobile typecheck | **exit 0** (10:31) | `npm run typecheck -w @dems/mobile` |
| Mobile lint | **exit 0** (10:31) | `npm run lint -w @dems/mobile` |
| Device check | **Tablet PASS** (D100 counts it). **Phone portrait deferred** to the end pass (step 59, D112) | §3 |

## 1. Files (P6: only `apps/mobile/src/features/more/**`)

| File | Change | Role |
|---|---|---|
| `more-screen.tsx` | replaced the step-70 stub | `MoreScreen()`, root `SafeScreen id="more"`. It holds the header, the operator card, the console tiles (phone only), the links and the footer. Each section enters on the R1 stagger (`enterRise`), and each sits inside its own error boundary |
| `operator-card.tsx` | new | Shows the avatar, name, role chip, operator id and "Signed in HH:mm" (sim clock). Has Lock console and Sign out buttons; while a session is busy it shows "Recording on the Core is not affected." |
| `console-tiles.tsx` | new | Four live tiles: Storage (used %, RollingNumber `slide`, Healthy/Low/Full), Network & Time (time source + LAN, Synchronized/Attention), Audit (event count, Chain OK/Discontinuity), Settings (section count). Two columns in portrait, four in landscape |
| `more-links.tsx` | new | A `ListGroup` with Pairing (pairing state chip), Recovery status (FAULT/RECOVERY only), About DEMS → `/settings/about`, and Developer gallery (`__DEV__` only). Rows reveal with `rowReveal`. `MoreFooter` shows the emblem, "DEMS EDGE CLIENT · v2.4.1", a DEMO chip and the Core link chip |
| `more-model.ts` | new | Pure logic: `showsConsole` (H-MB-01), `linkDestinations`, `LINK_HREFS`, the tone rules, and flat primitive `useSim` selectors (F74-13) |
| `use-more-navigate.ts` | new | `router.push`. Console jumps fire the `tabSelect` haptic. A failed push is logged (`reportRuntimeIssue`) and shown as a toast |
| `more-boundary.tsx` | new | Section error boundary: shows the shared panel copy, logs persistently, and offers a rate-limited Retry (3/6/12 s, at most 3). The cooldown runs on the **sim clock**, not on wall-clock timers |
| `i18n.ts` | filled (it was `{}`) | `features.more.*`. Shared keys are reused: `mobile.nav.*`, `mobile.app.versionFooter`, `shell.userMenu.*`, `common.roles.*`, and others |
| `more-screen.test.tsx` | new | 9 screen tests and 1 model test |

Not touched: `src/app/**`, `src/navigation/**`, `packages/shared/**`, `package.json`, the jest config. No npm install was run. No SIM-GAP: everything the screen needs already exists in the simulator and runtime.

## 2. Design decisions

| ID | Decision | Why |
|---|---|---|
| S89-1 | On tablets (8-item rail), More **hides** the four console destinations and shows one line saying they are in the navigation rail | H-MB-01 / 04 §2.3 "More dissolves": the rail already lists them. The rule is keyed on `nav.destinations === 5`, so the phone-landscape rail (which has More) keeps the tiles |
| S89-2 | The console is shown as tiles, not as the spec's flat `ListGroup` | The brief asks for a "premium launcher" and allows "tiles/list". Each tile carries a live status. The secondary items stay a `ListGroup` (MB 10 language) |
| S89-3 | About links to `/settings/about` | 04 §4.17 lists "About", and the About content is a Settings section (step 88) |
| S89-4 | Recovery appears only while the session is FAULT or RECOVERY. The developer gallery appears only when `__DEV__` is set | "Recovery if relevant", "Dev gallery only in debug builds". The `/dev-gallery` route itself redirects in release builds |
| S89-5 | Sign out has no confirmation dialog | Sign-out never touches recording (§3.3), and the card states this while a session is busy. This matches the Home avatar menu |

## 3. Device check

- **dems_tablet**, 10:10–10:12 (D100: whichever device is free first counts).
- **Command:** `device-session.sh tablet`, Metro 8088.
- **Sign-in:** pending href `demsdemo:///more?motion=off` → Login → the app's own Demo operators row filled the form (nothing typed) → Sign In → biometric offer declined → `screen-more`.

What uiautomator found:

- **Present:** `more-header`, `more-operator`, `more-lock`, `more-sign-out`, `more-links`, `more-link-pairing`, `more-link-about`, `more-link-dev-gallery`, `more-footer`, `more-version`, `more-demo`, `more-core-link`.
- **Absent:** `more-console` / `more-dest-*`. This is correct, because the rail lists `nav-item-storage`, `nav-item-network-time`, `nav-item-audit` and `nav-item-settings` (S89-1).
- **Text read:** "AKP Budi Santoso", "Investigator", "OPR-001", "Paired", "DEMS EDGE CLIENT · v2.4.1", "DEMO", "Core Simulated".
- **logcat E:** none.

Screencaps:

- [tablet more](assets/mobile/89_dems_tablet_more.png)
- [mid-entrance](assets/mobile/89_dems_tablet_more_enter_mid.png)
- [settled](assets/mobile/89_dems_tablet_more_full_motion.png)
- [after scroll](assets/mobile/89_dems_tablet_more_bottom.png)

The "Refreshing…" banner and the LogBox toast on the mid frame are dev-build noise. Another lane's file edits triggered a Metro fast refresh (P11).

**Phone portrait: not captured. Deferred to step 59 (D112, D103 time box).** Four attempts were made, 09:58–10:31:

1. **Refused:** port 8091, exit 64 (DRIFT-M89-1 below).
2. **Sign-in failed:** the operator row was below the fold, so the tap landed on its caption.
3. **Inspector failed:** two tries to sign in through `__DEMS_DEBUG__` via the Metro inspector ended in a WebSocket error.
4. **Hung:** on dems_phone2 the sign-in went through, then `uiautomator dump` hung until AGENT_SECS (exit 142).

The phone files from these attempts show the **Login screen, not More**:

- `89_dems_phone_unexpected.png`
- `89_dems_phone_more_enter_mid.png`
- `89_dems_phone_more_full_motion.png` (despite its name)

They are failed-attempt evidence only. Jest covers the phone layouts: portrait has two rows of two, landscape has one row of four, and all tiles navigate.

## 4. Drift, notes, hand-overs

| ID | Item | Owner |
|---|---|---|
| DRIFT-M89-1 | `device-session.sh` accepts only `808[1-9]`, so lane 8091 was refused (exit 64, 09:58:36). Sessions used 8089 / 8088 after checking with curl that they were free | Step 61 / controller: widen the port check, or reassign lanes |
| D-89-2 | Phone-portrait capture of More (console tiles) | Step 59 end pass |
| D-89-3 | The inspector route to `__DEMS_DEBUG__` failed from Node 26 `WebSocket` (Metro's inspector proxy, URL rewritten to the lane port). The working recipe of steps 79/81 is not written down | Step 60 README / step 59 |
| P11 | Step 70's `routes` / `guard` / `chrome` tests fail for other screens' replaced stubs (19 failures, none about `/more`) | Step 57 |
| Note | The first jest run hung after 2 failing multi-mount tests. Splitting them fixed it; the suite now exits in about 5 s | — |

---
*Generated: 2026-10-01 10:33 WIB*
