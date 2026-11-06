// DECISION D62 (ratified 2026-11-05): SMART ATTACH, the unit tests of the configuration. The four
// keys of the decision parse here and nowhere else; the gate is the point where a half-wired sweep
// dies at the boot rather than at the first timer. Off by default: an environment that names none
// of the keys gets exactly the configuration it had before D62.
import { describe, expect, it } from 'vitest';
import {
  CAMERA_SEGMENT_CIDR_PATTERN,
  ConfigError,
  Secret,
  createConfig,
  parseCameraAutoattach,
  parseCameraDefaultPassword,
  parseCameraDefaultUser,
  parseCameraSegmentCidr,
} from '../../../config';

/** The smallest input that reaches `createConfig` today: the keys D62 adds are all optional or off. */
const BASE = {
  port: 4420 as const,
  demoControls: false,
  logLevel: 'info' as const,
  dataDir: '/var/lib/dems',
  database: { host: '127.0.0.1', port: 4_432, database: 'dems', user: 'dems', password: new Secret('not-a-real-password') },
};

describe('D62: DEMS_CAMERA_AUTOATTACH', () => {
  it('is off for unset, empty and 0; on for 1; and any other word stops the boot', () => {
    expect(parseCameraAutoattach(undefined)).toBe(false);
    expect(parseCameraAutoattach('')).toBe(false);
    expect(parseCameraAutoattach('0')).toBe(false);
    expect(parseCameraAutoattach('1')).toBe(true);
    for (const junk of ['true', 'yes', '2', ' 1', '1 ']) {
      expect(() => parseCameraAutoattach(junk), junk).toThrowError(ConfigError);
    }
  });
});

describe('D62: DEMS_CAMERA_SEGMENT_CIDR', () => {
  it('takes the one form of a /24 and refuses every other shape', () => {
    expect(parseCameraSegmentCidr(undefined)).toBeNull();
    expect(parseCameraSegmentCidr('')).toBeNull();
    expect(parseCameraSegmentCidr('192.168.7.0/24')).toBe('192.168.7.0/24');
    expect(parseCameraSegmentCidr('10.0.0.0/24')).toBe('10.0.0.0/24');
    for (const junk of ['192.168.7.0/16', '192.168.7.1/24/24', '192.168.7/24', '192.168.7.256/24', '2001:db8::/24', 'example.com/24', ' 192.168.7.0/24']) {
      expect(() => parseCameraSegmentCidr(junk), junk).toThrowError(ConfigError);
    }
    // The pattern is the one the module's rule holds to: host bits are NOT refused here (the quad is a network literal), but the prefix must be 24.
    expect(CAMERA_SEGMENT_CIDR_PATTERN.test('192.168.7.11/24')).toBe(true);
  });
});

describe('D62: the bench pair', () => {
  it('names take 1 to 120 printable characters without surrounding space', () => {
    expect(parseCameraDefaultUser(undefined)).toBeNull();
    expect(parseCameraDefaultUser('')).toBeNull();
    expect(parseCameraDefaultUser('dems-bench')).toBe('dems-bench');
    for (const junk of [' padded ', 'x'.repeat(121), 'tab\there']) {
      expect(() => parseCameraDefaultUser(junk), JSON.stringify(junk)).toThrowError(ConfigError);
    }
  });

  it('the password is a Secret: it prints as [redacted] everywhere and only reveal() says it', () => {
    expect(parseCameraDefaultPassword(undefined)).toBeNull();
    expect(parseCameraDefaultPassword('')).toBeNull();
    const secret = parseCameraDefaultPassword('bench-secret-value') as Secret;
    expect(secret).toBeInstanceOf(Secret);
    expect(secret.reveal()).toBe('bench-secret-value');
    expect(String(secret)).not.toContain('bench-secret-value');
    expect(JSON.stringify({ secret })).not.toContain('bench-secret-value');
    expect(() => parseCameraDefaultPassword('x'.repeat(257))).toThrowError(ConfigError);
    expect(() => parseCameraDefaultPassword('line\nbreak')).toThrowError(ConfigError);
  });
});

describe('D62: the gate of createConfig', () => {
  it('an environment that names none of the keys is exactly the configuration before D62', () => {
    const config = createConfig(BASE);
    expect(config.cameraAutoattach).toBe(false);
    expect(config.cameraSegmentCidr).toBeNull();
    expect(config.cameraDefaultUser).toBeNull();
    expect(config.cameraDefaultPassword).toBeNull();
  });

  it('a sweep that is on without its segment is refused at the boot', () => {
    expect(() => createConfig({ ...BASE, cameraAutoattach: true })).toThrowError(ConfigError);
    try {
      createConfig({ ...BASE, cameraAutoattach: true });
    } catch (error) {
      expect((error as ConfigError).code).toBe('CAMERA_SEGMENT_CIDR_REQUIRED');
    }
    // On with its /24 boots; the pair stays optional.
    const on = createConfig({ ...BASE, cameraAutoattach: true, cameraSegmentCidr: '192.168.7.0/24' });
    expect(on.cameraAutoattach).toBe(true);
    expect(on.cameraSegmentCidr).toBe('192.168.7.0/24');
    // A segment without the flag is held but nothing sweeps: the flag is the door.
    const held = createConfig({ ...BASE, cameraSegmentCidr: '192.168.7.0/24' });
    expect(held.cameraAutoattach).toBe(false);
    expect(held.cameraSegmentCidr).toBe('192.168.7.0/24');
  });
});
