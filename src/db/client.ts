import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'simple-food-scanner.db';

const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

// Foreign keys are off by default in SQLite, which would quietly let the `references()`
// constraints in the schema do nothing.
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
export { expoDb };
