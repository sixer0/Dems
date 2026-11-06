/**
 * Login choreography (03_motion_spec M-PG-LOGIN, M-APP-01 Login side, M-APP-02 arrival, §8).
 *
 * Every value is a spec literal in ms (D49: untokenised timings stay documented literals) and is
 * time-scaled by the caller through `useMotionPolicy().seconds` (proof mode `?motion=slow` ×10).
 *
 * Entrance, `cold` (a fresh visit; M-PG-LOGIN):
 * | t     | beat |
 * |-------|------|
 * | 0     | room still fades up (900, `luxe`) and Ken Burns starts |
 * | 200   | GlowRing layers sweep in (M-C-01, `login` mode) |
 * | 500   | emblem strokes draw: shield (500), then 6 arcs 70 ms apart (240 each), then one bloom |
 * | 900   | overline, then wordmark (rack focus), tagline lines (TextEffect per line), gold rule wipe, vertical words |
 * | 1,100 | device strip rises (`riseSm`); its clock starts sliding |
 * | 1,200 | auth card rises 12 px and fades in (`gentle`); BorderBeam runs one lap; Username takes focus once the card settles |
 *
 * Entrance, `return` (M-APP-02, after the shell's own ≈300 ms exit): the emblem flies back from
 * the top bar through the shared `layoutId` (no draw, never from opacity 0), the ring arcs sweep
 * in, the card rises, and the "signed out" Alert enters last. Compressed to ≈900 ms in total.
 *
 * Hand-off, success (M-APP-01, Login half, two-phase fallback per D65 / 21_shell_motion §2):
 * | t   | beat |
 * |-----|------|
 * | 0   | the check draws over the emblem (300, `luxe`); the ring flashes success green and blooms once |
 * | 150 | auth card: opacity → 0, scale → 0.96, y → 8 (300, `exit`) |
 * | 150 | room still crops toward the Dashboard hero band (`clip-path: inset()`, once) and fades |
 * | 210 | ring, brand text, pillars, device strip and particles fade (240) |
 * | 300 | the check fades from the emblem, so the emblem that flies is the plain brand mark |
 * | 450 | `navigate()`: the shell mounts in the same commit and its emblem flies from this box (≈700 ms, spring `gentle`) |
 *
 * DR-43-3: the brand text fade starts at 210 instead of 300 so that everything except the emblem
 * has left before the commit at 450 (the two-phase fallback unmounts Login there; anything still
 * visible would blink out).
 *
 * Reduced motion (§8): opacity only, `fast`, no stagger, no draw, no flight (the emblem
 * cross-fades), no shake, no scan pulse, no halo flash; the hand-off is a cross-fade.
 */
export type LoginArrival = 'cold' | 'return'

export interface LoginChoreography {
  arrival: LoginArrival
  reduced: boolean
  backdrop: { delayMs: number; durationMs: number }
  ringDelayMs: number
  /** Emblem stroke draw, or null (return flight, reduced motion). */
  emblemDraw: { startMs: number; shieldMs: number; arcStaggerMs: number; arcMs: number } | null
  /** One bloom behind the emblem after the draw (the hero moment), or null. */
  bloomAtMs: number | null
  overlineMs: number
  wordmarkMs: number
  taglineMs: number
  /** TextEffect `per="line"`: lines 120 ms apart (M-C-13). */
  taglineLineGapMs: number
  ruleMs: number
  pillarsMs: number
  pillarGapMs: number
  stripMs: number
  cardMs: number
  /** BorderBeam's one lap starts with the card. */
  beamDelayMs: number
  /** Username takes focus once the card has settled. */
  focusAtMs: number
  /** The arrival Alert ("You have been signed out.") enters last. */
  noticeMs: number
}

