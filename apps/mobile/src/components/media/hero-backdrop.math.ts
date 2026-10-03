/**
 * HeroBackdrop maths (04_mobile_specs §8.1, §8.2): a deterministic placeholder topographic texture
 * until step 72 passes the shared `topo.svg` (SCR-06). Closed, gently warped contour rings around
 * a few seeded centres, in a 1000 × 1000 user space, drawn as quadratic curves through midpoints.
 */

export const TOPO_VIEWBOX = 1000;

/** mulberry32: small, fast, deterministic PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TopoOptions {
  seed?: number;
  centres?: number;
  rings?: number;
  samples?: number;
}

/** SVG path strings for the contour rings (centres × rings). */
export function topoContours({ seed = 20261001, centres = 3, rings = 6, samples = 64 }: TopoOptions = {}): string[] {
  const rand = seededRandom(seed);
  const out: string[] = [];
  for (let c = 0; c < centres; c += 1) {
    const cx = 150 + rand() * 700;
    const cy = 150 + rand() * 700;
    const base = 40 + rand() * 30;
    const step = 32 + rand() * 18;
    const phases = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
    for (let r = 0; r < rings; r += 1) {
      const radius = base + r * step;
      const wobble = 0.08 + 0.05 * (r / rings);
      const pts: [number, number][] = [];
      for (let i = 0; i < samples; i += 1) {
        const t = (i / samples) * Math.PI * 2;
        const k =
          1 +
          wobble * Math.sin(2 * t + phases[0]) +
          wobble * 0.6 * Math.sin(3 * t + phases[1] + r * 0.3) +
          wobble * 0.35 * Math.sin(5 * t + phases[2]);
        pts.push([cx + Math.cos(t) * radius * k * 1.25, cy + Math.sin(t) * radius * k]);
      }
      const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const first = mid(pts[samples - 1], pts[0]);
      let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
      for (let i = 0; i < samples; i += 1) {
        const p = pts[i];
        const m = mid(p, pts[(i + 1) % samples]);
        d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
      }
      out.push(`${d}Z`);
    }
  }
  return out;
}
