import { Chip, type ChipProps } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  BADGES,
  toneChipProps,
  toneTextHex,
  type StatusTone,
  type ToneIconName,
} from '@dems/shared/tokens';
import { TONE_ICONS } from '@/lib/tone-icons';
import { cn } from './cn';

export type BadgeKey = keyof typeof BADGES;

interface StatusChipCommon extends Omit<ChipProps, 'color' | 'children'> {
  /** A tone icon name (01S §2.8), any Lucide icon, or `null` for a label-only chip. */
  icon?: ToneIconName | LucideIcon | null;
  /** Fill the icon with the tone colour (the design's filled Recording dot). */
  iconFilled?: boolean;
}

interface ToneChipProps extends StatusChipCommon {
  tone: StatusTone;
  label: string;
  badge?: never;
}

interface BadgeChipProps extends StatusChipCommon {
  /** A design badge (DesignSystem §06): supplies tone, icon and label. */
  badge: BadgeKey;
  /** Overrides the badge label (for example its i18n copy). */
  label?: string;
  tone?: never;
}

export type StatusChipProps = ToneChipProps | BadgeChipProps;

const ICON_SIZE = { sm: 12, md: 14, lg: 16 } as const;

/**
 * Status chip recipe (04_mobile_specs §4.0; 01S §2.8, §2.10): a kit `Chip` in the tone's colour.
 * The five kit tones map straight to `Chip color`; `info` and `sealed` use `color="default"` plus
 * the shared className recipe, and their label takes the token text colour, because React Native
 * text does not inherit a colour class from its container.
 */
export function StatusChip({
  badge,
  tone: toneProp,
  label: labelProp,
  icon,
  iconFilled = false,
  className,
  variant = 'soft',
  size = 'md',
  ...chipProps
}: StatusChipProps) {
  const spec = badge ? BADGES[badge] : null;
  const tone: StatusTone = spec?.tone ?? toneProp ?? 'default';
  const label = labelProp ?? spec?.label ?? '';
  const iconChoice = icon === undefined ? (spec?.icon ?? null) : icon;
  const Icon: LucideIcon | null = typeof iconChoice === 'string' ? TONE_ICONS[iconChoice] : iconChoice;

  const toneProps = toneChipProps(tone);
  const textColor = toneTextHex[tone];
  const isRecipeTone = tone === 'info' || tone === 'sealed';

  return (
    <Chip
      accessibilityLabel={label}
      {...chipProps}
      color={toneProps.color}
      variant={variant}
      size={size}
      className={cn(toneProps.className, className)}
    >
      {Icon ? <Icon size={ICON_SIZE[size]} color={textColor} fill={iconFilled ? textColor : 'none'} /> : null}
      <Chip.Label style={isRecipeTone ? { color: textColor } : undefined}>{label}</Chip.Label>
    </Chip>
  );
}
