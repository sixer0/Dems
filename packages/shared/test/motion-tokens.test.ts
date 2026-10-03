// Motion tokens (01_specs §2.7; 03_motion_spec §2.1 and §2.3 NEW; SCR-07 shared with mobile, step 69).
import { describe, expect, it } from 'vitest';
import { motion, type SpringToken } from '../src/tokens/tokens';

/** ζ = c / (2·√(k·m)) */
function dampingRatio({ stiffness, damping, mass }: SpringToken): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

describe('motion.spring', () => {
  const springs = Object.entries(motion.spring) as [string, SpringToken][];

  it.each(springs)('%s is a plain { stiffness, damping, mass } object of finite positive numbers', (_name, spring) => {
    expect(Object.keys(spring).sort()).toEqual(['damping', 'mass', 'stiffness']);
    for (const key of ['stiffness', 'damping', 'mass'] as const) {
      expect(typeof spring[key]).toBe('number');
      expect(Number.isFinite(spring[key])).toBe(true);
      expect(spring[key]).toBeGreaterThan(0);
    }
  });

  it('carries the §2.1 and §2.3 NEW spring values exactly', () => {
    expect(motion.spring).toEqual({
      gentle: { stiffness: 170, damping: 26, mass: 1 },
      snappy: { stiffness: 420, damping: 34, mass: 0.9 },
      bouncy: { stiffness: 260, damping: 18, mass: 1 },
      counter: { stiffness: 90, damping: 20, mass: 1 },
      meter: { stiffness: 600, damping: 40, mass: 0.6 },
      indicator: { stiffness: 380, damping: 36, mass: 1 },
    });
  });

  it.each([
    ['gentle', 1.0],
    ['snappy', 0.87],
    ['bouncy', 0.56],
    ['counter', 1.05],
    ['indicator', 0.92],
  ] as const)('%s has the damping ratio the spec states (ζ ≈ %s)', (name, zeta) => {
    expect(Math.abs(dampingRatio(motion.spring[name]) - zeta)).toBeLessThanOrEqual(0.01);
  });
});

describe('03_motion_spec §2.3 NEW tokens', () => {
  it('distance (px)', () => {
    expect(motion.distance).toEqual({ riseSm: 6, rise: 12, riseLg: 24, hoverLift: 2, exitDrop: 8 });
  });

  it('scale', () => {
    expect(motion.scale).toEqual({ press: 0.98, hover: 1.01, enterFrom: 0.98, stampFrom: 1.2 });
  });

  it('blur (px)', () => {
    expect(motion.blur).toEqual({ focusIn: 6, mediaIn: 8 });
  });

  it('ambient periods (ms), with the rev-2 loops unchanged', () => {
    expect(motion.ambient).toEqual({
      glowBreath: 2400,
      recPulse: 1200,
      meterFrameMs: 50,
      ringRotate: 60000,
      kenBurns: 30000,
      topoDrift: 40000,
      sheen: 700,
      scanline: 6000,
      scanlineSweep: 1200,
      colonBreath: 1000,
      heartbeatPulse: 600,
    });
  });

  it('thresholds', () => {
    expect(motion.threshold).toEqual({
      flashMaxHz: 3,
      numberTextMaxHz: 4,
      ambientMaxPerViewport: 4,
      insertionMinGapMs: 400,
      staggerCap: 8,
    });
  });
});

describe('§2.1 tokens stay as first specified', () => {
  it('durations, easings, choreography and proof factor', () => {
    expect(motion.duration).toEqual({
      instant: 90,
      fast: 160,
      base: 240,
      slow: 420,
      slower: 640,
      beatIn: 180,
      beatOut: 720,
      ambient: 1200,
    });
    expect(motion.easing).toEqual({
      standard: [0.2, 0, 0, 1],
      luxe: [0.22, 1, 0.36, 1],
      emphasized: [0.16, 1, 0.3, 1],
      exit: [0.4, 0, 1, 1],
    });
    expect(motion.choreography).toEqual({ stagger: 60, delayChildren: 80 });
    expect(motion.proofSlowFactor).toBe(10);
  });
});

describe('motion tokens are plain, platform-neutral data', () => {
  it('every leaf is a finite number (worklet- and CSS-generator-safe)', () => {
    const leaves: unknown[] = [];
    const walk = (value: unknown): void => {
      if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
      else leaves.push(value);
    };
    walk(motion);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(typeof leaf).toBe('number');
      expect(Number.isFinite(leaf)).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(motion))).toEqual(motion);
  });
});

describe('the tokens respect the 03_motion_spec principles', () => {
  it('P1: entries move at most 24 px, hovers at most 4 px', () => {
    for (const rise of [motion.distance.riseSm, motion.distance.rise, motion.distance.riseLg]) {
      expect(rise).toBeLessThanOrEqual(24);
    }
    expect(motion.distance.hoverLift).toBeLessThanOrEqual(4);
  });

  it('P8: no ambient loop repeats faster than flashMaxHz', () => {
    const { meterFrameMs: _sampleRate, ...loops } = motion.ambient;
    for (const periodMs of Object.values(loops)) {
      expect(1000 / periodMs).toBeLessThanOrEqual(motion.threshold.flashMaxHz);
    }
  });
});
