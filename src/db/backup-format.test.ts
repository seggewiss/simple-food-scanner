import { describe, expect, it } from 'vitest';

import { BACKUP_VERSION, BackupFormatError, parseBackup } from './backup-format';

const minimal = JSON.stringify({
  version: BACKUP_VERSION,
  exportedAt: '2026-08-11T00:00:00.000Z',
  foods: [],
  diaryEntries: [],
});

describe('parseBackup', () => {
  it('accepts a minimal well-formed backup', () => {
    const backup = parseBackup(minimal);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe('2026-08-11T00:00:00.000Z');
  });

  it('defaults tables that a future or older export may omit', () => {
    const backup = parseBackup(minimal);
    expect(backup.portions).toEqual([]);
    expect(backup.weightLog).toEqual([]);
    expect(backup.profile).toEqual([]);
    expect(backup.recipes).toEqual([]);
    expect(backup.recipeItems).toEqual([]);
  });

  it('rejects malformed JSON with a message a user can act on', () => {
    expect(() => parseBackup('{not json')).toThrow(BackupFormatError);
    expect(() => parseBackup('{not json')).toThrow(/not valid JSON/);
  });

  it('rejects JSON that is not an object', () => {
    expect(() => parseBackup('[]')).toThrow(BackupFormatError);
    expect(() => parseBackup('"hello"')).toThrow(BackupFormatError);
    expect(() => parseBackup('null')).toThrow(BackupFormatError);
  });

  it('rejects an unsupported version rather than importing it blind', () => {
    const future = JSON.stringify({ version: 99, foods: [], diaryEntries: [] });
    expect(() => parseBackup(future)).toThrow(/version 99 is not supported/);
  });

  it('rejects a backup missing its core tables', () => {
    const broken = JSON.stringify({ version: BACKUP_VERSION, foods: [] });
    expect(() => parseBackup(broken)).toThrow(/missing its foods or diary entries/);
  });
});
