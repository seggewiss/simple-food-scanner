import { create } from 'zustand';

import { shiftIsoDate, todayIso } from '@/lib/date';

/** Mirrors the `meal` enum in the schema without importing the database layer. */
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * Which day and meal the user is currently logging into. Kept in a store rather than
 * route params so the scan → food detail → back-to-diary round trip lands the entry on
 * the day the user was looking at, not on whatever "today" happens to be.
 */
type DiaryState = {
  date: string;
  meal: Meal;
  setDate: (date: string) => void;
  setMeal: (meal: Meal) => void;
  shiftDate: (days: number) => void;
};

/** Meal inferred from the clock, so the common case needs no tapping. */
export function mealForHour(hour: number): Meal {
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export const useDiaryStore = create<DiaryState>((set) => ({
  date: todayIso(),
  meal: mealForHour(new Date().getHours()),
  setDate: (date) => set({ date }),
  setMeal: (meal) => set({ meal }),
  shiftDate: (days) => set((state) => ({ date: shiftIsoDate(state.date, days) })),
}));
