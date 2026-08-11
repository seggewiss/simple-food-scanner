import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Static web rendering has no colour scheme, so the server snapshot must be a fixed
 * value and the real scheme can only be used once the client has hydrated.
 *
 * `useSyncExternalStore` is the hydration-safe way to express that: it returns the
 * server snapshot during SSR and the client snapshot afterwards, without a setState
 * inside an effect and the extra render pass that causes.
 */
const emptySubscribe = () => () => {};

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function useColorScheme() {
  const hasHydrated = useHasHydrated();
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
