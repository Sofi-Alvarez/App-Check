// Capa de acceso a los datos (spec 010, 4.1). Toda lectura y escritura del modelo v2 pasa por acá, para que cambiar
// el almacén más adelante (por ejemplo, a tablas) no toque las pantallas.
//
// Claves v2 nuevas: `agenda2:*` y `agenda:schemaVersion`. Se conservan tal cual las claves de uso de la v1
// (`agenda:day:*`, `agenda:log:*`, `agenda:active`, `agenda:timer`, `agenda:flag:*`).
//
// Los errores no se tragan: si una clave v2 está dañada, se lanza `RepositoryError` para que la app lo muestre en vez
// de seguir con datos vacíos.

import { buildDay, indexExceptions } from '../domain/recurrence';
import type { AgendaState, DayBlock, SeriesException, SettingsV2 } from '../domain/types';
import type { DayData, LogEvent } from '../storeShape';
import type { KV } from './kv';

export const KEYS = {
  schemaVersion: 'agenda:schemaVersion',
  categories: 'agenda2:categories',
  series: 'agenda2:series',
  exceptions: 'agenda2:exceptions',
  goals: 'agenda2:goals',
  legacyBid: 'agenda2:legacyBid',
  settings: 'agenda2:settings',
  /** Transitorio hasta la fase 3: semana de referencia de los martes alternos para el vocabulario actual. */
  legacyTueAnchor: 'agenda2:legacyTueAnchor',
  dayPrefix: 'agenda:day:',
  logPrefix: 'agenda:log:',
  backupPrefix: 'backup:v1:',
} as const;

/** Claves que forman el modelo v2 de la agenda (sin ajustes ni datos de uso). */
export const AGENDA_KEYS = [KEYS.categories, KEYS.series, KEYS.exceptions, KEYS.goals, KEYS.legacyBid] as const;

export const DEFAULT_SETTINGS_V2: SettingsV2 = { notifStart: true, endLead: 5, wake: false, muted: {} };

export class RepositoryError extends Error {
  constructor(message: string, readonly key: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export interface Repository {
  /** 1 si nunca se migró (o el valor no existe), 2 después de migrar. */
  schemaVersion(): number;
  setSchemaVersion(v: number): void;
  /** Modelo v2 completo, o `null` si todavía no hay datos v2. */
  loadAgenda(): AgendaState | null;
  saveAgenda(state: AgendaState): void;
  loadSettings(): SettingsV2;
  saveSettings(s: SettingsV2): void;
  loadDayData(date: string): DayData;
  saveDayData(date: string, d: DayData): void;
  /** Todos los eventos del registro, ordenados por hora. */
  loadAllLog(): LogEvent[];
  /** Eventos de un día armados desde el modelo v2. Vacío si no hay modelo v2. */
  getDay(date: string): DayBlock[];
  /** Valor crudo de una clave (o `null`). */
  getValue(key: string): string | null;
  /** Todas las claves con su valor (para la copia de seguridad y la migración). */
  snapshot(): [string, string][];
  /** Escribe en orden. Si una escritura falla, se detiene y lanza el error (las anteriores ya quedaron escritas). */
  writeAll(entries: [string, string][]): void;
  remove(keys: string[]): void;
}

export function createRepository(kv: KV): Repository {
  let cache: { state: AgendaState; index: Map<string, SeriesException> } | null = null;

  const readJSON = <T>(key: string): T | null => {
    const raw = kv.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new RepositoryError(`El valor guardado en ${key} está dañado.`, key);
    }
  };
  const writeJSON = (key: string, value: unknown) => kv.setItem(key, JSON.stringify(value));

  const repo: Repository = {
    schemaVersion() {
      const raw = kv.getItem(KEYS.schemaVersion);
      const n = raw == null ? 1 : Number(raw);
      return Number.isInteger(n) && n >= 1 ? n : 1;
    },
    setSchemaVersion(v) {
      kv.setItem(KEYS.schemaVersion, String(v));
    },

    loadAgenda() {
      if (cache) return cache.state;
      const series = readJSON<AgendaState['series']>(KEYS.series);
      if (series == null) return null;
      const state: AgendaState = {
        categories: readJSON<AgendaState['categories']>(KEYS.categories) ?? [],
        series,
        exceptions: readJSON<AgendaState['exceptions']>(KEYS.exceptions) ?? [],
        goals: readJSON<AgendaState['goals']>(KEYS.goals) ?? [],
        legacyBid: readJSON<AgendaState['legacyBid']>(KEYS.legacyBid) ?? {},
      };
      for (const [k, v] of [[KEYS.series, state.series], [KEYS.categories, state.categories], [KEYS.exceptions, state.exceptions], [KEYS.goals, state.goals]] as const) {
        if (!Array.isArray(v)) throw new RepositoryError(`El valor guardado en ${k} no es una lista.`, k);
      }
      cache = { state, index: indexExceptions(state.exceptions) };
      return state;
    },
    saveAgenda(state) {
      cache = null;
      writeJSON(KEYS.categories, state.categories);
      writeJSON(KEYS.series, state.series);
      writeJSON(KEYS.exceptions, state.exceptions);
      writeJSON(KEYS.goals, state.goals);
      writeJSON(KEYS.legacyBid, state.legacyBid);
    },

    loadSettings() {
      const s = readJSON<Partial<SettingsV2>>(KEYS.settings);
      return { ...DEFAULT_SETTINGS_V2, ...(s ?? {}), muted: { ...(s?.muted ?? {}) } };
    },
    saveSettings(s) {
      writeJSON(KEYS.settings, s);
    },

    loadDayData(date) {
      const d = readJSON<Partial<DayData>>(KEYS.dayPrefix + date);
      return { done: d?.done ?? {}, counts: d?.counts ?? {} };
    },
    saveDayData(date, d) {
      writeJSON(KEYS.dayPrefix + date, d);
    },

    loadAllLog() {
      const out: LogEvent[] = [];
      for (const k of kv.getAllKeys()) {
        if (!k.startsWith(KEYS.logPrefix)) continue;
        const list = readJSON<LogEvent[]>(k);
        if (Array.isArray(list)) out.push(...list);
      }
      return out.sort((a, b) => a.ts - b.ts);
    },

    getDay(date) {
      const state = repo.loadAgenda();
      if (!state) return [];
      return buildDay(state, date, cache!.index);
    },

    getValue: (key) => kv.getItem(key),

    snapshot() {
      const out: [string, string][] = [];
      for (const k of kv.getAllKeys()) {
        const v = kv.getItem(k);
        if (v != null) out.push([k, v]);
      }
      return out;
    },
    writeAll(entries) {
      cache = null;
      for (const [k, v] of entries) kv.setItem(k, v);
    },
    remove(keys) {
      cache = null;
      for (const k of keys) kv.removeItem(k);
    },
  };
  return repo;
}
