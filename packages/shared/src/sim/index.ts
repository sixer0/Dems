/**
 * `@dems/shared/sim`: the in-app simulator (D19; masterplan/01_specs.md §14.7; SCR-01/02).
 *
 * Exported ONLY through this subpath. The root barrel (`@dems/shared`) does not re-export
 * it, so mock-core never loads the simulator or React. Every module except `react.ts` is
 * framework-free; only `platform.ts` names web globals, and only behind guards.
 *
 * Change rule (task 3 OD-23, blueprint row 51): **simulator changes only through blueprint rows.**
 * This RETIRES task 2's SC8 "simulator untouched / additions only" rule and its `acaff20` diff gate
 * (predecessor AC-B-59..62, DR-14). The simulator is now extended for schema v2 by named blueprint
 * rows; Simulated-mode behaviour is guarded by a regression against the new baseline `c2c983b` at M2
 * (M2-SIM-1) and M9 (M9-SIM-1), and the diff audit (M2-SIM-2) checks that every changed file under
 * `packages/shared/src/sim/` is owned by a blueprint row — not that the folder is frozen.
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
export * from './capture-telemetry';
export * from './capture-session';
export * from './capture-fault-wording';
export * from './capture-registry';
export * from './capture-notices';
export * from './capture-config';
export * from './core-facts';
export * from './core-not-running';
export * from './start-refused';
export * from './health';
export * from './generator';
export * from './maintenance';
export * from './evidence-actions';
export * from './seal-unsealable';
export * from './seal-blocked';
export * from './selector-in-force';
export * from './pairing';
export * from './scenarios';
export * from './api';
export * from './actions';
export * from './engine';
export * from './react';
