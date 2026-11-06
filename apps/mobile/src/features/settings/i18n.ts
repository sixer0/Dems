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
 *
 * Backend task W82 added, additively, `preferences.coreLinkHintLive*` (the third segment) and
 * `live.*` (the words of LIVE mode); no existing value changed. The closing copy round moved three of
 * the `live.*` words to the shared `system.live.*` (D177 DN-5).
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
    debugGroup: 'Developer',
    coreLinkHint: 'Simulated runs the Core inside the app. mock-core heartbeat follows the mock-core service on this computer.',
    // Backend task W82 (04_client_integration_spec §9.5): the line that follows the two hints above,
    // for the third segment. Fix wave J: the control shows in a development build only, so the two
    // release-build lines are gone.
    coreLinkHintLive: 'Live uses the Core server this device is linked to. The device must be paired.',
    performanceOverlay: 'Performance overlay',
    performanceOverlayHint: 'Frame rates, meter frames and running loops. This run of the app only.',
  },
  notifications: {
    intro: 'Choose which alert toasts this device shows.',
    categories: {
      // Fix wave Q (CP-06): a switch names only what it can silence. A camera loss is critical: it is listed below.
      devices: { label: 'Microphones', hint: 'MIC no signal, MIC clipping' },
      storage: { label: 'Storage', hint: 'Storage running low' },
      time: { label: 'Time sources', hint: 'GNSS loss and time fallback' },
      system: { label: 'Enclosure and system', hint: 'Tamper, fan stall' },
    },
    critical: 'Critical alerts — always shown',
    /** `kinds`: the names of `ALWAYS_SHOWN_KINDS`, from `common.faultKind.*`. The life is the toast's own sentence. */
    criticalHint: 'No switch silences these: {{kinds}}. A critical toast stays until its alert is acknowledged or the Core reports it resolved; the bell keeps the alert until it is acknowledged.',
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
    // D263 (row 236): read-only; set on the Pair screen before pairing.
    coreAddress: 'Core server address',
    audit: 'Operator audit',
    auditHint: 'Sign-in, export and fault records',
    sessionGroup: 'This console',
    signOutHint: 'Signing out never stops a recording on the Core.',
  },
  maintenance: {
    diagnosticsTitle: 'Diagnostics',
    runDiagnostics: 'Run diagnostics',
    lastRun: 'Last run {{time}}: {{pass}} passed, {{warn}} attention, {{fail}} failed',
    lastRunNotReported: 'Last run {{time}}: {{summary}}',
    diagnosticsSheetTitle: 'Run Diagnostics',
    updateCurrent: 'Installed v{{version}} · slot {{slot}}',
    updateAvailable: 'v{{version}} available',
    // Fix wave J (JT-06): the confirmation of "Install update".
    installConfirmTitle: 'Install update v{{version}}?',
    installConfirmBody: 'The Core runs its update sequence now: it verifies the package, installs it to the inactive system slot ({{slot}}) and restarts into it. No session can be started while it runs.',
    installConfirmSimulated: 'Simulated: no software is installed.',
    installConfirm: 'Install update',
    installCancel: 'Not now',
    demoHiddenPresentation: 'Demo controls are hidden in presentation mode.',
    faultActiveHint: 'Active. Tap to clear it.',
    faultIdleHint: 'Tap to inject it.',
    loadScenario: 'Load',
  },
  about: {
    productTitle: 'Product',
    product: 'Product',
    softwareRelease: 'Software release',
    tabletApp: 'Device app',
    appBuild: 'App build',
    // Round two (JW-26): the versions of the real components, each named for what it is.
    versions: {
      title: 'Versions',
      note: 'The Core server states its own versions. The mobile app states its own build.',
      core: 'Core server',
      captureWorker: 'Capture worker',
      apiContract: 'API contract',
      mobileApp: 'Mobile app',
    },
    // Fix wave J (JA2-29, N-02): the card's title without the specification reference of the shared key.
    identityTitle: 'Configuration identity',
    licences: 'Licences and credits',
    licencesOpen: 'Show licences',
    fonts: 'Fonts',
    fontsLine: 'Inter, Orbitron and JetBrains Mono, under the SIL Open Font License 1.1.',
    photo: 'Hero photograph',
    photoLine: 'Empty meeting room by Leandro Alamino, Pexels, under the Pexels License.',
    noticesFile: 'The full list of third-party notices is delivered with the software.',
    // Developer page (development build, presentation mode off).
    stackDiagnostics: 'Stack diagnostics (developer)',
  },
  sheets: {
    close: 'Close',
  },
  /**
   * LIVE mode (backend task W82; 04_client_integration_spec §3.2, MD-8; gateway rule 8): the Core
   * server carries the commands out and answers them, so nothing here says "simulated". SIMULATED
   * and HEARTBEAT mode keep the words above and the shared copy, unchanged. The dialog of a change
   * across the LIVE boundary (§3.3) uses the shared `common.coreMode.switch*` sentences, as the web
   * console does.
   */
  live: {
    // S5-7, the Profile sheet: the role's permissions are the Core's rules (the shared table the
    // Core is seeded from, [SP:AC-B-17]); the Core decides every call.
    permissions: 'Permissions',
    permissionsNote: 'The Core server checks every action against your role.',
    // S2-7: the Core's diagnostics run and update. The diagnostics subtitle, the Install label and the
    // started toast are the web console's shared `system.live.diagnosticsSubtitle`, `.install` and
    // `.startedToast` (row W76): this row's own three keys were merged into them in the closing copy
    // round (decision D177 DN-5, W83 ledger #92). The note has no web twin and stays here.
    updateNote: 'The Core server runs a demonstration update: no software is installed.',
    // AC-C-52: the Demo controls act on the Core, so every connected console sees them.
    demoNote: 'Demo only. Faults are injected on the Core server, and every connected console sees them.',
    demoFlagOff: 'Demo controls are turned off on the Core server. They appear when it runs with its demo flag on.',
    // Fix wave J (RBAC, one rule): a refusal names the role that may. DEMO_CONTROL is the Supervisor's
    // alone in the shared role table (`ROLE_PERMISSIONS`); `settings-live-static.test.ts` pins that.
    demoNotPermitted: 'The demo controls require the Supervisor role.',
    // CPM1-1: the Core or the tablet's storage did not take a change of the biometric switch; nothing changed.
    biometricFailed: 'Biometric sign-in was not changed on this device. Try again.',
  },
} as const satisfies ResourceTree;
