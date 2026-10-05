/**
 * The minimum row counts of the bulk fixture: the table of database contract §11 (revision 2, 30
 * tables), as data (plan row W25; BF-5).
 *
 * The numbers are MINIMUMS of the whole table after the load, that is the seeded rows and the
 * fixture's rows together. The loader prints the actual count beside each one, and the tests
 * compare them. `BULK_MIX` holds the required mix of the same table, also as minimums (and one
 * maximum), for the builder and for the tests that count the mix in SQL.
 *
 * Paging facts the numbers are derived from: a page has 50 rows by default and 200 at most; the
 * engine keeps the newest 1,000 audit rows, 500 events and 100 alerts.
 */

export interface TableMinimum {
  /** SQL name of the table. */
  readonly table: string;
  readonly minimum: number;
  /** The required mix, in the contract's words. */
  readonly mix: string;
}

/** The 30 tables in the order of the contract's table. */
export const BULK_MINIMUMS: readonly TableMinimum[] = Object.freeze([
  { table: 'roles', minimum: 3, mix: 'unchanged' },
  { table: 'permissions', minimum: 12, mix: 'unchanged' },
  { table: 'role_permissions', minimum: 18, mix: 'unchanged' },
  { table: 'operators', minimum: 12, mix: 'at least 2 enabled SUPERVISOR, at least 2 disabled, every role present' },
  { table: 'operator_credentials', minimum: 12, mix: 'one per operator' },
  {
    table: 'auth_sessions',
    minimum: 300,
    mix: 'at least 30 open (5 bound to a device, 3 BIOMETRIC); at least 5 of each of the 8 end reasons; TOKEN_REUSE only BIOMETRIC with a device',
  },
  { table: 'pairing_codes', minimum: 60, mix: 'at most 1 ACTIVE; at least 40 REDEEMED; at least 5 each of CANCELLED, EXPIRED, EXHAUSTED' },
  { table: 'paired_devices', minimum: 40, mix: 'at least 20 PAIRED, 10 REVOKED, 10 UNPAIRED' },
  { table: 'device_credentials', minimum: 40, mix: 'one per device; at least 5 with a next_hash' },
  { table: 'biometric_tokens', minimum: 80, mix: 'at least 20 live, 30 used, 20 revoked (every reason), 10 past expires_at' },
  { table: 'registry_counters', minimum: 2, mix: 'values above the highest minted number' },
  {
    table: 'audit_log',
    minimum: 5_000,
    mix: 'at least 20 types; all 8 categories; at least 200 rows of one session; at least 100 ACCESS_DENIED; at least 3 actors',
  },
  { table: 'audit_chain_head', minimum: 1, mix: 'seq equals the row count' },
  {
    table: 'audit_chain_history',
    minimum: 25,
    mix: 'reset_no 1 to n without a gap, epoch rising; both reasons 5 times; 5 rows without an actor; 3 scenarios; one row not intact; the newest agrees with one SCENARIO_LOADED row',
  },
  { table: 'events', minimum: 2_500, mix: 'all 10 categories; all 4 severities' },
  { table: 'session_history', minimum: 520, mix: 'at least 500 SEALED and 20 INCOMPLETE; at least 5 without evidence' },
  {
    table: 'evidence_items',
    minimum: 505,
    mix: 'at least 400 SEALED, 40 EXPORTED, 30 ARCHIVED, 20 UNDER_REVIEW, 15 RECORDED; at least 10 tampered; all three case types',
  },
  { table: 'evidence_tracks', minimum: 2_020, mix: 'exactly 4 per item, both audio tracks' },
  { table: 'evidence_custody', minimum: 1_200, mix: 'at least 2 per item' },
  { table: 'exports', minimum: 60, mix: 'at least 40 EVIDENCE, 10 AUDIT, 10 LOGS' },
  { table: 'alerts', minimum: 250, mix: 'at least 10 active, 100 acknowledged; every fault kind' },
  { table: 'health_snapshots', minimum: 1_500, mix: 'at least 1,440 INTERVAL (24 hours at 60 s) and 60 caused by a fault' },
  { table: 'engine_counters', minimum: 6, mix: 'values above the highest minted number; the export row present' },
  { table: 'active_session', minimum: 0, mix: 'a variant flag adds one session in RECORDING with a full 200-item timeline' },
  { table: 'storage_policy', minimum: 1, mix: 'as seeded' },
  { table: 'console_settings', minimum: 1, mix: 'as seeded' },
  { table: 'core_device', minimum: 1, mix: 'as seeded' },
  { table: 'core_state', minimum: 1, mix: 'as seeded; epoch above the highest lineage epoch' },
  { table: 'hardware_snapshot', minimum: 1, mix: 'as seeded' },
  { table: 'schema_meta', minimum: 1, mix: 'as seeded' },
] as const);

/** The required mix as numbers. Every value is a minimum, except `pairingCodes.activeAtMost`. */
export const BULK_MIX = Object.freeze({
  operators: { enabledSupervisors: 2, disabled: 2, roles: 3 },
  authSessions: { open: 30, openDeviceBound: 5, openBiometric: 3, perEndReason: 5, endReasons: 8 },
  pairingCodes: { activeAtMost: 1, redeemed: 40, cancelled: 5, expired: 5, exhausted: 5 },
  pairedDevices: { paired: 20, revoked: 10, unpaired: 10 },
  deviceCredentials: { withNextHash: 5 },
  biometricTokens: { live: 20, used: 30, revoked: 20, revokeReasons: 6, pastExpiry: 10 },
  auditLog: { types: 20, categories: 8, rowsOfOneSession: 200, accessDenied: 100, actors: 3 },
  auditChainHistory: { perReason: 5, withoutActor: 5, scenarios: 3, notIntact: 1 },
  events: { categories: 10, severities: 4 },
  sessionHistory: { sealed: 500, incomplete: 20, withoutEvidence: 5 },
  evidenceItems: { sealed: 400, exported: 40, archived: 30, underReview: 20, recorded: 15, tampered: 10, caseTypes: 3 },
  evidenceTracks: { perItem: 4 },
  evidenceCustody: { perItem: 2 },
  exports: { evidence: 40, audit: 10, logs: 10 },
  alerts: { active: 10, acknowledged: 100, faultKinds: 12 },
  healthSnapshots: { interval: 1_440, fault: 60 },
  activeSessionVariant: { timelineItems: 200 },
} as const);

export interface MinimumComparison {
  readonly table: string;
  readonly minimum: number;
  /** The row count of the table after the load. */
  readonly loaded: number;
  readonly met: boolean;
}

/** The minimum of one table. */
export function minimumOf(table: string): number {
  const entry = BULK_MINIMUMS.find((candidate) => candidate.table === table);
  if (entry === undefined) throw new RangeError(`no minimum is stated for the table ${table}.`);
  return entry.minimum;
}

/** "entity, minimum, loaded" for all 30 tables, in the contract's order. A missing count is 0. */
export function compareWithMinimums(counts: Readonly<Record<string, number>>): MinimumComparison[] {
  return BULK_MINIMUMS.map(({ table, minimum }) => {
    const loaded = counts[table] ?? 0;
    return { table, minimum, loaded, met: loaded >= minimum };
  });
}
