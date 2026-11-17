// Almacén sintético en formato v1 para las pruebas de la migración (T0.4).
//
// Se arma desde `defaultBlocks()` para usar los ids reales de los bloques, y reproduce a propósito cada caso que la
// migración tiene que resolver. No contiene datos reales: los conteos, horarios y tareas nuevas son inventados.
//
// Las horas se construyen en hora local (como hace la app), así las claves `agenda:log:<fecha>` dan la misma fecha en
// el teléfono y en la integración continua.
//
// Semana usada (noviembre de 2026, ancla del martes con adscripción: 03/11):
//   lun 09 mwf · mar 10 tueOff · mié 11 mwf · jue 12 thu · vie 13 fri · sáb 14 (sin agenda) · mar 17 tueAds

import { Block, DayType, defaultBlocks, iso } from '../agenda';
import type { Entry } from '../domain/backup';
import type { ActiveSession, DayData, EventKind, EventSource, LogEvent, Settings, TimerState } from '../storeShape';

export const ANCHOR = '2026-11-03';
export const NOW = localTs('2026-11-17', '16:00');

/** Hora local en milisegundos. */
export function localTs(date: string, hm: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
}
const min = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
const byStart = (list: Block[]) => [...list].sort((a, b) => a.s - b.s || a.e - b.e);
function find(list: Block[], title: string, nth = 0): Block {
  const found = list.filter((b) => b.t === title)[nth];
  if (!found) throw new Error(`La fixture espera el bloque "${title}" (${nth}) y no está en la agenda.`);
  return found;
}

// ---- Agenda editada con "Siempre" (agenda:sched) -----------------------------------------------------------------

const mwf0 = defaultBlocks('mwf');
const fri0 = defaultBlocks('fri');
const thu0 = defaultBlocks('thu');

/** Bloque original cuyo horario se editó: conserva su id (`mwf:840`) aunque ya no empiece a las 14:00. */
const inglesMwf = find(mwf0, 'Estudio de inglés');
/** Tarea nueva con el mismo horario en dos listas: debe unirse en una sola serie. */
const lectura = (): Block => ({ id: 'u-lectura', s: min('18:00'), e: min('18:30'), t: 'Lectura', c: 'project', n: '' });
/** Caso difícil: la misma tarea nueva con horarios distintos según el tipo de día. */
const yogaMwf: Block = { id: 'u-yoga', s: min('18:30'), e: min('19:00'), t: 'Yoga', c: 'health', n: '' };
const yogaThu: Block = { id: 'u-yoga', s: min('19:40'), e: min('20:10'), t: 'Yoga', c: 'health', n: 'Después de la clase.' };
/** Bloque original eliminado con "Siempre" en los viernes. */
const pausaFri = find(fri0, 'Pausa');

const schedMwf = byStart([
  ...mwf0.map((b) => (b.id === inglesMwf.id ? { ...b, s: min('14:15'), e: min('15:00') } : b)),
  lectura(),
  yogaMwf,
]);
const schedFri = byStart([...fri0.filter((b) => b.id !== pausaFri.id), lectura()]);
const schedThu = byStart([...thu0, yogaThu]);
export const SCHED: Partial<Record<DayType, Block[]>> = { mwf: schedMwf, fri: schedFri, thu: schedThu };

// ---- Ediciones de un día (agenda:ovr:<fecha>) --------------------------------------------------------------------

const jobsMwf = find(schedMwf, '/jobs y postular');
const pausaMwf = find(schedMwf, 'Pausa');
const coldMwf = find(schedMwf, 'Cold outreach');

/**
 * Miércoles 11: margen aplicado. "/jobs" terminó 15 minutos antes (11:15 en vez de 11:30) y los minutos pasaron a
 * "Cold outreach". Se reproduce `applyMargin()`: la tarea terminada se acorta, las del medio se corren y la elegida
 * empieza antes sin mover su fin. Además, una tarea fija agregada "Solo hoy".
 */
const OVR_WED: Block[] = byStart([
  ...schedMwf.map((b) => {
    if (b.id === jobsMwf.id) return { ...b, e: b.e - 15 };
    if (b.id === pausaMwf.id) return { ...b, s: b.s - 15, e: b.e - 15 };
    if (b.id === coldMwf.id) return { ...b, s: b.s - 15 };
    return b;
  }),
  { id: 'u-medico', s: min('19:00'), e: min('20:00'), t: 'Turno médico', c: 'fixed', n: '' },
]);
/** Jueves 12: un bloque original quitado "Solo hoy". */
const cenaThu = find(schedThu, 'Cena rápida');
const OVR_THU: Block[] = schedThu.filter((b) => b.id !== cenaThu.id);
export const OVERRIDES: Record<string, Block[]> = { '2026-11-11': OVR_WED, '2026-11-12': OVR_THU };

