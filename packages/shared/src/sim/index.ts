/**
 * `@dems/shared/sim`: the in-app simulator (D19; masterplan/01_specs.md §14.7; SCR-01/02).
 *
 * Exported ONLY through this subpath. The root barrel (`@dems/shared`) does not re-export
 * it, so mock-core never loads the simulator or React. Every module except `react.ts` is
 * framework-free; only `platform.ts` names web globals, and only behind guards.
 */
export * from './constants';
export * from './vocabulary';
export * from './types';
export * from './errors';
export * from './memo';
export * from './demo-alignment';
export * from './rng';
export * from './clock';
export * from './events';
export * from './evidence';
export * from './dataset';
export * from './auth';
export * from './platform';
export * from './initial-state';
export * from './store';
export * from './selectors';
export * from './devices';
export * from './views';
export * from './derive';
export * from './session-machine';
export * from './faults';
export * from './audio';
export * from './health';
export * from './generator';
export * from './maintenance';
export * from './evidence-actions';
export * from './pairing';
export * from './scenarios';
export * from './api';
export * from './actions';
export * from './engine';
export * from './react';
