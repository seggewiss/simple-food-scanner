import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MacroSummary } from '@/components/macro-summary';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { diaryForDateQuery, profileQuery, type DiaryQueryRow } from '@/db/queries';
import { copyDay, deleteDiaryEntry } from '@/db/repository';
import type { Meal } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { parseIsoDate, shiftIsoDate, todayIso } from '@/lib/date';
import { sumTotals, type MacroTotals } from '@/nutrition/portion';
import { useDiaryStore } from '@/stores/diary-store';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export default function DiaryScreen() {
  const theme = useTheme();
  const date = useDiaryStore((state) => state.date);
  const shiftDate = useDiaryStore((state) => state.shiftDate);
  const setDate = useDiaryStore((state) => state.setDate);
  const setMeal = useDiaryStore((state) => state.setMeal);

  // useLiveQuery re-runs whenever diary_entries or foods change, so logging a food
  // updates this screen without any manual cache invalidation.
  const { data: entries } = useLiveQuery(diaryForDateQuery(date), [date]);
  const { data: profileRows } = useLiveQuery(profileQuery());

  const profile = profileRows?.[0];
  const targets = profile
    ? {
        kcal: profile.kcalTarget,
        proteinG: profile.proteinTargetG,
        carbsG: profile.carbsTargetG,
        fatG: profile.fatTargetG,
      }
    : null;

  const byMeal = useMemo(() => groupByMeal(entries ?? []), [entries]);
  const dayTotals: MacroTotals = useMemo(() => sumTotals(entries ?? []), [entries]);

  const isToday = date === todayIso();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.dateBar}>
          <Pressable onPress={() => shiftDate(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Pressable onPress={() => setDate(todayIso())} hitSlop={12}>
            <ThemedText style={styles.dateLabel}>{formatDate(date)}</ThemedText>
          </Pressable>
          <Pressable onPress={() => shiftDate(1)} hitSlop={12} disabled={isToday}>
            <Ionicons
              name="chevron-forward"
              size={22}
              // Logging into the future is almost always a mis-tap.
              color={isToday ? theme.backgroundSelected : theme.text}
            />
          </Pressable>
        </View>

        <MacroSummary totals={dayTotals} targets={targets} />

        {MEALS.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={byMeal[meal]}
            onAdd={() => {
              setMeal(meal);
              router.push('/scan');
            }}
          />
        ))}

        <View style={styles.quickRow}>
          <Pressable
            onPress={() => router.push('/quick-add')}
            style={[styles.quickButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">Quick add kcal</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => promptCopyDay(date)}
            style={[styles.quickButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">Copy yesterday</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/recipe')}
            style={[styles.quickButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">New recipe</ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.fabRow}>
        <Link href="/search" asChild>
          <Pressable
            style={StyleSheet.flatten([
              styles.fabSecondary,
              { backgroundColor: theme.backgroundElement },
            ])}>
            <Ionicons name="search" size={22} color={theme.text} />
          </Pressable>
        </Link>
        <Link href="/scan" asChild>
          <Pressable style={StyleSheet.flatten([styles.fab, { backgroundColor: theme.accent }])}>
            <Ionicons name="barcode-outline" size={24} color="#ffffff" />
            <ThemedText style={styles.fabLabel}>Scan</ThemedText>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

function promptCopyDay(date: string) {
  const from = shiftIsoDate(date, -1);
  Alert.alert('Copy yesterday', `Copy every entry from ${from} onto ${date}?`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Copy',
      onPress: () => {
        void copyDay(from, date).then((count) => {
          if (count === 0) Alert.alert('Nothing to copy', `${from} has no entries.`);
        });
      },
    },
  ]);
}

function MealSection({
  meal,
  entries,
  onAdd,
}: {
  meal: Meal;
  entries: DiaryQueryRow[];
  onAdd: () => void;
}) {
  const theme = useTheme();
  const total = Math.round(sumTotals(entries).kcal);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">{MEAL_LABELS[meal]}</ThemedText>
        <View style={styles.sectionHeaderRight}>
          <ThemedText type="small" themeColor="textSecondary">
            {total} kcal
          </ThemedText>
          <Pressable onPress={onAdd} hitSlop={10}>
            <Ionicons name="add-circle-outline" size={22} color={theme.accent} />
          </Pressable>
        </View>
      </View>

      {entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged.
        </ThemedText>
      ) : (
        entries.map((entry) => <DiaryRow key={entry.id} entry={entry} />)
      )}
    </View>
  );
}

function DiaryRow({ entry }: { entry: DiaryQueryRow }) {
  const theme = useTheme();

  function confirmDelete() {
    Alert.alert('Remove entry', `Remove ${entry.foodName} from your diary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void deleteDiaryEntry(entry.id);
        },
      },
    ]);
  }

  return (
    <Pressable
      onLongPress={confirmDelete}
      style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{entry.foodName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatAmount(entry)} · P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F{' '}
          {Math.round(entry.fat)}
        </ThemedText>
      </View>
      <ThemedText>{Math.round(entry.kcal)}</ThemedText>
    </Pressable>
  );
}

function formatAmount(entry: DiaryQueryRow): string {
  if (entry.unit === 'portion') {
    const count = entry.quantity === 1 ? '1 portion' : `${entry.quantity} portions`;
    return `${count} (${Math.round(entry.grams)} ${entry.baseUnit})`;
  }
  return `${Math.round(entry.grams)} ${entry.baseUnit}`;
}

function groupByMeal(entries: DiaryQueryRow[]): Record<Meal, DiaryQueryRow[]> {
  const grouped: Record<Meal, DiaryQueryRow[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const entry of entries) grouped[entry.meal].push(entry);
  return grouped;
}

function formatDate(iso: string): string {
  const today = todayIso();
  if (iso === today) return 'Today';

  const date = parseIsoDate(iso);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.six * 2,
  },
  dateBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  dateLabel: {
    fontWeight: '700',
  },
  fab: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  fabLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  fabRow: {
    alignItems: 'center',
    bottom: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.two,
    position: 'absolute',
    right: Spacing.four,
  },
  fabSecondary: {
    alignItems: 'center',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quickButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  row: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  section: {
    gap: Spacing.one,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
