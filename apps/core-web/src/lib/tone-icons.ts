import {
  Archive,
  BadgeCheck,
  Circle,
  CircleCheck,
  Eye,
  Info,
  ShieldCheck,
  TriangleAlert,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import type { ToneIconName } from '@dems/shared/tokens'

/** Resolves the lucide icon names stored in @dems/shared (§2.8) to lucide-react components. */
export const TONE_ICONS: Record<ToneIconName, LucideIcon> = {
  CircleCheck,
  Circle,
  BadgeCheck,
  ShieldCheck,
  Wifi,
  TriangleAlert,
  Info,
  Eye,
  Archive,
}
