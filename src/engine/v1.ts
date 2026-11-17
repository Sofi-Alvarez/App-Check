// Motor de agenda sobre el formato viejo (v1). Envuelve el código que ya funciona (`schedule.ts`, `store.ts`) sin
// cambiar su comportamiento. La app lo usa mientras la migración real no haya corrido (o si se negó).

import {
  Block, DayType, GOAL_LABELS, LEGEND, addDays, dayType, goalsFor, iso, mondayOf, parseISO,
} from '../agenda';
import { isLegacyCategoryId, legacyCategory, unknownCategory } from '../domain/categories';
import {
  applyMargin, blocksFor, currentBlockInfo, deleteTask, listFor, planMargin, saveTask,
} from '../schedule';
import { loadDay, loadSettings, resetSchedule, saveSettings } from '../store';
import type { AgendaEngine, CategoryInfo, WeekRow } from './types';

const catInfo = (id: string): CategoryInfo => {
  const c = isLegacyCategoryId(id) ? legacyCategory(id) : unknownCategory(id);
  return { id: c.id, name: c.name, color: c.color, movable: c.movable, tracked: c.tracked, marginPreference: c.marginPreference };
};

/** Totales de la semana tal como los calculaba `GoalsScreen` (movido acá sin cambios). */
function weekRowsV1(viewIso: string, anchor: string): WeekRow[] {
  const mon = mondayOf(parseISO(viewIso));
  const keys = ['post', 'com', 'rea', 'cold', 'fol', 'apl'];
  const sums: Record<string, { c: number; t: number; hasT: boolean }> = {};
  keys.forEach((k) => (sums[k] = { c: 0, t: 0, hasT: false }));
  let projDone = 0, projTotal = 0, exDone = 0, exTotal = 0;
  for (let i = 0; i < 5; i++) {
    const d = addDays(mon, i);
    const type = dayType(d, anchor);
    const blocks = blocksFor(d, anchor) ?? [];
    const data = loadDay(iso(d));
    goalsFor(type).forEach((g) => {
      if (g.target != null) {
        sums[g.key].t += g.target;
        sums[g.key].hasT = true;
      }
    });
    Object.entries(data.counts).forEach(([k, v]) => {
      if (sums[k]) sums[k].c += v;
    });
    blocks.forEach((b) => {
      const dur = b.e - b.s;
      if (b.c === 'project') {
        projTotal += dur;
        if (data.done[b.id]) projDone += dur;
      }
      if (b.c === 'health') {
        exTotal += 1;
        if (data.done[b.id]) exDone += 1;
      }
    });
  }
  const rows: WeekRow[] = keys.map((k) => ({
    label: GOAL_LABELS[k], value: sums[k].c, target: sums[k].hasT ? sums[k].t : null, unit: '',
  }));
  rows.push({ label: 'Proyecto', value: Math.round(projDone / 6) / 10, target: Math.round(projTotal / 6) / 10, unit: ' h' });
  rows.push({ label: 'Ejercicio', value: exDone, target: exTotal, unit: ' sesiones' });
  return rows;
}

export function createV1Engine(): AgendaEngine {
  const anchor = () => loadSettings().anchor;
  return {
    kind: 'v1',
    blocksFor: (date) => blocksFor(parseISO(date), anchor()),
    dayKind: (date) => dayType(parseISO(date), anchor()),
    listFor: (kind: DayType) => listFor(kind),
    currentBlock: (now) => currentBlockInfo(now, anchor()),
    saveTask: (draft, scope, date) => saveTask({ ...draft, c: draft.c as Block['c'] }, scope, date, anchor()),
    deleteTask: (id, scope, date) => deleteTask(id, scope, date, anchor()),
    restore: () => resetSchedule(),
    planMargin: (day, aId, endMin) => planMargin(day, anchor(), aId, endMin),
    applyMargin: (plan, targetId) => applyMargin(plan, targetId, anchor()),
    category: catInfo,
    legend: () => LEGEND.map(([id]) => catInfo(id)),
    goalsFor: (date) => goalsFor(dayType(parseISO(date), anchor())).map((g) => ({ key: g.key, label: g.label, target: g.target })),
    goalName: (key) => GOAL_LABELS[key] ?? key,
    weekSummary: (viewIso) => weekRowsV1(viewIso, anchor()),
    upcomingTueAds(n, from) {
      const out: string[] = [];
      let d = parseISO(from);
      for (let i = 0; i < 26 * 7 && out.length < n; i++) {
        if (dayType(d, anchor()) === 'tueAds') out.push(iso(d));
        d = addDays(d, 1);
      }
      return out;
    },
    shiftTuesdays(days) {
      const s = loadSettings();
      saveSettings({ ...s, anchor: iso(addDays(parseISO(s.anchor), days)) });
    },
    loadSettings,
    saveSettings,
  };
}
