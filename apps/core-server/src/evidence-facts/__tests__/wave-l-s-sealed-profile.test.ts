// Fix wave L, driver L-S - re-check 89 finding G89c-04 (ruling D229 (3)): THE FORMAT OF A SEALED
// TRACK ON THE ITEM. The manifest states `tracks[].profile` (field 36); no item member carried it,
// so no client could show the sealed format, and the notice of a session whose recorded stream was
// not the configured profile was shown on no item.
//
// | Rule | Test |
// |------|------|
// | The sealed-facts reading restates the manifest's `tracks[].profile` on each file - whatever the manifest says, per track | 1 |
// | CONTROL (the finding): the members the reading stated before hold no profile | 1 |
// | A profile outside the item's pattern is not restated (the file is, without it) | 2 |
// | The door keeps it on the replicated item; an equal reading returns the SAME item; a package that is not readable... keeps no sealed fact | 3 |
// | The notice of the session, read from the alert the seal wrote; another session's notice, a notice that does not read as written, and no notice answer null | 4 |
// | The contract examples are what the readers answer; the item schema takes them and refuses a member outside the shape; `profileId` is untouched | 5 |
import { EVIDENCE_SEALED_PROFILE_EXAMPLE, EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE, EvidenceItemSchema, EXAMPLE_EVIDENCE_ITEM } from '@dems/shared/api';
import type { EvidenceItem, SimState } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { STREAM_PROFILE_DIFFERS_REASON, itemWithSealedFacts, type ItemWithSealedFacts, type SealedItemFacts } from '../../engine';
import { noteStreamProfileDiffersTransition } from '../../engine/sealing-notice-doors';
import { buildPackage, removeScratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { streamProfileNoticeOf } from '../index';
import { readSealedItemFacts } from '../sealed-facts';

afterAll(() => removeScratch());

const anchorsOf = (built: BuiltPackage): { id: string; sessionId: string; manifestHash: string } => ({ id: built.manifest.evidenceId, sessionId: built.manifest.sessionId, manifestHash: built.manifest.manifestSha256 });
type Files = Array<{ trackId: string; profile?: string; sha256: string }>;

describe('G89c-04: the sealed-facts reading states the format of each camera file as the manifest of record states it', () => {
  it('1 - each file carries the profile of ITS track; the other members are what they were', async () => {
    const built = await buildPackage({
      evidenceId: 'EV-20261011-0901',
      sessionId: 'SES-20261011-0901',
      beforeSeal: (input) => {
        const [first, second] = input.tracks;
        if (first === undefined || second === undefined) throw new Error('the package has no two tracks');
        first.profile = 'H264_720P30';
        second.profile = 'H264_720P27.67';
      },
    });
    const facts = await readSealedItemFacts(built.dir, anchorsOf(built));
    expect(facts.sealedPackage).toBe('PRESENT');
    const files = (facts as unknown as { files: Files }).files;
    expect(files.map((file) => [file.trackId, file.profile])).toEqual([
      ['VIDEO-01', 'H264_720P30'],
      ['VIDEO-02', 'H264_720P27.67'],
    ]);
    expect(files.map((file) => file.profile)).toEqual(built.manifest.tracks.map((track) => track.profile));
    // CONTROL (the finding): without the member, nothing of a file says its format.
    for (const file of files) {
      const { profile: _profile, ...before } = file;
      expect(JSON.stringify(before)).not.toMatch(/H264/);
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('2 - a profile the item cannot carry (outside its pattern) is not restated; the file is', async () => {
    const built = await buildPackage({
      evidenceId: 'EV-20261011-0902',
      sessionId: 'SES-20261011-0902',
      beforeSeal: (input) => {
        const [first] = input.tracks;
        if (first === undefined) throw new Error('the package has no track');
        first.profile = 'a profile with spaces / and a path';
      },
    });
    const facts = await readSealedItemFacts(built.dir, anchorsOf(built));
    const files = (facts as unknown as { files: Files }).files;
    expect(files).toHaveLength(2);
    expect('profile' in (files[0] ?? {})).toBe(false);
    expect(typeof files[1]?.profile).toBe('string');
  });
});

describe('G89c-04: the door and the notice', () => {
  const item = { ...EXAMPLE_EVIDENCE_ITEM, manifestHash: 'ab'.repeat(32) } as unknown as EvidenceItem;
  const present = (files: unknown): SealedItemFacts => ({ evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'PRESENT', interrupted: false, audioSourceIntervals: [], files, developmentKey: true }) as SealedItemFacts;

  it('3 - the replicated item carries the profile; an equal reading returns the SAME item; a changed profile replaces it; NOT_READABLE says only that', () => {
    const held = itemWithSealedFacts(item, present(EVIDENCE_SEALED_PROFILE_EXAMPLE.files)) as ItemWithSealedFacts;
    expect((held.files as Files).map((file) => file.profile)).toEqual(['H264_720P30', 'H264_720P30']);
    expect(itemWithSealedFacts(held, present(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ ...file }))))).toBe(held);
    const changed = itemWithSealedFacts(held, present(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ ...file, profile: 'H264_1080P25' })))) as ItemWithSealedFacts;
    expect(changed).not.toBe(held);
    expect((changed.files as Files).map((file) => file.profile)).toEqual(['H264_1080P25', 'H264_1080P25']);
    expect((itemWithSealedFacts(held, { evidenceId: item.id, manifestHash: item.manifestHash, sealedPackage: 'NOT_READABLE' }) as ItemWithSealedFacts).sealedPackage).toBe('NOT_READABLE');
  });

  it('4 - the notice of a session is read from the alert the seal wrote; nothing else answers one', () => {
    const SESSION = 'SES-20261011-0036';
    const base = { alerts: [], meta: { counters: { item: 40, event: 0 } } } as unknown as SimState;
    const noticed = noteStreamProfileDiffersTransition(base, 1_791_680_000_000, {
      sessionId: SESSION,
      tracks: [
        { trackId: 'VIDEO-01', configured: 'H264_720P30', stream: 'H264_720P27.67' },
        { trackId: 'VIDEO-02', configured: 'H264_720P30', stream: 'H264_720P26' },
      ],
    });
    expect(noticed.alerts).toHaveLength(1);
    expect(noticed.alerts[0]?.params?.['reason']).toBe(STREAM_PROFILE_DIFFERS_REASON);
    expect(streamProfileNoticeOf(noticed.alerts, SESSION)).toEqual({
      tracks: [
        { trackId: 'VIDEO-01', stream: 'H264_720P27.67', configured: 'H264_720P30' },
        { trackId: 'VIDEO-02', stream: 'H264_720P26', configured: 'H264_720P30' },
      ],
    });
    // Another session, no alert, an alert of another reason, tracks that do not read as written: no notice.
    expect(streamProfileNoticeOf(noticed.alerts, 'SES-20261011-0037')).toBeNull();
    expect(streamProfileNoticeOf([], SESSION)).toBeNull();
    const alert = noticed.alerts[0];
    if (alert === undefined) throw new Error('no alert');
    expect(streamProfileNoticeOf([{ ...alert, params: { ...alert.params, reason: 'UNSEALABLE' } }], SESSION)).toBeNull();
    expect(streamProfileNoticeOf([{ ...alert, params: { ...alert.params, tracks: 'VIDEO-01:only-two-parts' } }], SESSION)).toBeNull();
    expect(streamProfileNoticeOf([{ ...alert, params: { ...alert.params, tracks: 'AUDIO-01:a:b' } }], SESSION)).toBeNull();
  });

  it('5 - the contract examples: the item schema takes them, refuses a member outside the shape, and `profileId` is what it was', () => {
    const withProfile = { ...EXAMPLE_EVIDENCE_ITEM, sealedPackage: 'PRESENT', ...EVIDENCE_SEALED_PROFILE_EXAMPLE };
    const parsed = EvidenceItemSchema.safeParse(withProfile);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.files?.map((file) => file.profile)).toEqual(['H264_720P30', 'H264_720P30']);
    expect(parsed.success && parsed.data.profileId).toBe(EXAMPLE_EVIDENCE_ITEM.profileId);
    expect(EvidenceItemSchema.safeParse({ ...withProfile, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE }).success).toBe(true);
    expect(EvidenceItemSchema.safeParse({ ...withProfile, streamProfileNotice: { tracks: [] } }).success).toBe(false);
    expect(EvidenceItemSchema.safeParse({ ...withProfile, streamProfileNotice: { tracks: [{ trackId: 'AUDIO-01', stream: 'A', configured: 'B' }] } }).success).toBe(false);
    expect(EvidenceItemSchema.safeParse({ ...withProfile, files: withProfile.files.map((file) => ({ ...file, profile: 'not a code' })) }).success).toBe(false);
    // The notice example is what the reader answers for the alert the seal writes.
    const base = { alerts: [], meta: { counters: { item: 0, event: 0 } } } as unknown as SimState;
    const tracks = EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks.map((track) => ({ ...track }));
    expect(streamProfileNoticeOf(noteStreamProfileDiffersTransition(base, 1, { sessionId: 'SES-20261011-0001', tracks }).alerts, 'SES-20261011-0001')).toEqual(EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice);
  });
});
