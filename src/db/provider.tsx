import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SQLiteProvider } from 'expo-sqlite';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { DATABASE_NAME, db, expoDb } from './client';
import migrations from './migrations/migrations';

/**
 * Runs pending migrations before any screen can query. Migrations are bundled into the
 * JS via babel-plugin-inline-import, so this works offline and on first launch.
 *
 * `SQLiteProvider` wraps the already-open database so `useSQLiteContext` and, more
 * importantly, drizzle's `useLiveQuery` change subscriptions work across the tree.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Database error</ThemedText>
        <ThemedText themeColor="danger" style={styles.message}>
          {error.message}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!success) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText themeColor="textSecondary">Preparing your food database…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} useSuspense={false} options={{ enableChangeListener: true }}>
      {children}
    </SQLiteProvider>
  );
}

export { expoDb };

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  message: {
    textAlign: 'center',
  },
});
