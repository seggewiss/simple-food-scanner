import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { quickAdd } from '@/db/repository';
import type { Meal } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { useDiaryStore } from '@/stores/diary-store';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Bare calorie entry for a meal that cannot be looked up — a restaurant dish, a
 * colleague's birthday cake. A rough number logged beats an accurate one skipped.
 */
export default function QuickAddScreen() {
  const theme = useTheme();
  const date = useDiaryStore((state) => state.date);
  const meal = useDiaryStore((state) => state.meal);
  const setMeal = useDiaryStore((state) => state.setMeal);

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const kcal = Number.parseFloat(text.replace(',', '.'));
  const canSave = Number.isFinite(kcal) && kcal > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await quickAdd(date, meal, kcal);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Quick add' }} />

      <ThemedText type="smallBold">Calories</ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        keyboardType="number-pad"
        placeholder="450"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
        ]}
      />

      <ThemedText type="smallBold">Meal</ThemedText>
      <View style={styles.row}>
        {MEALS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setMeal(option)}
            style={[
              styles.chip,
              { backgroundColor: option === meal ? theme.accent : theme.backgroundElement },
            ]}>
            <ThemedText type="small" style={option === meal ? styles.chipActive : undefined}>
              {option}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleSave}
        disabled={!canSave || saving}
        style={[
          styles.primaryButton,
          { backgroundColor: canSave ? theme.accent : theme.backgroundSelected },
        ]}>
        <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : `Add to ${meal}`}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 24,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
  },
  primaryLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
