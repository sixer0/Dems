/**
 * Round tone-tinted icon tile used by the MB 9 rows (LAN, PoE, Bandwidth, GNSS / NTP): a 36 dp
 * circle with a soft tone fill, a tone hairline and the Lucide icon in the tone's text colour.
 */
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { toneTextHex, type StatusTone } from '@dems/shared/tokens';
import { withAlpha } from '@/components/media';

export const ICON_TILE_SIZE = 36;

export interface IconTileProps {
  icon: LucideIcon;
  tone: StatusTone;
  /** Drawn around the tile (the GNSS orbit). */
  children?: ReactNode;
}

export function IconTile({ icon: Icon, tone, children }: IconTileProps) {
  const color = toneTextHex[tone];
  return (
    <View style={{ width: ICON_TILE_SIZE, height: ICON_TILE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {children}
      <View
        style={{
          width: ICON_TILE_SIZE,
          height: ICON_TILE_SIZE,
          borderRadius: ICON_TILE_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(color, 0.12),
          borderWidth: 1,
          borderColor: withAlpha(color, 0.35),
        }}
      >
        <Icon size={18} color={color} />
      </View>
    </View>
  );
}
