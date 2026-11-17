// Motor de agenda sobre el modelo v2 (fase 2). Reproduce el comportamiento de las pantallas actuales usando series,
// excepciones, categorías y metas guardadas por la capa de acceso.

import { DayType, addDays, iso, mondayOf, parseISO, secondsOfDay } from '../agenda';
import type { Repository } from '../data/repository';
import { KEYS } from '../data/repository';
import {
  categoryById, categoryUsage, createCategory, deleteCategory, setCategoryArchived, updateCategory,
} from '../domain/categories';
import { addDaysISO } from '../domain/dates';
import {
  allowedDeleteScopes, allowedScopes, createEvent, daysAffected, deleteEvent, editEvent, modifiedDays,
} from '../domain/events';
import type { OpResult } from '../domain/events';
import {
  createGoal, dailyTarget, deleteGoal, goalNeedsScope, goalVersionOn, isActiveOn, quantityProgress, setGoalArchived,
  timeProgress, updateGoal,
} from '../domain/goals';
import type { GoalOpResult } from '../domain/goals';
import { describeRule } from '../domain/describe';
import { buildSessions } from '../sessions';
import type { AgendaState, Category } from '../domain/types';
import type { Settings } from '../storeShape';
import {
  DEFAULT_TUE_ANCHOR, applyDayList, dayKindOf, flipTuesdays, legacyOf, listsFromSeries, newTaskId, rebuildRoot,
  restoreDefaults, toEngineBlocks,
} from './legacy-ops';
import { applyMarginTo, planMarginFor } from './margin';
import type { CategoryOpResult } from '../domain/categories';
import type { AgendaEngine, CategoryInfo, CategoryResult, EngineBlock, EventResult, GoalCard, GoalResult, WeekRow } from './types';

/** Copia profunda del estado (sin depender de `structuredClone`, que no todas las versiones de Hermes tienen). */
const structuredCloneState = (s: AgendaState): AgendaState => JSON.parse(JSON.stringify(s));

const info = (c: Category): CategoryInfo => ({
  id: c.id, name: c.name, color: c.color, movable: c.movable, tracked: c.tracked, marginPreference: c.marginPreference,
});

