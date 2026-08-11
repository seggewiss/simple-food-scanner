import { and, desc, eq, isNull, like, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { macrosForQuantity, type LogUnit } from '@/nutrition/portion';
import { calculateRecipe, servingGrams as recipeServingGrams } from '@/nutrition/recipe';

import { db } from './client';
import {
  diaryEntries,
  foods,
  portions,
  profile,
  recipeItems,
  recipes,
  weightLog,
  type Food,
  type Meal,
  type NewFood,
} from './schema';

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** RFC 4122 v4. React Native has no `crypto` global, so use expo-crypto's native implementation. */
const newId = () => randomUUID();

/**
 * Insert or refresh a cached Open Food Facts product.
 *
 * Keyed on the deterministic `off:<barcode>` id, so a re-scan updates the existing row
 * instead of accumulating duplicates. `createdAt` is preserved.
 */
export async function upsertFood(food: NewFood): Promise<Food> {
  const [row] = await db
    .insert(foods)
    .values(food)
    .onConflictDoUpdate({
      target: foods.id,
      set: {
        name: food.name,
        brand: food.brand,
        kcalPer100g: food.kcalPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        fiberPer100g: food.fiberPer100g,
        sugarPer100g: food.sugarPer100g,
        satFatPer100g: food.satFatPer100g,
        saltPer100g: food.saltPer100g,
        baseUnit: food.baseUnit,
        servingSizeG: food.servingSizeG,
        servingLabel: food.servingLabel,
        imageUrl: food.imageUrl,
        fetchedAt: food.fetchedAt,
        updatedAt: nowSeconds(),
        deletedAt: null,
      },
    })
    .returning();

  return row;
}

export async function getFoodById(id: string): Promise<Food | undefined> {
  const [row] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, id), isNull(foods.deletedAt)))
    .limit(1);
  return row;
}

/** Local cache lookup. This is what makes a previously scanned food work offline. */
export async function getFoodByBarcode(barcode: string): Promise<Food | undefined> {
  const [row] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.barcode, barcode), isNull(foods.deletedAt)))
    .limit(1);
  return row;
}

export async function searchLocalFoods(query: string, limit = 25): Promise<Food[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return db
    .select()
    .from(foods)
    .where(and(like(foods.name, `%${trimmed}%`), isNull(foods.deletedAt)))
    .orderBy(desc(foods.updatedAt))
    .limit(limit);
}

export async function getPortionsForFood(foodId: string) {
  return db
    .select()
    .from(portions)
    .where(and(eq(portions.foodId, foodId), isNull(portions.deletedAt)))
    .orderBy(desc(portions.isDefault));
}

export async function createPortion(foodId: string, label: string, grams: number) {
  const [row] = await db
    .insert(portions)
    .values({ id: newId(), foodId, label, grams })
    .returning();
  return row;
}

export type LogFoodInput = {
  food: Food;
  date: string;
  meal: Meal;
  quantity: number;
  unit: LogUnit;
  portionId?: string | null;
  portionGrams?: number | null;
};

/**
 * Write a diary entry, snapshotting the macros it contributed.
 *
 * The snapshot is why this takes the whole food row: totals are computed here, once,
 * and never recomputed from `foods` afterwards. Editing a food later must not silently
 * rewrite what yesterday's diary says you ate.
 */
export async function logFood(input: LogFoodInput) {
  const { grams, totals } = macrosForQuantity(
    input.food,
    input.quantity,
    input.unit,
    input.portionGrams,
  );

  const [row] = await db
    .insert(diaryEntries)
    .values({
      id: newId(),
      date: input.date,
      meal: input.meal,
      foodId: input.food.id,
      portionId: input.portionId ?? null,
      quantity: input.quantity,
      unit: input.unit,
      grams,
      kcal: totals.kcal,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
    })
    .returning();

  return row;
}

export type DiaryRow = {
  id: string;
  meal: Meal;
  quantity: number;
  unit: LogUnit;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  foodName: string;
  foodBrand: string | null;
};

export async function getDiaryForDate(date: string): Promise<DiaryRow[]> {
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
    })
    .from(diaryEntries)
    .innerJoin(foods, eq(diaryEntries.foodId, foods.id))
    .where(and(eq(diaryEntries.date, date), isNull(diaryEntries.deletedAt)))
    .orderBy(diaryEntries.meal, diaryEntries.createdAt);
}

/** Soft delete, so the row can propagate as a tombstone if sync is enabled later. */
export async function deleteDiaryEntry(id: string) {
  await db
    .update(diaryEntries)
    .set({ deletedAt: nowSeconds(), updatedAt: nowSeconds() })
    .where(eq(diaryEntries.id, id));
}

/**
 * Reverse a soft delete. Because `deleteDiaryEntry` only tombstones the row, undo is a
 * field reset rather than a re-insert — the entry keeps its id and its original
 * denormalized nutrition snapshot.
 */
export async function restoreDiaryEntry(id: string) {
  await db
    .update(diaryEntries)
    .set({ deletedAt: null, updatedAt: nowSeconds() })
    .where(eq(diaryEntries.id, id));
}

export async function getProfile() {
  const [row] = await db.select().from(profile).limit(1);
  return row;
}

export type SaveProfileInput = Omit<
  typeof profile.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** Upsert the single profile row. Targets are stored resolved, not recomputed on read. */
export async function saveProfile(input: SaveProfileInput) {
  await db
    .insert(profile)
    .values({ ...input, id: 'singleton' })
    .onConflictDoUpdate({
      target: profile.id,
      set: { ...input, updatedAt: nowSeconds(), deletedAt: null },
    });
}

