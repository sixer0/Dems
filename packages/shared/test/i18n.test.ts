// Step 34 (SCR-05; 01_specs §14.11; 04_mobile_specs §9): the shared English resources are
// one plain, deep-mergeable object with 13 namespaces, keep the Indonesian domain terms
// verbatim, and follow the copy decisions (D28/Q3, D38 "End Session", research/04 §9 #2).
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AuditEventKind,
  BootRecoveryState,
  CoreLinkState,
  EvidenceLifecycleStage,
  FinalizationStep,
  FinalizationStepLabel,
  HealthCategory,
  HeartbeatState,
  LensState,
  MicState,
  MicStateLabel,
  NetworkDomain,
  NetworkDomainLabel,
  PowerFailState,
  SecurityState,
  SessionState,
  StorageState,
  TimeQuality,
  TimeSource,
  TrackId,
  TrackRecState,
  UpdateStep,
  UpdateStepLabel,
} from '../src/domain/enums';
import {
  DEFAULT_LANGUAGE,
  SHARED_NAMESPACES,
  en,
  mergeResources,
  type ResourceTree,
} from '../src/i18n';

const EN_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/en');

/** File name → namespace key (kebab-case file, camelCase key). */
const NAMESPACE_FILES: Record<string, string> = {
  'common.ts': 'common',
  'shell.ts': 'shell',
  'login.ts': 'login',
  'dashboard.ts': 'dashboard',
  'session.ts': 'session',
  'session-new.ts': 'sessionNew',
  'evidence.ts': 'evidence',
  'devices.ts': 'devices',
  'storage.ts': 'storage',
  'network-time.ts': 'networkTime',
  'security-audit.ts': 'securityAudit',
  'system.ts': 'system',
  'api-reference.ts': 'apiReference',
};

/** Every leaf as [dotted key, value]. Fails on anything that is not a string or plain object. */
function leaves(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree !== 'object' || tree === null || Array.isArray(tree)) {
    throw new TypeError(`${prefix || '<root>'} is not a plain object`);
  }
  if (Object.getPrototypeOf(tree) !== Object.prototype) {
    throw new TypeError(`${prefix || '<root>'} has a non-plain prototype`);
  }
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.push([path, value]);
    else out.push(...leaves(value, path));
  }
  return out;
}

/** i18next-style lookup with the default `.` key separator. */
function lookup(tree: ResourceTree, key: string): string | ResourceTree | undefined {
  let node: string | ResourceTree | undefined = tree;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node;
}

const allLeaves = leaves(en);
const allText = allLeaves.map(([, value]) => value);

