import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `settings` feature, mounted at `features.settings.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Step 88 is this file's only writer (P6).
 *
 * Most labels are shared and come from `@dems/shared/i18n`: the group and row names
 * (`system.settings.*`, the web Settings panel), the Demo Control Panel (`system.demo.*`),
 * diagnostics and update copy (`system.diagnostics.*`, `system.update.*`), role and permission
 * names (`common.roles.*`, `securityAudit.rbac.permissions.*`) and the account menu
 * (`shell.userMenu.*`). The mobile namespace gives Haptics, the Core link source and the biometric
 * copy (`mobile.*`). Only what this screen alone says lives here.
 */
export const settingsEn = {
  back: 'Back',
  // MB 10 G2: the account row (a11y) and the Profile sheet.
  account: {
    rowLabel: '{{role}}, {{name}}. Open profile',
    rowHint: 'Shows your role and demo permissions, and lets you lock the console or sign out',
    signedOut: 'Not signed in',
    username: 'Username',
    operatorId: 'Operator ID',
    permissions: 'Demo permissions',
    permissionsNote: 'Role-based access in this demo follows the simulated Core.',
  },
  // MB 10 G3/G4 rows that open another screen.
  rows: {
    sectionHint: 'Opens {{section}}',
    screenHint: 'Opens the {{screen}} screen',
  },
  pane: {
    placeholder: 'Choose a category on the left.',
  },
  saveFailed: 'This setting could not be saved on the device. It applies until the app restarts.',
  readFailed: 'Saved settings could not be read, so defaults are shown.',
  preferences: {
    motionGroup: 'Motion and feedback',
    demoGroup: 'Demo',
    coreGroup: 'Core connection',
    displayGroup: 'Display and language',
    debugGroup: 'Developer',
    coreLinkHint: 'Simulated runs the Core inside the app. mock-core heartbeat follows the mock-core service on this computer.',
    coreLinkHintRelease: 'Simulated runs the Core inside the app. mock-core heartbeat is a developer setup only (adb reverse to mock-core).',
    meterSize: 'Meter size',
    meterSizeHint: 'Default size of the live audio meters on the session monitor.',
    meterStandard: 'Standard',
    meterCompact: 'Compact',
    language: 'Language',
    languageEnglish: 'English',
    languageIndonesian: 'Bahasa Indonesia — later',
    languageHint: 'Indonesian domain terms such as Tersangka and Saksi stay as they are.',
    performanceOverlay: 'Performance overlay',
    performanceOverlayHint: 'Frame rates, meter frames and running loops. Debug builds only; this run of the app only.',
  },
  notifications: {
    intro: 'Choose which alert toasts this device shows.',
    categories: {
      devices: { label: 'Cameras and microphones', hint: 'Camera loss, MIC no signal, MIC clipping' },
      storage: { label: 'Storage', hint: 'Storage running low' },
      time: { label: 'Time sources', hint: 'GNSS loss and time fallback' },
      system: { label: 'Enclosure and system', hint: 'Tamper, fan stall, audit-chain warnings' },
    },
    critical: 'Critical alerts',
    criticalHint: 'Storage full, power failure, TPM failure and security faults.',
  },
  security: {
    biometric: 'Biometric sign-in',
    biometricAvailable: 'Fingerprint enrolled on this device.',
    biometricUnavailable: 'This device has no biometric hardware.',
    biometricChecking: 'Checking biometric hardware…',
    biometricBoundOther: 'Now bound to {{name}}. Turning it on binds it to you.',
    autoLock: 'Auto-lock',
    autoLockMinutes: '{{count}} min',
    autoLockHint: 'Fixed at 15 minutes by the demo policy. Other values need Core support.',
    pairing: 'Core pairing',
    audit: 'Operator audit',
    auditHint: 'Sign-in, export and fault records',
    sessionGroup: 'This console',
    signOutHint: 'Signing out never stops a recording on the Core.',
  },
  maintenance: {
    diagnosticsTitle: 'Diagnostics',
    runDiagnostics: 'Run diagnostics',
    lastRun: 'Last run {{time}}: {{pass}} passed, {{warn}} attention, {{fail}} failed',
    diagnosticsSheetTitle: 'Run Diagnostics',
    updateCurrent: 'Installed v{{version}} · slot {{slot}}',
    updateAvailable: 'v{{version}} available',
    demoHiddenPresentation: 'Demo controls are hidden in presentation mode.',
    faultActiveHint: 'Active. Tap to clear it.',
    faultIdleHint: 'Tap to inject it.',
    loadScenario: 'Load',
  },
  about: {
    productTitle: 'Product',
    product: 'Product',
    softwareRelease: 'Software release',
    tabletApp: 'Tablet app',
    appBuild: 'App build',
    licences: 'Licences and credits',
    licencesOpen: 'Show licences',
    fonts: 'Fonts',
    fontsLine: 'Inter, Orbitron and JetBrains Mono, under the SIL Open Font License 1.1.',
    photo: 'Hero photograph',
    photoLine: 'Empty meeting room by Leandro Alamino, Pexels, under the Pexels License.',
    noticesFile: 'The full list is in THIRD_PARTY_NOTICES.md at the root of the repository.',
    stackDiagnostics: 'Stack diagnostics',
  },
  sheets: {
    close: 'Close',
  },
} as const satisfies ResourceTree;
