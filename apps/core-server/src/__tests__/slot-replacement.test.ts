// `replace` of a seam or a request stage is test-only BY CONSTRUCTION (checkpoint findings
// CPB1-5 and CPS1-2; fix round B2b item 4). In-process, no database, no listener.
//
// An app that is built the way the entry point builds it (a configuration of `createConfig`,
// which is what `loadConfig` returns, and nothing that marks it) refuses every `replace`,
// whatever way the function is reached. An app built from a test configuration
// (`unitTestConfig()` of the neutral test support, which marks it) accepts it, as every test of
// the server relies on.
//
// The static half (who calls `buildApp`, who names the mark) is `test/static/slot-replacement.test.ts`.
import { describe, expect, it } from 'vitest';
import { unitTestConfig } from '../../test/support/config';
import { SlotReplacementRefused, buildApp, type StageHandler } from '../app';
import { Secret, createConfig, type CoreServerConfig } from '../config';
import { isTestConfiguration, testConfiguration } from '../test-configuration';

/** A configuration as `loadConfig` builds one: `createConfig`, and no mark. No database is opened. */
function productionLikeConfig(): CoreServerConfig {
  return createConfig({
    port: 4420,
    demoControls: false,
    logLevel: 'silent',
    dataDir: '/nonexistent/dems-unit-test-data',
    database: { host: '127.0.0.1', port: 1, database: 'dems_unit_test', user: 'dems_app', password: new Secret('unit-test-password') },
  });
}

const letThrough: StageHandler = () => {};

describe('an app built as the entry point builds it', () => {
  it('is not built from a test configuration', () => {
    expect(isTestConfiguration(productionLikeConfig())).toBe(false);
  });

  it('refuses to replace a request stage, before and after ready(), and the stage in place stays', async () => {
    const app = buildApp({ config: productionLikeConfig() });
    expect(() => app.stages.replace('accessRule', letThrough)).toThrow(SlotReplacementRefused);
    await app.ready();
    const inPlace = app.stages.get('accessRule');
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) {
      expect(() => app.stages.replace(stage, letThrough), stage).toThrow(
        `request stage "${stage}" cannot be replaced: this app was not built from a test configuration`,
      );
    }
    expect(app.stages.get('accessRule')).toBe(inPlace);
    expect(app.stages.get('accessRule')).not.toBe(letThrough);
    await app.close();
  });

  it('refuses the forms a search for `stages.replace(` does not see: a computed member, a destructured function, an alias', async () => {
    const app = buildApp({ config: productionLikeConfig() });
    await app.ready();
    const inPlace = app.stages.get('accessRule');

    expect(() => app.stages['replace']('accessRule', letThrough)).toThrow(SlotReplacementRefused);
    const { replace } = app.stages;
    expect(() => replace('accessRule', letThrough)).toThrow(SlotReplacementRefused);
    const alias = app.stages;
    expect(() => alias.replace('accessRule', letThrough)).toThrow(SlotReplacementRefused);
    expect(() => Reflect.apply(app.stages.replace, undefined, ['accessRule', letThrough])).toThrow(SlotReplacementRefused);

    expect(app.stages.get('accessRule')).toBe(inPlace);
    await app.close();
  });

  it('refuses to replace a seam as well', async () => {
    const app = buildApp({ config: productionLikeConfig() });
    await app.ready();
    const clock = app.clock;
    expect(() => app.seams.replace('clock', { now: () => 0 })).toThrow('seam "clock" cannot be replaced: this app was not built from a test configuration');
    expect(() => app.seams.replace('publish', () => {})).toThrow(SlotReplacementRefused);
    expect(app.clock).toBe(clock);
    await app.close();
  });

  it('cannot be made replaceable afterwards: the mark is read once, when buildApp starts', async () => {
    const config = productionLikeConfig();
    const app = buildApp({ config });
    testConfiguration(config);
    expect(isTestConfiguration(config)).toBe(true);
    expect(() => app.stages.replace('accessRule', letThrough)).toThrow(SlotReplacementRefused);
    expect(() => app.seams.replace('publish', () => {})).toThrow(SlotReplacementRefused);
    await app.close();
  });

  it('a copy of a test configuration is not a test configuration: the mark is the object\'s, not a member of it', async () => {
    const copy = { ...unitTestConfig() };
    expect(isTestConfiguration(copy)).toBe(false);
    const app = buildApp({ config: copy });
    expect(() => app.stages.replace('accessRule', letThrough)).toThrow(SlotReplacementRefused);
    await app.close();
  });
});

describe('an app built from a test configuration', () => {
  it('unitTestConfig() hands out a marked configuration, with and without overrides', () => {
    expect(isTestConfiguration(unitTestConfig())).toBe(true);
    expect(isTestConfiguration(unitTestConfig({ logLevel: 'info' }))).toBe(true);
    // The mark adds no member: the configuration is the frozen object `createConfig` returned.
    expect(Object.isFrozen(unitTestConfig())).toBe(true);
    expect(Reflect.ownKeys(unitTestConfig())).toEqual(Reflect.ownKeys(productionLikeConfig()));
  });

  it('replaces a stage and a seam, before and after ready(); replace wins over provide', async () => {
    const app = buildApp({ config: unitTestConfig() });
    app.stages.replace('accessRule', letThrough);
    await app.ready();
    expect(app.stages.get('accessRule')).toBe(letThrough);
    const fixed = { now: () => 42 };
    app.seams.replace('clock', fixed);
    expect(app.clock).toBe(fixed);
    await app.close();
  });
});
