// Motor de agenda (fase 2). Las pantallas actuales hablan con este contrato y no saben si los datos vienen del
// formato viejo (v1) o del modelo nuevo (v2). La app elige el motor al arrancar.
//
// El contrato conserva el vocabulario de las pantallas actuales ("Solo hoy", "Siempre" con tipos de día) hasta que la
// fase 3 las reemplace.

import type { DayType } from '../agenda';
import type { CategoryError, CategoryOpError, NewCategory } from '../domain/categories';
import type { EditScope, EventPatch, OpError } from '../domain/events';
import type { AgendaState, ColorToken, Series } from '../domain/types';
import type { Settings } from '../storeShape';

/** Un evento ubicado en un día, con los campos cortos que usan las pantallas. `c` es el id de la categoría. */
export interface EngineBlock {
  id: string;
  s: number;
  e: number;
  t: string;
  c: string;
  n: string;
  /** Aviso propio del evento (solo motor v2). `null` o ausente = usar Ajustes. */
  rem?: { atStart: boolean; endLead: number } | null;
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
  /** Gestión de eventos con alcance (fase 3). Solo existe en el motor v2. */
  events?: EventOps;
}

export type EventResult = { ok: true; id: string } | { ok: false; error: OpError };
export type CategoryResult = { ok: true; id: string } | { ok: false; error: CategoryOpError };

/** Operaciones de la spec 009 sobre series (fase 3). */
export interface EventOps {
  series(id: string): Series | null;
  /** Categorías que se pueden elegir (no archivadas), en orden. */
  categories(): CategoryInfo[];
  create(date: string, patch: EventPatch): EventResult;
  edit(id: string, refDate: string, patch: EventPatch, scope: EditScope): EventResult;
  remove(id: string, refDate: string, scope: EditScope): EventResult;
  allowedScopes(id: string, refDate: string, patch: EventPatch): EditScope[];
  allowedDeleteScopes(id: string, refDate: string): EditScope[];
  /** Días con cambios propios que se conservan (desde una fecha, o todos). */
  modifiedDays(id: string, fromDate: string | null): number;
  daysAffected(id: string, refDate: string, scope: EditScope): number | null;
  /** Sesiones registradas de este evento (por su id o por el id original). */
  sessionsFor(id: string): number;
  /** Metas que se pueden asociar (no archivadas). */
  goals(): { id: string; name: string; kind: 'quantity' | 'time' | 'both' }[];
  /** Metas asociadas a un evento. */
  goalIdsFor(id: string): string[];
  /** Crea una categoría desde el editor (spec 009, sección 4). */
  createCategory(input: NewCategory): { ok: true; id: string } | { ok: false; error: CategoryError };
  /** Todas las categorías, también las archivadas, con cuántos eventos las usan (pantalla de categorías). */
  categoriesAll(): (CategoryInfo & { archived: boolean; usage: number })[];
  updateCategory(id: string, input: NewCategory): CategoryResult;
  setCategoryArchived(id: string, archived: boolean): CategoryResult;
  /** Elimina; si la usan eventos, hay que pasar la categoría a la que se reasignan. */
  deleteCategory(id: string, reassignTo: string | null): CategoryResult;
  /** Estado completo, para deshacer. */
  snapshot(): AgendaState;
  restore(snap: AgendaState): void;
}
