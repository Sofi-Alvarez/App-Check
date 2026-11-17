import type { AgendaState } from '../types';
import {
  COLOR_TOKENS, LEGACY_CATEGORY_IDS, SEED_CATEGORIES, categoryById, categoryUsage, createCategory, deleteCategory, isLegacyCategoryId,
  legacyCategory, setCategoryArchived, updateCategory,
} from '../categories';

describe('categorías iniciales (CA-01)', () => {
  test('son las 8 de la v1, con sus ids', () => {
    expect(SEED_CATEGORIES.map((c) => c.id).sort()).toEqual([...LEGACY_CATEGORY_IDS].sort());
    expect(new Set(SEED_CATEGORIES.map((c) => c.id)).size).toBe(8);
  });

  test('propiedades según la tabla de equivalencias', () => {
    const p = (id: (typeof LEGACY_CATEGORY_IDS)[number]) => {
      const c = legacyCategory(id);
      return [c.movable, c.tracked, c.marginPreference];
    };
    expect(p('fixed')).toEqual([false, false, 'normal']);
    expect(p('rest')).toEqual([true, false, 'avoid']);
    expect(p('close')).toEqual([true, true, 'normal']);
    for (const id of ['health', 'work', 'content', 'project', 'english'] as const) expect(p(id)).toEqual([true, true, 'normal']);
  });

  // Las propiedades reemplazan comparaciones que hoy están en el código; tienen que dar lo mismo.
  test('reproducen el comportamiento actual de la app', () => {
    for (const id of LEGACY_CATEGORY_IDS) {
      const c = legacyCategory(id);
      expect(c.movable).toBe(id !== 'fixed'); // schedule.ts: `c === 'fixed'` corta el margen
      expect(c.tracked).toBe(!(id === 'fixed' || id === 'rest')); // AgendaScreen y avisos: sin timer ni "Empecé"
      expect(c.marginPreference === 'avoid').toBe(id === 'rest'); // planMargin: `cat !== 'rest'` como destino
    }
  });

  test('los nombres son los de la leyenda de la rutina', () => {
    expect(SEED_CATEGORIES.map((c) => c.name)).toEqual(LEGACY_CATEGORY_IDS.map((id) => legacyCategory(id).name));
    expect(legacyCategory('work').name).toBe('Búsqueda');
    expect(legacyCategory('close').name).toBe('Cierre del día');
  });

  test('ninguna empieza archivada', () => {
    expect(SEED_CATEGORIES.every((c) => !c.archived)).toBe(true);
  });
});

describe('categoryById', () => {
  test('encuentra una existente y devuelve un reemplazo visible para una desconocida', () => {
    expect(categoryById(SEED_CATEGORIES, 'rest').name).toBe('Pausa o comida');
    const x = categoryById(SEED_CATEGORIES, 'rara');
    expect([x.id, x.name, x.tracked, x.movable]).toEqual(['rara', 'rara', true, true]);
  });
  test('isLegacyCategoryId', () => {
    expect(isLegacyCategoryId('work')).toBe(true);
    expect(isLegacyCategoryId('lectura')).toBe(false);
  });
});

describe('createCategory', () => {
  const base = { categories: [...SEED_CATEGORIES], series: [], exceptions: [], goals: [], legacyBid: {} };
  const input = { name: 'Lectura', color: 'teal' as const, movable: true, tracked: true, marginPreference: 'normal' as const };

  test('crea una categoría con sus propiedades', () => {
    const r = createCategory(base, input, 'c1');
    expect(r.ok && r.state.categories.at(-1)).toEqual({ id: 'c1', ...input, archived: false });
  });
  test('nombre vacío, demasiado largo o repetido (sin distinguir mayúsculas ni espacios)', () => {
    expect(createCategory(base, { ...input, name: '  ' })).toEqual({ ok: false, error: 'name-empty' });
    expect(createCategory(base, { ...input, name: 'x'.repeat(31) })).toEqual({ ok: false, error: 'name-too-long' });
    expect(createCategory(base, { ...input, name: ' ejercicio ' })).toEqual({ ok: false, error: 'name-taken' });
  });
  test('la paleta tiene 7 colores', () => {
    expect(COLOR_TOKENS).toHaveLength(7);
  });
});

