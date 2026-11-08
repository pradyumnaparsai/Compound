import { create } from 'zustand';
import type { ExerciseRepository, WorkoutFolderRepository, WorkoutTemplateRepository } from '@/data/repository';
import { sqliteExerciseRepo, sqliteWorkoutFolderRepo, sqliteWorkoutTemplateRepo } from '@/data/sqliteWorkoutRepository';
import { newId } from '@/domain/id';
import { duplicateTemplate, reorderSubset } from '@/domain/template';
import type { ExerciseDef, WorkoutFolder, WorkoutTemplate } from '@/domain/workout';

const exerciseRepo: ExerciseRepository = sqliteExerciseRepo;
const folderRepo: WorkoutFolderRepository = sqliteWorkoutFolderRepo;
const templateRepo: WorkoutTemplateRepository = sqliteWorkoutTemplateRepo;

type State = {
  ready: boolean;
  /** Custom / imported exercises only; combine with the built-in catalog via `allExercises`. */
  customs: ExerciseDef[];
  folders: WorkoutFolder[];
  templates: WorkoutTemplate[];
  load: () => Promise<void>;

  addExercise: (e: ExerciseDef) => Promise<void>;
  updateExercise: (e: ExerciseDef) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;

  addFolder: (title: string) => Promise<WorkoutFolder>;
  renameFolder: (id: string, title: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;
  moveFolder: (id: string, dir: -1 | 1) => Promise<void>;

  saveTemplate: (t: WorkoutTemplate) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  /** `visibleIds` = a subset of templates (e.g. one folder) in their new order; others keep their slots. */
  reorderTemplates: (visibleIds: string[]) => Promise<void>;
};

export const useWorkoutLibraryStore = create<State>((set, get) => ({
  ready: false,
  customs: [],
  folders: [],
  templates: [],

  async load() {
    const [customs, folders, templates] = await Promise.all([exerciseRepo.list(), folderRepo.list(), templateRepo.list()]);
    set({ customs, folders, templates, ready: true });
  },

  async addExercise(e) {
    await exerciseRepo.add(e);
    set({ customs: [...get().customs, e] });
  },
  async updateExercise(e) {
    await exerciseRepo.update(e);
    set({ customs: get().customs.map((c) => (c.id === e.id ? e : c)) });
  },
  async removeExercise(id) {
    await exerciseRepo.remove(id);
    set({ customs: get().customs.filter((c) => c.id !== id) });
  },

  async addFolder(title) {
    const folder: WorkoutFolder = { id: newId(), title: title.trim(), position: get().folders.length };
    await folderRepo.add(folder);
    set({ folders: [...get().folders, folder] });
    return folder;
  },
  async renameFolder(id, title) {
    await folderRepo.rename(id, title.trim());
    set({ folders: get().folders.map((f) => (f.id === id ? { ...f, title: title.trim() } : f)) });
  },
  async removeFolder(id) {
    await folderRepo.remove(id);
    set({
      folders: get().folders.filter((f) => f.id !== id),
      templates: get().templates.map((t) => (t.folderId === id ? { ...t, folderId: null } : t)),
    });
  },
  async moveFolder(id, dir) {
    const list = [...get().folders];
    const i = list.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const next = list.map((f, n) => ({ ...f, position: n }));
    set({ folders: next });
    try {
      await folderRepo.reorder(next.map((f) => f.id));
    } catch (e) {
      await get().load();
      throw e;
    }
  },

  async saveTemplate(t) {
    await templateRepo.save(t);
    const exists = get().templates.some((x) => x.id === t.id);
    set({ templates: exists ? get().templates.map((x) => (x.id === t.id ? t : x)) : [...get().templates, t] });
  },
  async removeTemplate(id) {
    await templateRepo.remove(id);
    set({ templates: get().templates.filter((t) => t.id !== id) });
  },
  async duplicate(id) {
    const src = get().templates.find((t) => t.id === id);
    if (!src) return;
    await get().saveTemplate(duplicateTemplate(src, newId, get().templates.length));
  },
  async reorderTemplates(visibleIds) {
    const next = reorderSubset(get().templates, visibleIds).map((t, i) => ({ ...t, position: i }));
    set({ templates: next }); // optimistic
    try {
      await templateRepo.reorder(next.map((t) => t.id));
    } catch (e) {
      await get().load();
      throw e;
    }
  },
}));
