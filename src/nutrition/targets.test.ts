import { describe, expect, it } from 'vitest';

import {
  ageFromBirthDate,
  calculateBmr,
  calculateTargets,
  calculateTdee,
  dailyDeltaForRate,
  MIN_KCAL_TARGET,
  splitMacros,
  type TargetInput,
} from './targets';

describe('calculateBmr', () => {
  it('matches Mifflin-St Jeor for men', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(calculateBmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
  });

  it('matches Mifflin-St Jeor for women', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
    expect(calculateBmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 65 })).toBeCloseTo(
      1370.25,
      2,
    );
  });
});

describe('calculateTdee', () => {
  it('applies the activity multiplier', () => {
    expect(calculateTdee(1780, 'moderate')).toBeCloseTo(2759, 0);
    expect(calculateTdee(1780, 'sedentary')).toBeCloseTo(2136, 0);
  });
});

describe('dailyDeltaForRate', () => {
  it('is negative when losing and positive when gaining', () => {
    expect(dailyDeltaForRate('lose', 0.5)).toBeCloseTo(-550, 0);
    expect(dailyDeltaForRate('gain', 0.25)).toBeCloseTo(275, 0);
  });

  it('ignores the rate entirely when maintaining', () => {
    expect(dailyDeltaForRate('maintain', 0.5)).toBe(0);
  });

  it('treats a negative rate as a magnitude, so the goal alone sets direction', () => {
    expect(dailyDeltaForRate('lose', -0.5)).toBeCloseTo(-550, 0);
  });
});

describe('splitMacros', () => {
  it('anchors protein to bodyweight and lets carbs absorb the remainder', () => {
    const macros = splitMacros(2200, 80);
    expect(macros.proteinG).toBe(144); // 80 * 1.8
    expect(macros.fatG).toBe(68); // 2200 * 0.28 / 9 = 68.4
    // 2200 - 144*4 - 68.4*9 = 1008.4 -> 252.1 g carbs
    expect(macros.carbsG).toBe(252);
  });

  it('never returns negative carbs when the target is very low for the bodyweight', () => {
    const macros = splitMacros(MIN_KCAL_TARGET, 150);
    expect(macros.carbsG).toBe(0);
  });
});

describe('calculateTargets', () => {
  const base: TargetInput = {
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activityLevel: 'moderate',
    goal: 'lose',
    rateKgPerWeek: 0.5,
  };

  it('produces a deficit target below TDEE', () => {
    const result = calculateTargets(base);
    expect(result.bmr).toBe(1780);
    expect(result.tdee).toBe(2759);
    expect(result.kcal).toBe(2209); // 2759 - 550
    expect(result.clamped).toBe(false);
  });

  it('leaves the target at TDEE when maintaining', () => {
    const result = calculateTargets({ ...base, goal: 'maintain', rateKgPerWeek: 0 });
    expect(result.kcal).toBe(result.tdee);
  });

  it('clamps at the floor and flags it when the deficit is unsafe', () => {
    const result = calculateTargets({
      ...base,
      weightKg: 55,
      heightCm: 160,
      activityLevel: 'sedentary',
      rateKgPerWeek: 1.5,
    });
    expect(result.kcal).toBe(MIN_KCAL_TARGET);
    expect(result.clamped).toBe(true);
  });
});

describe('ageFromBirthDate', () => {
  it('counts whole years only', () => {
    expect(ageFromBirthDate('1990-06-15', new Date('2026-08-11'))).toBe(36);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageFromBirthDate('1990-12-01', new Date('2026-08-11'))).toBe(35);
  });

  it('counts the birthday itself', () => {
    expect(ageFromBirthDate('1990-08-11', new Date('2026-08-11'))).toBe(36);
  });
});
