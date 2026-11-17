// Aplicar una plantilla (spec 010, 3.6): copia sus categorías, series y metas con ids nuevos y las ubica desde la
// fecha elegida. No queda vínculo con la plantilla: editarla después no cambia lo aplicado.

import { fromDayNumber, mondayNumber } from '../dates';
import type { Category, Goal, Series, Template } from '../types';

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
