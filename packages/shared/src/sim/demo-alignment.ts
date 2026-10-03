/**
 * Simulator ↔ DEMO package alignment (step 54; review 40 §5.c, M3, SIM-GAP-W1, W42-2, W47-1, M83-1).
 *
 * The step-93 DEMO packages (`@dems/shared/demo-data`, about 270 KB) are never imported here:
 * `main.tsx` loads the simulator into the web entry chunk (AC-73). Instead this module holds the
 * few package facts the simulator must agree with, as plain constants (about 7 KB):
 *
 * - the DEMO device certificate and signing key (Ed25519) shown in Security & Audit;
 * - per package: the sealed manifest digest and the four sealed track hashes (plus the altered
 *   hash of the one TAMPERED track), so the simulator's evidence items display and verify the
 *   package values;
 * - the dataset's tamper and export facts (EV 0005 tampered on AUDIO-02; EV 0004 exported as
 *   EXP-000031).
 *
 * P13 ("never hard-code hashes") is enforced by `test/sim-demo-data-alignment.test.ts`, which
 * rebuilds this table from `DEMO_EVIDENCE_INDEX` and fails on any difference. After a step-93
 * regeneration (`--as-of`), paste the table that test prints.
 *
 * Join rule (D84, F-47-1): a package applies to an item when the evidence suffix, the session
 * suffix, the case SEQUENCE and the subject name match. The dated parts of the IDs and the case
 * number are ignored, so the alignment holds on any demo day. A session the presenter records
 * live seals into evidence 0014 too, but with another case or subject it stays SIMULATED (M4).
 */
import type { TrackId } from '../domain';

/** Track order of the table rows (the same order as `evidence.ts` TRACK_ORDER; kept local: no import cycle). */
const TABLE_TRACK_ORDER: readonly TrackId[] = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'];

/** SHA-256 of the DER bytes of the DEMO device certificate (`DEMO_EVIDENCE_INDEX.certificate.sha256`). */
export const DEMO_DEVICE_CERT_SHA256 = '760be9296d40f7d89320fdc65f767a4b9a3788f4b6a5caf8d405a9d698a5779a';
/** The DEMO certificate's validity end (`certificate.notAfter`). */
export const DEMO_DEVICE_CERT_NOT_AFTER = '2030-12-31T23:59:59.000Z';
/** The DEMO evidence signing key (`DEMO_EVIDENCE_INDEX.key`). */
export const DEMO_SIGNING_KEY_ID = 'DEMO-KEY-EVSIGN-01';
export const DEMO_SIGNING_PUBLIC_KEY_HEX = 'a99fac18121c7dec1cb104b7f1cc247d1f00d9037f5e101ea7c644959ee3c323';
/** Both are Ed25519 (DR-93-6). */
export const DEMO_KEY_ALGORITHM = 'Ed25519';

/** The dataset's TAMPERED item (`tamperedEvidenceSuffix`): its stored AUDIO-02 was altered after sealing. */
export const DEMO_TAMPERED_EVIDENCE_SEQ = 5;
export const DEMO_TAMPERED_TRACK: TrackId = 'AUDIO-02';
/** EV 0004's prebuilt export (`packages[3].export.exportId`): the export counter continues after it. */
export const DATASET_EXPORTED_EVIDENCE_SEQ = 4;
export const DATASET_EXPORT_SEQ = 31;

export interface DemoPackageIntegrity {
  sessionSeq: number;
  /** The `NNNN` of the case number `LP/YYYY/MMDD-NNNN`. */
  caseSeq: number;
  subjectName: string;
  /** SHA-256 of the package's manifest.json (= the digest its Ed25519 signature covers). */
  manifestSha256: string;
  /** Sealed track hashes in TRACK_ORDER (VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02). */
  tracks: readonly [string, string, string, string];
  /** The TAMPERED package only: the track whose stored media was altered, and what it now hashes to. */
  altered?: { trackId: TrackId; sha256: string };
}

