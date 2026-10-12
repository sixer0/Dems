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
import type { CoreLinkSource } from '@/runtime';

// ── MB 10 list (G2–G4) ─────────────────────────────────────────────────────────────────────

export type SettingsGroup = 'application' | 'system';
export type SettingsRouteHref = '/devices' | '/storage' | '/network-time';
export type SettingsIcon = 'preferences' | 'notifications' | 'security' | 'devices' | 'storage' | 'network' | 'maintenance' | 'about' | 'transcription' | 'capture';

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
  // Fix wave J (JA2-35, JT-18): a row that opens another screen carries THAT screen's name (the tab's
  // `mobile.nav.*` word), not a second name for it ("Device Settings" opened the Devices tab).
  { id: 'devices', group: 'system', labelKey: 'mobile.nav.devices', icon: 'devices', target: { kind: 'route', href: '/devices' } },
  { id: 'storage', group: 'system', labelKey: 'mobile.nav.storage', icon: 'storage', target: { kind: 'route', href: '/storage' } },
  { id: 'network-time', group: 'system', labelKey: 'mobile.nav.networkTime', icon: 'network', target: { kind: 'route', href: '/network-time' } },
  // Task 3 row 68 (MB-09; ux §2.6): the device selector. The row above it opens the Devices screen, which holds it too.
  { id: 'capture', group: 'system', labelKey: 'features.capture-selector.settings.title', icon: 'capture', target: { kind: 'section', section: 'capture' } },
  { id: 'transcription', group: 'system', labelKey: 'features.transcription.title', icon: 'transcription', target: { kind: 'section', section: 'transcription' } },
  { id: 'maintenance', group: 'system', labelKey: 'system.settings.systemMaintenance', icon: 'maintenance', target: { kind: 'section', section: 'maintenance' } },
  { id: 'about', group: 'system', labelKey: 'system.settings.aboutDems', icon: 'about', target: { kind: 'section', section: 'about' } },
];

export function rowsOf(group: SettingsGroup): readonly SettingsRowDef[] {
  return SETTINGS_ROWS.filter((row) => row.group === group);
}

/**
 * Fix wave J (JA2-35): how many rows the Settings list shows under Application and System. The More
 * tile states this number, so the tile and the list cannot disagree (it said "7 sections" over 10
 * rows: it counted the `/settings/<section>` routes, not the rows). No row is hidden by role today;
 * a rule that hides one belongs HERE, so both readers follow it.
 */
export function settingsRowCount(): number {
  return rowsOf('application').length + rowsOf('system').length;
}

/**
 * Fix wave J (JA2-29, N-03): developer controls and pages (Core link source, Performance overlay,
 * the stack diagnostics page, the developer gallery) are not part of an operator's product menu.
 * They show only in a development build AND only while presentation mode is off (the existing rule
 * that already hides the demo operators and the Demo controls, D88).
 */
export function developerControlsShown(input: { readonly dev: boolean; readonly presentationMode: boolean }): boolean {
  return input.dev && !input.presentationMode;
}

/** The pane title of each section (same shared keys as its row). */
export const SECTION_TITLE_KEYS: Readonly<Record<SettingsSection, string>> = {
  preferences: 'system.settings.appPreferences',
  notifications: 'system.settings.notifications',
  security: 'system.settings.securityPrivacy',
  maintenance: 'system.settings.systemMaintenance',
  about: 'system.settings.aboutDems',
  transcription: 'features.transcription.title',
  capture: 'features.capture-selector.settings.title',
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

/**
 * Backend task W82 (04_client_integration_spec §3.3, §9.5): a change of the Core link source that
 * crosses the LIVE boundary asks first and signs the operator out; SIMULATED ↔ HEARTBEAT stays
 * instant, as before (both run the simulator).
 */
export function crossesLiveBoundary(from: CoreLinkSource, to: CoreLinkSource): boolean {
  return from !== to && (from === 'LIVE' || to === 'LIVE');
}

/** The data mode a source shows (§3.1: HEARTBEAT is SIMULATED data with a mock-core link). */
export function dataModeOf(source: CoreLinkSource): 'SIMULATED' | 'LIVE' {
  return source === 'LIVE' ? 'LIVE' : 'SIMULATED';
}

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
  /**
   * The sentence that says what biometric sign-in is (backend task W82, finding CPM1-1). SIMULATED
   * and HEARTBEAT: `mobile.biometric.identityNote` ("Simulated identity binding"), as before. LIVE:
   * worded on how the Core's token is stored (MB-6a (3)), or, in a session created with the
   * fingerprint, the MB-1 sentence that it changes only after a password sign-in.
   */
  readonly noteKey: string;
  /**
   * LIVE, MB-1: the session was created with the fingerprint, so the switch is disabled and the
   * description is `noteKey` alone (no status line).
   */
  readonly changeBlocked: boolean;
}

