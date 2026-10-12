/**
 * Login choreography (04_mobile_specs §7.2, §7.3 Login; 03M M-PG-LOGIN, M-APP-01, M-APP-02).
 *
 * Two entrances, chosen once at mount:
 * - `enter` (M-PG-LOGIN): 0 backdrop fade-up (900, `luxe`) + Ken Burns; 200 ring layers sweep;
 *   500 emblem scan and bloom (strokes draw, M-APP-03 order); 900 wordmark rack focus (opacity +
 *   scale 0.98 → 1, no blur on mobile); 1,000 caption; 1,200 card rises 12 dp (`gentle`) and the
 *   border beam starts its one lap; the Username field takes focus once the card settles.
 * - `return` (M-APP-02, after a sign-out; ≤ 900 ms): the emblem scales up from the header
 *   position, the ring sweeps, the card rises, and the "signed out" Alert enters last.
 *
 * Proof mode (`?motion=slow`) stretches every beat ×10 (`durationMs`); reduced motion shows every
 * part with one ≤ 160 ms opacity fade and no rise, flight or beam (03M §8, 04 §7.7).
 *
 * Plus the in-place moments of M-C-22 and M-APP-01: `shake()` (one card shake on an error),
 * `exit()` (the card leaves when the sign-in succeeds, before the guard swaps the route).
 *
 * ## React holds the end of the entrance (closing-fix row CF2-A, defect RF-PH-4)
 *
 * After an idle sign-out under load the phone showed Login as the emblem ring ALONE on black for at
 * least 3 min (no backdrop, wordmark, caption, card or Core line) until a relaunch; the other time the
 * full Login with the "Session expired" dialog. Exactly the parts whose opacity lives only in a
 * Reanimated shared value were missing; React holds the value they were mounted with: 0. It is the
 * lost-update family of D214 (the timer digits): the screen mounted while the JS thread was stalled
 * (an 8 s `getAuthSession` time-out logged 10 s late), Reanimated's direct updates of views not yet
 * mounted fail (`Unable to find SurfaceMountingManager for tag`, 17,211 of them in the re-test), and
 * the settled values it hands back to React are dropped after 2 s. Nothing on Login re-renders by
 * itself, so nothing ever drew the end of the fades.
 *
 * So once the entrance is over (`entranceEndMs`, on a plain timer that runs whenever the thread does),
 * every part is drawn from a style whose React value IS its resting value (opacity 1, no rise, no
 * flight); the shake and the exit stay animated on top of it. Whatever Reanimated keeps or drops, the
 * next commit draws a usable Login.
 *
 * Fix wave J (JM-01 d): "a style whose React value is its resting value" was not true of the four `...Rest`
 * animated styles below. Reanimated hands an animated style's first value to React only in the FIRST render of
 * a view (`AnimatedComponent`, `_isFirstRender`); a style swapped in later reaches the view through the UI
 * runtime alone. On a process whose animation runtime had stopped (one worklet error, see
 * `@/motion/ui-runtime-watch`) the swap drew nothing: the Login stayed without wordmark, caption and card.
 * So the resting picture is now PLAIN styles (`WORDMARK_REST` ...). The animated ones are layered in only
 * while a shake or the exit plays (`acting`); if that motion is lost the card merely does not shake.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { motion } from '@dems/shared/tokens';
import {
  animateAfter,
  animateFade,
  animateShake,
  animateSpring,
  animateTiming,
  durationMs,
  type MotionSettings,
} from '@/motion';

export type LoginEntrance = 'enter' | 'return';

/** Beat starts in ms from route enter (§7.3 Login; M-APP-02 for `return`). `null` = no beat. */
export const LOGIN_BEATS = {
  enter: { backdrop: 0, ring: 200, emblem: 500, wordmark: 900, caption: 1000, card: 1200, beam: 1200, alert: 1300 },
  return: { backdrop: 0, ring: 0, emblem: 0, wordmark: 150, caption: 200, card: 250, beam: null, alert: 600 },
} as const satisfies Record<LoginEntrance, Record<string, number | null>>;

/** Backdrop fade-up (900, `luxe`); compressed to 300 for `return`. */
export const BACKDROP_FADE_MS = { enter: 900, return: 300 } as const;
/** Wordmark rack focus and caption fade (`slow`, 420). */
export const TEXT_FADE_MS = motion.duration.slow;
/** Card fade (the rise itself is the `gentle` spring). */
export const CARD_FADE_MS = 300;
/** The `gentle` spring settles in ≈ 400 ms; focus follows it (M-PG-LOGIN "once the card settles"). */
export const CARD_SETTLE_MS = 450;
/** M-APP-01: the card leaves over 300 ms (`exit`), scaling to 0.96 and dropping 8 dp. */
export const CARD_EXIT_MS = 300;
/** M-APP-02: the emblem starts at the header logo size (≈ 0.26 of its login size). */
export const RETURN_EMBLEM_SCALE = 0.26;
/** Reduced motion: every part fades in once (≤ 160 ms, `animateFade`). */
const REDUCED_ENTRANCE_MS = 160;
/** Extra time after the last beat before React takes over the resting values (CF2-A, RF-PH-4). */
export const ENTRANCE_REST_MARGIN_MS = 250;

