/**
 * Capture-phase constants of the Core API contract (task 3 M2-W7, blueprint row 48; register
 * CS-25/E-18; `masterplan/03_api_contract.md` (C3) §7).
 *
 * This module is the single source for every number and word the capture, sealing and media
 * paths pin across the three apps (`@dems/shared/api` re-exports it). The Core server enforces
 * them through `apps/core-server/src/modules/__tests__/contract-values.test.ts` (CS-25: identity
 * comparisons, not copies), exactly like the pairing and biometric values of that test.
 *
 * The sibling `capture-spec §E.1` named the first three silence/debounce values; C3 §7 fixes
 * ALL of them here as the single source. The transcript-spec owns `AUDIO_FRAME_MS` and the
 * STT/VAD constants — they are deliberately NOT duplicated here (J.9 anchor-only rule).
 *
 * Gate answers folded in:
 * - **SP-4 / Q-SP-4 (default, confirmed by row 39 per plan F-5):** the fragment quantum is the
 *   camera GOP. `CAPTURE_GOP_FRAMES = 50` at 25 fps pairs with `CAPTURE_FRAGMENT_TARGET_MS` /
 *   `CAPTURE_MIN_FRAG_DURATION_MS = 2000`: `frag_keyframe + min_frag_duration` cuts
 *   keyframe-aligned on the GOP grid (S1 §6.4/§6.5; D10(b); capture-spec §C.1). No
 *   `frag_type`/`default_prft`/`frag_start_number` constant exists (W1-C1).
 * - **Q-GOP (default (a), AU2-08):** `CAPTURE_GOP_FRAMES` is a **target** — enforced where DEMS
 *   encodes (the fakes) and written to the camera (ONVIF `GovLength`) at session start (class C,
 *   H-7). On the stream-copy path the camera's GOP is used and the worker verifies the OBSERVED
 *   keyframe interval from the first fragments; an interval beyond `CAPTURE_OBSERVED_GOP_MAX_MS`
 *   raises a WARNING on the existing capture-warning channel (`raiseCaptureWarning`, SH-18) —
 *   under the default NO new error or audit code joins the pinned counts (capture-spec §C.1
 *   OP-GOP; blueprint row 48).
 */

// ── Mic silence and disconnect detection (OD-11 (D4); capture-spec §E.1) ──────────────────────

/** dBFS at or below which a mic input counts as silent. */
export const MIC_SILENCE_DBFS = -50;
/** How long the input must stay at or below `MIC_SILENCE_DBFS` before `MIC_SILENT` warns (ms). */
export const MIC_SILENCE_DURATION_MS = 10_000;
/** Debounce of a mic disconnect before it is reported (ms). */
export const MIC_DISCONNECT_DEBOUNCE_MS = 2_000;

// ── Capture media grid (OD-06 (D4); S1; D10(b)) ───────────────────────────────────────────────

/** AAC-LC sample rate of the session audio (Hz); mono. */
export const CAPTURE_AUDIO_SAMPLE_RATE_HZ = 48_000;
/** Channels of the encoded session audio; mono (OD-06). */
export const CAPTURE_AUDIO_CHANNELS = 1;
/**
 * Target GOP in encoded frames: 50 frames at 25 fps = 2.0 s (S1 `-g 50 @ 25 fps`; SP-4).
 * A TARGET only (erratum AU2-08): enforced where DEMS encodes, written to the camera at session
 * start (class C), and verified as the observed keyframe interval on the copy path.
 */
export const CAPTURE_GOP_FRAMES = 50;
/** Target fragment length (ms); the fragment quantum equals the GOP (D10(b); SP-4). */
export const CAPTURE_FRAGMENT_TARGET_MS = 2_000;
/** Minimum fragment duration (ms); pairs with the GOP so cuts land on keyframes (S1 SP-4). */
export const CAPTURE_MIN_FRAG_DURATION_MS = 2_000;
/**
 * Largest observed keyframe interval still accepted on the stream-copy path (ms) — the Q-GOP
 * default "GOP ≤ 2 s". Beyond it the worker raises the capture warning (existing warning
 * channel); no dedicated error or audit code exists under the default (OP-GOP option (a)).
 */
export const CAPTURE_OBSERVED_GOP_MAX_MS = 2_000;

// ── Sealing progress and meters (R-6 op 83; register NM-02) ───────────────────────────────────

/** Per-step progress/ETA recompute interval of `getSealingProgress` (ms; design proposal C3 §7). */
export const SEALING_PROGRESS_INTERVAL_MS = 1_000;
/** Meter rate the capture worker publishes at (Hz; register NM-02). */
export const CAPTURE_METER_RATE_HZ = 20;

// ── Evidence media sessions (SEC35-12/SEC35-13; E-31; register NM-11) ─────────────────────────

/** Lifetime of a signed evidence-media URL (ms); the replay window is exactly this TTL (SEC35-12). */
export const EVIDENCE_MEDIA_SESSION_TTL_MS = 60_000;
/**
 * Fixed prefix of the signed-URL token (SEC35-13). Both client log-blanking lists extend their
 * regex from `\b(ses|dvc|bio)_` to `\b(ses|dvc|bio|mts)_` (check M8-BLK-1); the URL and any
 * prefix of it never enter a log or an audit row (E-31).
 */
export const EVIDENCE_MEDIA_TOKEN_PREFIX = 'mts_';
/**
 * Id of the separate media-session signing key (SEC35-12): held in the Core credential store,
 * never the evidence `Signer` key, never in a log or an audit row.
 */
export const MEDIA_SESSION_SIGNING_KEY_ID = 'MEDIA-KEY-EVMEDIA-01';
