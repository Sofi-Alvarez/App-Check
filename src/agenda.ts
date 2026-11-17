import { S } from './i18n';
// Utilidades de fechas y horas de la interfaz.

// Nombres de días y meses de la interfaz: salen del diccionario (T6.4).
export const MESES = S.dates.months;
export const DIAS = S.dates.days;
export const INIT = S.dates.initials;

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const hm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
export const secondsOfDay = (d: Date) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
export const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();


/** "Semana del 16 al 22 de noviembre" (de lunes a domingo). */
export function weekRangeLabel(mon: Date): string {
  const sun = addDays(mon, 6);
  return S.agenda.weekRange(mon.getDate(), mon.getMonth() !== sun.getMonth() ? MESES[mon.getMonth()] : '', sun.getDate(), MESES[sun.getMonth()]);
}

export interface BlockInfo { bid: string; day: string; title: string; cat: string; planS: number; planE: number }
