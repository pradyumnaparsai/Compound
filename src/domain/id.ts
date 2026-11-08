/** Short, sortable-ish unique id (same scheme the rest of the app already uses). */
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
