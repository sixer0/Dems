// The transient meter path (04_mobile_specs §5.4; MA-16): 20 Hz audio frames land in Reanimated
// shared values with zero React renders; the debug overlay counts frames (D57); the accessible
// value updates at most once per second.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { drainMeterFrames, setMeterFrameCounting } from '@/motion/debug-metrics';
import { resetAuthPrefsForTests } from '@/auth';
import { resetCoreLinkPrefsForTests } from './core-link';
import { RuntimeTestProviders, createTestSim, flushAsync } from './testing/test-sim';
import {
  AUDIO_FLOOR_DBFS,
  audioAccessibilityValue,
  useAudioAccessibilityValue,
  useAudioSharedValues,
  type AudioSharedValues,
} from './use-audio-shared-values';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetAuthPrefsForTests();
});
afterEach(() => {
  setMeterFrameCounting(false);
  jest.useRealTimers();
});

describe('useAudioSharedValues', () => {
  it('copies every 20 Hz frame into shared values without re-rendering the owner', async () => {
    const { sim, advance } = createTestSim();
    let renders = 0;
    let values: AudioSharedValues | null = null;
    function Meter() {
      renders += 1;
      values = useAudioSharedValues('AUDIO-01');
      return <Text>meter</Text>;
    }
    render(
      <RuntimeTestProviders sim={sim}>
        <Meter />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    const rendersAfterMount = renders;
    expect(values!.level.value).toBe(sim.store.getState().audio.inputs['MIC-01'].dbfs); // fired on subscribe

    setMeterFrameCounting(true);
    act(() => {
      sim.actions.loadScenario('recording'); // people in the room: speech on both channels
      advance(2_000, 50); // 40 frames
    });
    expect(renders).toBe(rendersAfterMount);
    const frame = sim.store.getState().audio.inputs['MIC-01'];
    expect(values!.level.value).toBe(frame.dbfs);
    expect(values!.peak.value).toBe(frame.peak);
    expect(values!.level.value).toBeGreaterThan(AUDIO_FLOOR_DBFS);
    expect(drainMeterFrames(2_000)['AUDIO-01']).toBeGreaterThanOrEqual(19);

    act(() => sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-01' }));
    act(() => advance(100, 50));
    expect(values!.clip.value).toBe(1);
    act(() => sim.actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-02' }));
    expect(renders).toBe(rendersAfterMount);
  });

  // Task 4 row 171 (site M6; decision C18 (2)): the input of a channel is found by the lookup of row 164.
  it('task 4 row 171: a channel that LOSES its input (the selector no longer holds a complete pair) is put back to the empty state and reads no frame of MIC-01 / MIC-02', async () => {
    jest.useFakeTimers();
    const { sim, advance } = createTestSim();
    let renders = 0;
    let values: AudioSharedValues | null = null;
    let a11y = '';
    function Meter() {
      renders += 1;
      values = useAudioSharedValues('AUDIO-01');
      a11y = useAudioAccessibilityValue('AUDIO-01').text;
      return <Text>meter</Text>;
    }
    render(
      <RuntimeTestProviders sim={sim}>
        <Meter />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    act(() => {
      sim.actions.loadScenario('recording');
      advance(1_000, 50);
    });
    // The seeded, complete pair: the channel reads its input, as before.
    expect(values!.level.value).toBe(sim.store.getState().audio.inputs['MIC-01'].dbfs);
    expect(values!.level.value).toBeGreaterThan(AUDIO_FLOOR_DBFS);
    const rendersBefore = renders;

    // The selector keeps its PRIMARY line only (the open session's snapshot too): no meter channel has an input.
    act(() => {
      const state = sim.store.getState();
      const mics = state.captureConfig.mics.filter((line) => line.role === 'PRIMARY');
      sim.store.setState({
        captureConfig: { ...state.captureConfig, mics },
        session: state.session === null ? null : { ...state.session, captureConfig: state.session.captureConfig ? { ...state.session.captureConfig, mics } : state.session.captureConfig },
      } as never);
    });
    expect(values!.level.value).toBe(AUDIO_FLOOR_DBFS);
    expect(values!.peak.value).toBe(AUDIO_FLOOR_DBFS);
    expect(values!.clip.value).toBe(0);
    expect(values!.noSignal.value).toBe(0);
    // The meters slice still holds a frame under MIC-01 with a level: it is not read, now or on later ticks.
    expect(sim.store.getState().audio.inputs['MIC-01'].dbfs).toBeGreaterThan(AUDIO_FLOOR_DBFS);
    act(() => {
      advance(1_000, 50);
      jest.advanceTimersByTime(1_000);
    });
    expect(values!.level.value).toBe(AUDIO_FLOOR_DBFS);
    expect(a11y).toBe('-60 dBFS');
    // Change-only: the loss of the input is a write of shared values, never a render per frame (at most the 1 s readout).
    expect(renders).toBeLessThanOrEqual(rendersBefore + 1);
  });
});

describe('accessible meter value (01_specs §14.6)', () => {
  it('clamps to [-60, 0] whole dB and says so in text', () => {
    expect(audioAccessibilityValue(-18.4)).toEqual({ min: -60, max: 0, now: -18, text: '-18 dBFS' });
    expect(audioAccessibilityValue(-90)).toMatchObject({ now: -60 });
    expect(audioAccessibilityValue(0.4)).toMatchObject({ now: 0 });
    expect(audioAccessibilityValue(Number.NaN)).toMatchObject({ now: -60 });
    expect(audioAccessibilityValue(-90, 'No signal', true)).toMatchObject({ text: 'No signal' });
  });

  it('refreshes at most once per second', async () => {
    jest.useFakeTimers();
    const { sim, advance } = createTestSim();
    const seen: number[] = [];
    function A11y() {
      const value = useAudioAccessibilityValue('AUDIO-01');
      seen.push(value.now);
      return <Text>{value.text}</Text>;
    }
    render(
      <RuntimeTestProviders sim={sim}>
        <A11y />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    const before = seen.length;
    act(() => {
      sim.actions.loadScenario('recording');
      advance(900, 50); // 18 frames inside one second
      jest.advanceTimersByTime(900);
    });
    expect(seen.length).toBe(before); // no update before the 1 s tick
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(seen.length).toBeLessThanOrEqual(before + 1);
    expect(seen.at(-1)).toBe(audioAccessibilityValue(sim.store.getState().audio.inputs['MIC-01'].dbfs).now);
  });
});
