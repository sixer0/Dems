import { StyleSheet, View } from 'react-native';
import { HomeScreen, type MotionMode } from '@/features/home/home-screen';

export interface StackCheckRouteProps {
  /** The raw `?motion=` value; only `slow` changes the proof screen (AC-31, M-PX-02). */
  motion: string | undefined;
}

/**
 * The row-18 proof screen as a route (04_mobile_specs §4.18): `/stack-check`, and `/` whenever the
 * URL carries `?motion=` (the boot router, AC-31). The proof component itself stays unchanged in
 * `src/features/home/home-screen.tsx` (test N-1 and the AC-31 greps). This wrapper only adds the
 * `screen-stack-check` root testID (04 §4.0), because that file is not the shell's to edit.
 */
export function StackCheckRoute({ motion }: StackCheckRouteProps) {
  const motionMode: MotionMode = motion === 'slow' ? 'slow' : 'normal';
  return (
    <View testID="screen-stack-check" collapsable={false} style={styles.root}>
      <HomeScreen motionMode={motionMode} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
