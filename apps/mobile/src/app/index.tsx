import { useLocalSearchParams } from 'expo-router';
import { HomeScreen, type MotionMode } from '@/features/home/home-screen';

/** Route `/`. `demsdemo://?motion=slow` opens the Motion proof mode (masterplan/01_specs.md §5.6). */
export default function Index() {
  const { motion } = useLocalSearchParams<{ motion?: string }>();
  const motionMode: MotionMode = motion === 'slow' ? 'slow' : 'normal';
  return <HomeScreen motionMode={motionMode} />;
}
