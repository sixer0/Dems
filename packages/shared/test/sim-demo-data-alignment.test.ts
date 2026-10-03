// Step 54 (review 40 §5.c, M3, SIM-GAP-W1, W42-2, W47-1, M83-1; D84): the simulator agrees with
// the step-93 DEMO packages without importing demo-data into `src/sim`. A test-time import of
// demo-data is fine: this file rebuilds the simulator's constant table from the index (P13:
// "never hard-code hashes" is enforced here) and checks every package against the idle dataset.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
  DEMO_EVIDENCE_INDEX,
  demoCaseSequence,
  getDemoEvidencePackage,
  matchDemoPackage,
  type DemoEvidencePackage,
} from '../src/demo-data';
import {
  createIdleState,
  createManualClock,
  createSim,
  DATASET_EXPORT_SEQ,
  DATASET_EXPORTED_EVIDENCE_SEQ,
  DEMO_DEVICE_CERT_NOT_AFTER,
  DEMO_DEVICE_CERT_SHA256,
  DEMO_PACKAGE_INTEGRITY,
  DEMO_SIGNING_KEY_ID,
  DEMO_SIGNING_PUBLIC_KEY_HEX,
  DEMO_TAMPERED_EVIDENCE_SEQ,
  DEMO_TAMPERED_TRACK,
  demoPackageIntegrityFor,
  DEVICE_CERT_FINGERPRINT,
  TRACK_ORDER,
  verifyEvidenceItem,
  type EvidenceItem,
} from '../src/sim';

const INDEX = DEMO_EVIDENCE_INDEX;
const AS_OF = Date.parse(INDEX.datasetNow);
const SEED = 20261001;

const hex = (colonGrouped: string) => colonGrouped.replaceAll(':', '').toLowerCase();

/** What `DEMO_PACKAGE_INTEGRITY` must hold, rebuilt from the index. */
function expectedTable() {
  return Object.fromEntries(
    INDEX.packages.map((pkg) => {
      const altered = pkg.tracks.find((track) => track.altered);
      return [
        pkg.evidenceSuffix,
        {
          sessionSeq: Number(pkg.sessionSuffix),
          caseSeq: demoCaseSequence(pkg.caseNumber),
          subjectName: pkg.subjectName,
          manifestSha256: pkg.files.manifest.sha256,
          tracks: TRACK_ORDER.map((trackId) => pkg.tracks.find((track) => track.trackId === trackId)?.sealedSha256),
          ...(altered ? { altered: { trackId: altered.trackId, sha256: altered.stored.sha256 } } : {}),
        },
      ];
    }),
  );
}

function itemFor(evidence: readonly EvidenceItem[], pkg: DemoEvidencePackage): EvidenceItem | undefined {
  return evidence.find((item) => item.id.endsWith(`-${pkg.evidenceSuffix}`));
}

