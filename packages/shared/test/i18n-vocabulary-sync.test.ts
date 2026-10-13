// Step 54 (D52; review 40 §5.a, m1): every closed value set of `sim/vocabulary.ts` (and the step-54
// selector vocabularies) has exactly one i18n label per value, so no UI ever renders a raw code or
// a missing key. Domain enums are covered by i18n.test.ts and are not repeated here.
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n';
import { INTEGRITY_CHECKLIST_IDS } from '../src/sim/selectors';
import * as V from '../src/sim/vocabulary';

type Tree = Record<string, unknown>;

function at(path: string): Record<string, unknown> | undefined {
  let node: unknown = en;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Tree)[key];
  }
  return typeof node === 'object' && node !== null ? (node as Record<string, unknown>) : undefined;
}

/**
 * The four assertions of review 40 §5.a: the map exists (a missing path fails with its name);
 * every value is a key with a non-empty string; every key is a value or an allowed extra; no key
 * is an `_one` / `_other` plural fragment of a value. `keyOf` maps a value to its key when the
 * namespace uses another key style (DeviceCommand, PrecheckReasonCode).
 */
function expectExactKeys(
  path: string,
  values: readonly string[],
  allowExtra: readonly string[] = [],
  keyOf: (value: string) => string = (value) => value,
): void {
  const map = at(path);
  expect(map, `${path} is missing`).toBeDefined();
  if (!map) return;
  const keys = values.map(keyOf);
  for (const key of keys) {
    const label = map[key];
    expect(typeof label === 'string' && label.length > 0, `${path}.${key} must be a non-empty string`).toBe(true);
  }
  const extra = Object.keys(map).filter((key) => !keys.includes(key) && !allowExtra.includes(key));
  expect(extra, `${path} has keys that are not values`).toEqual([]);
  const plurals = Object.keys(map).filter((key) => keys.some((value) => key === `${value}_one` || key === `${value}_other`));
  expect(plurals, `${path} has plural fragments of values`).toEqual([]);
}

const values = (object: Record<string, string>) => Object.values(object);

