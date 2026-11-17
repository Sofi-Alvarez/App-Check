// Lector puro del formato actual del almacén (versión 1). Recibe las claves y valores tal como están guardados
// (por ejemplo, las entradas de una copia de seguridad) y devuelve el estado con la misma interpretación que usa
// hoy la app. No escribe nada. Lo usan las pruebas y, en la fase 1, la migración a la versión 2.
//
// Regla: nada se descarta en silencio. Una clave que no se reconoce, o cuyo valor no se puede leer, va a `unknown`.

import { Block, DayType, dayType, defaultBlocks, parseISO } from '../agenda';
import type { Entry } from '../domain/backup';
import {
  ActiveSession, DEFAULT_SETTINGS, DEFAULT_TIMER, DayData, LogEvent, Settings, TimerState,
} from '../storeShape';

export type { Entry };

export interface V1State {
  settings: Settings;
  timer: TimerState;
  /** Listas editadas con "Siempre". Lo que falta sale de `defaultBlocks()`. */
  sched: Partial<Record<DayType, Block[]>>;
  /** Listas completas editadas con "Solo hoy" (incluye el margen), por fecha. */
  overrides: Record<string, Block[]>;
  /** Hechos y conteos por fecha. */
  days: Record<string, DayData>;
  /** Todos los eventos del registro, ordenados por hora. */
  logs: LogEvent[];
  /** Fecha de la clave en la que estaba guardado cada evento (la fecha local del toque). Mismo orden que `logs`. */
  logKeys: string[];
  active: ActiveSession | null;
  /** Marcas internas (`agenda:flag:<nombre>`), con su valor crudo. */
  flags: Record<string, string>;
  /** Claves que no se reconocieron o no se pudieron leer, con el motivo. */
  unknown: { key: string; value: string; reason: string }[];
}

const DAY_PREFIX = 'agenda:day:';
const LOG_PREFIX = 'agenda:log:';
const OVR_PREFIX = 'agenda:ovr:';
const FLAG_PREFIX = 'agenda:flag:';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function readV1(entries: Entry[]): V1State {
  const st: V1State = {
    settings: { ...DEFAULT_SETTINGS, muted: { ...DEFAULT_SETTINGS.muted } },
    timer: { ...DEFAULT_TIMER },
    sched: {},
    overrides: {},
    days: {},
    logs: [],
    logKeys: [],
    active: null,
    flags: {},
    unknown: [],
  };
  const logPairs: { ev: LogEvent; key: string }[] = [];

  for (const [key, value] of entries) {
    const bad = (reason: string) => st.unknown.push({ key, value, reason });

    if (key.startsWith(FLAG_PREFIX)) {
      st.flags[key.slice(FLAG_PREFIX.length)] = value;
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      bad('valor que no es JSON');
      continue;
    }

    if (key === 'agenda:settings') {
      // La app mezcla lo guardado sobre los valores por defecto; se reproduce igual.
      if (isObject(parsed)) st.settings = { ...st.settings, ...(parsed as Partial<Settings>) };
      else bad('ajustes con forma inesperada');
    } else if (key === 'agenda:timer') {
      if (isObject(parsed)) st.timer = { ...st.timer, ...(parsed as Partial<TimerState>) };
      else bad('timer con forma inesperada');
    } else if (key === 'agenda:sched') {
      if (isObject(parsed)) st.sched = parsed as V1State['sched'];
      else bad('agenda editada con forma inesperada');
    } else if (key === 'agenda:active') {
      if (isObject(parsed)) st.active = parsed as unknown as ActiveSession;
      else bad('sesión en curso con forma inesperada');
    } else if (key.startsWith(OVR_PREFIX) && DATE_RE.test(key.slice(OVR_PREFIX.length))) {
      if (Array.isArray(parsed)) st.overrides[key.slice(OVR_PREFIX.length)] = parsed as Block[];
      else bad('edición de un día con forma inesperada');
    } else if (key.startsWith(DAY_PREFIX) && DATE_RE.test(key.slice(DAY_PREFIX.length))) {
      if (isObject(parsed)) {
        const d = parsed as Partial<DayData>;
        st.days[key.slice(DAY_PREFIX.length)] = { done: d.done ?? {}, counts: d.counts ?? {} };
      } else bad('datos de un día con forma inesperada');
    } else if (key.startsWith(LOG_PREFIX) && DATE_RE.test(key.slice(LOG_PREFIX.length))) {
      if (Array.isArray(parsed)) {
        const k = key.slice(LOG_PREFIX.length);
        for (const ev of parsed as LogEvent[]) logPairs.push({ ev, key: k });
      } else bad('registro de un día con forma inesperada');
    } else {
      bad('clave desconocida');
    }
  }

  // Mismo orden que `loadAllLog()`: por hora. El orden es estable para eventos con la misma hora.
  logPairs.sort((a, b) => a.ev.ts - b.ev.ts);
  st.logs = logPairs.map((p) => p.ev);
  st.logKeys = logPairs.map((p) => p.key);
  return st;
}

/** Lista efectiva de un tipo de día, igual que `listFor()` de `schedule.ts`. */
export function v1ListFor(st: V1State, type: DayType): Block[] {
  return st.sched[type] ?? defaultBlocks(type);
}

/** Bloques de una fecha, igual que `blocksFor()` de `schedule.ts`: `null` en sábado y domingo. */
export function v1BlocksFor(st: V1State, date: string): Block[] | null {
  const type = dayType(parseISO(date), st.settings.anchor);
  if (!type) return null;
  return st.overrides[date] ?? v1ListFor(st, type);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
