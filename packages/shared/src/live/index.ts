/**
 * `@dems/shared/live`: the light Live API (HB-15; backend task 04_client_integration_spec §2;
 * plan row W18). Feature files import it statically, in both data modes.
 *
 * It holds types, hooks, `settle`, the mode helpers, the error classes and the display timings
 * of Live mode, and NO transport:
 * the Live source itself (`createLiveSim`, with the typed client and the live channel) is the
 * heavy module `@dems/shared/live/source`, which a client loads only behind its build gate
 * (MD-6). Only `hooks.ts` imports React; the other files are framework-free.
 */
export * from './constants';
export * from './core-actions';
export * from './settle';
export * from './errors';
export * from './mode';
export * from './hooks';
