/**
 * Prefix icon of a §5.3 check row (MB 7 grouped-row vocabulary: icon, title, status chip). Lucide
 * icons coloured by the check's tone (token text colours, MA-22).
 */
import { Camera, Clock, HardDrive, Mic, MicVocal, Server, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import type { PrecheckCheckId } from '@dems/shared/sim';
import { toneTextHex, type StatusTone } from '@dems/shared/tokens';

const ICONS: Readonly<Record<PrecheckCheckId, LucideIcon>> = {
  CORE: Server,
  LENS_1: Camera,
  LENS_2: Camera,
  // Audit M3-04 R1 (register C5; D53, row 83): cameras 3/4 and mic channels 3/4 of the twelve-check pre-check.
  // Without them `ICONS[id]` was undefined and the row crashed the screen (G-1). Same choice as web devices-step.
  LENS_3: Camera,
  LENS_4: Camera,
  MIC_1: Mic,
  MIC_2: Mic,
  // Schema v2 (SH-03; ux MB-02): the role-keyed pair — the input that is PRIMARY / STANDBY right now.
  MIC_PRIMARY: Mic,
  MIC_STANDBY: MicVocal,
  MIC_3: Mic,
  MIC_4: Mic,
  STORAGE: HardDrive,
  TIME: Clock,
  SECURITY: ShieldCheck,
};

export interface CheckIconProps {
  id: PrecheckCheckId;
  tone: StatusTone;
  size?: number;
}

export function CheckIcon({ id, tone, size = 18 }: CheckIconProps) {
  const Icon = ICONS[id];
  return <Icon size={size} color={toneTextHex[tone]} />;
}
