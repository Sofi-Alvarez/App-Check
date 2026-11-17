// Recurrencia y armado del día (spec 010, 3.2 a 3.4). Funciones puras.

import { dateParts, dayNumber, daysInMonth, isValidDate, mondayNumber, weekdayOf } from './dates';
import type { DayBlock, MonthlyRule, Rule, Series, SeriesException, WeeklyRule } from './types';

export const MIN_DURATION = 5;
export const DAY_MINUTES = 1440;

export const isMonthly = (r: Rule): r is MonthlyRule => r.kind === 'monthly';
export const isWeekly = (r: Rule): r is WeeklyRule => r.kind !== 'monthly';

/** Copia independiente de una regla. */
export const cloneRule = (r: Rule): Rule =>
  isMonthly(r) ? { kind: 'monthly', everyMonths: r.everyMonths, on: { ...r.on } } : { ...r, weekdays: [...r.weekdays] };

/** Clave para comparar reglas sin importar el orden de los días ni si la semanal tiene `kind`. */
export function ruleKey(r: Rule | null): string {
  if (!r) return 'none';
  if (isMonthly(r)) return 'day' in r.on ? `m${r.everyMonths}:d${r.on.day}` : `m${r.everyMonths}:w${r.on.nth}:${r.on.weekday}`;
  return `w${r.everyWeeks}:${[...r.weekdays].sort().join()}`;
}

/** `true` si una fecha cumple una regla mensual contada desde `startDate`. */
function monthlyMatch(r: MonthlyRule, startDate: string, date: string): boolean {
  const [y, m, d] = dateParts(date);
  const [sy, sm] = dateParts(startDate);
  if (((y - sy) * 12 + (m - sm)) % r.everyMonths !== 0) return false;
  const dim = daysInMonth(y, m);
  if ('day' in r.on) return d === Math.min(r.on.day, dim);
  if (weekdayOf(date) !== r.on.weekday) return false;
  return r.on.nth === -1 ? d + 7 > dim : Math.floor((d - 1) / 7) + 1 === r.on.nth;
}

/**
 * `true` si la serie ocurre en esa fecha: está entre `startDate` y `endDate`, no está archivada y, si se repite,
 * cumple la regla. Semanal: su día de la semana está en la regla y la cantidad de semanas entre el lunes de
 * `startDate` y el lunes de la fecha es múltiplo de `everyWeeks`. Mensual: ver `MonthlyRule`.
 */
export function occursOn(s: Series, date: string): boolean {
  if (s.archived) return false;
  if (date < s.startDate) return false;
  if (s.endDate !== null && date > s.endDate) return false;
  if (!s.rule) return date === s.startDate;
  if (isMonthly(s.rule)) return monthlyMatch(s.rule, s.startDate, date);
  if (!s.rule.weekdays.includes(weekdayOf(date))) return false;
  const weeks = (mondayNumber(date) - mondayNumber(s.startDate)) / 7;
  return weeks % s.rule.everyWeeks === 0;
}

const exKey = (seriesId: string, date: string) => `${seriesId}|${date}`;

/** Índice de excepciones por serie y fecha. */
export function indexExceptions(exceptions: SeriesException[]): Map<string, SeriesException> {
  const m = new Map<string, SeriesException>();
  for (const x of exceptions) m.set(exKey(x.seriesId, x.date), x);
  return m;
}

/**
 * Arma un día (3.4): series que ocurren esa fecha, sin las canceladas, con los cambios de las modificadas, ordenadas
 * por inicio y luego por fin (y por id para que el orden sea estable).
 */
export function buildDay(
  state: { series: Series[]; exceptions: SeriesException[] },
  date: string,
  index: Map<string, SeriesException> = indexExceptions(state.exceptions),
): DayBlock[] {
  const out: DayBlock[] = [];
  for (const s of state.series) {
    if (!occursOn(s, date)) continue;
    const x = index.get(exKey(s.id, date));
    if (x?.kind === 'cancelled') continue;
    const f = x?.kind === 'modified' ? x.fields : {};
    out.push({
      id: s.id,
      date,
      s: f.startMin ?? s.startMin,
      e: f.endMin ?? s.endMin,
      t: f.title ?? s.title,
      c: f.categoryId ?? s.categoryId,
      n: f.note ?? s.note,
      modified: x?.kind === 'modified',
    });
  }
  return out.sort((a, b) => a.s - b.s || a.e - b.e || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export type SeriesError =
  | 'title-empty'
  | 'time-out-of-day'
  | 'time-order'
  | 'too-short'
  | 'bad-start-date'
  | 'bad-end-date'
  | 'end-before-start'
  | 'no-weekdays'
  | 'bad-weekday'
  | 'bad-every-weeks'
  | 'bad-every-months'
  | 'bad-month-day'
  | 'bad-month-week';

/** Validación de una serie. Lista vacía = válida. Los textos para la persona los arma la pantalla. */
export function validateSeries(s: Series): SeriesError[] {
  const errs: SeriesError[] = [];
  if (s.title.trim() === '') errs.push('title-empty');
  if (!Number.isInteger(s.startMin) || !Number.isInteger(s.endMin) || s.startMin < 0 || s.endMin > DAY_MINUTES) {
    errs.push('time-out-of-day');
  } else if (s.endMin <= s.startMin) errs.push('time-order');
  else if (s.endMin - s.startMin < MIN_DURATION) errs.push('too-short');
  if (!isValidDate(s.startDate)) errs.push('bad-start-date');
  if (s.endDate !== null) {
    if (!isValidDate(s.endDate)) errs.push('bad-end-date');
    else if (isValidDate(s.startDate) && s.endDate < s.startDate) errs.push('end-before-start');
  }
  if (s.rule) errs.push(...validateRule(s.rule));
  return errs;
}

export function validateRule(r: Rule): SeriesError[] {
  const errs: SeriesError[] = [];
  if (isMonthly(r)) {
    if (!Number.isInteger(r.everyMonths) || r.everyMonths < 1) errs.push('bad-every-months');
    if ('day' in r.on) {
      if (!Number.isInteger(r.on.day) || r.on.day < 1 || r.on.day > 31) errs.push('bad-month-day');
    } else {
      if (![1, 2, 3, 4, -1].includes(r.on.nth)) errs.push('bad-month-week');
      if (!Number.isInteger(r.on.weekday) || r.on.weekday < 0 || r.on.weekday > 6) errs.push('bad-weekday');
    }
    return errs;
  }
  if (r.weekdays.length === 0) errs.push('no-weekdays');
  if (r.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || new Set(r.weekdays).size !== r.weekdays.length) {
    errs.push('bad-weekday');
  }
  if (!Number.isInteger(r.everyWeeks) || r.everyWeeks < 1) errs.push('bad-every-weeks');
  return errs;
}

/** Diferencia en días entre dos fechas (b − a). */
export const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a);
