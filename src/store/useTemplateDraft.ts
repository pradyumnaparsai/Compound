import { create } from 'zustand';
import { newId } from '@/domain/id';
import { emptyTemplateSet, newTemplateExercise } from '@/domain/template';
import {
  linkWithNext,
  normalizeSupersets,
  renumber,
  unlinkExercise,
  type SetType,
  type TemplateExercise,
  type TemplateSet,
  type WorkoutTemplate,
} from '@/domain/workout';

/** The template being edited; shared between the builder and the exercise picker. */
type State = {
  draft: WorkoutTemplate | null;
  /** JSON of the draft as first opened, to tell whether anything changed. */
  initial: string | null;
  start: (t: WorkoutTemplate | null, position: number, folderId?: string | null) => void;
  clear: () => void;
  setMeta: (patch: Partial<Pick<WorkoutTemplate, 'title' | 'notes' | 'folderId'>>) => void;
  addExercises: (ids: string[]) => void;
  removeExercise: (exId: string) => void;
  reorderExercises: (ids: string[]) => void;
  patchExercise: (exId: string, patch: Partial<Pick<TemplateExercise, 'restSeconds' | 'notes' | 'notesPinned'>>) => void;
  linkNext: (exId: string) => void;
  unlink: (exId: string) => void;
  addSet: (exId: string) => void;
  removeSet: (exId: string, setId: string) => void;
  patchSet: (exId: string, setId: string, patch: Partial<Omit<TemplateSet, 'id' | 'index'>>) => void;
  cycleSetType: (exId: string, setId: string) => void;
};

const NEXT_TYPE: Record<SetType, SetType> = { normal: 'warmup', warmup: 'dropset', dropset: 'failure', failure: 'normal' };

export const useTemplateDraft = create<State>((set, get) => {
  const edit = (fn: (exercises: TemplateExercise[]) => TemplateExercise[]) => {
    const d = get().draft;
    if (d) set({ draft: { ...d, exercises: renumber(fn(d.exercises)) } });
  };
  const mapEx = (exId: string, fn: (e: TemplateExercise) => TemplateExercise) =>
    edit((list) => list.map((e) => (e.id === exId ? fn(e) : e)));

  return {
    draft: null,
    initial: null,
    start: (t, position, folderId = null) => {
      const draft = t ?? { id: newId(), title: '', notes: '', folderId, position, exercises: [] };
      set({ draft, initial: JSON.stringify(draft) });
    },
    clear: () => set({ draft: null, initial: null }),
    setMeta: (patch) => {
      const d = get().draft;
      if (d) set({ draft: { ...d, ...patch } });
    },
    addExercises: (ids) =>
      edit((list) => [...list, ...ids.map((id, i) => newTemplateExercise(newId(), newId(), id, list.length + i))]),
    removeExercise: (exId) => edit((list) => normalizeSupersets(list.filter((e) => e.id !== exId))),
    reorderExercises: (ids) =>
      edit((list) => normalizeSupersets(ids.map((id) => list.find((e) => e.id === id)).filter((e): e is TemplateExercise => !!e))),
    patchExercise: (exId, patch) => mapEx(exId, (e) => ({ ...e, ...patch })),
    linkNext: (exId) => edit((list) => linkWithNext(list, list.findIndex((e) => e.id === exId), newId)),
    unlink: (exId) => edit((list) => unlinkExercise(list, list.findIndex((e) => e.id === exId))),
    addSet: (exId) =>
      mapEx(exId, (e) => {
        const last = e.sets[e.sets.length - 1];
        // New set starts as a copy of the last one's targets (type "normal" so a warm-up isn't repeated).
        const next = { ...(last ?? emptyTemplateSet('', 0)), id: newId(), index: e.sets.length, setType: 'normal' as SetType };
        return { ...e, sets: [...e.sets, next] };
      }),
    removeSet: (exId, setId) => mapEx(exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) })),
    patchSet: (exId, setId, patch) =>
      mapEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })),
    cycleSetType: (exId, setId) =>
      mapEx(exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, setType: NEXT_TYPE[s.setType] } : s)) })),
  };
});
