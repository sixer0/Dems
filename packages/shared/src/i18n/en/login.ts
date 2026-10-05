/**
 * `login.*`: the Login page (01_specs §14.8; research/04 §5.8). The brand side reuses
 * `common.brand` (overline, hero lines, pillars, triplet).
 */
import type { ResourceTree } from '../resource-tree';

export const login = {
  title: 'Sign in',
  subtitle: 'Authorised operators only',

  username: {
    label: 'Username',
    placeholder: 'Enter your username',
    required: 'Enter your username.',
  },
  password: {
    label: 'Password',
    placeholder: 'Enter your password',
    required: 'Enter your password.',
    show: 'Show password',
    hide: 'Hide password',
    capsLock: 'Caps Lock is on',
  },

  submit: 'Sign In',
  submitting: 'Signing in…',
  divider: 'or',

  securityKey: {
    button: 'Use security key (simulated)',
    prompt: 'Touch your security key… (simulated)',
  },

  demoOperators: {
    title: 'Demo operators',
    hint: 'Select an operator to fill the form.',
    password: 'Demo password: {{password}}',
  },

  trustLine: 'Console: {{deviceId}} • paired (simulated)',
  /** Step 43 (additive): the trust line when the simulator reports the console as not paired. */
  trustLineUnpaired: 'Console: {{deviceId}} • not paired (simulated)',
  trustTooltip: 'Certificate-bound console pairing (design book §20.1), simulated in this demo.',

  deviceStrip: {
    label: 'Appliance status',
    device: 'Device',
    room: 'Room',
    clock: 'Time',
    gnss: 'GNSS',
    coreLink: 'Core link',
    security: 'Security',
    /** Step 43 (additive): Core link value from the mock-core heartbeat (`useHeartbeat`). */
    coreLinkValue: {
      ONLINE: 'Online',
      CONNECTING: 'Connecting…',
      STALE: 'Stale',
      OFFLINE: 'Offline',
    },
    /** Step 43 (additive): time value keyed by the simulator's active time source. */
    gnssValue: {
      GNSS: 'Synchronized',
      NTP: 'NTP fallback',
      RTC: 'RTC only',
    },
  },

  errors: {
    invalid: 'Invalid username or password.',
    attemptsRemaining_one: '{{count}} attempt remaining',
    attemptsRemaining_other: '{{count}} attempts remaining',
    lockedTitle: 'Too many attempts',
    lockedBody: 'Try again in {{countdown}}.',
    coreOfflineTitle: 'Core service unreachable',
    coreOfflineBody: 'Core service unreachable at {{address}}.',
  },

  notices: {
    signedOut: 'You have been signed out.',
    sessionExpired: 'Your session expired after {{minutes}} minutes without activity. Sign in again.',
    /** Step 43 (additive): the operator used "Lock console" in the user menu. */
    consoleLocked: 'Console locked. Sign in again to continue.',
  },

  success: 'Signed in',
  /** Step 43 (additive): polite announcement while the hand-off into the console plays. */
  successAs: 'Signed in as {{name}}. Opening the console…',

  /**
   * Backend task W55 (04_client_integration_spec §5.5, §5.6, §6.4; additive): the Login page while
   * the console runs on the Core server (Live mode). No key above is read differently; a screen
   * that shows server data says nothing about a simulation (§3.2). The words of the data mode
   * itself, of the link and of a refused call are shared: `common.coreMode`, `common.coreLink`,
   * `common.coreErrors`.
   */
  live: {
    /** WS-7 (decision Q13): the web console does not pair. Neither "simulated" nor "paired" appears in the line. */
    trustLine: 'Core server on this computer • web console, no pairing required',
    trustTooltip:
      'This console signs in to the Core server with a session cookie. Only mobile devices are paired; see Paired Devices.',

    /** WS-9, condition C1 of SR-63: what the disclosure is, in plain words, above the list. */
    demoNotice: 'Published demo credentials for synthetic accounts on this local demo. They are not a secret.',

    /** WS-5: an anonymous client receives no Core state, so the strip shows what is public. */
    deviceStrip: {
      label: 'Core server status',
      service: 'Core service',
      database: 'Database',
      engine: 'Engine',
      mode: 'Mode',
      ready: 'Ready',
      notReady: 'Not ready',
      unknown: 'Unknown',
    },

    errors: {
      /** §3.5: the Core server answers, but its database or its engine is not ready yet. */
      startingBody: 'Sign-in is available when its database and its engine are ready.',
      /** The Core server refused the input itself (422): it is the judge of the bounds. */
      inputRejected: 'The Core server did not accept this username or password as entered.',
    },

    notices: {
      /** WS-14: the absolute limit of a session (8 hours). */
      absoluteExpired: 'Your session reached its 8-hour limit. Sign in again.',
      /** §6.4: `session.ended` with `USER_DISABLED`. */
      userDisabled: 'This account was disabled by an administrator.',
    },
  },
} as const satisfies ResourceTree;