describe('shared i18n resources: structure', () => {
  it('has exactly 13 namespace files and one en key per file', () => {
    const files = readdirSync(EN_DIR).filter((name) => name.endsWith('.ts')).sort();
    expect(files).toEqual(Object.keys(NAMESPACE_FILES).sort());
    expect(Object.keys(en).sort()).toEqual(Object.values(NAMESPACE_FILES).sort());
    expect([...SHARED_NAMESPACES].sort()).toEqual(Object.values(NAMESPACE_FILES).sort());
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('is a plain object tree of strings that survives JSON and structured cloning', () => {
    expect(allLeaves.length).toBeGreaterThan(400);
    expect(JSON.parse(JSON.stringify(en))).toEqual(en);
    expect(structuredClone(en)).toEqual(en);
  });

  it('deep-merges with a sample mobile namespace without touching en', () => {
    const before = JSON.stringify(en);
    const enMobile = {
      mobile: {
        tabs: { home: 'Home', sessions: 'Sessions' },
        biometric: { prompt: 'Confirm your identity' },
      },
      common: { actions: { holdToEnd: 'Hold to end' } },
    } as const;

    const merged = mergeResources(en, enMobile);

    // Mobile keys are added, shared keys stay, and a nested override extends (not replaces).
    expect(lookup(merged, 'mobile.tabs.home')).toBe('Home');
    expect(lookup(merged, 'mobile.biometric.prompt')).toBe('Confirm your identity');
    expect(lookup(merged, 'common.actions.holdToEnd')).toBe('Hold to end');
    expect(lookup(merged, 'common.actions.endSession')).toBe('End Session');
    expect(lookup(merged, 'dashboard.activeSession.idle.title')).toBe('No active session');
    expect(merged.common.subjectType.TERSANGKA).toBe('Tersangka');
    expect(leaves(merged)).toHaveLength(allLeaves.length + 4);

    // The inputs are unchanged and the result shares no objects with them.
    expect(JSON.stringify(en)).toBe(before);
    expect(merged.common).not.toBe(en.common);
    expect(merged.common.actions).not.toBe(en.common.actions);
    (merged.common.brand as Record<string, unknown>).name = 'changed';
    expect(en.common.brand.name).toBe('DEMS Edge Client');
  });

  it('lets an overlay leaf replace a shared leaf and ignores prototype keys', () => {
    const overlay = JSON.parse(
      '{"common":{"actions":{"cancel":"Dismiss"}},"__proto__":{"polluted":"yes"}}',
    ) as ResourceTree;
    const merged = mergeResources(en, overlay) as unknown as ResourceTree;
    expect(lookup(merged, 'common.actions.cancel')).toBe('Dismiss');
    expect(en.common.actions.cancel).toBe('Cancel');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });
});

describe('shared i18n resources: enum coverage', () => {
  it('labels every value of the book enums in src/domain/enums.ts', () => {
    const pairs: [string, Record<string, string>, Record<string, string>][] = [
      ['sessionState', SessionState, en.common.enums.sessionState],
      ['coreLinkState', CoreLinkState, en.common.enums.coreLinkState],
      ['lensState', LensState, en.common.enums.lensState],
      ['micState', MicState, en.common.enums.micState],
      ['storageState', StorageState, en.common.enums.storageState],
      ['storageRecordingState', StorageState, en.common.enums.storageRecordingState],
      ['timeSource', TimeSource, en.common.enums.timeSource],
      ['timeQuality', TimeQuality, en.common.enums.timeQuality],
      ['securityState', SecurityState, en.common.enums.securityState],
      ['trackRecState', TrackRecState, en.common.enums.trackRecState],
      ['heartbeatState', HeartbeatState, en.common.enums.heartbeatState],
      ['evidenceLifecycleStage', EvidenceLifecycleStage, en.common.enums.evidenceLifecycleStage],
      ['finalizationStep', FinalizationStep, en.common.enums.finalizationStep],
      ['updateStep', UpdateStep, en.common.enums.updateStep],
      ['powerFailState', PowerFailState, en.common.enums.powerFailState],
      ['bootRecoveryState', BootRecoveryState, en.common.enums.bootRecoveryState],
      ['networkDomain', NetworkDomain, en.common.enums.networkDomain],
      ['healthCategory', HealthCategory, en.common.enums.healthCategory],
      ['auditEventKind', AuditEventKind, en.common.enums.auditEventKind],
      ['tracks', TrackId, en.common.tracks],
    ];
    for (const [name, enumObject, labels] of pairs) {
      const missing = Object.values(enumObject).filter((value) => !(value in labels));
      expect(missing, `common.enums.${name} misses values`).toEqual([]);
    }
  });

  it('keeps the book labels where the book gives display text', () => {
    expect(en.common.enums.finalizationStep).toEqual(FinalizationStepLabel);
    expect(en.common.enums.updateStep).toEqual(UpdateStepLabel);
    expect(en.common.enums.micState).toEqual(MicStateLabel);
    expect(en.common.enums.networkDomain).toEqual(NetworkDomainLabel);
  });
});

describe('shared i18n resources: language and copy rules', () => {
  it('keeps the Indonesian subject types verbatim with EN glosses (D28/Q3)', () => {
    expect(en.common.subjectType).toEqual({
      TERSANGKA: 'Tersangka',
      SAKSI: 'Saksi',
      LAINNYA: 'Lainnya',
    });
    expect(en.common.subjectTypeGloss).toEqual({
      TERSANGKA: 'Suspect',
      SAKSI: 'Witness',
      LAINNYA: 'Other',
    });
    expect(Object.keys(en.common.subjectTypeGloss)).toEqual(Object.keys(en.common.subjectType));
  });

  it('keeps the other Indonesian domain terms verbatim', () => {
    expect(en.devices.other.recordingLamp).toBe('SEDANG MEREKAM');
    expect(en.devices.other.recordingLampGloss).toBe('Recording in progress');
    expect(allText.some((text) => text.includes('LP/'))).toBe(true);
  });

  it('uses "End Session" as the one label for ending a session (D38; research/04 §9 #27)', () => {
    expect(en.common.actions.endSession).toBe('End Session');
    expect(en.session.actions.endSession.title).toBe('End Session');
    expect(en.session.actions.endSession.confirm).toBe('End Session');
    expect(en.common.actions.startNewSession).toBe('Start New Session');
    const offenders = allLeaves.filter(([, text]) => /\bstop\s+(session|recording)\b/i.test(text));
    expect(offenders).toEqual([]);
  });

  it('fixes the mockup typo: "Pause Monitoring" (research/04 §9 #2)', () => {
    expect(en.session.actions.pauseMonitoring.title).toBe('Pause Monitoring');
    expect(allText.filter((text) => /montioring/i.test(text))).toEqual([]);
  });

  it('shows storage as USED with "free of" wording (D28/Q1)', () => {
    expect(en.common.storage.usedLabel).toBe('USED');
    expect(en.common.storage.freeOf).toBe('{{free}} free of {{total}}');
  });
});

describe('shared i18n resources: i18next syntax', () => {
  it('has no empty values and no stray whitespace', () => {
    const bad = allLeaves.filter(([, text]) => text.trim() === '' || text !== text.trim());
    expect(bad).toEqual([]);
  });

  it('uses well-formed {{name}} placeholders only', () => {
    const bad = allLeaves.filter(([, text]) => {
      const withoutPlaceholders = text.replace(/\{\{[A-Za-z][A-Za-z0-9]*\}\}/g, '');
      return /[{}]/.test(withoutPlaceholders);
    });
    expect(bad).toEqual([]);
  });

  it('pairs every _one plural with an _other form', () => {
    const keys = new Map(allLeaves);
    const ones = allLeaves.filter(([key]) => key.endsWith('_one'));
    expect(ones.length).toBeGreaterThan(0);
    for (const [key] of ones) {
      expect(keys.get(key.replace(/_one$/, '_other')), `${key} has no _other form`).toBeDefined();
    }
    const others = allLeaves.filter(([key]) => key.endsWith('_other'));
    expect(others).toHaveLength(ones.length);
  });
});
