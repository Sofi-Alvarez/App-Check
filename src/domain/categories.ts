// Categorías iniciales (spec 010, 3.1). Conservan los ids de la v1 para que el registro histórico siga uniéndose.
// El comportamiento que antes dependía del nombre (`fixed`, `rest`) pasa a ser propiedades.

import type { AgendaState, Category, ColorToken } from './types';

/** Las 8 categorías de la v1, en el orden de la leyenda actual (con "Cierre" al final). */
export const LEGACY_CATEGORY_IDS = ['work', 'content', 'project', 'health', 'english', 'fixed', 'rest', 'close'] as const;
export type LegacyCategoryId = (typeof LEGACY_CATEGORY_IDS)[number];

/** Nombres de la leyenda actual (`LEGEND` en `agenda.ts`). "Cierre" no estaba en la leyenda. */
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
