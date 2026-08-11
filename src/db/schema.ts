import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Every user-owned table carries a text UUID primary key plus `updatedAt` / `deletedAt`.
 * That combination is what makes optional cloud sync additive later: rows are globally
 * unique without a server handing out ids, last-write-wins can be resolved on a
 * timestamp, and deletes propagate as tombstones instead of vanishing silently.
 */
const syncColumns = {
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at'),
};

export const foods = sqliteTable(
  'foods',
  {
    id: text('id').primaryKey(),
    /** `off` rows are cached Open Food Facts products; `custom` rows are user-entered. */
    source: text('source', { enum: ['off', 'custom'] })
      .notNull()
      .default('custom'),
    barcode: text('barcode'),
    name: text('name').notNull(),
    brand: text('brand'),

    // Nutrition is stored per 100 g/ml exclusively. Open Food Facts publishes it that
    // way, and it is the only basis every food shares — servings are optional and
    // frequently missing upstream.
    kcalPer100g: real('kcal_per_100g').notNull(),
    proteinPer100g: real('protein_per_100g').notNull().default(0),
    carbsPer100g: real('carbs_per_100g').notNull().default(0),
    fatPer100g: real('fat_per_100g').notNull().default(0),
    fiberPer100g: real('fiber_per_100g'),
    sugarPer100g: real('sugar_per_100g'),
    satFatPer100g: real('sat_fat_per_100g'),
    saltPer100g: real('salt_per_100g'),

    /** `g` for solids, `ml` for drinks. Drives the unit label shown in the portion picker. */
    baseUnit: text('base_unit', { enum: ['g', 'ml'] })
      .notNull()
      .default('g'),
    /** Null whenever upstream has no serving data, which is common. */
    servingSizeG: real('serving_size_g'),
    servingLabel: text('serving_label'),
    imageUrl: text('image_url'),
    /** When the Open Food Facts copy was last pulled; null for custom foods. */
    fetchedAt: integer('fetched_at'),
    ...syncColumns,
  },
  (table) => [
    // Partial index: many custom foods have no barcode, and SQLite treats every NULL as
    // distinct, so a plain unique index would still allow duplicate real barcodes only
    // if the column were non-null. Scoping to non-null keeps one row per real barcode.
    uniqueIndex('foods_barcode_unique')
      .on(table.barcode)
      .where(sql`${table.barcode} is not null`),
    index('foods_name_idx').on(table.name),
  ],
);

/**
 * Named portions ("1 slice = 32 g"). This is the answer to Open Food Facts frequently
 * shipping products with no serving information: the user defines a portion once and
 * every later log of that food reuses it.
 */
export const portions = sqliteTable(
  'portions',
  {
    id: text('id').primaryKey(),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    grams: real('grams').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    ...syncColumns,
  },
  (table) => [index('portions_food_idx').on(table.foodId)],
);

export const diaryEntries = sqliteTable(
  'diary_entries',
  {
    id: text('id').primaryKey(),
    /** Local calendar day as `YYYY-MM-DD`. Deliberately not a timestamp: "what did I
     * eat on Tuesday" is a calendar question, and storing an instant would shift
     * entries across days on travel or DST. */
    date: text('date').notNull(),
    meal: text('meal', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }).notNull(),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    portionId: text('portion_id').references(() => portions.id, { onDelete: 'set null' }),
    quantity: real('quantity').notNull(),
    unit: text('unit', { enum: ['g', 'ml', 'portion'] }).notNull(),

    // Denormalized snapshot of what this entry actually contributed. Recomputing from
    // `foods` at read time would silently rewrite history whenever a food is edited or
    // its Open Food Facts record is refreshed.
    grams: real('grams').notNull(),
    kcal: real('kcal').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fat: real('fat').notNull(),
    ...syncColumns,
  },
  (table) => [index('diary_date_meal_idx').on(table.date, table.meal)],
);

export const weightLog = sqliteTable(
  'weight_log',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    weightKg: real('weight_kg').notNull(),
    note: text('note'),
    ...syncColumns,
  },
  (table) => [uniqueIndex('weight_log_date_unique').on(table.date)],
);

/** Single-row table; always keyed `singleton`. */
export const profile = sqliteTable('profile', {
  id: text('id').primaryKey().default('singleton'),
  sex: text('sex', { enum: ['male', 'female'] }).notNull(),
  birthDate: text('birth_date').notNull(),
  heightCm: real('height_cm').notNull(),
  weightKg: real('weight_kg').notNull(),
  activityLevel: text('activity_level', {
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  }).notNull(),
  goal: text('goal', { enum: ['lose', 'maintain', 'gain'] }).notNull(),
  /**
   * Goal weight in kg. Nullable because a `maintain` goal has no destination, and
   * because profiles saved before this column existed have no value to backfill from.
   * Never feeds the calorie maths — that uses `weightKg`, the current weight — it only
   * drives the projected completion date and the direction sanity check.
   */
  targetWeightKg: real('target_weight_kg'),
  /** Target rate of weight change in kg per week; sign follows `goal`. */
  rateKgPerWeek: real('rate_kg_per_week').notNull().default(0),

  // Resolved targets, computed once when the goal is saved rather than on every render.
  kcalTarget: real('kcal_target').notNull(),
  proteinTargetG: real('protein_target_g').notNull(),
  carbsTargetG: real('carbs_target_g').notNull(),
  fatTargetG: real('fat_target_g').notNull(),
  ...syncColumns,
});

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  servings: real('servings').notNull().default(1),
  note: text('note'),
  ...syncColumns,
});

export const recipeItems = sqliteTable(
  'recipe_items',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    grams: real('grams').notNull(),
    ...syncColumns,
  },
  (table) => [index('recipe_items_recipe_idx').on(table.recipeId)],
);

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Portion = typeof portions.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type NewDiaryEntry = typeof diaryEntries.$inferInsert;
export type Profile = typeof profile.$inferSelect;
export type Meal = DiaryEntry['meal'];