/** Keyed by evidence suffix. Generated from `DEMO_EVIDENCE_INDEX` (see the file header). */
export const DEMO_PACKAGE_INTEGRITY: Readonly<Record<string, DemoPackageIntegrity>> = {
  '0001': {
    sessionSeq: 11,
    caseSeq: 1,
    subjectName: 'Siti Rahma',
    manifestSha256: '92a639b2c065df4be28c5de226fb949039be04c2d074f311e25edcbbece16189',
    tracks: [
      '4fd641768c8fa4090bd93cc9aa43e0c3f7480fbf46bbf28dc9e34ee80d57ad45',
      '5eb356957e5a227bd3c6f38f66fe655c4980d99d46aa4b0dd1de86806e914871',
      '08b09d7cb0483148e3f54fdd6400ce095e50ea26e0c94b12f0b90cd436eb76f8',
      '95c3acf73ab4db2974c82e4ffbb077011dee4a5f44f0f7a39d5111a46d74b0a0',
    ],
  },
  '0002': {
    sessionSeq: 12,
    caseSeq: 2,
    subjectName: 'Budi Hartono',
    manifestSha256: 'ed764b085f752549d7c31d773c4e6592f4ea11ba02dd763d7df3c35ee4845497',
    tracks: [
      '795e3a3fb8f380eb46ad3da367224910c8cd556189643f3d76d1befc75cb8e42',
      '82168ab7d607975c5c51b15ee2640302bbd2805ed75871e8dd4e070d7d54d6ef',
      '593819ad4fdf8a920f1619f09c2fe8b0144467b728108d22d718b58f432be7e6',
      '83e23faedc2f3705a427660c050cee1bf24c41998e9b1f45d7b1a1cbc9235915',
    ],
  },
  '0003': {
    sessionSeq: 13,
    caseSeq: 3,
    subjectName: 'Rudi Setiawan',
    manifestSha256: '8ae6eda81c1a63c8c14951ee0b4cea05831e7e879c9db3712c46a9ff1fbbcc6e',
    tracks: [
      'badc84701511ee50ac2becf68f0a27613674fd71db89cea14a06e3329a87047f',
      'f6098d477be0e8a42cd5555c60d550bba6efe08d22ca5a0a88416370254753ec',
      '9fbae8c4de68d80a2477f0e94b8617c16bba8c33a515b67729f288191b67538a',
      '36630d5cfbf2b30cb7af2484ec59e1a7bcf2720f15aee0528e4d466a2d3b60c6',
    ],
  },
  '0004': {
    sessionSeq: 14,
    caseSeq: 4,
    subjectName: 'Maya Lestari',
    manifestSha256: '403909dc0ed7d1e91bd6bf07ec3bb3c8c6a02c0bc236b465fb93dd780239dee1',
    tracks: [
      '8a118ca0627b9a008ee1152edad540be884e5a232eb2515805912da9deb2c04a',
      'a904438e454e860add759306c5de9ced90e05d4e153ed0cf26b8c2909b59dbd9',
      'ad6aa4e1591259a027c832793f8f784d67fd59f0a092937c059de1caa0577c78',
      '728b535907b3cb993941be4554b997d1d26a41301cfc7f5cdd977f8dc16aed0d',
    ],
  },
  '0005': {
    sessionSeq: 15,
    caseSeq: 5,
    subjectName: 'Dewi Anggraini',
    manifestSha256: '6f93e7935f459f6be4c4f2098daa23eda3f1ede1ec389c0e466d46bd200e8b69',
    tracks: [
      '3c36139fc5d946d2290bd89d12e2a657a46a01a628ae0cb7776cd619794da903',
      '91da7d0ea99c345ec08e57b645b9931c3fb9e0d97ab4d08a30b057230a8d9a70',
      'd7e83d202d1fbb8652f1266461523488ee39f66237d268ba2b8e105a4fff5f2e',
      'bb3af24347c7a036a7263bd660b1a37cd53bae699d885c3527eeac4394cd0d0c',
    ],
    altered: { trackId: 'AUDIO-02', sha256: '6fdd78d18e15ca1cd7515332af712c2385164ae9cb6a0e0164ba23a49e5e91c8' },
  },
  '0006': {
    sessionSeq: 16,
    caseSeq: 6,
    subjectName: 'Hendra Wijaya',
    manifestSha256: 'fc673f479a8dd1ff723824c9c283ec41fe5219bad30f9a884e48788eaaca5ab8',
    tracks: [
      'ff94675b03a1a8907c0ec7e9ddda52ae063dbb6ed03f26797512a5d1ef52676e',
      '4e4cc30765df1155981929a0a1ad36c7aeed6f6040ed9ebfb6e0838792035c86',
      '60986fe9c14537f731af493d26af6627d3ed476cb60a8d2a6c873ed6b934fcb8',
      '8ee568223913ff0e7b8048299419e61cc12dc815b821b43aef4b2586444783cb',
    ],
  },
  '0007': {
    sessionSeq: 17,
    caseSeq: 3,
    subjectName: 'Rahmat Hidayat',
    manifestSha256: '43f511e0d4131a640cef259d4bd3e69d1607b210b225670092312c6b6d3fbc28',
    tracks: [
      'ef9f0bb4f830af6b5edcee942f2dd9039e30b95a1f3c03ce24b02cd4e83f7ad6',
      'e13ed9e80284575a29a25feb3daa84e51a3b90df2e5421e50b78cd3a4c0243b7',
      'bede1c1040decfddf43d2be29b273b2e605d6b7863b700d7babfb6bd31394234',
      'dd0f58076da977cf5bab2571b2221337eeda9dd533e326110cfc15bb91eeca17',
    ],
  },
  '0008': {
    sessionSeq: 18,
    caseSeq: 1,
    subjectName: 'Nur Aini',
    manifestSha256: 'aa9e15727352950f15b192ab1caca30b956b8402c5929bfd18d8beadde10044a',
    tracks: [
      '48a6f8f8dfce29e962141eeb5f8aea2e1ba7acef4db70db8fac34958acc72170',
      '4b5ff94209d540448dd180bf69d8b47f35f20d36bfa2ea87d3d069249340abe0',
      '1410695eda3e034fcd7ef2244f1532789190dcfbb255937b10ba44d514a27b15',
      '99cca094504b308759b257bedc230652d369539be887b5edf204994393d5f186',
    ],
  },
  '0009': {
    sessionSeq: 19,
    caseSeq: 3,
    subjectName: 'Yusuf Pratomo',
    manifestSha256: '6864fef4d7e1ca6db7676b49d312e17b3bb327cf91d6d08ed6afcfc7c94f6beb',
    tracks: [
      '89666bcd21875a249075523bfdbc1a27a376152a96869ef8bc158876783739ff',
      '5e8f12a1037767efae78fd69d20b2392f986de9eb01c723572214903cfffb79b',
      '755bebea2718ae8d18e7c1f9e3a217acc102188620a842fb8c8f19e23cc5052c',
      '86d4e288908f1f5365cdaa6ac560ce484660c7106e15e2434318d95f64baafb8',
    ],
  },
  '0010': {
    sessionSeq: 20,
    caseSeq: 5,
    subjectName: 'Sri Wahyuni',
    manifestSha256: '9816039d9999fb58e0d6b04cc5d49539fca28ba6250092a002a3128d4705fea9',
    tracks: [
      '340bead14dfeeec5f267f3d1c4717f859437d6c4e8a247f6e3a63889a089162a',
      '58fd653baa3954a42807761f3e1407fd612de021a8c119434b98c02281f81201',
      '1a71fcc872715bec68819377c56523aaf9afb2440603fae6bc3560a1b0d70a1c',
      '08bc76719a160782a34be70c6bcf0e46bd0c29f350c5e3403fbd80030c77d5eb',
    ],
  },
  '0011': {
    sessionSeq: 21,
    caseSeq: 2,
    subjectName: 'Fajar Nugroho',
    manifestSha256: 'c511fef120140fbb50e8c62628c5642698348639be4d63edbce47d2cd0e732d9',
    tracks: [
      '24be015112b2ad42ca00687cd96cabe018e293284fcd0eef03986bf3271b525b',
      'dcf8b9485349da4262b14a5bf486227a235c908cb512bf0d85e8cfc4ad0a8514',
      'bee6e4f8d19a2d9d5ecb6a8419d2a3d5c3e76ec51d2051b66cd17e072ce10338',
      '8042ce550917ae8d661015b2d19b81d46cfc4ca9dc28449de382a25523a4acc1',
    ],
  },
  '0012': {
    sessionSeq: 22,
    caseSeq: 4,
    subjectName: 'Indah Permata',
    manifestSha256: '1b446bb51bd6330ef72e65aff51969c7da41a057379c1df45c1e0b6a954f31b7',
    tracks: [
      '888da63e64caaa6b1767bc533b2c89809c0daffc3a72a6eadd74c6e548f0dde8',
      'd2bb76b9e99b00da6247cc0356dab0824ae6cb47b15b809b037b07f8a7894cb7',
      '4157c42ebc366aef17f9a83afa91c5daf3e1fff7d001268b133bc340cf3f7fb6',
      '337f5b628348ad57ab913e627134448fe5401ea04f94eed83a526a5d4d8e80eb',
    ],
  },
  '0013': {
    sessionSeq: 23,
    caseSeq: 6,
    subjectName: 'Wahyu Saputra',
    manifestSha256: 'e01badaa8a8bdd7f83f37d8afb4ac6852b678f6e45faf360f05a27d2296ef5df',
    tracks: [
      '449aac33a83d9232ce0a98a61839442af6956e93ad130bc7863256bbbbe81744',
      'e796c6afcfee10513a750d9a0a35bb9ae2d1d3493d7760e1c3884a0010d534d8',
      'f5e493bc42072e7ab543f40e9dda4e4deaa2f66c91eff9c62c0578bf891c233c',
      'f06a3a4a2079249da092fc5da22cb4ff5f9eaabca8fc936574c5d9a80855b46a',
    ],
  },
  '0014': {
    sessionSeq: 24,
    caseSeq: 7,
    subjectName: 'Ahmad Fauzi',
    manifestSha256: '277799d28098fad81b0293ad74ea5f44414546c82ee1cce5da59cea3173b1bf4',
    tracks: [
      'f151cb58ac54afdb9d3c33c251a598479adf19d505f8df973880ee23dcec3e86',
      'a4bfcf70cdd6db70bcbf4819e3b9317cce62cdf7f5260ffdfb6b0110f515f10f',
      '674d96b979f7ca6fc914bcc2dab1b856602faeae13c297037e81c667eb48b541',
      'e4ceb553e450cb8b3b29a8e31ab4b0d023b02753af4248dbf9f7d4e369db89d2',
    ],
  },
};

