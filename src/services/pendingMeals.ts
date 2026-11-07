import { Directory, File, Paths } from 'expo-file-system';
import type { MealSlot } from '@/domain/meal';

/**
 * Photos whose AI analysis hasn't succeeded yet (503s, rate limits, offline, app killed mid-request).
 * Stored in the app's document directory as `<id>.jpg` + `<id>.json`, deleted once analysed.
 */
export type PendingMeta = { note: string; slot: MealSlot; date: string; mimeType: string; createdAt: string };
export type PendingMeal = PendingMeta & { id: string; uri: string };

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function dir(): Directory {
  const d = new Directory(Paths.document, 'pending-meals');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

const imgFile = (id: string) => new File(dir(), `${id}.jpg`);
const metaFile = (id: string) => new File(dir(), `${id}.json`);

/** Copies the photo into durable storage. Call before analysing so a kill/crash can't lose it. */
export function savePending(photoUri: string, meta: Omit<PendingMeta, 'createdAt'>): PendingMeal {
  const id = newId();
  const img = imgFile(id);
  new File(photoUri).copySync(img);
  const full: PendingMeta = { ...meta, createdAt: new Date().toISOString() };
  const m = metaFile(id);
  m.create({ overwrite: true });
  m.writeSync(JSON.stringify(full));
  return { id, uri: img.uri, ...full };
}

export function deletePending(id: string): void {
  for (const f of [imgFile(id), metaFile(id)]) {
    try {
      if (f.exists) f.delete();
    } catch {}
  }
}

/** Newest first. Also prunes entries older than 14 days and orphaned files. */
export function listPending(): PendingMeal[] {
  const out: PendingMeal[] = [];
  try {
    const entries = dir().list();
    const ids = new Set(entries.filter((e): e is File => e instanceof File).map((f) => f.name.replace(/\.(jpg|json)$/, '')));
    for (const id of ids) {
      try {
        const img = imgFile(id);
        const m = metaFile(id);
        if (!img.exists || !m.exists) {
          deletePending(id);
          continue;
        }
        const meta = JSON.parse(m.textSync()) as PendingMeta;
        if (Date.now() - new Date(meta.createdAt).getTime() > MAX_AGE_MS) {
          deletePending(id);
          continue;
        }
        out.push({ id, uri: img.uri, ...meta });
      } catch {
        deletePending(id);
      }
    }
  } catch {}
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const pendingBase64 = (uri: string): Promise<string> => new File(uri).base64();
