// Migración del almacén v1 al modelo v2 (spec 010, sección 4.2). La parte central es pura: recibe las entradas del
// almacén y la fecha de hoy y devuelve qué escribir. `migrateRepository()` la aplica sobre la capa de acceso.
//
// Garantías:
// - Autoverificación: antes de escribir nada, compara día por día la agenda v1 con la v2 (desde el primer dato hasta
//   8 semanas en el futuro). Si un solo día no coincide, no migra.
// - No se borra ninguna clave v1. Se escribe primero una copia completa (`backup:v1:*` y una marca de copia completa),
//   después el modelo v2 y al final `agenda:schemaVersion = 2`. Si algo se corta, el siguiente intento parte de la copia.
// - El registro de uso (`agenda:log:*`) no se toca nunca.

import { Block, DayType, LIST_KEYS, dayType, parseISO } from '../agenda';
import { SEED_CATEGORIES, unknownCategory } from '../domain/categories';
import { DATE_RE, addDaysISO, fromDayNumber, minDate, mondayNumber } from '../domain/dates';
import { buildDay } from '../domain/recurrence';
import type { AgendaState, Category, ExceptionFields, Goal, Series, SeriesException, SettingsV2 } from '../domain/types';
import type { Repository } from '../data/repository';
import { KEYS } from '../data/repository';
import type { DayData } from '../storeShape';
import { Entry, V1State, readV1, v1BlocksFor, v1ListFor } from './v1-reader';

export const BACKUP_COMPLETE_KEY = `${KEYS.backupPrefix}__complete`;
/** Semanas hacia adelante que cubre la autoverificación. */
export const VERIFY_FUTURE_DAYS = 56;
/**
 * Días hacia atrás desde el primer dato en que las series ya existen. La v1 mostraba la agenda en cualquier fecha
 * pasada (las listas no tenían fecha de inicio); con un año hacia atrás, navegar al pasado se sigue viendo igual.
 * 364 = 52 semanas exactas, para no correr días de la semana. La autoverificación también cubre ese año.
 */
export const HISTORY_DAYS = 364;

// ---- Reglas por tipo de día ----------------------------------------------------------------------------------------

/** Paridad de semana: `*` = todas, `A` = semanas del martes con adscripción, `B` = semanas del martes sin adscripción. */
type Parity = '*' | 'A' | 'B';
const LIST_SLOTS: Record<DayType, { weekdays: number[]; parity: Parity }> = {
  mwf: { weekdays: [1, 3], parity: '*' },
  tueOff: { weekdays: [2], parity: 'B' },
  tueAds: { weekdays: [2], parity: 'A' },
  thu: { weekdays: [4], parity: '*' },
  fri: { weekdays: [5], parity: '*' },
};

export interface SeriesStarts {
  /** Lunes de la semana del primer dato: inicio de las series semanales. */
  weekly: string;
  /** Lunes de una semana "A" (martes con adscripción) no posterior a `weekly`. */
  a: string;
  /** Lunes de la semana "B" siguiente a `a`. */
  b: string;
}

/** Inicios de las series para que cubran desde `earliest` y respeten la alternancia del ancla. */
export function seriesStarts(earliest: string, anchor: string): SeriesStarts {
  const m = mondayNumber(earliest);
  const offset = (((m - mondayNumber(anchor)) / 7) % 2 + 2) % 2; // 0 = la semana de `earliest` es A
  const a = m - offset * 7;
  return { weekly: fromDayNumber(m), a: fromDayNumber(a), b: fromDayNumber(a + 7) };
}

// ---- Listas por tipo de día → series ------------------------------------------------------------------------------

export interface SeriesBuild {
  series: Series[];
  legacyBid: Record<string, string>;
  /** Ids originales que tuvieron que separarse en más de una serie. */
  split: string[];
}

const fieldsKey = (b: Block) => JSON.stringify([b.s, b.e, b.t, b.c, b.n]);

/**
 * Convierte las listas de cada tipo de día en series. Una misma tarea (mismo id) con los mismos datos en varias listas
 * se une en una serie; si los datos difieren, o si la combinación de días no se puede expresar con una sola regla, se
 * separa. La primera serie de cada id conserva el id original; las demás reciben uno nuevo y quedan en `legacyBid`.
 */
