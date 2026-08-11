import { macrosForGrams, sumTotals, type MacroTotals, type NutritionPer100g } from './portion';

/**
 * Recipe macro math. Pure — no database, no React.
 *
 * A recipe is a list of ingredients by weight plus a serving count. Its nutrition is
 * expressed per 100 g of finished dish, so a recipe can be logged with exactly the same
 * portion machinery as any other food.
 */

export type RecipeIngredient = NutritionPer100g & { grams: number };

export type RecipeNutrition = {
  totalGrams: number;
  /** Macros for the whole batch. */
  total: MacroTotals;
  /** Macros for one serving. */
  perServing: MacroTotals;
  /** Per-100 g figures, which is how the recipe is stored as a food. */
  per100g: NutritionPer100g;
};

export function calculateRecipe(
  ingredients: readonly RecipeIngredient[],
  servings: number,
): RecipeNutrition {
  const totalGrams = ingredients.reduce((sum, item) => sum + Math.max(0, item.grams), 0);
  const total = sumTotals(ingredients.map((item) => macrosForGrams(item, item.grams)));

  // A recipe with no ingredients, or a nonsense serving count, must still return finite
  // numbers — the editor renders this live while the user is still typing.
  const safeServings = Number.isFinite(servings) && servings > 0 ? servings : 1;
  const perServing: MacroTotals = {
    kcal: total.kcal / safeServings,
    protein: total.protein / safeServings,
    carbs: total.carbs / safeServings,
    fat: total.fat / safeServings,
  };

  const factor = totalGrams > 0 ? 100 / totalGrams : 0;
  const per100g: NutritionPer100g = {
    kcalPer100g: total.kcal * factor,
    proteinPer100g: total.protein * factor,
    carbsPer100g: total.carbs * factor,
    fatPer100g: total.fat * factor,
  };

  return { totalGrams, total, perServing, per100g };
}

/**
 * Grams in one serving, which becomes the recipe food's `servingSizeG`. This is what
 * lets "1 serving of chili" be logged without the user knowing it weighs 340 g.
 */
export function servingGrams(totalGrams: number, servings: number): number | null {
  if (totalGrams <= 0) return null;
  const safeServings = Number.isFinite(servings) && servings > 0 ? servings : 1;
  return totalGrams / safeServings;
}
