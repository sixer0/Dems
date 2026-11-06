// The fixed-grid CANDIDATE of the camera helper table (integration pass D3; decisions D130 (b),
// D133 (4)). The product default is unchanged: frames keep the time they were read. The candidate is
// what `e2e/local_camera_e2e.py cam ... --jitter-ms 10 [--grid]` measured through the worker.
import { describe, expect, it } from 'vitest';
import { CAMERA_HELPER_TABLE, LOCAL_CAMERA_DEVICE_NAME, cameraPushArguments, type CameraPushArguments } from '../camera-helper-args';

const INGEST = 'rtsp://127.0.0.1:8555/live/CAM-03';
const base: CameraPushArguments = { source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder: 'VIDEOTOOLBOX', ingestUrl: INGEST, startMs: 1_791_537_920_123 };
const GRID = ['-vf', 'fps=fps=30:round=near'];

describe('the fixed 30 fps grid is a candidate behind `fixedGrid`, never the default', () => {
  it('the default list holds no filter and keeps `-fps_mode passthrough`', () => {
    for (const fixedGrid of [undefined, false] as const) {
      const list = cameraPushArguments(fixedGrid === undefined ? base : { ...base, fixedGrid });
      expect(list.filter((argument) => argument === '-vf' || argument.startsWith('fps='))).toEqual([]);
      expect(list.join(' ')).toContain('-fps_mode passthrough -enc_time_base 1/90000');
    }
  });

  it('with `fixedGrid` the list is the default list plus ONE filter pair, between the input and the encoder - for both sources and both encoders', () => {
    for (const source of ['DEVICE', 'GENERATED'] as const) {
      for (const encoder of ['VIDEOTOOLBOX', 'X264'] as const) {
        const plain = [...cameraPushArguments({ ...base, source, encoder })];
        const gridded = [...cameraPushArguments({ ...base, source, encoder, fixedGrid: true })];
        const at = plain.indexOf('-an');
        expect(gridded, `${source} ${encoder}`).toEqual([...plain.slice(0, at), ...GRID, ...plain.slice(at)]);
        // The input section ends right before it: the grid works on the frames as they were stamped.
        expect(gridded[at - 2]).toBe('-i');
      }
    }
  });

  it('the pair is a literal of the table (G-R12) and carries the frame rate of the table', () => {
    for (const literal of GRID) expect(CAMERA_HELPER_TABLE.literals).toContain(literal);
  });
});