export function seriesFromLists(lists: Record<DayType, Block[]>, starts: SeriesStarts): SeriesBuild {
  // id → datos → listas en que aparece (en el orden de LIST_KEYS)
  const byId = new Map<string, Map<string, { block: Block; keys: DayType[] }>>();
  for (const key of LIST_KEYS) {
    for (const b of lists[key]) {
      const variants = byId.get(b.id) ?? new Map();
      byId.set(b.id, variants);
      const fk = fieldsKey(b);
      const v = variants.get(fk) ?? { block: b, keys: [] };
      if (!v.keys.includes(key)) v.keys.push(key);
      variants.set(fk, v);
    }
  }

  const series: Series[] = [];
  const legacyBid: Record<string, string> = {};
  const split: string[] = [];
  const used = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  // Los ids originales se reservan primero para que un id nuevo nunca coincida con uno original.
  for (const id of byId.keys()) used.add(id);

  for (const [origId, variants] of byId) {
    const parts: { block: Block; weekdays: number[]; everyWeeks: number; start: string; tag: string }[] = [];
    for (const { block, keys } of variants.values()) {
      const cover = new Map<number, Set<Parity>>();
      for (const k of keys) {
        for (const d of LIST_SLOTS[k].weekdays) {
          const set = cover.get(d) ?? new Set<Parity>();
          set.add(LIST_SLOTS[k].parity);
          cover.set(d, set);
        }
      }
      const full: number[] = [];
      const onlyA: number[] = [];
      const onlyB: number[] = [];
      for (const [d, ps] of [...cover].sort((x, y) => x[0] - y[0])) {
        if (ps.has('*') || (ps.has('A') && ps.has('B'))) full.push(d);
        else if (ps.has('A')) onlyA.push(d);
        else onlyB.push(d);
      }
      const tag = keys.join('+');
      if (full.length) parts.push({ block, weekdays: full, everyWeeks: 1, start: starts.weekly, tag });
      if (onlyA.length) parts.push({ block, weekdays: onlyA, everyWeeks: 2, start: starts.a, tag: `${tag}-a` });
      if (onlyB.length) parts.push({ block, weekdays: onlyB, everyWeeks: 2, start: starts.b, tag: `${tag}-b` });
    }
    if (parts.length > 1) split.push(origId);
    parts.forEach((p, i) => {
      const id = i === 0 ? origId : uniqueId(`${origId}~${p.tag}`);
      if (i > 0) legacyBid[id] = origId;
      series.push({
        id, title: p.block.t, categoryId: p.block.c, startMin: p.block.s, endMin: p.block.e, note: p.block.n,
        rule: { weekdays: p.weekdays, everyWeeks: p.everyWeeks }, startDate: p.start, endDate: null, reminder: null,
        archived: false,
      });
    });
  }
  return { series, legacyBid, split };
}

// ---- Metas de la v1 -----------------------------------------------------------------------------------------------

/**
 * Las metas fijas de `agenda.ts` (G_BASE, G_ADS, G_THU) como metas v2, más "Proyecto" y "Ejercicio" de la pantalla de
 * Metas. Aproximaciones documentadas en el informe de la migración:
 * - Los días en que aplica son días de la semana; la v1 distinguía martes con y sin adscripción. Solo afecta a
 *   "Postulaciones", que no tiene objetivo.
 * - "Proyecto" y "Ejercicio" pasan a metas de tiempo semanales sin objetivo, asociadas a las series de esas categorías.
 *   La v1 calculaba horas planificadas hechas y sesiones marcadas; el cálculo nuevo es de la fase 2 (T2.5).
 */
