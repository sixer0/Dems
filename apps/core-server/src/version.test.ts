import { describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };
import { CORE_SERVER_VERSION } from './version';

describe('CORE_SERVER_VERSION', () => {
  it('is 0.2.0 and equals the version of the workspace manifest', () => {
    expect(CORE_SERVER_VERSION).toBe('0.2.0');
    expect(manifest.name).toBe('@dems/core-server');
    expect(manifest.version).toBe(CORE_SERVER_VERSION);
  });
});
