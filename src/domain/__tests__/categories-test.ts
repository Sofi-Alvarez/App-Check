import { LEGEND } from '../../agenda';
import { COLOR_TOKENS, LEGACY_CATEGORY_IDS, SEED_CATEGORIES, categoryById, createCategory, isLegacyCategoryId, legacyCategory } from '../categories';

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

  test('los nombres coinciden con la leyenda actual', () => {
    for (const [id, label] of LEGEND) expect(legacyCategory(id).name).toBe(label);
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
