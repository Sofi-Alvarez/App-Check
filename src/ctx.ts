import type { Theme } from './theme';
import type { BlockInfo } from './agenda';
import type { SettingsV2 } from './domain/types';
import type { AgendaEngine, EngineBlock } from './engine/types';
import type { ActiveSession, DayData, TimerState } from './store';

export interface Ctx {
  theme: Theme;
  insets: { top: number; bottom: number };
  now: Date;
  rev: number;
  settings: SettingsV2;
  updateSettings: (patch: Partial<SettingsV2>) => void;
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
  /** Motor de la agenda. Las pantallas consultan acá eventos, categorías y metas. */
  engine: AgendaEngine;
  /** Ejecuta una operación de eventos: reprograma avisos y ofrece "Deshacer" durante 8 segundos. */
  runEvent: <T extends { ok: boolean }>(op: () => T, label: string) => T;
}
