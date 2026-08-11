import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { recentFoodsQuery } from '@/db/queries';
import { saveRecipe } from '@/db/repository';
import type { Food } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { parseNonNegativeNumber, parsePositiveNumber } from '@/lib/number';
import { roundTotals } from '@/nutrition/portion';
import { calculateRecipe } from '@/nutrition/recipe';

type Draft = { food: Food; grams: string };

/**
 * Recipe builder. Ingredients are picked from foods already in the local database —
 * anything scanned once is available here, which is why the offline cache doubles as
 * the ingredient library.
 */
export default function RecipeScreen() {
  const theme = useTheme();
  const { data: available } = useLiveQuery(recentFoodsQuery(50));

  const [name, setName] = useState('');
  const [servings, setServings] = useState('2');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  const servingCount = parsePositiveNumber(servings);

  const nutrition = useMemo(() => {
    const ingredients = drafts.map((draft) => ({
      ...draft.food,
      grams: parseNonNegativeNumber(draft.grams) ?? 0,
    }));
    // `calculateRecipe` already falls back to one serving for a nonsense count, which is
    // what keeps the live preview finite while the field is still being typed into.
    return calculateRecipe(ingredients, servingCount ?? 0);
  }, [drafts, servingCount]);

  const canSave = name.trim().length > 0 && nutrition.totalGrams > 0;

  function addIngredient(food: Food) {
    setDrafts((current) =>
      current.some((draft) => draft.food.id === food.id)
        ? current
        : [...current, { food, grams: '100' }],
    );
  }

  function updateGrams(foodId: string, grams: string) {
    setDrafts((current) =>
      current.map((draft) => (draft.food.id === foodId ? { ...draft, grams } : draft)),
    );
  }

  function removeIngredient(foodId: string) {
    setDrafts((current) => current.filter((draft) => draft.food.id !== foodId));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveRecipe(
        name.trim(),
        servingCount ?? 1,
        drafts.map((draft) => ({
          foodId: draft.food.id,
          grams: parseNonNegativeNumber(draft.grams) ?? 0,
        })),
      );
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  const perServing = roundTotals(nutrition.perServing);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'New recipe' }} />

      <ThemedText type="smallBold">Name</ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Sunday chili"
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />

      <ThemedText type="smallBold">Servings</ThemedText>
      <TextInput
        value={servings}
        onChangeText={setServings}
        keyboardType="decimal-pad"
        style={inputStyle}
      />

      <ThemedText type="smallBold">Ingredients</ThemedText>
      {drafts.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Add ingredients from your food library below.
        </ThemedText>
      ) : (
        drafts.map((draft) => (
          <View key={draft.food.id} style={styles.ingredientRow}>
            <ThemedText style={styles.ingredientName} numberOfLines={1}>
              {draft.food.name}
            </ThemedText>
            <TextInput
              value={draft.grams}
              onChangeText={(value) => updateGrams(draft.food.id, value)}
              keyboardType="decimal-pad"
              style={[...inputStyle, styles.gramsInput]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {draft.food.baseUnit}
            </ThemedText>
            <Pressable onPress={() => removeIngredient(draft.food.id)} hitSlop={10}>
              <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
        ))
      )}

      {nutrition.totalGrams > 0 ? (
        <View style={[styles.result, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">{perServing.kcal} kcal</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            per serving · P {perServing.protein} g · C {perServing.carbs} g · F {perServing.fat} g
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Math.round(nutrition.totalGrams)} g total
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        onPress={handleSave}
        disabled={!canSave || saving}
        style={[
          styles.primaryButton,
          { backgroundColor: canSave ? theme.accent : theme.backgroundSelected },
        ]}>
        <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save recipe'}</ThemedText>
      </Pressable>

      <ThemedText type="smallBold">Your food library</ThemedText>
      {(available ?? [])
        .filter((food) => !food.id.startsWith('recipe:') && food.id !== 'custom:quick-add')
        .map((food) => (
          <Pressable
            key={food.id}
            onPress={() => addIngredient(food)}
            style={[styles.libraryRow, { borderColor: theme.border }]}>
            <View style={styles.ingredientName}>
              <ThemedText numberOfLines={1}>{food.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(food.kcalPer100g)} kcal / 100 {food.baseUnit}
              </ThemedText>
            </View>
            <Ionicons name="add" size={22} color={theme.accent} />
          </Pressable>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    padding: Spacing.four,
  },
  gramsInput: {
    minWidth: 72,
    textAlign: 'right',
  },
  ingredientName: {
    flex: 1,
  },
  ingredientRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  libraryRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginVertical: Spacing.three,
    paddingVertical: Spacing.three,
  },
  primaryLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  result: {
    borderRadius: 16,
    gap: Spacing.one,
    marginTop: Spacing.three,
    padding: Spacing.three,
  },
});
