// Progreso de metas (spec 010, 3.5; T2.5). Funciones puras.
//
// - Cantidad: suma de conteos.
// - Tiempo: minutos de sesiones confirmadas de los eventos asociados. Las sesiones cerradas solas (`auto_close`) no
//   cuentan, igual que en la pestaña Datos. Una sesión todavía abierta tampoco cuenta.
// - Cantidad y tiempo: las dos cuentas por separado, y "N en M min" por sesión.
// - El objetivo de un día sale de la versión vigente ese día, así subir una meta no vuelve incumplidos los días pasados.

import { weekdayOf } from './dates';
import type { Goal, GoalVersion } from './types';

/** Versión vigente en una fecha: la última con `effectiveFrom` ≤ fecha (vacío cuenta como "desde siempre"). */
export function goalVersionOn(goal: Goal, date: string): GoalVersion {
  const sorted = [...goal.versions].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0));
  let current = sorted[0];
  for (const v of sorted) if (v.effectiveFrom <= date) current = v;
  return current;
}

export const isActiveOn = (goal: Goal, date: string) =>
  !goal.archived && goalVersionOn(goal, date).activeDays.includes(weekdayOf(date));

/** Objetivo de ese día para una meta diaria (`null` si no aplica ese día o no tiene objetivo). */
export function dailyTarget(goal: Goal, date: string): number | null {
  const v = goalVersionOn(goal, date);
  return v.period === 'day' && isActiveOn(goal, date) ? v.target : null;
}

export interface Progress {
  value: number;
  /** `null` = sin objetivo en el período. */
  target: number | null;
}

/**
 * Progreso de cantidad en un conjunto de días (un día o una semana). Para metas diarias, el objetivo es la suma de los
 * objetivos de los días en que aplica; para semanales, el de la versión vigente el primer día.
 */
export function quantityProgress(goal: Goal, dates: string[], countOn: (date: string) => number): Progress {
  const value = dates.reduce((a, d) => a + countOn(d), 0);
  return { value, target: periodTarget(goal, dates) };
}

function periodTarget(goal: Goal, dates: string[]): number | null {
  if (dates.length === 0) return null;
  const first = goalVersionOn(goal, dates[0]);
  if (first.period === 'week') return first.target;
  let sum = 0;
  let any = false;
  for (const d of dates) {
    const t = dailyTarget(goal, d);
    if (t != null) {
      sum += t;
      any = true;
    }
  }
  return any ? sum : null;
}

/** Sesión mínima que necesita el cálculo de tiempo (subconjunto de `Session` de `sessions.ts`). */
export interface SessionLike {
  bid: string;
  day: string;
  activeMs: number;
  endedBy: 'manual' | 'next' | 'auto_close' | 'open';
  counts: Record<string, number>;
}

const confirmed = (s: SessionLike) => s.endedBy === 'manual' || s.endedBy === 'next';

/**
 * Minutos de sesiones confirmadas de los eventos asociados a la meta, en esos días. `matches` decide si una sesión
 * (por su `bid`) pertenece a un evento asociado: así se resuelven los ids originales de series separadas.
 */
export function timeProgress(goal: Goal, dates: string[], sessions: SessionLike[], matches: (bid: string) => boolean): Progress {
  const days = new Set(dates);
  const ms = sessions.filter((s) => days.has(s.day) && confirmed(s) && matches(s.bid)).reduce((a, s) => a + s.activeMs, 0);
  return { value: Math.round(ms / 60000), target: periodTarget(goal, dates) };
}

/** "N en M min" de una sesión para una meta de cantidad y tiempo (o `null` si no hubo conteos). */
export function countPerTime(goalId: string, s: SessionLike): { count: number; minutes: number } | null {
  const count = s.counts[goalId] ?? 0;
  if (count <= 0) return null;
  return { count, minutes: Math.round(s.activeMs / 60000) };
}
