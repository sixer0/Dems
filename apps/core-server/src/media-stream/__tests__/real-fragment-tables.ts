/**
 * REAL fragment tables for the tests of the indexed view (fix wave K Z1; not a test file).
 *
 * Copied from the SIGNED manifests of two packages the product sealed on lane 2 from the generated
 * (FAKE) sources on 2026-10-10: `CLEAN` = a session that was stopped (EV-20261010-0015),
 * `INTERRUPTED` = a recording that was cut and sealed as its prefix (EV-20261010-0017; every
 * fragment record says `interrupted`). Only the members an index is built from, the track's byte
 * length and its duration: no hash, no nonce, no tag, no key ID, no media.
 * Row: [seq, byteOffset, byteLength, mediaStartMs, mediaDurationMs, keyframe (1 | 0)].
 */
export type FragmentRow = readonly [seq: number, byteOffset: number, byteLength: number, mediaStartMs: number, mediaDurationMs: number, keyframe: 0 | 1];
export interface RealTable {
  readonly trackId: 'VIDEO-01' | 'VIDEO-02';
  readonly bytes: number;
  readonly durationMs: number;
  readonly interrupted: boolean;
  readonly rows: readonly FragmentRow[];
}
export const rowsToFragments = (table: RealTable) => table.rows.map(([seq, byteOffset, byteLength, mediaStartMs, mediaDurationMs, keyframe]) => ({ seq, byteOffset, byteLength, mediaStartMs, mediaDurationMs, keyframe: keyframe === 1 }));

export const CLEAN_TABLES: readonly RealTable[] = [
  {
    trackId: 'VIDEO-01',
    bytes: 30469319,
    durationMs: 60795,
    interrupted: false,
    // prettier-ignore
    rows: [
      [1, 1249, 568565, 0, 2602, 1],
      [2, 569814, 1089106, 2538, 2064, 1],
      [3, 1658920, 1522426, 4544, 3056, 1],
      [4, 3181346, 1528400, 7530, 3069, 1],
      [5, 4709746, 1543601, 10538, 3054, 1],
      [6, 6253347, 1021581, 13525, 2071, 1],
      [7, 7274928, 1034775, 15530, 2067, 1],
      [8, 8309703, 1025812, 17536, 2063, 1],
      [9, 9335515, 1014981, 19541, 2061, 1],
      [10, 10350496, 1541144, 21525, 3069, 1],
      [11, 11891640, 1027129, 24533, 2063, 1],
      [12, 12918769, 1039139, 26538, 2063, 1],
      [13, 13957908, 1527876, 28544, 3053, 1],
      [14, 15485784, 1020711, 31530, 2068, 1],
      [15, 16506495, 1542127, 33536, 3060, 1],
      [16, 18048622, 1021874, 36544, 2056, 1],
      [17, 19070496, 1541421, 38528, 3067, 1],
      [18, 20611917, 1028914, 41536, 2063, 1],
      [19, 21640831, 1528064, 43541, 3055, 1],
      [20, 23168895, 1540191, 46528, 3071, 1],
      [21, 24709086, 1558294, 49536, 3058, 1],
      [22, 26267380, 1012634, 52522, 2077, 1],
      [23, 27280014, 1034304, 54528, 2074, 1],
      [24, 28314318, 1010737, 56533, 2069, 1],
      [25, 29325055, 1144264, 58538, 2257, 1],
    ],
  },
  {
    trackId: 'VIDEO-02',
    bytes: 29703165,
    durationMs: 60799,
    interrupted: false,
    // prettier-ignore
    rows: [
      [1, 1249, 587719, 0, 4105, 1],
      [2, 588968, 1587931, 4032, 3069, 1],
      [3, 2176899, 1541158, 7040, 3061, 1],
      [4, 3718057, 1010621, 10048, 2059, 1],
      [5, 4728678, 1540332, 12032, 3075, 1],
      [6, 6269010, 1556939, 15040, 3064, 1],
      [7, 7825949, 1010402, 18048, 2059, 1],
      [8, 8836351, 1533326, 20032, 3072, 1],
      [9, 10369677, 1537878, 23040, 3066, 1],
      [10, 11907555, 1545150, 26048, 3052, 1],
      [11, 13452705, 1023652, 29034, 2071, 1],
      [12, 14476357, 1547099, 31040, 3060, 1],
      [13, 16023456, 1010308, 34048, 2057, 1],
      [14, 17033764, 1032558, 36032, 2074, 1],
      [15, 18066322, 1022196, 38037, 2069, 1],
      [16, 19088518, 1542117, 40042, 3063, 1],
      [17, 20630635, 1546803, 43029, 3070, 1],
      [18, 22177438, 1010046, 46037, 2064, 1],
      [19, 23187484, 1540160, 48021, 3083, 1],
      [20, 24727644, 1559051, 51029, 3077, 1],
      [21, 26286695, 1528752, 54037, 3060, 1],
      [22, 27815447, 1016043, 57045, 2057, 1],
      [23, 28831490, 871675, 59029, 1770, 1],
    ],
  },
];
export const INTERRUPTED_TABLES: readonly RealTable[] = [
  {
    trackId: 'VIDEO-01',
    bytes: 14459405,
    durationMs: 29605,
    interrupted: true,
    // prettier-ignore
    rows: [
      [1, 1249, 569497, 0, 2598, 1],
      [2, 570746, 1591624, 2538, 3067, 1],
      [3, 2162370, 1541253, 5546, 3057, 1],
      [4, 3703623, 1007109, 8533, 2073, 1],
      [5, 4710732, 1543820, 10538, 3064, 1],
      [6, 6254552, 1021684, 13546, 2059, 1],
      [7, 7276236, 1542350, 15552, 3046, 1],
      [8, 8818586, 1038396, 18538, 2064, 1],
      [9, 9856982, 1005125, 20544, 2059, 1],
      [10, 10862107, 1031003, 22528, 2076, 1],
      [11, 11893110, 1544249, 24533, 3071, 1],
      [12, 13437359, 1022046, 27541, 2064, 1],
    ],
  },
  {
    trackId: 'VIDEO-02',
    bytes: 14477663,
    durationMs: 31122,
    interrupted: true,
    // prettier-ignore
    rows: [
      [1, 1249, 588782, 0, 4123, 1],
      [2, 590031, 1084047, 4053, 2070, 1],
      [3, 1674078, 1527590, 6058, 3058, 1],
      [4, 3201668, 1019086, 9066, 2051, 1],
      [5, 4220754, 1540343, 11050, 3068, 1],
      [6, 5761097, 1534373, 14058, 3063, 1],
      [7, 7295470, 1542706, 17066, 3056, 1],
      [8, 8838176, 1532958, 20053, 3069, 1],
      [9, 10371134, 1537868, 23061, 3056, 1],
      [10, 11909002, 1547441, 26048, 3067, 1],
      [11, 13456443, 1021220, 29056, 2066, 1],
    ],
  },
];
