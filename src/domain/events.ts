// Gestión de eventos con alcance (spec 009, secciones 3.4 y 3.5; T3.1). Funciones puras sobre `AgendaState`.
//
// Alcances: "Solo hoy" (`today`), "A partir de hoy" (`fromToday`) y "Siempre" (`always`). "Hoy" es la fecha de
// referencia: la ocurrencia que se estaba mirando al abrir el editor.

import { addDaysISO } from './dates';
import { occursOn, validateSeries } from './recurrence';
import type { SeriesError } from './recurrence';
import type { AgendaState, ExceptionFields, Rule, Series, SeriesException } from './types';

export type EditScope = 'today' | 'fromToday' | 'always';

/** Campos que el editor puede cambiar. `date` es la nueva fecha de la ocurrencia (solo para "Solo hoy" o eventos de un día). */
export interface EventPatch {
  title: string;
  categoryId: string;
  startMin: number;
  endMin: number;
  note: string;
  rule: Rule | null;
  endDate: string | null;
  date?: string;
}

export type OpResult = { ok: true; state: AgendaState; id: string } | { ok: false; error: OpError };
export type OpError =
  | { kind: 'not-found' }
  | { kind: 'invalid'; errors: SeriesError[] }
  | { kind: 'scope-not-allowed'; reason: 'rule-changed' }
  | { kind: 'not-on-date' };

const sameRule = (a: Rule | null, b: Rule | null) =>
  a === b ||
  (a !== null && b !== null && a.everyWeeks === b.everyWeeks && [...a.weekdays].sort().join() === [...b.weekdays].sort().join());

const find = (st: AgendaState, id: string) => st.series.find((s) => s.id === id);

/** Una serie se "repite" si tiene regla. Las de un día no preguntan alcance. */
export const isRepeating = (s: Series) => s.rule !== null;

/** Alcances que ofrece la hoja al guardar (spec 009, 3.4). */
export function allowedScopes(s: Series, refDate: string, patch: EventPatch): EditScope[] {
  if (!isRepeating(s)) return ['always'];
  const ruleChanged = !sameRule(s.rule, patch.rule) || s.endDate !== patch.endDate;
  const scopes: EditScope[] = [];
  if (!ruleChanged) scopes.push('today');
  if (refDate > s.startDate) scopes.push('fromToday');
  scopes.push('always');
  return scopes;
}

/** Alcances que ofrece la hoja al eliminar (spec 009, 3.5). */
export function allowedDeleteScopes(s: Series, refDate: string): EditScope[] {
  if (!isRepeating(s)) return ['always'];
  return refDate > s.startDate ? ['today', 'fromToday', 'always'] : ['today', 'always'];
}

/** Cantidad de días con cambios propios que conservan sus campos (para la línea de la hoja). */
export function modifiedDays(st: AgendaState, seriesId: string, fromDate: string | null = null): number {
  return st.exceptions.filter((x) => x.seriesId === seriesId && x.kind === 'modified' && (fromDate === null || x.date >= fromDate)).length;
}

let counter = 0;
/** Id nuevo para una serie. En pruebas se puede pasar uno fijo. */
export const newSeriesId = () => `e-${Date.now().toString(36)}${(counter++ % 1296).toString(36)}`;

function check(s: Series): OpError | null {
  const errors = validateSeries(s);
  return errors.length ? { kind: 'invalid', errors } : null;
}

// ---- Crear --------------------------------------------------------------------------------------------------------

export function createEvent(st: AgendaState, date: string, patch: EventPatch, id: string = newSeriesId()): OpResult {
  const s: Series = {
    id, title: patch.title.trim(), categoryId: patch.categoryId, startMin: patch.startMin, endMin: patch.endMin,
    note: patch.note.trim(), rule: patch.rule, startDate: date, endDate: patch.rule ? patch.endDate : null,
    reminder: null, archived: false,
  };
  const err = check(s);
  if (err) return { ok: false, error: err };
  return { ok: true, state: { ...st, series: [...st.series, s] }, id };
}

