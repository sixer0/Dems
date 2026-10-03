/**
 * Simulator constants (masterplan/01_specs.md §14.7 "Rates", §14.8 "Policy", D28).
 *
 * Every number the engine, the store or a page needs to agree on lives here, so the web
 * console, the mobile app and the tests read one value.
 */

/** Default seed (01_specs §14.7 `engine.ts`). */
export const DEFAULT_SEED = 20261001;

/** Persisted snapshot key (web session storage, mobile AsyncStorage; 01_specs §14.7, 04 §5.3). */
export const SIM_STORAGE_KEY = 'dems.sim.v1';
/** Persisted snapshot schema version. Bump it when the snapshot shape changes. */
export const SIM_SNAPSHOT_VERSION = 1;
/** Signed-in operator record key (`{ operatorId, issuedAt }`, never a password; §14.8). */
export const AUTH_STORAGE_KEY = 'dems.auth';
/** Snapshot writes are coalesced to at most one per second (§14.7 `store.ts`). */
export const PERSIST_THROTTLE_MS = 1_000;

// ── Rates (§14.7) ────────────────────────────────────────────────────────────────────────
/** Default scheduler interval (`setInterval(50)`). */
export const ENGINE_INTERVAL_MS = 50;
/** The published `clock.now` advances in 100 ms steps. */
export const CLOCK_TICK_MS = 100;
/** Audio frames: 20 Hz. Equal to `motion.meterFrameMs` in tokens.ts (§2.7). */
export const AUDIO_FRAME_MS = 50;
/** Health, timer and heartbeat UI: 1 Hz. */
export const HEALTH_TICK_MS = 1_000;
/** Recording events: Poisson process, mean 1 per 8 s. */
export const RECORDING_EVENT_MEAN_MS = 8_000;
/** Idle events: 1 per 60 s. */
export const IDLE_EVENT_INTERVAL_MS = 60_000;

// ── Ring buffers (§14.7 `events.ts`) ────────────────────────────────────────────────────
export const EVENT_RING_SIZE = 500;
export const AUDIT_RING_SIZE = 1_000;
/** Other bounded lists (alerts, series, session timeline). */
export const ALERT_RING_SIZE = 100;
export const SERIES_POINTS = 120;
export const STORAGE_HISTORY_POINTS = 24;
export const TIMELINE_MAX = 200;

/** Audit hash chain genesis: 64 zero hex digits. */
export const GENESIS_HASH = '0'.repeat(64);

// ── Time zone (D28/Q2) ───────────────────────────────────────────────────────────────────
export const SIM_TZ = '+07:00' as const;
export const SIM_TZ_OFFSET_MINUTES = 420;

// ── Auth policy (§14.8, 04 §6.1) ─────────────────────────────────────────────────────────
export const AUTH_MAX_FAILURES = 5;
export const AUTH_FAILURE_WINDOW_MS = 5 * 60_000;
export const AUTH_LOCKOUT_MS = 60_000;
export const AUTH_IDLE_TIMEOUT_MS = 15 * 60_000;
/** `touch()` writes at most once per second, so pointer activity does not churn the store. */
export const AUTH_TOUCH_MIN_INTERVAL_MS = 1_000;

// ── Pairing policy (04 §4.2: 3 failures → 60 s lockout, mirroring auth) ─────────────────
export const PAIRING_MAX_FAILURES = 3;
export const PAIRING_LOCKOUT_MS = 60_000;
export const PAIRING_CODE_LENGTH = 6;

// ── Session machine timing (§14.7 transition table) ─────────────────────────────────────
export const PRECHECK_CHECK_MIN_MS = 300;
export const PRECHECK_CHECK_MAX_MS = 700;
export const STOPPING_MS = 1_500;
export const FINALIZATION_STEP_MIN_MS = 600;
export const FINALIZATION_STEP_MAX_MS = 1_200;
export const RECOVERY_MS = 3_000;
/** `stopRecording(reason)` needs a reason of at least 5 characters (§14.7, S21). */
export const STOP_REASON_MIN_LENGTH = 5;
/** Export reasons (S21, §19.2 item 8) use the same minimum. */
export const EXPORT_REASON_MIN_LENGTH = STOP_REASON_MIN_LENGTH;
/**
 * Upper bound for the 8 seeded precheck checks together (step 32): each check still takes
 * 300-700 ms, but the draw is budgeted so the gate resolves within 5 s (AC-62, MA-29).
 */
