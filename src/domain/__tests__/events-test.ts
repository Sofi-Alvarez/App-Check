import { addDaysISO } from '../dates';
import { allowedDeleteScopes, allowedScopes, createEvent, daysAffected, deleteEvent, editEvent, modifiedDays } from '../events';
import type { EventPatch, OpResult } from '../events';
import { buildDay } from '../recurrence';
import type { AgendaState, Series } from '../types';

const weekly = (over: Partial<Series> = {}): Series => ({
  id: 'w', title: 'Inglés', categoryId: 'english', startMin: 840, endMin: 900, note: '',
  rule: { weekdays: [1, 3], everyWeeks: 1 }, startDate: '2026-11-02', endDate: null, reminder: null, archived: false, ...over,
});
const state = (series: Series[] = [weekly()]): AgendaState => ({
  categories: [], series, exceptions: [], goals: [
    { id: 'g', name: 'Inglés', kind: 'time', unit: '', links: ['w'], reminder: null, archived: false, versions: [{ effectiveFrom: '', target: null, period: 'week', activeDays: [1, 3] }] },
  ], legacyBid: {},
});
const patch = (s: Series, over: Partial<EventPatch> = {}): EventPatch => ({
  title: s.title, categoryId: s.categoryId, startMin: s.startMin, endMin: s.endMin, note: s.note, rule: s.rule, endDate: s.endDate, ...over,
});
const ok = (r: OpResult) => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r;
};
const at = (st: AgendaState, d: string) => buildDay(st, d).map((b) => `${b.t} ${b.s}-${b.e}`);

describe('crear (CG-01 a CG-05)', () => {
  const base = state([]);
  const p: EventPatch = { title: 'Correr', categoryId: 'health', startMin: 600, endMin: 660, note: '', rule: null, endDate: null };

  test('CG-01: un evento de sábado sin repetición aparece solo ese sábado', () => {
    const st = ok(createEvent(base, '2026-11-21', p, 'x')).state;
    expect(at(st, '2026-11-21')).toEqual(['Correr 600-660']);
    expect(at(st, '2026-11-28')).toEqual([]);
  });

  test('CG-02: lunes y jueves aparece 4 veces en dos semanas', () => {
    const st = ok(createEvent(base, '2026-11-16', { ...p, rule: { weekdays: [1, 4], everyWeeks: 1 } }, 'x')).state;
    let n = 0;
    for (let d = '2026-11-16'; d <= '2026-11-29'; d = addDaysISO(d, 1)) n += buildDay(st, d).length;
    expect(n).toBe(4);
  });

  test('CG-03: cada 2 semanas los martes desde el 03/11', () => {
    const st = ok(createEvent(base, '2026-11-03', { ...p, rule: { weekdays: [2], everyWeeks: 2 } }, 'x')).state;
    expect([at(st, '2026-11-03').length, at(st, '2026-11-10').length, at(st, '2026-11-17').length]).toEqual([1, 0, 1]);
  });

  test('CG-04 y CG-05: fin no posterior al inicio, o menos de 5 minutos, no se guarda', () => {
    const r1 = createEvent(base, '2026-11-16', { ...p, endMin: 600 });
    const r2 = createEvent(base, '2026-11-16', { ...p, endMin: 603 });
    expect(r1.ok || r1.error).toEqual({ kind: 'invalid', errors: ['time-order'] });
    expect(r2.ok || r2.error).toEqual({ kind: 'invalid', errors: ['too-short'] });
    const r3 = createEvent(base, '2026-11-16', { ...p, title: '  ' });
    expect(r3.ok).toBe(false);
  });

  test('un evento repetido con fecha de fin', () => {
    const st = ok(createEvent(base, '2026-11-16', { ...p, rule: { weekdays: [1], everyWeeks: 1 }, endDate: '2026-11-30' }, 'x')).state;
    expect(at(st, '2026-11-30')).toHaveLength(1);
    expect(at(st, '2026-12-07')).toHaveLength(0);
  });
});

