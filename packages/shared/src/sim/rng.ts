/**
 * Seeded PRNG (masterplan/01_specs.md §14.7 `rng.ts`): mulberry32 plus helpers.
 *
 * One stream per subsystem, derived from `seed` plus a salt (the stream name) plus the
 * hydration `epoch`, so adding a subsystem never shifts another subsystem's sequence, and a
 * reloaded store does not replay the numbers it already used.
 */

/** mulberry32: a 32-bit state, period 2^32; fast and deterministic across JS engines. */
export function mulberry32(seed: number): { next: () => number; state: () => number } {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => a,
  };
}

/** FNV-1a (32-bit) over the UTF-16 code units of `text`. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Seed for one stream: mixes the root seed, the salt and the epoch (murmur3 finaliser). */
export function deriveSeed(seed: number, salt: string, epoch = 0): number {
  let h = (seed >>> 0) ^ fnv1a(salt) ^ Math.imul(epoch >>> 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Normal deviate (Box-Muller, two draws). */
  gauss(mean?: number, sd?: number): number;
  /** Poisson count with mean `lambda` (Knuth; fine for the small means the engine uses). */
  poisson(lambda: number): number;
  /** Exponential inter-arrival time with the given mean (Poisson process gaps). */
  exponential(mean: number): number;
  /** `length` lowercase hex digits. */
  hex(length: number): string;
  /** The generator's internal 32-bit state (for diagnostics). */
  state(): number;
}

export function createRng(seed: number): Rng {
  const core = mulberry32(seed);
  const next = core.next;
  const rng: Rng = {
    next,
    int(min, max) {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new RangeError('Rng.pick needs a non-empty array.');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    gauss(mean = 0, sd = 1) {
      // 1 - next() is in (0, 1], so the log is finite.
      const u1 = 1 - next();
      const u2 = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    poisson(lambda) {
      if (lambda <= 0) return 0;
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k += 1;
        p *= next();
      } while (p > limit);
      return k - 1;
    },
    exponential(mean) {
      return -Math.log(1 - next()) * mean;
    },
    hex(length) {
      let out = '';
      while (out.length < length) {
        out += Math.floor(next() * 0x100000000)
          .toString(16)
          .padStart(8, '0');
      }
      return out.slice(0, length);
    },
    state: core.state,
  };
  return rng;
}

/** Stream names used by the engine. Any other string is a valid salt, too. */
export const RngStream = {
  DATASET: 'dataset',
  IDS: 'ids',
  SESSION: 'session',
  PRECHECK: 'precheck',
  FINALIZATION: 'finalization',
  AUDIO_1: 'audio:AUDIO-01',
  AUDIO_2: 'audio:AUDIO-02',
  HEALTH: 'health',
  EVENTS: 'events',
  EVIDENCE: 'evidence',
  FAULTS: 'faults',
  DIAGNOSTICS: 'diagnostics',
  PAIRING: 'pairing',
} as const;

export interface RngStreams {
  readonly seed: number;
  readonly epoch: number;
  /** The stream for `name`, created on first use. */
  get(name: string): Rng;
  /** Drops every stream and re-derives them for a new epoch (after hydration). */
  reseed(epoch: number): void;
}

export function createRngStreams(seed: number, epoch = 0): RngStreams {
  const streams = new Map<string, Rng>();
  let currentEpoch = epoch;
  return {
    seed,
    get epoch() {
      return currentEpoch;
    },
    get(name) {
      let stream = streams.get(name);
      if (!stream) {
        stream = createRng(deriveSeed(seed, name, currentEpoch));
        streams.set(name, stream);
      }
      return stream;
    },
    reseed(nextEpoch) {
      currentEpoch = nextEpoch;
      streams.clear();
    },
  };
}
