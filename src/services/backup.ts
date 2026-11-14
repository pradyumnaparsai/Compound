import { AppState } from 'react-native';
import { getDb } from '@/data/db';
import { supabase, supabaseConfigured } from '@/data/supabase';
import { UserError } from '@/domain/errors';
import { useMealStore } from '@/store/useMealStore';
import { useMemoryStore } from '@/store/useMemoryStore';
import { usePrepStore } from '@/store/usePrepStore';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useUnitStore } from '@/store/useUnitStore';
import { useWorkoutHistory } from '@/store/useWorkoutHistory';
import { useWorkoutLibraryStore } from '@/store/useWorkoutLibraryStore';
import { useWorkoutSession } from '@/store/useWorkoutSession';
import { useWeightStore } from '@/store/useWeightStore';

// food_cache is rebuildable and intentionally excluded.
const TABLES = [
  'routines',
  'completions',
  'weights',
  'meals',
  'saved_meals',
  'meal_schedules',
  'settings',
  'tasks',
  'prep_checks',
  // Workout tracking (v10). Built-in exercises live in code, so `exercises` holds only custom ones and a
  // fresh install still counts as empty.
  'exercises',
  'workout_folders',
  'workout_templates',
  'template_exercises',
  'template_sets',
  'workouts',
  'workout_exercises',
  'workout_sets',
] as const;
const KEEP = 5;
const AUTO_MIN_INTERVAL_MS = 2 * 60_000;
// `backup_*` settings are device-local bookkeeping and never part of a snapshot.
const LOCAL_ONLY = "key NOT LIKE 'backup\\_%' ESCAPE '\\'";

type Snapshot = Record<(typeof TABLES)[number], Record<string, unknown>[]>;
export type BackupInfo = { createdAt: string; schemaVersion: number };
export type CheckResult = 'ready' | 'restore-available' | 'conflict';

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key))?.value ?? null;
}

async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

async function localVersion(): Promise<number> {
  const db = await getDb();
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

async function exportSnapshot(): Promise<Snapshot> {
  const db = await getDb();
  const out = {} as Snapshot;
  for (const t of TABLES) {
    const where = t === 'settings' ? ` WHERE ${LOCAL_ONLY}` : '';
    out[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}${where}`);
  }
  return out;
}

const isEmpty = (s: Snapshot) => TABLES.every((t) => s[t].length === 0);

export async function localIsEmpty(): Promise<boolean> {
  return isEmpty(await exportSnapshot());
}

export async function getSession() {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

async function latestBackup() {
  const { data, error } = await supabase
    .from('backups')
    .select('id, schema_version, created_at, data')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Run after sign-in. Backups stay blocked until this resolves to 'ready' or the user picks restore/keep. */
export async function checkCloud(): Promise<{ result: CheckResult; info?: BackupInfo }> {
  if ((await getSetting('backup_checked')) === '1') return { result: 'ready' };
  const latest = await latestBackup();
  if (!latest) {
    await setSetting('backup_checked', '1');
    return { result: 'ready' };
  }
  const info = { createdAt: latest.created_at as string, schemaVersion: latest.schema_version as number };
  return { result: (await localIsEmpty()) ? 'restore-available' : 'conflict', info };
}

/** User chose to keep this device's data over the cloud copy. */
export async function keepLocal() {
  await setSetting('backup_checked', '1');
}

export async function backupNow(): Promise<void> {
  if ((await getSetting('backup_checked')) !== '1') throw new UserError('Resolve the cloud check first.');
  const snap = await exportSnapshot();
  if (isEmpty(snap)) throw new UserError('Nothing to back up (local data is empty).');
  const { error } = await supabase.from('backups').insert({ schema_version: await localVersion(), data: snap });
  if (error) throw error;
  await setSetting('backup_last_at', new Date().toISOString());

  const { data: old } = await supabase
    .from('backups')
    .select('id')
    .order('created_at', { ascending: false })
    .range(KEEP, KEEP + 50);
  if (old?.length) await supabase.from('backups').delete().in('id', old.map((r) => r.id));
}

export async function lastBackupAt(): Promise<string | null> {
  return getSetting('backup_last_at');
}

export async function restoreLatest(): Promise<void> {
  const latest = await latestBackup();
  if (!latest) throw new UserError('No cloud backup found.');
  if ((latest.schema_version as number) > (await localVersion())) {
    throw new UserError('Backup is from a newer app version. Update the app first.');
  }
  const snap = latest.data as Snapshot;
  if (!snap) throw new UserError('Backup is empty or malformed; local data left untouched.');
  for (const t of TABLES) snap[t] ??= [];
  if (TABLES.some((t) => !Array.isArray(snap[t])) || isEmpty(snap)) {
    throw new UserError('Backup is empty or malformed; local data left untouched.');
  }

  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const t of TABLES) {
      const cols = (await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
      await tx.runAsync(t === 'settings' ? `DELETE FROM settings WHERE ${LOCAL_ONLY}` : `DELETE FROM ${t}`);
      for (const row of snap[t]) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (!keys.length) continue;
        await tx.runAsync(
          `INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k] as string | number | null),
        );
      }
    }
  });
  await setSetting('backup_checked', '1');
  await setSetting('backup_last_at', new Date().toISOString());
  await Promise.all([
    useRoutineStore.getState().load(),
    useWeightStore.getState().load(),
    useMealStore.getState().load(),
    useTaskStore.getState().load(),
    usePrepStore.getState().load(),
    useUnitStore.getState().load(),
    useMemoryStore.getState().load(),
    useWorkoutLibraryStore.getState().load(),
    useWorkoutHistory.getState().load(),
    useWorkoutSession.getState().load(),
  ]);
}

/** Back up whenever the app goes to background (throttled). Returns an unsubscribe function. */
export function startAutoBackup(): () => void {
  let last = 0;
  const sub = AppState.addEventListener('change', async (s) => {
    // 'inactive' can be the last state before the app is killed from the switcher, so it still counts; the claim
    // below (and the 2 min throttle) stops the usual inactive -> background pair from backing up twice.
    if (s === 'active' || Date.now() - last < AUTO_MIN_INTERVAL_MS) return;
    last = Date.now(); // claim the slot before any await so two quick events can't both start a backup
    try {
      if (!(await getSession()) || (await getSetting('backup_checked')) !== '1') return;
      await backupNow();
    } catch (e) {
      console.warn('Auto backup failed', e);
    }
  });
  return () => sub.remove();
}
