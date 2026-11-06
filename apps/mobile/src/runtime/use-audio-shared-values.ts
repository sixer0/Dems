/**
 * The transient meter path (04_mobile_specs §5.4; MA-16; S3): zero React renders per audio frame.
 *
 * The simulator ticks audio at 20 Hz on the JS thread (`meterFrameMs` 50). Each frame only assigns
 * Reanimated shared values; the C-2 `DbfsMeter` (step 71) smooths, holds the peak and draws on the
 * UI thread. `useAudioChannel` (shared, step 31) is a store subscription with the latest callback in
 * a ref, so frames never re-render the component that owns these values. This module is the only
 * place in the app that calls `useAudioChannel` (the MA-16 grep checks that it stays in
 * `src/runtime/`).
 *
 * Each frame also calls `reportMeterFrame(channel)` for the `?debug=1` overlay (step 69, D57); that
 * costs one boolean check while the overlay is off.
 *
 * Accessibility (01_specs §14.6): `useAudioAccessibilityValue` updates `{ min: -60, max: 0, now,
 * text }` at most once per second from JS, never per frame.
 */
import { micLinesInForce } from '@/features/capture-selector/selector-in-force';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { AudioTrackId } from '@dems/shared/domain';
import { meterInputOfChannel, useAudioChannel, useSimInstance, type AudioFrame } from '@dems/shared/sim';
import { reportMeterFrame } from '@/motion/debug-metrics';

/** Level of a silent or absent channel (the simulator's floor, SCR-01). */
export const AUDIO_FLOOR_DBFS = -90;
/** The meter's accessible range (01_specs §14.6). */
export const AUDIO_A11Y_MIN = -60;
export const AUDIO_A11Y_MAX = 0;
export const AUDIO_A11Y_INTERVAL_MS = 1000;

export interface AudioSharedValues {
  /** Ballistic level, dBFS in [-90, 0]. */
  readonly level: SharedValue<number>;
  /** Peak hold, dBFS in [-90, 0]. */
  readonly peak: SharedValue<number>;
  /** CLIP latch: 1 while latched, else 0. */
  readonly clip: SharedValue<number>;
  /** NO SIGNAL: 1 while the channel is flat, else 0. */
  readonly noSignal: SharedValue<number>;
}

/** Copies one frame into the shared values (plain numbers only; no allocation). */
export function writeAudioFrame(values: AudioSharedValues, frame: AudioFrame): void {
  values.level.value = frame.dbfs;
  values.peak.value = frame.peak;
  values.clip.value = frame.clip ? 1 : 0;
  values.noSignal.value = frame.noSignal ? 1 : 0;
}

/**
 * The values of a channel that has NO input: what a meter holds before its first frame (the floor,
 * no clip, no flag). Task 4 row 171 (site M6): the empty state of the meter.
 */
export function clearAudioValues(values: AudioSharedValues): void {
  values.level.value = AUDIO_FLOOR_DBFS;
  values.peak.value = AUDIO_FLOOR_DBFS;
  values.clip.value = 0;
  values.noSignal.value = 0;
}

/**
 * Shared values for one channel, fed at 20 Hz by the simulator. Must sit under `SimRuntimeProvider`.
 *
 * Task 4 row 171 (site M6; decision C18 (2)): a channel whose input is ABSENT (`meterInputOfChannel`
 * answers `null`: the selector in force holds no complete microphone pair) gets no frame - the
 * shared `useAudioChannel` calls nothing for it. So that a meter does not keep the last level of an
 * input the selector no longer holds, the values are put back to their empty state when the channel
 * loses its input. A change-only store subscription (a boolean), never a render and never per
 * frame; on a complete pair it writes nothing.
 */
export function useAudioSharedValues(channel: AudioTrackId): AudioSharedValues {
  const sim = useSimInstance();
  const level = useSharedValue(AUDIO_FLOOR_DBFS);
  const peak = useSharedValue(AUDIO_FLOOR_DBFS);
  const clip = useSharedValue(0);
  const noSignal = useSharedValue(0);
  const values = useMemo<AudioSharedValues>(() => ({ level, peak, clip, noSignal }), [level, peak, clip, noSignal]);

  const onFrame = useCallback(
    (frame: AudioFrame) => {
      writeAudioFrame(values, frame);
      reportMeterFrame(channel);
    },
    [values, channel],
  );
  useAudioChannel(channel, onFrame);

  useEffect(
    () =>
      sim.store.subscribe(
        (state) => meterInputOfChannel(micLinesInForce(state), channel) === null,
        (absent) => {
          if (absent) clearAudioValues(values);
        },
        { fireImmediately: true },
      ),
    [sim, channel, values],
  );

  return values;
}

export interface AudioAccessibilityValue {
  readonly min: number;
  readonly max: number;
  readonly now: number;
  readonly text: string;
}

/** The accessible meter value: clamped to [-60, 0] dBFS, whole dB (pure). */
export function audioAccessibilityValue(dbfs: number, noSignalText?: string, noSignal = false): AudioAccessibilityValue {
  const now = Math.round(Math.min(AUDIO_A11Y_MAX, Math.max(AUDIO_A11Y_MIN, Number.isFinite(dbfs) ? dbfs : AUDIO_A11Y_MIN)));
  const text = noSignal && noSignalText ? noSignalText : `${now} dBFS`;
  return { min: AUDIO_A11Y_MIN, max: AUDIO_A11Y_MAX, now, text };
}

/**
 * `accessibilityValue` for a meter, refreshed at most every `intervalMs` (default 1 s) from JS.
 * Re-renders the caller only when the rounded value or the no-signal flag changes.
 */
export function useAudioAccessibilityValue(
  channel: AudioTrackId,
  options: { noSignalText?: string; intervalMs?: number } = {},
): AudioAccessibilityValue {
  const sim = useSimInstance();
  const { noSignalText, intervalMs = AUDIO_A11Y_INTERVAL_MS } = options;
  const read = useCallback(() => {
    // The meters slice is keyed by mic input since schema v2 (SH-17); the channel maps to the microphone
    // line at its position in the capture configuration (ruling D137), the input `useAudioChannel` reads.
    // Task 4 row 171: by the lookup of row 164 - a channel without an input has NO frame (the floor is
    // read, as for an input that has delivered none), never the frame of `MIC-01` / `MIC-02`.
    const state = sim.store.getState();
    const input = meterInputOfChannel(micLinesInForce(state), channel);
    const frame = input === null ? undefined : state.audio.inputs[input];
    return audioAccessibilityValue(frame?.dbfs ?? AUDIO_FLOOR_DBFS, noSignalText, frame?.noSignal ?? false);
  }, [sim, channel, noSignalText]);
  const [value, setValue] = useState(read);

  useEffect(() => {
    // The first value came from `useState(read)`; a changed channel shows within one interval.
    const timer = setInterval(() => {
      const next = read();
      setValue((current) => (current.now === next.now && current.text === next.text ? current : next));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [read, intervalMs]);

  return value;
}
