// Repetición mensual: por día del mes y por día de la semana del mes.

import { monthWeekOf } from '../dates';
import { describeRule } from '../describe';
import { allowedScopes, editEvent } from '../events';
import { buildDay, occursOn, ruleKey, validateRule } from '../recurrence';
import type { AgendaState, MonthlyRule, Series } from '../types';

const series = (rule: MonthlyRule, startDate = '2026-11-17', endDate: string | null = null): Series => ({
  id: 'm', title: 'Pagar alquiler', categoryId: 'work', startMin: 600, endMin: 630, note: '', rule, startDate, endDate,
  reminder: null, archived: false,
});
const dates = (s: Series, from: string, to: string) => {
  const out: string[] = [];
  for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (occursOn(s, iso)) out.push(iso);
  }
  return out;
};

describe('repetición mensual por día del mes', () => {
  test('el 17 de cada mes, desde el 17/11', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { day: 17 } });
    expect(dates(s, '2026-11-01', '2027-02-28')).toEqual(['2026-11-17', '2026-12-17', '2027-01-17', '2027-02-17']);
  });

  test('el 31: en los meses más cortos cae el último día del mes', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { day: 31 } }, '2026-12-31');
    expect(dates(s, '2026-12-01', '2027-05-31')).toEqual(['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']);
  });

  test('el 29 de febrero en año bisiesto', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { day: 30 } }, '2028-01-30');
    expect(dates(s, '2028-02-01', '2028-03-31')).toEqual(['2028-02-29', '2028-03-30']);
  });

  test('cada 3 meses, contados desde el mes de inicio, y respeta la fecha de fin', () => {
    const s = series({ kind: 'monthly', everyMonths: 3, on: { day: 5 } }, '2026-11-05', '2027-08-05');
    expect(dates(s, '2026-11-01', '2027-12-31')).toEqual(['2026-11-05', '2027-02-05', '2027-05-05', '2027-08-05']);
  });

  test('no aparece antes del inicio', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { day: 3 } }, '2026-11-17');
    expect(dates(s, '2026-11-01', '2026-12-31')).toEqual(['2026-12-03']);
  });
});

describe('repetición mensual por día de la semana', () => {
  test('el tercer martes de cada mes', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { nth: 3, weekday: 2 } });
    expect(dates(s, '2026-11-01', '2027-02-28')).toEqual(['2026-11-17', '2026-12-15', '2027-01-19', '2027-02-16']);
  });

  test('el primer lunes', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { nth: 1, weekday: 1 } }, '2026-11-01');
    expect(dates(s, '2026-11-01', '2027-01-31')).toEqual(['2026-11-02', '2026-12-07', '2027-01-04']);
  });

  test('el último viernes, también en meses con cinco viernes', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { nth: -1, weekday: 5 } }, '2026-11-01');
    expect(dates(s, '2026-11-01', '2027-01-31')).toEqual(['2026-11-27', '2026-12-25', '2027-01-29']);
  });

  test('se arma en el día con el resto de los eventos', () => {
    const st: Pick<AgendaState, 'series' | 'exceptions'> = { series: [series({ kind: 'monthly', everyMonths: 1, on: { nth: 3, weekday: 2 } })], exceptions: [] };
    expect(buildDay(st, '2026-12-15').map((b) => b.t)).toEqual(['Pagar alquiler']);
    expect(buildDay(st, '2026-12-08')).toEqual([]);
  });
});

describe('validación, comparación y texto', () => {
  test('valida los campos de la regla mensual', () => {
    expect(validateRule({ kind: 'monthly', everyMonths: 1, on: { day: 17 } })).toEqual([]);
    expect(validateRule({ kind: 'monthly', everyMonths: 0, on: { day: 32 } })).toEqual(['bad-every-months', 'bad-month-day']);
    expect(validateRule({ kind: 'monthly', everyMonths: 1, on: { nth: 5 as never, weekday: 7 } })).toEqual(['bad-month-week', 'bad-weekday']);
  });

  test('la regla semanal guardada sin `kind` es igual a la misma con `kind`', () => {
    expect(ruleKey({ weekdays: [3, 1], everyWeeks: 1 })).toBe(ruleKey({ kind: 'weekly', weekdays: [1, 3], everyWeeks: 1 }));
    expect(ruleKey({ kind: 'monthly', everyMonths: 1, on: { day: 3 } })).not.toBe(ruleKey({ kind: 'monthly', everyMonths: 1, on: { day: 4 } }));
  });

  test('describe la regla en palabras', () => {
    expect(describeRule({ kind: 'monthly', everyMonths: 1, on: { day: 17 } }, '2026-11-17', null)).toBe('Cada mes, el día 17, desde el 17/11');
    expect(describeRule({ kind: 'monthly', everyMonths: 2, on: { nth: 3, weekday: 2 } }, '2026-11-17', '2027-06-30'))
      .toBe('Cada 2 meses, el tercer martes, desde el 17/11, hasta el 30/06');
    expect(describeRule({ kind: 'monthly', everyMonths: 1, on: { nth: -1, weekday: 5 } }, '2026-11-27', null)).toBe('Cada mes, el último viernes, desde el 27/11');
    expect(describeRule({ kind: 'monthly', everyMonths: 1, on: { day: 31 } }, '2026-12-31', null)).toBe('Cada mes, el día 31 (o el último día, si el mes es más corto), desde el 31/12');
  });

  test('semana del mes de una fecha', () => {
    expect(monthWeekOf('2026-11-17')).toEqual({ nth: 3, last: false });
    expect(monthWeekOf('2026-11-27')).toEqual({ nth: 4, last: true });
    expect(monthWeekOf('2026-11-30')).toEqual({ nth: 5, last: true });
  });
});

describe('editar un evento mensual', () => {
  test('cambiar solo el título ofrece los tres alcances; cambiar la regla, no "Solo hoy"', () => {
    const s = series({ kind: 'monthly', everyMonths: 1, on: { day: 17 } });
    const base = { title: 'Alquiler', categoryId: 'work', startMin: 600, endMin: 630, note: '', rule: s.rule, endDate: null };
    expect(allowedScopes(s, '2026-12-17', base)).toEqual(['today', 'fromToday', 'always']);
    expect(allowedScopes(s, '2026-12-17', { ...base, rule: { kind: 'monthly', everyMonths: 1, on: { nth: 3, weekday: 4 } } })).toEqual(['fromToday', 'always']);
  });

  test('"A partir del" día parte la serie y conserva los meses anteriores', () => {
    const st: AgendaState = { categories: [], series: [series({ kind: 'monthly', everyMonths: 1, on: { day: 17 } })], exceptions: [], goals: [], legacyBid: {} };
    const r = editEvent(st, 'm', '2027-01-17', { title: 'Alquiler nuevo', categoryId: 'work', startMin: 600, endMin: 630, note: '', rule: st.series[0].rule, endDate: null }, 'fromToday', 'm2');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(buildDay(r.state, '2026-12-17').map((b) => b.t)).toEqual(['Pagar alquiler']);
    expect(buildDay(r.state, '2027-01-17').map((b) => b.t)).toEqual(['Alquiler nuevo']);
    expect(buildDay(r.state, '2027-02-17').map((b) => b.t)).toEqual(['Alquiler nuevo']);
  });
});
