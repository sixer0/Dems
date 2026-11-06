/**
 * The timer of the expiry sweep (plan row W24; spec §5.1 ID-P8; SR-11; RT-P13) moved to the core
 * (`src/core/sweeper.ts`, review finding W91-11): the pairing module runs on it too, and a
 * generic helper does not belong to one domain module. The identity module's index takes it
 * through this path; no other unit imports it from here.
 */
export { createSweeper, type Sweeper, type SweeperOptions } from '../../core';
