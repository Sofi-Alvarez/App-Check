// Categorías iniciales (spec 010, 3.1). Conservan los ids de la v1 para que el registro histórico siga uniéndose.
// El comportamiento que antes dependía del nombre (`fixed`, `rest`) pasa a ser propiedades.

import type { AgendaState, Category, ColorToken } from './types';

/** Las 8 categorías de la v1, en el orden de la leyenda actual (con "Cierre" al final). */
export const LEGACY_CATEGORY_IDS = ['work', 'content', 'project', 'health', 'english', 'fixed', 'rest', 'close'] as const;
export type LegacyCategoryId = (typeof LEGACY_CATEGORY_IDS)[number];

/** Nombres de las categorías de la rutina inicial. */
const NAMES: Record<LegacyCategoryId, string> = {
  work: 'Búsqueda', content: 'Contenido', project: 'Proyecto', health: 'Ejercicio', english: 'Inglés',
  fixed: 'Fijo o viaje', rest: 'Pausa o comida', close: 'Cierre del día',
};

/** Mismo color que hoy en `theme.ts` (work y close comparten azul). */
const COLORS: Record<LegacyCategoryId, ColorToken> = {
  work: 'blue', content: 'pink', project: 'teal', health: 'green', english: 'amber', fixed: 'slate', rest: 'gray',
  close: 'blue',
};

/**
 * Equivalencias de la tabla de 3.1:
 * - `fixed`: no se mueve con el margen y no ofrece Empezar.
 * - `rest`: se mueve, no ofrece Empezar, y se evita como destino del margen.
 * - el resto (incluido `close`): se mueve y ofrece Empezar.
 */
export function legacyCategory(id: LegacyCategoryId): Category {
  return {
    id,
    name: NAMES[id],
    color: COLORS[id],
    movable: id !== 'fixed',
    tracked: id !== 'fixed' && id !== 'rest',
    marginPreference: id === 'rest' ? 'avoid' : 'normal',
    archived: false,
  };
}

export const SEED_CATEGORIES: readonly Category[] = LEGACY_CATEGORY_IDS.map(legacyCategory);

export const isLegacyCategoryId = (id: string): id is LegacyCategoryId =>
  (LEGACY_CATEGORY_IDS as readonly string[]).includes(id);

/**
 * Categoría para un id que no se conoce (por ejemplo, un dato raro en la agenda guardada). Se crea visible y con el
 * comportamiento más común, para no perder el bloque; el nombre es el propio id para que se note y se pueda corregir.
 */
export function unknownCategory(id: string): Category {
  return { id, name: id, color: 'gray', movable: true, tracked: true, marginPreference: 'normal', archived: false };
}

/** Busca una categoría por id. Si no existe, devuelve una de reemplazo (nunca falla al mostrar un evento). */
export function categoryById(categories: readonly Category[], id: string): Category {
  return categories.find((c) => c.id === id) ?? unknownCategory(id);
}

/** Paleta cerrada, en el orden en que se ofrece. */
export const COLOR_TOKENS: readonly ColorToken[] = ['blue', 'pink', 'teal', 'green', 'amber', 'slate', 'gray'];

export interface NewCategory {
  name: string;
  color: ColorToken;
  movable: boolean;
  tracked: boolean;
  marginPreference: 'normal' | 'avoid';
}

export type CategoryError = 'name-empty' | 'name-too-long' | 'name-taken';

let counter = 0;
export const newCategoryId = () => `c-${Date.now().toString(36)}${(counter++ % 1296).toString(36)}`;

/** Crea una categoría (spec 009, sección 4): nombre obligatorio, de hasta 30 caracteres y único sin distinguir mayúsculas. */
export function createCategory(
  st: AgendaState, input: NewCategory, id: string = newCategoryId(),
): { ok: true; state: AgendaState; id: string } | { ok: false; error: CategoryError } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'name-empty' };
  if (name.length > 30) return { ok: false, error: 'name-too-long' };
  const key = name.toLowerCase();
  if (st.categories.some((c) => !c.archived && c.name.trim().toLowerCase() === key)) return { ok: false, error: 'name-taken' };
  const c: Category = { id, name, color: input.color, movable: input.movable, tracked: input.tracked, marginPreference: input.marginPreference, archived: false };
  return { ok: true, state: { ...st, categories: [...st.categories, c] }, id };
}

