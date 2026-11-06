import { AuthStack } from '@/navigation';

/** `(auth)`: present only while signed out (`Stack.Protected`, 04_mobile_specs §3.3). */
export default function AuthLayout() {
  return <AuthStack />;
}
