// Forma de los datos de uso guardados en el almacén. Sin dependencias de Expo ni de React Native, para que las pruebas
// y la capa de acceso puedan usarla. `store.ts` la reexporta.
import type { BlockInfo } from './agenda';

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
  /** Nombre de la categoría al momento del registro (desde la fase 2; los eventos anteriores no lo tienen). */
  catName?: string;
  /** Nombre de la meta al momento del registro, en los conteos (desde la fase 2). */
  goalName?: string;
}
export interface ActiveSession extends BlockInfo {
  startedAt: number;
  pausedAt: number;
  pausedMs: number;
}
