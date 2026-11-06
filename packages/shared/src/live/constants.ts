/**
 * Display timings of Live mode that a feature file imports statically (backend task
 * 04_client_integration_spec §2.4; names pinned by 02_plan §3.4 "Client constants").
 *
 * §2.4 names six constants. Only the two that a page or a screen itself uses live here. The
 * other four stay with the module that uses them: `LIVE_COMMAND_TIMEOUT_MS` with the typed
 * client (`@dems/shared/client`); `LIVE_SETTLE_TIMEOUT_MS`, `LIVE_BOOT_TIMEOUT_MS` and
 * `LIVE_TOUCH_INTERVAL_MS` with the Live source (`@dems/shared/live/source`).
 *
 * Plain numbers, in milliseconds. No import: where a value is that of a motion token it is
 * repeated here, and a test holds the two equal.
 */

/**
 * How long a control that sent a command keeps its look before it shows its pending state
 * (§8.1 LB-1, "busy at once, spinner late"). The value of the motion token `duration.slow`
 * (§2.4). A UI scales it with its motion policy, as it scales every other duration.
 */
export const LIVE_PENDING_REVEAL_MS = 420;

/**
 * How long the "Reconnected to the Core" notice stays after the Live link came back (§3.5,
 * "Link back"). The value of the mobile "Resynced" banner (§2.4).
 */
export const LIVE_RESYNCED_NOTICE_MS = 3_000;
