// Textos para la persona (spec 009, 3.3 y 3.4). Puros; las palabras salen del diccionario (`src/i18n`).

import { weekdayOf } from './dates';
import type { EditScope } from './events';
import type { Rule } from './types';
import { S } from '../i18n';

const T = S.describe;

/** "17/11" */
export const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Orden de lunes a domingo, como se piensa la semana. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function listDays(days: number[]): string {
  const names = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => (days.length > 1 ? T.dayNamesPlural[d] : T.dayNames[d]));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${T.and} ${names[names.length - 1]}`;
}

/** La regla en lenguaje natural: "Cada 2 semanas, el martes, desde el 03/11, hasta el 30/12". */
export function describeRule(rule: Rule | null, startDate: string, endDate: string | null): string {
  if (!rule) return T.single(T.dayNames[weekdayOf(startDate)], shortDate(startDate));
  const all = rule.weekdays.length === 7;
  const weekdaysOnly = rule.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => rule.weekdays.includes(d));
  const days = all ? T.everyDay : weekdaysOnly ? T.weekdaysOnly : T.onDays(rule.weekdays.length, listDays(rule.weekdays));
  const every = rule.everyWeeks === 1 ? (all ? T.allDaysEveryWeek : T.everyWeek(days)) : T.everyNWeeks(rule.everyWeeks, days);
  return T.since(every, shortDate(startDate)) + (endDate ? T.until(shortDate(endDate)) : '');
}

/** Etiqueta de un alcance. Si la fecha de referencia no es hoy, "hoy" se cambia por la fecha. */
export function scopeLabel(scope: EditScope, refDate: string, today: string): string {
  const isToday = refDate === today;
  if (scope === 'today') return isToday ? T.scopeToday : T.scopeTodayOn(shortDate(refDate));
  if (scope === 'fromToday') return isToday ? T.scopeFromToday : T.scopeFromDate(shortDate(refDate));
  return T.scopeAlways;
}

/** Explicación de una línea de cada alcance, para la hoja. */
export function scopeHint(scope: EditScope, action: 'edit' | 'delete'): string {
  if (action === 'edit') return scope === 'today' ? T.hintEditToday : scope === 'fromToday' ? T.hintEditFrom : T.hintEditAlways;
  return scope === 'today' ? T.hintDeleteToday : scope === 'fromToday' ? T.hintDeleteFrom : T.hintDeleteAlways;
}
