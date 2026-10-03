/**
 * Pure view models for Settings (04_mobile_specs §4.15, MB 10). No React: unit-tested in
 * `settings-model.test.ts`.
 */
import {
  AUTH_IDLE_TIMEOUT_MS,
  FaultKind,
  ROLE_PERMISSIONS,
  ScenarioName,
  type DiagnosticsRun,
  type FaultTarget,
  type OperatorRole,
  type Permission,
  type UpdateSlice,
} from '@dems/shared/sim';
import type { StepStatus as StepperStatus } from '@/components/composed/stepper';
import type { SettingsSection } from '@/navigation/params';

// ── MB 10 list (G2–G4) ─────────────────────────────────────────────────────────────────────

export type SettingsGroup = 'application' | 'system';
export type SettingsRouteHref = '/devices' | '/storage' | '/network-time';
export type SettingsIcon = 'preferences' | 'notifications' | 'security' | 'devices' | 'storage' | 'network' | 'maintenance' | 'about';

export type SettingsRowTarget = { kind: 'section'; section: SettingsSection } | { kind: 'route'; href: SettingsRouteHref };

export interface SettingsRowDef {
  /** testID suffix: `settings-row-<id>`. */
  readonly id: string;
  readonly group: SettingsGroup;
  /** Shared label key (`system.settings.*`, the web Settings panel's names). */
  readonly labelKey: string;
  readonly icon: SettingsIcon;
  readonly target: SettingsRowTarget;
}

/**
 * MB 10 rows in mockup order. G4's first three rows open the existing screens (§4.15 G4 targets);
 * the others are this feature's sections.
 */
export const SETTINGS_ROWS: readonly SettingsRowDef[] = [
  { id: 'preferences', group: 'application', labelKey: 'system.settings.appPreferences', icon: 'preferences', target: { kind: 'section', section: 'preferences' } },
  { id: 'notifications', group: 'application', labelKey: 'system.settings.notifications', icon: 'notifications', target: { kind: 'section', section: 'notifications' } },
  { id: 'security', group: 'application', labelKey: 'system.settings.securityPrivacy', icon: 'security', target: { kind: 'section', section: 'security' } },
  { id: 'devices', group: 'system', labelKey: 'system.settings.deviceSettings', icon: 'devices', target: { kind: 'route', href: '/devices' } },
  { id: 'storage', group: 'system', labelKey: 'system.settings.storageManagement', icon: 'storage', target: { kind: 'route', href: '/storage' } },
  { id: 'network-time', group: 'system', labelKey: 'system.settings.networkTime', icon: 'network', target: { kind: 'route', href: '/network-time' } },
  { id: 'maintenance', group: 'system', labelKey: 'system.settings.systemMaintenance', icon: 'maintenance', target: { kind: 'section', section: 'maintenance' } },
  { id: 'about', group: 'system', labelKey: 'system.settings.aboutDems', icon: 'about', target: { kind: 'section', section: 'about' } },
];

export function rowsOf(group: SettingsGroup): readonly SettingsRowDef[] {
  return SETTINGS_ROWS.filter((row) => row.group === group);
}

/** The pane title of each section (same shared keys as its row). */
export const SECTION_TITLE_KEYS: Readonly<Record<SettingsSection, string>> = {
  preferences: 'system.settings.appPreferences',
  notifications: 'system.settings.notifications',
  security: 'system.settings.securityPrivacy',
  maintenance: 'system.settings.systemMaintenance',
  about: 'system.settings.aboutDems',
};

/** Medium and expanded open a section in the right pane; with none selected it shows the first one. */
export const DEFAULT_PANE_SECTION: SettingsSection = 'preferences';

export function paneSection(selected: SettingsSection | null): SettingsSection {
  return selected ?? DEFAULT_PANE_SECTION;
}

// ── Account (G2) ───────────────────────────────────────────────────────────────────────────

/** The role's demo permissions in the sim's RBAC order (S20). */
export function permissionsOf(role: OperatorRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] as readonly Permission[];
}

// ── App Preferences ────────────────────────────────────────────────────────────────────────

export type MeterSize = 'card' | 'compact';
export const METER_SIZES: readonly MeterSize[] = ['card', 'compact'];

// ── Notifications ──────────────────────────────────────────────────────────────────────────

export type NotificationCategory = 'devices' | 'storage' | 'time' | 'system';
export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ['devices', 'storage', 'time', 'system'];

/**
 * Which alert kinds each switch covers. The critical kinds (the sim's CRITICAL_FAULTS) have no
 * switch: they always show (§4.15 "Critical is always on").
 */
export const NOTIFICATION_KINDS: Readonly<Record<NotificationCategory, readonly FaultKind[]>> = {
  devices: [FaultKind.CAMERA_LOSS, FaultKind.MIC_NO_SIGNAL, FaultKind.MIC_CLIP],
  storage: [FaultKind.STORAGE_LOW],
  time: [FaultKind.GNSS_LOSS],
  system: [FaultKind.TAMPER, FaultKind.FAN_STALL, FaultKind.AUDIT_TAMPER],
};

export type NotificationPrefs = Readonly<Record<NotificationCategory, boolean>>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { devices: true, storage: true, time: true, system: true };

