import { useLocalSearchParams } from 'expo-router';
import { StackCheckRoute, firstParam } from '@/navigation';

/** Route `/stack-check` (public): the row-18 proof screen (04_mobile_specs §3.5, §4.18). */
export default function StackCheck() {
  const { motion } = useLocalSearchParams<{ motion?: string }>();
  return <StackCheckRoute motion={firstParam(motion)} />;
}
