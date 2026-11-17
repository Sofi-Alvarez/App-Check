// Forma de los datos guardados en el almacén (versión 1). Sin dependencias de Expo ni de React Native,
// para que las pruebas y la migración puedan usarla. `store.ts` la reexporta: el resto de la app no cambia.
import type { BlockInfo } from './agenda';

export interface Settings {
  notifStart: boolean;
  endLead: number;
  wake: boolean;
  anchor: string;
  muted: Record<string, boolean>;
}
export interface DayData {
  done: Record<string, boolean>;
  counts: Record<string, number>;
}
export interface TimerState {
  total: number;
  left: number;
  endAt: number;
  label: string;
}

export const DEFAULT_SETTINGS: Settings = { notifStart: true, endLead: 5, wake: false, anchor: '2026-11-03', muted: {} };
export const DEFAULT_TIMER: TimerState = { total: 1500, left: 1500, endAt: 0, label: '' };

// Registro de uso: una lista de eventos por día (append-only) y la sesión en curso.
export type EventKind = 'start' | 'pause' | 'resume' | 'finish' | 'count' | 'done' | 'undone' | 'margin';
export type EventSource = 'manual' | 'next' | 'auto_close';
export interface LogEvent {
  ts: number;
  day: string;
  kind: EventKind;
  bid: string;
  title: string;
  cat: string;
  planS: number;
  planE: number;
  goal: string;
  delta: number;
  source: EventSource;
}
export interface ActiveSession extends BlockInfo {
  startedAt: number;
  pausedAt: number;
  pausedMs: number;
}
