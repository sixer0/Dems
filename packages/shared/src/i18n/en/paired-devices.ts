/**
 * `pairedDevices.*`: the Paired Devices page, `/admin/devices` (backend task
 * 04_client_integration_spec §10.1 PG-10, §10.3). Live mode only. Plan row W54 wrote the words of
 * the page stub; the page row (W81) adds the key families of §10.3: `summary`, `issue.*`,
 * `devices.*`, `revoke.*`, `toasts.*` and the other `states.*`. The navigation label is
 * `shell.nav.pairedDevices`.
 *
 * No text here holds a pairing code, and none is ever interpolated with one: the code is shown
 * as plain digits by the page and never passed to a translation, a toast or a record (§10.3,
 * AC-C-96, AC-C-107).
 */
import type { ResourceTree } from '../resource-tree';

export const pairedDevices = {
  title: 'Paired Devices',
  subtitle: 'Tablets and phones allowed to operate this Core',
  /** The header chip (§10.3): PAIRED devices, and of them the online ones. */
  summary: '{{paired}} paired · {{online}} online',

  issue: {
    title: 'Pair a device',
    steps: {
      one: 'Issue a code here.',
      two: "Type it on the device's Pair screen.",
      three: 'The device appears in the list.',
    },
    button: 'Issue pairing code',
    codeLabel: 'Pairing code',
    qrLabel: 'QR code of the pairing code',
    caption: 'Type the six digits on the device. QR scanning is not part of this demo.',
    expiresIn: 'Expires in {{time}}',
    attemptsLeft_one: '{{count}} attempt left',
    attemptsLeft_other: '{{count}} attempts left',
    cancel: 'Cancel code',
    activeElsewhereTitle: 'A pairing code is active',
    activeElsewhere: 'A pairing code is active (issued by {{name}}, expires in {{time}}). The code itself is shown only once.',
    issueNew: 'Issue new code',
    issueNewHint: 'This replaces the active code.',
    pairedChip: 'Paired',
    redeemed: '{{deviceId}} · {{deviceName}} is paired.',
    issueAnother: 'Issue another code',
    expired: 'The code expired.',
    closed: 'The code was closed after five wrong attempts.',
    cancelled: 'The code was cancelled.',
    error: 'The pairing code could not be issued.',
  },

  devices: {
    title: 'Devices',
    tableLabel: 'Paired devices',
    filter: {
      label: 'Show',
      ALL: 'All',
      PAIRED: 'Paired',
      ENDED: 'Ended',
    },
    columns: {
      device: 'Device',
      platform: 'Platform and app version',
      state: 'State',
      operator: 'Operator',
      paired: 'Paired',
      lastSeen: 'Last seen',
      ended: 'Ended',
      action: 'Action',
    },
    state: {
      PAIRED: 'Paired',
      REVOKED: 'Revoked',
      UNPAIRED: 'Unpaired',
    },
    online: 'Online',
    offline: 'Offline',
    platformVersion: '{{platform}} · {{version}}',
    codeIssuedBy: 'code issued by {{name}}',
    lastSeen: {
      justNow: 'Just now',
      minutes_one: '{{count}} min ago',
      minutes_other: '{{count}} min ago',
      hours_one: '{{count}} h ago',
      hours_other: '{{count}} h ago',
      days_one: '{{count}} day ago',
      days_other: '{{count}} days ago',
    },
    revokedBy: 'Revoked by {{name}}',
    unpairedOnDevice: 'Unpaired on the device',
    revoke: 'Revoke…',
    revokeLabel: 'Revoke {{deviceId}}',
    empty: 'No device has been paired yet.',
    emptyHint: 'Issue a pairing code in "Pair a device" and type it on the tablet or phone.',
    emptyFiltered: 'No device matches this filter.',
    loading: 'Loading the device registry',
    error: 'The device registry could not be read.',
  },

  revoke: {
    title: 'Revoke device',
    body: 'Revoke {{deviceId}}? The device is signed out at once and must be paired again. A recording in progress continues on the Core.',
    reasonLabel: 'Reason',
    reasonPlaceholder: 'Why is this device revoked?',
    reasonTooShort: 'Enter a reason of at least {{min}} characters.',
    reasonRefused: 'The Core server did not accept this reason. Describe it in other words.',
    keep: 'Keep device',
    confirm: 'Revoke device',
  },

  toasts: {
    cancelled: 'Pairing code cancelled',
    cancelFailed: 'The pairing code could not be cancelled.',
    revoked: '{{deviceId}} revoked',
    alreadyEnded: 'The device was already revoked or unpaired.',
    revokeFailed: 'The device could not be revoked.',
  },

  states: {
    /** Under the heading `shell.liveOnly.title`. */
    liveOnly: 'Simulated mode has no device registry and issues no pairing code. Devices are paired with the Core server.',
    forbidden: 'Your role does not include this page.',
    toDashboard: 'Go to the Dashboard',
  },
} as const satisfies ResourceTree;