export function legacyGoals(effectiveFrom: string, series: Series[]): Goal[] {
  const v = (target: number | null, activeDays: number[], period: 'day' | 'week' = 'day') => [
    { effectiveFrom, target, period, activeDays },
  ];
  const all = [1, 2, 3, 4, 5];
  const notThu = [1, 2, 3, 5];
  const linked = (cat: string) => series.filter((s) => s.categoryId === cat).map((s) => s.id);
  const g = (id: string, name: string, unit: string, versions: Goal['versions'], kind: Goal['kind'] = 'quantity', links: string[] = []): Goal => ({
    id, name, kind, unit, links, reminder: null, archived: false, versions,
  });
  return [
    g('post', 'Posts', 'posts', v(1, all)),
    g('com', 'Comentarios', 'comentarios', v(5, notThu)),
    g('rea', 'Reacciones', 'reacciones', v(10, notThu)),
    g('cold', 'Cold outreach', 'mensajes', v(10, all)),
    g('fol', 'Follow-up', 'mensajes', v(10, notThu)),
    g('apl', 'Postulaciones', 'postulaciones', v(null, notThu)),
    g('proyecto', 'Proyecto', '', v(null, all, 'week'), 'time', linked('project')),
    g('ejercicio', 'Ejercicio', '', v(null, all, 'week'), 'time', linked('health')),
  ];
}

// ---- Migración pura -----------------------------------------------------------------------------------------------

export interface MigrationReport {
  sourceUsed: 'store' | 'backup';
  series: number;
  /** Ids originales separados en varias series (caso difícil). */
  split: string[];
  exceptions: { cancelled: number; modified: number };
  /** Tareas agregadas "Solo hoy", convertidas en eventos de un día. */
  oneOff: number;
  /** Ediciones de sábado o domingo: la v1 nunca las mostró; se conservan en la copia y no se migran. */
  ignoredWeekendOverrides: string[];
  /** Días cuyas marcas de hecho se reescribieron al id nuevo de una serie separada. */
  renamedDone: string[];
  /** Claves que la v1 no reconoce: no se tocan y quedan en la copia. */
  unknownKeys: string[];
  /** Categorías creadas para ids que no estaban entre las 8 conocidas. */
  extraCategories: string[];
  verifiedDays: number;
  notes: string[];
}

export interface Mismatch {
  date: string;
  v1: string[];
  v2: string[];
}

export type MigrationResult =
  | { ok: true; agenda: AgendaState; settings: SettingsV2; writes: Entry[]; report: MigrationReport }
  | { ok: false; error: string; mismatches: Mismatch[] };

/** Entradas v1 a migrar: las de la copia si está completa (reintento), si no las del almacén sin claves v2 ni copias. */
export function sourceEntries(entries: Entry[]): { entries: Entry[]; from: 'store' | 'backup' } {
  const complete = entries.find(([k]) => k === BACKUP_COMPLETE_KEY);
  const backup = entries.filter(([k]) => k.startsWith(KEYS.backupPrefix) && k !== BACKUP_COMPLETE_KEY);
  if (complete && Number(complete[1]) === backup.length) {
    return { entries: backup.map(([k, v]) => [k.slice(KEYS.backupPrefix.length), v]), from: 'backup' };
  }
  const isV2 = (k: string) => k.startsWith('agenda2:') || k === KEYS.schemaVersion || k.startsWith('backup:');
  return { entries: entries.filter(([k]) => !isV2(k)), from: 'store' };
}

/** Fechas con algún dato en la v1 (días, registro, ediciones de un día y sesión en curso). */
function dataDates(st: V1State): string[] {
  const ds = new Set<string>([...Object.keys(st.days), ...Object.keys(st.overrides), ...st.logKeys]);
  for (const e of st.logs) if (typeof e.day === 'string' && DATE_RE.test(e.day)) ds.add(e.day);
  if (st.active?.day && DATE_RE.test(st.active.day)) ds.add(st.active.day);
  return [...ds].sort();
}

const diffFields = (base: { s: number; e: number; t: string; c: string; n: string }, o: Block): ExceptionFields => {
  const f: ExceptionFields = {};
  if (o.s !== base.s) f.startMin = o.s;
  if (o.e !== base.e) f.endMin = o.e;
  if (o.t !== base.t) f.title = o.t;
  if (o.c !== base.c) f.categoryId = o.c;
  if (o.n !== base.n) f.note = o.n;
  return f;
};

