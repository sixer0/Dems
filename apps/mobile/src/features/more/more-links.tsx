/**
 * Secondary destinations and the footer of More (04_mobile_specs §4.17 "About"; "Footer: version
 * and the Core link chip"). MB 10 grouped-row language: a kit `ListGroup` inside a section card,
 * gold icon badge, title, muted description, status chip and chevron.
 *
 * Rows (`linkDestinations`): Pairing (`/pair`, with the pairing state), Recovery status
 * (`/session/recovery`, only while the session is FAULT or RECOVERY), About DEMS
 * (`/settings/about`), and the developer gallery (`/dev-gallery`, debug builds only). These are
 * never tabs, so they show on tablets too. Rows reveal 30 ms apart (M-C-11 `rowReveal`).
 */
import { ListGroup, Separator } from 'heroui-native';
import { ChevronRight, FlaskConical, Info, LifeBuoy, Link2, type LucideIcon } from 'lucide-react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SOFTWARE_VERSION, useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, typography, type StatusTone } from '@dems/shared/tokens';
import { SectionCard, StatusChip } from '@/components/kit';
import { Emblem } from '@/components/media/emblem';
import { rowReveal, useMotionSettings } from '@/motion';
import { useCoreLink } from '@/runtime';
import {
  LINK_HREFS,
  coreLinkTone,
  coreLinkWordKey,
  linkDestinations,
  pairingTone,
  selectCoreName,
  selectPairingState,
  selectSessionStateFlat,
  type LinkDestination,
} from './more-model';
import { useMoreNavigate } from './use-more-navigate';

const ICONS: Record<LinkDestination, LucideIcon> = {
  pairing: Link2,
  recovery: LifeBuoy,
  about: Info,
  'dev-gallery': FlaskConical,
};

export interface MoreLinksProps {
  /** Debug build (`__DEV__`): adds the developer gallery row. */
  debug: boolean;
}

export function MoreLinks({ debug }: MoreLinksProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const sessionState = useSim(selectSessionStateFlat);
  const rows = linkDestinations({ sessionState, debug });

  return (
    <SectionCard testID="more-links" title={t('features.more.links.title')}>
      <ListGroup variant="transparent">
        {rows.map((name, index) => (
          <Fragment key={name}>
            {index > 0 ? <Separator /> : null}
            <Animated.View entering={rowReveal(index, settings)}>
              <LinkRow name={name} />
            </Animated.View>
          </Fragment>
        ))}
      </ListGroup>
    </SectionCard>
  );
}

interface RowView {
  title: string;
  description: string;
  chip: { label: string; tone: StatusTone } | null;
}

function LinkRow({ name }: { name: LinkDestination }) {
  const { t } = useTranslation();
  const navigate = useMoreNavigate();
  const view = useRowView(name);
  const Icon = ICONS[name];
  const label = [view.title, view.description, view.chip?.label].filter(Boolean).join(', ');

  return (
    <ListGroup.Item
      testID={`more-link-${name}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('features.more.console.openHint', { name: view.title })}
      onPress={() => navigate(LINK_HREFS[name])}
    >
      <ListGroup.ItemPrefix>
        <View style={styles.badge}>
          <Icon size={18} color={palette.gold} />
        </View>
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{view.title}</ListGroup.ItemTitle>
        <ListGroup.ItemDescription testID={`more-link-${name}-detail`} numberOfLines={1}>
          {view.description}
        </ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <View style={styles.suffix}>
          {view.chip ? (
            <StatusChip testID={`more-link-${name}-chip`} tone={view.chip.tone} label={view.chip.label} icon={null} size="sm" />
          ) : null}
          <ChevronRight size={18} color={palette.gray} />
        </View>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

function useRowView(name: LinkDestination): RowView {
  const { t } = useTranslation();
  const pairingState = useSim(selectPairingState);
  const coreName = useSim(selectCoreName);
  const sessionState = useSim(selectSessionStateFlat);

  switch (name) {
    case 'pairing':
      return {
        title: t('features.more.links.pairing.title'),
        description: t('features.more.links.pairing.detail', { core: coreName }),
        chip: { label: t(`mobile.pairing.state.${pairingState}`), tone: pairingTone(pairingState) },
      };
    case 'recovery': {
      const state = sessionState === 'FAULT' ? 'FAULT' : 'RECOVERY';
      return {
        title: t('features.more.links.recovery.title'),
        description: t('features.more.links.recovery.detail'),
        chip: { label: t(`features.more.links.recovery.${state}`), tone: state === 'FAULT' ? 'danger' : 'warning' },
      };
    }
    case 'about':
      return {
        title: t('features.more.links.about.title'),
        description: t('features.more.links.about.detail', { version: SOFTWARE_VERSION }),
        chip: null,
      };
    case 'dev-gallery':
      return {
        title: t('features.more.links.devGallery.title'),
        description: t('features.more.links.devGallery.detail'),
        chip: { label: t('features.more.links.devGallery.chip'), tone: 'info' },
      };
  }
}

/** Footer: emblem, "DEMS EDGE CLIENT · v2.4.1", the DEMO label and the Core link chip (§4.17). */
export function MoreFooter() {
  const { t } = useTranslation();
  const link = useCoreLink();
  const word = t(`common.status.${coreLinkWordKey(link)}`);
  const online = link.state === 'ONLINE';

  return (
    <View testID="more-footer" style={styles.footer}>
      <Emblem size={28} accessibilityLabel={t('common.brand.name')} />
      <Text testID="more-version" maxFontSizeMultiplier={1.2} style={styles.version}>
        {t('mobile.app.versionFooter', { version: SOFTWARE_VERSION })}
      </Text>
      <View style={styles.chips}>
        <StatusChip testID="more-demo" tone="accent" label={t('features.more.footer.demo')} icon={null} size="sm" />
        <StatusChip
          testID="more-core-link"
          tone={coreLinkTone(link)}
          label={t('features.more.footer.coreLink', { state: word })}
          accessibilityLabel={t('features.more.footer.coreLinkLabel', {
            state: word,
            source: t(`mobile.coreLink.source.${link.source}`),
          })}
          icon={online ? 'Wifi' : 'TriangleAlert'}
          size="sm"
        />
      </View>
      <Text maxFontSizeMultiplier={1.2} style={styles.note}>
        {t('features.more.footer.demoNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: derived.surfaceTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: derived.border,
  },
  suffix: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4 },
  version: {
    fontFamily: fontFamily.native.display,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: palette.gold,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
});
