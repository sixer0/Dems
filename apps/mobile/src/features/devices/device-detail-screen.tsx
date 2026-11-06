import { SafeScreen } from '@/layout';
import { DeviceDetail } from './device-detail';

export interface DeviceDetailScreenProps {
  /** Validated device id from the path (`recordIdSchema`). */
  readonly deviceId: string;
}

/**
 * Device detail (04 §4.12 V5) at `/devices/[deviceId]`. Owner: step 84 (P6).
 *
 * The route file under `src/app/` renders `<DeviceDetailScreen … />` on single-pane windows (on
 * medium and expanded windows it hands over to `/devices?selected=<id>`, where the list screen
 * shows the same `DeviceDetail` in its detail pane). The root stays `SafeScreen id="device-detail"`
 * (testID `screen-device-detail`, 04 §4.0; T-M02, MA-04).
 */
export function DeviceDetailScreen({ deviceId }: DeviceDetailScreenProps) {
  return (
    <SafeScreen id="device-detail">
      <DeviceDetail key={deviceId} deviceId={deviceId} variant="screen" />
    </SafeScreen>
  );
}