const SUFFIX = /-(\d{1,4})$/;

function seqOf(id: string): number | null {
  const match = SUFFIX.exec(id.trim());
  return match?.[1] ? Number(match[1]) : null;
}

export interface DemoJoinFields {
  evidenceId: string;
  sessionId: string;
  caseNumber: string;
  subjectName: string;
}

/**
 * The package facts for an evidence item, or null. Matches on evidence suffix, session suffix,
 * case sequence and subject name (never on the dated parts).
 */
export function demoPackageIntegrityFor(item: DemoJoinFields): DemoPackageIntegrity | null {
  const evidenceSeq = seqOf(item.evidenceId);
  if (evidenceSeq === null) return null;
  const entry = DEMO_PACKAGE_INTEGRITY[String(evidenceSeq).padStart(4, '0')];
  if (!entry) return null;
  return entry.sessionSeq === seqOf(item.sessionId) &&
    entry.caseSeq === seqOf(item.caseNumber) &&
    entry.subjectName === item.subjectName.trim()
    ? entry
    : null;
}

/** The sealed hash of one track of a package. */
export function demoTrackHash(entry: DemoPackageIntegrity, trackId: TrackId): string {
  const index = TABLE_TRACK_ORDER.indexOf(trackId);
  return entry.tracks[index] ?? '';
}