describe('gestión de categorías (CG-19 a CG-21)', () => {
  const series = (id: string, categoryId: string) => ({
    id, title: id, categoryId, startMin: 600, endMin: 660, note: '', rule: { weekdays: [1], everyWeeks: 1 },
    startDate: '2026-11-02', endDate: null, reminder: null, archived: false,
  });
  const base = (): AgendaState => ({
    categories: [...SEED_CATEGORIES],
    series: [series('a', 'work'), series('b', 'work'), series('c', 'work'), series('d', 'health')],
    exceptions: [{ seriesId: 'd', date: '2026-11-16', kind: 'modified' as const, fields: { categoryId: 'work' } }],
    goals: [], legacyBid: {},
  });
  const input = { name: 'Lectura', color: 'teal' as const, movable: true, tracked: true, marginPreference: 'normal' as const };

  test('uso: series más días con un cambio propio a esa categoría', () => {
    expect(categoryUsage(base(), 'work')).toBe(4);
    expect(categoryUsage(base(), 'english')).toBe(0);
  });

  test('CG-19: una categoría en uso no se elimina sin reasignar', () => {
    expect(deleteCategory(base(), 'work')).toEqual({ ok: false, error: { kind: 'in-use', events: 4 } });
  });

  test('eliminar reasignando: cambia en las series y en los cambios propios', () => {
    const r = deleteCategory(base(), 'work', 'project');
    if (!r.ok) throw new Error();
    expect(r.state.categories.some((c) => c.id === 'work')).toBe(false);
    expect(r.state.series.filter((s) => s.categoryId === 'project').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(r.state.exceptions[0]).toMatchObject({ fields: { categoryId: 'project' } });
  });

  test('no se reasigna a sí misma, a una archivada ni a una inexistente', () => {
    const st = { ...base(), categories: base().categories.map((c) => (c.id === 'rest' ? { ...c, archived: true } : c)) };
    for (const to of ['work', 'rest', 'nada']) expect(deleteCategory(st, 'work', to)).toEqual({ ok: false, error: { kind: 'bad-target' } });
  });

  test('CG-20: una categoría sin eventos se elimina', () => {
    const r = deleteCategory(base(), 'english');
    expect(r.ok && r.state.categories.map((c) => c.id)).not.toContain('english');
  });

  test('CG-21: renombrar conserva el id (los eventos la siguen usando) y valida el nombre', () => {
    const r = updateCategory(base(), 'work', { ...input, name: 'Trabajo', color: 'blue' });
    expect(r.ok && r.state.categories.find((c) => c.id === 'work')!.name).toBe('Trabajo');
    expect(updateCategory(base(), 'work', { ...input, name: 'ejercicio' })).toEqual({ ok: false, error: { kind: 'name', error: 'name-taken' } });
    expect(updateCategory(base(), 'work', { ...input, name: 'Búsqueda' }).ok).toBe(true); // su propio nombre
  });

  test('archivar y reactivar; al reactivar, el nombre no puede chocar con otra activa', () => {
    let st = base();
    const r1 = setCategoryArchived(st, 'english', true);
    if (!r1.ok) throw new Error();
    st = r1.state;
    expect(st.categories.find((c) => c.id === 'english')!.archived).toBe(true);
    const c = createCategory(st, { ...input, name: 'Inglés' }, 'c2');
    if (!c.ok) throw new Error();
    expect(setCategoryArchived(c.state, 'english', false)).toEqual({ ok: false, error: { kind: 'name', error: 'name-taken' } });
    expect(setCategoryArchived(st, 'english', false).ok).toBe(true);
  });

  test('no se puede archivar ni eliminar la última categoría activa', () => {
    const one = { ...base(), categories: [SEED_CATEGORIES[0]], series: [], exceptions: [] };
    expect(setCategoryArchived(one, 'work', true)).toEqual({ ok: false, error: { kind: 'last-category' } });
    expect(deleteCategory(one, 'work')).toEqual({ ok: false, error: { kind: 'last-category' } });
  });
});
