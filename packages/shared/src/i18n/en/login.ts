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
} as const satisfies ResourceTree;
