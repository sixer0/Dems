# coder-execution - fix wave M, driver M-M (mobile, tablet + phone)

Status: **needs-review** (2026-10-11 15:50 WIB). Note: `implementation/160_fix_wave_m_m.md`.

| Item | Result |
|---|---|
| G70d-03 | stale form reproduced and fixed (form cleared + notice when its session is gone); explicit "Cancel session" and "Go to Home, keep the session open"; the dead Back NOT reproduced (six drives). Proven on tablet and phone |
| G70d-02 | one wording rule on Devices rows and detail; microphone lines named by role in force. Proven on both devices at rest and while recording |
| G75e-01 | reproduced (recording starts while Home is on a hidden tab); fixed in `status-tiles.tsx`; proven on the phone with the same recipe. Platform mechanism not established |
| G89d-03 | tab strip pinned in the tablet pane; list chips wrap. Proven with bounds and real taps |
| Notification B | no code change needed; driven once on the tablet and once on the phone with the source rig; rig left OFF |

Files: see section 8 of the note (14 product files, 7 existing test files, no new file).
Checks: typecheck clean; lint 0 errors; 176 suites / 1474 tests green (targeted folders).
State left: section 7 of the note (no session open, rigs OFF, no active alert, both devices on Login).
