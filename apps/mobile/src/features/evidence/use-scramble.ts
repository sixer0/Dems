/**
 * Hash-verify scramble (04_mobile_specs §4.11 D5c; 03_motion_spec M-C-21): the shown hashes
 * scramble for 600 ms, revealing left to right, with at most 20 text updates (a 30 ms step), then
 * settle on the real values. Reduced motion: the final text at once.
 */
import { useEffect, useRef, useState } from 'react';

export const SCRAMBLE_MS = 600;
/** Text updates per pass, counting the first scrambled frame and the final text. */
export const SCRAMBLE_MAX_UPDATES = 20;
/** The final text lands at `SCRAMBLE_MS`: the first frame at 0, then 19 steps. */
export const SCRAMBLE_STEP_MS = SCRAMBLE_MS / (SCRAMBLE_MAX_UPDATES - 1);

const HEX = '0123456789abcdef';

/**
 * One scramble frame of `target` at `progress` (0 → 1): characters left of the reveal point are
 * final, the rest of the hex characters are random; other characters (`…`, spaces) stay put.
 */
export function scrambleFrame(target: string, progress: number, random: () => number = Math.random): string {
  const p = Math.min(1, Math.max(0, progress));
  const revealed = Math.floor(target.length * p);
  let out = '';
  for (let i = 0; i < target.length; i += 1) {
    const ch = target[i]!;
    out += i < revealed || !/[0-9a-f]/i.test(ch) ? ch : HEX[Math.floor(random() * HEX.length) % HEX.length]!;
  }
  return out;
}

/**
 * Scrambles `targets` while `running` is true (one pass of `SCRAMBLE_MS`), then calls `onDone` once.
 * Returns the texts to show: scrambled frames during the pass, the targets otherwise.
 */
export function useScramble(targets: readonly string[], running: boolean, reduced: boolean, onDone?: () => void): readonly string[] {
  const [frame, setFrame] = useState<readonly string[] | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  const key = targets.join('\u001f');

  useEffect(() => {
    if (!running) return undefined;
    const finals = key.length > 0 ? key.split('\u001f') : [];
    if (reduced) {
      const id = setTimeout(() => done.current?.(), 0);
      return () => clearTimeout(id);
    }
    // Update 1 is the first scrambled frame (at 0 ms), updates 2–19 follow every step, and update
    // 20 is the final text at SCRAMBLE_MS.
    let updates = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const step = () => {
      updates += 1;
      if (updates >= SCRAMBLE_MAX_UPDATES) {
        if (interval !== null) clearInterval(interval);
        setFrame(null);
        done.current?.();
        return;
      }
      setFrame(finals.map((text) => scrambleFrame(text, (updates - 1) / (SCRAMBLE_MAX_UPDATES - 1))));
    };
    const first = setTimeout(step, 0);
    interval = setInterval(step, SCRAMBLE_STEP_MS);
    return () => {
      clearTimeout(first);
      if (interval !== null) clearInterval(interval);
    };
  }, [running, reduced, key]);

  return running && frame !== null ? frame : targets;
}