export function createV2Engine(repo: Repository, clock: () => Date = () => new Date()): AgendaEngine {
  const state = (): AgendaState => {
    const s = repo.loadAgenda();
    if (!s) throw new Error('No hay datos del formato nuevo.');
    return s;
  };
  const anchor = () => repo.getValue(KEYS.legacyTueAnchor) ?? DEFAULT_TUE_ANCHOR;
  const today = () => iso(clock());
  const save = (s: AgendaState) => repo.saveAgenda(s);
  const cat = (id: string) => info(categoryById(state().categories, id));
  const commitCat = (r: CategoryOpResult): CategoryResult => {
    if (!r.ok) return r;
    save(r.state);
    return { ok: true, id: r.id };
  };
  const commitGoal = (r: GoalOpResult): GoalResult => {
    if (!r.ok) return r;
    save(r.state);
    return { ok: true, id: r.id };
  };
  const commit = (r: OpResult): EventResult => {
    if (!r.ok) return r;
    save(r.state);
    return { ok: true, id: r.id };
  };

  const engine: AgendaEngine = {
    kind: 'v2',

    blocksFor(date) {
      const blocks = toEngineBlocks(state(), date);
      return blocks.length === 0 && dayKindOf(date, anchor()) === null ? null : blocks;
    },
    dayKind: (date) => dayKindOf(date, anchor()),
    listFor: (kind) => listsFromSeries(state(), anchor()).lists[kind],

    currentBlock(now) {
      const date = iso(now);
      const sec = secondsOfDay(now);
      const b = (engine.blocksFor(date) ?? []).find((x) => sec >= x.s * 60 && sec < x.e * 60);
      return b ? { bid: b.id, day: date, title: b.t, cat: b.c, planS: b.s, planE: b.e } : null;
    },

    saveTask(draft, scope, date) {
      const st = state();
      if (scope.kind === 'today') {
        const id = draft.id ?? newTaskId();
        const block: EngineBlock = { id, s: draft.s, e: draft.e, t: draft.t.trim(), c: draft.c, n: draft.n.trim() };
        const list = toEngineBlocks(st, date);
        const next = list.some((b) => b.id === id) ? list.map((b) => (b.id === id ? block : b)) : [...list, block];
        save(applyDayList(st, date, next));
        return id;
      }
      const root = draft.id ? legacyOf(st, draft.id) : newTaskId();
      const { lists } = listsFromSeries(st, anchor());
      for (const k of Object.keys(lists) as DayType[]) {
        lists[k] = lists[k].filter((b) => b.id !== root);
        if (scope.lists.includes(k)) {
          lists[k].push({ id: root, s: draft.s, e: draft.e, t: draft.t.trim(), c: draft.c as never, n: draft.n.trim() });
        }
      }
      save(rebuildRoot(st, root, lists, anchor(), today()));
      return root;
    },

    deleteTask(id, scope, date) {
      const st = state();
      if (scope.kind === 'today') {
        save(applyDayList(st, date, toEngineBlocks(st, date).filter((b) => b.id !== id)));
        return;
      }
      const root = legacyOf(st, id);
      const { lists } = listsFromSeries(st, anchor());
      for (const k of scope.lists) lists[k] = lists[k].filter((b) => b.id !== root);
      save(rebuildRoot(st, root, lists, anchor(), today()));
    },

    restore() {
      save(restoreDefaults(state(), anchor(), today()));
    },

    planMargin: (day, aId, endMin) => planMarginFor(day, engine.blocksFor(day) ?? [], cat, aId, endMin),
    applyMargin(plan, targetId) {
      const st = state();
      const next = applyMarginTo(plan, toEngineBlocks(st, plan.day), targetId);
      if (!next) return false;
      save(applyDayList(st, plan.day, next));
      return true;
    },

    category: cat,
    legend() {
      const seen = new Set<string>();
      const out: CategoryInfo[] = [];
      for (const c of state().categories) {
        if (c.archived || seen.has(c.color)) continue;
        seen.add(c.color);
        out.push(info(c));
      }
      return out;
    },

    goalsFor(date): GoalCard[] {
      // Desde la fase 5 cada meta dice en qué días aplica, también sábado y domingo. (En la fase 2, el fin de semana
      // mostraba las metas de un día común para imitar la versión vieja.)
      return state()
        .goals.filter((g) => g.kind !== 'time' && isActiveOn(g, date))
        .map((g) => ({ key: g.id, label: g.name, target: dailyTarget(g, date) }));
    },
    goalName: (key) => state().goals.find((g) => g.id === key)?.name ?? key,

    weekSummary(viewIso): WeekRow[] {
      const st = state();
      const mon = mondayOf(parseISO(viewIso));
      const dates = [0, 1, 2, 3, 4].map((i) => iso(addDays(mon, i)));
      const days = new Map(dates.map((d) => [d, repo.loadDayData(d)]));
      const rows: WeekRow[] = st.goals
        .filter((g) => !g.archived && g.kind !== 'time')
        .map((g) => {
          const p = quantityProgress(g, dates, (d) => days.get(d)!.counts[g.id] ?? 0);
          return { label: g.name, value: p.value, target: p.target, unit: '' };
        });
      // Metas de tiempo (y la parte de tiempo de "cantidad y tiempo"), salvo "Proyecto" y "Ejercicio", que conservan
      // el cálculo de la v1 (decisión 3): minutos de sesiones confirmadas de sus eventos asociados.
      const timeGoals = st.goals.filter((g) => !g.archived && g.kind !== 'quantity' && g.id !== 'proyecto' && g.id !== 'ejercicio');
      if (timeGoals.length) {
        const { sessions } = buildSessions(repo.loadAllLog(), clock().getTime());
        for (const g of timeGoals) {
          const linked = new Set([...g.links, ...g.links.map((l) => legacyOf(st, l))]);
          const p = timeProgress(g, dates, sessions, (bid) => linked.has(bid));
          rows.push({ label: g.kind === 'both' ? `${g.name} (tiempo)` : g.name, value: p.value, target: g.kind === 'both' ? null : p.target, unit: ' min' });
        }
      }
      // "Proyecto" y "Ejercicio" conservan el cálculo actual (decisión 3): horas planificadas hechas de los bloques de
      // las categorías de sus eventos asociados, y sesiones de ejercicio marcadas. El cálculo con tiempo real de
      // sesiones (`timeProgress`) queda listo para cuando se decida cambiarlo.
      const catsOf = (goalId: string) => {
        const g = st.goals.find((x) => x.id === goalId && !x.archived);
        if (!g) return null;
        return new Set(st.series.filter((s) => g.links.includes(s.id)).map((s) => s.categoryId));
      };
      const proj = catsOf('proyecto');
      const ex = catsOf('ejercicio');
      let projDone = 0;
      let projTotal = 0;
      let exDone = 0;
      let exTotal = 0;
      for (const d of dates) {
        const done = days.get(d)!.done;
        for (const b of engine.blocksFor(d) ?? []) {
          if (proj?.has(b.c)) {
            projTotal += b.e - b.s;
            if (done[b.id]) projDone += b.e - b.s;
          }
          if (ex?.has(b.c)) {
            exTotal += 1;
            if (done[b.id]) exDone += 1;
          }
        }
      }
      if (proj) rows.push({ label: 'Proyecto', value: Math.round(projDone / 6) / 10, target: Math.round(projTotal / 6) / 10, unit: ' h' });
      if (ex) rows.push({ label: 'Ejercicio', value: exDone, target: exTotal, unit: ' sesiones' });
      return rows;
    },

    upcomingTueAds(n, from) {
      const out: string[] = [];
      for (let d = from, i = 0; i < 26 * 7 && out.length < n; i++, d = addDaysISO(d, 1)) {
        if (dayKindOf(d, anchor()) === 'tueAds') out.push(d);
      }
      return out;
    },
    shiftTuesdays(days) {
      save(flipTuesdays(state()));
      repo.writeAll([[KEYS.legacyTueAnchor, addDaysISO(anchor(), days)]]);
    },

    loadSettings(): Settings {
      const s = repo.loadSettings();
      return { notifStart: s.notifStart, endLead: s.endLead, wake: s.wake, muted: s.muted, anchor: anchor() };
    },
    saveSettings(s) {
      repo.saveSettings({ notifStart: s.notifStart, endLead: s.endLead, wake: s.wake, muted: s.muted });
    },

    events: {
      series: (id) => state().series.find((x) => x.id === id) ?? null,
      categories: () => state().categories.filter((c) => !c.archived).map(info),
      create: (date, patch) => commit(createEvent(state(), date, patch)),
      edit: (id, refDate, patch, scope) => commit(editEvent(state(), id, refDate, patch, scope)),
      remove: (id, refDate, scope) => commit(deleteEvent(state(), id, refDate, scope)),
      allowedScopes(id, refDate, patch) {
        const s = state().series.find((x) => x.id === id);
        return s ? allowedScopes(s, refDate, patch) : [];
      },
      allowedDeleteScopes(id, refDate) {
        const s = state().series.find((x) => x.id === id);
        return s ? allowedDeleteScopes(s, refDate) : [];
      },
      modifiedDays: (id, fromDate) => modifiedDays(state(), id, fromDate),
      daysAffected(id, refDate, scope) {
        const s = state().series.find((x) => x.id === id);
        return s ? daysAffected(s, refDate, scope) : 0;
      },
      sessionsFor(id) {
        const st = state();
        const s = st.series.find((x) => x.id === id);
        if (!s) return 0;
        const root = legacyOf(st, id);
        return repo.loadAllLog().filter((e) =>
          e.kind === 'start' &&
          (e.bid === id || (e.bid === root && e.day >= s.startDate && (s.endDate === null || e.day <= s.endDate)))).length;
      },
      goals: () => state().goals.filter((g) => !g.archived).map((g) => ({ id: g.id, name: g.name, kind: g.kind })),
      goalIdsFor: (id) => state().goals.filter((g) => g.links.includes(id)).map((g) => g.id),
      createCategory(input) {
        const r = createCategory(state(), input);
        if (!r.ok) return r;
        save(r.state);
        return { ok: true, id: r.id };
      },
      categoriesAll: () => {
        const st = state();
        return st.categories.map((c) => ({ ...info(c), archived: c.archived, usage: categoryUsage(st, c.id) }));
      },
      updateCategory: (id, input) => commitCat(updateCategory(state(), id, input)),
      setCategoryArchived: (id, archived) => commitCat(setCategoryArchived(state(), id, archived)),
      deleteCategory: (id, reassignTo) => commitCat(deleteCategory(state(), id, reassignTo)),
      goalsAll: () => {
        const counts = new Map<string, number>();
        for (const e of repo.loadAllLog()) if (e.kind === 'count' && e.goal) counts.set(e.goal, (counts.get(e.goal) ?? 0) + 1);
        return state().goals.map((g) => ({
          id: g.id, name: g.name, kind: g.kind, unit: g.unit, links: g.links, reminder: g.reminder, archived: g.archived,
          version: goalVersionOn(g, today()), counts: counts.get(g.id) ?? 0,
        }));
      },
      createGoal: (input) => commitGoal(createGoal(state(), input, today())),
      updateGoal: (id, input, scope) => commitGoal(updateGoal(state(), id, input, scope, today())),
      goalNeedsScope(id, input) {
        const g = state().goals.find((x) => x.id === id);
        return g ? goalNeedsScope(g, input, today()) : false;
      },
      setGoalArchived: (id, archived) => commitGoal(setGoalArchived(state(), id, archived)),
      deleteGoal: (id) => commitGoal(deleteGoal(state(), id)),
      goalsForSeries(bid, date) {
        const st = state();
        const ids = new Set(st.series.filter((s) => s.id === bid || legacyOf(st, s.id) === bid).map((s) => s.id));
        ids.add(bid);
        return st.goals
          .filter((g) => g.kind !== 'time' && !g.archived && g.links.some((l) => ids.has(l)))
          .map((g) => ({ key: g.id, label: g.name, target: isActiveOn(g, date) ? dailyTarget(g, date) : null }));
      },
      linkableSeries() {
        const t = today();
        return state()
          .series.filter((s) => !s.archived && (s.endDate === null || s.endDate >= t) && (s.rule !== null || s.startDate >= t))
          .map((s) => ({ id: s.id, title: s.title, summary: describeRule(s.rule, s.startDate, s.endDate) }))
          .sort((a, b) => a.title.localeCompare(b.title) || a.summary.localeCompare(b.summary));
      },
      goalReminders(dates) {
        const out: { goalId: string; name: string; date: string; time: string }[] = [];
        for (const g of state().goals) {
          if (!g.reminder || g.archived) continue;
          for (const d of dates) if (isActiveOn(g, d)) out.push({ goalId: g.id, name: g.name, date: d, time: g.reminder });
        }
        return out;
      },
      snapshot: () => structuredCloneState(state()),
      restore: (snap) => save(snap),
    },
  };
  return engine;
}
