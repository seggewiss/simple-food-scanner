import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { formatDate } from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BackupFormatError, exportBackup, importBackup, parseBackup } from '@/db/backup';
import { profileQuery } from '@/db/queries';
import type { Profile } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { parseIsoDate, todayIso } from '@/lib/date';
import { estimatedGoalDate } from '@/nutrition/targets';

export default function SettingsScreen() {
  const theme = useTheme();
  const { data: profileRows } = useLiveQuery(profileQuery());
  const profile = profileRows?.[0];
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const projection = profile ? describeProjection(profile) : null;

  async function handleExport() {
    setBusy('export');
    try {
      const backup = await exportBackup();
      const file = new File(Paths.cache, `food-scanner-backup-${todayIso()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(backup, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      } else {
        Alert.alert('Backup saved', file.uri);
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (picked.canceled || !picked.assets?.[0]) return;

    setBusy('import');
    try {
      const backup = parseBackup(await new File(picked.assets[0].uri).text());
      await importBackup(backup);
      Alert.alert(
        'Import complete',
        `Merged ${backup.foods.length} foods and ${backup.diaryEntries.length} diary entries.`,
      );
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof BackupFormatError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="smallBold">Your goal</ThemedText>
      {profile ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {describeGoal(profile)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(profile.kcalTarget)} kcal · P {Math.round(profile.proteinTargetG)} g · C{' '}
            {Math.round(profile.carbsTargetG)} g · F {Math.round(profile.fatTargetG)} g
          </ThemedText>
          {projection ? (
            <ThemedText type="small" themeColor="textSecondary">
              {projection}
            </ThemedText>
          ) : null}
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No goal set yet — the diary will only show what you have eaten, not what is left.
        </ThemedText>
      )}
      <Link href="/goal" asChild>
        <Pressable style={StyleSheet.flatten([styles.button, { backgroundColor: theme.accent }])}>
          <ThemedText style={styles.buttonLabel}>{profile ? 'Edit goal' : 'Set a goal'}</ThemedText>
        </Pressable>
      </Link>

      <View style={styles.divider} />

      <ThemedText type="smallBold">Backup &amp; restore</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Everything is stored on this device. Export a JSON copy to back it up or move to a new
        phone. Importing merges — it never deletes what is already here.
      </ThemedText>
      <View style={styles.row}>
        <Pressable
          onPress={handleExport}
          disabled={busy !== null}
          style={[styles.button, styles.flex, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.buttonLabelSecondary}>
            {busy === 'export' ? 'Exporting…' : 'Export'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={handleImport}
          disabled={busy !== null}
          style={[styles.button, styles.flex, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.buttonLabelSecondary}>
            {busy === 'import' ? 'Importing…' : 'Import'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <ThemedText type="smallBold">Data attribution</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Product and nutrition data comes from Open Food Facts, a collaborative database made
        available under the Open Database License (ODbL). Barcode scanning in this app is free and
        always will be, because the data underneath it is free.
      </ThemedText>
      <ExternalLink href="https://openfoodfacts.org">
        <ThemedText type="linkPrimary">openfoodfacts.org</ThemedText>
      </ExternalLink>
      <ExternalLink href="https://opendatacommons.org/licenses/odbl/1-0/">
        <ThemedText type="linkPrimary">Open Database License</ThemedText>
      </ExternalLink>
    </ScrollView>
  );
}

const GOAL_LABELS: Record<Profile['goal'], string> = {
  lose: 'Lose weight',
  maintain: 'Maintain weight',
  gain: 'Gain weight',
};

/**
 * The stored goal in one line, so "Edit goal" is not the only way to find out what was
 * saved. The target segment is omitted rather than shown as a placeholder when there is
 * no target — a maintain goal has none, and neither does a profile saved before target
 * weights existed.
 */
function describeGoal(profile: Profile): string {
  const parts = [GOAL_LABELS[profile.goal]];

  if (profile.targetWeightKg != null) {
    parts.push(`${profile.weightKg.toFixed(1)} → ${profile.targetWeightKg.toFixed(1)} kg`);
  } else {
    parts.push(`${profile.weightKg.toFixed(1)} kg`);
  }

  if (profile.goal !== 'maintain') {
    parts.push(`${profile.rateKgPerWeek} kg per week`);
  }

  return parts.join(' · ');
}

function describeProjection(profile: Profile): string | null {
  if (profile.targetWeightKg == null) return null;

  const date = estimatedGoalDate(
    profile.goal,
    profile.weightKg,
    profile.targetWeightKg,
    profile.rateKgPerWeek,
  );
  if (!date) return null;

  return `On track to reach ${profile.targetWeightKg.toFixed(1)} kg around ${formatDate(parseIsoDate(date))}.`;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: Spacing.three,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonLabelSecondary: {
    fontWeight: '600',
  },
  container: {
    gap: Spacing.two,
    padding: Spacing.four,
  },
  divider: {
    height: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
