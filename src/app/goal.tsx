import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { profileQuery } from '@/db/queries';
import { saveProfile } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';
import {
  ACTIVITY_MULTIPLIERS,
  ageFromBirthDate,
  calculateTargets,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@/nutrition/targets';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Active',
  very_active: 'Very active',
};

const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain',
  gain: 'Gain weight',
};

const ACTIVITY_LEVELS = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];

function parseNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Goal setup. Targets are computed live as the user types so the trade-off between
 * activity level, rate and calories is visible before anything is saved.
 */
export default function GoalScreen() {
  const theme = useTheme();
  const { data: profileRows } = useLiveQuery(profileQuery());
  const existing = profileRows?.[0];

  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'male');
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? '1990-01-01');
  const [heightCm, setHeightCm] = useState(String(existing?.heightCm ?? 180));
  const [weightKg, setWeightKg] = useState(String(existing?.weightKg ?? 80));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    existing?.activityLevel ?? 'moderate',
  );
  const [goal, setGoal] = useState<Goal>(existing?.goal ?? 'maintain');
  const [rate, setRate] = useState(String(existing?.rateKgPerWeek ?? 0.5));
  const [saving, setSaving] = useState(false);

  const height = parseNumber(heightCm);
  const weight = parseNumber(weightKg);
  const age = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? ageFromBirthDate(birthDate) : null;

  const result = useMemo(() => {
    if (!height || !weight || age === null || age <= 0) return null;
    return calculateTargets({
      sex,
      age,
      heightCm: height,
      weightKg: weight,
      activityLevel,
      goal,
      rateKgPerWeek: Number.parseFloat(rate.replace(',', '.')) || 0,
    });
  }, [sex, age, height, weight, activityLevel, goal, rate]);

  async function handleSave() {
    if (!result || !height || !weight || age === null) return;
    setSaving(true);
    try {
      await saveProfile({
        sex,
        birthDate,
        heightCm: height,
        weightKg: weight,
        activityLevel,
        goal,
        rateKgPerWeek: Number.parseFloat(rate.replace(',', '.')) || 0,
        kcalTarget: result.kcal,
        proteinTargetG: result.proteinG,
        carbsTargetG: result.carbsG,
        fatTargetG: result.fatG,
      });
      router.back();
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
      <Stack.Screen options={{ title: 'Your goal' }} />

      <ThemedText type="smallBold">Sex</ThemedText>
      <ChipRow
        options={['male', 'female'] as Sex[]}
        value={sex}
        onChange={setSex}
        label={(option) => (option === 'male' ? 'Male' : 'Female')}
      />

      <ThemedText type="smallBold">Date of birth (YYYY-MM-DD)</ThemedText>
      <TextInput value={birthDate} onChangeText={setBirthDate} style={inputStyle} />

      <View style={styles.pair}>
        <View style={styles.pairItem}>
          <ThemedText type="smallBold">Height (cm)</ThemedText>
          <TextInput
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="decimal-pad"
            style={inputStyle}
          />
        </View>
        <View style={styles.pairItem}>
          <ThemedText type="smallBold">Weight (kg)</ThemedText>
          <TextInput
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            style={inputStyle}
          />
        </View>
      </View>

      <ThemedText type="smallBold">Activity</ThemedText>
      <ChipRow
        options={ACTIVITY_LEVELS}
        value={activityLevel}
        onChange={setActivityLevel}
        label={(option) => ACTIVITY_LABELS[option]}
      />

      <ThemedText type="smallBold">Goal</ThemedText>
      <ChipRow
        options={['lose', 'maintain', 'gain'] as Goal[]}
        value={goal}
        onChange={setGoal}
        label={(option) => GOAL_LABELS[option]}
      />

      {goal !== 'maintain' ? (
        <>
          <ThemedText type="smallBold">Rate (kg per week)</ThemedText>
          <TextInput
            value={rate}
            onChangeText={setRate}
            keyboardType="decimal-pad"
            style={inputStyle}
          />
        </>
      ) : null}

      {result ? (
        <View style={[styles.result, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">{result.kcal} kcal</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            BMR {result.bmr} · maintenance {result.tdee} kcal
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Protein {result.proteinG} g · Carbs {result.carbsG} g · Fat {result.fatG} g
          </ThemedText>
          {result.clamped ? (
            <ThemedText type="small" themeColor="danger">
              That rate would put you under 1200 kcal, so the target has been held at the floor.
              Pick a slower rate for a target you can actually eat to.
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <ThemedText type="small" themeColor="danger">
          Fill in a valid birth date, height and weight to see your targets.
        </ThemedText>
      )}

      <Pressable
        onPress={handleSave}
        disabled={!result || saving}
        style={[
          styles.primaryButton,
          { backgroundColor: result ? theme.accent : theme.backgroundSelected },
        ]}>
        <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save goal'}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[];
  value: T;
  onChange: (option: T) => void;
  label: (option: T) => string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[
            styles.chip,
            { backgroundColor: option === value ? theme.accent : theme.backgroundElement },
          ]}>
          <ThemedText type="small" style={option === value ? styles.chipActive : undefined}>
            {label(option)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  container: {
    gap: Spacing.two,
    padding: Spacing.four,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pairItem: {
    flex: 1,
    gap: Spacing.one,
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
  result: {
    borderRadius: 16,
    gap: Spacing.one,
    marginTop: Spacing.three,
    padding: Spacing.three,
  },
});