export async function recordWeight(date: string, weightKg: number, note?: string) {
  await db
    .insert(weightLog)
    .values({ id: newId(), date, weightKg, note: note ?? null })
    .onConflictDoUpdate({
      target: weightLog.date,
      set: { weightKg, note: note ?? null, updatedAt: nowSeconds(), deletedAt: null },
    });
}

export type RecipeIngredientInput = { foodId: string; grams: number };

/**
 * Save a recipe and materialize it as a `foods` row.
 *
 * Storing the computed per-100 g figures as an ordinary food is what lets a recipe be
 * scanned for, portioned and logged through exactly the same code path as a packaged
 * product — no branching anywhere in the diary or the portion picker.
 */
export async function saveRecipe(
  name: string,
  servings: number,
  ingredients: RecipeIngredientInput[],
  recipeId?: string,
): Promise<Food> {
  const id = recipeId ?? newId();
  const seconds = nowSeconds();

  const ingredientFoods = await Promise.all(
    ingredients.map(async (item) => {
      const food = await getFoodById(item.foodId);
      if (!food) throw new Error(`Ingredient ${item.foodId} no longer exists`);
      return { ...food, grams: item.grams };
    }),
  );

  const nutrition = calculateRecipe(ingredientFoods, servings);

  return db.transaction(async (tx) => {
    await tx
      .insert(recipes)
      .values({ id, name, servings })
      .onConflictDoUpdate({
        target: recipes.id,
        set: { name, servings, updatedAt: seconds, deletedAt: null },
      });

    // Rewrite the ingredient list wholesale; diffing it would buy nothing at this size.
    await tx.delete(recipeItems).where(eq(recipeItems.recipeId, id));
    if (ingredients.length > 0) {
      await tx.insert(recipeItems).values(
        ingredients.map((item) => ({
          id: newId(),
          recipeId: id,
          foodId: item.foodId,
          grams: item.grams,
        })),
      );
    }

    const [food] = await tx
      .insert(foods)
      .values({
        id: `recipe:${id}`,
        source: 'custom',
        name,
        kcalPer100g: nutrition.per100g.kcalPer100g,
        proteinPer100g: nutrition.per100g.proteinPer100g,
        carbsPer100g: nutrition.per100g.carbsPer100g,
        fatPer100g: nutrition.per100g.fatPer100g,
        baseUnit: 'g',
        servingSizeG: recipeServingGrams(nutrition.totalGrams, servings),
        servingLabel: `1 of ${servings} servings`,
      })
      .onConflictDoUpdate({
        target: foods.id,
        set: {
          name,
          kcalPer100g: nutrition.per100g.kcalPer100g,
          proteinPer100g: nutrition.per100g.proteinPer100g,
          carbsPer100g: nutrition.per100g.carbsPer100g,
          fatPer100g: nutrition.per100g.fatPer100g,
          servingSizeG: recipeServingGrams(nutrition.totalGrams, servings),
          servingLabel: `1 of ${servings} servings`,
          updatedAt: seconds,
          deletedAt: null,
        },
      })
      .returning();

    return food;
  });
}

export async function getRecipeWithItems(recipeId: string) {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) return undefined;

  const items = await db
    .select({
      id: recipeItems.id,
      foodId: recipeItems.foodId,
      grams: recipeItems.grams,
      name: foods.name,
      kcalPer100g: foods.kcalPer100g,
      proteinPer100g: foods.proteinPer100g,
      carbsPer100g: foods.carbsPer100g,
      fatPer100g: foods.fatPer100g,
    })
    .from(recipeItems)
    .innerJoin(foods, eq(recipeItems.foodId, foods.id))
    .where(and(eq(recipeItems.recipeId, recipeId), isNull(recipeItems.deletedAt)));

  return { recipe, items };
}

/**
 * Log calories without naming a food, for the meal you ate out and cannot look up.
 * Backed by a single hidden food row so the diary schema needs no special case.
 */
const QUICK_ADD_FOOD_ID = 'custom:quick-add';

export async function quickAdd(date: string, meal: Meal, kcal: number) {
  const seconds = nowSeconds();

  // Stored at 1 kcal per gram, so logging N grams of it yields exactly N calories.
  await db
    .insert(foods)
    .values({
      id: QUICK_ADD_FOOD_ID,
      source: 'custom',
      name: 'Quick add',
      kcalPer100g: 100,
      baseUnit: 'g',
      createdAt: seconds,
      updatedAt: seconds,
    })
    .onConflictDoNothing();

  const [row] = await db
    .insert(diaryEntries)
    .values({
      id: newId(),
      date,
      meal,
      foodId: QUICK_ADD_FOOD_ID,
      quantity: kcal,
      unit: 'g',
      grams: kcal,
      kcal,
      protein: 0,
      carbs: 0,
      fat: 0,
    })
    .returning();

  return row;
}

/**
 * Copy every entry from one day onto another. Snapshots are copied verbatim rather than
 * recomputed, so a duplicated day shows the same numbers as the day it came from.
 */
export async function copyDay(fromDate: string, toDate: string): Promise<number> {
  const source = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.date, fromDate), isNull(diaryEntries.deletedAt)));

  if (source.length === 0) return 0;

  await db.insert(diaryEntries).values(
    source.map((entry) => ({
      ...entry,
      id: newId(),
      date: toDate,
      createdAt: nowSeconds(),
      updatedAt: nowSeconds(),
    })),
  );

  return source.length;
}

/** Escape hatch for one-off aggregate queries. */
export const rawSql = sql;
