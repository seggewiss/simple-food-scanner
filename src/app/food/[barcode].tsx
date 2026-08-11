import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logFood } from '@/db/repository';
import type { Meal } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { macrosForQuantity, roundTotals, type LogUnit } from '@/nutrition/portion';
import { useFoodLookup } from '@/off/use-food-lookup';
import { useDiaryStore } from '@/stores/diary-store';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function FoodDetailScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const theme = useTheme();
  const { data, isPending, error } = useFoodLookup(barcode);

  const date = useDiaryStore((state) => state.date);
  const meal = useDiaryStore((state) => state.meal);
  const setMeal = useDiaryStore((state) => state.setMeal);

  const [amountText, setAmountText] = useState('100');
  const [unit, setUnit] = useState<LogUnit>('g');
  const [saving, setSaving] = useState(false);

  const food = data?.status === 'found' ? data.food : undefined;
  const quantity = Number.parseFloat(amountText.replace(',', '.'));

  const preview = useMemo(() => {
    if (!food || !Number.isFinite(quantity)) return null;
    const { grams, totals } = macrosForQuantity(food, quantity, unit, food.servingSizeG);
    return { grams, totals: roundTotals(totals) };
  }, [food, quantity, unit]);

  async function handleLog() {
    if (!food || !preview || preview.grams <= 0) return;
    setSaving(true);
    try {
      await logFood({
        food,
        date,
        meal,
        quantity,
        unit,
        portionGrams: food.servingSizeG,
      });
      router.dismissTo('/');
    } finally {
      setSaving(false);
    }
  }

  if (isPending) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText themeColor="textSecondary">Looking up {barcode}…</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Something went wrong</ThemedText>
        <ThemedText themeColor="danger" style={styles.center}>
          {error.message}
        </ThemedText>
      </ThemedView>
    );
  }

  // Every non-`found` outcome ends at the same place: create the food by hand. A miss
  // should cost twenty seconds of typing, not a dead end.
  if (!food) {
    const message =
      data?.status === 'incomplete'
        ? 'Open Food Facts has this product but not its nutrition values.'
        : data?.status === 'offline'
          ? "You're offline and this barcode isn't in your local cache yet."
          : "This barcode isn't in Open Food Facts yet.";

    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Not in the database</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
        <Pressable
          onPress={() => router.replace({ pathname: '/food/new', params: { barcode } })}
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.primaryLabel}>Add it yourself</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: food.name }} />

      <View style={styles.header}>
        {food.imageUrl ? (
          <Image source={{ uri: food.imageUrl }} style={styles.image} contentFit="contain" />
        ) : null}
        <View style={styles.headerText}>
          <ThemedText style={styles.foodName}>{food.name}</ThemedText>
          {food.brand ? (
            <ThemedText type="small" themeColor="textSecondary">
              {food.brand}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(food.kcalPer100g)} kcal per 100 {food.baseUnit}
          </ThemedText>
          {data?.status === 'found' && data.fromCache ? (
            <ThemedText type="small" themeColor="textSecondary">
              Served from your offline cache
            </ThemedText>
          ) : null}
        </View>
      </View>

      <ThemedText type="smallBold">Amount</ThemedText>
      <View style={styles.row}>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          style={[
            styles.input,
            { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
        />
        <UnitToggle unit={unit} setUnit={setUnit} servingSizeG={food.servingSizeG} baseUnit={food.baseUnit} />
      </View>

      {unit === 'portion' && food.servingSizeG == null ? (
        <ThemedText type="small" themeColor="danger">
          This product has no serving size on record. Log it by weight, or define a portion.
        </ThemedText>
      ) : null}

      <ThemedText type="smallBold">Meal</ThemedText>
      <View style={styles.row}>
        {MEALS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setMeal(option)}
            style={[
              styles.chip,
              {
                backgroundColor: option === meal ? theme.accent : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" style={option === meal ? styles.chipLabelActive : undefined}>
              {option}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {preview ? (
        <View style={[styles.totals, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">{preview.totals.kcal} kcal</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(preview.grams)} {food.baseUnit} · P {preview.totals.protein} g · C{' '}
            {preview.totals.carbs} g · F {preview.totals.fat} g
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        onPress={handleLog}
        disabled={saving || !preview || preview.grams <= 0}
        style={[
          styles.primaryButton,
          { backgroundColor: preview && preview.grams > 0 ? theme.accent : theme.backgroundSelected },
        ]}>
        <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : `Add to ${meal}`}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function UnitToggle({
  unit,
  setUnit,
  servingSizeG,
  baseUnit,
}: {
  unit: LogUnit;
  setUnit: (unit: LogUnit) => void;
  servingSizeG: number | null;
  baseUnit: 'g' | 'ml';
}) {
  const theme = useTheme();
  const options: LogUnit[] = [baseUnit, 'portion'];

  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => setUnit(option)}
          style={[
            styles.chip,
            { backgroundColor: option === unit ? theme.accent : theme.backgroundElement },
          ]}>
          <ThemedText type="small" style={option === unit ? styles.chipLabelActive : undefined}>
            {option === 'portion' && servingSizeG ? `portion (${servingSizeG} ${baseUnit})` : option}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipLabelActive: {
    color: '#ffffff',
  },
  container: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  foodName: {
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  image: {
    borderRadius: 12,
    height: 96,
    width: 96,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    minWidth: 96,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: Spacing.three,
  },
  primaryLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  totals: {
    borderRadius: 16,
    gap: Spacing.one,
    padding: Spacing.three,
  },
});
