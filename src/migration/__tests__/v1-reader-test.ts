import { defaultBlocks } from '../../agenda';
import { ACTIVE, ANCHOR, DAYS, EXPECTED, OVERRIDES, SCHED, buildV1Store } from '../../__fixtures__/v1-store';
import { readV1, v1BlocksFor, v1ListFor } from '../v1-reader';

describe('readV1', () => {
  const st = readV1(buildV1Store());

  test('lee todas las claves de la fixture sin dejar ninguna sin reconocer', () => {
    expect(st.unknown).toEqual([]);
  });

  test('ajustes, timer, marcas y sesión en curso', () => {
    expect(st.settings.anchor).toBe(ANCHOR);
    expect(st.settings.endLead).toBe(5);
    expect(Object.keys(st.settings.muted)).toHaveLength(1);
    expect(st.timer.total).toBe(1500);
    expect(st.flags).toEqual({ doneIds: '1' });
    expect(st.active).toEqual(ACTIVE);
  });

  test('agenda editada, ediciones de un día y datos de cada día', () => {
    expect(st.sched).toEqual(SCHED);
    expect(st.overrides).toEqual(OVERRIDES);
    expect(st.days).toEqual(DAYS);
  });

  test('registro completo y ordenado por hora', () => {
    expect(st.logs).toHaveLength(EXPECTED.totalEvents);
    expect(st.logKeys).toHaveLength(EXPECTED.totalEvents);
    for (let i = 1; i < st.logs.length; i++) expect(st.logs[i].ts).toBeGreaterThanOrEqual(st.logs[i - 1].ts);
  });

  test('un almacén vacío da los valores por defecto de la app', () => {
    const empty = readV1([]);
    expect(empty.settings.anchor).toBe('2026-11-03');
    expect(empty.settings.notifStart).toBe(true);
    expect(empty.timer.total).toBe(1500);
    expect(empty.sched).toEqual({});
    expect(empty.logs).toEqual([]);
    expect(empty.active).toBeNull();
  });

  test('los ajustes guardados se mezclan sobre los valores por defecto, como hace la app', () => {
    const st2 = readV1([['agenda:settings', '{"endLead":10}']]);
    expect(st2.settings.endLead).toBe(10);
    expect(st2.settings.notifStart).toBe(true);
  });

  test('un día guardado sin conteos se completa con un objeto vacío', () => {
    expect(readV1([['agenda:day:2026-11-09', '{"done":{"a":true}}']]).days['2026-11-09']).toEqual({
      done: { a: true }, counts: {},
    });
  });

  test('nada se descarta en silencio: claves desconocidas y valores ilegibles quedan en `unknown`', () => {
    const st3 = readV1([
      ['otra:clave', 'x'],
      ['agenda:day:2026-11-09', '{roto'],
      ['agenda:sched', '[1,2]'],
      ['agenda:log:no-es-fecha', '[]'],
      ['agenda:log:2026-11-09', '{"no":"es lista"}'],
    ]);
    expect(st3.unknown.map((u) => u.key)).toEqual([
      'otra:clave', 'agenda:day:2026-11-09', 'agenda:sched', 'agenda:log:no-es-fecha', 'agenda:log:2026-11-09',
    ]);
    expect(st3.unknown[1].value).toBe('{roto');
    expect(st3.unknown.every((u) => u.reason.length > 0)).toBe(true);
  });
});

describe('v1BlocksFor reproduce blocksFor()', () => {
  const st = readV1(buildV1Store());

  test('sábado y domingo no tienen agenda', () => {
    expect(v1BlocksFor(st, '2026-11-14')).toBeNull();
    expect(v1BlocksFor(st, '2026-11-15')).toBeNull();
  });

  test('martes alterna con y sin adscripción cada 14 días desde el ancla', () => {
    expect(v1BlocksFor(st, '2026-11-10')).toEqual(defaultBlocks('tueOff'));
    expect(v1BlocksFor(st, '2026-11-17')).toEqual(defaultBlocks('tueAds'));
    expect(v1BlocksFor(st, '2026-11-03')).toEqual(defaultBlocks('tueAds'));
  });

  test('un día sin edición usa la lista de "Siempre"', () => {
    expect(v1BlocksFor(st, '2026-11-09')).toEqual(SCHED.mwf);
    const ingles = v1BlocksFor(st, '2026-11-09')!.find((b) => b.id === EXPECTED.editedOriginal.id)!;
    expect([ingles.s, ingles.e]).toEqual([EXPECTED.editedOriginal.s, EXPECTED.editedOriginal.e]);
  });

  test('un día con edición "Solo hoy" gana sobre la lista', () => {
    expect(v1BlocksFor(st, '2026-11-11')).toEqual(OVERRIDES['2026-11-11']);
    expect(v1BlocksFor(st, '2026-11-12')!.some((b) => b.id === EXPECTED.deletedToday.id)).toBe(false);
  });

  test('una lista sin editar sale de la agenda original', () => {
    expect(v1ListFor(st, 'tueOff')).toEqual(defaultBlocks('tueOff'));
  });

  test('si cambia el ancla, cambian los martes', () => {
    const moved = { ...st, settings: { ...st.settings, anchor: '2026-11-10' } };
    expect(v1BlocksFor(moved, '2026-11-10')).toEqual(defaultBlocks('tueAds'));
  });
});
