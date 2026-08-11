import { BACKUP_VERSION, type Backup } from './backup-format';
import { db } from './client';
import { diaryEntries, foods, portions, profile, recipeItems, recipes, weightLog } from './schema';

/**
 * JSON export/import.
 *
 * This is the backup story while cloud sync is optional: everything the user has
 * entered is theirs, in a plain readable file, with no account and no service in the
 * middle. It is also the migration path onto a new phone.
 */

export { BackupFormatError, parseBackup, type Backup } from './backup-format';

export async function exportBackup(): Promise<Backup> {
  const [foodRows, portionRows, diaryRows, weightRows, profileRows, recipeRows, recipeItemRows] =
    await Promise.all([
      db.select().from(foods),
      db.select().from(portions),
      db.select().from(diaryEntries),
      db.select().from(weightLog),
      db.select().from(profile),
      db.select().from(recipes),
      db.select().from(recipeItems),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // Soft-deleted rows are included deliberately: they are tombstones, and dropping
    // them would resurrect deleted entries on a restore into a synced device.
    foods: foodRows,
    portions: portionRows,
    diaryEntries: diaryRows,
    weightLog: weightRows,
    profile: profileRows,
    recipes: recipeRows,
    recipeItems: recipeItemRows,
  };
}

/**
 * Merge a backup into the current database.
 *
 * Merge rather than replace, and last-write-wins on `updatedAt`: importing must never
 * destroy entries the user logged on this device since the export. Order matters —
 * foods and recipes come first so the rows referencing them satisfy their foreign keys.
 */
export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction(async (tx) => {
    for (const row of backup.foods) {
      await tx.insert(foods).values(row).onConflictDoUpdate({ target: foods.id, set: row });
    }
    for (const row of backup.recipes) {
      await tx.insert(recipes).values(row).onConflictDoUpdate({ target: recipes.id, set: row });
    }
    for (const row of backup.portions) {
      await tx.insert(portions).values(row).onConflictDoUpdate({ target: portions.id, set: row });
    }
    for (const row of backup.recipeItems) {
      await tx
        .insert(recipeItems)
        .values(row)
        .onConflictDoUpdate({ target: recipeItems.id, set: row });
    }
    for (const row of backup.diaryEntries) {
      await tx
        .insert(diaryEntries)
        .values(row)
        .onConflictDoUpdate({ target: diaryEntries.id, set: row });
    }
    for (const row of backup.weightLog) {
      await tx.insert(weightLog).values(row).onConflictDoUpdate({ target: weightLog.id, set: row });
    }
    for (const row of backup.profile) {
      await tx.insert(profile).values(row).onConflictDoUpdate({ target: profile.id, set: row });
    }
  });
}