// ---- Editar -------------------------------------------------------------------------------------------------------

const fieldsOf = (p: EventPatch) => ({
  title: p.title.trim(), categoryId: p.categoryId, startMin: p.startMin, endMin: p.endMin, note: p.note.trim(),
});

function diff(base: Series, p: EventPatch): ExceptionFields {
  const f = fieldsOf(p);
  const out: ExceptionFields = {};
  if (f.title !== base.title) out.title = f.title;
  if (f.categoryId !== base.categoryId) out.categoryId = f.categoryId;
  if (f.startMin !== base.startMin) out.startMin = f.startMin;
  if (f.endMin !== base.endMin) out.endMin = f.endMin;
  if (f.note !== base.note) out.note = f.note;
  return out;
}

const withoutEx = (exs: SeriesException[], seriesId: string, date: string) =>
  exs.filter((x) => !(x.seriesId === seriesId && x.date === date));

/** Al separar una serie, las metas asociadas a la original también quedan asociadas a la nueva. */
function linkGoals(st: AgendaState, fromId: string, toId: string): AgendaState['goals'] {
  return st.goals.map((g) => (g.links.includes(fromId) && !g.links.includes(toId) ? { ...g, links: [...g.links, toId] } : g));
}

export function editEvent(st: AgendaState, seriesId: string, refDate: string, patch: EventPatch, scope: EditScope, newId: string = newSeriesId()): OpResult {
  const s = find(st, seriesId);
  if (!s) return { ok: false, error: { kind: 'not-found' } };

  // Evento de un día: se edita directo (también su fecha).
  if (!isRepeating(s)) {
    const next: Series = { ...s, ...fieldsOf(patch), startDate: patch.date ?? s.startDate, rule: patch.rule, endDate: patch.rule ? patch.endDate : null };
    const err = check(next);
    if (err) return { ok: false, error: err };
    return { ok: true, state: { ...st, series: st.series.map((x) => (x.id === s.id ? next : x)) }, id: s.id };
  }

  if (!allowedScopes(s, refDate, patch).includes(scope)) {
    return scope === 'today'
      ? { ok: false, error: { kind: 'scope-not-allowed', reason: 'rule-changed' } }
      : editEvent(st, seriesId, refDate, patch, 'always', newId); // "A partir de hoy" en el primer día = "Siempre"
  }

  if (scope === 'today') {
    if (!occursOn(s, refDate)) return { ok: false, error: { kind: 'not-on-date' } };
    const moved = patch.date && patch.date !== refDate;
    if (moved) {
      // Cambiar la fecha de una sola ocurrencia: se cancela ese día y se crea un evento de un día en la fecha nueva.
      const single: Series = { ...s, ...fieldsOf(patch), id: newId, rule: null, startDate: patch.date!, endDate: null };
      const err = check(single);
      if (err) return { ok: false, error: err };
      return {
        ok: true,
        id: newId,
        state: {
          ...st,
          series: [...st.series, single],
          exceptions: [...withoutEx(st.exceptions, s.id, refDate), { seriesId: s.id, date: refDate, kind: 'cancelled' }],
          legacyBid: st.legacyBid[s.id] ? { ...st.legacyBid, [newId]: st.legacyBid[s.id] } : st.legacyBid,
          goals: linkGoals(st, s.id, newId),
        },
      };
    }
    const err = check({ ...s, ...fieldsOf(patch) });
    if (err) return { ok: false, error: err };
    const fields = diff(s, patch);
    const exceptions = withoutEx(st.exceptions, s.id, refDate);
    if (Object.keys(fields).length) exceptions.push({ seriesId: s.id, date: refDate, kind: 'modified', fields });
    return { ok: true, state: { ...st, exceptions }, id: s.id };
  }

  if (scope === 'always') {
    const next: Series = { ...s, ...fieldsOf(patch), rule: patch.rule, endDate: patch.endDate };
    const err = check(next);
    if (err) return { ok: false, error: err };
    // Las excepciones se conservan; las de días en que la serie ya no ocurre dejan de tener sentido y se quitan.
    const exceptions = st.exceptions.filter((x) => x.seriesId !== s.id || occursOn(next, x.date));
    return { ok: true, state: { ...st, series: st.series.map((x) => (x.id === s.id ? next : x)), exceptions }, id: s.id };
  }

  // "A partir de hoy": la serie original termina el día anterior y una nueva empieza en la fecha de referencia.
  const before: Series = { ...s, endDate: addDaysISO(refDate, -1) };
  const after: Series = { ...s, ...fieldsOf(patch), id: newId, rule: patch.rule, startDate: refDate, endDate: patch.endDate };
  const err = check(after);
  if (err) return { ok: false, error: err };
  const exceptions = st.exceptions
    .map((x) => (x.seriesId === s.id && x.date >= refDate ? { ...x, seriesId: newId } : x))
    .filter((x) => x.seriesId !== newId || occursOn(after, x.date));
  return {
    ok: true,
    id: newId,
    state: {
      ...st,
      series: [...st.series.map((x) => (x.id === s.id ? before : x)), after],
      exceptions,
      legacyBid: { ...st.legacyBid, [newId]: st.legacyBid[s.id] ?? s.id },
      goals: linkGoals(st, s.id, newId),
    },
  };
}

