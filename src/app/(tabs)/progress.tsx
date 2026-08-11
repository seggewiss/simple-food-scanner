import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WeightChart } from '@/components/weight-chart';
import { Spacing } from '@/constants/theme';
import { recentWeightsQuery } from '@/db/queries';
import { recordWeight } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';
import { parseIsoDate, todayIso } from '@/lib/date';

export default function ProgressScreen() {
  const theme = useTheme();
  const { data: weights } = useLiveQuery(recentWeightsQuery());
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = weights ?? [];
  const latest = rows[0];
  const oldest = rows[rows.length - 1];
  const change = latest && oldest && rows.length > 1 ? latest.weightKg - oldest.weightKg : null;

  async function handleSave() {
    const parsed = Number.parseFloat(input.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSaving(true);
    try {
      // Keyed on the date, so logging twice in one day corrects the entry rather than
      // adding a second point for the same day.
      await recordWeight(todayIso(), parsed);
      setInput('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Log today&apos;s weight</ThemedText>
        <View style={styles.row}>
          <TextInput
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
            ]}
          />
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.button, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.buttonLabel}>{saving ? 'Saving…' : 'Save'}</ThemedText>
          </Pressable>
        </View>
      </View>

      {latest ? (
        <View style={styles.summary}>
          <ThemedText type="subtitle">{latest.weightKg.toFixed(1)} kg</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {change === null
              ? 'First entry recorded.'
              : `${change >= 0 ? '+' : ''}${change.toFixed(1)} kg since ${formatShort(oldest.date)}`}
          </ThemedText>
        </View>
      ) : (
        <ThemedText themeColor="textSecondary">
          No weigh-ins yet. Log one above to start a trend.
        </ThemedText>
      )}

      {rows.length > 1 ? (
        // The query returns newest-first for the summary; the chart wants chronological.
        <WeightChart points={[...rows].reverse().map((row) => ({ date: row.date, value: row.weightKg }))} />
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.list}>
          <ThemedText type="smallBold">History</ThemedText>
          {rows.map((row) => (
            <View key={row.id} style={[styles.listRow, { borderColor: theme.border }]}>
              <ThemedText type="small">{formatShort(row.date)}</ThemedText>
              <ThemedText type="small">{row.weightKg.toFixed(1)} kg</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function formatShort(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  container: {
    gap: Spacing.four,
    padding: Spacing.three,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: {
    gap: Spacing.one,
  },
  listRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summary: {
    gap: Spacing.one,
  },
});
