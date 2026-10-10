// Fix wave H, closing pass Z1, item 3 (driver A decision 2; decision D207): manifest fields 20 / 21
// (the device id and name under the signature) were the SEED's stored record - `DEMS-IR-01`,
// `Interview Room 1` - on every installation. They are now the configured installation identity;
// not configured = `NOT_CONFIGURED`, as the serial number and the hardware UUID already say.
// REAL_PRODUCTION refuses to start without it (named error); REAL_DEVELOPMENT starts with a warning.
import { createSim } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { unitTestConfig } from '../../../test/support/config';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../test/static/scan';
import { CaptureOperation } from '../../capture/adapters';
import { ConfigError, ENV_INSTALLATION_DEVICE_ID, ENV_INSTALLATION_NAME, parseInstallationDeviceId, parseInstallationName } from '../../config';
import {
  INSTALLATION_IDENTITY_KEYS,
  INSTALLATION_NOT_CONFIGURED,
  InstallationIdentityError,
  installationIdentityOf,
  installationIdentityVerdictOf,
  manifestDeviceIdentityOf,
  runInstallationIdentityBoot,
} from '../installation-identity';
import { NOT_CONFIGURED, READ_SEAL_AUDIO_INTERVALS, READ_SEAL_AUDIT_ROWS, READ_SEAL_SOURCE_ROWS, createSealSessionReader, type SealStateView } from '../session-reader';

const SESSION = 'SES-20261010-9001';
const seeded = createSim({ storage: null, authStorage: null, scheduler: () => () => undefined }).store.getState();
const view: SealStateView = {
  ...seeded,
  session: {
    id: SESSION,
    state: 'FINALIZING',
    evidenceId: 'EV-20261010-0090',
    createdAt: 1_000,
    startedAt: 2_000,
    stoppedAt: 9_000,
    input: { caseNumber: 'LP/2026/1010-0090', subjectName: 'Test Subject', subjectType: 'SAKSI', investigatorId: seeded.operators[0]!.id },
    startTimeSource: 'RTC',
    captureConfig: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P30' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_720P30' }] },
  },
} as SealStateView;
const SOURCES = [
  { slot: 'MIC-PRIMARY', device_id: 'MIC-01', adapter_kind: 'FAKE' },
  { slot: 'MIC-STANDBY', device_id: 'MIC-02', adapter_kind: 'FAKE' },
  { slot: 'VIDEO-01', device_id: 'CAM-01', adapter_kind: 'FAKE' },
  { slot: 'VIDEO-02', device_id: 'CAM-02', adapter_kind: 'FAKE' },
];

async function deviceOf(identity?: { deviceId: string | null; name: string | null }) {
  const rows: Record<string, unknown[]> = { [READ_SEAL_SOURCE_ROWS]: SOURCES, [READ_SEAL_AUDIO_INTERVALS]: [{ seq: 1, mic_device_id: 'MIC-01', role: 'PRIMARY', from_media_ms: '21', to_media_ms: null, reason: 'START', switched_by: null }], [READ_SEAL_AUDIT_ROWS]: [] };
  const reader = createSealSessionReader({
    state: () => view,
    db: () => ({ query: async (text: string) => ({ rows: (rows[text] ?? []) as never[] }) }),
    begin: async () => undefined,
    sttSnapshot: async () => null,
    notice: 'NOTICE',
    timezone: '+07:00',
    ...(identity === undefined ? {} : { identity }),
  });
  const facts = await reader.read(SESSION);
  if (facts === null) throw new Error('the session was not read');
  return facts.device;
}

describe('manifest fields 20 / 21: the installation identity, never the seed record', () => {
  it('the seed record is in the state the reader reads (the test can fail)', () => {
    expect([seeded.device.id, seeded.device.name]).toEqual(['DEMS-IR-01', 'Interview Room 1']);
  });

  it('a configured identity is what the seal is handed', async () => {
    const device = await deviceOf({ deviceId: 'DEMS-JKT-07', name: 'Ruang Pemeriksaan 3' });
    expect([device.deviceId, device.name]).toEqual(['DEMS-JKT-07', 'Ruang Pemeriksaan 3']);
  });

  it('NOT configured: both fields say NOT_CONFIGURED, as the serial number and the hardware UUID do - and nothing of the seed record', async () => {
    for (const device of [await deviceOf({ deviceId: null, name: null }), await deviceOf()]) {
      expect([device.deviceId, device.name, device.serialNumber, device.hardwareUuid]).toEqual([NOT_CONFIGURED, NOT_CONFIGURED, NOT_CONFIGURED, NOT_CONFIGURED]);
      expect(JSON.stringify(device)).not.toContain(seeded.device.id);
      expect(JSON.stringify(device)).not.toContain(seeded.device.name);
    }
    expect(INSTALLATION_NOT_CONFIGURED).toBe(NOT_CONFIGURED);
  });

  it('half an identity states the half it has', async () => {
    const device = await deviceOf({ deviceId: 'DEMS-JKT-07', name: null });
    expect([device.deviceId, device.name]).toEqual(['DEMS-JKT-07', NOT_CONFIGURED]);
  });
});

