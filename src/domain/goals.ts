// Progreso de metas (spec 010, 3.5; T2.5). Funciones puras.
//
// - Cantidad: suma de conteos.
// - Tiempo: minutos de sesiones confirmadas de los eventos asociados. Las sesiones cerradas solas (`auto_close`) no
//   cuentan, igual que en la pestaña Datos. Una sesión todavía abierta tampoco cuenta.
// - Cantidad y tiempo: las dos cuentas por separado, y "N en M min" por sesión.
// - El objetivo de un día sale de la versión vigente ese día, así subir una meta no vuelve incumplidos los días pasados.

import { weekdayOf } from './dates';
import type { AgendaState, Goal, GoalVersion } from './types';

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

// ---- Gestión de metas (spec 009, sección 5; T5.1) -----------------------------------------------------------------


export interface GoalInput {
  name: string;
  kind: Goal['kind'];
  unit: string;
  target: number | null;
  period: 'day' | 'week';
  activeDays: number[];
  links: string[];
  /** "HH:MM" o `null`. */
  reminder: string | null;
}

export type GoalError =
  | 'name-empty' | 'name-too-long' | 'name-taken' | 'unit-required' | 'unit-too-long'
  | 'bad-target' | 'no-days' | 'time-needs-event' | 'bad-reminder';

export type GoalScope = 'fromToday' | 'always';
export type GoalOpResult = { ok: true; state: AgendaState; id: string } | { ok: false; error: GoalError[] | 'not-found' };

let counter = 0;
export const newGoalId = () => `m-${Date.now().toString(36)}${(counter++ % 1296).toString(36)}`;

export function validateGoal(st: AgendaState, g: GoalInput, selfId: string | null): GoalError[] {
  const errs: GoalError[] = [];
  const name = g.name.trim();
  if (!name) errs.push('name-empty');
  else if (name.length > 60) errs.push('name-too-long');
  else if (st.goals.some((x) => x.id !== selfId && !x.archived && x.name.trim().toLowerCase() === name.toLowerCase())) errs.push('name-taken');
  if (g.kind !== 'time' && !g.unit.trim()) errs.push('unit-required');
  if (g.unit.trim().length > 20) errs.push('unit-too-long');
  if (g.target !== null && !(Number.isFinite(g.target) && g.target > 0)) errs.push('bad-target');
  if (g.activeDays.length === 0) errs.push('no-days');
  if (g.kind !== 'quantity' && g.links.length === 0) errs.push('time-needs-event');
  if (g.reminder !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(g.reminder)) errs.push('bad-reminder');
  return errs;
}

/** Crea una meta (CG-22, CG-23, CG-28). Su primera versión rige desde `today`. */
export function createGoal(st: AgendaState, g: GoalInput, today: string, id: string = newGoalId()): GoalOpResult {
  const errs = validateGoal(st, g, null);
  if (errs.length) return { ok: false, error: errs };
  const goal: Goal = {
    id, name: g.name.trim(), kind: g.kind, unit: g.kind === 'time' ? '' : g.unit.trim(), links: [...new Set(g.links)],
    reminder: g.reminder, archived: false,
    versions: [{ effectiveFrom: today, target: g.target, period: g.period, activeDays: [...new Set(g.activeDays)].sort() }],
  };
  return { ok: true, id, state: { ...st, goals: [...st.goals, goal] } };
}

/** `true` si el cambio toca objetivo, período o días: en ese caso hay que elegir alcance (spec 009, 5.2). */
export function goalNeedsScope(goal: Goal, g: GoalInput, today: string): boolean {
  const v = goalVersionOn(goal, today);
  const days = (a: number[]) => [...new Set(a)].sort().join();
  return v.target !== g.target || v.period !== g.period || days(v.activeDays) !== days(g.activeDays);
}

/**
 * Edita una meta. Nombre, unidad, eventos asociados y aviso se aplican de inmediato. Objetivo, período y días:
 * - "A partir de hoy": versión nueva desde hoy; los días anteriores se siguen comparando con lo que tenían (CG-24).
 * - "Siempre": reescribe todo el historial con los valores nuevos (CG-25).
 */
export function updateGoal(st: AgendaState, id: string, g: GoalInput, scope: GoalScope, today: string): GoalOpResult {
  const cur = st.goals.find((x) => x.id === id);
  if (!cur) return { ok: false, error: 'not-found' };
  const errs = validateGoal(st, g, id);
  if (errs.length) return { ok: false, error: errs };
  const version = { target: g.target, period: g.period, activeDays: [...new Set(g.activeDays)].sort() };
  let versions = cur.versions;
  if (goalNeedsScope(cur, g, today)) {
    if (scope === 'always') {
      const first = [...cur.versions].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))[0].effectiveFrom;
      versions = [{ effectiveFrom: first, ...version }];
    } else {
      versions = [...cur.versions.filter((v) => v.effectiveFrom !== today), { effectiveFrom: today, ...version }]
        .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    }
  }
  const next: Goal = {
    ...cur, name: g.name.trim(), kind: g.kind, unit: g.kind === 'time' ? '' : g.unit.trim(), links: [...new Set(g.links)],
    reminder: g.reminder, versions,
  };
  return { ok: true, id, state: { ...st, goals: st.goals.map((x) => (x.id === id ? next : x)) } };
}

/** Archiva (desaparece de Metas desde hoy; el historial y los conteos se conservan) o reactiva (CG-26). */
export function setGoalArchived(st: AgendaState, id: string, archived: boolean): GoalOpResult {
  const cur = st.goals.find((x) => x.id === id);
  if (!cur) return { ok: false, error: 'not-found' };
  if (!archived && st.goals.some((x) => x.id !== id && !x.archived && x.name.trim().toLowerCase() === cur.name.trim().toLowerCase())) {
    return { ok: false, error: ['name-taken'] };
  }
  return { ok: true, id, state: { ...st, goals: st.goals.map((x) => (x.id === id ? { ...x, archived } : x)) } };
}

/**
 * Elimina la definición (CG-27). Los conteos guardados por día y los eventos `count` del registro no se tocan: siguen
 * en Datos y en el CSV con el nombre que tenía la meta (`goalName`).
 */
export function deleteGoal(st: AgendaState, id: string): GoalOpResult {
  if (!st.goals.some((x) => x.id === id)) return { ok: false, error: 'not-found' };
  return { ok: true, id, state: { ...st, goals: st.goals.filter((x) => x.id !== id) } };
}
