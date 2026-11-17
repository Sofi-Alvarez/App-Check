// Traducción de las operaciones de las pantallas actuales ("Solo hoy", "Siempre" con tipos de día, margen, restaurar,
// mover los martes) al modelo v2. Funciones puras sobre `AgendaState`. Transitorio: la fase 3 reemplaza estas
// operaciones por las de la spec 009 (alcances "Solo hoy", "A partir de hoy" y "Siempre" sobre series).

import { Block, DayType, LIST_KEYS, defaultBlocks } from '../agenda';
import { addDaysISO, mondayNumber, weekdayOf } from '../domain/dates';
import { buildDay, occursOn } from '../domain/recurrence';
import type { AgendaState, ExceptionFields, Series, SeriesException } from '../domain/types';
import { seriesFromLists, seriesStarts } from '../migration/v1-to-v2';
import type { EngineBlock } from './types';

export const DEFAULT_TUE_ANCHOR = '2026-11-03';

/** Tipo de día del vocabulario actual, igual que `dayType()` de `agenda.ts` pero con la fecha en texto. */
export function dayKindOf(date: string, anchor: string): DayType | null {
  const wd = weekdayOf(date);
  if (wd === 1 || wd === 3) return 'mwf';
  if (wd === 5) return 'fri';
  if (wd === 4) return 'thu';
  if (wd === 2) {
    const weeks = (mondayNumber(date) - mondayNumber(anchor)) / 7;
    return ((weeks % 2) + 2) % 2 === 0 ? 'tueAds' : 'tueOff';
  }
  return null;
}

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

export const newTaskId = () => `u-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

const isRecurring = (s: Series) => s.rule !== null && !s.archived;

// ---- Listas por tipo de día ↔ series -----------------------------------------------------------------------------

/**
 * Listas por tipo de día que equivalen a las series que se repiten. Cada bloque lleva el id original (raíz) para que
 * las variantes de una misma tarea se reconozcan. Las series que no se pueden expresar como listas (no existen hasta
 * la fase 3) quedan en `unmapped`.
 */
export function listsFromSeries(state: AgendaState, anchor: string): { lists: Record<DayType, Block[]>; unmapped: string[] } {
  const lists = Object.fromEntries(LIST_KEYS.map((k) => [k, [] as Block[]])) as Record<DayType, Block[]>;
  const unmapped: string[] = [];
  for (const s of state.series.filter(isRecurring)) {
    const { weekdays, everyWeeks } = s.rule!;
    const keys: DayType[] = [];
    let mappable = true;
    if (everyWeeks === 2) {
      // Cada dos semanas solo existe para los martes alternos.
      if (weekdays.length === 1 && weekdays[0] === 2) keys.push(dayKindOf(addDaysISO(fromMonday(s.startDate), 1), anchor)!);
      else mappable = false;
    } else if (everyWeeks === 1) {
      const days = new Set(weekdays);
      if (days.has(1) && days.has(3)) {
        keys.push('mwf');
        days.delete(1);
        days.delete(3);
      }
      if (days.delete(2)) keys.push('tueAds', 'tueOff');
      if (days.delete(4)) keys.push('thu');
      if (days.delete(5)) keys.push('fri');
      if (days.size > 0) mappable = false; // lunes sin miércoles, fin de semana, etc.
    } else {
      mappable = false;
    }
    if (!mappable) {
      unmapped.push(s.id);
      continue;
    }
    const block: Block = { id: legacyOf(state, s.id), s: s.startMin, e: s.endMin, t: s.title, c: s.categoryId as Block['c'], n: s.note };
    for (const k of keys) lists[k].push(block);
  }
  for (const k of LIST_KEYS) lists[k].sort((a, b) => a.s - b.s || a.e - b.e);
  return { lists, unmapped };
}

/** Lunes de la semana de una fecha, como texto. */
function fromMonday(date: string): string {
  return addDaysISO(date, -((weekdayOf(date) + 6) % 7));
}

/** Inicios de las series para reconstruir: desde la serie más antigua (o desde hoy si no hay ninguna). */
export function globalStarts(state: AgendaState, anchor: string, today: string) {
  const starts = state.series.filter(isRecurring).map((s) => s.startDate);
  const earliest = starts.length ? starts.reduce((a, b) => (b < a ? b : a)) : today;
  return seriesStarts(earliest, anchor);
}

/**
 * Reemplaza las series que se repiten de una tarea (`root`, con todas sus variantes) por las que salen de `lists`.
 * Conserva las excepciones de los ids que siguen existiendo; las de ids que desaparecen se quitan.
 */
export function rebuildRoot(state: AgendaState, root: string, lists: Record<DayType, Block[]>, anchor: string, today: string): AgendaState {
  const only = Object.fromEntries(LIST_KEYS.map((k) => [k, lists[k].filter((b) => b.id === root)])) as Record<DayType, Block[]>;
  const built = seriesFromLists(only, globalStarts(state, anchor, today));
  const oldIds = new Set(state.series.filter((s) => isRecurring(s) && legacyOf(state, s.id) === root).map((s) => s.id));

  let series = state.series.filter((s) => !oldIds.has(s.id));
  const legacyBid: Record<string, string> = Object.fromEntries(Object.entries(state.legacyBid).filter(([k]) => !oldIds.has(k)));

  // Un evento de un día con el mismo id que la serie nueva se renombra para que los ids no se repitan.
  const newIds = new Set(built.series.map((s) => s.id));
  let exceptions = state.exceptions;
  series = series.map((s) => {
    if (!newIds.has(s.id)) return s;
    const renamed = `${s.id}@${s.startDate}`;
    legacyBid[renamed] = legacyOf(state, s.id);
    exceptions = exceptions.map((x) => (x.seriesId === s.id ? { ...x, seriesId: renamed } : x));
    return { ...s, id: renamed };
  });

  const kept = new Set(built.series.map((s) => s.id));
  exceptions = exceptions.filter((x) => !oldIds.has(x.seriesId) || kept.has(x.seriesId));
  // Las series que siguen existiendo conservan sus excepciones; si una serie conserva su id pero cambia de días, las
  // excepciones de días donde ya no ocurre simplemente dejan de aplicarse.
  return {
    ...state,
    series: [...series, ...built.series],
    exceptions,
    legacyBid: { ...legacyBid, ...built.legacyBid },
  };
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

// ---- Restaurar y mover los martes --------------------------------------------------------------------------------

/** Vuelve a la agenda original: series desde `defaultBlocks()`, sin excepciones ni eventos de un día. */
export function restoreDefaults(state: AgendaState, anchor: string, today: string): AgendaState {
  const lists = Object.fromEntries(LIST_KEYS.map((k) => [k, defaultBlocks(k)])) as Record<DayType, Block[]>;
  const built = seriesFromLists(lists, globalStarts(state, anchor, today));
  const ids = new Set(built.series.map((s) => s.id));
  return {
    ...state,
    series: built.series,
    exceptions: [],
    legacyBid: built.legacyBid,
    goals: state.goals.map((g) => ({ ...g, links: g.links.filter((l) => ids.has(l)) })),
  };
}

/**
 * Invierte la alternancia de los martes: las series de cada dos semanas empiezan una semana antes, así ocurren en las
 * semanas que antes eran de la otra paridad (equivale a mover el ancla de la v1 una semana).
 */
export function flipTuesdays(state: AgendaState): AgendaState {
  return {
    ...state,
    series: state.series.map((s) => (s.rule && s.rule.everyWeeks === 2 ? { ...s, startDate: addDaysISO(s.startDate, -7) } : s)),
  };
}