describe('i18n ↔ sim/vocabulary.ts (D52)', () => {
  const pairs: [path: string, list: readonly string[], allowExtra?: readonly string[]][] = [
    ['common.roles', values(V.OperatorRole)],
    ['common.subjectType', values(V.SubjectType)],
    ['common.subjectTypeGloss', values(V.SubjectType)],
    ['common.evidenceStatus', values(V.EvidenceStatus), ['PENDING']],
    ['common.precheckStatus', values(V.PrecheckStatus)],
    ['common.severity', values(V.Severity)],
    ['common.sessionOutcome', values(V.SessionOutcome)],
    ['common.verificationStatus', values(V.VerificationStatus)],
    ['common.authMethod', values(V.AuthMethod)],
    ['common.pairingState', values(V.PairingState)],
    ['common.tabletLinkState', values(V.TabletLinkState)],
    ['common.serviceStatus', values(V.ServiceStatus)],
    ['common.diagnosticStatus', values(V.DiagnosticStatus)],
    ['common.updateState', values(V.UpdateState)],
    ['common.faultKind', values(V.FaultKind)],
    ['system.demo.faults', values(V.FaultKind)],
    ['common.systemState', values(V.SystemState)],
    // CRITICAL_RECORDING: the caption of a critical fault during a recording (step 42).
    ['dashboard.systemRing.caption', values(V.SystemState), ['CRITICAL_RECORDING']],
    ['dashboard.systemRing.ariaLabel', values(V.SystemState)],
    ['common.posture', values(V.SecurityPosture)],
    ['common.auditType', values(V.AuditType)],
    ['common.auditCategory', values(V.AuditCategory)],
    ['common.eventType', values(V.SimEventType)],
    ['sessionNew.devices.checks', values(V.PrecheckCheckId)],
    ['session.timeline.kind', values(V.TimelineKind)],
    ['storage.manage.policies', values(V.RetentionPolicyId)],
    ['system.demo.scenarios', values(V.ScenarioName)],
    // Step 54 vocabularies whose labels the page steps already wrote.
    ['networkTime.domains.state', values(V.NetworkDomainState)],
    ['networkTime.systemTime.avSync.state', values(V.AvSyncState)],
    ['storage.volumes.smart', values(V.SmartStatus)],
    ['shell.securePill.checks', INTEGRITY_CHECKLIST_IDS],
  ];

  it.each(pairs)('%s labels exactly the vocabulary values', (path, list, allowExtra = []) => {
    expectExactKeys(path, list, allowExtra);
  });

  it('DeviceCommand: common.deviceMenu through the explicit camelCase map (incl. IDENTIFY, step 54)', () => {
    const KEY = { TEST_SIGNAL: 'testSignal', RESTART: 'restart', IDENTIFY: 'identify', POE_CYCLE: 'poeCycle' } as const satisfies Record<V.DeviceCommand, string>;
    expectExactKeys('common.deviceMenu', values(V.DeviceCommand), ['label', 'details'], (value) => KEY[value as V.DeviceCommand]);
  });

  it('PrecheckReasonCode: sessionNew.devices.reasons through the explicit camelCase map (SIM-GAP-W46-2)', () => {
    const KEY = {
      CORE_OFFLINE: 'coreOffline',
      LENS_FAULT: 'lensFault',
      MIC_NO_SIGNAL: 'micNoSignal',
      MIC_CLIP: 'micClip',
      STORAGE_FULL: 'storageFull',
      STORAGE_LOW: 'storageLow',
      TIME_RTC: 'timeRtc',
      SECURITY_FAULT: 'securityFault',
      ENCLOSURE_TAMPER: 'securityTamper',
    } as const satisfies Record<V.PrecheckReasonCode, string>;
    expectExactKeys('sessionNew.devices.reasons', values(V.PrecheckReasonCode), [], (value) => KEY[value as V.PrecheckReasonCode]);
  });

  it('every audit type has a category and every event type a category (no hole in the maps)', () => {
    expect(Object.keys(V.AUDIT_TYPE_CATEGORY).sort()).toEqual(values(V.AuditType).sort());
    expect(Object.keys(V.SIM_EVENT_CATEGORY).sort()).toEqual(values(V.SimEventType).sort());
    expect(Object.keys(V.FAULT_EVENT_CATEGORY).sort()).toEqual(values(V.FaultKind).sort());
  });

  // Backend task W16 (GP-06; 2026-10-04 01_specs §4.3; D37): `Permission` joins the sync. Every value
  // is labelled in `securityAudit.rbac.permissions`, the map the clients read (the web matrix and the
  // mobile Profile sheet, which lists every grant of a role). `common.rbac.permissions` repeats the
  // three new ones; a value labelled in both maps must read the same in both.
  it('Permission: 15 values, each labelled in securityAudit.rbac.permissions; common.rbac.permissions agrees (W16; M2-W6; task 4 row 100)', () => {
    const all = values(V.Permission);
    // Task 3 M2-W6 (SH-04): +CAPTURE_CONFIG, +TRANSCRIPT_REVISE on top of the twelve of W16.
    // Task 4 row 100 (decision U10): +CAPTURE_COMMISSION, labelled in the map the clients read.
    expect(all).toHaveLength(15);
    expectExactKeys('securityAudit.rbac.permissions', all);
    const page = at('securityAudit.rbac.permissions');
    const shared = at('common.rbac.permissions');
    expect(shared, 'common.rbac.permissions is missing').toBeDefined();
    if (!page || !shared) return;
    for (const [permission, label] of Object.entries(shared)) {
      expect(all.includes(permission), `common.rbac.permissions.${permission} is not a permission`).toBe(true);
      expect(label, `permission ${permission} reads differently in the two maps`).toBe(page[permission]);
    }
  });

  // Backend task W16 (GP-06; 2026-10-04 01_specs §13.1, §19.2): nine audit types the Core server
  // writes, in the existing eight categories; no event type was added.
  it('AuditType: 83 values; the nine task-3 capture types, STT_CONFIG_CHANGED, the four of the camera search, the ten of task 4 row 19, the one of row 201, the four of row V3 and the one of row R1b sit in the existing categories (M2-W7, M6 row 113, R-9..R-11 row 132)', () => {
    // Task 3 M2-W7 (blueprint row 48; C3 §5.2/§5.3): 53 -> 62. Each new type joins an EXISTING
    // category (no new AuditCategory), and each is labelled in `common.auditType` (checked above).
    // Task 3 M6 (blueprint row 113; C3 §2.5): 62 -> 63 with STT_CONFIG_CHANGED, category DEVICE.
    // Task 3 R-9..R-11 (blueprint row 132, D106; C3 §5.2, §10.1): 63 -> 67 with the four types of the
    // camera search, the connection test, the adoption and the no-device warning.
    // Task 4 blueprint row 19 (WP-23a): 67 -> 77 with the ten types of the hardware-input port,
    // appended last; the positions of the earlier groups below move by that delta of ten.
    // Task 4 blueprint row 201 (X-C): 77 -> 78 with OPERATOR_PASSWORD_SET, appended last; every
    // position below moves by that delta of one.
    // Task 4 row V3 (the third vocabulary step; C53, C57, C58, C62): 78 -> 82 with the four types of
    // the alias intent, the failed alias add, the audio gap of a worker restart and the
    // stored-credential connection test, appended last; every position below moves by that delta of four.
    // Task 4 row R1b (decision C99): 82 -> 83 with CAPTURE_VIDEO_ABSENT_IN_SESSION, appended last;
    // every position below moves by that delta of one.
    expect(values(V.AuditType)).toHaveLength(83);
    expect(values(V.AuditType).at(-1)).toBe('CAPTURE_VIDEO_ABSENT_IN_SESSION');
    expect([V.AUDIT_TYPE_CATEGORY.CAPTURE_VIDEO_ABSENT_IN_SESSION, V.AUDIT_TYPE_CATEGORY.CAPTURE_AUDIO_ABSENT_ON_RESTART]).toEqual(['DEVICE', 'DEVICE']);
    expect(values(V.AuditCategory)).toHaveLength(8);
    expect(values(V.SimEventType)).toHaveLength(46);
    const added = {
      CAPTURE_CONFIG_CHANGED: 'DEVICE',
      AUDIO_SOURCE_SWITCHED: 'SESSION',
      CAMERA_POE_CYCLED: 'DEVICE',
      TRANSCRIPT_REVISED: 'EVIDENCE',
      MIC_SILENT: 'DEVICE',
      EVIDENCE_MEDIA_SERVED: 'EVIDENCE',
      EVIDENCE_EXPORT_FAILED: 'EVIDENCE',
      CAPTURE_CREDENTIAL_SET: 'SECURITY',
      CAPTURE_CREDENTIAL_REVEALED: 'SECURITY',
    } as const satisfies Partial<Record<V.AuditType, V.AuditCategory>>;
    for (const type of Object.keys(added) as (keyof typeof added)[]) {
      expect(V.AuditType[type]).toBe(type);
      expect(V.AUDIT_TYPE_CATEGORY[type]).toBe(added[type]);
    }
    expect(values(V.AuditType).slice(-30, -21)).toEqual(Object.keys(added));
    expect(values(V.AuditType).at(-21)).toBe('STT_CONFIG_CHANGED');
    expect(V.AUDIT_TYPE_CATEGORY.STT_CONFIG_CHANGED).toBe('DEVICE');
    // C3 §5.3 (erratum PE-121-09): exactly four entries, each in an EXISTING category.
    const discovery = {
      CAPTURE_DISCOVERY_SEARCHED: 'DEVICE',
      CAPTURE_CONNECTION_TESTED: 'SECURITY',
      CAPTURE_CANDIDATE_ADOPTED: 'DEVICE',
      CAPTURE_DEVICE_UNREACHABLE: 'DEVICE',
    } as const satisfies Partial<Record<V.AuditType, V.AuditCategory>>;
    expect(values(V.AuditType).slice(-20, -16)).toEqual(Object.keys(discovery));
    for (const type of Object.keys(discovery) as (keyof typeof discovery)[]) expect(V.AUDIT_TYPE_CATEGORY[type]).toBe(discovery[type]);
    // Task 4 blueprint row 19 (WP-23a): exactly ten entries, each in an EXISTING category.
    const hardwareInput = {
      CAPTURE_AUDIO_INPUT_CHANGED: 'DEVICE',
      CAPTURE_NETWORK_CONFIG_CHANGED: 'DEVICE',
      HOST_ALIAS_ADDED: 'SECURITY',
      HOST_ALIAS_REMOVED: 'SECURITY',
      HOST_ALIAS_REMOVE_FAILED: 'SECURITY',
      CAMERA_FACTORY_SCANNED: 'DEVICE',
      CAMERA_NETWORK_SET: 'DEVICE',
      CAPTURE_DEVICE_ADDRESS_CHANGED: 'DEVICE',
      INSTALLATION_ACCEPTED: 'SYSTEM',
      INSTALLATION_ACCEPTANCE_REVOKED: 'SYSTEM',
    } as const satisfies Partial<Record<V.AuditType, V.AuditCategory>>;
    expect(values(V.AuditType).slice(-16, -6)).toEqual(Object.keys(hardwareInput));
    for (const type of Object.keys(hardwareInput) as (keyof typeof hardwareInput)[]) expect(V.AUDIT_TYPE_CATEGORY[type]).toBe(hardwareInput[type]);
    // Task 4 blueprint row 201 (X-C; SX-14): exactly one entry, in an EXISTING category.
    expect(values(V.AuditType).at(-6)).toBe('OPERATOR_PASSWORD_SET');
    expect(V.AUDIT_TYPE_CATEGORY.OPERATOR_PASSWORD_SET).toBe('SECURITY');
    // Task 4 row V3 (the third vocabulary step): exactly four entries, each in an EXISTING category.
    // The two alias types as the three of row 19; the audio gap as the capture-fault types MIC_SILENT
    // and CAPTURE_DEVICE_UNREACHABLE; the stored-credential test as CAPTURE_CONNECTION_TESTED.
    const third = {
      HOST_ALIAS_REQUESTED: 'SECURITY',
      HOST_ALIAS_ADD_FAILED: 'SECURITY',
      CAPTURE_AUDIO_ABSENT_ON_RESTART: 'DEVICE',
      CAPTURE_DEVICE_CONNECTION_TESTED: 'SECURITY',
    } as const satisfies Partial<Record<V.AuditType, V.AuditCategory>>;
    expect(values(V.AuditType).slice(-5, -1)).toEqual(Object.keys(third));
    for (const type of Object.keys(third) as (keyof typeof third)[]) expect(V.AUDIT_TYPE_CATEGORY[type]).toBe(third[type]);
    expect([V.AUDIT_TYPE_CATEGORY.HOST_ALIAS_ADDED, V.AUDIT_TYPE_CATEGORY.MIC_SILENT, V.AUDIT_TYPE_CATEGORY.CAPTURE_DEVICE_UNREACHABLE, V.AUDIT_TYPE_CATEGORY.CAPTURE_CONNECTION_TESTED]).toEqual(['SECURITY', 'DEVICE', 'DEVICE', 'SECURITY']);
  });
});