// ---- Hechos y conteos (agenda:day:<fecha>) -----------------------------------------------------------------------

const ejercicioMwf = find(schedMwf, 'Ejercicio');
const tueOff0 = defaultBlocks('tueOff');
const tueAds0 = defaultBlocks('tueAds');
const jobsTueOff = find(tueOff0, '/jobs y postular');
const coldThu = find(schedThu, 'Cold outreach');
const coldTueAds = find(tueAds0, 'Cold outreach');
const socialTueAds = find(tueAds0, 'LinkedIn y social');
const coldWed = find(OVR_WED, 'Cold outreach');
const jobsWed = find(OVR_WED, '/jobs y postular');

export const DAYS: Record<string, DayData> = {
  '2026-11-09': {
    done: { [ejercicioMwf.id]: true, [jobsMwf.id]: true, [coldMwf.id]: true, 'u-lectura': true },
    counts: { com: 5, rea: 10, cold: 10, post: 1 },
  },
  '2026-11-10': { done: { [jobsTueOff.id]: true }, counts: { com: 3 } },
  '2026-11-11': { done: { [jobsWed.id]: true }, counts: { cold: 8, apl: 2 } },
  '2026-11-12': { done: {}, counts: { cold: 10 } },
  '2026-11-13': { done: { 'u-lectura': true }, counts: {} },
  '2026-11-17': { done: {}, counts: { com: 2 } },
};

// ---- Registro de uso (agenda:log:<fecha>) ------------------------------------------------------------------------

function ev(
  kind: EventKind, day: string, b: Block, hm: string, source: EventSource = 'manual', goal = '', delta = 0,
): LogEvent {
  return {
    ts: localTs(day, hm), day, kind, bid: b.id, title: b.t, cat: b.c, planS: b.s, planE: b.e, goal, delta, source,
  };
}
const counts = (day: string, b: Block, goal: string, from: string, n: number): LogEvent[] =>
  Array.from({ length: n }, (_, i) => ev('count', day, b, addMinutes(from, i * 3), 'manual', goal, 1));
