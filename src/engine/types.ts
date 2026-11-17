// Motor de agenda: el contrato con el que las pantallas leen y cambian la agenda sobre el modelo v2.

import type { CategoryError, CategoryOpError, NewCategory } from '../domain/categories';
import type { EditScope, EventPatch, OpError } from '../domain/events';
import type { GoalError, GoalInput, GoalScope } from '../domain/goals';
import type { AgendaState, ColorToken, GoalVersion, Series, SettingsV2 } from '../domain/types';

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
  /** Eventos de un día (vacío si no hay). */
  blocksFor(date: string): EngineBlock[];
  /** Evento que toca a esa hora. */
  currentBlock(now: Date): BlockRef | null;
  planMargin(day: string, aId: string, endMin: number): MarginPlan | null;
  applyMargin(plan: MarginPlan, targetId: string): boolean;
  category(id: string): CategoryInfo;
  /** Categorías para la leyenda, sin repetir color. */
  legend(): CategoryInfo[];
  goalsFor(date: string): GoalCard[];
  goalName(key: string): string;
  weekSummary(viewIso: string): WeekRow[];
  loadSettings(): SettingsV2;
  saveSettings(s: SettingsV2): void;
  /** Gestión de eventos, categorías y metas. */
  events: EventOps;
}

export type EventResult = { ok: true; id: string } | { ok: false; error: OpError };
export type CategoryResult = { ok: true; id: string } | { ok: false; error: CategoryOpError };
export type GoalResult = { ok: true; id: string } | { ok: false; error: GoalError[] | 'not-found' };

/** Meta tal como la muestra la pantalla de metas. `version` es la vigente hoy. */
export interface GoalView {
  id: string;
  name: string;
  kind: 'quantity' | 'time' | 'both';
  unit: string;
  links: string[];
  reminder: string | null;
  archived: boolean;
  version: GoalVersion;
  /** Conteos registrados en total (eventos `count` del registro). */
  counts: number;
}

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
  /** Metas, también las archivadas (pantalla de metas). */
  goalsAll(): GoalView[];
  createGoal(input: GoalInput): GoalResult;
  updateGoal(id: string, input: GoalInput, scope: GoalScope): GoalResult;
  /** `true` si el cambio toca objetivo, período o días (hay que elegir alcance). */
  goalNeedsScope(id: string, input: GoalInput): boolean;
  setGoalArchived(id: string, archived: boolean): GoalResult;
  deleteGoal(id: string): GoalResult;
  /** Metas de cantidad asociadas a un evento (por su id o su id original), para contar dentro del evento en curso. */
  goalsForSeries(bid: string, date: string): GoalCard[];
  /** Eventos que se pueden asociar a una meta, con su repetición en palabras para distinguirlos. */
  linkableSeries(): { id: string; title: string; summary: string }[];
  /** Avisos propios de las metas en esas fechas: una hora por meta activa ese día. */
  goalReminders(dates: string[]): { goalId: string; name: string; date: string; time: string }[];
  /** Restaura la plantilla inicial (la rutina original). Conserva categorías, metas y el registro. */
  restoreTemplate(): { ok: true; id: string };
  /** Borra eventos, categorías y metas (queda "General"). No toca el registro. */
  clearAll(): { ok: true; id: string };
  /** Estado completo, para deshacer. */
  snapshot(): AgendaState;
  restore(snap: AgendaState): void;
}
