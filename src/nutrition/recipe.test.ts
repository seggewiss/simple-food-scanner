import { describe, expect, it } from 'vitest';

import { calculateRecipe, servingGrams, type RecipeIngredient } from './recipe';

const oats: RecipeIngredient = {
  grams: 80,
  kcalPer100g: 380,
  proteinPer100g: 13,
  carbsPer100g: 60,
  fatPer100g: 7,
};

const milk: RecipeIngredient = {
  grams: 250,
  kcalPer100g: 47,
  proteinPer100g: 3.4,
  carbsPer100g: 4.8,
  fatPer100g: 1.6,
};

describe('calculateRecipe', () => {
  it('sums the batch and divides by servings', () => {
    const recipe = calculateRecipe([oats, milk], 2);

    expect(recipe.totalGrams).toBe(330);
    // 380*0.8 + 47*2.5 = 304 + 117.5
    expect(recipe.total.kcal).toBeCloseTo(421.5, 5);
    expect(recipe.perServing.kcal).toBeCloseTo(210.75, 5);
  });

  it('derives per-100g figures so a recipe can be stored as an ordinary food', () => {
    const recipe = calculateRecipe([oats, milk], 2);
    // 421.5 kcal in 330 g
    expect(recipe.per100g.kcalPer100g).toBeCloseTo(127.73, 2);
  });

  it('treats a zero or negative serving count as one, rather than dividing by zero', () => {
    const zero = calculateRecipe([oats], 0);
    expect(zero.perServing.kcal).toBeCloseTo(304, 5);
    expect(Number.isFinite(zero.perServing.kcal)).toBe(true);

    const negative = calculateRecipe([oats], -3);
    expect(negative.perServing.kcal).toBeCloseTo(304, 5);
  });

  it('returns finite zeroes for an empty ingredient list', () => {
    const empty = calculateRecipe([], 4);
    expect(empty.totalGrams).toBe(0);
    expect(empty.total).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(empty.per100g.kcalPer100g).toBe(0);
  });

  it('ignores negative ingredient weights in the total', () => {
    const recipe = calculateRecipe([{ ...oats, grams: -50 }], 1);
    expect(recipe.totalGrams).toBe(0);
  });
});

describe('servingGrams', () => {
  it('splits the batch weight across servings', () => {
    expect(servingGrams(330, 2)).toBe(165);
  });

  it('returns null when there is nothing to split', () => {
    expect(servingGrams(0, 2)).toBeNull();
  });

  it('falls back to a single serving for a nonsense count', () => {
    expect(servingGrams(330, 0)).toBe(330);
  });
});
