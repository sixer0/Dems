/**
 * REAL init segments and fragment tables for the tests of fix 151 (not a test file), and the
 * builder of an H.264 sequence parameter set for the made-up ones.
 *
 * REAL_INIT_SEGMENT: the first 1,249 bytes (`ftyp` + `moov`, up to the first `moof`) of a camera
 * file the product sealed on lane 2 from the generated (FAKE) sources - `VIDEO-01.mp4` of
 * EV-20261011-0025. An init segment is stored in the clear in a sealed package; the same bytes
 * (SHA-256 cd44581d5fba9f2d...) open both camera files of every item recorded on that lane on
 * 2026-10-10 and 2026-10-11. SEED_INIT_SEGMENT: the first 1,269 bytes of a camera file of the
 * lane's demo item EV-20261008-0001 (SHA-256 af1fb87263c987ba...). Headers only: no media byte, no
 * hash of media, no nonce, no tag, no key ID.
 *
 * The tables: copied from the SIGNED manifests - per fragment [seq, mediaStartMs, mediaDurationMs],
 * the track's first video sample (manifest fields 127, 128) and the text field 36 was sealed with.
 * `SEALED_AS_MEASURED` = the first 8 rows of EV-20261011-0025 (the item whose manifest states
 * `H264_720P27.67` / `H264_720P26`); `INTERRUPTED` = EV-20261010-0017, a recording that was cut
 * and sealed as its prefix.
 */
const bytesOf = (base64: string): Uint8Array => Uint8Array.from(Buffer.from(base64, 'base64'));

// prettier-ignore
export const REAL_INIT_SEGMENT: Uint8Array = bytesOf(
  'AAAAHGZ0eXBpc281AAACAGlzbzVpc282bXA0MQAABMVtb292AAAAbG12aGQAAAAAAAAAAAAAAAAACvyAAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB6XRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAFAAAA' +
  'AtAAAAAAAYVtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAV+QAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAEwbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAA' +
  'JGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA8HN0YmwAAACkc3RzZAAAAAAAAAABAAAAlGF2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAFAALQAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAuYXZjQwFCwB//4QAXZ0LAH9oBQBbsBEAAAAMAQAAADyPGDKgBAARozjyAAAAAEHBhc3AAAAABAAAAAQAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAA' +
  'FHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAABv3RyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAA' +
  'AEAAAAAAAAAAAAAAAAAAAVttZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAEGbWluZgAAABBzbWhkAAAAAAAA' +
  'AAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAADKc3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAALuAAAAAAAA2ZXNkcwAAAAADgICAJQACAASA' +
  'gIAXQBUAAAAAAXcAAAF3AAWAgIAFEYhW5QAGgICAAQIAAAAUYnRydAAAAAAAAXcAAAF3AAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAA' +
  'AAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAACB0cmV4AAAAAAAAAAIAAAABAAAAAAAAAAAAAAAAAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAA' +
  'AAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2My4xLjEwMg==',
);

// prettier-ignore
export const SEED_INIT_SEGMENT: Uint8Array = bytesOf(
  'AAAAHGZ0eXBpc281AAACAGlzbzVpc282bXA0MQAABNltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAALuAAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB/XRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAFAAAA' +
  'AtAAAAAAAZltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAADwAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAFEbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAA' +
  'JGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABBHN0YmwAAAC4c3RzZAAAAAAAAAABAAAAqGF2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAFAALQAEgAAABIAAAAAAAAAAEUTGF2YzYzLjEuMTAy' +
  'IGxpYngyNjQAAAAAAAAAAAAAAAAY//8AAAAuYXZjQwFCwB//4QAXZ0LAH9oBQBbsBEAAAAMAQAAADyPGDKgBAARozjyAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAehIAA9CQAAPQkAAAAAEHN0dHMAAAAAAAAA' +
  'AAAAABBzdHNjAAAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAABBzdGNvAAAAAAAAAAAAAAG/dHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAABAQAAAAABAAAAAAAAAAAA' +
  'AAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAABW21kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAu4AAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAA' +
  'AQZtaW5mAAAAEHNtaGQAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAMpzdGJsAAAAfnN0c2QAAAAAAAAAAQAAAG5tcDRhAAAAAAAAAAEAAAAAAAAAAAABABAAAAAAu4AAAAAA' +
  'ADZlc2RzAAAAAAOAgIAlAAIABICAgBdAFQAAAAAA+gAAAPoABYCAgAURiFblAAaAgIABAgAAABRidHJ0AAAAAAAA+gAAAPoAAAAAEHN0dHMAAAAAAAAAAAAAABBzdHNjAAAAAAAAAAAAAAAUc3RzegAAAAAAAAAA' +
  'AAAAAAAAABBzdGNvAAAAAAAAAAAAAABIbXZleAAAACB0cmV4AAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAIHRyZXgAAAAAAAAAAgAAAAEAAAAAAAAAAAAAAAAAAABhdWR0YQAAAFltZXRhAAAAAAAAACFoZGxy' +
  'AAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAACxpbHN0AAAAJKl0b28AAAAcZGF0YQAAAAEAAAAATGF2ZjYzLjEuMTAy',
);

export interface RealTrackTable {
  readonly trackId: 'VIDEO-01' | 'VIDEO-02';
  /** Manifest field 36 as that package was sealed. */
  readonly sealedProfile: string;
  readonly firstVideoSamplePts: number;
  readonly firstVideoSampleTimescale: number;
  readonly interrupted: boolean;
  readonly rows: readonly (readonly [seq: number, mediaStartMs: number, mediaDurationMs: number])[];
}

