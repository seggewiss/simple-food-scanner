import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DatabaseProvider } from '@/db/provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Open Food Facts data is effectively static per barcode, and every product we
      // look at is persisted locally anyway, so refetching on focus is pure waste.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 60,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <DatabaseProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="scan"
                options={{ presentation: 'modal', title: 'Scan barcode' }}
              />
              <Stack.Screen name="food/[barcode]" options={{ title: 'Food' }} />
              <Stack.Screen name="food/new" options={{ title: 'New food' }} />
              <Stack.Screen name="goal" options={{ title: 'Your goal' }} />
              <Stack.Screen
                name="search"
                options={{ presentation: 'modal', title: 'Search foods' }}
              />
              <Stack.Screen
                name="quick-add"
                options={{ presentation: 'modal', title: 'Quick add' }}
              />
              <Stack.Screen name="recipe" options={{ title: 'New recipe' }} />
            </Stack>
          </DatabaseProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
