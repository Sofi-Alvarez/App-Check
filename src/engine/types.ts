// Motor de agenda (fase 2). Las pantallas actuales hablan con este contrato y no saben si los datos vienen del
// formato viejo (v1) o del modelo nuevo (v2). La app elige el motor al arrancar.
//
// El contrato conserva el vocabulario de las pantallas actuales ("Solo hoy", "Siempre" con tipos de día) hasta que la
// fase 3 las reemplace.

import type { DayType } from '../agenda';
import type { ColorToken } from '../domain/types';
import type { Settings } from '../storeShape';

/** Un evento ubicado en un día, con los campos cortos que usan las pantallas. `c` es el id de la categoría. */
export interface EngineBlock {
  id: string;
  s: number;
  e: number;
  t: string;
  c: string;
  n: string;
}

export interface BlockRef {
  bid: string;
  day: string;
  title: string;
  cat: string;
  planS: number;
  planE: number;
}

export interface TaskDraft {
  /** `null` = tarea nueva. */
  id: string | null;
  t: string;
  c: string;
  s: number;
  e: number;
  n: string;
}

export type Scope = { kind: 'today' } | { kind: 'always'; lists: DayType[] };

export interface CategoryInfo {
  id: string;
  name: string;
  color: ColorToken;
  movable: boolean;
  tracked: boolean;
  marginPreference: 'normal' | 'avoid';
}

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
  /** + terminaste antes, − te pasaste (minutos). */
  slack: number;
  options: MarginOption[];
  defaultId: string | null;
}

/** Tarjeta de contador de la pantalla Metas. */
export interface GoalCard {
  key: string;
  label: string;
  target: number | null;
}

/** Fila de "Totales de la semana". */
export interface WeekRow {
  label: string;
  value: number;
  target: number | null;
  unit: string;
}

export interface AgendaEngine {
  kind: 'v1' | 'v2';
  /** Eventos de un día. `null` = día sin agenda (sábado y domingo sin eventos). */
  blocksFor(date: string): EngineBlock[] | null;
  /** Tipo de día del vocabulario actual (para la etiqueta del día y los "Siempre"). */
  dayKind(date: string): DayType | null;
  /** Lista vigente de un tipo de día (para avisar superposiciones al elegir "Siempre"). */
  listFor(kind: DayType): EngineBlock[];
  /** Evento que toca a esa hora. */
  currentBlock(now: Date): BlockRef | null;
  saveTask(draft: TaskDraft, scope: Scope, date: string): string;
  deleteTask(id: string, scope: Scope, date: string): void;
  /** Descarta las ediciones y vuelve a la agenda original. No toca el registro de uso. */
  restore(): void;
  planMargin(day: string, aId: string, endMin: number): MarginPlan | null;
  applyMargin(plan: MarginPlan, targetId: string): boolean;
  category(id: string): CategoryInfo;
  /** Categorías para la leyenda y el selector, sin repetir color (como la leyenda actual). */
  legend(): CategoryInfo[];
  goalsFor(date: string): GoalCard[];
  goalName(key: string): string;
  weekSummary(viewIso: string): WeekRow[];
  /** Próximos martes con adscripción a partir de hoy. */
  upcomingTueAds(n: number, today: string): string[];
  /** Mueve la alternancia de los martes una semana (adelante o atrás). */
  shiftTuesdays(days: number): void;
  loadSettings(): Settings;
  saveSettings(s: Settings): void;
}
