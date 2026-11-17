import type { StartupMigration } from './migration/startup';
import type { Theme } from './theme';
import type { BlockInfo } from './agenda';
import type { AgendaEngine, EngineBlock, Scope, TaskDraft } from './engine/types';
import type { ActiveSession, DayData, Settings, TimerState } from './store';

export interface Ctx {
  theme: Theme;
  insets: { top: number; bottom: number };
  now: Date;
  rev: number;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  viewIso: string;
  setViewIso: (iso: string) => void;
  day: DayData;
  toggleDone: (id: string) => void;
  changeCount: (key: string, delta: number) => void;
  toggleMute: (key: string) => void;
  timer: TimerState;
  timerLeft: number;
  startTimer: (minutes: number, label: string) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  active: ActiveSession | null;
  startSession: (info: BlockInfo | null) => void;
  pauseResume: () => void;
  finishSession: () => void;
  blocks: EngineBlock[];
  saveTask: (draft: TaskDraft, scope: Scope) => void;
  deleteTask: (id: string, scope: Scope) => void;
  restoreSchedule: () => void;
  /** Resultado de la migración al formato nuevo al abrir la app (T1.7). */
  migration: StartupMigration;
  /** Motor de agenda activo (v1 o v2). Las pantallas consultan acá el tipo de día, categorías, metas y listas. */
  engine: AgendaEngine;
  /** Mueve la alternancia de los martes una semana. */
  shiftTuesdays: (days: number) => void;
}