describe('editar con alcance (CG-07 a CG-12)', () => {
  test('CG-07: "Solo hoy" cambia solo ese día', () => {
    const st0 = state();
    const st = ok(editEvent(st0, 'w', '2026-11-18', patch(weekly(), { title: 'Inglés oral', endMin: 930 }), 'today')).state;
    expect(at(st, '2026-11-18')).toEqual(['Inglés oral 840-930']);
    expect(at(st, '2026-11-16')).toEqual(['Inglés 840-900']);
    expect(at(st, '2026-11-23')).toEqual(['Inglés 840-900']);
  });

  test('"Solo hoy" sin cambios no deja excepción, y una segunda edición reemplaza la primera', () => {
    const st0 = state();
    expect(ok(editEvent(st0, 'w', '2026-11-18', patch(weekly()), 'today')).state.exceptions).toEqual([]);
    const st1 = ok(editEvent(st0, 'w', '2026-11-18', patch(weekly(), { title: 'A' }), 'today')).state;
    const st2 = ok(editEvent(st1, 'w', '2026-11-18', patch(weekly(), { note: 'n' }), 'today')).state;
    expect(st2.exceptions).toEqual([{ seriesId: 'w', date: '2026-11-18', kind: 'modified', fields: { note: 'n' } }]);
  });

  test('"Solo hoy" con otra fecha: se cancela ese día y aparece en la fecha nueva', () => {
    const st = ok(editEvent(state(), 'w', '2026-11-18', patch(weekly(), { date: '2026-11-21' }), 'today', 'moved')).state;
    expect(at(st, '2026-11-18')).toEqual([]);
    expect(at(st, '2026-11-21')).toEqual(['Inglés 840-900']);
    expect(at(st, '2026-11-23')).toEqual(['Inglés 840-900']);
    expect(st.goals[0].links).toEqual(['w', 'moved']);
  });

  test('CG-08: "A partir de hoy" desde el 24/11 deja igual lo anterior', () => {
    const st = ok(editEvent(state(), 'w', '2026-11-23', patch(weekly(), { startMin: 870, endMin: 930 }), 'fromToday', 'w2')).state;
    expect(at(st, '2026-11-18')).toEqual(['Inglés 840-900']);
    expect(at(st, '2026-11-23')).toEqual(['Inglés 870-930']);
    expect(at(st, '2026-12-02')).toEqual(['Inglés 870-930']);
    expect(st.series.find((s) => s.id === 'w')!.endDate).toBe('2026-11-22');
    expect(st.legacyBid.w2).toBe('w');
    expect(st.goals[0].links).toEqual(['w', 'w2']);
  });

  test('"A partir de hoy" lleva las excepciones futuras a la serie nueva y deja las pasadas', () => {
    let st = state();
    st = ok(editEvent(st, 'w', '2026-11-16', patch(weekly(), { note: 'pasado' }), 'today')).state;
    st = ok(editEvent(st, 'w', '2026-11-25', patch(weekly(), { note: 'futuro' }), 'today')).state;
    st = ok(editEvent(st, 'w', '2026-11-23', patch(weekly(), { title: 'Inglés B2' }), 'fromToday', 'w2')).state;
    expect(st.exceptions.map((x) => [x.seriesId, x.date])).toEqual([['w', '2026-11-16'], ['w2', '2026-11-25']]);
    expect(buildDay(st, '2026-11-25')[0]).toMatchObject({ t: 'Inglés B2', n: 'futuro' });
  });

  test('"A partir de hoy" respeta la alternancia de cada dos semanas', () => {
    const tue = weekly({ rule: { weekdays: [2], everyWeeks: 2 }, startDate: '2026-11-03' });
    const st = ok(editEvent(state([tue]), 'w', '2026-11-17', patch(tue, { title: 'Nuevo' }), 'fromToday', 'w2')).state;
    expect([at(st, '2026-11-03'), at(st, '2026-11-17'), at(st, '2026-11-24'), at(st, '2026-12-01')]).toEqual([
      ['Inglés 840-900'], ['Nuevo 840-900'], [], ['Nuevo 840-900'],
    ]);
  });

  test('CG-09: "Siempre" cambia la agenda pasada y futura', () => {
    const st = ok(editEvent(state(), 'w', '2026-11-18', patch(weekly(), { title: 'English' }), 'always')).state;
    expect(at(st, '2026-11-02')).toEqual(['English 840-900']);
    expect(at(st, '2027-01-04')).toEqual(['English 840-900']);
  });

  test('CG-10: si cambia la regla, "Solo hoy" no está disponible', () => {
    const p = patch(weekly(), { rule: { weekdays: [1, 3, 5], everyWeeks: 1 } });
    expect(allowedScopes(weekly(), '2026-11-18', p)).toEqual(['fromToday', 'always']);
    const r = editEvent(state(), 'w', '2026-11-18', p, 'today');
    expect(r.ok || r.error).toEqual({ kind: 'scope-not-allowed', reason: 'rule-changed' });
    expect(allowedScopes(weekly(), '2026-11-18', patch(weekly()))).toEqual(['today', 'fromToday', 'always']);
  });

  test('CG-11: "Siempre" con un día que tenía margen conserva su horario y recibe el título nuevo', () => {
    let st = state();
    st = ok(editEvent(st, 'w', '2026-11-18', patch(weekly(), { startMin: 825 }), 'today')).state;
    expect(modifiedDays(st, 'w')).toBe(1);
    st = ok(editEvent(st, 'w', '2026-11-16', patch(weekly(), { title: 'English' }), 'always')).state;
    expect(at(st, '2026-11-18')).toEqual(['English 825-900']);
  });

  test('"Siempre" con otra regla quita excepciones de días en que ya no ocurre', () => {
    let st = state();
    st = ok(editEvent(st, 'w', '2026-11-18', patch(weekly(), { note: 'x' }), 'today')).state;
    st = ok(editEvent(st, 'w', '2026-11-16', patch(weekly(), { rule: { weekdays: [1], everyWeeks: 1 } }), 'always')).state;
    expect(st.exceptions).toEqual([]);
  });

  test('CG-12: en el primer día de la serie, "A partir de hoy" equivale a "Siempre" (sin duplicar)', () => {
    expect(allowedScopes(weekly(), '2026-11-02', patch(weekly()))).toEqual(['today', 'always']);
    const st = ok(editEvent(state(), 'w', '2026-11-02', patch(weekly(), { title: 'X' }), 'fromToday')).state;
    expect(st.series).toHaveLength(1);
    expect(st.series[0].title).toBe('X');
  });

  test('un evento de un día se edita directo, incluida su fecha', () => {
    const one = weekly({ id: 'o', rule: null, startDate: '2026-11-21' });
    expect(allowedScopes(one, '2026-11-21', patch(one))).toEqual(['always']);
    const st = ok(editEvent(state([one]), 'o', '2026-11-21', patch(one, { date: '2026-11-22', title: 'Y' }), 'today')).state;
    expect(at(st, '2026-11-21')).toEqual([]);
    expect(at(st, '2026-11-22')).toEqual(['Y 840-900']);
  });

  test('validación al editar', () => {
    const r = editEvent(state(), 'w', '2026-11-18', patch(weekly(), { endMin: 800 }), 'always');
    expect(r.ok).toBe(false);
    expect(editEvent(state(), 'nada', '2026-11-18', patch(weekly()), 'always').ok).toBe(false);
  });
});