describe('the simulator holds the DEMO package facts as constants (P13 guard)', () => {
  it('DEMO_PACKAGE_INTEGRITY equals the table rebuilt from DEMO_EVIDENCE_INDEX (paste the printed table after a step-93 rerun)', () => {
    const expected = expectedTable();
    if (JSON.stringify(expected) !== JSON.stringify(DEMO_PACKAGE_INTEGRITY)) {
      console.info('[sim-demo-data-alignment] expected DEMO_PACKAGE_INTEGRITY:\n', JSON.stringify(expected, null, 2));
    }
    expect(DEMO_PACKAGE_INTEGRITY).toEqual(expected);
    // The manifest digest is what the Ed25519 signature covers.
    for (const pkg of INDEX.packages) expect(pkg.files.manifest.sha256).toBe(pkg.signature.signedDigest);
  });

  it('the certificate, key, tamper and export constants equal the index', () => {
    expect(DEMO_DEVICE_CERT_SHA256).toBe(INDEX.certificate.sha256);
    expect(DEMO_DEVICE_CERT_NOT_AFTER).toBe(INDEX.certificate.notAfter);
    expect(DEMO_SIGNING_KEY_ID).toBe(INDEX.key.keyId);
    expect(DEMO_SIGNING_PUBLIC_KEY_HEX).toBe(INDEX.key.publicKeyHex);
    expect(String(DEMO_TAMPERED_EVIDENCE_SEQ).padStart(4, '0')).toBe(INDEX.tamperedEvidenceSuffix);
    expect(getDemoEvidencePackage(INDEX.tamperedEvidenceSuffix)?.tamperedTrackId).toBe(DEMO_TAMPERED_TRACK);
    expect(INDEX.exportedEvidenceSuffixes).toEqual([String(DATASET_EXPORTED_EVIDENCE_SEQ).padStart(4, '0')]);
    expect(getDemoEvidencePackage(INDEX.exportedEvidenceSuffixes[0] ?? '')?.export?.exportId).toBe(
      `EXP-${String(DATASET_EXPORT_SEQ).padStart(6, '0')}`,
    );
  });

  it('src/sim never imports demo-data (the web entry chunk stays small, AC-73)', () => {
    const dir = fileURLToPath(new URL('../src/sim/', import.meta.url));
    for (const file of readdirSync(dir)) {
      const text = readFileSync(`${dir}${file}`, 'utf8');
      expect(/from '\.\.\/demo-data/.test(text), file).toBe(false);
    }
  });
});

describe('the idle dataset agrees with every DATASET package (review 40 §5.c item 4)', () => {
  const state = createIdleState({ now: AS_OF, seed: SEED });

  it('same case, subject, investigator, status, tamper flag and hashes; integrity labelled DEMO_PACKAGE', () => {
    const dataset = INDEX.packages.filter((pkg) => pkg.origin === 'DATASET');
    expect(dataset).toHaveLength(13);
    for (const pkg of dataset) {
      const item = itemFor(state.evidence, pkg);
      expect(item, pkg.evidenceSuffix).toBeDefined();
      expect(item).toMatchObject({
        caseNumber: pkg.caseNumber,
        subjectName: pkg.subjectName,
        subjectType: pkg.subjectType,
        caseType: pkg.subjectType,
        investigatorId: pkg.investigatorId,
        status: pkg.status,
        tampered: pkg.tampered,
        tamperedTrackId: pkg.tamperedTrackId,
        manifestHash: pkg.files.manifest.sha256,
        integritySource: 'DEMO_PACKAGE',
        startTimeSource: 'GNSS',
        endTimeSource: 'GNSS',
      });
      for (const track of pkg.tracks) {
        expect(item?.tracks.find((entry) => entry.trackId === track.trackId)?.sha256).toBe(track.sealedSha256);
      }
    }
  });

  it('EV 0005 is tampered on AUDIO-02 at load: verify fails on exactly that track, with the altered copy hash', () => {
    const pkg = getDemoEvidencePackage(INDEX.tamperedEvidenceSuffix);
    if (!pkg) throw new Error('tampered package missing');
    const item = itemFor(state.evidence, pkg);
    if (!item) throw new Error('EV 0005 missing');
    const result = verifyEvidenceItem(item, AS_OF);
    expect(result.ok).toBe(false);
    expect(result.tracks.filter((track) => !track.ok).map((track) => track.trackId)).toEqual(['AUDIO-02']);
    const altered = result.tracks.find((track) => track.trackId === 'AUDIO-02');
    expect(altered).toMatchObject({ expected: pkg.verification.checks.find((c) => c.id === 'track:AUDIO-02')?.expected });
    expect(altered?.actual).toBe(pkg.tracks.find((track) => track.altered)?.stored.sha256);
    expect(result.manifestOk && result.signatureOk).toBe(true);
    // Every other dataset item verifies (like the packages' precomputed reports).
    for (const other of state.evidence.filter((entry) => entry.id !== item.id)) {
      expect(verifyEvidenceItem(other, AS_OF).ok, other.id).toBe(true);
    }
  });

  it('Security & Audit keys: DEVICE_CERT and EVIDENCE_SIGNING_KEY are the Ed25519 DEMO certificate and key', () => {
    const cert = state.security.keys.find((key) => key.id === 'DEVICE_CERT');
    const signing = state.security.keys.find((key) => key.id === 'EVIDENCE_SIGNING_KEY');
    expect(cert).toMatchObject({ algorithm: INDEX.key.algorithm, demo: true });
    expect(hex(cert?.fingerprint ?? '')).toBe(INDEX.certificate.sha256);
    expect(cert?.expiresAt).toBe(Date.parse(INDEX.certificate.notAfter));
    expect(signing).toMatchObject({ algorithm: INDEX.key.algorithm, keyId: INDEX.key.keyId, demo: true });
    expect(hex(signing?.fingerprint ?? '')).toBe(bytesToHex(sha256(hexToBytes(INDEX.key.publicKeyHex))));
    // The TLS server certificate stays the simulated ECDSA P-256 one.
    expect(state.security.keys.find((key) => key.id === 'TLS_SERVER')?.algorithm).toBe('ECDSA P-256');
    // Pairing shows the short form of the same certificate fingerprint.
    expect(hex(state.pairing.certificateFingerprint)).toBe(INDEX.certificate.sha256.slice(0, 32));
    expect(state.pairing.certificateFingerprint).toBe(DEVICE_CERT_FINGERPRINT);
  });

  it("EV 0004's dataset export is EXP-000031; the next live export continues at EXP-000032", () => {
    const pkg = getDemoEvidencePackage(INDEX.exportedEvidenceSuffixes[0] ?? '');
    const row = state.audit.rows.find((entry) => entry.type === 'EVIDENCE_EXPORTED');
    expect(row?.details.exportId).toBe(pkg?.export?.exportId);
    const sim = createSim({ clock: createManualClock(AS_OF), storage: null, authStorage: null });
    sim.actions.signIn('andi.pratama', 'demo-2026');
    const result = sim.actions.exportEvidence(pkg?.evidenceId ?? '', { reason: 'Prosecutor request', destination: '' });
    expect(result).toEqual({ ok: true, status: 202, exportId: 'EXP-000032' });
  });
});

describe('the recording scenario seals into its package (review 40 §5.c item 4)', () => {
  it('sealing session 0024 yields evidence 0014 with the package case, subject and DEMO_PACKAGE hashes', () => {
    const live = INDEX.packages.find((pkg) => pkg.origin === 'RECORDING_SCENARIO');
    if (!live) throw new Error('recording-scenario package missing');
    const clock = createManualClock(AS_OF);
    const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording' });
    sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(sim.store.getState().session?.id.endsWith(`-${live.sessionSuffix}`)).toBe(true);
    sim.actions.stopRecording('Interview completed');
    for (let elapsed = 0; elapsed < 12_000; elapsed += 100) {
      clock.advance(100);
      sim.tick();
    }
    const item = sim.store.getState().evidence.at(-1);
    expect(item?.id.endsWith(`-${live.evidenceSuffix}`)).toBe(true);
    expect(item).toMatchObject({
      caseNumber: live.caseNumber,
      subjectName: live.subjectName,
      integritySource: 'DEMO_PACKAGE',
      manifestHash: live.files.manifest.sha256,
    });
    expect(verifyEvidenceItem(item as EvidenceItem, clock.now()).ok).toBe(true);
    expect(matchDemoPackage(item as EvidenceItem)).toBe(live);
  });

  it('a session the presenter records live (another case and subject) also seals as 0014 but stays SIMULATED', () => {
    const clock = createManualClock(AS_OF);
    const sim = createSim({ clock, storage: null, authStorage: null });
    sim.actions.signIn('budi.santoso', 'demo-2026');
    const caseNumber = sim.actions.scanCaseNumber();
    sim.actions.createSession({
      caseNumber,
      subjectType: 'SAKSI',
      subjectName: 'Presenter Witness',
      investigatorId: 'OPR-001',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    sim.actions.beginPrecheck();
    for (let elapsed = 0; elapsed < 6_000; elapsed += 100) {
      clock.advance(100);
      sim.tick();
    }
    sim.actions.startRecording();
    clock.advance(5_000);
    sim.tick();
    sim.actions.stopRecording('Interview completed');
    for (let elapsed = 0; elapsed < 12_000; elapsed += 100) {
      clock.advance(100);
      sim.tick();
    }
    const item = sim.store.getState().evidence.at(-1);
    expect(item?.id.endsWith('-0014')).toBe(true);
    expect(item?.integritySource).toBe('SIMULATED');
    expect(demoPackageIntegrityFor({ evidenceId: item?.id ?? '', sessionId: item?.sessionId ?? '', caseNumber, subjectName: 'Presenter Witness' })).toBeNull();
    expect(matchDemoPackage(item as EvidenceItem)).toBeNull();
    expect(verifyEvidenceItem(item as EvidenceItem, clock.now()).ok).toBe(true);
  });
});

describe('matchDemoPackage (D84: case sequence + subject + session suffix, any demo day)', () => {
  const pkg = getDemoEvidencePackage('0001') as DemoEvidencePackage;

  it('joins on another calendar day (re-dated IDs and case number)', () => {
    const item = {
      id: 'EV-20261104-0001',
      sessionId: 'SES-20261104-0011',
      caseNumber: 'LP/2026/1104-0001',
      subjectName: pkg.subjectName,
    };
    expect(matchDemoPackage(item)).toBe(pkg);
    expect(matchDemoPackage({ ...item, sessionId: undefined }, 'SES-20261104-0011')).toBe(pkg);
    expect(matchDemoPackage({ ...item, sessionId: undefined }, { id: 'SES-20261104-0011' })).toBe(pkg);
  });

  it('rejects another case sequence, subject or session, and an item without a session', () => {
    const base = { id: pkg.evidenceId, sessionId: pkg.sessionId, caseNumber: pkg.caseNumber, subjectName: pkg.subjectName };
    expect(matchDemoPackage(base)).toBe(pkg);
    expect(matchDemoPackage({ ...base, caseNumber: 'LP/2026/0929-0008' })).toBeNull();
    expect(matchDemoPackage({ ...base, subjectName: 'Someone Else' })).toBeNull();
    expect(matchDemoPackage({ ...base, sessionId: 'SES-20260929-0031' })).toBeNull();
    expect(matchDemoPackage({ ...base, sessionId: undefined })).toBeNull();
    expect(matchDemoPackage({ ...base, id: 'EV-20260929-0099' })).toBeNull();
    expect(demoCaseSequence('LP/2026/1001-0007')).toBe(7);
    expect(demoCaseSequence('ABC')).toBeNull();
  });

  it('every dataset item joins its package through the shared join', () => {
    const state = createIdleState({ now: Date.parse('2026-11-04T10:00:00+07:00'), seed: SEED });
    for (const item of state.evidence) expect(matchDemoPackage(item)?.evidenceSuffix, item.id).toBe(item.id.slice(-4));
  });
});