/** The M-APP-01 Login half (ms from the moment the simulator accepts the credentials). */
export const HANDOFF = {
  checkMs: 300,
  checkFadeAtMs: 300,
  checkFadeMs: 150,
  haloInMs: 150,
  haloOutMs: 300,
  cardDelayMs: 150,
  cardMs: 300,
  cardScale: 0.96,
  cardDropPx: 8,
  fadeDelayMs: 210,
  fadeMs: 240,
  backdropDelayMs: 150,
  backdropMs: 300,
  /** The commit: the card exit completes here and `navigate()` runs (the flight starts). */
  navigateAtMs: 450,
  /** Always leave, even if an animation is interrupted (time-scaled). */
  guardMs: 900,
  /** Reduced motion: one opacity cross-fade of the whole page before `navigate()`. */
  reducedFadeMs: 160,
} as const

/** The Dashboard hero band as viewport fractions at ≥ 1280 (01_specs §14.5.1 row 1, cols 4-12). */
export const HERO_BAND_INSET = 'inset(7.5% 0% 61% 34% round 12px)'

/** M-C-22 error shake: x keyframes over 300 ms, once (P7 allows one functional shake). */
export const SHAKE_KEYFRAMES = [0, -6, 6, -4, 4, 0]
export const SHAKE_MS = 300

/** M-C-22 Submitting: fingerprint arcs pulse 0.4 → 1, 150 ms apart, looping. */
export const SCAN_ARC_GAP_MS = 150
export const SCAN_PERIOD_MS = 900
/** M-C-22 Submitting: the button sheen loops every 1.4 s while pending. */
export const SHEEN_LOOP_MS = 1400

/** M-C-23 Particles on the brand side. */
export const PARTICLES = { quantity: 24, staticity: 60, ease: 80, size: 0.6 } as const
/** M-C-23 BorderBeam on the auth card: one lap. */
export const BORDER_BEAM = { size: 220, durationS: 6 } as const
/** Ambient slot shared by the page accents: Particles, the BorderBeam lap, the offline dot (§9.4). */
export const LOGIN_ACCENT_LOOP_GROUP = 'login-accents'

export function buildLoginChoreography(arrival: LoginArrival, reduced: boolean): LoginChoreography {
  if (reduced) {
    // §8: opacity only, ≤ fast, no stagger: everything arrives together.
    return {
      arrival,
      reduced,
      backdrop: { delayMs: 0, durationMs: 160 },
      ringDelayMs: 0,
      emblemDraw: null,
      bloomAtMs: null,
      overlineMs: 0,
      wordmarkMs: 0,
      taglineMs: 0,
      taglineLineGapMs: 0,
      ruleMs: 0,
      pillarsMs: 0,
      pillarGapMs: 0,
      stripMs: 0,
      cardMs: 0,
      beamDelayMs: 0,
      focusAtMs: 0,
      noticeMs: 0,
    }
  }
  if (arrival === 'return') {
    return {
      arrival,
      reduced,
      backdrop: { delayMs: 0, durationMs: 420 },
      ringDelayMs: 0,
      emblemDraw: null,
      bloomAtMs: null,
      overlineMs: 150,
      wordmarkMs: 180,
      taglineMs: 210,
      taglineLineGapMs: 60,
      ruleMs: 300,
      pillarsMs: 300,
      pillarGapMs: 60,
      stripMs: 250,
      cardMs: 300,
      beamDelayMs: 300,
      focusAtMs: 700,
      noticeMs: 600,
    }
  }
  return {
    arrival,
    reduced,
    backdrop: { delayMs: 0, durationMs: 900 },
    ringDelayMs: 200,
    emblemDraw: { startMs: 500, shieldMs: 500, arcStaggerMs: 70, arcMs: 240 },
    // Shield 500 + arcs (6th starts at 500 + 5 × 70) + 240 → the draw ends at 1,590.
    bloomAtMs: 1600,
    overlineMs: 900,
    wordmarkMs: 980,
    taglineMs: 1060,
    taglineLineGapMs: 120,
    ruleMs: 1300,
    pillarsMs: 1360,
    pillarGapMs: 120,
    stripMs: 1100,
    cardMs: 1200,
    beamDelayMs: 1200,
    focusAtMs: 1800,
    noticeMs: 1500,
  }
}
