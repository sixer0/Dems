// Step 34 (SCR-05; 01_specs §14.11; 04_mobile_specs §9): the shared English resources are
// one plain, deep-mergeable object with 15 namespaces, keep the Indonesian domain terms
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
import { CAPTURE_SELECTOR_SLOTS } from '../src/api/devices';
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
  'users-roles.ts': 'usersRoles',
  'paired-devices.ts': 'pairedDevices',
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
  it('every namespace file is registered and holds one en key (`NAMESPACE_FILES` is the list)', () => {
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

  // Fix wave J closing pass (J4, item 2; ruling D244): ONE lock sentence. The web console and the devices both read this key;
  // their tests pin the key, this test pins the ruled words.
  it('the Login notice after "Lock console" is the ruled sentence, and it is not the sign-out notice', () => {
    expect(en.login.notices.consoleLocked).toBe('Console locked — sign in to continue');
    expect(en.login.notices.consoleLocked).not.toBe(en.login.notices.signedOut);
    expect(allText.filter((text) => /console locked/i.test(text))).toEqual([en.login.notices.consoleLocked]);
  });

  // Task 4 row 28 (WP-13a; decision C18 (3); names register N13, N14): the words of an unassigned
  // selector slot. Both clients read these keys; their tests pin the key, this test pins the words.
  it('names the six selector slots and an empty one (`common.captureSlot`), and the pre-check sentence of an unassigned slot', () => {
    // D60 (2026-11-04): the selector names SIX slots - the four video tracks and the two mic roles.
    // Keyed by the values of `CAPTURE_SELECTOR_SLOTS`, in their order, then the three words.
    expect(Object.keys(en.common.captureSlot)).toEqual([...CAPTURE_SELECTOR_SLOTS, 'notAssigned', 'assign', 'assignLabel']);
    expect(en.common.captureSlot).toEqual({
      'VIDEO-01': 'Camera 1',
      'VIDEO-02': 'Camera 2',
      'VIDEO-03': 'Camera 3',
      'VIDEO-04': 'Camera 4',
      PRIMARY: 'Primary microphone',
      STANDBY: 'Standby microphone',
      notAssigned: 'Not assigned',
      assign: 'Assign',
      assignLabel: 'Assign a source to {{slot}}',
    });
    // One sentence for BLOCK and WARN: it names the slot and promises nothing about the start.
    expect(en.common.captureNotice.start.sourceNotAssigned).toBe('{{slot}} has no source assigned. Assign one on Devices.');
    expect(en.common.captureNotice.start.sourceNotAssigned).not.toMatch(/cannot start|will record|recorded/i);
    // The item of an unassigned slot is not the "not recordable" sentence, which names a device.
    expect(en.common.captureNotice.start.notRecordable).toContain('{{device}}');
    expect(en.common.captureNotice.start.sourceNotAssigned).not.toContain('{{device}}');
    // The same words as the two workspace-local keys of an empty line (register E33).
    expect(en.common.captureSlot.notAssigned).toBe(en.devices.selector.notAssigned);
  });

  // Task 4 row 187 (ruling C36 (1); integration pass I-7): the two words a Core in real capture puts in
  // `details.reason` when it refuses to assign a production camera (`CaptureProfileRefusal` of the
  // server's capture-config module: words of that module, no shared member, so they are literals here).
  it('words the two refusals of a production camera without a profile of its own (`common.captureSlotRefusal`): nothing was assigned, and no default is promised', () => {
    // Row V4: the group also holds the four sentences moved from the web console (the case below); these two come first.
    // Row V7c (decision C130): the third word of the profile rule, a listed profile without its stored stream row (row S86a).
    expect(Object.keys(en.common.captureSlotRefusal).slice(0, 3)).toEqual(['CAMERA_PROFILE_NOT_STATED', 'CAMERA_PROFILE_NOT_OF_DEVICE', 'CAMERA_PROFILE_WITHOUT_STREAM']);
    for (const sentence of [en.common.captureSlotRefusal.CAMERA_PROFILE_NOT_STATED, en.common.captureSlotRefusal.CAMERA_PROFILE_NOT_OF_DEVICE, en.common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM]) {
      expect(sentence).toMatch(/^This camera was not assigned: /);
      // No placeholder: the screen that shows it already names the camera and the slot.
      expect(sentence).not.toContain('{{');
      // It never says the Core chose or will choose a profile (ruling C36 (1): no default stands in).
      expect(sentence).not.toMatch(/default|H\.?264|HEVC|1080|720/i);
    }
    expect(en.common.captureSlotRefusal.CAMERA_PROFILE_NOT_STATED).not.toBe(en.common.captureSlotRefusal.CAMERA_PROFILE_NOT_OF_DEVICE);
    // Row V7c: the sentence of row S86a's refusal word for word (the Core's `PROFILE_WITHOUT_STREAM_TEXT`): the one remedy is a new adoption, and a connection test is said not to repair it.
    expect(en.common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM).toBe(
      'This camera was not assigned: the Core holds no stream facts for this profile, so the camera cannot record it. A connection test does not repair this. Adopt the camera again, then assign one of the profiles it states.',
    );
  });

  // Task 4 row V4 (decision C80): the four sentences the web console worded for a refused slot
  // assignment are the shared tree's now, WORD FOR WORD (the web's wording is the wording). The
  // words of `details.reason` are the server's (`CaptureAssignmentRefusal` of its capture-config
  // module and the hosted action's own word): no shared member, so they are literals here.
  it('row V4: `common.captureSlotRefusal` holds the four slot refusals of the web console word for word, seven reasons in all (row V7c: + CAMERA_PROFILE_WITHOUT_STREAM); `{{source}}` is one of two nouns', () => {
    expect(Object.keys(en.common.captureSlotRefusal)).toEqual([
      'CAMERA_PROFILE_NOT_STATED',
      'CAMERA_PROFILE_NOT_OF_DEVICE',
      'CAMERA_PROFILE_WITHOUT_STREAM',
      'PRODUCTION_SOURCE_NOT_ALLOWED',
      'CAPTURE_DEVICE_NOT_SERVED',
      'CAPTURE_DEVICE_CLASS_MISMATCH',
      'SLOT_UNASSIGNED_AND_ASSIGNED',
      // Row RD2 (decision C147): a retired device is never assigned again.
      'CAPTURE_DEVICE_RETIRED',
    ]);
    const R = en.common.captureSlotRefusal;
    expect(R.PRODUCTION_SOURCE_NOT_ALLOWED).toBe(
      'This {{source}} was not assigned: it is a production device, and this Core runs in development capture operation. This {{source}} can be assigned only on a Core running in production capture operation. Nothing was changed.',
    );
    expect(R.CAPTURE_DEVICE_NOT_SERVED).toBe('This {{source}} was not assigned: it is registered, but no capture adapter of the running Core serves it, so this Core cannot record from it. Nothing was changed.');
    expect(R.CAPTURE_DEVICE_CLASS_MISMATCH).toBe('This device was not assigned: the Core does not hold it as a {{source}}. Nothing was changed.');
    expect(R.SLOT_UNASSIGNED_AND_ASSIGNED).toBe('This choice was not accepted: one request cleared a slot and filled the same slot. Nothing was changed.');
    expect(en.common.captureSlotSource).toEqual({ CAMERA: 'camera', MIC: 'microphone' });
    for (const sentence of [R.PRODUCTION_SOURCE_NOT_ALLOWED, R.CAPTURE_DEVICE_NOT_SERVED, R.CAPTURE_DEVICE_CLASS_MISMATCH, R.SLOT_UNASSIGNED_AND_ASSIGNED, R.CAPTURE_DEVICE_RETIRED]) {
      // A refusal: nothing changed, and the one placeholder a sentence may hold is the source noun.
      expect(sentence.endsWith('Nothing was changed.')).toBe(true);
      expect((sentence.match(/\{\{[^}]*\}\}/g) ?? []).every((placeholder) => placeholder === '{{source}}')).toBe(true);
    }
    // Row V7c: 6 -> 7 (CAMERA_PROFILE_WITHOUT_STREAM), each sentence its own. Row RD2: 7 -> 8 (CAPTURE_DEVICE_RETIRED).
    expect(new Set(Object.values(R)).size).toBe(8);
  });

  // Task 4 row RD2 (design 07 sections 4.3-4.5; decision C147): the words of operation 111. The refusal
  // keys are the contract's words (`details.reason`, the 409 code, the 404 code); each says nothing changed;
  // the placeholders are the source noun and the slot name only. The Retired state and the three reasons.
  it('row RD2: `common.captureRetire` words every refusal of operation 111, the three reasons and the Retired state', async () => {
    const { CaptureRetireRefusalReason, CaptureDeviceRetireReason, CAPTURE_RETIRE_REFUSAL_SENTENCES } = await import('../src/api');
    const W = en.common.captureRetire;
    expect(Object.keys(W.refusal).sort()).toEqual([...Object.keys(CAPTURE_RETIRE_REFUSAL_SENTENCES), 'CAPTURE_CONFIG_LOCKED', 'NOT_FOUND'].sort());
    for (const reason of Object.values(CaptureRetireRefusalReason)) expect(W.refusal[reason], reason).toBeDefined();
    for (const [key, sentence] of Object.entries(W.refusal)) {
      if (key !== 'CAPTURE_CONFIG_LOCKED') expect(sentence.endsWith('Nothing was changed.'), key).toBe(true);
      expect((sentence.match(/\{\{[^}]*\}\}/g) ?? []).every((placeholder) => placeholder === '{{source}}' || placeholder === '{{slot}}'), key).toBe(true);
    }
    expect(W.refusal.CAPTURE_DEVICE_ASSIGNED).toContain('{{slot}}');
    expect(Object.keys(W.reason)).toEqual(Object.values(CaptureDeviceRetireReason));
    expect(W.state.retired).toBe('Retired');
    expect(en.common.auditType.CAPTURE_DEVICE_RETIRED).toBe('Capture device retired');
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
