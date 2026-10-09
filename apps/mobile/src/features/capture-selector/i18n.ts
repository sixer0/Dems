import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `capture-selector` feature, mounted at `features.capture-selector.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Task 3, blueprint row 68 (M4-W4; ux spec §2 flow 1;
 * register MB-02, MB-08, MB-09, MB-10, MB-12).
 *
 * Why one tree of its own: the selector is drawn on two screens (Devices, Settings → Capture), and the
 * copy of the older feature trees (`devices`, `settings`, `audit`, ...) is held byte for byte by their
 * `*-live-static` tests ("the copy of Simulated mode is unchanged"). Every word this row adds therefore
 * lives here, also the few that other screens show: the role line of a microphone check (Session New),
 * the change line of an audit entry, and the camera clock rows of Network & Time.
 *
 * One wording in every mode: the selector is the Core's own configuration, in the simulator and on the
 * Core server alike, so nothing here says "simulated". Shared words come from `@dems/shared/i18n`
 * (`common.roles.*`, `common.actions.*`, `common.errors.maxRetries`) and `mobile.rbac.checking`.
 */
export const captureSelectorEn = {
  selector: {
    title: 'Capture Sources',
    subtitle: 'Which camera feeds each video track, and which microphone is primary.',
    label: 'Capture sources',
    track: {
      'VIDEO-01': 'Video track 1',
      'VIDEO-02': 'Video track 2',
    },
    role: {
      PRIMARY: 'Primary',
      STANDBY: 'Standby',
    },
    stream: {
      LIVE: 'Live',
      LOST: 'Lost',
      OFFLINE: 'Offline',
    },
    change: 'Change',
    changeCameraLabel: 'Change the camera of {{track}}',
    changeMicLabel: 'Change the primary microphone',
    pending: 'Saving…',
    empty: 'No capture devices configured',
    noPreview: 'Status only. A live preview of the cameras is not part of this phase.',
    lockedTitle: 'Configuration locked',
    waitingTitle: 'Waiting for the Core link',
    dismiss: 'Dismiss',
    gate: {
      denied: 'Requires the {{first}} or {{second}} role',
      locked: 'The capture configuration cannot be changed while a session is open.',
      waiting: 'Nothing can be changed until the Core link is back.',
    },
    noticeTitle: {
      locked: 'Configuration locked',
      denied: 'Not permitted',
      signedOut: 'You are signed out',
      notFound: 'Device not registered',
      developmentOnly: 'Source not allowed',
      invalid: 'Choice not accepted',
      notReady: 'Capture is not ready yet',
      offline: 'Core server unreachable',
      failed: 'The change was not saved',
    },
    notice: {
      signedOut: 'Sign in again to change the capture sources.',
      notFound: 'This device is no longer registered. Nothing was changed.',
      developmentOnly: 'This source can only be used in the development configuration.',
      invalid: 'The Core did not accept this choice. Nothing was changed.',
      notReady: 'The capture service is still starting. Nothing was changed.',
      offline: 'The Core did not answer. Check the capture sources once the link is back.',
      failed: 'The action could not be completed. Please try again.',
    },
    sheet: {
      cameraTitle: 'Camera for {{track}}',
      cameraBody: 'Registered cameras only. A camera found by a search is added on the web console first.',
      micTitle: 'Primary microphone',
      micBody: 'The other input becomes the standby.',
      feeds: 'Feeds {{track}}',
      save: 'Save',
      close: 'Close the source list',
    },
  },
  /** Settings → Capture (MB-09). */
  settings: {
    title: 'Capture',
    devicesLink: 'Open Devices & Inputs',
    devicesHint: 'Device status, health and diagnostics',
  },
  /** Session New pre-check (MB-02): the selector role of a microphone check, and the input that holds it. */
  precheck: {
    micRole: '{{role}} microphone · {{input}}',
  },
  /** Audit entry detail (MB-12): what a CAPTURE_CONFIG_CHANGED row changed. */
  audit: {
    change: 'Change',
    changeValue: '{{from}} → {{to}}',
  },
  /** Network & Time (MB-10): the camera clocks, per configured camera. */
  cameraClocks: {
    title: 'Camera Clocks',
    subtitle: 'Each camera clock against the Core clock.',
    offset: '{{value}} ms',
    notReported: 'Not reported yet',
    rowLabel: '{{device}}, offset {{value}}',
    none: 'No camera is configured.',
  },

  // ── Task 3 row 138 (flows 9, 11, 12, 13 on the tablet and the phone; ux spec §8c-§8g) ──────────
  // The texts are the ones `masterplan/08_client_ux_spec.md` §14.2 proposes, word for word. They live
  // in this tree, not under `common.*`: row 137 adds the web console's copy to the shared file in the
  // same wave (D95 §2 rule 3: own namespace only). Shared sentences that exist are reused, not copied:
  // `mobile.rbac.checking`, `common.coreErrors.limited`, `common.actions.retry`, `common.devices.*`.

  /** Flow 9: search for cameras (G13). No word of §14.1's "never shown" column appears here. */
  search: {
    title: 'Camera search',
    label: 'Camera search',
    action: 'Search for cameras',
    again: 'Search again',
    intro: 'Search the network for cameras. Searching connects to nothing.',
    searching: 'Searching the network for cameras…',
    searchingHint: 'This takes up to {{seconds}} seconds.',
    finishing: 'Finishing the search…',
    summary: '{{count}} found · {{newCount}} new · {{registeredCount}} already registered',
    networksSearched_one: 'Searched {{count}} network.',
    networksSearched_other: 'Searched {{count}} networks.',
    freshness: 'Searched at {{searchedAt}}. Kept until {{keptUntil}}.',
    ownerNote: 'Only you see this list, on this device.',
    trustNote: 'Make, model and name are what each device announced. They are not checked.',
    emptyTitle: 'No camera answered the search',
    emptyBody: 'Check that each camera is powered and on the same network as the Core, then search again.',
    truncated: 'More than {{max}} devices answered. The first {{max}} are listed.',
    failed: 'The search could not be completed. Nothing was changed.',
    unavailable: 'Camera search is not available on this Core yet.',
    busy: 'Another operator is searching right now. Search again when their search has finished.',
    expired: 'This search result is no longer kept. Search again to see the cameras.',
    recordingLocked: 'Camera search is not available while a session is recording.',
    waiting: 'Nothing can be searched until the Core link is back.',
    signedOut: 'Sign in again to search for cameras.',
    denied: 'Requires the {{first}} or {{second}} role',
    developmentGroup: 'Development sources',
    makeModelUnknown: 'Make and model not announced',
    status: {
      NEW: 'New',
      REGISTERED: 'Already registered',
    },
    registeredAs: 'Already registered as {{device}}',
    notTestable: 'Cannot be connected',
    notTestableBody: 'This device announced an address that is not its own.',
    conflict: 'Two devices announce the same identity. Neither can be connected.',
    addressChanged: 'This camera now answers from another address than the registered one.',
    viewDevice: 'View device',
    rowLabel: '{{address}}, {{makeModel}}, {{status}}',
    openSearch: 'Search for cameras',
    openSearchHint: 'Opens Devices at the camera search',
    a11y: {
      progress: 'Camera search in progress',
      done: 'Search finished: {{count}} found, {{newCount}} new.',
    },
  },
  /** Flow 10 on the tablet and the phone: the pointer only (D80(3)). No field, no dialog. */
  connect: {
    action: 'Connect',
    webOnly: 'Connect this camera from the web console.',
    webOnlyNote: 'Camera passwords are entered on the web console only. Open Devices on the web console and search there.',
    actionLabel: 'Connect {{address}}. Connect this camera from the web console.',
  },
  /** Flow 11: the no-device notifications, told apart by `params.reason` (never by a fault kind). */
  notice: {
    discoveryEmpty: {
      title: 'No camera found',
      body: 'The last search found no camera on the network.',
    },
    unreachable: {
      precheck: {
        title: '{{device}} is not reachable',
        camera_one: 'It did not answer the pre-check. A search found {{count}} camera.',
        camera_other: 'It did not answer the pre-check. A search found {{count}} cameras.',
        cameraNoCount: 'It did not answer the pre-check.',
        microphone: 'It did not answer the pre-check.',
      },
      sessionStart: {
        title: '{{device}} is not connected',
        body: 'The session is recording one camera only.',
      },
    },
    cause: {
      UNREACHABLE: 'It did not answer.',
      AUTHENTICATION_FAILED: 'It refused the stored password. Set the camera password again on the web console.',
      NOT_CONNECTED: 'It did not connect in time.',
      PERMISSION_DENIED: 'macOS has not allowed access for the Core.',
      DEVICE_BUSY: 'Another application is using it.',
      DEVICE_NOT_FOUND: 'It was not found.',
      OPEN_FAILED: 'It could not be opened.',
      HELPER_EXITED: 'It could not be opened.',
    },
    start: {
      noCamera: 'No camera is reachable. A session cannot start.',
      oneCamera: '{{device}} is not reachable. The session will record one camera only.',
      noMicrophone: 'No microphone is reachable. A session cannot start.',
      activeMicrophone: '{{device}} is the active microphone and is not reachable. Cancel this session, make {{other}} the primary microphone on Devices, then start again.',
      activeMicrophoneFallback: '{{device}} is the active microphone and is not reachable. Cancel this session, make the other microphone the primary microphone on Devices, then start again.',
      noStandby: '{{device}} is not reachable. The session will record with no standby microphone.',
      oneMicrophone: '{{device}} is not reachable. The session will record with one microphone and no standby.',
      notRecordable: '{{device}} cannot be recorded by this version of the system.',
    },
    searchCount_one: 'A search found {{count}} camera.',
    searchCount_other: 'A search found {{count}} cameras.',
    device: '{{name}} ({{id}})',
    unreachableValue: 'Not reachable',
    listLabel: 'Capture notifications',
  },
  /** Flow 12: one badge everywhere; "Core Mac's …" on the tablet and the phone (D83, OP-125-7). */
  source: {
    badge: 'Development source',
    kind: {
      localCamera: "Core Mac's camera",
      localMicrophone: "Core Mac's microphone",
      test: 'Test source',
    },
    label: '{{badge}}, {{kind}}',
  },
  localDevice: {
    state: {
      READY: 'Ready',
      PERMISSION_DENIED: 'Permission needed',
      DEVICE_BUSY: 'In use',
      DEVICE_NOT_FOUND: 'Not found',
      OPEN_FAILED: 'Could not be opened',
      HELPER_EXITED: 'Could not be opened',
      ABSENT: 'Not found',
    },
    permissionCamera: 'macOS has not allowed camera access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Camera, allow it, then search again.',
    permissionMicrophone: 'macOS has not allowed microphone access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Microphone, allow it, then search again.',
    busyCamera: 'Another application is using this camera. Close that application, then search again.',
    busyMicrophone: 'Another application is using this microphone. Close that application, then search again.',
    notFoundCamera: "Core Mac's camera was not found.",
    notFoundMicrophone: "Core Mac's microphone was not found.",
    openFailedCamera: "Core Mac's camera could not be opened. Check its permission on the Mac that runs the Core, then search again.",
    openFailedMicrophone: "Core Mac's microphone could not be opened. Check its permission on the Mac that runs the Core, then search again.",
    absentMicrophone: 'This microphone is not connected to the Core.',
  },
  /** Flow 13: the re-read of the local inputs (G17). */
  inputs: {
    again: 'Search again',
    againLabel: 'Search again for microphones',
    description: 'Re-reads the microphones connected to the Core. Microphones are not searched on the network.',
    checkedAt: 'Checked at {{time}}',
    unregistered_one: '{{count}} other microphone is connected to the Core but not registered.',
    unregistered_other: '{{count}} other microphones are connected to the Core but not registered.',
    notReady: 'Capture is not ready yet',
    failed: 'The microphones could not be read. Nothing was changed.',
    result: '{{input}}: {{state}}',
  },
} as const satisfies ResourceTree;
