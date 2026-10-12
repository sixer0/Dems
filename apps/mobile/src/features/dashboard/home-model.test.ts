// Home view model and choreography (step 77; 04_mobile_specs §4.3, §3.7, §7.3; D28/Q1, D28/Q2, D61).
import { describe, expect, it } from '@jest/globals';
import type { SessionHistoryEntry } from '@dems/shared/sim';
import { FULL_MOTION, REDUCED_MOTION, SLOW_MOTION } from '@/motion';
import {
  START_SESSION_HREF,
  cameraTileFor,
  chipRowFor,
  clockText,
  displaySecondsOfDay,
  durationText,
  flagLineFor,
  homeChipKey,
  homeStatusFor,
  homeStatusOf,
  offlineTile,
  QUIET_HOME_FACTS,
  type HomeFacts,
  idSuffix,
  MIC_NO_LEVEL_TEXT,
  micReadoutKind,
  micTileFor,
  micTileSourceRole,
  primaryActionFor,
  recentRowsFor,
  storageTileFor,
  subjectTypeFor,
  whenKeyFor,
} from './home-model';
import { HOME_BEATS, beatAt, beatDelay, homeEnter, valueTickDelay } from './home-motion';
import { PANEL_MAX_RETRIES, panelRetryCooldownMs } from './panel-boundary';

/** The builder internals the assertions read (Reanimated's ComplexAnimationBuilder). */
interface BuilderFields {
  getDelay(): number;
  build(): () => { initialValues: Record<string, unknown> };
}
const fields = (builder: unknown) => builder as BuilderFields;

/** 2026-10-01 10:00 WIB. */
const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);

function entry(overrides: Partial<SessionHistoryEntry>): SessionHistoryEntry {
  return {
    id: 'SES-20261001-0023',
    outcome: 'SEALED',
    caseNumber: 'LP/2026/0930-0006',
    subjectName: 'Subject',
    subjectType: 'SAKSI',
    investigatorId: 'OPR-001',
    room: 'Interview Room 1',
    profileId: 'STANDARD' as SessionHistoryEntry['profileId'],
    createdAt: NOW - 3_600_000,
    startedAt: NOW - 3_500_000,
    endedAt: Date.UTC(2026, 9, 1, 2, 35, 0),
    durationMs: 1_200_000,
    sizeBytes: 1,
    evidenceId: 'EV-20261001-0013',
    faultKind: null,
    ...overrides,
  };
}