/**
 * When the entrance is over and the resting values are drawn by React (CF2-A, RF-PH-4): the last of the
 * backdrop fade, the text fades and the card settle (and, for `return`, the emblem's flight), plus a margin.
 */
export function entranceEndMs(entrance: LoginEntrance, settings: MotionSettings): number {
  if (settings.policy === 'reduced') return REDUCED_ENTRANCE_MS + ENTRANCE_REST_MARGIN_MS;
  const beats = LOGIN_BEATS[entrance];
  const last = Math.max(
    beats.backdrop + BACKDROP_FADE_MS[entrance],
    beats.wordmark + TEXT_FADE_MS,
    beats.caption + TEXT_FADE_MS,
    beats.card + CARD_SETTLE_MS,
    // M-APP-02: the emblem's `gentle` flight starts once its slot is measured (about the card's settle).
    entrance === 'return' ? beats.card + 2 * CARD_SETTLE_MS : 0,
  );
  return durationMs(last, settings) + ENTRANCE_REST_MARGIN_MS;
}

/** The resting picture of the parts that only fade, rise or fly in: drawn by React (no shared value). */
const BACKDROP_REST = { opacity: 1 } as const;
const EMBLEM_REST = { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
const WORDMARK_REST = { opacity: 1, transform: [{ scale: 1 }] };
const CAPTION_REST = { opacity: 1 } as const;
const CARD_REST = { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
const COMPANION_REST = { opacity: 1, transform: [{ translateY: 0 }] };
/** M-C-22: the shake lasts 300 ms; the plain resting styles return this long after it started. */
export const SHAKE_ACT_MS = 300 + ENTRANCE_REST_MARGIN_MS;

export interface EmblemOrigin {
  /** Offset from the emblem's resting centre to the header logo slot, dp. */
  readonly dx: number;
  readonly dy: number;
}

export function useLoginChoreography(entrance: LoginEntrance, settings: MotionSettings) {
  // The entrance plays once, with the settings of the first render.
  const [initial] = useState(() => ({ entrance, settings }));
  const reduced = initial.settings.policy === 'reduced';
  const beats = LOGIN_BEATS[initial.entrance];

  const backdrop = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const caption = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardRise = useSharedValue(0);
  const exit = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const emblemFlight = useSharedValue(initial.entrance === 'return' && !reduced ? 0 : 1);
  const origin = useSharedValue<EmblemOrigin>({ dx: 0, dy: 0 });

  const [emblemReady, setEmblemReady] = useState(reduced || beats.emblem === 0);
  const [cardSettled, setCardSettled] = useState(reduced);
  const [beamActive, setBeamActive] = useState(!reduced && beats.beam !== null);
  // CF2-A (RF-PH-4): from here on React draws the resting values (header of this file).
  const [entranceOver, setEntranceOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEntranceOver(true), entranceEndMs(initial.entrance, initial.settings));
    return () => clearTimeout(timer);
  }, [initial]);

  useEffect(() => {
    const m = initial.settings;
    const fadeIn = (delay: number, ms: number) =>
      reduced ? animateFade(1, m) : animateAfter(delay, animateTiming(1, ms, 'luxe', m), m);

    backdrop.set(fadeIn(beats.backdrop, BACKDROP_FADE_MS[initial.entrance]));
    wordmark.set(fadeIn(beats.wordmark, TEXT_FADE_MS));
    caption.set(fadeIn(beats.caption, TEXT_FADE_MS));
    cardOpacity.set(fadeIn(beats.card, CARD_FADE_MS));
    cardRise.set(reduced ? 1 : animateAfter(beats.card, animateSpring(1, 'gentle', m), m));

    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduced) {
      if (beats.emblem > 0) timers.push(setTimeout(() => setEmblemReady(true), durationMs(beats.emblem, m)));
      timers.push(setTimeout(() => setCardSettled(true), durationMs(beats.card + CARD_SETTLE_MS, m)));
    }
    return () => timers.forEach(clearTimeout);
  }, [initial, reduced, beats, backdrop, wordmark, caption, cardOpacity, cardRise]);

  /** M-APP-02: fly the emblem in from the header slot once its resting place is measured. */
  const flyEmblemFrom = useCallback(
    (from: EmblemOrigin) => {
      if (initial.entrance !== 'return' || reduced) return;
      origin.set(from);
      emblemFlight.set(0);
      emblemFlight.set(animateSpring(1, 'gentle', initial.settings));
    },
    [initial, reduced, origin, emblemFlight],
  );

  // JM-01 d: the animated resting styles are in use only while a shake or the exit plays.
  const [acting, setActing] = useState<'shake' | 'exit' | null>(null);
  const [shakeRun, setShakeRun] = useState(0);
  useEffect(() => {
    if (acting !== 'shake') return undefined;
    const timer = setTimeout(() => setActing((now) => (now === 'shake' ? null : now)), durationMs(SHAKE_ACT_MS, initial.settings));
    return () => clearTimeout(timer);
  }, [acting, shakeRun, initial]);

  /** M-C-22: one card shake (300 ms, never looping); reduced motion shows the red border only. */
  const shake = useCallback(() => {
    setActing((now) => now ?? 'shake');
    setShakeRun((n) => n + 1);
    shakeX.set(animateShake(initial.settings));
  }, [initial, shakeX]);

  /** M-APP-01 (Login half): the card leaves; the brand text fades 150 ms later. */
  const leave = useCallback(() => {
    setActing('exit');
    exit.set(animateTiming(1, CARD_EXIT_MS, 'exit', initial.settings));
  }, [initial, exit]);

  const endBeam = useCallback(() => setBeamActive(false), []);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const wordmarkStyle = useAnimatedStyle(() => {
    const v = wordmark.get();
    return {
      opacity: v * (1 - exit.get()),
      transform: [{ scale: motion.scale.enterFrom + (1 - motion.scale.enterFrom) * v }],
    };
  });
  const captionStyle = useAnimatedStyle(() => ({ opacity: caption.get() * (1 - exit.get()) }));
  const cardStyle = useAnimatedStyle(() => {
    const out = exit.get();
    return {
      opacity: cardOpacity.get() * (1 - out),
      transform: [
        { translateX: shakeX.get() },
        { translateY: motion.distance.rise * (1 - cardRise.get()) + motion.distance.exitDrop * out },
        { scale: 1 - 0.04 * out },
      ],
    };
  });
  /** Demo operators, trust line and version enter with the card (no shake, no scale). */
  const companionStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get() * (1 - exit.get()),
    transform: [{ translateY: motion.distance.rise * (1 - cardRise.get()) }],
  }));
  const emblemStyle = useAnimatedStyle(() => {
    const f = emblemFlight.get();
    const o = origin.get();
    return {
      transform: [
        { translateX: o.dx * (1 - f) },
        { translateY: o.dy * (1 - f) },
        { scale: RETURN_EMBLEM_SCALE + (1 - RETURN_EMBLEM_SCALE) * f },
      ],
    };
  });

  // CF2-A (RF-PH-4) + JM-01 d: after the entrance the resting picture is the PLAIN styles above. These four
  // animated ones carry the exit and the shake, and are used only while one of the two plays (`acting`).
  const wordmarkRest = useAnimatedStyle(() => ({ opacity: 1 - exit.get(), transform: [{ scale: 1 }] }));
  const captionRest = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const cardRest = useAnimatedStyle(() => {
    const out = exit.get();
    return {
      opacity: 1 - out,
      transform: [{ translateX: shakeX.get() }, { translateY: motion.distance.exitDrop * out }, { scale: 1 - 0.04 * out }],
    };
  });
  const companionRest = useAnimatedStyle(() => ({ opacity: 1 - exit.get(), transform: [{ translateY: 0 }] }));

  return {
    reduced,
    entrance: initial.entrance,
    /** True once the entrance is over and React draws the resting values (CF2-A, RF-PH-4). */
    entranceOver,
    /** GlowRing `sweepDelayMs` (the ring scales its own beats; proof mode is applied here). */
    ringDelayMs: reduced ? 0 : durationMs(beats.ring, initial.settings),
    /** Delay of the L9 Alert's entering animation. */
    alertDelayMs: reduced ? 0 : durationMs(beats.alert, initial.settings),
    beamDelayMs: beats.beam ?? 0,
    emblemReady,
    cardSettled,
    beamActive,
    endBeam,
    flyEmblemFrom,
    shake,
    leave,
    backdropStyle: entranceOver ? BACKDROP_REST : backdropStyle,
    wordmarkStyle: !entranceOver ? wordmarkStyle : acting ? wordmarkRest : WORDMARK_REST,
    captionStyle: !entranceOver ? captionStyle : acting ? captionRest : CAPTION_REST,
    cardStyle: !entranceOver ? cardStyle : acting ? cardRest : CARD_REST,
    companionStyle: !entranceOver ? companionStyle : acting ? companionRest : COMPANION_REST,
    emblemStyle: entranceOver ? EMBLEM_REST : emblemStyle,
  };
}
