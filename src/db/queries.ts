import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from './client';
import { diaryEntries, foods, profile, weightLog } from './schema';

/**
 * Query builders (not executed) for use with drizzle's `useLiveQuery`, which
 * re-runs them whenever the underlying tables change. Screens stay in sync after a log
 * without any manual invalidation.
 */

export function diaryForDateQuery(date: string) {
  return db
    .select({
      id: diaryEntries.id,
      meal: diaryEntries.meal,
      quantity: diaryEntries.quantity,
      unit: diaryEntries.unit,
      grams: diaryEntries.grams,
      kcal: diaryEntries.kcal,
      protein: diaryEntries.protein,
      carbs: diaryEntries.carbs,
      fat: diaryEntries.fat,
      foodName: foods.name,
      foodBrand: foods.brand,
      baseUnit: foods.baseUnit,
    })
    .from(diaryEntries)
    .innerJoin(foods, eq(diaryEntries.foodId, foods.id))
    .where(and(eq(diaryEntries.date, date), isNull(diaryEntries.deletedAt)))
    .orderBy(diaryEntries.createdAt);
}

export function profileQuery() {
  return db.select().from(profile).limit(1);
}

export function recentWeightsQuery(limit = 60) {
  return db
    .select()
    .from(weightLog)
    .where(isNull(weightLog.deletedAt))
    .orderBy(desc(weightLog.date))
    .limit(limit);
}

export function recentFoodsQuery(limit = 20) {
  return db
    .select()
    .from(foods)
    .where(isNull(foods.deletedAt))
    .orderBy(desc(foods.updatedAt))
    .limit(limit);
}

export type DiaryQueryRow = Awaited<ReturnType<typeof diaryForDateQuery>>[number];
