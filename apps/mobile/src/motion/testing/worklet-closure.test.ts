// `worklet-closure.ts` (fix wave J, JM-01): the reader of what the Worklets Babel plugin writes on a worklet.
// The plugin runs in Jest too, so the fixtures below are real worklets and real plain functions.
import { describe, expect, it } from '@jest/globals';
import { callsDirectly, exportedFunctionsOf, nonWorkletCallees } from './worklet-closure';

const plain = (value: number): number => value + 1;
function workletHelper(value: number): number {
  'worklet';
  return value + 1;
}
const handOver = (run: (value: number) => number, value: number): number => run(value);

/** The device's defect in small: a worklet that calls a plain function. */
const offending = (): number => {
  'worklet';
  return plain(1);
};
const clean = (): number => {
  'worklet';
  return workletHelper(1);
};
/** A plain function that is only handed on (as `scheduleOnRN(setState, value)` does) is not called here. */
const handsOn = (): number => {
  'worklet';
  return handOver(plain, 1);
};
/** A worklet that calls a worklet that calls a plain function. */
const nested = (): number => {
  'worklet';
  return offending() + 1;
};

describe('worklet-closure', () => {
  it('the plugin marks worklets and leaves plain functions alone (what the reader relies on)', () => {
    expect((workletHelper as { __workletHash?: number }).__workletHash).toEqual(expect.any(Number));
    expect((plain as { __workletHash?: number }).__workletHash).toBeUndefined();
    expect(Object.keys((offending as { __closure?: object }).__closure ?? {})).toContain('plain');
  });

  it('reports a worklet that CALLS a plain function, with the name of the callee', () => {
    expect(nonWorkletCallees(offending)).toEqual([expect.stringMatching(/ calls plain$/)]);
  });

  it('CONTROL: a worklet that calls only worklets is clean', () => {
    expect(nonWorkletCallees(clean)).toEqual([]);
  });

  it('a plain function that is handed on is reported only for the function that is really called', () => {
    // `handOver` is the call; `plain` is its argument.
    expect(nonWorkletCallees(handsOn)).toEqual([expect.stringMatching(/ calls handOver$/)]);
    expect(nonWorkletCallees(handsOn, new Set<unknown>([handOver]))).toEqual([]);
  });

  it('follows captured worklets: the plain call one level down is found', () => {
    expect(nonWorkletCallees(nested)).toEqual(['offending calls plain']);
  });

  it('a library entry point is allowed by identity, and nothing that is not a worklet is inspected', () => {
    expect(nonWorkletCallees(offending, new Set<unknown>([plain]))).toEqual([]);
    expect(nonWorkletCallees(plain)).toEqual([]);
    expect(nonWorkletCallees(null)).toEqual([]);
    expect(nonWorkletCallees({})).toEqual([]);
  });

  it('callsDirectly: a call, `.call(` and `.apply(` count; a mention, a member of another object and a longer name do not', () => {
    expect(callsDirectly('return scaleFor(a, b);', 'scaleFor')).toBe(true);
    expect(callsDirectly('return scaleFor.call(null, a);', 'scaleFor')).toBe(true);
    expect(callsDirectly('scheduleOnRN(setFlat, now);', 'setFlat')).toBe(false);
    expect(callsDirectly('return other.scaleFor(a);', 'scaleFor')).toBe(false);
    expect(callsDirectly('return myscaleFor(a);', 'scaleFor')).toBe(false);
    expect(callsDirectly('return $fn(a);', '$fn')).toBe(true);
  });

  it('exportedFunctionsOf: the functions of a module and of its namespaces, one level down', () => {
    const inner = (): number => 1;
    const outer = (): number => 2;
    const found = exportedFunctionsOf({ outer, Namespace: { inner }, text: 'x' }, null, 'not a module');
    expect(found.has(outer)).toBe(true);
    expect(found.has(inner)).toBe(true);
    expect(found.size).toBe(2);
  });
});
