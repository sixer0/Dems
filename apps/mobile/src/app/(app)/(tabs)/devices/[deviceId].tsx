import { Redirect, useLocalSearchParams } from 'expo-router';
import { DeviceDetailScreen } from '@/features/devices/device-detail-screen';
import { parseRecordId, useDetailPaneHandover } from '@/navigation';

/**
 * Route `/devices/[deviceId]` (04_mobile_specs §4.12 V5). A malformed id returns to the list. On medium and
 * expanded windows the detail lives in the list's pane, so this route hands over to
 * `/devices?selected=<id>` (§2.5 rule 3).
 */
export default function DeviceDetailRoute() {
  const params = useLocalSearchParams<{ deviceId: string }>();
  const id = parseRecordId(params.deviceId);
  const handingOver = useDetailPaneHandover(id);
  if (id === null) return <Redirect href="/devices" />;
  if (handingOver) return null;
  return <DeviceDetailScreen deviceId={id} />;
}
