import { describe, expect, it } from 'vitest';

import {
  kcalFromMacros,
  macrosForGrams,
  macrosForQuantity,
  roundTotals,
  sumTotals,
  toGrams,
} from './portion';

const nutella = {
  kcalPer100g: 539,
  proteinPer100g: 6.3,
  carbsPer100g: 57.5,
  fatPer100g: 30.9,
};

describe('toGrams', () => {
  it('passes gram and millilitre quantities through unchanged', () => {
    expect(toGrams(150, 'g')).toBe(150);
    expect(toGrams(330, 'ml')).toBe(330);
  });

  it('multiplies portions by their gram weight', () => {
    expect(toGrams(2, 'portion', 32)).toBe(64);
  });

  it('returns zero for a portion with no known gram weight', () => {
    // This is the Open Food Facts null-serving_size case. Returning 0 rather than NaN
    // keeps daily totals finite while the UI prompts for a portion definition.
    expect(toGrams(2, 'portion', null)).toBe(0);
    expect(toGrams(2, 'portion', undefined)).toBe(0);
    expect(toGrams(2, 'portion', 0)).toBe(0);
  });

  it('rejects negative and non-finite quantities', () => {
    expect(toGrams(-5, 'g')).toBe(0);
    expect(toGrams(Number.NaN, 'g')).toBe(0);
  });
});

describe('macrosForGrams', () => {
  it('scales per-100g values', () => {
    const totals = macrosForGrams(nutella, 15);
    expect(totals.kcal).toBeCloseTo(80.85, 2);
    expect(totals.protein).toBeCloseTo(0.945, 3);
    expect(totals.carbs).toBeCloseTo(8.625, 3);
    expect(totals.fat).toBeCloseTo(4.635, 3);
  });

  it('is an identity at exactly 100 g', () => {
    expect(macrosForGrams(nutella, 100)).toEqual({
      kcal: 539,
      protein: 6.3,
      carbs: 57.5,
      fat: 30.9,
    });
  });

  it('returns zeroes for non-positive amounts', () => {
    expect(macrosForGrams(nutella, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(macrosForGrams(nutella, -10)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('macrosForQuantity', () => {
  it('resolves a portion count to grams and macros in one step', () => {
    const { grams, totals } = macrosForQuantity(nutella, 2, 'portion', 15);
    expect(grams).toBe(30);
    expect(totals.kcal).toBeCloseTo(161.7, 1);
  });
});

describe('sumTotals', () => {
  it('adds entries field by field', () => {
    const summed = sumTotals([
      { kcal: 100, protein: 10, carbs: 5, fat: 2 },
      { kcal: 250, protein: 3, carbs: 40, fat: 8 },
    ]);
    expect(summed).toEqual({ kcal: 350, protein: 13, carbs: 45, fat: 10 });
  });

  it('returns zeroes for an empty day', () => {
    expect(sumTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('roundTotals', () => {
  it('rounds calories whole and macros to one decimal', () => {
    expect(roundTotals({ kcal: 80.85, protein: 0.945, carbs: 8.625, fat: 4.635 })).toEqual({
      kcal: 81,
      protein: 0.9,
      carbs: 8.6,
      fat: 4.6,
    });
  });
});

describe('kcalFromMacros', () => {
  it('applies Atwater factors', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 })).toBe(165);
  });
});
