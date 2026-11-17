import { dayType, defaultBlocks, parseISO } from '../../../agenda';
import { SEED_CATEGORIES } from '../../categories';
import { addDaysISO } from '../../dates';
import { buildDay, validateSeries } from '../../recurrence';
import type { Category } from '../../types';
import { buildLegacyTemplate } from '../build-legacy';
import { EMPTY_TEMPLATE, JOB_SEARCH_TEMPLATE, TEMPLATES, applyTemplate } from '../index';

const counter = () => {
  let n = 0;
  return (kind: string) => `${kind}-${++n}`;
};
const fields = (b: { s: number; e: number; t: string; c: string; n: string }) => [b.s, b.e, b.t, b.c, b.n].join('|');

describe('plantilla "Búsqueda de empleo" (JSON)', () => {
  // Mientras `agenda.ts` siga teniendo la rutina escrita, el JSON tiene que coincidir con ella. Se borra en T6.2.
  test('coincide con la agenda escrita en agenda.ts', () => {
    expect(JOB_SEARCH_TEMPLATE).toEqual(buildLegacyTemplate());
  });

  test('todas sus series son válidas y sus categorías existen', () => {
    const cats = new Set(JOB_SEARCH_TEMPLATE.categories.map((c) => c.id));
    for (const s of JOB_SEARCH_TEMPLATE.series) {
      expect(validateSeries({ ...s, startDate: '2026-11-02', endDate: null })).toEqual([]);
      expect(cats.has(s.categoryId)).toBe(true);
    }
  });

  test('las metas apuntan a series de la plantilla', () => {
    const ids = new Set(JOB_SEARCH_TEMPLATE.series.map((s) => s.id));
    for (const g of JOB_SEARCH_TEMPLATE.goals) for (const l of g.links) expect(ids.has(l)).toBe(true);
  });

  test('está en la lista de plantillas junto a la vacía', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['busqueda-de-empleo', 'vacia']);
  });
});

describe('applyTemplate', () => {
  test('aplicada desde una semana con adscripción reproduce la agenda original durante 8 semanas', () => {
    const start = '2026-11-03'; // martes con adscripción (ancla actual)
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: start, newId: counter() });
    const state = { series: applied.series, exceptions: [] };
    const catOf = new Map(applied.categories.map((c) => [c.id, c]));
    for (let d = start; d < addDaysISO(start, 56); d = addDaysISO(d, 1)) {
      const type = dayType(parseISO(d), start);
      const expected = (type ? defaultBlocks(type) : []).map(fields).sort();
      // Las categorías tienen ids nuevos: se comparan por el id original guardado en el nombre de la semilla.
      const got = buildDay(state, d).map((b) => {
        const name = catOf.get(b.c)!.name;
        const orig = SEED_CATEGORIES.find((c) => c.name === name)!.id;
        return fields({ ...b, c: orig });
      }).sort();
      expect([d, ...got]).toEqual([d, ...expected]);
    }
  });

  test('aplicada desde una semana sin adscripción, los martes alternan al revés', () => {
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: '2026-11-10', newId: counter() });
    const titles = (d: string) => buildDay({ series: applied.series, exceptions: [] }, d).map((b) => b.t);
    expect(titles('2026-11-10')).toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-17')).not.toContain('Adscripción de políticas educativas');
  });

  test('nada empieza antes de la fecha elegida', () => {
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: '2026-11-12', newId: counter() });
    expect(applied.series.every((s) => s.startDate >= '2026-11-12')).toBe(true);
    expect(buildDay({ series: applied.series, exceptions: [] }, '2026-11-11')).toEqual([]);
    expect(buildDay({ series: applied.series, exceptions: [] }, '2026-11-12').length).toBeGreaterThan(0);
  });

  test('copia con ids nuevos y sin vínculo con la plantilla', () => {
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: '2026-11-03', newId: counter() });
    const tIds = new Set([...JOB_SEARCH_TEMPLATE.series, ...JOB_SEARCH_TEMPLATE.categories, ...JOB_SEARCH_TEMPLATE.goals].map((x) => x.id));
    for (const x of [...applied.series, ...applied.categories, ...applied.goals]) expect(tIds.has(x.id)).toBe(false);
    applied.series[0].rule!.weekdays.push(6);
    expect(JOB_SEARCH_TEMPLATE.series[0].rule!.weekdays).not.toContain(6);
  });

  test('las metas quedan asociadas a las series nuevas y vigentes desde la fecha elegida', () => {
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: '2026-11-03', newId: counter() });
    const ids = new Set(applied.series.map((s) => s.id));
    const proyecto = applied.goals.find((g) => g.name === 'Proyecto')!;
    expect(proyecto.links.length).toBeGreaterThan(0);
    expect(proyecto.links.every((l) => ids.has(l))).toBe(true);
    expect(applied.goals.every((g) => g.versions[0].effectiveFrom === '2026-11-03')).toBe(true);
  });

  test('reutiliza categorías existentes con el mismo nombre en vez de duplicarlas', () => {
    const existing: Category[] = [{ ...SEED_CATEGORIES[0], id: 'mia' }];
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: '2026-11-03', newId: counter(), existingCategories: existing });
    expect(applied.categories.some((c) => c.name === existing[0].name)).toBe(false);
    expect(applied.series.some((s) => s.categoryId === 'mia')).toBe(true);
  });

  test('la plantilla vacía no agrega nada', () => {
    expect(applyTemplate(EMPTY_TEMPLATE, { startDate: '2026-11-03', newId: counter() })).toEqual({ categories: [], series: [], goals: [] });
  });
});
