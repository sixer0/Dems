/**
 * `devices.*`: Devices & Inputs (01_specs §14.5.4; research/04 §5.2; design book §3 BOM rows
 * A.14–A.34, §4.2 front and rear panel, §7 ICD, §8 PoE budget). Device names and the kebab menu
 * are in `common.devices` and `common.deviceMenu`. "SEDANG MEREKAM" is the room lamp's Indonesian
 * label, kept verbatim (D28/Q3).
 *
 * Step 48 extended this file additively: every step-34 key keeps its value (the mobile Devices
 * screens share this namespace).
 *
 * Backend task W70 (Devices & Inputs in Live mode) added `devices.live.*`, additively: the words a
 * Live screen shows where the Simulated screen says "simulated" (04_client_integration_spec §3.2),
 * and the "Paired devices" row of the device drawer (§7.3 note G6).
 */
import type { ResourceTree } from '../resource-tree';

export const devices = {
  title: 'DEVICES & INPUTS',
  subtitle: 'Cameras, microphones and connected hardware in this interview room',
  banner: {
    allReady: 'All devices ready {{ready}}/{{total}}',
    attention_one: '{{count}} device needs attention',
    attention_other: '{{count}} devices need attention',
    readyDetail: 'Every input and link is operating normally',
    recordingDetail: 'Recording in progress · every input is captured',
    issueDetail: '{{device}}: {{status}}',
    moreIssues: '{{detail}} · +{{count}} more',
  },

  /** Device status words (chips, rows, drawer). */
  status: {
    READY: 'READY',
    FAULT: 'FAULT',
    NO_SIGNAL: 'NO SIGNAL',
    CLIP: 'CLIP',
    ACTIVE: 'ACTIVE',
    CONNECTED: 'CONNECTED',
    OFFLINE: 'OFFLINE',
    LOCKED: 'LOCKED',
    NO_FIX: 'NO FIX',
    OK: 'OK',
    FAILED: 'FAILED',
    STANDBY: 'STANDBY',
    LAMP_ON: 'SEDANG MEREKAM',
  },

  cameras: {
    title: 'Camera Devices',
    // D60 (2026-11-04): the capture surface carries four logical video tracks.
    subtitle: 'Dual-lens forensic camera · four logical video tracks',
    lens: 'Lens {{number}}',
    model: 'Dual-lens IP camera DL-2',
    format: 'Format',
    poePort: 'PoE port',
    bitrate: 'Bitrate',
    track: 'Track',
    feedAria: 'Live preview, {{name}}',
    openDetails: 'Open details for {{name}}',
  },

  summary: {
    title: 'Summary',
    cameras: 'Cameras',
    microphones: 'Microphones',
    otherDevices: 'Other devices',
    portsLinked: 'Ports linked',
    state: {
      ready: 'Ready',
      online: 'Online',
      linked: 'Linked',
      issue_one: '{{count}} issue',
      issue_other: '{{count}} issues',
    },
    detail: {
      cameras: 'Dual-lens DL-2 on PoE CAM 1',
      microphones: 'Balanced XLR · 48 V phantom',
      other: 'PoE · relay · tablet · GNSS · TPM',
      ports: '{{spare}} spare · {{disabled}} disabled by default',
    },
  },

  audio: {
    title: 'Audio Inputs',
    // D61 (2026-11-04): the microphone plane mirrors the video plane — four simultaneous channels.
    subtitle: 'Four independent balanced inputs · sample-synchronous 24-bit / 48 kHz',
    mic1: 'MIC 1 - Interviewer (Ch 1)',
    mic2: 'MIC 2 - Subject (Ch 2)',
    mic3: 'MIC 3 - Channel 3 (Ch 3)', // D61 (2026-11-04): the two further microphones
    mic4: 'MIC 4 - Channel 4 (Ch 4)', // D61
    gain: 'Gain',
    phantom: 'Phantom power',
    readOnly: 'Gain and phantom power are read-only in this demo.',
    peakHold: 'Peak hold',
    clipLatched: 'Clip latched',
    gainValue: '{{value}} dB',
    phantomOn: '48 V ON',
    phantomOff: 'OFF',
    input: 'Input',
    clip: 'Clip latch',
    clipClear: 'Clear',
    resetClip: 'Reset clip',
    clipHelp: 'Latches at −0.5 dBFS or above and holds until reset.',
    noSignalHelp: 'No signal on {{port}}. Check the XLR cable and the microphone.',
    recTrack: 'Recording track',
    scaleLabel: 'dBFS scale',
    /** Decisions D51 / D53: the level of a microphone while no session records (`holdIdleMeters`). */
    idleLevel: 'Level check – not recording',
    idleUnavailable: 'The level of this microphone cannot be shown while the Core is idle.',
  },

  /**
   * Decisions D51 / D53: the live camera preview (`createCameraPreviewSession`, MJPEG about 8 fps at
   * 640x360). Recording always has priority: the preview pauses while a session opens the camera.
   */
  preview: {
    connecting: 'Connecting to the camera…',
    live: 'Live preview',
    pausedForRecording: 'Preview paused: the recording has the camera',
    unavailable: 'The live preview of this camera is not available.',
    limit: 'Too many live previews are open. Close one and try again.',
    aria: 'Live preview of {{name}}. {{state}}',
    /**
     * Row 125 (DF-12, DF-13; decisions D19, D24): the Core's last reading found the camera unreachable
     * (`reach: NOT_REACHABLE`), so no automatic preview opens (row 130); `tryAgain` asks once more.
     * `checkedAt` dates the reading (`checkedAt` of the device entry).
     */
    notReachable: 'The camera did not answer. The live preview stays closed until you try again.',
    tryAgain: 'Try again',
    checkedAt: 'Checked at {{time}}',
  },

  other: {
    title: 'Other Devices',
    poeSwitch: 'PoE Switch',
    poePorts: '{{active}}/{{total}} Ports Active',
    poeSummary: '{{active}} active · {{spare}} spare',
    recordingIndicator: 'Recording Indicator',
    recordingLamp: 'SEDANG MEREKAM',
    recordingLampGloss: 'Recording in progress',
    relay: 'Relay output · room lamp',
    tabletControl: 'Operator device',
    tabletLink: 'MGMT LAN · HTTPS / WSS',
    tabletOfflineTitle: 'Operator device offline',
    tabletOfflineBody: 'Recording continues on the Core. Reconnect the device to regain control.',
    tabletOfflineIdleBody: 'Operator device offline. Nothing is recording on the Core. Reconnect the device to regain control.',
    gnss: 'GNSS Receiver',
    gnssLocked_one: 'Locked · {{count}} satellite',
    gnssLocked_other: 'Locked · {{count}} satellites',
    gnssLost: 'No fix · time from {{source}}',
    tpm: 'TPM 2.0 / Secure Element',
    tpmOk: 'Attestation OK · sealing enabled',
    tpmFail: 'Attestation failed · sealing and export blocked',
  },

  ports: {
    title: 'Port Map',
    subtitle: 'Rear panel connectors with link LEDs',
    poeCam1: 'PoE CAM 1',
    poeCam2: 'PoE CAM 2/AUX',
    // D60 (2026-11-04): the PoE switch carries four camera ports.
    poeCam3: 'PoE CAM 3',
    poeCam4: 'PoE CAM 4',
    mgmtLan: 'MGMT LAN',
    micIn: 'MIC IN 1/2',
    micIn1: 'MIC IN 1',
    micIn2: 'MIC IN 2',
    gnssSma: 'GNSS SMA',
    relayIo: 'Relay I/O',
    acInput: 'AC INPUT',
    serviceUsb: 'SERVICE USB',
    linkUp: 'Link up',
    linkDown: 'Link down',
    spare: 'Spare',
    disabled: 'Disabled',
    activity: 'Activity',
    tip: {
      poeCam1: 'Dual-lens camera · {{watts}} W of the 30 W port budget',
      poeCam2: 'Spare port · 0 W in normal use, reserve up to 30 W',
      // D60 (2026-11-04): the two further camera ports; no load until a camera feeds the track.
      poeCam3: 'Camera 3 track · up to the 30 W port budget',
      poeCam4: 'Camera 4 track · up to the 30 W port budget',
      mgmtLan: 'Tablet dock · HTTPS, WSS and preview · {{speed}} Mbps',
      micIn: 'Balanced XLR input · 48 V phantom',
      gnssSma: 'GNSS antenna · NMEA + PPS',
      relayIo: 'Recording lamp output and tamper input',
      acInput: 'Mains power input',
      serviceUsb: 'Service port · disabled by default',
    },
    portState: '{{port}}: {{state}}',
  },

  front: {
    title: 'Front Panel',
    subtitle: 'Local 800×480 status display and indicator LEDs',
    lcdLabel: 'Local status display (simulated), page {{page}}',
    ledsLabel: 'Front panel indicator LEDs',
    buttonsLabel: 'Display navigation',
    leds: {
      POWER: 'POWER',
      RECORD: 'RECORD',
      NETWORK: 'NETWORK',
      STORAGE: 'STORAGE',
      FAULT: 'FAULT',
    },
    ledState: {
      on: 'On',
      off: 'Off',
      activity: 'Activity',
      rec: 'Recording',
      warn: 'Warning',
      fault: 'Fault',
    },
    ledTip: '{{led}}: {{state}}',
    buttons: {
      up: 'UP',
      down: 'DOWN',
      enter: 'ENTER',
      back: 'BACK',
    },
    pages: {
      status: 'STATUS',
      network: 'NETWORK',
      storage: 'STORAGE',
      device: 'DEVICE',
    },
    lcd: {
      ready: 'READY',
      recording: 'REC',
      attention: 'ATTENTION',
      critical: 'FAULT',
      session: 'SESSION {{id}}',
      noSession: 'NO ACTIVE SESSION',
      inputs: 'CAM {{cams}}/{{camsTotal}}   MIC {{mics}}/{{micsTotal}}',
      time: '{{time}} UTC+07:00 · {{source}}',
      ip: 'IP {{ip}}',
      lan: '{{lan}} · {{speed}} Mbps',
      tablet: 'TABLET {{state}}',
      poe: 'PoE {{draw}} W / {{budget}} W',
      bandwidth: 'DOWN {{down}}   UP {{up}} Mbps',
      used: '{{percent}}% USED',
      free: '{{free}} FREE OF {{total}}',
      remaining: 'EST. {{hours}}h {{minutes}}m REMAINING',
      evidence: 'EVIDENCE HDD · {{state}}',
      deviceId: '{{id}} · {{room}}',
      firmware: 'FW v{{version}}',
      serial: 'SN {{serial}}',
      tpm: 'TPM {{state}} · SECURE BOOT {{boot}}',
      hint: 'UP/DOWN page · BACK home',
      page: '{{current}}/{{total}}',
      on: 'ON',
      off: 'OFF',
    },
  },

  drawer: {
    tabs: {
      overview: 'Overview',
      health: 'Health',
      log: 'Log',
    },
    signalQuality: 'Signal quality',
    linkQuality: 'Link quality',
    emptyLog: 'No log entries yet',
    tabsLabel: 'Device details',
    kind: {
      camera: 'Camera lens',
      microphone: 'Microphone',
      poe: 'PoE switch',
      relay: 'Relay output',
      tablet: 'Operator device',
      gnss: 'Time receiver',
      tpm: 'Security element',
      panel: 'Local display and LEDs',
    },
    field: {
      status: 'Status',
      deviceId: 'Device ID',
      model: 'Model',
      firmware: 'Firmware',
      port: 'Port',
      track: 'Track',
      format: 'Format',
      bitrate: 'Bitrate',
      recState: 'Recording track',
      gain: 'Gain',
      phantom: 'Phantom power',
      channel: 'Channel',
      adc: 'ADC',
      power: 'Power draw',
      budget: 'Budget',
      ports: 'Ports',
      lamp: 'Lamp',
      link: 'Link',
      since: 'Since',
      address: 'Address',
      pairing: 'Pairing',
      source: 'Time source',
      satellites: 'Satellites',
      stratum: 'Stratum',
      offset: 'Offset',
      lastSync: 'Last sync',
      ntp: 'NTP server',
      attestation: 'Attestation',
      secureBoot: 'Secure Boot',
      encryption: 'Encryption',
      display: 'Display',
      leds: 'LEDs',
      temperature: 'Core temperature',
      fan: 'Fan',
    },
    value: {
      adc: '24-bit / 48 kHz',
      display: '800×480 LCD · UP/DOWN/ENTER/BACK',
      leds: 'POWER · RECORD · NETWORK · STORAGE · FAULT',
      channel: 'Channel {{channel}}',
    },
    health: {
      linkQuality: 'Link quality (%)',
      signal: 'Signal level (dBFS, 1 s peak)',
      poeDraw: 'PoE draw (W)',
      relay: 'Relay output (1 = lamp on)',
      offset: 'Time offset (ms)',
      attestation: 'Attestation (%)',
      temperature: 'Core temperature (°C)',
      now: 'Now',
      samples_one: 'Simulated · {{count}} sample',
      samples_other: 'Simulated · last {{count}} samples',
      collecting: 'Collecting samples…',
      chartLabel: '{{metric}} over time',
    },
    log: {
      time: 'Time',
      event: 'Event',
      detail: 'Detail',
      label: 'Device log',
    },
  },

  /**
   * Task 3 M4 (blueprint row 67; ux §2 flow 1; C3 ops 76-80): the capture device selector of the web
   * console. OD-12 (no live preview of a real camera) was reversed by decisions D51 / D53: a camera
   * tile shows the live preview (`preview`), and the selector itself stays state text.
   */
  selector: {
    title: 'Capture Device Selector',
    // D61 (2026-11-04): four simultaneous channels - the panel names the channel of every microphone, it no longer crowns a primary.
    subtitle: 'Which camera feeds each video track, and which microphone stands on each channel',
    cameras: 'Cameras',
    mics: 'Microphones',
    sourceLabel: 'Camera for {{track}}',
    notAssigned: 'Not assigned',
    profile: 'Profile {{profile}}',
    transport: '{{transport}} input',
    online: 'Online',
    offline: 'Offline',
    stream: {
      LIVE: 'Stream live',
      LOST: 'Stream lost',
    },
    // D61 (2026-11-04): the roles became the numbered channels; the two keys name the
    // transcription pair (channels 1 and 2) the toggle trades.
    role: {
      PRIMARY: 'Channel 1 (transcribed)',
      STANDBY: 'Channel 2',
    },
    save: 'Save',
    // Audit row 143 (D5; D30 K-4; S5 §6): op 80 moves the microphone into Pair 1, the transcribed pair.
    makePrimary: 'Make Mic of Camera 1 (transcribed)',
    saved: 'Capture configuration saved',
    noPreview: 'Device state only here: the live preview of a camera is shown in its tile.',
    locked: 'The capture configuration cannot be changed while a session is open.',
    rolesJoin: 'or',
    /** ux §0, §11 (E-16): what a gated control shows while the role or the link is not resolved yet. */
    checking: 'Checking your permissions...',
    /** The entry of System & Maintenance, Settings, Device Settings (WB-07). */
    openFromSystem: 'Open the capture device selector',
    waitingLink: 'Waiting for the link to the Core server.',
    loading: 'Reading the capture configuration…',
    forbidden: 'Your role cannot read the capture configuration.',
    notReady: 'Capture is not ready yet',
    readFailed: 'The capture configuration could not be read.',
    empty: 'No capture devices configured',
    invalid: 'This choice was not accepted. Nothing was changed.',
    developmentOnly: 'This source can only be used in the development configuration.',
    unknownDevice: 'This device is no longer registered. Nothing was changed.',
    failed: 'The capture configuration could not be saved. Nothing was changed.',
    poe: {
      confirmTitle: 'Power-cycle {{name}}?',
      confirmBody: 'The PoE port of this camera is switched off and on again. Use it only when the stream is lost.',
      confirm: 'Power-cycle',
      requested: 'Power-cycle of {{name}} requested',
      notLost: 'The stream of this camera is not lost. Nothing was changed.',
    },
  },

  /**
   * Audit row 143 (D5; D27; register N-40 of masterplan/01_specs_d5.md; S5 §2.5, §6): the four
   * camera-microphone pairs. Pair N = camera `VIDEO-0N` <-> microphone channel `MIC-0N`, fixed by
   * number (`CAPTURE_PAIRS`); Pair 1 is transcribed. `n`, `to` and `from` are pair numbers 1..4;
   * `deviceId` and `other` are microphone ids. `micOfCamera` / `cameraOfMic` are the read-only
   * labels of the meters, the monitor audio panel and the precheck items; the /devices selector
   * (row 156) names every microphone slot by `micOfCamera` too (U-13: one label, not
   * "Microphone 3" here and "Channel 3" elsewhere).
   */
  pairs: {
    title: 'Camera and microphone pairs',
    rowLabel: 'Camera {{n}} <-> Mic {{n}}',
    transcribed: 'Transcribed',
    incomplete: 'Pair {{n}} is incomplete: recording needs a camera and a microphone',
    // Row 156 (D116, the final UI call): a device id already reads "MIC-0N", so the sentence says
    // "Microphone MIC-03", not "Mic MIC-03". One confirmed op 78 edit of two lines by channel (D22(3)).
    swapConfirm: 'Microphone {{deviceId}} moves to Pair {{to}}; microphone {{other}} moves to Pair {{from}}.',
    swapTitle: 'Swap the microphones of Pair {{from}} and Pair {{to}}?',
    swap: 'Swap',
    // Row 156: the target pair holds no microphone, so nothing comes back - the pair it leaves is incomplete.
    moveConfirm: 'Microphone {{deviceId}} moves to Pair {{to}}; Pair {{from}} is left without a microphone.',
    moveTitle: 'Move the microphone of Pair {{from}} to Pair {{to}}?',
    move: 'Move',
    // Row 156: an option of a mic select that another pair holds.
    onOtherPair: 'in Pair {{n}} - choosing it swaps the microphones',
    audioOf: 'Audio of Camera {{n}}',
    micOfCamera: 'Mic {{n}} (Camera {{n}})',
    cameraOfMic: 'Camera {{n}} (Mic {{n}})',
  },

  /**
   * Task 3, R-9 / R-10 (blueprint row 137; ux §8c, §8d, §8g): the words only the web console's
   * Devices page needs for the camera search and the connect dialog. The sentences web and mobile
   * share are `common.captureSearch.*`, `common.captureConnect.*` and their neighbours (ux §14.2).
   */
  search: {
    title: 'Camera Search',
    subtitle: 'Find cameras on the network and connect them',
    tableLabel: 'Cameras found',
    actions: 'Actions',
    lastTest: '{{outcome}} · {{time}}',
    notAnnounced: 'Not announced',
    notReachable: 'Not reachable',
    readFailed: 'The search result could not be read.',
    requestFailed: 'The request could not be completed. Nothing was saved.',
    rescanFailed: 'The microphones could not be re-read. Nothing was changed.',
    lockoutNoTime: 'Testing this camera is paused so that the camera does not lock its account.',
    openFromSystem: 'Search for cameras',
  },

  actions: {
    testSignalSent: 'Test signal sent to {{name}} (simulated)',
    restarted: '{{name}} restarted (simulated)',
    identifying: '{{name}} is blinking its indicator',
    clipReset: 'Clip latch reset on {{name}}',
    failed: 'The action could not be completed. Please try again.',
    restartWhileRecording: 'Not available while recording',
  },

  /**
   * Live mode (backend task W70; 04_client_integration_spec §3.2, §7.3 note G6, §8.3 B-7): the
   * Core server carries the device commands out and answers them, and the page shows the Core's
   * data, so nothing here says "simulated". Simulated mode keeps the words above and
   * `common.deviceMenu.*`.
   */
  live: {
    menu: {
      testSignal: 'Test signal',
      restart: 'Restart',
    },
    actions: {
      testSignalSent: 'Test signal sent to {{name}}',
      restarted: '{{name}} restarted',
    },
    lcdLabel: 'Local status display, page {{page}}',
    /** The camera picture's accessible name: the bundled demo loop (MS-1), not the Core's camera (plan row W0, item 7). */
    feedAria: '{{name}}, bundled demo picture',
    /**
     * The Health line's caption in Live mode, for both clients (closing copy round, decision D186 on
     * W83 ledger #90): the Core serves no per-device health history, so the line is derived on the
     * client from the Core's data. One sentence, true on the web and on the tablet. Simulated mode
     * keeps `drawer.health.samples_*`.
     */
    samples_one: "Derived from the Core's data · {{count}} sample",
    samples_other: "Derived from the Core's data · last {{count}} samples",
    /** The tablet row of the device drawer in Live mode (note G6): the web console does not pair. */
    pairedDevices: {
      label: 'Paired devices',
      summary: '{{paired}} paired, {{online}} online',
      open: 'Open Paired Devices',
      connected: 'A paired device is connected',
      none: 'No paired device is connected',
      loading: 'Reading the device registry…',
      unavailable: 'The device registry could not be read.',
    },
  },

  /**
   * Wave H, driver D, web console (gate 70; decision D196). `micLines`: G70-02, every registered
   * microphone on each of the four channels (operation 78, the replacing set; D61 of 2026-11-04:
   * the primary/standby lines became the four numbered channels). `noPreview`:
   * G70-03, the tile that stands where a camera picture would be on a Core in real capture.
   * `sourcesCheck`: G70-08, the reason of a pre-check / start control while the console does not
   * know the selector's device classes.
   */
  micLines: {
    // D61 (2026-11-04): keyed by the four numbered channels.
    label: {
      'MIC-01': 'Microphone for channel 1 (transcribed)',
      'MIC-02': 'Microphone for channel 2',
      'MIC-03': 'Microphone for channel 3',
      'MIC-04': 'Microphone for channel 4',
    },
    onOtherLine: {
      'MIC-01': 'on channel 1 - choose to move it here',
      'MIC-02': 'on channel 2 - choose to move it here',
      'MIC-03': 'on channel 3 - choose to move it here',
      'MIC-04': 'on channel 4 - choose to move it here',
    },
  },
  noPreview: {
    title: 'No preview',
    aria: '{{name}}. The live preview is not open. {{state}}',
  },
  sourcesCheck: {
    checking: 'Checking the capture sources…',
    failed: 'The capture sources could not be read. The device check and the start stay off until they are read.',
  },
} as const satisfies ResourceTree;
