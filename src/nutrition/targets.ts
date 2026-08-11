/**
 * Calorie and macro target calculation. Pure — no database, no React.
 *
 * Uses Mifflin-St Jeor for BMR, which is the standard the major trackers settled on and
 * is more accurate than Harris-Benedict for the general population.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Energy in roughly 1 kg of body mass, used to convert a weekly rate to a daily delta. */
const KCAL_PER_KG = 7700;

/**
 * Floor for the calorie target. Going below this without medical supervision is a bad
 * idea, so the calculation clamps and reports that it clamped rather than silently
 * handing back a number the user should not eat to.
 */
export const MIN_KCAL_TARGET = 1200;

export type TargetInput = {
  sex: Sex;
  /** Years. */
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Desired rate of change in kg/week, always given as a positive magnitude. */
  rateKgPerWeek: number;
};

export type MacroTargets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type TargetResult = MacroTargets & {
  bmr: number;
  tdee: number;
  /** True when the requested deficit was too aggressive and the target hit the floor. */
  clamped: boolean;
};

/** Mifflin-St Jeor basal metabolic rate. */
export function calculateBmr({
  sex,
  age,
  heightCm,
  weightKg,
}: Pick<TargetInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

/** Daily calorie delta implied by a weekly rate of weight change. */
export function dailyDeltaForRate(goal: Goal, rateKgPerWeek: number): number {
  if (goal === 'maintain') return 0;
  const magnitude = (Math.abs(rateKgPerWeek) * KCAL_PER_KG) / 7;
  return goal === 'lose' ? -magnitude : magnitude;
}

/**
 * Split a calorie target into macros.
 *
 * Protein is anchored to bodyweight rather than a percentage — protein needs scale with
 * body mass, not with how much you happen to be eating. Fat takes a share of total
 * calories, and carbohydrate absorbs whatever is left.
 */
export function splitMacros(
  kcal: number,
  weightKg: number,
  { proteinGPerKg = 1.8, fatPercent = 0.28 }: { proteinGPerKg?: number; fatPercent?: number } = {},
): Omit<MacroTargets, 'kcal'> {
  const proteinG = weightKg * proteinGPerKg;
  const fatG = (kcal * fatPercent) / 9;
  const remainingKcal = kcal - proteinG * 4 - fatG * 9;
  // A very low calorie target combined with a high bodyweight can drive this negative;
  // clamping at zero keeps the numbers coherent instead of showing negative carbs.
  const carbsG = Math.max(0, remainingKcal / 4);

  return {
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  };
}

export function calculateTargets(input: TargetInput): TargetResult {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activityLevel);
  const raw = tdee + dailyDeltaForRate(input.goal, input.rateKgPerWeek);

  const clamped = raw < MIN_KCAL_TARGET;
  const kcal = Math.round(clamped ? MIN_KCAL_TARGET : raw);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal,
    clamped,
    ...splitMacros(kcal, input.weightKg),
  };
}

/** Whole years between a `YYYY-MM-DD` birth date and a reference date. */
export function ageFromBirthDate(birthDate: string, today: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - year;
  const hadBirthdayThisYear =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
