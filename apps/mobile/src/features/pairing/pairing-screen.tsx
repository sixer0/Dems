/**
 * Pairing (04_mobile_specs §4.2, §6.5; book §5.1 "Authentication & device pairing", §20.1
 * "certificate-bound pairing … preferred") at `/pair`, public (reachable from the Login trust line
 * and from Settings → Security).
 *
 * Step 76 owns this folder (P6). The route file `src/app/pair.tsx` renders `<PairingScreen />` and
 * is not edited; the root stays `SafeScreen id="pair"` (testID `screen-pair`, T-M02, MA-04).
 *
 * Pair the tablet with the Core (DEMS-IR-01) by a 6-digit code: the connection steps animate
 * Discover → Verify (code + certificate, DEMO) → Paired on the simulator clock; the simulator
 * decides (demo code, 3 failures → 60 s lockout, one audit row per attempt). A success hands off
 * per the §3.3 guard (back to Login or Settings, else the boot router). Unpair sits behind a Dialog.
 *
 * Layouts (D17): phones stack the connection card above the code card; from compact-landscape up
 * the two cards are side-by-side panes (`pane-connection` | `pane-code`); tablets (medium, expanded)
 * give the connection pane a hero ring and a vertical stepper with step descriptions.
 */
import { Button, useToast } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useSim } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { TOPO_XML } from '@/components/media';
import { Pane, PaneLayout, SafeScreen, useLayoutClass, type LayoutClass } from '@/layout';
import { enterRise, useMotionSettings } from '@/motion';
import { useAuth } from '@/runtime';
import { PairingCodePanel } from './pairing-code-panel';
import { PairingConnection } from './pairing-connection';
import { selectCoreDeviceId } from './pairing-model';
import { UnpairDialog } from './unpair-dialog';
import { useDialogPresence } from './use-dialog-presence';
import { usePairingFlow } from './use-pairing-flow';

/** Content width caps per arrangement (dp). */
const MAX_WIDTH = { stacked: 560, split: 1080 } as const;
/** Room under the focused code slots for the Pair button while the keyboard is up (dp). */
const KEYBOARD_CLEARANCE = 112;
/** The code pane keeps the auth-card width on wide tablets (web parity, 01S §14.8). */
const CODE_PANE_WIDTH = 440;

/** C-1 ring size: `mini` on phones, `hero` on tablets (GlowRing clamps hero to 240–340). */
function ringSizeFor(layoutClass: LayoutClass): number {
  return layoutClass === 'medium' || layoutClass === 'expanded' ? 240 : 88;
}

export function PairingScreen() {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const { layoutClass } = useLayoutClass();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const flow = usePairingFlow();
  const device = useSim(selectCoreDeviceId);
  const [unpairAsked, setUnpairAsked] = useState(false);
  const dialog = useDialogPresence(unpairAsked);

  const stacked = layoutClass === 'compact';
  const tablet = layoutClass === 'medium' || layoutClass === 'expanded';

  const confirmUnpair = () => {
    const ok = flow.unpair();
    setUnpairAsked(false);
    toast.show({ variant: ok ? 'success' : 'danger', label: ok ? t('features.pairing.unpair.done') : t('features.pairing.unpair.failed') });
  };

  return (
    <SafeScreen id="pair">
      {/* Design-system canvas: the shared topographic texture, faint (01S §2.9, 15–30 %). */}
      <View pointerEvents="none" style={styles.topo} importantForAccessibility="no-hide-descendants">
        <SvgXml xml={TOPO_XML} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
      </View>

      <View style={[styles.header, tablet ? styles.headerLarge : null]} testID="pairing-header">
        <Button testID="pairing-back" isIconOnly variant="ghost" size="lg" accessibilityLabel={t('features.pairing.header.back')} onPress={flow.cancel}>
          <ArrowLeft size={24} color={palette.gold} />
        </Button>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2} style={tablet ? styles.titleLarge : styles.title}>
            {t('mobile.pairing.title')}
          </Text>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={styles.subtitle}>
            {t('features.pairing.header.subtitle')}
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        // Phones: keep the Pair button above the keyboard, not just the focused code slots.
        bottomOffset={stacked ? KEYBOARD_CLEARANCE : spacing[4]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, tablet ? styles.scrollTablet : null]}
      >
        <View style={[styles.column, { maxWidth: stacked ? MAX_WIDTH.stacked : MAX_WIDTH.split }]}>
          <PaneLayout stackOn={['compact']} style={styles.panes} testID="pairing-panes">
            <Pane name="connection" flex={1}>
              <Animated.View entering={enterRise(0, settings)}>
                <PairingConnection
                  view={flow.view}
                  phase={flow.phase}
                  simState={flow.simState}
                  split={tablet}
                  ringSize={ringSizeFor(layoutClass)}
                  settings={settings}
                />
              </Animated.View>
            </Pane>
            <Pane name="code" {...(layoutClass === 'expanded' ? { width: CODE_PANE_WIDTH } : { flex: 1 })}>
              <Animated.View entering={enterRise(1, settings)}>
                <PairingCodePanel
                  flow={flow}
                  device={device}
                  signedIn={isAuthenticated}
                  settings={settings}
                  onRequestUnpair={() => setUnpairAsked(true)}
                />
              </Animated.View>
            </Pane>
          </PaneLayout>
        </View>
      </KeyboardAwareScrollView>

      {dialog.mounted ? (
        <UnpairDialog isOpen={dialog.open} device={device} onOpenChange={setUnpairAsked} onConfirm={confirmUnpair} />
      ) : null}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  topo: { ...StyleSheet.absoluteFill, opacity: 0.22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1] },
  headerLarge: { minHeight: 64, paddingHorizontal: spacing[3] },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  titleLarge: {
    fontFamily: fontFamily.native.bold,
    fontSize: typography.h1.size,
    lineHeight: typography.h1.lineHeight,
    color: palette.foreground,
  },
  subtitle: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: derived.foreground2,
  },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing[3], paddingTop: spacing[1], paddingBottom: spacing[4] },
  scrollTablet: { justifyContent: 'center', paddingHorizontal: spacing[4] },
  column: { width: '100%' },
  panes: { flex: 0 },
});