// ---- Eliminar -----------------------------------------------------------------------------------------------------

/** Quita una serie de las metas; una meta de tiempo que queda sin eventos se archiva (spec 009, 7.1). */
function unlinkGoals(st: AgendaState, id: string): AgendaState['goals'] {
  return st.goals.map((g) => {
    if (!g.links.includes(id)) return g;
    const links = g.links.filter((l) => l !== id);
    return { ...g, links, archived: g.archived || (g.kind === 'time' && links.length === 0) };
  });
}

export function deleteEvent(st: AgendaState, seriesId: string, refDate: string, scope: EditScope): OpResult {
  const s = find(st, seriesId);
  if (!s) return { ok: false, error: { kind: 'not-found' } };
  const removeAll = (): AgendaState => ({
    ...st,
    series: st.series.filter((x) => x.id !== s.id),
    exceptions: st.exceptions.filter((x) => x.seriesId !== s.id),
    legacyBid: Object.fromEntries(Object.entries(st.legacyBid).filter(([k]) => k !== s.id)),
    goals: unlinkGoals(st, s.id),
  });
  if (!isRepeating(s) || scope === 'always') return { ok: true, state: removeAll(), id: s.id };
  if (scope === 'today') {
    return {
      ok: true,
      id: s.id,
      state: { ...st, exceptions: [...withoutEx(st.exceptions, s.id, refDate), { seriesId: s.id, date: refDate, kind: 'cancelled' }] },
    };
  }
  if (refDate <= s.startDate) return { ok: true, state: removeAll(), id: s.id };
  return {
    ok: true,
    id: s.id,
    state: {
      ...st,
      series: st.series.map((x) => (x.id === s.id ? { ...x, endDate: addDaysISO(refDate, -1) } : x)),
      exceptions: st.exceptions.filter((x) => !(x.seriesId === s.id && x.date >= refDate)),
    },
  };
}

/** Ocurrencias que se quitarían, cuando se puede contar (un día, o una serie con fin). `null` = sin fin. */
export function daysAffected(s: Series, refDate: string, scope: EditScope): number | null {
  if (!isRepeating(s) || scope === 'today') return 1;
  const from = scope === 'always' ? s.startDate : refDate;
  if (s.endDate === null) return null;
  let n = 0;
  for (let d = from; d <= s.endDate; d = addDaysISO(d, 1)) if (occursOn(s, d)) n++;
  return n;
}

