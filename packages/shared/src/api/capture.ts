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

// ── File time and host time (capture spec §C.4, §F; errata PE-111-02, PE-111-06; row 58 part P4) ──

/**
 * THE media-time origin of a camera file, in audio samples at `CAPTURE_AUDIO_SAMPLE_RATE_HZ`:
 * **file time 0 = T0 − 1024 samples = T0 − 21.333 ms**, where T0 is the host instant of audio
 * sample 0 (the capture worker's T0; sample `n` of the PCM tap was captured at T0 + n / 48000 s).
 *
 * Why 1024: row 58 keeps the S1-pinned mux flags (`frag_keyframe+empty_moov+default_base_moof`),
 * which write no edit list, so the 1,024 AAC priming samples are presented and BOTH tracks sit
 * 1024 samples later in the file. Every mapping between file time and host time uses this one
 * constant (transcript spec §A.2 "Timeline mapping", the PCM tap, STT timestamps, R-8):
 *
 *   file time of tap sample n          = (n + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) / 48000  s
 *   file time of a `FIRST_VIDEO_SAMPLE` record (pts, timescale; `@dems/capture-protocol`)
 *                                      = pts / timescale + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES / 48000  s
 *
 * It is 0 only under `delay_moov`, which row 58 measured and rejected (the video track of a
 * file whose first fragment was cut before its first video sample moves to time 0, and correct
 * timing would depend on every reader honouring edit lists). The value follows the mux flags:
 * `apps/capture-worker/check.sh` holds the flags, and a Core test holds this constant to them.
 */
export const CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES = 1_024;

/**
 * The length of one AAC-LC frame of the session audio track, in samples at
 * `CAPTURE_AUDIO_SAMPLE_RATE_HZ` (1024 samples = 21.333 ms; transcript spec §0.2 `AUDIO_FRAME_MS`).
 * It is the FRAME GRID of the sealed file: what chunk boundaries of the transcript snap to.
 *
 * It is a different fact from `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES`, although both are 1024 today
 * (the encoder priming of the pinned mux flags happens to be exactly one frame): the origin
 * follows the mux flags and would be 0 under `delay_moov`, the frame length follows the codec and
 * would not change. A reader of the grid takes this constant, never the origin (row 77 decision
 * D-77-6, navigator finding N-14).
 */
export const CAPTURE_AAC_FRAME_SAMPLES = 1_024;

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
 * Fixed prefix of the signed DOWNLOAD token of a finished export (fix pass F-M8, ruling D178): the
 * last path segment of the registry-external `GET /exports/<token>` that operation 87 names in its
 * optional `download` member. Same construction, binding and TTL as the media session token; the
 * shared blanking rule knows it (`redaction.ts`), and it never enters a log or an audit row.
 */
export const EVIDENCE_EXPORT_DOWNLOAD_TOKEN_PREFIX = 'exs_';
/** The path the download route is served under: `/exports/<token>`. Same origin as the API. */
export const EVIDENCE_EXPORT_DOWNLOAD_ROUTE_PREFIX = '/exports';
/**
 * Id of the separate media-session signing key (SEC35-12): held in the Core credential store,
 * never the evidence `Signer` key, never in a log or an audit row.
 */
export const MEDIA_SESSION_SIGNING_KEY_ID = 'MEDIA-KEY-EVMEDIA-01';

// ── Camera search, connection test and local inputs (R-9, R-10; `C3 §7` errata PE-121-12, ─────
// ── PE-128-17..21; decisions D86 C-2 / C-4 / C-8, D91; blueprint row 132, decision D106) ──────
//
// The constants of operations 93 to 97. One value each, as fixed at the spec gate (row 128). The
// Core server enforces them; the clients read them for their texts and their polling.

/** Search ids, `DSC-NNNNNN` (operation 93; the `searchId` of every audit row of a search). */
export const CAPTURE_SEARCH_ID_PATTERN = /^DSC-[0-9]{6,}$/;
/** Candidate ids, `CND-` and 12 upper-case hex digits: 48 random bits, minted by the Core per search. */
export const CAPTURE_CANDIDATE_ID_PATTERN = /^CND-[0-9A-F]{12}$/;
/** How long the one UDP socket of a search stays open (ms; C-N13; `cap` §A.6.1 DS-7; D82(c)). */
export const CAPTURE_DISCOVERY_WINDOW_MS = 3_000;
/** Life of a candidate list after its window closes (ms; R-9 AC-4). */
export const CAPTURE_DISCOVERY_RESULT_TTL_MS = 600_000;
/** Bound of the per-session candidate list; beyond it `truncated: true`. */
export const CAPTURE_DISCOVERY_MAX_CANDIDATES = 64;
/** Least time between two search starts of one operator session (ms; R-9 AC-11). */
export const CAPTURE_DISCOVERY_MIN_INTERVAL_MS = 10_000;
/** Least time between two search starts on one Core, whatever the session (ms; SEC35-39 (4)). */
export const CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS = 5_000;
/** Searches per minute per Core, all sessions together. The pre-check search has its own allowance. */
export const CAPTURE_DISCOVERY_MAX_PER_MINUTE = 6;
/** Searches per hour per operator session (SEC35-39 (2)). */
export const CAPTURE_DISCOVERY_MAX_PER_HOUR = 30;
/**
 * The lift of decision D86 C-4 (SEC35-29 (6); check `M4-DISC-REC-1`). While it is `false`, operation
 * 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`) during `RECORDING`: 0
 * datagrams, no audit row, no alert.
 *
 * It is `true` because the two checks that gate it are recorded PASS: `M4-SEC-DISC-1` (hostile
 * answers end no process) and `M4-SEC-DISC-3` (a hostile flood during a recording leaves the
 * fragments contiguous), both in `docs/2026-10-07_dems_real_capture_sealing/implementation/
 * 62_r9_onvif_discovery.md` §3 (row 131, 2 runs) and again on a booted Core in
 * `implementation/63_r9_search_api.md` (row 132). A static test of the Core server
 * (`modules/capture-discovery/__tests__/static.test.ts`) reads both documents and fails when this
 * constant is on and either result is not recorded.
 */
export const CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED = true;
/** The whole connection test (ms): then `UNREACHABLE` (`cap` CT-4; SEC35-33 (1)). */
export const CAPTURE_CONNECTION_TEST_TIMEOUT_MS = 15_000;
/** How long a `REACHABLE` outcome keeps a candidate adoptable (ms). */
export const CAPTURE_CONNECTION_TEST_VALIDITY_MS = 300_000;
/** Least time between two attempts on one host, and between two tests of one operator session on any host (ms). */
export const CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS = 5_000;
/** Connection tests per minute per Core; one test at a time per Core. */
export const CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE = 6;
/** `AUTHENTICATION_FAILED` outcomes per host inside the failure window: the lock-out guard (D86 C-2). */
export const CAPTURE_CONNECTION_TEST_MAX_FAILURES = 2;
/** Window of the lock-out guard (ms; 30 minutes), counted per Core by host, in memory. */
export const CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS = 1_800_000;
/** Least time between two local-input re-reads per Core (ms; operation 97). */
export const CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS = 5_000;
/** Longest endpoint reference, hint or announced text a candidate carries (characters; D91). */
export const CAPTURE_CANDIDATE_TEXT_MAX_LENGTH = 120;
