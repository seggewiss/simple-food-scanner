/**
 * Portion → grams → macros. Every nutrition number the user sees flows through here,
 * so it stays pure and free of database or React imports.
 */

export type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** The subset of a food row this module needs. Keeps it usable before a row exists. */
export type NutritionPer100g = {
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export type LogUnit = 'g' | 'ml' | 'portion';

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/**
 * Resolve a logged quantity to grams.
 *
 * `g` and `ml` are treated 1:1 on purpose. Real density varies (oil is ~0.92 g/ml), but
 * Open Food Facts publishes drink nutrition per 100 ml and solids per 100 g, so the
 * "per 100 base unit" figure already matches whichever unit the product uses. Applying
 * a density factor here would double-correct.
 */
export function toGrams(quantity: number, unit: LogUnit, portionGrams?: number | null): number {
  if (!Number.isFinite(quantity) || quantity < 0) return 0;

  if (unit === 'portion') {
    if (portionGrams == null || !Number.isFinite(portionGrams) || portionGrams <= 0) return 0;
    return quantity * portionGrams;
  }

  return quantity;
}

/** Scale per-100 g nutrition to an arbitrary gram amount. */
export function macrosForGrams(food: NutritionPer100g, grams: number): MacroTotals {
  if (!Number.isFinite(grams) || grams <= 0) return { ...EMPTY_TOTALS };

  const factor = grams / 100;
  return {
    kcal: food.kcalPer100g * factor,
    protein: food.proteinPer100g * factor,
    carbs: food.carbsPer100g * factor,
    fat: food.fatPer100g * factor,
  };
}

/** Convenience wrapper: quantity + unit straight to macros. */
export function macrosForQuantity(
  food: NutritionPer100g,
  quantity: number,
  unit: LogUnit,
  portionGrams?: number | null,
): { grams: number; totals: MacroTotals } {
  const grams = toGrams(quantity, unit, portionGrams);
  return { grams, totals: macrosForGrams(food, grams) };
}

export function sumTotals(entries: readonly MacroTotals[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (acc, entry) => ({
      kcal: acc.kcal + entry.kcal,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fat: acc.fat + entry.fat,
    }),
    { ...EMPTY_TOTALS },
  );
}

/** Display rounding. Calories to whole numbers, macros to one decimal. */
export function roundTotals(totals: MacroTotals): MacroTotals {
  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
  };
}

/**
 * Calories implied by the macro breakdown, using Atwater factors. Useful for sanity
 * checks: Open Food Facts data is crowd-sourced and sometimes internally inconsistent.
 */
export function kcalFromMacros(totals: Pick<MacroTotals, 'protein' | 'carbs' | 'fat'>): number {
  return totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
}
