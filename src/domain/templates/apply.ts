// Aplicar una plantilla (spec 010, 3.6): copia sus categorías, series y metas con ids nuevos y las ubica desde la
// fecha elegida. No queda vínculo con la plantilla: editarla después no cambia lo aplicado.

import { addDaysISO, fromDayNumber, mondayNumber } from '../dates';
import type { AgendaState, Category, Goal, Series, Template } from '../types';

export interface ApplyOptions {
  /** Fecha desde la que empieza la rutina. La semana de esa fecha es la semana 0 de la plantilla. */
  startDate: string;
  /** Generador de ids nuevos (en la app, uno basado en la hora; en las pruebas, uno determinista). */
  newId: (kind: 'category' | 'series' | 'goal') => string;
  /** Categorías que ya existen: si una de la plantilla tiene el mismo nombre, se reutiliza en vez de duplicarla. */
  existingCategories?: Category[];
}

export interface Applied {
  /** Solo las categorías nuevas (las reutilizadas no se repiten). */
  categories: Category[];
  series: Series[];
  goals: Goal[];
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

export function applyTemplate(t: Template, opts: ApplyOptions): Applied {
  const catMap = new Map<string, string>();
  const categories: Category[] = [];
  for (const c of t.categories) {
    const existing = opts.existingCategories?.find((x) => !x.archived && sameName(x.name, c.name));
    if (existing) {
      catMap.set(c.id, existing.id);
    } else {
      const id = opts.newId('category');
      catMap.set(c.id, id);
      categories.push({ ...c, id });
    }
  }

  const monday = mondayNumber(opts.startDate);
  const seriesMap = new Map<string, string>();
  const series: Series[] = t.series.map(({ weekOffset, ...s }) => {
    const id = opts.newId('series');
    seriesMap.set(s.id, id);
    const weekStart = fromDayNumber(monday + 7 * weekOffset);
    return {
      ...s,
      id,
      categoryId: catMap.get(s.categoryId) ?? s.categoryId,
      // No antes de la fecha elegida; para las reglas de cada dos semanas cuenta el lunes, que no cambia.
      startDate: weekStart < opts.startDate ? opts.startDate : weekStart,
      endDate: null,
      rule: s.rule ? { weekdays: [...s.rule.weekdays], everyWeeks: s.rule.everyWeeks } : null,
    };
  });

  const goals: Goal[] = t.goals.map((g) => ({
    ...g,
    id: opts.newId('goal'),
    links: g.links.map((l) => seriesMap.get(l)).filter((l): l is string => !!l),
    versions: g.versions.map((v) => ({ ...v, effectiveFrom: opts.startDate, activeDays: [...v.activeDays] })),
  }));

  return { categories, series, goals };
}

// ---- Plantilla con sus propios ids (instalación nueva y "Restaurar la plantilla inicial") ----------------------------


export interface WeekStarts {
  /** Inicio de las series de cada semana. */
  weekly: string;
  /** Lunes de una semana "A" (semana 0 de la plantilla) para las series de cada dos semanas. */
  a: string;
  /** Lunes de la semana "B" siguiente. */
  b: string;
}

/** Inicios que cubren desde `earliest` y respetan la alternancia de la semana de referencia `anchor` (semana A). */
export function weekStarts(earliest: string, anchor: string): WeekStarts {
  const m = mondayNumber(earliest);
  const offset = (((m - mondayNumber(anchor)) / 7) % 2 + 2) % 2;
  const a = m - offset * 7;
  return { weekly: fromDayNumber(m), a: fromDayNumber(a), b: fromDayNumber(a + 7) };
}

/**
 * La plantilla como estado, **conservando los ids de la plantilla** (a diferencia de `applyTemplate`). Para la rutina
 * original esos ids son los de siempre ("mwf:600"…), así el registro y las marcas de hecho se siguen uniendo.
 */
export function instantiateTemplate(t: Template, starts: WeekStarts, effectiveFrom: string): AgendaState {
  return {
    categories: t.categories.map((c) => ({ ...c })),
    series: t.series.map(({ weekOffset, ...s }) => ({
      ...s,
      rule: s.rule ? { weekdays: [...s.rule.weekdays], everyWeeks: s.rule.everyWeeks } : null,
      startDate: !s.rule || s.rule.everyWeeks === 1 ? starts.weekly : weekOffset % 2 === 0 ? starts.a : starts.b,
      endDate: null,
    })),
    exceptions: [],
    goals: t.goals.map((g) => ({ ...g, links: [...g.links], versions: g.versions.map((v) => ({ ...v, effectiveFrom, activeDays: [...v.activeDays] })) })),
    legacyBid: {},
  };
}

/** Martes de la semana de una fecha (referencia de la semana A para una instalación nueva). */
export const tuesdayOf = (date: string) => addDaysISO(fromDayNumber(mondayNumber(date)), 1);
