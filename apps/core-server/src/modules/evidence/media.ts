/**
 * The media reference of an evidence item (plan row W35; spec §11 MS-1 to MS-3, §8.5 ENG-18;
 * SR-66; contract `EvidenceMediaRef`).
 *
 * The server serves no media and no package file. What it decides is WHICH bundled media, if
 * any, belongs to an item (MS-2): a client shows its bundled demo package for an item only when
 * this reference says `DEMO_PACKAGE`, under the suffix it names.
 *
 * The join is the shared one, `matchDemoPackage` of `@dems/shared/demo-data` (ENG-18): the
 * evidence suffix, the session suffix, the case sequence and the subject name must all match,
 * and the dated parts of the identifiers are ignored, so the 13 dataset items keep their
 * packages on any seed day. A session recorded in Live mode joins nothing and answers `NONE`,
 * also when its evidence number is one a package uses.
 *
 * The reference is two values: a source and four digits. It names no file, no folder and no
 * URL, and nothing in it comes from the request (SR-66): the four inputs of the join are the
 * stored columns of the item.
 */
import { EvidenceMediaSource, type EvidenceMediaRef } from '@dems/shared/api';
import { matchDemoPackage } from '@dems/shared/demo-data';
import type { EvidenceItem } from '@dems/shared/sim';

/** The four members of an item the join reads. */
export type MediaJoinFields = Pick<EvidenceItem, 'id' | 'sessionId' | 'caseNumber' | 'subjectName'>;

const NO_MEDIA: EvidenceMediaRef = Object.freeze({ source: EvidenceMediaSource.NONE, packageSuffix: null });

export function mediaRefOf(item: MediaJoinFields): EvidenceMediaRef {
  const joined = matchDemoPackage({ id: item.id, sessionId: item.sessionId, caseNumber: item.caseNumber, subjectName: item.subjectName });
  // The suffix is the package's own join key: the four digits `demoIdSuffix` reads from the evidence ID.
  return joined === null ? NO_MEDIA : { source: EvidenceMediaSource.DEMO_PACKAGE, packageSuffix: joined.evidenceSuffix };
}
