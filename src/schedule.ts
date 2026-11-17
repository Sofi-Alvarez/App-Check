import {
  Block, BlockInfo, DayType, LIST_KEYS, blockInfo, dayType, defaultBlocks, iso, parseISO, secondsOfDay,
} from './agenda';
import { Sched, flagDone, loadDay, loadOverride, loadSched, saveDay, saveOverride, saveSched, setFlag } from './store';
import Storage from 'expo-sqlite/kv-store';

const byStart = (list: Block[]) => [...list].sort((a, b) => a.s - b.s || a.e - b.e);

/** Lista efectiva de un tipo de día: la editada con "Siempre" o, si no hay, la original. */
export function listFor(type: DayType, sched: Sched = loadSched()): Block[] {
  return sched[type] ?? defaultBlocks(type);
}

/** Bloques de una fecha: la edición "Solo hoy" gana sobre la lista del tipo de día. */
export function blocksFor(d: Date, anchor: string): Block[] | null {
  const type = dayType(d, anchor);
  if (!type) return null;
  return loadOverride(iso(d)) ?? listFor(type);
}

export function currentBlockInfo(now: Date, anchor: string): BlockInfo | null {
  const blocks = blocksFor(now, anchor);
  if (!blocks) return null;
  const sec = secondsOfDay(now);
  const b = blocks.find((x) => sec >= x.s * 60 && sec < x.e * 60);
  return b ? blockInfo(iso(now), b) : null;
}

export interface TaskDraft {
  id: string | null; // null = tarea nueva
  t: string;
  c: Block['c'];
  s: number;
  e: number;
  n: string;
}
export type Scope = { kind: 'today' } | { kind: 'always'; lists: DayType[] };

