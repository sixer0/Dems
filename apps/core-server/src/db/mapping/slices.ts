/**
 * Which slices of the simulator state are durable, and where each lives (plan row W20; database
 * contract §3.2; spec §3.1, §3.2).
 *
 * The simulator state has 35 slices (`packages/shared/src/sim/types.ts`, `SimState`). The
 * mapping covers 30 of them:
 *
 *   stored (15)     written with the unit of work that changed them, one or more tables each;
 *   snapshot (15)   simulated-hardware state, one column each of the one-row `hardware_snapshot`.
 *
 * Five slices are NOT mapped, each for a reason the specification gives:
 *
 *   clock        engine-held: it is the server clock, rebuilt at start (class E);
 *   audio        streamed only: 20 Hz meter frames are never written (class X, Q4);
 *   authLockout  server memory: the lockout counters live in the server's own limiter (class M);
 *   auth         server-native: a sign-in is a row of `auth_sessions`, written by the identity
 *                module. The engine's `auth` slice is only the actor scope of one command;
 *   pairing      server-native: devices and codes are the pairing module's four tables. One
 *                member is stored: the Core's certificate fingerprint, a column of `core_device`.
 *
 * The 30 mapped slices are exactly the slices the realtime `state` topic replicates (spec §3.2;
 * register SH-16 joined `captureConfig` and `captureDevices` to them in task 3 M2).
 */
import type { SimState } from '@dems/shared/sim';

/** Class S: records. */
export const STORED_SLICE_KEYS = [
  'meta',
  'device',
  'operators',
  'session',
  'lastSealedSessionId',
  'lastSealedAcknowledged',
  'sessionHistory',
  'storagePolicy',
  'evidence',
  'events',
  'alerts',
  'audit',
  'settings',
  // Schema v2 (register SH-16; D44 R5): the device selector and the capture-device registry are
  // replicated slices with their own KEPT tables; the engine holds them and the mapping persists
  // them (dbc-3 §B.1/§B.2). Their runtime members are derived, see rows.ts.
  'captureConfig',
  'captureDevices',
] as const satisfies readonly (keyof SimState)[];

/** Class SN: one column each of `hardware_snapshot`, in the column order of the table. */
export const SNAPSHOT_SLICE_KEYS = [
  'tabletLink',
  'activeCameraId',
  'cameras',
  'mics',
  'storage',
  'time',
  'network',
  'security',
  'services',
  'health',
  'otherDevices',
  'ports',
  'faults',
  'diagnostics',
  'update',
] as const satisfies readonly (keyof SimState)[];

export const DURABLE_SLICE_KEYS = [...STORED_SLICE_KEYS, ...SNAPSHOT_SLICE_KEYS] as const;

export type StoredSliceKey = (typeof STORED_SLICE_KEYS)[number];
export type SnapshotSliceKey = (typeof SNAPSHOT_SLICE_KEYS)[number];
export type DurableSliceKey = (typeof DURABLE_SLICE_KEYS)[number];

/** The slices the mapping does not store, with the class of spec §3.1 and the reason. */
export const UNMAPPED_SLICES = {
  clock: { class: 'E', reason: 'engine-held: the server clock, rebuilt at start' },
  audio: { class: 'X', reason: 'streamed only: 20 Hz meter frames are never stored (Q4)' },
  authLockout: { class: 'M', reason: 'server memory: the lockout counters of the identity module' },
  auth: {
    class: 'S (server-native)',
    reason: 'a sign-in is a row of auth_sessions; the engine slice is only the actor scope of one command',
  },
  pairing: {
    class: 'S (server-native)',
    reason: 'devices and codes are the four pairing tables; only certificateFingerprint is stored, in core_device',
  },
} as const satisfies Partial<Record<keyof SimState, { readonly class: string; readonly reason: string }>>;

export type UnmappedSliceKey = keyof typeof UNMAPPED_SLICES;

// Compile-time proof that every slice is either mapped or named as not mapped, and none is both.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const everySliceIsClassified: Exact<DurableSliceKey | UnmappedSliceKey, keyof SimState> = true;
const noSliceIsBoth: Exact<DurableSliceKey & UnmappedSliceKey, never> = true;
void everySliceIsClassified;
void noSliceIsBoth;

/** The durable part of the state: what `fromRows(toRows(state))` gives back. */
export type DurableSlices = Pick<SimState, DurableSliceKey>;

/**
 * What `toRows` reads: the durable slices, and the one stored member of the `pairing` slice.
 * A whole `SimState` satisfies it.
 */
export type MappableState = DurableSlices & { readonly pairing: Pick<SimState['pairing'], 'certificateFingerprint'> };

/** The durable slices of a state, by reference (no copy). */
export function pickDurable(state: DurableSlices): DurableSlices {
  const picked: Partial<Record<DurableSliceKey, unknown>> = {};
  for (const key of DURABLE_SLICE_KEYS) picked[key] = state[key];
  return picked as DurableSlices;
}

/**
 * The column of `hardware_snapshot` that holds each snapshot slice (the typed schema's property
 * names). `time` and `update` are SQL keywords, so their columns are `time_status` and
 * `software_update` (naming rule N-6).
 */
export const SNAPSHOT_SLICE_COLUMNS = {
  tabletLink: 'tabletLink',
  activeCameraId: 'activeCameraId',
  cameras: 'cameras',
  mics: 'mics',
  storage: 'storage',
  time: 'timeStatus',
  network: 'network',
  security: 'security',
  services: 'services',
  health: 'health',
  otherDevices: 'otherDevices',
  ports: 'ports',
  faults: 'faults',
  diagnostics: 'diagnostics',
  update: 'softwareUpdate',
} as const satisfies Record<SnapshotSliceKey, string>;

/** The tables each stored slice is written to (documentation and tests; SQL names). */
export const STORED_SLICE_TABLES = {
  meta: ['core_state', 'engine_counters'],
  device: ['core_device'],
  operators: ['operators'],
  session: ['active_session'],
  lastSealedSessionId: ['core_state'],
  lastSealedAcknowledged: ['core_state'],
  sessionHistory: ['session_history'],
  storagePolicy: ['storage_policy'],
  evidence: ['evidence_items', 'evidence_tracks', 'evidence_custody'],
  events: ['events'],
  alerts: ['alerts'],
  audit: ['audit_log', 'exports'],
  settings: ['console_settings'],
  captureConfig: ['capture_config'],
  captureDevices: ['capture_devices'],
} as const satisfies Record<StoredSliceKey, readonly string[]>;
