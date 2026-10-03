import { useLocalSearchParams } from 'expo-router';
import { DevicesScreen } from '@/features/devices/devices-screen';
import { parseRecordId, useSelectionPush } from '@/navigation';

/**
 * Route `/devices` (tab Devices; MB 7; 04_mobile_specs §4.12). `?selected=<id>` opens the detail pane on medium and expanded
 * windows; on single-pane windows it becomes the pushed detail route (§2.5 rule 3).
 */
export default function DevicesRoute() {
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const selectedId = parseRecordId(selected);
  useSelectionPush('/devices', selectedId);
  return <DevicesScreen selectedId={selectedId} />;
}
