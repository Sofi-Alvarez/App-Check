// Utilidades de fechas "AAAA-MM-DD" sin zona horaria: se calculan sobre números de día (UTC), así el resultado es el
// mismo en el teléfono y en la integración continua.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Días desde el 01/01/1970. */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNumber(n: number): string {
  const dt = new Date(n * DAY_MS);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** `true` si el texto tiene formato de fecha y es una fecha real (descarta "2026-02-30"). */
export function isValidDate(date: string): boolean {
  return DATE_RE.test(date) && fromDayNumber(dayNumber(date)) === date;
}

export const addDaysISO = (date: string, n: number) => fromDayNumber(dayNumber(date) + n);

/** 0 = domingo … 6 = sábado. El 01/01/1970 fue jueves. */
export const weekdayOf = (date: string) => (((dayNumber(date) + 4) % 7) + 7) % 7;

/** Número de día del lunes de la semana de esa fecha. */
export const mondayNumber = (date: string) => dayNumber(date) - ((weekdayOf(date) + 6) % 7);

/** Año, mes (1 a 12) y día de una fecha. */
export const dateParts = (date: string): [number, number, number] => date.split('-').map(Number) as [number, number, number];

/** Cantidad de días de un mes (mes de 1 a 12). */
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Semana del mes en la que cae la fecha (1 = días 1 a 7, …, 5 = días 29 a 31) y si es la última de su día. */
export function monthWeekOf(date: string): { nth: number; last: boolean } {
  const [y, m, d] = dateParts(date);
  return { nth: Math.floor((d - 1) / 7) + 1, last: d + 7 > daysInMonth(y, m) };
}

/** Fecha más temprana de una lista (`null` si está vacía). */
export const minDate = (dates: string[]) => (dates.length ? dates.reduce((a, b) => (b < a ? b : a)) : null);
