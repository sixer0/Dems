// M3-SR-3, capture constants muxer safety (blueprint row 59; masterplan/10_test_strategy §A.3;
// capture spec §C.4; register W1-C1, CS-25): the capture constants, the plan and the worker use
// only muxer options this FFmpeg has - `frag_duration`, `frag_size`, `fragment_index`,
// `min_frag_duration` and the four pinned movflags - and the three names that this build does
// NOT have never appear. The worker's own static rules (`apps/capture-worker/check.sh`, rule SR-3
// and W1-C1, with planted lines) hold the same from the C side.
//
// Every forbidden text is built from fragments, so that this file does not contain it. The scan
// has its control: the same pattern over a planted source finds the text.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CapturePlanConstantsSchema } from '@dems/capture-protocol';
import * as contract from '@dems/shared/api';
import { describe, expect, it } from 'vitest';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (path: string): string => readFileSync(resolve(repo, path), 'utf8');
const worker = readdirSync(resolve(repo, 'apps/capture-worker/src')).filter((name) => /\.[ch]$/.test(name)).map((name) => `apps/capture-worker/src/${name}`);
const SOURCES = ['packages/shared/src/api/capture.ts', 'packages/capture-protocol/src/index.ts', 'apps/core-server/src/modules/capture-config/plan.ts', 'apps/core-server/src/capture/supervisor.ts', 'apps/core-server/src/capture/fragments.ts', ...worker];

/** The three option names this FFmpeg build does not have (spec §C.4 "confirmed absences"). */
const ABSENT = [['frag', 'type'], ['default', 'prft'], ['frag', 'start', 'number']].map((parts) => parts.join('_'));
/** Written as an option (a quoted name or a `-name` flag), not as a word of a sentence that says it is absent. */
const asOption = (name: string): RegExp => new RegExp(`['"\`+-]${name}\\b`);
const ALLOWED_OPTIONS = ['frag_duration', 'frag_size', 'fragment_index', 'min_frag_duration'];
const PINNED_MOVFLAGS = ['frag_keyframe', 'empty_moov', 'default_base_moof', 'skip_trailer'];

describe('M3-SR-3: capture constants muxer safety', () => {
  it('reads the sources it judges', () => {
    expect(worker.length).toBeGreaterThanOrEqual(7);
    for (const path of SOURCES) expect(read(path).length, path).toBeGreaterThan(500);
  });

  it('no source of the capture path names an absent muxer option as an option', () => {
    // Code only: a comment may SAY that a name does not exist (the contract's header does).
    const code = (path: string): string => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const hits = SOURCES.flatMap((path) => ABSENT.filter((name) => asOption(name).test(code(path))).map((name) => `${path}: ${name}`));
    // The stripping leaves the code: the worker's pinned flags are still found in it.
    expect(code('apps/capture-worker/src/ingest.c')).toContain('+frag_keyframe+empty_moov+default_base_moof+skip_trailer');
    expect(hits).toEqual([]);
  });

  it('CONTROL: the same search finds each absent name in a planted source, in every form an option is written in', () => {
    for (const name of ABSENT) {
      expect(asOption(name).test(`av_dict_set(&o, "${name}", "1", 0);`), name).toBe(true);
      expect(asOption(name).test(`const args = ['-${name}', '1'];`), name).toBe(true);
      expect(asOption(name).test(`movflags: '+${name}'`), name).toBe(true);
    }
  });

  it('the muxer options the worker sets are movflags, flush_packets and min_frag_duration, and the movflags are exactly the four pinned ones', () => {
    const ingest = read('apps/capture-worker/src/ingest.c');
    // The output context's options are set between the two calls that create it and write its header.
    const output = ingest.slice(ingest.indexOf('avformat_alloc_output_context2'), ingest.indexOf('avformat_write_header'));
    const set = [...output.matchAll(/av_dict_set(?:_int)?\(&o, "([a-z_]+)"/g)].map((match) => match[1]).sort();
    expect(set).toEqual(['flush_packets', 'min_frag_duration', 'movflags']);
    // Every fragmentation option among them is one this FFmpeg has (flush_packets is the I/O option of spec §C.2).
    expect(set.filter((name) => (name ?? '').includes('frag')).every((name) => ALLOWED_OPTIONS.includes(name ?? ''))).toBe(true);
    const flags = /#define DEMS_MOVFLAGS "([^"]+)"/.exec(ingest)?.[1] ?? '';
    expect(flags.split('+').filter(Boolean).sort()).toEqual([...PINNED_MOVFLAGS].sort());
  });

  it('the constants of the contract that drive the muxer are the fragment target, the minimum fragment duration and the GOP target, as whole numbers', () => {
    const values: Record<string, unknown> = contract;
    expect([values.CAPTURE_FRAGMENT_TARGET_MS, values.CAPTURE_MIN_FRAG_DURATION_MS, values.CAPTURE_GOP_FRAMES, values.CAPTURE_OBSERVED_GOP_MAX_MS]).toEqual([2_000, 2_000, 50, 2_000]);
    // No constant of the contract is named after an option the muxer does not have.
    const names = Object.keys(values).map((name) => name.toLowerCase());
    for (const absent of ABSENT) expect(names.filter((name) => name.includes(absent))).toEqual([]);
    // The plan hands the worker six constants; the two for the muxer are these.
    expect(Object.keys(CapturePlanConstantsSchema.shape).sort()).toEqual(['audioChannels', 'audioSampleRateHz', 'fragmentTargetMs', 'gopFrames', 'meterRateHz', 'minFragDurationMs']);
    // The bound the worker holds the observed keyframe interval to is the plan's fragment target: the two contract constants are one number.
    expect(values.CAPTURE_OBSERVED_GOP_MAX_MS).toBe(values.CAPTURE_FRAGMENT_TARGET_MS);
  });
});
