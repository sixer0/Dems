// Backend task W59: the pure rules of `login-live-model.ts` and the static rule of the folder
// (04_client_integration_spec §9.2, §3.5, §8.1 LB-10; AC-C-53, AC-C-72, AC-C-104, AC-C-110).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import type { CoreLinkInfo, PairingInfo } from '@/runtime';
import { isLimitFailure, isLiveLogin, liveAttemptFor, liveOfflineNoticeAfter, liveTrustLineFor, liveTrustTextFor, type LiveSignInFailure } from './login-live-model';
import type { AttemptOutcome } from './login-model';

const link = (source: CoreLinkInfo['source']): CoreLinkInfo => ({ source, state: 'ONLINE' });
const pairing = (over: Partial<PairingInfo>): PairingInfo => ({ required: true, state: 'PAIRED', notice: null, deviceId: 'DEV-0003', ...over });
const failure = (over: Partial<LiveSignInFailure>): LiveSignInFailure => ({ kind: 'LIMIT', outage: false, label: null, description: null, ...over });

describe('isLiveLogin (§9.2)', () => {
  it('is true only when the runtime says the source is LIVE', () => {
    expect(isLiveLogin(link('LIVE'))).toBe(true);
    expect(isLiveLogin(link('SIMULATED'))).toBe(false);
    expect(isLiveLogin(link('HEARTBEAT'))).toBe(false);
  });
});

describe('the trust line of LIVE mode (L11, AC-C-72)', () => {
  it('names the device ID the Core gave this tablet, with "Pairing details"', () => {
    const text = liveTrustTextFor(liveTrustLineFor(pairing({}), 'DEMS-IR-01'));
    expect(text.textKey).toBe('features.login.live.trust.paired');
    expect(text.values).toEqual({ device: 'DEMS-IR-01', tablet: 'DEV-0003' });
    expect(text.linkKey).toBe('features.login.live.trust.details');
  });

  it('still names the device ID while the Core identity has not reached the replica', () => {
    const text = liveTrustTextFor(liveTrustLineFor(pairing({}), '   '));
    expect(text.textKey).toBe('features.login.live.trust.pairedUnnamed');
    expect(text.values).toEqual({ tablet: 'DEV-0003' });
  });

  it('says "not paired" when the gate is not PAIRED or holds no device ID', () => {
    expect(liveTrustLineFor(pairing({ state: 'UNPAIRED' }), 'DEMS-IR-01')).toEqual({ kind: 'unpaired' });
    expect(liveTrustLineFor(pairing({ deviceId: null }), 'DEMS-IR-01')).toEqual({ kind: 'unpaired' });
    const text = liveTrustTextFor({ kind: 'unpaired' });
    expect(text.textKey).toBe('features.login.live.trust.unpaired');
    expect(text.linkKey).toBe('mobile.pairing.link');
  });
});

describe('the offline Alert follows the link without flicker (§3.5, L9)', () => {
  it('OFFLINE and STALE show it, LIVE hides it, CONNECTING keeps what is shown', () => {
    expect(liveOfflineNoticeAfter(false, 'OFFLINE')).toBe(true);
    expect(liveOfflineNoticeAfter(false, 'STALE')).toBe(true);
    expect(liveOfflineNoticeAfter(true, 'LIVE')).toBe(false);
    expect(liveOfflineNoticeAfter(true, 'CONNECTING')).toBe(true); // a transient does not hide it
    expect(liveOfflineNoticeAfter(false, 'CONNECTING')).toBe(false); // a cold start does not flash it
    expect(liveOfflineNoticeAfter(false, undefined)).toBe(false);
  });
});

describe('a limit is not an outage and not a wrong password (LB-10, AC-C-110)', () => {
  it('recognises the limit kind only', () => {
    expect(isLimitFailure(failure({ kind: 'LIMIT' }))).toBe(true);
    expect(isLimitFailure(failure({ kind: 'OFFLINE', outage: true }))).toBe(false);
    expect(isLimitFailure(null)).toBe(false);
  });

  it('hides the screen\'s own Alert for a refused attempt on a limit', () => {
    const unavailable: AttemptOutcome = { kind: 'unavailable' };
    expect(liveAttemptFor(unavailable, failure({ kind: 'LIMIT' }))).toBeNull();
    expect(liveAttemptFor({ kind: 'biometric-error' }, failure({ kind: 'LIMIT' }))).toBeNull();
    // A wrong password is not masked by a limit that arrived alongside it.
    const invalid: AttemptOutcome = { kind: 'invalid', attemptsRemaining: 4 };
    expect(liveAttemptFor(invalid, failure({ kind: 'LIMIT' }))).toBe(invalid);
  });

  it('turns an unanswered sign-in into the presenter\'s two sentences', () => {
    const title = { key: 'mobile.live.refusal.offline' };
    const body = { key: 'mobile.live.refusal.offlineHint' };
    const out = liveAttemptFor({ kind: 'core-offline' }, { kind: 'OFFLINE', outage: true, label: title, description: body });
    expect(out).toEqual({ kind: 'no-answer', title, body });
  });

  it('leaves a link-down attempt alone when the auth layer sent nothing', () => {
    const offline: AttemptOutcome = { kind: 'core-offline' };
    expect(liveAttemptFor(offline, null)).toBe(offline);
  });
});

describe('the folder\'s production files read no simulator actions (AC-C-53, CLG (c))', () => {
  const FOLDER = __dirname;
  const productionFiles = (): string[] =>
    readdirSync(FOLDER).filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes('.test.') && !name.endsWith('.math.ts'));

  it('there is more than one production file to check', () => {
    expect(productionFiles().length).toBeGreaterThan(3);
  });

  it('no production file calls useSimActions or reads .actions outside a translation key', () => {
    for (const name of productionFiles()) {
      // Drop single-quoted string literals so i18n keys such as `common.actions.retry` do not count.
      const stripped = readFileSync(join(FOLDER, name), 'utf8').replace(/'[^']*'/g, "''");
      expect(stripped).not.toMatch(/useSimActions/);
      expect(stripped).not.toMatch(/\.actions\b/);
    }
  });
});
