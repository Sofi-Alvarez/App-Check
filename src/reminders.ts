// Plan de avisos de la agenda (T2.4). Función pura: arma la lista de avisos de inicio y de fin a partir de los eventos
// de cada día, sin depender de `expo-notifications`. `notifications.ts` los programa.
//
// Mismas reglas que antes, pero el botón "Empecé" depende de la propiedad `tracked` de la categoría (antes, de que la
// categoría no fuera `fixed` ni `rest`), y sirve para cualquier día de la semana que tenga eventos.

import { hm } from './agenda';
import { S } from './i18n';

export interface ReminderDay {
  date: string;
  /** Medianoche local de ese día, en milisegundos. */
  dayStartMs: number;
  /** `rem`: aviso propio del evento; si no viene (o es `null`), se usan los ajustes generales. */
  blocks: { id: string; s: number; e: number; t: string; c: string; n: string; rem?: { atStart: boolean; endLead: number } | null }[];
}

export interface Reminder {
  id: string;
  at: number;
  title: string;
  body: string;
  /** Con botón "Empecé": lleva el evento y el día para empezarlo al tocarlo. */
  start: { bid: string; day: string } | null;
}

export function planReminders(
  days: ReminderDay[],
  s: { notifStart: boolean; endLead: number; muted: Record<string, boolean> },
  tracked: (categoryId: string) => boolean,
  now: number,
): Reminder[] {
  const out: Reminder[] = [];
  for (const d of days) {
    d.blocks.forEach((b, j) => {
      if (s.muted[b.id]) return;
      const atStart = b.rem ? b.rem.atStart : s.notifStart;
      const endLead = b.rem ? b.rem.endLead : s.endLead;
      if (atStart) {
        const at = d.dayStartMs + b.s * 60000;
        if (at > now) {
          out.push({
            id: `ag:${d.date}:s${j}`, at, title: S.reminders.startTitle(hm(b.s), b.t), body: b.n || S.reminders.startBody(hm(b.e)),
            start: tracked(b.c) ? { bid: b.id, day: d.date } : null,
          });
        }
      }
      if (endLead > 0 && b.e - b.s >= 30) {
        const at = d.dayStartMs + (b.e - endLead) * 60000;
        if (at > now) {
          out.push({ id: `ag:${d.date}:e${j}`, at, title: S.reminders.endTitle(endLead, b.t), body: S.reminders.endBody(hm(b.e)), start: null });
        }
      }
    });
  }
  return out;
}

/** Avisos propios de las metas (spec 009, 5.1): uno por meta y día en que aplica, a la hora elegida. */
export function planGoalReminders(
  items: { goalId: string; name: string; date: string; time: string }[],
  dayStartMs: (date: string) => number,
  now: number,
): Reminder[] {
  const out: Reminder[] = [];
  for (const it of items) {
    const [h, m] = it.time.split(':').map(Number);
    const at = dayStartMs(it.date) + (h * 60 + m) * 60000;
    if (at > now) out.push({ id: `meta:${it.date}:${it.goalId}`, at, title: S.reminders.goalTitle(it.name), body: S.reminders.goalBody, start: null });
  }
  return out;
}