describe('H2 status', () => {
  it('maps each system state to its ring state, tone and copy', () => {
    expect(homeStatusFor({ state: 'READY', flags: [] })).toMatchObject({ ring: 'ready', tone: 'success', copyKey: 'features.dashboard.status.READY' });
    expect(homeStatusFor({ state: 'ATTENTION', flags: [] })).toMatchObject({ ring: 'attention', tone: 'warning' });
    expect(homeStatusFor({ state: 'CRITICAL', flags: [] })).toMatchObject({ ring: 'critical', tone: 'danger' });
    expect(homeStatusFor({ state: 'RECORDING', flags: [] })).toMatchObject({ ring: 'recording', tone: 'danger' });
    expect(homeStatusFor({ state: 'UNKNOWN', flags: [] })).toMatchObject({ ring: 'offline', tone: 'default' });
  });

  // Fix wave J (JA2-04, JT-01; truth rule 3c): Home is ONE pure function of the Core's facts. Each row is a
  // situation a judge met; `not` is what Home said before the fix.
  describe('homeStatusOf: one statement per combination of facts', () => {
    const READY: HomeFacts['system'] = { state: 'READY', flags: [] };
    const flag = (id: string, severity: 'CRITICAL' | 'WARNING') => ({ id, severity, message: id });
    const facts = (over: Partial<HomeFacts>): HomeFacts => ({ ...QUIET_HOME_FACTS, system: READY, ...over });
    const RETRY = { kind: 'RETRYING', sessionId: 'SES-20261011-0088', sentence: 'retry 1 of 3, in 30 s' } as const;
    const BLOCK = { kind: 'BLOCKED', sessionId: 'SES-20261011-0088', sentence: 'Sealing of this session is blocked.' } as const;
    const CAM2 = { kind: 'camera', trackId: 'VIDEO-02', deviceId: 'CAM-02' } as const;
    const WARN_FACT = { id: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', severity: 'WARNING', message: 'The evidence volume does not confirm full synchronisation.', blocksRecording: null } as const;
    const CRIT_FACT = { id: 'CAPTURE_DISCOVERY_EMPTY', severity: 'CRITICAL', message: 'No capture device answers.', blocksRecording: null } as const;
    const CRIT_NOT_BLOCKING = { ...CRIT_FACT, id: 'NOTICE_ONLY', blocksRecording: false } as const;
    const rows: readonly [string, HomeFacts, { presentation: string; ring: string; tone: string; chip: string; live: boolean; startBlock: string | null }][] = [
      ['JA2-04: the Core link is cut on an idle, healthy Home', facts({ linkOffline: true }), { presentation: 'OFFLINE', ring: 'offline', tone: 'default', chip: 'features.dashboard.status.OFFLINE.chip', live: false, startBlock: 'OFFLINE' }],
      ['JA2-04: the link is cut while a session records', facts({ linkOffline: true, system: { state: 'RECORDING', flags: [] }, sessionState: 'RECORDING' }), { presentation: 'OFFLINE', ring: 'offline', tone: 'default', chip: 'features.dashboard.status.OFFLINE.chip', live: false, startBlock: 'OFFLINE' }],
      ['the link is cut while a critical fault was shown: still "state unknown"', facts({ linkOffline: true, system: { state: 'CRITICAL', flags: [flag('STORAGE_FULL', 'CRITICAL')] } }), { presentation: 'OFFLINE', ring: 'offline', tone: 'default', chip: 'features.dashboard.status.OFFLINE.chip', live: false, startBlock: 'OFFLINE' }],
      ['JT-01 (a): a step of the seal failed and the Core retries it', facts({ seal: RETRY, sessionState: 'FINALIZING' }), { presentation: 'SEAL_RETRYING', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['the seal is blocked (the Core alert)', facts({ seal: BLOCK, sessionState: 'FINALIZING', system: { state: 'CRITICAL', flags: [] } }), { presentation: 'SEAL_BLOCKED', ring: 'critical', tone: 'danger', chip: 'common.systemState.CRITICAL', live: true, startBlock: null }],
      ['JT-01 (b): a camera on a line is not reachable and its alert is active', facts({ unreachable: [CAM2] }), { presentation: 'ATTENTION', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['a WARNING fact of systemTruthOf that nothing else states', facts({ coreFacts: [WARN_FACT] }), { presentation: 'ATTENTION', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['a CRITICAL fact of systemTruthOf', facts({ coreFacts: [CRIT_FACT] }), { presentation: 'CRITICAL_ALERT', ring: 'critical', tone: 'danger', chip: 'common.systemState.CRITICAL', live: true, startBlock: null }],
      ['a critical fault at rest (storage full)', facts({ system: { state: 'CRITICAL', flags: [flag('STORAGE_FULL', 'CRITICAL')] } }), { presentation: 'CRITICAL', ring: 'critical', tone: 'danger', chip: 'common.systemState.CRITICAL', live: true, startBlock: 'CRITICAL' }],
      ['a critical fault while a session records', facts({ system: { state: 'CRITICAL', flags: [flag('CAMERA_VIDEO-01', 'CRITICAL')] }, sessionState: 'RECORDING' }), { presentation: 'CRITICAL', ring: 'critical', tone: 'danger', chip: 'common.systemState.CRITICAL', live: true, startBlock: 'CRITICAL' }],
      ['RECORDING before the first durable fragment', facts({ system: { state: 'RECORDING', flags: [] }, sessionState: 'RECORDING', connecting: true }), { presentation: 'CAMERAS_CONNECTING', ring: 'offline', tone: 'default', chip: 'common.session.trackConnecting', live: true, startBlock: null }],
      ['a session records, with a warning flag and a warning alert', facts({ system: { state: 'RECORDING', flags: [flag('MIC_AUDIO-01_NO_SIGNAL', 'WARNING')] }, sessionState: 'RECORDING', coreFacts: [WARN_FACT] }), { presentation: 'RECORDING', ring: 'recording', tone: 'danger', chip: 'common.systemState.RECORDING', live: true, startBlock: null }],
      ['a CRITICAL fact the Core marks "does not block recording": attention, not critical', facts({ coreFacts: [CRIT_NOT_BLOCKING] }), { presentation: 'ATTENTION', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['a warning flag at rest', facts({ system: { state: 'ATTENTION', flags: [flag('STORAGE_LOW', 'WARNING')] } }), { presentation: 'ATTENTION', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['an open unsealable notice on a healthy Core', facts({ openNotices: 1 }), { presentation: 'NOTICE', ring: 'attention', tone: 'warning', chip: 'features.session-finalizing.openNotice.chip', live: true, startBlock: null }],
      ['a notice AND an unreachable camera: the camera is said first', facts({ openNotices: 1, unreachable: [CAM2] }), { presentation: 'ATTENTION', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['a retried seal AND an unreachable camera: the seal is said first', facts({ seal: RETRY, sessionState: 'FINALIZING', unreachable: [CAM2] }), { presentation: 'SEAL_RETRYING', ring: 'attention', tone: 'warning', chip: 'common.systemState.ATTENTION', live: true, startBlock: null }],
      ['CONTROL: nothing of the above', facts({}), { presentation: 'READY', ring: 'ready', tone: 'success', chip: 'common.systemState.READY', live: true, startBlock: null }],
      ['the system slice is not read yet', facts({ system: { state: 'UNKNOWN', flags: [] } }), { presentation: 'UNKNOWN', ring: 'offline', tone: 'default', chip: 'common.systemState.UNKNOWN', live: true, startBlock: null }],
    ];
    it.each(rows)('%s', (_name, input, expected) => {
      const status = homeStatusOf(input);
      expect({ presentation: status.presentation, ring: status.ring, tone: status.tone, chip: homeChipKey(status), live: status.live, startBlock: status.startBlock }).toEqual(expected);
    });

    it('READY is said ONLY when no fact stands against it (every other row of the table differs from READY)', () => {
      const notReady = rows.filter(([name]) => !name.startsWith('CONTROL'));
      expect(notReady.length).toBe(rows.length - 1);
      for (const [name, input] of notReady) expect([name, homeStatusOf(input).presentation]).not.toEqual([name, 'READY']);
    });

    it('names its reason: the unreachable source by name and device, a fact of the Core in its own sentence', () => {
      expect(homeStatusOf(facts({ unreachable: [CAM2] })).flags).toEqual([
        { id: 'UNREACHABLE_VIDEO-02', severity: 'WARNING', key: 'features.dashboard.flags.sourceNotReachableDevice', params: { deviceId: 'CAM-02' }, nameKey: 'common.devices.camera2' },
      ]);
      // A fact of the Core is drawn in the Core's own sentence.
      expect(homeStatusOf(facts({ coreFacts: [WARN_FACT] })).flags).toEqual([{ id: 'FACT_EVIDENCE_VOLUME_SYNC_NOT_FULL_0', severity: 'WARNING', key: '', params: { message: WARN_FACT.message } }]);
      // While a session records its own telemetry words the sources: no "not reachable" line from the registry.
      expect(homeStatusOf(facts({ system: { state: 'RECORDING', flags: [] }, sessionState: 'RECORDING', unreachable: [CAM2] })).flags).toEqual([]);
    });

    it('a tile without the link draws no count and says "Not known"', () => {
      const tile = offlineTile({ ...cameraTileFor({ camerasOnline: 1, camerasTotal: 2 }), reported: true });
      expect(tile).toEqual({ id: 'camera', value: 1, total: 2, tone: 'default', stateKey: 'features.dashboard.tiles.state.unknown', href: '/devices', unknown: true });
    });
  });

  it('lists critical flags before warnings', () => {
    const status = homeStatusFor({
      state: 'CRITICAL',
      flags: [
        { id: 'STORAGE_LOW', severity: 'WARNING', message: 'Evidence storage low' },
        { id: 'POWER_FAIL', severity: 'CRITICAL', message: 'Power fail' },
      ],
    });
    expect(status.flags.map((f) => f.id)).toEqual(['POWER_FAIL', 'STORAGE_LOW']);
  });

  it('turns every systemStatus() flag family into an i18n line (never a raw id)', () => {
    expect(flagLineFor({ id: 'STORAGE_FULL', severity: 'CRITICAL', message: 'x' })).toMatchObject({ key: 'features.dashboard.flags.STORAGE_FULL' });
    expect(flagLineFor({ id: 'CAMERA_VIDEO-02', severity: 'CRITICAL', message: 'Camera 2 offline' })).toMatchObject({
      key: 'features.dashboard.flags.cameraOffline',
      nameKey: 'common.devices.camera2',
    });
    expect(flagLineFor({ id: 'MIC_AUDIO-02_CLIP', severity: 'WARNING', message: 'x' })).toMatchObject({
      key: 'features.dashboard.flags.micClip',
      nameKey: 'common.devices.mic2',
    });
    expect(flagLineFor({ id: 'MIC_AUDIO-01_NO_SIGNAL', severity: 'WARNING', message: 'x' })).toMatchObject({
      key: 'features.dashboard.flags.micNoSignal',
      nameKey: 'common.devices.mic1',
    });
    expect(flagLineFor({ id: 'TIME_FALLBACK', severity: 'WARNING', message: 'Time source NTP' })).toMatchObject({
      key: 'features.dashboard.flags.TIME_FALLBACK',
      params: { source: 'NTP' },
    });
    expect(flagLineFor({ id: 'SOMETHING_NEW', severity: 'WARNING', message: 'New thing' })).toMatchObject({ key: '', params: { message: 'New thing' } });
  });
});

describe('H3 tiles', () => {
  it('camera: online / total, danger with the offline count', () => {
    expect(cameraTileFor({ camerasOnline: 2, camerasTotal: 2 })).toMatchObject({ value: 2, total: 2, tone: 'success', stateKey: 'online', href: '/devices' });
    expect(cameraTileFor({ camerasOnline: 1, camerasTotal: 2 })).toMatchObject({ value: 1, tone: 'danger', stateKey: 'offline', count: 1 });
  });

  it('microphone: ready count; no signal and clip (incl. the latch) warn', () => {
    expect(micTileFor([{ state: 'READY', clipLatched: false }, { state: 'READY', clipLatched: false }])).toMatchObject({ value: 2, total: 2, tone: 'success' });
    expect(micTileFor([{ state: 'READY', clipLatched: false }, { state: 'READY', clipLatched: true }])).toMatchObject({ value: 2, stateKey: 'clipping', tone: 'warning' });
    expect(micTileFor([{ state: 'NO_SIGNAL', clipLatched: false }, { state: 'CLIP', clipLatched: true }])).toMatchObject({ value: 0, stateKey: 'noSignal' });
  });

  // Task 3 M5, row 73 (MB-01, B15, E-14).
  it('MIC tile level line (B15): "No signal" needs the microphone\'s own state; a flat frame alone is "no level"', () => {
    expect(micReadoutKind({ frameFlat: false, state: 'READY' })).toBe('LEVEL');
    expect(micReadoutKind({ frameFlat: false, state: 'NO_SIGNAL' })).toBe('LEVEL');
    expect(micReadoutKind({ frameFlat: true, state: 'NO_SIGNAL' })).toBe('NO_SIGNAL');
    expect(micReadoutKind({ frameFlat: true, state: 'READY' })).toBe('NO_LEVEL');
    expect(micReadoutKind({ frameFlat: true, state: 'CLIP' })).toBe('NO_LEVEL');
    expect(/signal/i.test(MIC_NO_LEVEL_TEXT)).toBe(false);
    // Round two (J-S 6): a frame marked `notMeasured` has `noSignal: false` and the floor as a placeholder - no level.
    expect(micReadoutKind({ frameFlat: false, state: 'READY', notMeasured: true })).toBe('NO_LEVEL');
    expect(micReadoutKind({ frameFlat: false, state: 'NO_SIGNAL', notMeasured: true })).toBe('NO_SIGNAL');
    expect(micReadoutKind({ frameFlat: false, state: 'READY', notMeasured: false })).toBe('LEVEL');
  });

  it('MIC tile source role: Active / Standby only while a session records', () => {
    expect(micTileSourceRole({ recording: true, inputId: 'MIC-01', activeInputId: 'MIC-01' })).toBe('ACTIVE');
    expect(micTileSourceRole({ recording: true, inputId: 'MIC-02', activeInputId: 'MIC-01' })).toBe('STANDBY');
    expect(micTileSourceRole({ recording: false, inputId: 'MIC-01', activeInputId: 'MIC-01' })).toBeNull();
    expect(micTileSourceRole({ recording: true, inputId: undefined, activeInputId: 'MIC-01' })).toBeNull();
  });

  it('task 4 row 171: a tile whose channel has no input says no role, and nothing is "Standby" to an absent active input', () => {
    expect(micTileSourceRole({ recording: true, inputId: null, activeInputId: 'MIC-01' })).toBeNull();
    expect(micTileSourceRole({ recording: true, inputId: 'MIC-02', activeInputId: null })).toBeNull();
    expect(micTileSourceRole({ recording: true, inputId: null, activeInputId: null })).toBeNull();
  });

  it('storage: USED percent (D28/Q1) with READY / LOW / FULL tones', () => {
    expect(storageTileFor({ usedPercent: 20, state: 'READY' })).toMatchObject({ value: 20, total: null, tone: 'success', stateKey: 'healthy', href: '/storage' });
    expect(storageTileFor({ usedPercent: 91, state: 'LOW' })).toMatchObject({ tone: 'warning', stateKey: 'low' });
    expect(storageTileFor({ usedPercent: 99, state: 'FULL' })).toMatchObject({ tone: 'danger', stateKey: 'full' });
  });
});

describe('H4 primary action (§3.7 table, one copy)', () => {
  it('Start Session when there is no session, or the sealed summary was acknowledged', () => {
    expect(primaryActionFor(null)).toEqual({ kind: 'start', labelKey: 'features.dashboard.actions.start', href: START_SESSION_HREF });
    expect(primaryActionFor('SEALED', { sessionId: 'SES-1', summaryAcknowledged: true }).kind).toBe('start');
  });

  it('leads back to the active session otherwise', () => {
    expect(primaryActionFor('RECORDING')).toMatchObject({ kind: 'returnLive', href: '/session/live' });
    expect(primaryActionFor('PRECHECK')).toMatchObject({ kind: 'continueSetup', href: '/session/new?step=2' });
    expect(primaryActionFor('ARMED')).toMatchObject({ kind: 'continueSetup', href: '/session/new?step=3' });
    expect(primaryActionFor('FINALIZING')).toMatchObject({ kind: 'finalizing', href: '/session/finalizing' });
    expect(primaryActionFor('FAULT')).toMatchObject({ kind: 'recovery', href: '/session/recovery' });
    expect(primaryActionFor('SEALED', { sessionId: 'SES-9', summaryAcknowledged: false })).toMatchObject({
      kind: 'summary',
      href: '/session/summary/SES-9',
    });
  });
});

describe('H5 recent rows', () => {
  it('shows the SESSION id the row opens (JA2-28: it showed the evidence id), "today" at UTC+07:00, the subject type and the poster suffix', () => {
    const rows = recentRowsFor([entry({})], NOW);
    expect(rows[0]).toMatchObject({
      sessionId: 'SES-20261001-0023',
      displayId: 'SES-20261001-0023',
      evidenceId: 'EV-20261001-0013',
      whenKey: 'today',
      time: '09:35',
      posterSuffix: '0013',
      outcome: 'SEALED',
    });
    expect(rows[0]!.subjectType.toUpperCase()).toBe('SAKSI');
  });

  it('falls back to the session id and no poster for an incomplete session; limits the count', () => {
    const history = [entry({ evidenceId: null, outcome: 'INCOMPLETE', id: 'SES-X' }), entry({}), entry({}), entry({})];
    const rows = recentRowsFor(history, NOW);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ displayId: 'SES-X', evidenceId: null, outcome: 'INCOMPLETE', posterSuffix: null });
  });

  it('decides today / yesterday / earlier on the WIB day, not the UTC day', () => {
    // 00:30 WIB on 1 Oct is 17:30 UTC on 30 Sep: still "today" in WIB.
    expect(whenKeyFor(Date.UTC(2026, 8, 30, 17, 30), NOW)).toBe('today');
    expect(whenKeyFor(Date.UTC(2026, 8, 30, 16, 59), NOW)).toBe('yesterday');
    expect(whenKeyFor(Date.UTC(2026, 8, 28, 3, 0), NOW)).toBe('earlier');
  });

  it('maps simulator subject types to the kit chip types without literals, and reads id suffixes', () => {
    expect(subjectTypeFor('TERSANGKA').toUpperCase()).toBe('TERSANGKA');
    expect(subjectTypeFor('LAINNYA').toUpperCase()).toBe('LAINNYA');
    expect(subjectTypeFor('UNKNOWN').toUpperCase()).toBe('LAINNYA');
    expect(idSuffix('EV-20261001-0007')).toBe('0007');
    expect(idSuffix(null)).toBeNull();
  });
});

describe('clock, timer and chips', () => {
  it('shows the sim clock at UTC+07:00 and elapsed time as HH:MM:SS', () => {
    const secondsOfDay = displaySecondsOfDay(NOW / 1000);
    expect(clockText(secondsOfDay)).toBe('10:00:00');
    expect(clockText(displaySecondsOfDay(Date.UTC(2026, 8, 30, 17, 0, 5) / 1000))).toBe('00:00:05');
    expect(durationText(3_725)).toBe('01:02:05');
    expect(durationText(-4)).toBe('00:00:00');
  });

  it('builds the Security, Time & Network chips (plus Storage on expanded)', () => {
    const chips = chipRowFor({ posture: 'SECURE', timeSource: 'GNSS', timeLocked: true, linkUp: true, storage: { usedPercent: 20, state: 'READY' } });
    expect(chips.map((c) => [c.id, c.tone, c.valueKey])).toEqual([
      ['security', 'success', 'common.posture.SECURE'],
      ['time', 'success', 'common.status.synchronized'],
      ['network', 'success', 'common.status.connected'],
      ['storage', 'success', 'common.storage.usedPercent'],
    ]);
    const degraded = chipRowFor({ posture: 'ATTENTION', timeSource: 'NTP', timeLocked: false, linkUp: false });
    expect(degraded.map((c) => c.tone)).toEqual(['warning', 'info', 'danger']);
    expect(degraded[1]!.valueKey).toBe('common.enums.timeSource.NTP');
  });

  // Fix wave J round two (JT-03 remainder; truth rule 3c): seen on the tablet - Home "Network: Connected" while
  // Network & Time said "Network: Not reported".
  it('a Core in its own capture (either of its two facts): the network chip reads "Not reported", neutral - never the model\'s link', () => {
    for (const own of [{ platformNotReported: true }, { hostClock: true }]) {
      for (const linkUp of [true, false]) {
        const network = chipRowFor({ posture: 'SECURE', timeSource: 'RTC', timeLocked: false, linkUp, ...own }).find((chip) => chip.id === 'network')!;
        expect([network.valueKey, network.tone]).toEqual(['common.platformNotReported.value', 'default']);
      }
    }
    // CONTROL - the simulated device keeps its link word.
    expect(chipRowFor({ posture: 'SECURE', timeSource: 'GNSS', timeLocked: true, linkUp: true }).find((chip) => chip.id === 'network')).toMatchObject({ valueKey: 'common.status.connected', tone: 'success' });
  });
});

describe('§7.3 Home choreography', () => {
  it('uses the spec beats, capped stagger, proof ×10 and no delay when reduced', () => {
    expect(HOME_BEATS).toMatchObject({ header: 0, status: 120, tiles: 250, tileStagger: 50, actions: 450, recent: 650, ringSweep: 900 });
    expect([0, 1, 2].map((i) => beatAt(HOME_BEATS.tiles, HOME_BEATS.tileStagger, i))).toEqual([250, 300, 350]);
    expect(beatAt(0, 10, 99)).toBe(70);
    expect(beatDelay(HOME_BEATS.ringSweep, FULL_MOTION)).toBe(900);
    expect(beatDelay(HOME_BEATS.ringSweep, SLOW_MOTION)).toBe(9_000);
    expect(beatDelay(HOME_BEATS.ringSweep, REDUCED_MOTION)).toBe(0);
  });

  it('delays the panel enter to its beat and starts numbers after the card settles plus the held beat', () => {
    expect(fields(homeEnter(HOME_BEATS.actions, FULL_MOTION)).getDelay()).toBe(450);
    expect(fields(homeEnter(HOME_BEATS.actions, REDUCED_MOTION)).getDelay()).toBe(0);
    expect(valueTickDelay(HOME_BEATS.tiles, FULL_MOTION)).toBe(250 + 420 + 120);
    expect(valueTickDelay(HOME_BEATS.tiles, REDUCED_MOTION)).toBe(0);
  });

  it('rises 12 px from transparent (R1)', () => {
    const built = fields(homeEnter(HOME_BEATS.status, FULL_MOTION)).build()();
    expect(built.initialValues).toMatchObject({ opacity: 0, transform: [{ translateY: 12 }] });
  });
});

describe('panel boundary retry policy', () => {
  it('backs off 3 s, 6 s, 12 s and caps at 3 retries', () => {
    expect([1, 2, 3].map(panelRetryCooldownMs)).toEqual([3_000, 6_000, 12_000]);
    expect(panelRetryCooldownMs(9)).toBe(15_000);
    expect(PANEL_MAX_RETRIES).toBe(3);
  });
});
