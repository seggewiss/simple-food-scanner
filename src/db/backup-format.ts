import type { diaryEntries, foods, portions, profile, recipeItems, recipes, weightLog } from './schema';

/**
 * Backup file shape and its validation. Split out from `backup.ts` so it carries no
 * database handle and stays unit-testable in plain Node — a corrupt import is exactly
 * the path that must not be discovered for the first time on a user's phone.
 */

export const BACKUP_VERSION = 1;

export type Backup = {
  version: number;
  exportedAt: string;
  foods: (typeof foods.$inferSelect)[];
  portions: (typeof portions.$inferSelect)[];
  diaryEntries: (typeof diaryEntries.$inferSelect)[];
  weightLog: (typeof weightLog.$inferSelect)[];
  profile: (typeof profile.$inferSelect)[];
  recipes: (typeof recipes.$inferSelect)[];
  recipeItems: (typeof recipeItems.$inferSelect)[];
};

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

export function parseBackup(raw: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupFormatError('That file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BackupFormatError('That file is not a Simple Food Scanner backup.');
  }

  const backup = parsed as Partial<Backup>;
  if (backup.version !== BACKUP_VERSION) {
    throw new BackupFormatError(
      `Backup version ${String(backup.version)} is not supported by this build (expected ${BACKUP_VERSION}).`,
    );
  }
  if (!Array.isArray(backup.foods) || !Array.isArray(backup.diaryEntries)) {
    throw new BackupFormatError('That backup is missing its foods or diary entries.');
  }

  // Tables added after version 1 are absent from older files; default them to empty
  // rather than rejecting a backup that is otherwise perfectly restorable.
  return {
    version: BACKUP_VERSION,
    exportedAt: backup.exportedAt ?? new Date().toISOString(),
    foods: backup.foods,
    portions: backup.portions ?? [],
    diaryEntries: backup.diaryEntries,
    weightLog: backup.weightLog ?? [],
    profile: backup.profile ?? [],
    recipes: backup.recipes ?? [],
    recipeItems: backup.recipeItems ?? [],
  };
}
