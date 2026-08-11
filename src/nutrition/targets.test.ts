import { describe, expect, it } from 'vitest';

import {
  ageFromBirthDate,
  calculateBmr,
  calculateTargets,
  calculateTdee,
  dailyDeltaForRate,
  estimatedGoalDate,
  MIN_KCAL_TARGET,
  splitMacros,
  targetIsConsistent,
  weeksToTarget,
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

describe('targetIsConsistent', () => {
  it('requires a losing target below the current weight', () => {
    expect(targetIsConsistent('lose', 80, 72)).toBe(true);
    expect(targetIsConsistent('lose', 80, 85)).toBe(false);
    expect(targetIsConsistent('lose', 80, 80)).toBe(false);
  });

  it('requires a gaining target above the current weight', () => {
    expect(targetIsConsistent('gain', 60, 66)).toBe(true);
    expect(targetIsConsistent('gain', 60, 55)).toBe(false);
  });

  it('accepts anything when maintaining, since the target is unused', () => {
    expect(targetIsConsistent('maintain', 80, 120)).toBe(true);
  });
});

describe('weeksToTarget', () => {
  it('divides the distance by the weekly rate', () => {
    expect(weeksToTarget(80, 72, 0.5)).toBe(16);
    expect(weeksToTarget(60, 66, 0.25)).toBe(24);
  });

  it('ignores the sign of the rate, which the goal already carries', () => {
    expect(weeksToTarget(80, 72, -0.5)).toBe(16);
  });

  it('returns null when there is no rate or no distance', () => {
    expect(weeksToTarget(80, 72, 0)).toBeNull();
    expect(weeksToTarget(80, 80, 0.5)).toBeNull();
  });
});

describe('estimatedGoalDate', () => {
  it('projects the day a losing target is reached', () => {
    // 8 kg at 0.5 kg/week = 16 weeks = 112 days after 2026-01-01.
    expect(estimatedGoalDate('lose', 80, 72, 0.5, '2026-01-01')).toBe('2026-04-23');
  });

  it('projects the day a gaining target is reached', () => {
    // 6 kg at 0.25 kg/week = 24 weeks = 168 days after 2026-01-01.
    expect(estimatedGoalDate('gain', 60, 66, 0.25, '2026-01-01')).toBe('2026-06-18');
  });

  it('rounds a partial week up to a whole day', () => {
    // 1 kg at 0.3 kg/week = 3.33 weeks = 23.33 days -> 24 days.
    expect(estimatedGoalDate('lose', 80, 79, 0.3, '2026-01-01')).toBe('2026-01-25');
  });

  it('has no date when maintaining', () => {
    expect(estimatedGoalDate('maintain', 80, 72, 0.5, '2026-01-01')).toBeNull();
  });

  it('has no date at a zero rate', () => {
    expect(estimatedGoalDate('lose', 80, 72, 0, '2026-01-01')).toBeNull();
  });

  it('has no date when the target sits on the wrong side of the current weight', () => {
    expect(estimatedGoalDate('lose', 80, 85, 0.5, '2026-01-01')).toBeNull();
    expect(estimatedGoalDate('gain', 80, 75, 0.5, '2026-01-01')).toBeNull();
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
