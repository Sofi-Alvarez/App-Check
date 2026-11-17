import { pad } from './agenda';
import type { LogEvent } from './store';

export interface Session {
  bid: string;
  day: string;
  title: string;
  cat: string;
  planS: number;
  planE: number;
  startTs: number;
  endTs: number;
  activeMs: number;
  pausedMs: number;
  endedBy: 'manual' | 'next' | 'auto_close' | 'open';
  counts: Record<string, number>;
}

// Convierte la lista de eventos en sesiones: una por cada vez que se tocó "Empezar".
// Los toques de contador se asignan a la sesión abierta en ese momento; los que
// ocurren sin sesión quedan en `loose`.
export function buildSessions(events: LogEvent[], nowMs: number): { sessions: Session[]; loose: LogEvent[] } {
  const sessions: Session[] = [];
  const loose: LogEvent[] = [];
  let cur: Session | null = null;
  let pausedAt = 0;

  const close = (ts: number, by: Session['endedBy']) => {
    if (!cur) return;
    if (pausedAt) cur.pausedMs += ts - pausedAt;
    cur.endTs = ts;
    cur.endedBy = by;
    cur.activeMs = Math.max(0, ts - cur.startTs - cur.pausedMs);
    cur = null;
    pausedAt = 0;
  };

  for (const ev of [...events].sort((a, b) => a.ts - b.ts)) {
    if (ev.kind === 'start') {
      close(ev.ts, 'next');
      cur = {
        bid: ev.bid, day: ev.day, title: ev.title, cat: ev.cat, planS: ev.planS, planE: ev.planE,
        startTs: ev.ts, endTs: 0, activeMs: 0, pausedMs: 0, endedBy: 'open', counts: {},
      };
      sessions.push(cur);
    } else if (ev.kind === 'pause') {
      if (cur && !pausedAt) pausedAt = ev.ts;
    } else if (ev.kind === 'resume') {
      if (cur && pausedAt) {
        cur.pausedMs += ev.ts - pausedAt;
        pausedAt = 0;
      }
    } else if (ev.kind === 'finish') {
      close(ev.ts, ev.source === 'auto_close' ? 'auto_close' : ev.source === 'next' ? 'next' : 'manual');
    } else if (ev.kind === 'count') {
      if (cur) cur.counts[ev.goal] = (cur.counts[ev.goal] ?? 0) + ev.delta;
      else loose.push(ev);
    }
  }
  const open = cur as Session | null;
  if (open) {
    const end = pausedAt || nowMs;
    open.activeMs = Math.max(0, end - open.startTs - open.pausedMs);
  }
  return { sessions, loose };
}

export const minutesLabel = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)} min` : `${m} min`;
};

const stamp = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const cell = (v: string | number) => {
  const x = String(v);
  return /[",\n;]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};

// CSV crudo: una fila por evento, para analizarlo después sin perder nada.
export function eventsToCsv(events: LogEvent[]): string {
  // Las dos últimas columnas se agregaron en la fase 2; quedan vacías en los eventos anteriores.
  const head = ['fecha_hora', 'dia', 'evento', 'bloque_id', 'tarea', 'categoria', 'plan_inicio_min', 'plan_fin_min', 'objetivo', 'cantidad', 'origen', 'categoria_nombre', 'objetivo_nombre'];
  const rows = events.map((e) => [
    stamp(e.ts), e.day, e.kind, e.bid, e.title, e.cat, e.planS, e.planE, e.goal, e.delta, e.source, e.catName ?? '', e.goalName ?? '',
  ]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}
