export type Cat = 'rest' | 'health' | 'work' | 'content' | 'project' | 'english' | 'fixed' | 'close';
export type DayType = 'mwf' | 'fri' | 'tueOff' | 'tueAds' | 'thu';
export interface Block { id: string; s: number; e: number; t: string; c: Cat; n: string }
type RawBlock = Omit<Block, 'id'>
export interface Goal { key: string; label: string; target: number | null }

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const INIT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

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
const tm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
export const secondsOfDay = (d: Date) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
export const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const B = (a: string, b: string, t: string, c: Cat, n = ''): RawBlock => ({ s: tm(a), e: tm(b), t, c, n });
// El id de los bloques originales es tipo de día + minuto de inicio; los bloques nuevos usan `u-...`.
const withIds = (type: DayType, list: RawBlock[]): Block[] => list.map((b) => ({ ...b, id: `${type}:${b.s}` }));

const CLOSE = 'Marca lo cumplido, anota lo que quedó pendiente y por qué, elige 3 prioridades de mañana y cierra la compu.';
const SOCIAL = 'Publica el post ya redactado. 5 comentarios con aporte y 10 reacciones.';
const JOBS = 'Corre /jobs y postula a lo que salga. Si no hay ofertas, el tiempo que sobra pasa a proyecto.';
const COLD = '10 mensajes. Incluye reclutadores nuevos fuera de tu red.';
const TRACKER = 'Estado de postulaciones, respuestas, a quién escribiste y fecha del próximo follow-up.';
const FOLLOW = '10 mensajes a reclutadores que ya están en tu red.';

function fullDay(postNote: string, closeNote: string): RawBlock[] {
  return [
    B('07:00', '08:00', 'Rutina de mañana', 'rest'),
    B('08:00', '09:00', 'Ejercicio', 'health', 'Fuera de casa. Incluye el trayecto.'),
    B('09:00', '09:15', 'Plan del día y bandeja', 'work', 'Responde a reclutadores y mira las 3 prioridades de hoy.'),
    B('09:15', '10:00', 'LinkedIn: publicar y social', 'content', SOCIAL),
    B('10:00', '11:30', '/jobs y postular', 'work', JOBS),
    B('11:30', '11:45', 'Pausa', 'rest'),
    B('11:45', '12:45', 'Cold outreach', 'work', COLD),
    B('12:45', '13:00', 'Cargar el Tracker', 'work', TRACKER),
    B('13:00', '14:00', 'Almuerzo', 'rest'),
    B('14:00', '15:00', 'Estudio de inglés', 'english', '60 min.'),
    B('15:00', '15:50', 'Follow-up a tu red', 'work', FOLLOW),
    B('15:50', '17:20', 'Proyecto de diseño', 'project', '90 min, más lo que sobre de /jobs.'),
    B('17:20', '17:50', 'Capturas y post de mañana', 'content', postNote),
    B('17:50', '18:00', 'Cierre y plan de mañana', 'close', closeNote),
  ];
}

function tueOff(): RawBlock[] {
  return [
    B('07:00', '08:00', 'Rutina de mañana', 'rest'),
    B('08:00', '09:00', 'Ejercicio', 'health', 'Fuera de casa. Incluye el trayecto.'),
    B('09:00', '09:15', 'Plan del día y bandeja', 'work', 'Responde a reclutadores y mira las 3 prioridades de hoy.'),
    B('09:15', '10:00', 'LinkedIn: publicar y social', 'content', SOCIAL),
    B('10:00', '11:30', '/jobs y postular', 'work', JOBS),
    B('11:30', '11:45', 'Pausa', 'rest'),
    B('11:45', '12:45', 'Cold outreach', 'work', COLD),
    B('12:45', '13:00', 'Cargar el Tracker', 'work', TRACKER),
    B('13:00', '14:00', 'Almuerzo', 'rest'),
    B('14:00', '14:30', 'Estudio de inglés', 'english', '30 min.'),
    B('14:30', '15:00', 'Proyecto de diseño', 'project', '30 min.'),
    B('15:00', '15:50', 'Follow-up a tu red', 'work', FOLLOW),
    B('15:50', '17:20', 'Proyecto de diseño', 'project', '90 min, más lo que sobre de /jobs.'),
    B('17:20', '17:50', 'Capturas y post de mañana', 'content', 'Redáctalo con IA. Mañana es miércoles: puedes publicarlo en vivo.'),
    B('17:50', '18:00', 'Cierre y plan de mañana', 'close', CLOSE),
    B('18:00', '18:40', 'Cena', 'rest'),
    B('18:40', '19:40', 'Clase de inglés', 'fixed', 'Virtual.'),
  ];
}

function tueAds(): RawBlock[] {
  return [
    B('06:00', '07:00', 'Rutina de mañana', 'rest'),
    B('07:00', '09:00', 'Viaje', 'fixed'),
    B('09:00', '12:00', 'Adscripción de políticas educativas', 'fixed'),
    B('12:00', '14:00', 'Viaje', 'fixed'),
    B('14:00', '15:00', 'Almuerzo', 'rest'),
    B('15:00', '15:30', 'LinkedIn y social', 'content', 'El post ya quedó programado el lunes. 5 comentarios y 10 reacciones.'),
    B('15:30', '16:30', 'Cold outreach', 'work', COLD),
    B('16:30', '17:15', 'Follow-up a tu red', 'work', FOLLOW),
    B('17:15', '17:30', 'Cargar el Tracker', 'work', 'Registra a quién escribiste y fecha del próximo follow-up.'),
    B('17:30', '18:00', 'Estudio de inglés', 'english', '30 min.'),
    B('18:00', '18:40', 'Cena', 'rest'),
    B('18:40', '19:40', 'Clase de inglés', 'fixed', 'Virtual.'),
  ];
}

