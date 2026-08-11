import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  DateField,
  formatDate,
  FormSection,
  NumberField,
  PickerField,
  SegmentedField,
  SliderField,
} from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { profileQuery } from '@/db/queries';
import { saveProfile } from '@/db/repository';
import type { Profile } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { parseIsoDate } from '@/lib/date';
import { parsePositiveNumber } from '@/lib/number';
import {
  ACTIVITY_MULTIPLIERS,
  ageFromBirthDate,
  calculateTargets,
  estimatedGoalDate,
  targetIsConsistent,
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
  lose: 'Lose',
  maintain: 'Maintain',
  gain: 'Gain',
};

const SEX_LABELS: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
};

const ACTIVITY_LEVELS = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];
const SEXES: Sex[] = ['male', 'female'];
const GOALS: Goal[] = ['lose', 'maintain', 'gain'];

/** Nobody alive is older than this, and the picker should not offer it. */
const OLDEST_BIRTH_DATE = new Date(new Date().getFullYear() - 120, 0, 1);

const DEFAULT_BIRTH_DATE = '1990-01-01';
const MIN_RATE = 0.1;
const MAX_RATE = 1;

/**
 * The birth date used to be free text, so a stored profile can hold something the date
 * picker cannot parse. Fall back rather than handing an Invalid Date to the native view.
 */
function safeBirthDate(stored: string | undefined): string {
  return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : DEFAULT_BIRTH_DATE;
}

/** Older profiles may hold a rate outside what the slider offers; pull it into range. */
function safeRate(stored: number | undefined): number {
  if (!stored) return 0.5;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, stored));
}

/**
 * Waits for the saved profile before mounting the form.
 *
 * `useLiveQuery` starts with an empty array and only fills it from an effect, so reading
 * it during the first render cannot distinguish "no profile yet" from "not loaded yet".
 * `updatedAt` is set only once a query result has actually landed, which makes it the
 * one reliable signal. Getting this wrong is not cosmetic: the form seeds its state from
 * what it is handed, so mounting too early would show defaults and then overwrite the
 * real profile with them on save.
 */
export default function GoalScreen() {
  const { data: profileRows, updatedAt } = useLiveQuery(profileQuery());

  if (!updatedAt) {
    return (
      <ThemedView style={styles.loading}>
        <Stack.Screen options={{ title: 'Your goal' }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return <GoalForm existing={profileRows[0]} />;
}

/**
 * Goal setup, split into who you are and what you want.
 *
 * The two are genuinely different things and were previously one undifferentiated list,
 * which is what made "weight" ambiguous: the weight in the first section is what you
 * weigh now and feeds the calorie maths, while the weight in the second is where you are
 * heading and only drives the projection.
 *
 * Targets are computed live as the user types so the trade-off between activity level,
 * rate and calories is visible before anything is saved.
 */
function GoalForm({ existing }: { existing: Profile | undefined }) {
  const theme = useTheme();

  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'male');
  const [birthDate, setBirthDate] = useState(safeBirthDate(existing?.birthDate));
  const [heightCm, setHeightCm] = useState(String(existing?.heightCm ?? 180));
  const [weightKg, setWeightKg] = useState(String(existing?.weightKg ?? 80));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    existing?.activityLevel ?? 'moderate',
  );
  const [goal, setGoal] = useState<Goal>(existing?.goal ?? 'maintain');
  const [targetWeightKg, setTargetWeightKg] = useState(
    existing?.targetWeightKg != null ? String(existing.targetWeightKg) : '',
  );
  const [rate, setRate] = useState(safeRate(existing?.rateKgPerWeek));
  const [saving, setSaving] = useState(false);

  const height = parsePositiveNumber(heightCm);
  const weight = parsePositiveNumber(weightKg);
  const target = parsePositiveNumber(targetWeightKg);
  const age = ageFromBirthDate(birthDate);

  const result = useMemo(() => {
    if (!height || !weight || age <= 0) return null;
    return calculateTargets({
      sex,
      age,
      heightCm: height,
      weightKg: weight,
      activityLevel,
      goal,
      rateKgPerWeek: rate,
    });
  }, [sex, age, height, weight, activityLevel, goal, rate]);

  const needsTarget = goal !== 'maintain';
  const targetError =
    needsTarget && target !== null && weight !== null && !targetIsConsistent(goal, weight, target)
      ? goal === 'lose'
        ? 'A losing goal needs a target below your current weight.'
        : 'A gaining goal needs a target above your current weight.'
      : null;

  const projectedDate =
    needsTarget && target !== null && weight !== null
      ? estimatedGoalDate(goal, weight, target, rate)
      : null;

  const canSave = result !== null && targetError === null && !saving;

  async function handleSave() {
    if (!result || !height || !weight || !canSave) return;
    setSaving(true);
    try {
      await saveProfile({
        sex,
        birthDate,
        heightCm: height,
        weightKg: weight,
        activityLevel,
        goal,
        // A maintain goal has no destination, so the column is cleared rather than left
        // holding a stale number from a previous losing or gaining goal.
        targetWeightKg: needsTarget ? target : null,
        rateKgPerWeek: rate,
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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Your goal' }} />

      <FormSection title="About you" description="Used to work out how many calories you burn.">
        <SegmentedField
          label="Sex"
          options={SEXES}
          value={sex}
          onChange={setSex}
          labelFor={(option) => SEX_LABELS[option]}
        />
        <DateField
          label="Date of birth"
          hint={age > 0 ? `${age} years old` : 'Pick a date in the past.'}
          value={birthDate}
          onChange={setBirthDate}
          minimumDate={OLDEST_BIRTH_DATE}
          maximumDate={new Date()}
        />
        <NumberField label="Height" unit="cm" value={heightCm} onChangeText={setHeightCm} />
        <NumberField
          label="Current weight"
          unit="kg"
          hint="What you weigh today. Day-to-day weigh-ins live in Progress."
          value={weightKg}
          onChangeText={setWeightKg}
        />
        <PickerField
          label="Activity"
          options={ACTIVITY_LEVELS}
          value={activityLevel}
          onChange={setActivityLevel}
          labelFor={(option) => ACTIVITY_LABELS[option]}
        />
      </FormSection>

      <FormSection
        title="Your goal"
        description="What you want your weight to do, and how fast.">
        <SegmentedField
          label="I want to"
          options={GOALS}
          value={goal}
          onChange={setGoal}
          labelFor={(option) => GOAL_LABELS[option]}
        />

        {needsTarget ? (
          <>
            <NumberField
              label="Target weight"
              unit="kg"
              value={targetWeightKg}
              onChangeText={setTargetWeightKg}
              error={targetError}
            />
            <SliderField
              label="Rate"
              value={rate}
              onChange={setRate}
              min={MIN_RATE}
              max={MAX_RATE}
              step={0.05}
              format={(value) => `${value.toFixed(2)} kg per week`}
              hint={
                projectedDate
                  ? `At this rate you reach ${target} kg around ${formatDate(parseIsoDate(projectedDate))}.`
                  : 'Enter a target weight to see when you would reach it.'
              }
            />
          </>
        ) : null}
      </FormSection>

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
        disabled={!canSave}
        style={[
          styles.primaryButton,
          { backgroundColor: canSave ? theme.accent : theme.backgroundSelected },
        ]}>
        <ThemedText style={styles.primaryLabel}>{saving ? 'Saving…' : 'Save goal'}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
    padding: Spacing.four,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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
  result: {
    borderRadius: 16,
    gap: Spacing.one,
    padding: Spacing.three,
  },
});
