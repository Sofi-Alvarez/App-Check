// Operaciones de día y de agenda completa sobre el modelo v2: armar los bloques de un día, dejar un día exactamente
// como una lista (lo usa el margen de tiempo), restaurar la plantilla inicial y borrar toda la agenda. Funciones puras.

import { JOB_SEARCH_TEMPLATE } from '../domain/templates';
import { instantiateTemplate, weekStarts } from '../domain/templates/apply';
import { buildDay, occursOn } from '../domain/recurrence';
import type { AgendaState, ExceptionFields, Series, SeriesException } from '../domain/types';
import type { EngineBlock } from './types';

/** Id original de una serie separada por la migración (o el propio id). El registro histórico usa el original. */
export const legacyOf = (state: AgendaState, id: string) => state.legacyBid[id] ?? id;

export function toEngineBlocks(state: AgendaState, date: string): EngineBlock[] {
  const rem = new Map(state.series.map((x) => [x.id, x.reminder]));
  return buildDay(state, date).map(({ id, s, e, t, c, n }) => {
    const r = rem.get(id);
    return r ? { id, s, e, t, c, n, rem: r } : { id, s, e, t, c, n };
  });
}

/** Tareas de `list` que se pisan con el rango [s, e), sin contar la propia. */
export function overlaps<T extends { id: string; s: number; e: number }>(list: T[], s: number, e: number, selfId: string | null): T[] {
  return list.filter((b) => b.id !== selfId && b.s < e && s < b.e);
}

// ---- Cambios de un día ---------------------------------------------------------------------------------------------

const diffFields = (s: Series, b: EngineBlock): ExceptionFields => {
  const f: ExceptionFields = {};
  if (b.s !== s.startMin) f.startMin = b.s;
  if (b.e !== s.endMin) f.endMin = b.e;
  if (b.t !== s.title) f.title = b.t;
  if (b.c !== s.categoryId) f.categoryId = b.c;
  if (b.n !== s.note) f.note = b.n;
  return f;
};

/**
 * Deja el día `date` exactamente como `list` (equivale a la edición "Solo hoy" de la v1, que guardaba la lista completa
 * del día). Calcula las excepciones contra cada serie, edita o quita los eventos de un día y crea los nuevos.
 */
export function applyDayList(state: AgendaState, date: string, list: EngineBlock[]): AgendaState {
  const remaining = [...list];
  const take = (id: string) => {
    const i = remaining.findIndex((b) => b.id === id);
    return i < 0 ? null : remaining.splice(i, 1)[0];
  };
  const series: Series[] = [];
  const dayEx: SeriesException[] = [];
  for (const s of state.series) {
    if (!s.archived && s.rule === null && s.startDate === date) {
      const b = take(s.id);
      if (b) series.push({ ...s, title: b.t, categoryId: b.c, startMin: b.s, endMin: b.e, note: b.n });
      continue; // si no está en la lista, el evento de un día se elimina
    }
    series.push(s);
    if (!occursOn(s, date)) continue;
    const b = take(s.id);
    if (!b) {
      dayEx.push({ seriesId: s.id, date, kind: 'cancelled' });
      continue;
    }
    const fields = diffFields(s, b);
    if (Object.keys(fields).length) dayEx.push({ seriesId: s.id, date, kind: 'modified', fields });
  }
  const taken = new Set(series.map((s) => s.id));
  const legacyBid = { ...state.legacyBid };
  for (const b of remaining) {
    let id = b.id;
    if (taken.has(id)) {
      let n = 1;
      id = `${b.id}@${date}`;
      while (taken.has(id)) id = `${b.id}@${date}-${++n}`;
      legacyBid[id] = legacyOf(state, b.id);
    }
    taken.add(id);
    series.push({
      id, title: b.t, categoryId: b.c, startMin: b.s, endMin: b.e, note: b.n, rule: null, startDate: date, endDate: null,
      reminder: null, archived: false,
    });
  }
  const live = new Set(series.map((s) => s.id));
  return {
    ...state,
    series,
    exceptions: [...state.exceptions.filter((x) => x.date !== date && live.has(x.seriesId)), ...dayEx],
    legacyBid: Object.fromEntries(Object.entries(legacyBid).filter(([k]) => live.has(k))),
  };
}

// ---- Restaurar la plantilla y borrar todo ---------------------------------------------------------------------------

/**
 * Vuelve a la plantilla inicial (spec 009, 7.4): las series de la plantilla con sus ids de siempre, para que el registro
 * histórico se siga uniendo; sin excepciones ni eventos de un día. Conserva categorías y metas, y vuelve a agregar (o
 * reactiva) las categorías que usa la plantilla si se habían eliminado o archivado. `anchor` es un martes de una semana
 * "A" de la alternancia de los martes.
 */
export function restoreTemplateState(state: AgendaState, anchor: string, today: string): AgendaState {
  const recurring = state.series.filter((s) => s.rule !== null && !s.archived).map((s) => s.startDate);
  const earliest = recurring.length ? recurring.reduce((a, b) => (b < a ? b : a)) : today;
  const t = instantiateTemplate(JOB_SEARCH_TEMPLATE, weekStarts(earliest, anchor), today);
  const ids = new Set(t.series.map((s) => s.id));
  const used = new Set(t.series.map((s) => s.categoryId));
  const missing = t.categories.filter((c) => used.has(c.id) && !state.categories.some((x) => x.id === c.id));
  return {
    ...state,
    categories: [
      ...state.categories.map((c) => (used.has(c.id) && c.archived ? { ...c, archived: false } : c)),
      ...missing,
    ],
    series: t.series,
    exceptions: [],
    legacyBid: {},
    goals: state.goals.map((g) => ({ ...g, links: g.links.filter((l) => ids.has(l)) })),
  };
}

/** Categoría que queda al borrar toda la agenda, para poder seguir creando eventos. */
export const GENERAL_CATEGORY = {
  id: 'general', name: 'General', color: 'blue' as const, movable: true, tracked: true, marginPreference: 'normal' as const, archived: false,
};

/**
 * Borra toda la agenda (spec 009, 7.4): eventos, categorías y metas. Queda solo la categoría "General". El registro de
 * uso y los conteos por día no están en este estado y no se tocan.
 */
export function clearAgenda(): AgendaState {
  return { categories: [{ ...GENERAL_CATEGORY }], series: [], exceptions: [], goals: [], legacyBid: {} };
}

