// Fix wave L, driver L-M - re-check 89 finding G89c-04 (ruling D229 (3)): no client showed the format
// the SIGNED manifest states (field 36), nor the session's STREAM_PROFILE_DIFFERS notice on its item.
//
// The members are L-S's (`delegation_progress/contract_wave_l.md` section 4), read BY NAME through the
// contract's own examples: `evidence.files[].profile` and `evidence.streamProfileNotice` of operation 40.
// Rule: the detail repeats what the Core states, or shows nothing - never `profileId`, never "1080p / 25 fps".
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { EVIDENCE_SEALED_PROFILE_EXAMPLE, EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } from '@dems/shared/api';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { MEMBER, NO_DETAIL_FACTS, readDetailFacts, readSealedProfiles } from './item-facts';
import { resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { allText, bedWith, openItem, realItem } from './testing/wave-h-c2-kit';

let bed: LiveEvidenceBed | null = null;
beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
});
afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

describe('G89c-04 - the members, by the names of the contract', () => {
  it('the reader\'s names ARE the names the contract examples hold', () => {
    expect(MEMBER.item.files in EVIDENCE_SEALED_PROFILE_EXAMPLE).toBe(true);
    expect(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.every((file) => MEMBER.item.fileProfile in file)).toBe(true);
    expect(MEMBER.detail.streamProfileNotice in EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE).toBe(true);
    const track = EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks[0]!;
    expect(MEMBER.detail.noticeStream in track && MEMBER.detail.noticeConfigured in track && MEMBER.item.trackId in track).toBe(true);
  });

  it('reads the per-file format as SIGNED and the notice from operation 40\'s item', () => {
    const facts = readDetailFacts({ evidence: { ...EVIDENCE_SEALED_PROFILE_EXAMPLE, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE } });
    expect(facts.sealedProfiles).toEqual(EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map((file) => ({ trackId: file.trackId, profile: file.profile })));
    expect(facts.streamProfileNotice).toEqual(EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks);
  });

  it('CONTROL - nothing stated is nothing reported: absent members, a `profileId`, a value that is no profile code', () => {
    expect(NO_DETAIL_FACTS.sealedProfiles).toBeNull();
    expect(NO_DETAIL_FACTS.streamProfileNotice).toBeNull();
    const plain = EVIDENCE_SEALED_PROFILE_EXAMPLE.files.map(({ profile: _profile, ...file }) => file);
    expect(readDetailFacts({ evidence: { files: plain, profileId: 'STANDARD_1080P25' } }).sealedProfiles).toBeNull();
    expect(readSealedProfiles({ files: [{ trackId: 'VIDEO-01', profile: 'Standard (1080p / 25 fps)' }] })).toBeNull();
    expect(readSealedProfiles({ files: [{ trackId: 'AUDIO-01', profile: 'H264_720P30' }] })).toBeNull();
    expect(readDetailFacts({ evidence: { streamProfileNotice: { tracks: [] } } }).streamProfileNotice).toBeNull();
  });
});

describe('G89c-04 - the evidence detail of a recording this Core sealed', () => {
  it('shows the format per camera file as the signed manifest states it', async () => {
    const { b, id } = await bedWith('0001', realItem({ ...EVIDENCE_SEALED_PROFILE_EXAMPLE }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    await openItem(b, id);
    expect(screen.getByTestId('evidence-sealed-format-profiles')).toHaveTextContent(/Sealed format \(signed manifest\)/);
    expect(screen.getByTestId('evidence-sealed-format-VIDEO-01')).toHaveTextContent(`Camera 1: ${EVIDENCE_SEALED_PROFILE_EXAMPLE.files[0]!.profile}`);
    expect(screen.getByTestId('evidence-sealed-format-VIDEO-02')).toHaveTextContent(`Camera 2: ${EVIDENCE_SEALED_PROFILE_EXAMPLE.files[1]!.profile}`);
    expect(screen.queryByTestId('evidence-sealed-format-notice')).toBeNull();
    expect(allText()).not.toMatch(/1080p|25 fps|STANDARD_1080P25/);
  });

  it('shows the session\'s profile notice: what the stream declared against what was configured', async () => {
    const { b, id } = await bedWith('0001', realItem({ ...EVIDENCE_SEALED_PROFILE_EXAMPLE, ...EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE }));
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    await openItem(b, id);
    const first = EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE.streamProfileNotice.tracks[0]!;
    expect(screen.getByTestId('evidence-sealed-format-notice')).toHaveTextContent(/The recorded stream was not the configured profile/);
    expect(screen.getByTestId('evidence-sealed-format-notice-VIDEO-01')).toHaveTextContent(`Camera 1: recorded ${first.stream}, configured ${first.configured}`);
  });

  it('CONTROL - an item for which the Core states neither: no format block at all', async () => {
    const { b, id } = await bedWith('0001', realItem());
    bed = b;
    b.mediaRef = () => ({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01', 'VIDEO-02'] });
    await openItem(b, id);
    expect(screen.queryByTestId('evidence-sealed-format')).toBeNull();
    expect(allText()).not.toMatch(/Sealed format|1080p|H264_/);
  });
});