/** LIVE mode inputs of the biometric switch (backend task W82; `useAuthSession().biometric`). */
export interface BiometricSwitchLive {
  /** MB-1: the session was created with the fingerprint (`biometric.changeBlocked`). */
  readonly changeBlocked: boolean;
  /** MB-6a: the stored token carries the device's authentication requirement (`biometric.protected`); `null` when none is stored. */
  readonly protected: boolean | null;
}

/** SIMULATED and HEARTBEAT: the simulated identity binding (unchanged, `en.mobile.ts`). */
export const BIOMETRIC_NOTE_SIMULATED = 'mobile.biometric.identityNote';
/** LIVE, MB-6a (3): words that hold with and without the protected item; never a claim of hardware protection (the auth layer's key). */
export const BIOMETRIC_NOTE_LIVE = 'features.auth.biometric.screenLockNote';
/** LIVE, only while the marker says `protected: true`: the token is read only after the device's own check. */
export const BIOMETRIC_NOTE_LIVE_PROTECTED = 'mobile.biometric.identityNoteLiveProtected';
/** LIVE, MB-1: a session created with the fingerprint (the auth layer's key). */
export const BIOMETRIC_NOTE_CHANGE_BLOCKED = 'features.auth.biometric.passwordSessionRequired';

/**
 * The biometric switch (§6.3): on only when enabled for the signed-in operator; usable only with
 * enrolled hardware. Turning it off is always allowed while it is on.
 *
 * `live` (backend task W82, CPM1-1; 04_client_integration_spec §9.3 MB-1, MB-6a): absent outside
 * LIVE mode, so the four-argument form behaves exactly as before. In LIVE mode a session created
 * with the fingerprint disables the switch whatever else holds (AC-C-68): biometric sign-in is
 * changed only in a password session, and the auth layer sends nothing in a biometric one.
 */
export function biometricSwitchView(
  availability: BiometricAvailabilityView,
  enabled: boolean,
  boundOperatorId: string | null,
  operatorId: string | null,
  live?: BiometricSwitchLive,
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
  const changeBlocked = live?.changeBlocked === true;
  const noteKey =
    live === undefined
      ? BIOMETRIC_NOTE_SIMULATED
      : changeBlocked
        ? BIOMETRIC_NOTE_CHANGE_BLOCKED
        : live.protected === true
          ? BIOMETRIC_NOTE_LIVE_PROTECTED
          : BIOMETRIC_NOTE_LIVE;
  const disabled = changeBlocked || (!selected && (availability !== 'available' || operatorId === null));
  return { selected, disabled, statusKey, boundToOther, noteKey, changeBlocked };
}

// ── System Maintenance: who sees the Demo controls (backend task W82; AC-C-52) ─────────────

/**
 * `shown`: the panel. `presentation`: hidden by presentation mode (both modes, as before).
 * LIVE mode only (AC-C-52, [SP:DC-1, DC-2]): `not-permitted` without DEMO_CONTROL (the Core
 * answers 403 NOT_PERMITTED whatever its flag), `flag-off` when the Core server runs without its
 * demo flag (`session.demoControls` false; the Core answers 403 DEMO_DISABLED).
 */
export type DemoControlsAccess = 'shown' | 'presentation' | 'not-permitted' | 'flag-off';

export function demoControlsAccess(input: {
  readonly presentationMode: boolean;
  readonly live: boolean;
  /** LIVE: the session holds DEMO_CONTROL (`useCorePermission`). */
  readonly permitted: boolean;
  /** LIVE: the session's `demoControls` (the server-side flag, DC-3). */
  readonly demoFlag: boolean;
}): DemoControlsAccess {
  if (input.presentationMode) return 'presentation';
  if (!input.live) return 'shown';
  if (!input.permitted) return 'not-permitted';
  return input.demoFlag ? 'shown' : 'flag-off';
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
