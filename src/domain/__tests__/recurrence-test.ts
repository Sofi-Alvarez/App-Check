import { addDaysISO, dayNumber, fromDayNumber, isValidDate, minDate, mondayNumber, weekdayOf } from '../dates';
import { buildDay, occursOn, validateRule, validateSeries } from '../recurrence';
import type { Series, SeriesException } from '../types';

const series = (over: Partial<Series> = {}): Series => ({
  id: 's1', title: 'Evento', categoryId: 'work', startMin: 600, endMin: 660, note: '', rule: null,
  startDate: '2026-11-03', endDate: null, reminder: null, archived: false, ...over,
});

describe('fechas', () => {
  test('ida y vuelta con números de día, también antes de 1970 y en años bisiestos', () => {
    for (const d of ['2026-11-17', '1969-12-31', '2028-02-29', '2000-01-01']) expect(fromDayNumber(dayNumber(d))).toBe(d);
  });
  test('días de la semana', () => {
    expect(weekdayOf('2026-11-17')).toBe(2); // martes
    expect(weekdayOf('2026-11-15')).toBe(0); // domingo
    expect(weekdayOf('2026-11-14')).toBe(6); // sábado
    expect(weekdayOf('1969-12-29')).toBe(1); // lunes, antes de 1970
  });
  test('lunes de la semana: el domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(fromDayNumber(mondayNumber('2026-11-15'))).toBe('2026-11-09');
    expect(fromDayNumber(mondayNumber('2026-11-16'))).toBe('2026-11-16');
  });
  test('fechas válidas e inválidas', () => {
    expect(isValidDate('2026-11-17')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('17/11/2026')).toBe(false);
  });
  test('sumar días cruzando meses y años', () => {
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('fecha mínima', () => {
    expect(minDate(['2026-11-17', '2026-11-03', '2026-12-01'])).toBe('2026-11-03');
    expect(minDate([])).toBeNull();
  });
});

describe('occursOn (CA-05 a CA-07)', () => {
  test('CA-05: martes cada 2 semanas desde el 03/11', () => {
    const s = series({ rule: { weekdays: [2], everyWeeks: 2 }, startDate: '2026-11-03' });
    expect(occursOn(s, '2026-11-03')).toBe(true);
    expect(occursOn(s, '2026-11-10')).toBe(false);
    expect(occursOn(s, '2026-11-17')).toBe(true);
    expect(occursOn(s, '2026-12-01')).toBe(true);
  });
  test('CA-06: sábado y domingo', () => {
    const s = series({ rule: { weekdays: [6, 0], everyWeeks: 1 }, startDate: '2026-11-02' });
    expect(occursOn(s, '2026-11-14')).toBe(true);
    expect(occursOn(s, '2026-11-15')).toBe(true);
    expect(occursOn(s, '2026-11-16')).toBe(false);
  });
  test('CA-07: no ocurre después de endDate ni antes de startDate', () => {
    const s = series({ rule: { weekdays: [1], everyWeeks: 1 }, startDate: '2026-11-09', endDate: '2026-11-23' });
    expect(occursOn(s, '2026-11-02')).toBe(false);
    expect(occursOn(s, '2026-11-23')).toBe(true);
    expect(occursOn(s, '2026-11-30')).toBe(false);
  });
  test('cada 2 semanas cuenta semanas de lunes a lunes aunque startDate no sea lunes', () => {
    // Empieza un jueves; el lunes de esa semana es el 02/11. Lunes y jueves de semanas alternas.
    const s = series({ rule: { weekdays: [1, 4], everyWeeks: 2 }, startDate: '2026-11-05' });
    expect(occursOn(s, '2026-11-02')).toBe(false); // antes de startDate
    expect(occursOn(s, '2026-11-05')).toBe(true);
    expect(occursOn(s, '2026-11-09')).toBe(false);
    expect(occursOn(s, '2026-11-16')).toBe(true);
    expect(occursOn(s, '2026-11-19')).toBe(true);
  });
  test('un evento sin repetición ocurre solo en su fecha', () => {
    const s = series({ startDate: '2026-11-14' });
    expect(occursOn(s, '2026-11-14')).toBe(true);
    expect(occursOn(s, '2026-11-21')).toBe(false);
  });
  test('una serie archivada no ocurre', () => {
    expect(occursOn(series({ archived: true }), '2026-11-03')).toBe(false);
  });
});

describe('buildDay (CA-08 a CA-10)', () => {
  const weekly = series({ id: 'w', rule: { weekdays: [2], everyWeeks: 1 }, startDate: '2026-11-03' });

  test('CA-08: una excepción cancelada quita la serie solo ese día', () => {
    const ex: SeriesException[] = [{ seriesId: 'w', date: '2026-11-17', kind: 'cancelled' }];
    expect(buildDay({ series: [weekly], exceptions: ex }, '2026-11-17')).toEqual([]);
    expect(buildDay({ series: [weekly], exceptions: ex }, '2026-11-24')).toHaveLength(1);
  });

  test('CA-09: una excepción modificada cambia solo sus campos', () => {
    const ex: SeriesException[] = [{ seriesId: 'w', date: '2026-11-17', kind: 'modified', fields: { endMin: 645 } }];
    const [b] = buildDay({ series: [weekly], exceptions: ex }, '2026-11-17');
    expect(b).toEqual({ id: 'w', date: '2026-11-17', s: 600, e: 645, t: 'Evento', c: 'work', n: '', modified: true });
    const [other] = buildDay({ series: [weekly], exceptions: ex }, '2026-11-24');
    expect(other.e).toBe(660);
    expect(other.modified).toBe(false);
  });

  test('CA-10: dos series que se pisan aparecen ordenadas por inicio y fin', () => {
    const a = series({ id: 'a', startMin: 630, endMin: 700, rule: { weekdays: [2], everyWeeks: 1 } });
    const b = series({ id: 'b', startMin: 600, endMin: 660, rule: { weekdays: [2], everyWeeks: 1 } });
    const c = series({ id: 'c', startMin: 600, endMin: 640, rule: { weekdays: [2], everyWeeks: 1 } });
    expect(buildDay({ series: [a, b, c], exceptions: [] }, '2026-11-17').map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  test('una excepción de otra fecha o de otra serie no afecta', () => {
    const ex: SeriesException[] = [
      { seriesId: 'w', date: '2026-11-10', kind: 'cancelled' },
      { seriesId: 'otra', date: '2026-11-17', kind: 'cancelled' },
    ];
    expect(buildDay({ series: [weekly], exceptions: ex }, '2026-11-17')).toHaveLength(1);
  });
});

describe('validateSeries', () => {
  test('una serie correcta no tiene errores', () => {
    expect(validateSeries(series({ rule: { weekdays: [1, 3], everyWeeks: 1 } }))).toEqual([]);
  });
  test('título vacío, horario invertido, muy corto y fuera del día', () => {
    expect(validateSeries(series({ title: '  ' }))).toContain('title-empty');
    expect(validateSeries(series({ startMin: 600, endMin: 600 }))).toContain('time-order');
    expect(validateSeries(series({ startMin: 600, endMin: 604 }))).toContain('too-short');
    expect(validateSeries(series({ startMin: 1400, endMin: 1500 }))).toContain('time-out-of-day');
  });
  test('fechas', () => {
    expect(validateSeries(series({ startDate: '2026-02-30' }))).toContain('bad-start-date');
    expect(validateSeries(series({ endDate: '2026-11-01' }))).toContain('end-before-start');
  });
  test('reglas', () => {
    expect(validateRule({ weekdays: [], everyWeeks: 1 })).toContain('no-weekdays');
    expect(validateRule({ weekdays: [7], everyWeeks: 1 })).toContain('bad-weekday');
    expect(validateRule({ weekdays: [1, 1], everyWeeks: 1 })).toContain('bad-weekday');
    expect(validateRule({ weekdays: [1], everyWeeks: 0 })).toContain('bad-every-weeks');
  });
});
