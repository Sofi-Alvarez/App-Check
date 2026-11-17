// Textos para la persona (spec 009, 3.3 y 3.4). Puros, en español.

import { weekdayOf } from './dates';
import type { EditScope } from './events';
import type { Rule } from './types';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Orden de lunes a domingo, como se piensa la semana. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "17/11" */
export const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

const PLURAL: Record<string, string> = { sábado: 'sábados', domingo: 'domingos' };

function listDays(days: number[]): string {
  const plural = days.length > 1;
  const names = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => (plural ? PLURAL[DAY_NAMES[d]] ?? DAY_NAMES[d] : DAY_NAMES[d]));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** La regla en lenguaje natural: "Cada 2 semanas, el martes, desde el 03/11, hasta el 30/12". */
export function describeRule(rule: Rule | null, startDate: string, endDate: string | null): string {
  if (!rule) return `Solo el ${DAY_NAMES[weekdayOf(startDate)]} ${shortDate(startDate)}`;
  const all = rule.weekdays.length === 7;
  const weekdaysOnly = rule.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => rule.weekdays.includes(d));
  const days = all ? 'todos los días' : weekdaysOnly ? 'de lunes a viernes' : `${rule.weekdays.length === 1 ? 'el' : 'los'} ${listDays(rule.weekdays)}`;
  const every = rule.everyWeeks === 1 ? (all ? 'Todos los días' : `Cada semana, ${days}`) : `Cada ${rule.everyWeeks} semanas, ${days}`;
  return `${every}, desde el ${shortDate(startDate)}${endDate ? `, hasta el ${shortDate(endDate)}` : ''}`;
}

/** Etiqueta de un alcance. Si la fecha de referencia no es hoy, "hoy" se cambia por la fecha. */
export function scopeLabel(scope: EditScope, refDate: string, today: string): string {
  const isToday = refDate === today;
  if (scope === 'today') return isToday ? 'Solo hoy' : `Solo el ${shortDate(refDate)}`;
  if (scope === 'fromToday') return isToday ? 'A partir de hoy' : `A partir del ${shortDate(refDate)}`;
  return 'Siempre';
}

/** Explicación de una línea de cada alcance, para la hoja. */
export function scopeHint(scope: EditScope, action: 'edit' | 'delete'): string {
  if (action === 'edit') {
    if (scope === 'today') return 'Cambia solo este día.';
    if (scope === 'fromToday') return 'Cambia desde este día en adelante. Los días anteriores quedan como estaban.';
    return 'Cambia todos los días, también los pasados. Lo registrado en Datos no cambia.';
  }
  if (scope === 'today') return 'Lo quita solo este día.';
  if (scope === 'fromToday') return 'Lo quita desde este día en adelante. Los días anteriores lo conservan.';
  return 'Lo quita de todos los días, también los pasados. Lo registrado en Datos no se borra.';
}
