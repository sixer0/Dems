/**
 * The shape of the bulk fixture: the rows it inserts, by table, and the rows it changes (plan row
 * W25). A row is in the select shape of the typed schema, every column present.
 */
import type {
  ActiveSessionRow,
  AlertRow,
  AuditChainHistoryRow,
  AuditLogRow,
  AuthSessionRow,
  BiometricTokenRow,
  DeviceCredentialRow,
  EngineCounterRow,
  EventRow,
  EvidenceCustodyRow,
  EvidenceItemRow,
  EvidenceTrackRow,
  ExportRow,
  HealthSnapshotRow,
  NewOperatorCredentialRow,
  OperatorRow,
  PairedDeviceRow,
  PairingCodeRow,
  RegistryCounterRow,
  SessionHistoryRow,
} from '../schema';

/** Everything the loader writes, by table. A row is in the select shape of the typed schema. */
export interface BulkFixtureRows {
  readonly operators: OperatorRow[];
  readonly operatorCredentials: NewOperatorCredentialRow[];
  readonly pairingCodes: PairingCodeRow[];
  readonly pairedDevices: PairedDeviceRow[];
  readonly deviceCredentials: DeviceCredentialRow[];
  readonly authSessions: AuthSessionRow[];
  readonly biometricTokens: BiometricTokenRow[];
  readonly sessionHistory: SessionHistoryRow[];
  readonly evidenceItems: EvidenceItemRow[];
  readonly evidenceTracks: EvidenceTrackRow[];
  readonly evidenceCustody: EvidenceCustodyRow[];
  readonly exportRecords: ExportRow[];
  readonly activeSession: ActiveSessionRow[];
  readonly alerts: AlertRow[];
  readonly healthSnapshots: HealthSnapshotRow[];
  readonly auditChainHistory: AuditChainHistoryRow[];
  readonly auditLog: AuditLogRow[];
  readonly events: EventRow[];
}

/** The rows the fixture changes instead of inserting. */
export interface BulkFixtureUpdates {
  /** `last_sign_in_at` of seeded operators that have a fixture session. */
  readonly operatorSignIns: ReadonlyArray<{ readonly id: string; readonly lastSignInAt: number }>;
  /** The six engine counters after the load: `export` is inserted when the base has no such row. */
  readonly engineCounters: EngineCounterRow[];
  /** The two registry counters after the load. */
  readonly registryCounters: RegistryCounterRow[];
  /** `core_state`: the epoch above the lineage, and the instant of the newest reset. `null`: unchanged. */
  readonly coreState: { readonly epoch: number; readonly lastResetAt: number | null; readonly updatedAt: number } | null;
}

/** The SQL name of each table the fixture inserts into. */
export const FIXTURE_TABLES = {
  operators: 'operators',
  operatorCredentials: 'operator_credentials',
  pairingCodes: 'pairing_codes',
  pairedDevices: 'paired_devices',
  deviceCredentials: 'device_credentials',
  authSessions: 'auth_sessions',
  biometricTokens: 'biometric_tokens',
  sessionHistory: 'session_history',
  evidenceItems: 'evidence_items',
  evidenceTracks: 'evidence_tracks',
  evidenceCustody: 'evidence_custody',
  exportRecords: 'exports',
  activeSession: 'active_session',
  alerts: 'alerts',
  healthSnapshots: 'health_snapshots',
  auditChainHistory: 'audit_chain_history',
  auditLog: 'audit_log',
  events: 'events',
} as const satisfies Record<keyof BulkFixtureRows, string>;
