import { AppTabs } from '@/navigation';

export const unstable_settings = { initialRouteName: 'home' };

/** `(app)/(tabs)`: headless tabs with the responsive chrome (04_mobile_specs §3.4, §2.3). */
export default function TabsLayout() {
  return <AppTabs />;
}
