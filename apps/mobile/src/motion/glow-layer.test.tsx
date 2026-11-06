// GlowLayer (04_mobile_specs §4.0 recipe; 03_motion_spec §2.2, §9.2): glow changes by cross-fading
// pre-rendered layers' opacity, never by animating a shadow.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { elevation } from '@dems/shared/tokens';
import { GlowLayer, glowShadow, layerOpacities } from './glow-layer';
import { activeLoopNames, resetLoopRegistryForTests } from './loops';
import { resetMotionStateForTests } from './policy';

const HIDDEN = { includeHiddenElements: true } as const;

function opacityOf(level: 1 | 2 | 3): number {
  return (getAnimatedStyle(screen.getByTestId(`g-e${level}`, HIDDEN)) as { opacity: number }).opacity;
}

function run(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('glowShadow', () => {
  it('uses the elevation tokens unchanged by default', () => {
    expect(glowShadow(1)).toBe(elevation[1]);
    expect(glowShadow(2)).toBe(elevation[2]);
    expect(glowShadow(3)).toBe(elevation[3]);
  });

  it('recolours a level to a tone and keeps the token geometry and alphas', () => {
    expect(glowShadow(2, 'danger')).toBe('0 0 0 1px #EF444480, 0 0 20px 0 #EF444438');
    expect(glowShadow(3, 'success')).toBe('0 0 0 1.5px #22C55EA6, 0 0 28px 2px #22C55E59');
  });

  it('turns exactly one layer on per level', () => {
    expect(layerOpacities(0)).toEqual({ 1: 0, 2: 0, 3: 0 });
    expect(layerOpacities(2)).toEqual({ 1: 0, 2: 1, 3: 0 });
  });
});

describe('GlowLayer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMotionStateForTests();
    resetLoopRegistryForTests();
  });
  afterEach(() => {
    cleanup();
    // Drop (not run) the unmounted components' queued frame work, then leave the fake clock.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('pre-renders one static shadow per level behind the host and ignores touches', () => {
    render(<GlowLayer level={1} radius={12} testID="g" />);
    const root = screen.getByTestId('g', HIDDEN);
    expect(root.props.pointerEvents).toBe('none');
    for (const n of [1, 2, 3] as const) {
      const style = StyleSheet.flatten(screen.getByTestId(`g-e${n}`, HIDDEN).props.style);
      expect(style).toMatchObject({ boxShadow: elevation[n], borderRadius: 12, position: 'absolute' });
    }
    expect([opacityOf(1), opacityOf(2), opacityOf(3)]).toEqual([1, 0, 0]);
  });

  it('cross-fades opacity between levels over `base` (240 ms)', () => {
    const { rerender } = render(<GlowLayer level={2} testID="g" />);
    rerender(<GlowLayer level={3} testID="g" />);
    run(100);
    expect(opacityOf(2)).toBeGreaterThan(0);
    expect(opacityOf(2)).toBeLessThan(1);
    expect(opacityOf(3)).toBeGreaterThan(0);
    run(300);
    expect([opacityOf(1), opacityOf(2), opacityOf(3)]).toEqual([0, 0, 1]);
  });

  it('switches levels instantly under reduced motion', () => {
    resetMotionStateForTests({ reduceMotionOverride: true });
    const { rerender } = render(<GlowLayer level={2} testID="g" />);
    rerender(<GlowLayer level={3} testID="g" />);
    run(20);
    expect([opacityOf(1), opacityOf(2), opacityOf(3)]).toEqual([0, 0, 1]);
  });

  it('breathes e2 ↔ e3 as a registered ambient loop', () => {
    render(<GlowLayer level={3} breathe testID="g" />);
    expect(activeLoopNames()).toEqual(['glow-breath']);
    run(600);
    const rising = opacityOf(3);
    run(600);
    const peak = opacityOf(3);
    expect(rising).toBeGreaterThan(0);
    expect(peak).toBeGreaterThan(rising);
    expect(opacityOf(2)).toBe(1);
  });

  it('holds a static e2 without a loop under reduced motion', () => {
    resetMotionStateForTests({ osReduceMotion: true });
    render(<GlowLayer level={3} breathe testID="g" />);
    expect(activeLoopNames()).toEqual([]);
    run(1200);
    expect([opacityOf(2), opacityOf(3)]).toEqual([1, 0]);
  });

  it('plays one escalation pulse per pulseKey change, never on mount, none when reduced', () => {
    const { rerender } = render(<GlowLayer level={1} pulseKey={0} testID="g" />);
    run(400);
    expect(opacityOf(3)).toBe(0);
    rerender(<GlowLayer level={1} pulseKey={1} testID="g" />);
    run(300);
    expect(opacityOf(3)).toBeGreaterThan(0.5);
    run(400);
    expect(opacityOf(3)).toBe(0);

    rerender(<GlowLayer level={1} pulseKey={2} motion="reduced" testID="g" />);
    run(300);
    expect(opacityOf(3)).toBe(0);
  });
});
