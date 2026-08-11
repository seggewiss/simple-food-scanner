import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { upsertFood } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';
import { parseNonNegativeNumber } from '@/lib/number';

type FieldKey = 'name' | 'brand' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'servingSize';

const NUMERIC_FIELDS: FieldKey[] = ['kcal', 'protein', 'carbs', 'fat', 'servingSize'];

/**
 * Hand-entered food. Reached either from Settings or, more often, straight from a
 * barcode that Open Food Facts does not know — in which case the barcode is carried
 * over so the same scan resolves locally next time.
 */
export default function NewFoodScreen() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const theme = useTheme();

  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: '',
    brand: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    servingSize: '',
  });
  const [baseUnit, setBaseUnit] = useState<'g' | 'ml'>('g');
  const [saving, setSaving] = useState(false);

  const kcal = parseNonNegativeNumber(values.kcal);
  const canSave = values.name.trim().length > 0 && kcal !== null;

  function setField(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!canSave || kcal === null) return;
    setSaving(true);
    try {
      const seconds = Math.floor(Date.now() / 1000);
      const trimmedBarcode = barcode?.trim();

      const food = await upsertFood({
        // Custom foods with a barcode reuse the `off:` keying so a later Open Food Facts
        // hit updates the same row instead of creating a duplicate for the same product.
        id: trimmedBarcode ? `off:${trimmedBarcode}` : `custom:${randomUUID()}`,
        source: 'custom',
        barcode: trimmedBarcode || null,
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        kcalPer100g: kcal,
        proteinPer100g: parseNonNegativeNumber(values.protein) ?? 0,
        carbsPer100g: parseNonNegativeNumber(values.carbs) ?? 0,
        fatPer100g: parseNonNegativeNumber(values.fat) ?? 0,
        baseUnit,
        servingSizeG: parseNonNegativeNumber(values.servingSize),
        fetchedAt: null,
        createdAt: seconds,
        updatedAt: seconds,
      });

      if (food.barcode) {
        router.replace({ pathname: '/food/[barcode]', params: { barcode: food.barcode } });
      } else {
        router.dismissTo('/');
      }
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [
    styles.input,
    { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'New food' }} />

      {barcode ? (
        <ThemedText type="small" themeColor="textSecondary">
          Barcode {barcode} — saved with this food so the next scan finds it instantly.
        </ThemedText>
      ) : null}

      <ThemedText type="smallBold">Name</ThemedText>
      <TextInput
        value={values.name}
        onChangeText={(value) => setField('name', value)}
        placeholder="Oat porridge"
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />

      <ThemedText type="smallBold">Brand (optional)</ThemedText>
      <TextInput
        value={values.brand}
        onChangeText={(value) => setField('brand', value)}
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />

      <ThemedText type="smallBold">Per 100 {baseUnit}</ThemedText>
      <View style={styles.row}>
        {(['g', 'ml'] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => setBaseUnit(option)}
            style={[
              styles.chip,
              { backgroundColor: option === baseUnit ? theme.accent : theme.backgroundElement },
            ]}>
            <ThemedText type="small" style={option === baseUnit ? styles.chipActive : undefined}>
              {option}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {NUMERIC_FIELDS.filter((key) => key !== 'servingSize').map((key) => (
        <View key={key} style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            {key === 'kcal' ? 'Calories (kcal)' : `${key} (g)`}
          </ThemedText>
          <TextInput
            value={values[key]}
            onChangeText={(value) => setField(key, value)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            style={inputStyle}
          />
        </View>
      ))}

      <ThemedText type="smallBold">Serving size (optional)</ThemedText>
      <TextInput
        value={values.servingSize}
        onChangeText={(value) => setField('servingSize', value)}
        keyboardType="decimal-pad"
        placeholder={`e.g. 30 (${baseUnit})`}
        placeholderTextColor={theme.textSecondary}
        style={inputStyle}
      />

      <Pressable
        onPress={handleSave}
        disabled={!canSave || saving}
        style={[
          styles.primaryButton,
          { backgroundColor: canSave ? theme.accent : theme.backgroundSelected },
        ]}>
        <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save food'}</ThemedText>
      </Pressable>

      {!canSave ? (
        <ThemedText type="small" themeColor="textSecondary">
          A name and a calorie value are required — everything else can be filled in later.
        </ThemedText>
      ) : null}
    </ScrollView>
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
    gap: Spacing.two,
    padding: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
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
    gap: Spacing.two,
  },
});
