import { SEED_CATEGORIES } from '../../categories';
import { buildDay, validateSeries } from '../../recurrence';
import type { Category, WeeklyRule } from '../../types';
import { instantiateTemplate, tuesdayOf, weekStarts } from '../apply';
import { EMPTY_TEMPLATE, JOB_SEARCH_TEMPLATE, TEMPLATES, applyTemplate } from '../index';

const counter = () => {
  let n = 0;
  return (kind: string) => `${kind}-${++n}`;
};

describe('plantilla "Búsqueda de empleo" (JSON)', () => {
  test('tiene la rutina completa: 66 eventos, 8 categorías y 8 metas', () => {
    expect([JOB_SEARCH_TEMPLATE.series.length, JOB_SEARCH_TEMPLATE.categories.length, JOB_SEARCH_TEMPLATE.goals.length]).toEqual([66, 8, 8]);
    expect(new Set(JOB_SEARCH_TEMPLATE.series.map((x) => x.id)).size).toBe(66);
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
  test('aplicada desde una semana con adscripción: lunes a viernes con su rutina, martes alternos y fin de semana libre', () => {
    const applied = applyTemplate(JOB_SEARCH_TEMPLATE, { startDate: '2026-11-03', newId: counter() });
    const titles = (d: string) => buildDay({ series: applied.series, exceptions: [] }, d).map((b) => b.t);
    expect(titles('2026-11-03')).toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-10')).not.toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-10')).toContain('/jobs y postular');
    expect(titles('2026-11-17')).toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-04')).toContain('/jobs y postular');
    expect(titles('2026-11-05')).toContain('Proyectual');
    expect(titles('2026-11-07')).toEqual([]);
    expect(titles('2026-11-08')).toEqual([]);
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
    (applied.series[0].rule as WeeklyRule).weekdays.push(6);
    expect((JOB_SEARCH_TEMPLATE.series[0].rule as WeeklyRule).weekdays).not.toContain(6);
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

describe('instantiateTemplate (instalación nueva y "Restaurar la plantilla inicial")', () => {
  test('conserva los ids de la plantilla y respeta la alternancia de la semana de referencia', () => {
    const st = instantiateTemplate(JOB_SEARCH_TEMPLATE, weekStarts('2026-11-03', '2026-11-03'), '2026-11-03');
    expect(st.series.map((x) => x.id).sort()).toEqual(JOB_SEARCH_TEMPLATE.series.map((x) => x.id).sort());
    const titles = (d: string) => buildDay(st, d).map((b) => b.t);
    expect(titles('2026-11-03')).toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-10')).not.toContain('Adscripción de políticas educativas');
    expect(st.goals.every((g) => g.versions[0].effectiveFrom === '2026-11-03')).toBe(true);
  });

  test('weekStarts y tuesdayOf', () => {
    expect(weekStarts('2026-11-09', '2026-11-03')).toEqual({ weekly: '2026-11-09', a: '2026-11-02', b: '2026-11-09' });
    expect(weekStarts('2026-11-03', '2026-11-03')).toEqual({ weekly: '2026-11-02', a: '2026-11-02', b: '2026-11-09' });
    expect(tuesdayOf('2026-11-21')).toBe('2026-11-17');
    expect(tuesdayOf('2026-11-16')).toBe('2026-11-17');
  });
});
