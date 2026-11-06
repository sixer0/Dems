import { SessionFlowStack } from '@/navigation';

/**
 * `(app)/session`: the focused, full-screen session flow without tabs or rail (04_mobile_specs
 * §2.3 "Flow screens", §3.1). The back gesture is off while a session is active (§3.6).
 */
export default function SessionLayout() {
  return <SessionFlowStack />;
}