describe('eliminar con alcance (CG-13 a CG-15)', () => {
  test('CG-13: "Solo hoy" lo quita ese día y vuelve la semana siguiente', () => {
    const st = ok(deleteEvent(state(), 'w', '2026-11-18', 'today')).state;
    expect([at(st, '2026-11-18'), at(st, '2026-11-25')]).toEqual([[], ['Inglés 840-900']]);
  });

  test('CG-14: "A partir de hoy" conserva los días anteriores', () => {
    let st = state();
    st = ok(editEvent(st, 'w', '2026-11-25', patch(weekly(), { note: 'x' }), 'today')).state;
    st = ok(deleteEvent(st, 'w', '2026-11-23', 'fromToday')).state;
    expect([at(st, '2026-11-18'), at(st, '2026-11-23'), at(st, '2026-11-25')]).toEqual([['Inglés 840-900'], [], []]);
    expect(st.exceptions).toEqual([]);
  });

  test('CG-15: "Siempre" quita la serie, sus excepciones y la desasocia de las metas (una meta de tiempo sin eventos se archiva)', () => {
    let st = state();
    st = ok(editEvent(st, 'w', '2026-11-18', patch(weekly(), { note: 'x' }), 'today')).state;
    st = ok(deleteEvent(st, 'w', '2026-11-18', 'always')).state;
    expect(st.series).toEqual([]);
    expect(st.exceptions).toEqual([]);
    expect(st.goals[0]).toMatchObject({ links: [], archived: true });
  });

  test('"A partir de hoy" en el primer día elimina toda la serie', () => {
    expect(allowedDeleteScopes(weekly(), '2026-11-02')).toEqual(['today', 'always']);
    expect(ok(deleteEvent(state(), 'w', '2026-11-02', 'fromToday')).state.series).toEqual([]);
  });

  test('días afectados: uno, todos los de una serie con fin, o sin fin', () => {
    expect(daysAffected(weekly(), '2026-11-18', 'today')).toBe(1);
    expect(daysAffected(weekly(), '2026-11-18', 'always')).toBeNull();
    expect(daysAffected(weekly({ endDate: '2026-11-30' }), '2026-11-18', 'fromToday')).toBe(4);
  });
});
