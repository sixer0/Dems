// Prints the product argument lists of the camera helper as JSON, for `local_camera_e2e.py`
// (blueprint row 134; checks M4-LOCAL-AV-1, M4-LOCAL-CAM-1). The harness never restates the
// table: it asks this script, which asks `camera-helper-args.ts`.
//
//   npx tsx print-camera-args.ts <VIDEOTOOLBOX|X264> <startMs> <ingestUrl> [<ingestUrl> ...]
import { CAMERA_HELPER_TABLE, LOCAL_CAMERA_DEVICE_NAME, cameraPushArguments, deviceListArguments, type CameraHelperEncoder } from '../../camera-helper-args';

const [encoder, startMs, ...urls] = process.argv.slice(2);
const push = urls.map((ingestUrl) => cameraPushArguments({ source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder: encoder as CameraHelperEncoder, ingestUrl, startMs: Number(startMs) }));
process.stdout.write(
  `${JSON.stringify({ deviceName: LOCAL_CAMERA_DEVICE_NAME, quietLength: CAMERA_HELPER_TABLE.quietLength, deviceInputLength: CAMERA_HELPER_TABLE.deviceInputLength, list: deviceListArguments(), push })}\n`,
);