function addMinutes(hm: string, m: number): string {
  const t = min(hm) + m;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const yogaThuBlock = find(OVR_THU, 'Yoga');
const lecturaFri = find(schedFri, 'Lectura');
const lecturaMwf = find(schedMwf, 'Lectura');
const postMwf = find(schedMwf, 'Capturas y post de mañana');

export const LOG: LogEvent[] = [
  // Lunes 09: sesión con pausa, cambio de tarea con "Empezar" (cierra la anterior), conteos dentro de la sesión,
  // un conteo suelto sin sesión, y marcar, desmarcar y volver a marcar.
  ev('start', '2026-11-09', jobsMwf, '10:02'),
  ev('pause', '2026-11-09', jobsMwf, '10:40'),
  ev('resume', '2026-11-09', jobsMwf, '10:50'),
  ev('finish', '2026-11-09', jobsMwf, '11:47', 'next'),
  ev('start', '2026-11-09', coldMwf, '11:47'),
  ...counts('2026-11-09', coldMwf, 'cold', '11:50', 10),
  ev('finish', '2026-11-09', coldMwf, '12:40'),
  ev('done', '2026-11-09', jobsMwf, '12:41'),
  ev('count', '2026-11-09', postMwf, '17:30', 'manual', 'post', 1),
  ev('done', '2026-11-09', lecturaMwf, '18:31'),
  ev('undone', '2026-11-09', lecturaMwf, '18:32'),
  ev('done', '2026-11-09', lecturaMwf, '18:33'),
  // Martes 10: sesión olvidada, cerrada sola una hora después del fin planificado.
  ev('start', '2026-11-10', jobsTueOff, '10:00'),
  ev('finish', '2026-11-10', jobsTueOff, '12:30', 'auto_close'),
  // Miércoles 11: terminó 15 min antes y aceptó pasar el margen a "Cold outreach" (goal = id destino, delta = minutos).
  ev('start', '2026-11-11', jobsMwf, '10:00'),
  ev('finish', '2026-11-11', jobsMwf, '11:15'),
  ev('margin', '2026-11-11', jobsMwf, '11:15', 'manual', coldMwf.id, 15),
  ev('start', '2026-11-11', coldWed, '11:30'),
  ...counts('2026-11-11', coldWed, 'cold', '11:35', 8),
  ev('finish', '2026-11-11', coldWed, '12:45'),
  // Jueves 12: una tarea nueva del caso difícil, y un margen ofrecido que eligió dejar como estaba (goal = 'none').
  ev('start', '2026-11-12', coldThu, '17:30'),
  ev('finish', '2026-11-12', coldThu, '18:00'),
  ev('start', '2026-11-12', yogaThuBlock, '19:40'),
  ev('finish', '2026-11-12', yogaThuBlock, '20:05'),
  ev('margin', '2026-11-12', yogaThuBlock, '20:05', 'manual', 'none', 5),
  // Viernes 13: tarea nueva compartida entre listas.
  ev('start', '2026-11-13', lecturaFri, '18:00'),
  ev('finish', '2026-11-13', lecturaFri, '18:30'),
  // Martes 17 (con adscripción): conteos sueltos antes de empezar, y una sesión todavía abierta.
  ev('count', '2026-11-17', socialTueAds, '15:10', 'manual', 'com', 1),
  ev('count', '2026-11-17', socialTueAds, '15:12', 'manual', 'com', 1),
  ev('start', '2026-11-17', coldTueAds, '15:30'),
];

// ---- Resto del almacén -------------------------------------------------------------------------------------------

export const SETTINGS: Settings = {
  notifStart: true, endLead: 5, wake: false, anchor: ANCHOR, muted: { [find(mwf0, 'Rutina de mañana').id]: true },
};
export const TIMER: TimerState = { total: 1500, left: 1500, endAt: 0, label: '' };
export const ACTIVE: ActiveSession = {
  bid: coldTueAds.id, day: '2026-11-17', title: coldTueAds.t, cat: coldTueAds.c, planS: coldTueAds.s,
  planE: coldTueAds.e, startedAt: localTs('2026-11-17', '15:30'), pausedAt: 0, pausedMs: 0,
};

/** El almacén completo, como lo vería `getAllKeysSync()` o una copia de seguridad. */
export function buildV1Store(): Entry[] {
  const out: Entry[] = [
    ['agenda:settings', JSON.stringify(SETTINGS)],
    ['agenda:timer', JSON.stringify(TIMER)],
    ['agenda:sched', JSON.stringify(SCHED)],
    ['agenda:active', JSON.stringify(ACTIVE)],
    ['agenda:flag:doneIds', '1'],
  ];
  for (const [date, list] of Object.entries(OVERRIDES)) out.push([`agenda:ovr:${date}`, JSON.stringify(list)]);
  for (const [date, d] of Object.entries(DAYS)) out.push([`agenda:day:${date}`, JSON.stringify(d)]);
  // Igual que `appendLog()`: cada evento va a la clave de la fecha local de su hora.
  const byKey = new Map<string, LogEvent[]>();
  for (const e of LOG) {
    const k = iso(new Date(e.ts));
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  for (const [k, list] of byKey) out.push([`agenda:log:${k}`, JSON.stringify(list)]);
  return out;
}

/**
 * Hechos esperados de esta fixture, calculados a mano. Son la línea base contra la que la migración (CA-16) tiene
 * que dar exactamente lo mismo.
 */
export const EXPECTED = {
  totalEvents: 46,
  sessions: 9,
  sessionsByDay: { '2026-11-09': 2, '2026-11-10': 1, '2026-11-11': 2, '2026-11-12': 2, '2026-11-13': 1, '2026-11-17': 1 },
  autoClosed: 1,
  open: 1,
  /** Conteos que ocurrieron sin una sesión abierta. */
  looseCounts: 3,
  /** "/jobs" del lunes 09: de 10:02 a 11:47 con 10 min de pausa. */
  mondayJobs: { activeMin: 95, pausedMin: 10, endedBy: 'next' as const },
  /** Ids presentes en más de una lista de "Siempre" (casos que la migración debe unir o separar). */
  sharedIdSameTimes: 'u-lectura',
  sharedIdDifferentTimes: 'u-yoga',
  /** Bloque original con horario editado: su id ya no coincide con su hora de inicio. */
  editedOriginal: { id: inglesMwf.id, s: min('14:15'), e: min('15:00') },
  deletedAlways: { list: 'fri' as DayType, id: pausaFri.id },
  deletedToday: { date: '2026-11-12', id: cenaThu.id },
  addedToday: { date: '2026-11-11', id: 'u-medico' },
  margin: { date: '2026-11-11', from: jobsMwf.id, to: coldMwf.id, minutes: 15 },
  /** Eventos de "/jobs" del 11/11 (inicio, fin y margen) registrados con el horario previo al margen. */
  staleAfterMargin: 3,
};