describe('the one reader of the two settings, and what a start does without them', () => {
  it('reads both members of the configuration; an absent one is named by its key', () => {
    expect(installationIdentityOf(unitTestConfig({ installationDeviceId: 'DEMS-JKT-07', installationName: 'Ruang Pemeriksaan 3' }))).toEqual({ deviceId: 'DEMS-JKT-07', name: 'Ruang Pemeriksaan 3', configured: true, missing: [] });
    expect(installationIdentityOf(unitTestConfig({ installationDeviceId: null, installationName: null }))).toEqual({ deviceId: null, name: null, configured: false, missing: ['DEMS_INSTALLATION_DEVICE_ID', 'DEMS_INSTALLATION_NAME'] });
    expect(installationIdentityOf({ installationDeviceId: 'DEMS-JKT-07' }).missing).toEqual(['DEMS_INSTALLATION_NAME']);
    expect([INSTALLATION_IDENTITY_KEYS.deviceId, INSTALLATION_IDENTITY_KEYS.name]).toEqual([ENV_INSTALLATION_DEVICE_ID, ENV_INSTALLATION_NAME]);
    expect(manifestDeviceIdentityOf({ deviceId: null, name: 'X' })).toEqual({ deviceId: 'NOT_CONFIGURED', name: 'X' });
  });

  it('REAL_PRODUCTION without the identity REFUSES to start: INSTALLATION_IDENTITY_NOT_CONFIGURED, naming the settings; persisted before it throws', () => {
    const persisted: unknown[] = [];
    const sinks = { persist: (...entry: unknown[]) => void persisted.push(entry) };
    for (const config of [{ installationDeviceId: null, installationName: null }, { installationDeviceId: 'DEMS-JKT-07', installationName: null }]) {
      const identity = installationIdentityOf(config);
      expect(installationIdentityVerdictOf(identity, CaptureOperation.REAL_PRODUCTION).action).toBe('REFUSE');
      let thrown: unknown = null;
      try {
        runInstallationIdentityBoot(identity, CaptureOperation.REAL_PRODUCTION, sinks);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(InstallationIdentityError);
      expect((thrown as InstallationIdentityError).code).toBe('INSTALLATION_IDENTITY_NOT_CONFIGURED');
      expect((thrown as InstallationIdentityError).message).toContain('DEMS_INSTALLATION_NAME');
    }
    expect(persisted).toHaveLength(2);
    expect(persisted[0]).toMatchObject(['error', 'INSTALLATION_IDENTITY_NOT_CONFIGURED', expect.any(String), { operation: 'REAL_PRODUCTION', missing: 'DEMS_INSTALLATION_DEVICE_ID,DEMS_INSTALLATION_NAME' }]);
  });

  it('REAL_DEVELOPMENT without it starts with ONE warning; CONTROLS: configured passes silently in both real operations, SIMULATED is not asked', () => {
    const persisted: unknown[][] = [];
    const sinks = { persist: (...entry: unknown[]) => void persisted.push(entry) };
    const none = installationIdentityOf({});
    const both = installationIdentityOf({ installationDeviceId: 'DEMS-JKT-07', installationName: 'Ruang Pemeriksaan 3' });
    runInstallationIdentityBoot(none, CaptureOperation.REAL_DEVELOPMENT, sinks);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.slice(0, 2)).toEqual(['warn', 'INSTALLATION_IDENTITY_NOT_CONFIGURED']);
    runInstallationIdentityBoot(both, CaptureOperation.REAL_PRODUCTION, sinks);
    runInstallationIdentityBoot(both, CaptureOperation.REAL_DEVELOPMENT, sinks);
    runInstallationIdentityBoot(none, CaptureOperation.SIMULATED, sinks);
    expect(persisted).toHaveLength(1);
  });
});

describe('the two settings are held to their form when the configuration is built', () => {
  it('a device id of the contract\'s form and a printable name are taken; unset is null', () => {
    expect(parseInstallationDeviceId('DEMS-JKT-07')).toBe('DEMS-JKT-07');
    expect(parseInstallationName('Ruang Pemeriksaan 3')).toBe('Ruang Pemeriksaan 3');
    expect([parseInstallationDeviceId(undefined), parseInstallationDeviceId(''), parseInstallationName(undefined), parseInstallationName('')]).toEqual([null, null, null, null]);
  });

  it.each(['dems-jkt-07', 'DEMS_JKT_07', '7DEMS', 'DEMS JKT', `D${'X'.repeat(32)}`])('a device id of another form stops the start: %s', (value) => {
    expect(() => parseInstallationDeviceId(value)).toThrow(ConfigError);
    expect(() => unitTestConfig({ installationDeviceId: value })).toThrow(ConfigError);
  });

  it.each([' Room', 'Room ', 'Ro\nom', 'x'.repeat(121)])('a name that is not 1..120 printable characters stops the start', (value) => {
    expect(() => parseInstallationName(value)).toThrow(ConfigError);
  });
});

describe('ONE reader of the two settings (static rule)', () => {
  const READER = 'src/sealing-host/installation-identity.ts';
  const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
  const READ = /\.\s*installation(?:DeviceId|Name)\b/g;
  const VARIABLE = /DEMS_INSTALLATION_(?:DEVICE_ID|NAME)/g;
  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, READ, (path) => path !== READER && path !== 'src/config.ts').map((place) => `${place} reads the setting`),
    ...occurrences(files, VARIABLE, (path) => path !== READER && path !== 'src/config.ts' && path !== 'src/plugins/config/load-config.ts').map((place) => `${place} names the variable`),
  ];

  it('no production file but the reader reads `installationDeviceId` / `installationName`, and none but the reader and the two configuration files names the variables', () => {
    expect(production.some((file) => file.path === READER)).toBe(true);
    expect(violations(production)).toEqual([]);
  });

  it('CONTROL - a second reader is seen', () => {
    const planted: SourceFile[] = [{ path: 'src/modules/x/index.ts', text: 'const id = app.config.installationDeviceId;\nconst key = "DEMS_INSTALLATION_NAME";' }];
    expect(violations(planted)).toEqual(['src/modules/x/index.ts:1 reads the setting', 'src/modules/x/index.ts:2 names the variable']);
  });
});
