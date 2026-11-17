// Margen de tiempo (misma regla que `planMargin` y `applyMargin` de `schedule.ts`), pero sobre las propiedades de las
// categorías en vez de los nombres `fixed` y `rest`. Funciones puras.

import type { CategoryInfo, EngineBlock, MarginOption, MarginPlan } from './types';

export const MARGIN_MIN = 5; // diferencias menores a esto no se ofrecen
export const MIN_TASK = 5; // una tarea no puede quedar de menos de 5 min

const byStart = (list: EngineBlock[]) => [...list].sort((a, b) => a.s - b.s || a.e - b.e);

/** `endMin` es la hora real en que terminó la tarea, en minutos desde la medianoche. */
export function planMarginFor(
  day: string, blocks: EngineBlock[], cat: (id: string) => CategoryInfo, aId: string, endMin: number,
): MarginPlan | null {
  const sorted = byStart(blocks);
  const i = sorted.findIndex((b) => b.id === aId);
  if (i < 0 || !cat(sorted[i].c).movable) return null;
  const slack = sorted[i].e - endMin;
  if (Math.abs(slack) < MARGIN_MIN) return null;
  const options: MarginOption[] = [];
  for (let j = i + 1; j < sorted.length; j++) {
    const x = sorted[j];
    if (!cat(x.c).movable) break;
    const newS = x.s - slack;
    options.push({ id: x.id, title: x.t, cat: x.c, oldS: x.s, oldE: x.e, newS, newE: x.e, ok: x.e - newS >= MIN_TASK });
  }
  if (options.length === 0) return null;
  const def = options.find((o) => o.ok && cat(o.cat).marginPreference !== 'avoid') ?? options.find((o) => o.ok) ?? null;
  return { aId, aTitle: sorted[i].t, day, slack, options, defaultId: def ? def.id : null };
}

/** Lista del día con el margen aplicado, o `null` si no se puede aplicar. */
export function applyMarginTo(plan: MarginPlan, blocks: EngineBlock[], targetId: string): EngineBlock[] | null {
  const opt = plan.options.find((o) => o.id === targetId);
  if (!opt || !opt.ok) return null;
  const sorted = byStart(blocks);
  const iA = sorted.findIndex((b) => b.id === plan.aId);
  const iT = sorted.findIndex((b) => b.id === targetId);
  if (iA < 0 || iT <= iA) return null;
  const d = -plan.slack;
  return sorted.map((b, k) => {
    if (k === iA) return { ...b, e: b.e + d };
    if (k > iA && k < iT) return { ...b, s: b.s + d, e: b.e + d };
    if (k === iT) return { ...b, s: b.s + d };
    return b;
  });
}
