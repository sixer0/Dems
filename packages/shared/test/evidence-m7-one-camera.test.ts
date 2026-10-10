// Fix pass F-M7, finding R88-01 (decision D178): a session that recorded with ONE usable camera
// file is sealed with the tracks it has. The manifest holds 1 or 2 track records, in the order
// VIDEO-01 then VIDEO-02, and exactly the same file records; nothing else is relaxed.
import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_SOURCE_ROWS,
  EvidencePackageError,
  ManifestV2Schema,
  attachSignature,
  buildUnsignedManifest,
  declaredPackageFiles,
  exampleManifestInput,
  isSealedTrackList,
  parseFragmentsJson,
  serializeFragmentsJson,
  type ManifestV2,
  type ManifestV2Input,
} from '../src/evidence-package';

const clone = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

/** The example input with only the camera file(s) named. */
function inputWith(trackIds: readonly string[]): ManifestV2Input {
  const input = exampleManifestInput();
  return {
    ...input,
    tracks: input.tracks.filter((track) => trackIds.includes(track.trackId)),
    files: input.files.filter((file) => trackIds.includes(file.trackId)),
    audio: { ...input.audio, containsIn: input.audio.containsIn.filter((trackId) => trackIds.includes(trackId)) },
  };
}
const sealed = (input: ManifestV2Input): ManifestV2 => attachSignature(buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS), new Uint8Array(64).fill(7));
const refused = (base: ManifestV2, change: (manifest: ManifestV2) => void): boolean => {
  const manifest = clone(base);
  change(manifest);
  return !ManifestV2Schema.safeParse(manifest).success;
};

describe('R88-01: the track list of a sealed package is 1 or 2 camera files', () => {
  it('the rule itself: one or two distinct tracks, VIDEO-01 before VIDEO-02', () => {
    expect(isSealedTrackList(['VIDEO-01', 'VIDEO-02'])).toBe(true);
    expect(isSealedTrackList(['VIDEO-01'])).toBe(true);
    expect(isSealedTrackList(['VIDEO-02'])).toBe(true);
    // Negative controls: none, three, twice the same, the wrong order, a name that is no camera file.
    expect(isSealedTrackList([])).toBe(false);
    expect(isSealedTrackList(['VIDEO-01', 'VIDEO-02', 'VIDEO-01'])).toBe(false);
    expect(isSealedTrackList(['VIDEO-01', 'VIDEO-01'])).toBe(false);
    expect(isSealedTrackList(['VIDEO-02', 'VIDEO-01'])).toBe(false);
    expect(isSealedTrackList(['VIDEO-03'])).toBe(false);
  });

  it.each([['VIDEO-01'], ['VIDEO-02']])('a manifest with the one camera file %s builds, signs and parses back', (trackId) => {
    const manifest = sealed(inputWith([trackId]));
    expect(manifest.tracks.map((track) => track.trackId)).toEqual([trackId]);
    expect(manifest.files.map((file) => file.trackId)).toEqual([trackId]);
    expect(manifest.audio.containsIn).toEqual([trackId]);
    expect(ManifestV2Schema.safeParse(clone(manifest)).success).toBe(true);
  });

  it('the two-camera manifest is what it was (control)', () => {
    const manifest = sealed(exampleManifestInput());
    expect(manifest.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
  });

  it('refuses every track list that is not the file list: no track, a third, a file without its track, a track without its file, audio in a file that is not sealed', () => {
    const one = sealed(inputWith(['VIDEO-01']));
    const two = sealed(exampleManifestInput());
    expect(refused(one, () => undefined)).toBe(false);
    expect(refused(one, (m) => void m.tracks.pop())).toBe(true);
    expect(refused(one, (m) => void m.files.pop())).toBe(true);
    expect(refused(one, (m) => void m.files.push(clone(two.files[1]!)))).toBe(true);
    expect(refused(one, (m) => void m.tracks.push(clone(two.tracks[1]!)))).toBe(true);
    expect(refused(one, (m) => void (m.audio.containsIn = ['VIDEO-01', 'VIDEO-02']))).toBe(true);
    expect(refused(one, (m) => void (m.audio.containsIn = []))).toBe(true);
    expect(refused(one, (m) => void ((m.files[0] as ManifestV2['files'][number]).trackId = 'VIDEO-02'))).toBe(true);
    expect(refused(two, (m) => void m.tracks.push(clone(two.tracks[0]!)))).toBe(true);
    expect(refused(two, (m) => void m.tracks.pop())).toBe(true);
    expect(refused(two, (m) => void m.tracks.reverse())).toBe(true);
  });

  it('the fragment table follows the same rule', () => {
    const two = sealed(exampleManifestInput());
    const text = Buffer.from(serializeFragmentsJson(two.files.slice(0, 1))).toString('utf8');
    expect(parseFragmentsJson(text).files.map((file) => file.trackId)).toEqual(['VIDEO-01']);
    expect(() => serializeFragmentsJson([])).toThrow(EvidencePackageError);
    expect(() => serializeFragmentsJson([...two.files].reverse())).toThrow(EvidencePackageError);
    expect(() => serializeFragmentsJson([two.files[0]!, two.files[0]!])).toThrow(EvidencePackageError);
  });

  it('the declared files of a package are those of its tracks; without a track list both camera files are declared (as before)', () => {
    expect(declaredPackageFiles({ transcript: false, tracks: ['VIDEO-02'] })).toEqual(['session-manifest.json', 'signature.sig', 'device-certificate.pem', 'fragments/VIDEO-02.mp4', 'fragments/fragments.json', 'audit-session-extract.jsonl']);
    expect(declaredPackageFiles({ transcript: false })).toContain('fragments/VIDEO-01.mp4');
    expect(declaredPackageFiles({ transcript: false })).toContain('fragments/VIDEO-02.mp4');
  });
});