function thu(): RawBlock[] {
  return [
    B('06:00', '07:00', 'Rutina de mañana', 'rest'),
    B('07:00', '09:00', 'Viaje', 'fixed'),
    B('09:00', '14:00', 'Proyectual', 'fixed'),
    B('14:00', '17:00', 'Viaje', 'fixed'),
    B('17:00', '17:30', 'Almuerzo', 'rest'),
    B('17:30', '18:00', 'Cold outreach', 'work', '10 mensajes cortos, unos 3 min cada uno. Usa tu plantilla base. Regístralos en el Tracker el viernes.'),
    B('18:00', '18:30', 'Estudio de inglés', 'english', '30 min antes de la clase.'),
    B('18:30', '18:40', 'Cena rápida', 'rest'),
    B('18:40', '19:40', 'Clase de inglés', 'fixed', 'Virtual.'),
  ];
}

export const TYPE_LABEL: Record<DayType, string> = {
  mwf: 'Día completo',
  fri: 'Día completo · revisión semanal',
  tueOff: 'Martes sin adscripción',
  tueAds: 'Martes con adscripción · día mínimo',
  thu: 'Jueves de proyectual · día mínimo',
};

const G_BASE: Goal[] = [
  { key: 'post', label: 'Post publicado', target: 1 },
  { key: 'com', label: 'Comentarios', target: 5 },
  { key: 'rea', label: 'Reacciones', target: 10 },
  { key: 'cold', label: 'Cold outreach', target: 10 },
  { key: 'fol', label: 'Follow-up', target: 10 },
  { key: 'apl', label: 'Postulaciones', target: null },
];
const G_ADS: Goal[] = [
  { key: 'post', label: 'Post programado', target: 1 },
  { key: 'com', label: 'Comentarios', target: 5 },
  { key: 'rea', label: 'Reacciones', target: 10 },
  { key: 'cold', label: 'Cold outreach', target: 10 },
  { key: 'fol', label: 'Follow-up', target: 10 },
];
const G_THU: Goal[] = [
  { key: 'post', label: 'Post programado', target: 1 },
  { key: 'cold', label: 'Cold outreach', target: 10 },
];
export const goalsFor = (t: DayType | null): Goal[] => (t === 'tueAds' ? G_ADS : t === 'thu' ? G_THU : G_BASE);
export const GOAL_LABELS: Record<string, string> = {
  post: 'Posts', com: 'Comentarios', rea: 'Reacciones', cold: 'Cold outreach', fol: 'Follow-up', apl: 'Postulaciones',
};

export function dayType(d: Date, anchor: string): DayType | null {
  const dow = d.getDay();
  if (dow === 1 || dow === 3) return 'mwf';
  if (dow === 5) return 'fri';
  if (dow === 4) return 'thu';
  if (dow === 2) {
    const diff = Math.round((parseISO(iso(d)).getTime() - parseISO(anchor).getTime()) / 864e5);
    return ((diff % 14) + 14) % 14 === 0 ? 'tueAds' : 'tueOff';
  }
  return null;
}

const MWF_POST = 'Redáctalo con IA y déjalo listo para mañana. Si mañana es martes de adscripción o jueves, déjalo programado en LinkedIn.';

export const LIST_KEYS: DayType[] = ['mwf', 'tueOff', 'tueAds', 'thu', 'fri'];
export const LIST_LABEL: Record<DayType, string> = {
  mwf: 'Lun y mié', tueOff: 'Mar sin adscripción', tueAds: 'Mar con adscripción', thu: 'Jue', fri: 'Vie',
};

/** La agenda original, tal como se instaló. Las ediciones se guardan aparte y se pueden descartar. */
export function defaultBlocks(type: DayType): Block[] {
  if (type === 'mwf') return withIds(type, fullDay(MWF_POST, CLOSE));
  if (type === 'fri') {
    return withIds(type, fullDay('Redáctalo con IA para el lunes.', `${CLOSE} Mira los totales de la semana en la pestaña Metas.`));
  }
  if (type === 'tueOff') return withIds(type, tueOff());
  if (type === 'tueAds') return withIds(type, tueAds());
  return withIds(type, thu());
}

export const LEGEND: [Cat, string][] = [
  ['work', 'Búsqueda'], ['content', 'Contenido'], ['project', 'Proyecto'], ['health', 'Ejercicio'],
  ['english', 'Inglés'], ['fixed', 'Fijo o viaje'], ['rest', 'Pausa o comida'],
];

export function weekRangeLabel(mon: Date): string {
  const fri = addDays(mon, 4);
  return `Semana del ${mon.getDate()}${mon.getMonth() !== fri.getMonth() ? ' de ' + MESES[mon.getMonth()] : ''} al ${fri.getDate()} de ${MESES[fri.getMonth()]}`;
}

export interface BlockInfo { bid: string; day: string; title: string; cat: string; planS: number; planE: number }
export const blockInfo = (day: string, b: Block): BlockInfo => ({
  bid: b.id, day, title: b.t, cat: b.c, planS: b.s, planE: b.e,
});
