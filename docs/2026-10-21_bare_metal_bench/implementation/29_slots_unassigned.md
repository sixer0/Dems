# Row 50 (HIL, done by the controller under D39): the four selector slots unassigned

T0=1792684100451 (taken before the first attempt). Baseline: `f|f|f|f`; session_history 13, active_session 0.
First attempt (user, D38 (2)) did not reach the Core. Second (controller, D39): console in the app's browser pane, Data mode Live, operator andi.pratama (SUPERVISOR) picked from the console's demo-operator list. budi.santoso (INVESTIGATOR) had been tried first: the selector was disabled (role gate, `capture-selector.ts:124-128`).
Per slot, DB after each Save: VIDEO-01 `t|f|f|f` (1 audit) -> VIDEO-02 `t|t|f|f` (2) -> PRIMARY `t|t|t|f` (3) -> STANDBY `t|t|t|t` (4).
VERIFY: `t|t|t|t`; CAPTURE_CONFIG_CHANGED after T0 = `4`; sessions `13|0` (no session started). Audit after T0 also: AUTH_SUCCESS 2, AUTH_SIGNED_OUT 1 (the two sign-ins).
