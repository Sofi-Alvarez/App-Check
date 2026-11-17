import Storage from 'expo-sqlite/kv-store';
import { BlockInfo, iso } from './agenda';
import { ActiveSession, DEFAULT_TIMER, DayData, EventKind, EventSource, LogEvent, TimerState } from './storeShape';

// Datos de uso en el teléfono (marcas de hecho, conteos, registro, sesión en curso y timer). La agenda y los ajustes
// van por la capa de acceso (`data/repository.ts`).
export { DEFAULT_TIMER };
export type { ActiveSession, DayData, EventKind, EventSource, LogEvent, TimerState };

function read<T extends object>(key: string, fallback: T): T {
  try {
    const v = Storage.getItemSync(key);
    if (v) return { ...fallback, ...(JSON.parse(v) as Partial<T>) };
  } catch {}
  return fallback;
}
function write(key: string, value: unknown) {
  try {
    Storage.setItemSync(key, JSON.stringify(value));
  } catch {}
}

export const loadTimer = () => read('agenda:timer', DEFAULT_TIMER);
export const saveTimer = (t: TimerState) => write('agenda:timer', t);
export const loadDay = (isoDate: string): DayData => read<DayData>('agenda:day:' + isoDate, { done: {}, counts: {} });
export const saveDay = (isoDate: string, d: DayData) => write('agenda:day:' + isoDate, d);


const LOG_PREFIX = 'agenda:log:';
export function loadLog(isoDate: string): LogEvent[] {
  try {
    const v = Storage.getItemSync(LOG_PREFIX + isoDate);
    if (v) return JSON.parse(v) as LogEvent[];
  } catch {}
  return [];
}
export function appendLog(ev: LogEvent) {
  const key = iso(new Date(ev.ts));
  write(LOG_PREFIX + key, [...loadLog(key), ev]);
}
export function loadAllLog(): LogEvent[] {
  try {
    return Storage.getAllKeysSync()
      .filter((k) => k.startsWith(LOG_PREFIX))
      .flatMap((k) => loadLog(k.slice(LOG_PREFIX.length)))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}
export function loadActive(): ActiveSession | null {
  try {
    const v = Storage.getItemSync('agenda:active');
    if (v) return JSON.parse(v) as ActiveSession;
  } catch {}
  return null;
}
export const saveActive = (a: ActiveSession | null) => {
  try {
    if (a) Storage.setItemSync('agenda:active', JSON.stringify(a));
    else Storage.removeItemSync('agenda:active');
  } catch {}
};

export function logEvent(
  kind: EventKind, info: BlockInfo | null, ts: number, source: EventSource = 'manual', goal = '', delta = 0,
  names: { catName?: string; goalName?: string } = {},
) {
  appendLog({
    ts, day: info?.day ?? iso(new Date(ts)), kind, bid: info?.bid ?? '', title: info?.title ?? '',
    cat: info?.cat ?? '', planS: info?.planS ?? -1, planE: info?.planE ?? -1, goal, delta, source,
    ...(names.catName ? { catName: names.catName } : {}),
    ...(names.goalName ? { goalName: names.goalName } : {}),
  });
}

/**
 * Todas las claves del almacén con su valor, para la copia de seguridad.
 * Devuelve `null` si la lectura falla: una lista vacía parecería una copia válida de un almacén vacío.
 */
export function loadAllEntries(): [string, string][] | null {
  try {
    const out: [string, string][] = [];
    for (const k of Storage.getAllKeysSync()) {
      const v = Storage.getItemSync(k);
      if (v != null) out.push([k, v]);
    }
    return out;
  } catch {
    return null;
  }
}
