import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MacroSummary } from '@/components/macro-summary';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { diaryForDateQuery, profileQuery, type DiaryQueryRow } from '@/db/queries';
import { copyDay, deleteDiaryEntry, restoreDiaryEntry } from '@/db/repository';
import type { Meal } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { parseIsoDate, shiftIsoDate, todayIso } from '@/lib/date';
import { sumTotals, type MacroTotals } from '@/nutrition/portion';
import { useDiaryStore } from '@/stores/diary-store';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** How long the undo affordance stays on screen after a removal. */
const UNDO_TIMEOUT_MS = 5000;

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

  // Removal is immediate and undoable rather than confirmed up front: the swipe is
  // already a deliberate gesture, and `deleteDiaryEntry` only tombstones the row, so
  // putting it back is free.
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
  }, []);

  useEffect(() => clearUndoTimer, [clearUndoTimer]);

  const handleDelete = useCallback(
    (entry: DiaryQueryRow) => {
      void deleteDiaryEntry(entry.id);
      clearUndoTimer();
      setUndo({ id: entry.id, name: entry.foodName });
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS);
    },
    [clearUndoTimer],
  );

  const handleUndo = useCallback(() => {
    if (!undo) return;
    void restoreDiaryEntry(undo.id);
    clearUndoTimer();
    setUndo(null);
  }, [undo, clearUndoTimer]);

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
            onDelete={handleDelete}
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

      {undo ? (
        <View style={[styles.undoBar, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small" numberOfLines={1} style={styles.undoText}>
            Removed {undo.name}
          </ThemedText>
          <Pressable onPress={handleUndo} hitSlop={10}>
            <ThemedText type="smallBold" themeColor="accent">
              Undo
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

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
  onDelete,
}: {
  meal: Meal;
  entries: DiaryQueryRow[];
  onAdd: () => void;
  onDelete: (entry: DiaryQueryRow) => void;
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
        entries.map((entry) => (
          <DiaryRow key={entry.id} entry={entry} onDelete={() => onDelete(entry)} />
        ))
      )}
    </View>
  );
}

function DiaryRow({ entry, onDelete }: { entry: DiaryQueryRow; onDelete: () => void }) {
  const theme = useTheme();

  return (
    // Long press stays wired to the same immediate delete as the swipe action, so both
    // routes behave identically for anyone who learned the old gesture.
    <SwipeableRow onDelete={onDelete} onLongPress={onDelete}>
      <View
        style={[styles.row, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <View style={styles.rowText}>
          <ThemedText numberOfLines={1}>{entry.foodName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatAmount(entry)} · P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F{' '}
            {Math.round(entry.fat)}
          </ThemedText>
        </View>
        <ThemedText>{Math.round(entry.kcal)}</ThemedText>
      </View>
    </SwipeableRow>
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
  undoBar: {
    alignItems: 'center',
    borderRadius: 12,
    // Sits clear of the FAB row, which occupies the bottom-right corner.
    bottom: Spacing.six + Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
    left: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    position: 'absolute',
    right: Spacing.four,
  },
  undoText: {
    flexShrink: 1,
  },
});
