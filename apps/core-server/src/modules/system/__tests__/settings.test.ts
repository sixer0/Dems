// The pure parts of operation 68 (plan row W40; spec §7.14, §13.2; SR-82, AC-B-89): the patch a
// body gives, the names of the settings a call changed, and the fields of the log line. No app,
// no engine, no database.
import { SettingsSliceSchema, SettingsUpdateRequestSchema } from '@dems/shared/api';
import { DEFAULT_SETTINGS, ROLE_PERMISSIONS, updateSettingsPatch, type SettingsSlice, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../../plugins/authenticate';
import { SETTINGS_CHANGED_MESSAGE, SETTINGS_UNIT_LABEL, changedSettingsKeys, settingsChangeLine, settingsPatchOf } from '../settings';

const KEYS = ['presentationMode', 'timeFormat', 'notifyWarnings', 'notifySound'] as const;

/** The value a setting does not have in `settings`. */
function other<Key extends keyof SettingsSlice>(settings: SettingsSlice, key: Key): SettingsSlice[Key] {
  const value = settings[key];
  return (typeof value === 'boolean' ? !value : value === '24' ? '12' : '24') as SettingsSlice[Key];
}

describe('settingsPatchOf: what of a body reaches the hosted action', () => {
  it('the members of the settings slice are exactly the four the patch knows', () => {
    expect(Object.keys(SettingsSliceSchema.shape).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual([...KEYS].sort());
  });

  it('holds a member exactly when the body held it, with the body\'s value: each of the 16 subsets', () => {
    for (let mask = 0; mask < 1 << KEYS.length; mask += 1) {
      const body: Partial<SettingsSlice> = {};
      for (const [index, key] of KEYS.entries()) {
        if ((mask & (1 << index)) !== 0) Object.assign(body, { [key]: other(DEFAULT_SETTINGS, key) });
      }
      const patch = settingsPatchOf(body);
      expect(patch, `subset ${mask}`).toEqual(body);
      expect(Object.keys(patch).sort(), `subset ${mask}`).toEqual(Object.keys(body).sort());
      expect(patch).not.toBe(body);
    }
  });

  it('keeps a false and a "24": a member is taken by presence, not by truth', () => {
    expect(settingsPatchOf({ presentationMode: false, notifyWarnings: false, notifySound: false, timeFormat: '24' })).toEqual({
      presentationMode: false,
      notifyWarnings: false,
      notifySound: false,
      timeFormat: '24',
    });
  });

  it('takes nothing else of a body: a key the schema would have dropped is not handed on', () => {
    const body = { notifySound: true, theme: 'dark', operatorId: 'OPR-999', role: 'TECHNICIAN' } as Partial<SettingsSlice>;
    expect(settingsPatchOf(body)).toEqual({ notifySound: true });
  });

  it('what the contract\'s schema lets through is what the patch holds, and what it refuses never reaches it', () => {
    const parsed = SettingsUpdateRequestSchema.parse({ timeFormat: '12', theme: 'dark' });
    expect(settingsPatchOf(parsed)).toEqual({ timeFormat: '12' });
    for (const refused of [{ timeFormat: '13' }, { presentationMode: 'yes' }, { notifySound: 1 }, { notifyWarnings: null }, [], 'x', null]) {
      expect(SettingsUpdateRequestSchema.safeParse(refused).success, JSON.stringify(refused)).toBe(false);
    }
  });

  it('the simulator applies the patch as the body said: every single member, both ways', () => {
    for (const key of KEYS) {
      const state = { settings: DEFAULT_SETTINGS } as SimState;
      const next = updateSettingsPatch(state, settingsPatchOf({ [key]: other(DEFAULT_SETTINGS, key) }));
      expect(next.settings, key).toEqual({ ...DEFAULT_SETTINGS, [key]: other(DEFAULT_SETTINGS, key) });
      const back = updateSettingsPatch(next, settingsPatchOf({ [key]: DEFAULT_SETTINGS[key] }));
      expect(back.settings, key).toEqual(DEFAULT_SETTINGS);
    }
  });
});

describe('changedSettingsKeys: the names of the settings a call changed', () => {
  it('names each member whose value differs, and only those: each of the 16 subsets, sorted', () => {
    for (let mask = 0; mask < 1 << KEYS.length; mask += 1) {
      const after = { ...DEFAULT_SETTINGS };
      const changed: string[] = [];
      for (const [index, key] of KEYS.entries()) {
        if ((mask & (1 << index)) === 0) continue;
        Object.assign(after, { [key]: other(DEFAULT_SETTINGS, key) });
        changed.push(key);
      }
      expect(changedSettingsKeys(DEFAULT_SETTINGS, after), `subset ${mask}`).toEqual(changed.sort());
    }
  });

  it('is empty for the same slice and for an equal one', () => {
    expect(changedSettingsKeys(DEFAULT_SETTINGS, DEFAULT_SETTINGS)).toEqual([]);
    expect(changedSettingsKeys(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual([]);
  });

  it('the order is the alphabet\'s, whatever the order of the slice\'s members', () => {
    const before: SettingsSlice = { timeFormat: '24', presentationMode: false, notifySound: false, notifyWarnings: false };
    const after: SettingsSlice = { timeFormat: '12', presentationMode: true, notifySound: true, notifyWarnings: true };
    expect(changedSettingsKeys(before, after)).toEqual(['notifySound', 'notifyWarnings', 'presentationMode', 'timeFormat']);
  });

  it('agrees with the simulator: what `updateSettingsPatch` changes is what is named, for every pair of a state and a patch', () => {
    const values: readonly SettingsSlice[] = [DEFAULT_SETTINGS, { presentationMode: true, timeFormat: '12', notifyWarnings: false, notifySound: true }];
    for (const before of values) {
      for (const key of KEYS) {
        for (const value of [DEFAULT_SETTINGS[key], other(DEFAULT_SETTINGS, key)]) {
          const next = updateSettingsPatch({ settings: before } as SimState, { [key]: value });
          expect(changedSettingsKeys(before, next.settings), `${key}`).toEqual(before[key] === value ? [] : [key]);
          // The simulator keeps the very object when nothing changed.
          expect(next.settings === before).toBe(before[key] === value);
        }
      }
    }
  });

  it('returns names only: no value of either slice is in the result', () => {
    const result = changedSettingsKeys(DEFAULT_SETTINGS, { presentationMode: true, timeFormat: '12', notifyWarnings: !DEFAULT_SETTINGS.notifyWarnings, notifySound: !DEFAULT_SETTINGS.notifySound });
    expect(result.every((name) => (KEYS as readonly string[]).includes(name))).toBe(true);
    expect(result).not.toContain('12');
    expect(result).not.toContain('24');
  });
});

describe('settingsChangeLine: the fields of the log line (SR-82)', () => {
  const operator: Principal = { kind: 'OPERATOR', operatorId: 'OPR-002', sessionId: 'auth-session-w40', deviceId: 'DEV-0007', role: 'SUPERVISOR', permissions: ROLE_PERMISSIONS.SUPERVISOR };

  it('holds the operator ID and the names, and nothing else of the caller: no session, no device, no role, no permission', () => {
    const line = settingsChangeLine(operator, ['notifySound', 'timeFormat']);
    expect(line).toEqual({ operatorId: 'OPR-002', changedKeys: ['notifySound', 'timeFormat'] });
    expect(Object.keys(line)).toEqual(['operatorId', 'changedKeys']);
    expect(JSON.stringify(line)).not.toMatch(/auth-session-w40|DEV-0007|SUPERVISOR|EVIDENCE/);
  });

  it('a caller that is no operator has no operator ID (stage 6 refuses such a caller before the handler; the engine refuses it again)', () => {
    expect(settingsChangeLine({ kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0001' }, ['timeFormat'])).toEqual({ operatorId: null, changedKeys: ['timeFormat'] });
    expect(settingsChangeLine({ kind: 'DEVICE', deviceId: 'DEV-0001' }, ['timeFormat'])).toEqual({ operatorId: null, changedKeys: ['timeFormat'] });
  });

  it('the message and the unit label are fixed texts', () => {
    expect(SETTINGS_CHANGED_MESSAGE).toBe('settings changed');
    expect(SETTINGS_UNIT_LABEL).toBe('system.updateSettings');
  });
});
