import { describe, expect, it } from 'vitest';

import { mealForHour } from './diary-store';

describe('mealForHour', () => {
  it('maps the clock onto the meal a user is most likely logging', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(9)).toBe('breakfast');
    expect(mealForHour(12)).toBe('lunch');
    expect(mealForHour(18)).toBe('dinner');
    expect(mealForHour(22)).toBe('snack');
    expect(mealForHour(0)).toBe('breakfast');
  });
});