// ---- Gestión (spec 009, sección 4; T4.1) --------------------------------------------------------------------------

export type CategoryOpError =
  | { kind: 'not-found' }
  | { kind: 'name'; error: CategoryError }
  | { kind: 'in-use'; events: number }
  | { kind: 'last-category' }
  | { kind: 'bad-target' };

export type CategoryOpResult = { ok: true; state: AgendaState; id: string } | { ok: false; error: CategoryOpError };

/** Cantidad de eventos que usan la categoría: series (no archivadas) más días con un cambio propio a esa categoría. */
export function categoryUsage(st: AgendaState, id: string): number {
  const series = st.series.filter((s) => !s.archived && s.categoryId === id).length;
  const days = st.exceptions.filter((x) => x.kind === 'modified' && x.fields.categoryId === id).length;
  return series + days;
}

const activeCount = (st: AgendaState) => st.categories.filter((c) => !c.archived).length;

function nameError(st: AgendaState, name: string, selfId: string | null): CategoryError | null {
  const n = name.trim();
  if (!n) return 'name-empty';
  if (n.length > 30) return 'name-too-long';
  const key = n.toLowerCase();
  return st.categories.some((c) => c.id !== selfId && !c.archived && c.name.trim().toLowerCase() === key) ? 'name-taken' : null;
}

/**
 * Edita una categoría. Cambiar el nombre se ve en todos sus eventos (la referencia es por id); el registro conserva el
 * nombre anterior (`catName`). Cambiar una propiedad afecta a todos sus eventos de inmediato.
 */
export function updateCategory(st: AgendaState, id: string, input: NewCategory): CategoryOpResult {
  const cur = st.categories.find((c) => c.id === id);
  if (!cur) return { ok: false, error: { kind: 'not-found' } };
  const err = nameError(st, input.name, id);
  if (err) return { ok: false, error: { kind: 'name', error: err } };
  const next: Category = { ...cur, name: input.name.trim(), color: input.color, movable: input.movable, tracked: input.tracked, marginPreference: input.marginPreference };
  return { ok: true, id, state: { ...st, categories: st.categories.map((c) => (c.id === id ? next : c)) } };
}

/** Archiva (deja de ofrecerse; sus eventos la conservan) o reactiva una categoría. No se puede archivar la última activa. */
export function setCategoryArchived(st: AgendaState, id: string, archived: boolean): CategoryOpResult {
  const cur = st.categories.find((c) => c.id === id);
  if (!cur) return { ok: false, error: { kind: 'not-found' } };
  if (archived && !cur.archived && activeCount(st) <= 1) return { ok: false, error: { kind: 'last-category' } };
  if (!archived) {
    const err = nameError(st, cur.name, id);
    if (err) return { ok: false, error: { kind: 'name', error: err } };
  }
  return { ok: true, id, state: { ...st, categories: st.categories.map((c) => (c.id === id ? { ...c, archived } : c)) } };
}

/**
 * Elimina una categoría (CG-19, CG-20). Si la usan eventos, solo se puede eliminar reasignándolos a otra categoría
 * activa (`reassignTo`): se cambia en las series y en los cambios propios de cada día.
 */
export function deleteCategory(st: AgendaState, id: string, reassignTo: string | null = null): CategoryOpResult {
  const cur = st.categories.find((c) => c.id === id);
  if (!cur) return { ok: false, error: { kind: 'not-found' } };
  if (!cur.archived && activeCount(st) <= 1) return { ok: false, error: { kind: 'last-category' } };
  const used = categoryUsage(st, id) + st.series.filter((s) => s.archived && s.categoryId === id).length;
  if (used > 0 && reassignTo === null) return { ok: false, error: { kind: 'in-use', events: categoryUsage(st, id) } };
  if (reassignTo !== null && (reassignTo === id || !st.categories.some((c) => c.id === reassignTo && !c.archived))) {
    return { ok: false, error: { kind: 'bad-target' } };
  }
  const to = reassignTo ?? id;
  return {
    ok: true,
    id,
    state: {
      ...st,
      categories: st.categories.filter((c) => c.id !== id),
      series: st.series.map((s) => (s.categoryId === id ? { ...s, categoryId: to } : s)),
      exceptions: st.exceptions.map((x) =>
        x.kind === 'modified' && x.fields.categoryId === id ? { ...x, fields: { ...x.fields, categoryId: to } } : x),
    },
  };
}