/** Whether an alert of `kind` should toast under these preferences (critical kinds always do). */
export function shouldNotify(kind: FaultKind | 'SYSTEM', prefs: NotificationPrefs): boolean {
  for (const category of NOTIFICATION_CATEGORIES) {
    if ((NOTIFICATION_KINDS[category] as readonly string[]).includes(kind)) return prefs[category];
  }
  return true;
}

// ── Security & Privacy ─────────────────────────────────────────────────────────────────────

/** §4.15 lists 5 / 15 / 30 min; the simulator enforces a fixed idle timeout (SIM-GAP-M88-1). */
export const AUTO_LOCK_CHOICES: readonly number[] = [5, 15, 30];
export const AUTO_LOCK_POLICY_MINUTES = Math.round(AUTH_IDLE_TIMEOUT_MS / 60_000);

export type BiometricAvailabilityView = 'unknown' | 'unavailable' | 'not-enrolled' | 'available';

export interface BiometricSwitchView {
  readonly selected: boolean;
  readonly disabled: boolean;
  /** `features.settings.security.*` or `mobile.biometric.*` key for the status line. */
  readonly statusKey: string;
  /** Another operator holds the binding (the status line names them). */
  readonly boundToOther: boolean;
}

/**
 * The biometric switch (§6.3): on only when enabled for the signed-in operator; usable only with
 * enrolled hardware. Turning it off is always allowed while it is on.
 */
export function biometricSwitchView(
  availability: BiometricAvailabilityView,
  enabled: boolean,
  boundOperatorId: string | null,
  operatorId: string | null,
): BiometricSwitchView {
  const selected = enabled && operatorId !== null && boundOperatorId === operatorId;
  const boundToOther = enabled && boundOperatorId !== null && boundOperatorId !== operatorId;
  const statusKey =
    availability === 'available'
      ? 'features.settings.security.biometricAvailable'
      : availability === 'not-enrolled'
        ? 'mobile.biometric.notEnrolled'
        : availability === 'unavailable'
          ? 'features.settings.security.biometricUnavailable'
          : 'features.settings.security.biometricChecking';
  return { selected, disabled: !selected && (availability !== 'available' || operatorId === null), statusKey, boundToOther };
}

// ── System Maintenance: Demo controls (§4.15, 01S §14.5.8, MA-30) ──────────────────────────

export interface DemoFaultSpec {
  readonly kind: FaultKind;
  /** The `inject` target (MIC 1 no signal, MIC 2 clip). */
  readonly target?: FaultTarget;
  /** Critical kinds move an active session to FAULT. */
  readonly critical: boolean;
}

/** §4.15: one Button per fault, in the spec's order. */
export const DEMO_FAULTS: readonly DemoFaultSpec[] = [
  { kind: FaultKind.CAMERA_LOSS, critical: false },
  { kind: FaultKind.MIC_CLIP, target: { channel: 'AUDIO-02' }, critical: false },
  { kind: FaultKind.MIC_NO_SIGNAL, target: { channel: 'AUDIO-01' }, critical: false },
  { kind: FaultKind.STORAGE_LOW, critical: false },
  { kind: FaultKind.STORAGE_FULL, critical: true },
  { kind: FaultKind.GNSS_LOSS, critical: false },
  { kind: FaultKind.TAMPER, critical: false },
  { kind: FaultKind.FAN_STALL, critical: false },
  { kind: FaultKind.POWER_FAIL, critical: true },
];

export const DEMO_SCENARIOS: readonly ScenarioName[] = [ScenarioName.IDLE, ScenarioName.RECORDING, ScenarioName.FINALIZING, ScenarioName.FAULT_DEMO];

/**
 * Whether a demo fault is active. Targeted kinds match their channel; CAMERA_LOSS matches any
 * camera (the sim targets the live camera); the enclosure TAMPER button never matches the
 * evidence-tamper hook (`target` set), which another screen injects.
 */
export function isDemoFaultActive(active: readonly { kind: FaultKind; target: string | null }[], spec: DemoFaultSpec): boolean {
  return active.some((fault) => {
    if (fault.kind !== spec.kind) return false;
    if (spec.target?.channel) return fault.target === spec.target.channel;
    if (spec.kind === FaultKind.TAMPER) return fault.target === null;
    return true;
  });
}

// ── System Maintenance: diagnostics and update ─────────────────────────────────────────────

export interface DiagnosticsSummary {
  readonly done: number;
  readonly total: number;
  readonly pass: number;
  readonly warn: number;
  readonly fail: number;
  readonly complete: boolean;
}

export function summarizeDiagnostics(run: DiagnosticsRun | null): DiagnosticsSummary | null {
  if (!run) return null;
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const check of run.checks) {
    if (check.status === 'PASS') pass += 1;
    else if (check.status === 'WARN') warn += 1;
    else if (check.status === 'FAIL') fail += 1;
  }
  const done = pass + warn + fail;
  return { done, total: run.checks.length, pass, warn, fail, complete: run.completedAt !== null };
}

/** Sim update step status → the C-4 Stepper's status (`active` runs). */
export function updateStepStatuses(update: UpdateSlice): StepperStatus[] {
  return update.steps.map((step) => (step.status === 'active' ? 'running' : step.status));
}

/** The slot an install writes to (the inactive one). */
export function targetSlotOf(update: UpdateSlice): 'A' | 'B' {
  return update.activeSlot === 'A' ? 'B' : 'A';
}