const norm = (bs: { id: string; s: number; e: number; t: string; c: string; n: string }[]) =>
  bs
    .map((b) => JSON.stringify([b.s, b.e, b.id, b.t, b.c, b.n]))
    .sort();

export function migrateV1(allEntries: Entry[], today: string): MigrationResult {
  const src = sourceEntries(allEntries);
  const st = readV1(src.entries);
  const anchor = st.settings.anchor;
  const dates = dataDates(st);
  const earliest = addDaysISO(minDate([...dates, anchor, today])!, -HISTORY_DAYS);
  const starts = seriesStarts(earliest, anchor);
  const notes: string[] = [];

  // 1. Series desde las listas de cada tipo de día.
  const lists = Object.fromEntries(LIST_KEYS.map((k) => [k, v1ListFor(st, k)])) as Record<DayType, Block[]>;
  const built = seriesFromLists(lists, starts);
  const series = built.series;
  const legacyBid = { ...built.legacyBid };
  const legacyOf = (id: string) => legacyBid[id] ?? id;

  // 2. Ediciones de un día → excepciones y eventos de un día.
  const exceptions: SeriesException[] = [];
  const ignoredWeekendOverrides: string[] = [];
  let oneOff = 0;
  const taken = new Set(series.map((s) => s.id));
  for (const date of Object.keys(st.overrides).sort()) {
    if (!dayType(parseISO(date), anchor)) {
      ignoredWeekendOverrides.push(date);
      continue;
    }
    const base = buildDay({ series, exceptions: [] }, date);
    const remaining = [...st.overrides[date]];
    for (const b of base) {
      const i = remaining.findIndex((o) => o.id === legacyOf(b.id));
      if (i < 0) {
        exceptions.push({ seriesId: b.id, date, kind: 'cancelled' });
        continue;
      }
      const [o] = remaining.splice(i, 1);
      const fields = diffFields(b, o);
      if (Object.keys(fields).length) exceptions.push({ seriesId: b.id, date, kind: 'modified', fields });
    }
    for (const o of remaining) {
      let id = o.id;
      if (taken.has(id)) {
        let n = 1;
        id = `${o.id}@${date}`;
        while (taken.has(id)) id = `${o.id}@${date}-${++n}`;
        legacyBid[id] = o.id;
      }
      taken.add(id);
      series.push({
        id, title: o.t, categoryId: o.c, startMin: o.s, endMin: o.e, note: o.n, rule: null, startDate: date,
        endDate: null, reminder: null, archived: false,
      });
      oneOff++;
    }
  }

  // 3. Categorías: las 8 iniciales más cualquier id raro que aparezca en la agenda.
  const categories: Category[] = SEED_CATEGORIES.map((c) => ({ ...c }));
  const extraCategories: string[] = [];
  for (const s of series) {
    if (!categories.some((c) => c.id === s.categoryId)) {
      categories.push(unknownCategory(s.categoryId));
      extraCategories.push(s.categoryId);
    }
  }

  // 4. Metas.
  const goals = legacyGoals(starts.weekly, series);
  notes.push(
    'Las metas aplican por día de la semana; la v1 distinguía martes con y sin adscripción (solo afecta a Postulaciones, sin objetivo).',
    'Proyecto y Ejercicio pasan a metas de tiempo semanales sin objetivo; su cálculo nuevo se define en la fase 2 (T2.5).',
  );

  const agenda: AgendaState = { categories, series, exceptions, goals, legacyBid };

  // 5. Autoverificación: la agenda v2 de cada día tiene que ser idéntica a la v1.
  const mismatches: Mismatch[] = [];
  const lastData = dates.at(-1);
  const last = addDaysISO(lastData !== undefined && lastData > today ? lastData : today, VERIFY_FUTURE_DAYS);
  let verifiedDays = 0;
  for (let d = earliest; d <= last; d = addDaysISO(d, 1)) {
    const v1 = norm(v1BlocksFor(st, d) ?? []);
    const v2 = norm(buildDay(agenda, d).map((b) => ({ ...b, id: legacyOf(b.id) })));
    verifiedDays++;
    if (JSON.stringify(v1) !== JSON.stringify(v2)) mismatches.push({ date: d, v1, v2 });
  }
  if (mismatches.length) {
    return {
      ok: false,
      error: `La agenda migrada no coincide con la actual en ${mismatches.length} día(s). No se migró nada.`,
      mismatches,
    };
  }

  // 6. Marcas de hecho de series separadas: se reescriben al id nuevo de ese día.
  const dayWrites: Entry[] = [];
  const renamedDone: string[] = [];
  for (const [date, data] of Object.entries(st.days).sort()) {
    const blocks = buildDay(agenda, date);
    const ids = new Set(blocks.map((b) => b.id));
    let changed = false;
    const done: DayData['done'] = {};
    for (const [k, val] of Object.entries(data.done)) {
      const target = ids.has(k) ? k : blocks.find((b) => legacyOf(b.id) === k)?.id;
      if (target && target !== k) changed = true;
      done[target ?? k] = val;
    }
    if (changed) {
      renamedDone.push(date);
      dayWrites.push([`${KEYS.dayPrefix}${date}`, JSON.stringify({ ...data, done })]);
    }
  }

  // 7. Ajustes: sin ancla; silenciados por id de serie (también los ids nuevos de una serie separada).
  const muted: Record<string, boolean> = {};
  for (const [m, on] of Object.entries(st.settings.muted)) {
    const matches = series.filter((s) => s.id === m || legacyBid[s.id] === m);
    if (matches.length === 0) muted[m] = on;
    for (const s of matches) muted[s.id] = on;
  }
  const settings: SettingsV2 = {
    notifStart: st.settings.notifStart, endLead: st.settings.endLead, wake: st.settings.wake, muted,
  };

  // 8. Escrituras en orden: copia, marca de copia completa, modelo v2, días reescritos y, al final, la versión.
  const backup: Entry[] = src.entries.map(([k, v]) => [`${KEYS.backupPrefix}${k}`, v]);
  const writes: Entry[] = [
    ...backup,
    [BACKUP_COMPLETE_KEY, String(backup.length)],
    [KEYS.categories, JSON.stringify(categories)],
    [KEYS.series, JSON.stringify(series)],
    [KEYS.exceptions, JSON.stringify(exceptions)],
    [KEYS.goals, JSON.stringify(goals)],
    [KEYS.legacyBid, JSON.stringify(legacyBid)],
    [KEYS.settings, JSON.stringify(settings)],
    [KEYS.legacyTueAnchor, anchor],
    ...dayWrites,
    [KEYS.schemaVersion, '2'],
  ];

  return {
    ok: true,
    agenda,
    settings,
    writes,
    report: {
      sourceUsed: src.from,
      series: series.length,
      split: built.split,
      exceptions: {
        cancelled: exceptions.filter((x) => x.kind === 'cancelled').length,
        modified: exceptions.filter((x) => x.kind === 'modified').length,
      },
      oneOff,
      ignoredWeekendOverrides,
      renamedDone,
      unknownKeys: st.unknown.map((u) => u.key),
      extraCategories,
      verifiedDays,
      notes,
    },
  };
}

// ---- Aplicación sobre la capa de acceso ---------------------------------------------------------------------------

export type MigrationOutcome =
  | { status: 'already-migrated' }
  | { status: 'migrated'; report: MigrationReport }
  | { status: 'refused'; error: string; mismatches: Mismatch[] };

/**
 * Migra si hace falta. Si `migrateV1` rechaza, no escribe nada. Si una escritura falla, el error se propaga y la
 * versión queda en 1, así el siguiente intento vuelve a empezar (desde la copia si quedó completa).
 */
export function migrateRepository(
  repo: Repository, today: string, run: (entries: Entry[], today: string) => MigrationResult = migrateV1,
): MigrationOutcome {
  if (repo.schemaVersion() >= 2) return { status: 'already-migrated' };
  const r = run(repo.snapshot(), today);
  if (!r.ok) return { status: 'refused', error: r.error, mismatches: r.mismatches };
  repo.writeAll(r.writes);
  return { status: 'migrated', report: r.report };
}

