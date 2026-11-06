// Prints the product argument lists of the camera helper as JSON, for `local_camera_e2e.py`
// (blueprint row 134; checks M4-LOCAL-AV-1, M4-LOCAL-CAM-1). The harness never restates the
// table: it asks this script, which asks `camera-helper-args.ts`.
//
//   npx tsx print-camera-args.ts [--grid] <VIDEOTOOLBOX|X264> <startMs> <ingestUrl> [<ingestUrl> ...]
//
// `--grid`: the lists with the fixed-grid candidate of the table (`fixedGrid`, pass D3). Not the product default.
import { CAMERA_HELPER_TABLE, LOCAL_CAMERA_DEVICE_NAME, cameraPushArguments, deviceListArguments, type CameraHelperEncoder } from '../../camera-helper-args';

const given = process.argv.slice(2);
const fixedGrid = given[0] === '--grid';
const [encoder, startMs, ...urls] = fixedGrid ? given.slice(1) : given;
const push = urls.map((ingestUrl) => cameraPushArguments({ source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder: encoder as CameraHelperEncoder, ingestUrl, startMs: Number(startMs), fixedGrid }));
process.stdout.write(
  `${JSON.stringify({ deviceName: LOCAL_CAMERA_DEVICE_NAME, quietLength: CAMERA_HELPER_TABLE.quietLength, deviceInputLength: CAMERA_HELPER_TABLE.deviceInputLength, list: deviceListArguments(), push })}\n`,
);