export const newTaskId = () => `u-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Tareas de `list` que se pisan con el rango [s, e), sin contar la propia. */
export function overlaps(list: Block[], s: number, e: number, selfId: string | null): Block[] {
  return list.filter((b) => b.id !== selfId && b.s < e && s < b.e);
}

function upsert(list: Block[], draft: TaskDraft, id: string): Block[] {
  const next: Block = { id, s: draft.s, e: draft.e, t: draft.t.trim(), c: draft.c, n: draft.n.trim() };
  const has = list.some((b) => b.id === id);
  return byStart(has ? list.map((b) => (b.id === id ? next : b)) : [...list, next]);
}

/** Guarda una tarea nueva o editada según el alcance elegido. Devuelve el id usado. */
export function saveTask(draft: TaskDraft, scope: Scope, dayIso: string, anchor: string): string {
  const id = draft.id ?? newTaskId();
  if (scope.kind === 'today') {
    const type = dayType(parseISO(dayIso), anchor);
    const base = loadOverride(dayIso) ?? (type ? listFor(type) : []);
    saveOverride(dayIso, upsert(base, draft, id));
    return id;
  }
  const sched = loadSched();
  const next: Sched = { ...sched };
  for (const key of LIST_KEYS) {
    const list = listFor(key, sched);
    if (scope.lists.includes(key)) next[key] = upsert(list, draft, id);
    else if (draft.id && list.some((b) => b.id === id)) next[key] = list.filter((b) => b.id !== id);
  }
  saveSched(next);
  return id;
}

export function deleteTask(id: string, scope: Scope, dayIso: string, anchor: string) {
  if (scope.kind === 'today') {
    const type = dayType(parseISO(dayIso), anchor);
    const base = loadOverride(dayIso) ?? (type ? listFor(type) : []);
    saveOverride(dayIso, base.filter((b) => b.id !== id));
    return;
  }
  const sched = loadSched();
  const next: Sched = { ...sched };
  for (const key of scope.lists) next[key] = listFor(key, sched).filter((b) => b.id !== id);
  saveSched(next);
}

/** Las marcas de "hecho" antiguas usaban la posición del bloque; ahora usan su id. Se convierte una sola vez. */
export function migrateDoneToIds(anchor: string) {
  if (flagDone('doneIds')) return;
  try {
    for (const key of Storage.getAllKeysSync()) {
      if (!key.startsWith('agenda:day:')) continue;
      const day = key.slice('agenda:day:'.length);
      const data = loadDay(day);
      const legacy = Object.keys(data.done).filter((k) => /^\d+$/.test(k));
      if (legacy.length === 0) continue;
      const type = dayType(parseISO(day), anchor);
      const blocks = type ? defaultBlocks(type) : [];
      const done = { ...data.done };
      for (const k of legacy) {
        delete done[k];
        const b = blocks[Number(k)];
        if (b) done[b.id] = true;
      }
      saveDay(day, { ...data, done });
    }
    setFlag('doneIds');
  } catch {}
}

// ---- Margen de tiempo ----------------------------------------------------------------------
// Al terminar una tarea antes o después de lo planificado, los minutos de diferencia pasan a otra
// tarea de ese mismo día. Las tareas del medio se corren esos minutos y la elegida absorbe el cambio
// (más larga si sobró tiempo, más corta si te pasaste) sin mover su hora de fin. Las tareas fijas
// (clases, viajes) nunca se mueven, así que el traspaso no puede cruzarlas.
export const MARGIN_MIN = 5; // diferencias menores a esto no se ofrecen
export const MIN_TASK = 5; // una tarea no puede quedar de menos de 5 min

export interface MarginOption {
  id: string;
  title: string;
  cat: string;
  oldS: number;
  oldE: number;
  newS: number;
  newE: number;
  ok: boolean;
}
export interface MarginPlan {
  aId: string;
  aTitle: string;
  day: string;
  slack: number; // + terminaste antes, − te pasaste (minutos)
  options: MarginOption[];
  defaultId: string | null;
}

/** `endMin` es la hora real en que terminó la tarea, en minutos desde la medianoche. */
export function planMargin(day: string, anchor: string, aId: string, endMin: number): MarginPlan | null {
  const blocks = blocksFor(parseISO(day), anchor);
  if (!blocks) return null;
  const sorted = [...blocks].sort((a, b) => a.s - b.s || a.e - b.e);
  const i = sorted.findIndex((b) => b.id === aId);
  if (i < 0 || sorted[i].c === 'fixed') return null;
  const slack = sorted[i].e - endMin;
  if (Math.abs(slack) < MARGIN_MIN) return null;
  const options: MarginOption[] = [];
  for (let j = i + 1; j < sorted.length; j++) {
    const x = sorted[j];
    if (x.c === 'fixed') break;
    const newS = x.s - slack;
    options.push({ id: x.id, title: x.t, cat: x.c, oldS: x.s, oldE: x.e, newS, newE: x.e, ok: x.e - newS >= MIN_TASK });
  }
  if (options.length === 0) return null;
  const def = options.find((o) => o.ok && o.cat !== 'rest') ?? options.find((o) => o.ok) ?? null;
  return { aId, aTitle: sorted[i].t, day, slack, options, defaultId: def ? def.id : null };
}

/** Aplica el traspaso como edición "solo ese día". Devuelve false si no se pudo. */
export function applyMargin(plan: MarginPlan, targetId: string, anchor: string): boolean {
  const opt = plan.options.find((o) => o.id === targetId);
  const blocks = blocksFor(parseISO(plan.day), anchor);
  if (!opt || !opt.ok || !blocks) return false;
  const sorted = [...blocks].sort((a, b) => a.s - b.s || a.e - b.e);
  const iA = sorted.findIndex((b) => b.id === plan.aId);
  const iT = sorted.findIndex((b) => b.id === targetId);
  if (iA < 0 || iT <= iA) return false;
  const d = -plan.slack;
  saveOverride(
    plan.day,
    sorted.map((b, k) => {
      if (k === iA) return { ...b, e: b.e + d };
      if (k > iA && k < iT) return { ...b, s: b.s + d, e: b.e + d };
      if (k === iT) return { ...b, s: b.s + d };
      return b;
    }),
  );
  return true;
}