export const SEALED_AS_MEASURED: readonly RealTrackTable[] = [
  {
    trackId: 'VIDEO-01',
    sealedProfile: 'H264_720P27.67',
    firstVideoSamplePts: 141509,
    firstVideoSampleTimescale: 90000,
    interrupted: false,
    // prettier-ignore
    rows: [[1, 0, 2595], [2, 2538, 3053], [3, 5525, 2070], [4, 7530, 3064], [5, 10538, 3054], [6, 13525, 3069], [7, 16533, 2065], [8, 18538, 2061]],
  },
  {
    trackId: 'VIDEO-02',
    sealedProfile: 'H264_720P26',
    firstVideoSamplePts: 280890,
    firstVideoSampleTimescale: 90000,
    interrupted: false,
    // prettier-ignore
    rows: [[1, 0, 4137], [2, 4074, 2062], [3, 6080, 2060], [4, 8085, 3055], [5, 11072, 3068], [6, 14058, 3086], [7, 17088, 2056], [8, 19072, 3064]],
  },
];

export const INTERRUPTED: readonly RealTrackTable[] = [
  {
    trackId: 'VIDEO-01',
    sealedProfile: 'H264_1080P25',
    firstVideoSamplePts: 142555,
    firstVideoSampleTimescale: 90000,
    interrupted: true,
    // prettier-ignore
    rows: [[1, 0, 2598], [2, 2538, 3067], [3, 5546, 3057], [4, 8533, 2073], [5, 10538, 3064], [6, 13546, 2059], [7, 15552, 3046], [8, 18538, 2064], [9, 20544, 2059], [10, 22528, 2076], [11, 24533, 3071], [12, 27541, 2064]],
  },
  {
    trackId: 'VIDEO-02',
    sealedProfile: 'H264_1080P25',
    firstVideoSamplePts: 279159,
    firstVideoSampleTimescale: 90000,
    interrupted: true,
    // prettier-ignore
    rows: [[1, 0, 4123], [2, 4053, 2070], [3, 6058, 3058], [4, 9066, 2051], [5, 11050, 3068], [6, 14058, 3063], [7, 17066, 3056], [8, 20053, 3069], [9, 23061, 3056], [10, 26048, 3067], [11, 29056, 2066]],
  },
];

// ── A made-up H.264 sequence parameter set (ITU-T H.264 7.3.2.1.1, E.1.1) ─────────────────────────

export interface SpsInput {
  readonly width: number;
  readonly height: number;
  /** `num_units_in_tick` and `time_scale` of the timing information; null: the parameter set has a VUI without timing; undefined: no VUI at all. */
  readonly timing?: { readonly unitsInTick: number; readonly timeScale: number } | null;
  /** 66 (Baseline, the default) or 100 (High: the chroma / bit depth / scaling members are present). */
  readonly profile?: 66 | 100;
}

/** The NAL unit of a sequence parameter set, as `avcC` holds it (emulation prevention bytes in). Sizes are multiples of 16. */
export function spsNal(input: SpsInput): Uint8Array {
  const bits: number[] = [];
  const u = (count: number, value: number): void => {
    for (let bit = count - 1; bit >= 0; bit -= 1) bits.push(Math.floor(value / 2 ** bit) % 2);
  };
  const ue = (value: number): void => {
    const code = value + 1;
    const length = Math.floor(Math.log2(code));
    u(length, 0);
    u(length + 1, code);
  };
  const profile = input.profile ?? 66;
  u(8, profile);
  u(8, 0);
  u(8, 31);
  ue(0);
  if (profile === 100) {
    ue(1); // chroma_format_idc 4:2:0
    ue(0);
    ue(0);
    u(1, 0);
    u(1, 0); // no scaling matrix
  }
  ue(0);
  ue(2); // pic_order_cnt_type 2
  ue(1);
  u(1, 0);
  ue(input.width / 16 - 1);
  ue(input.height / 16 - 1);
  u(1, 1); // frame_mbs_only_flag
  u(1, 1);
  u(1, 0); // no cropping
  if (input.timing === undefined) u(1, 0);
  else {
    u(1, 1); // vui_parameters_present_flag
    u(1, 0);
    u(1, 0);
    u(1, 0);
    u(1, 0);
    if (input.timing === null) u(1, 0);
    else {
      u(1, 1);
      u(32, input.timing.unitsInTick);
      u(32, input.timing.timeScale);
      u(1, 1);
    }
    u(1, 0);
    u(1, 0);
    u(1, 0);
    u(1, 0);
  }
  u(1, 1); // rbsp_stop_one_bit
  while (bits.length % 8 !== 0) bits.push(0);
  const rbsp: number[] = [];
  for (let at = 0; at < bits.length; at += 8) rbsp.push(bits.slice(at, at + 8).reduce((byte, bit) => byte * 2 + bit, 0));
  const out: number[] = [0x67];
  let zeros = 0;
  for (const byte of rbsp) {
    if (zeros >= 2 && byte <= 3) {
      out.push(3);
      zeros = 0;
    }
    out.push(byte);
    zeros = byte === 0 ? zeros + 1 : 0;
  }
  return Uint8Array.from(out);
}

/** The `avcC` box of a sample entry around one sequence parameter set (no picture parameter set: nothing here reads one). */
export function avcCBox(sps: Uint8Array | null): Uint8Array {
  const body = sps === null ? [1, 66, 0, 31, 0xff, 0xe0, 0] : [1, sps[1] ?? 66, 0, 31, 0xff, 0xe1, sps.length >> 8, sps.length & 255, ...sps, 0];
  const size = 8 + body.length;
  return Uint8Array.from([0, 0, size >> 8, size & 255, 0x61, 0x76, 0x63, 0x43, ...body]);
}
