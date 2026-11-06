import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SafeScreen } from '@/layout';

export type StubParamValue = string | number | null;

export interface ScreenStubProps {
  /** Screen id; the root carries `testID="screen-<id>"` (04 §4.0). */
  id: string;
  /** The typed values the route parsed for this screen, shown so stubs prove the parsing. */
  params?: Readonly<Record<string, StubParamValue>>;
  children?: ReactNode;
}

/**
 * Placeholder body for a route whose screen step has not run yet (05_mobile_plan M-03 "stub
 * screens for every route"). It renders the real screen root (`SafeScreen`, so the `screen-<id>`
 * testID and the safe-area behaviour are the final ones), a one-line label and the parsed params
 * (`stub-param-<name>` testIDs). Screen steps replace the stub body and stop importing this.
 */
export function ScreenStub({ id, params, children }: ScreenStubProps) {
  const { t } = useTranslation();
  return (
    <SafeScreen id={id} contentContainerStyle={styles.body}>
      <Text testID={`stub-${id}`} style={styles.label}>
        {t('features.navigation.stub.label', { id })}
      </Text>
      {params ? (
        <View style={styles.params}>
          {Object.entries(params).map(([name, value]) => (
            <Text key={name} testID={`stub-param-${name}`} style={styles.param}>
              {`${name}=${value ?? '∅'}`}
            </Text>
          ))}
        </View>
      ) : null}
      {children}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing[4], gap: spacing[2], justifyContent: 'center', alignItems: 'center' },
  label: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
    textAlign: 'center',
  },
  params: { gap: spacing[0] },
  param: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.foreground,
    textAlign: 'center',
  },
});