export const PRECHECK_TOTAL_MAX_MS = 4_900;
/** RECOVERY_SCAN runs this long before INCOMPLETE_SESSION_ANALYSIS (half of RECOVERY_MS). */
export const RECOVERY_SCAN_MS = 1_500;

// ── Event generator (step 32; §14.7 "Rates") ─────────────────────────────────────────────
/** At most this many generated rows when catching up after a long hidden period. */
export const GENERATOR_CATCH_UP_MAX = 120;
/** Session timeline: AUTOSAVE at most once per minute, CHECK every 2 min, HEALTH every 5 min. */
export const TIMELINE_AUTOSAVE_MS = 60_000;
export const TIMELINE_CHECK_MS = 120_000;
export const TIMELINE_HEALTH_MS = 300_000;

// ── Audio peaks and faults (step 32; §14.7 `audio.ts`) ───────────────────────────────────
export const AUDIO_PEAK_MIN_INTERVAL_MS = 90_000;
export const AUDIO_PEAK_MAX_INTERVAL_MS = 180_000;
/** A CLIP burst reaches this level (≥ AUDIO_CLIP_DBFS). */
export const AUDIO_CLIP_BURST_DBFS = -0.2;
/** A TEST_SIGNAL device command plays a steady tone at this level for this long. */
export const AUDIO_TEST_TONE_DBFS = -18;
export const AUDIO_TEST_TONE_MS = 2_000;

// ── Diagnostics and software update (step 32) ───────────────────────────────────────────
export const DIAGNOSTIC_CHECK_MIN_MS = 300;
export const DIAGNOSTIC_CHECK_MAX_MS = 600;
export const UPDATE_STEP_MIN_MS = 800;
export const UPDATE_STEP_MAX_MS = 1_600;
/** The REBOOT update step. */
export const UPDATE_REBOOT_MS = 3_000;

// ── Storage faults (step 32): the fill level each storage fault forces ─────────────────
export const STORAGE_LOW_FILL_PERCENT = 86;
export const STORAGE_FULL_FILL_PERCENT = 98.6;

// ── Audio model (§14.7 `audio.ts`) ───────────────────────────────────────────────────────
export const AUDIO_FLOOR_DBFS = -90;
export const AUDIO_NOISE_FLOOR_DBFS = -52;
export const AUDIO_NOISE_FLOOR_SPREAD_DB = 2;
export const AUDIO_SPEECH_MIN_DBFS = -24;
export const AUDIO_SPEECH_MAX_DBFS = -12;
export const AUDIO_PEAK_DBFS = -3.1;
export const AUDIO_CLIP_DBFS = -0.5;
export const AUDIO_RELEASE_DB_PER_S = 20;
export const AUDIO_PEAK_HOLD_MS = 1_500;
export const AUDIO_PEAK_DECAY_DB_PER_S = 20;

// ── Storage model (§14.7 dataset, D28/Q1, 01 §10.3) ─────────────────────────────────────
/** Decimal units, as the dataset states them (4.0 TB = 4,000 GB). */
export const GB = 1_000_000_000;
export const TB = 1_000 * GB;
export const EVIDENCE_VOLUME_BYTES = 4 * TB;
export const EVIDENCE_USED_AT_LOAD_BYTES = 804 * GB;
export const SYSTEM_VOLUME_BYTES = 2 * TB;
/** Recording bitrate shown in the UI: 18.3 Mbps. */
export const RECORDING_BITRATE_MBPS = 18.3;
/** Estimated remaining = free ÷ 8.2 GB/h (AC-54). The rounded dataset figure, not 18.3 Mbps × 3600 / 8. */
export const RECORDING_BYTES_PER_HOUR = 8.2 * GB;
/** StorageState thresholds on the evidence volume (demo assumption, 04 gap G8). */
export const STORAGE_LOW_PERCENT = 85;
export const STORAGE_FULL_PERCENT = 98;
