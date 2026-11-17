import {
  countPerTime, createGoal, dailyTarget, deleteGoal, goalNeedsScope, goalVersionOn, isActiveOn, quantityProgress, setGoalArchived,
  timeProgress, updateGoal,
} from '../goals';
import type { GoalInput, GoalOpResult, SessionLike } from '../goals';
import type { AgendaState, Goal } from '../types';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'com', name: 'Comentarios', kind: 'quantity', unit: 'comentarios', links: [], reminder: null, archived: false,
  versions: [{ effectiveFrom: '2026-11-02', target: 5, period: 'day', activeDays: [1, 2, 3, 4, 5] }],
  ...over,
});
const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];

describe('versiones', () => {
  const g = goal({
    versions: [
      { effectiveFrom: '2026-11-02', target: 5, period: 'day', activeDays: [1, 2, 3, 4, 5] },
      { effectiveFrom: '2026-11-20', target: 10, period: 'day', activeDays: [1, 2, 3, 4, 5] },
    ],
  });

  test('CA-14: el objetivo de un día pasado no cambia al subir la meta', () => {
    expect(dailyTarget(g, '2026-11-18')).toBe(5);
    expect(dailyTarget(g, '2026-11-20')).toBe(10);
  });

  test('una fecha anterior a la primera versión usa la primera; "desde siempre" se escribe vacío', () => {
    expect(goalVersionOn(g, '2026-01-01').target).toBe(5);
    expect(goalVersionOn(goal({ versions: [{ effectiveFrom: '', target: 3, period: 'day', activeDays: [1] }] }), '2020-01-06').target).toBe(3);
  });

  test('días en que aplica y metas archivadas', () => {
    const notThu = goal({ versions: [{ effectiveFrom: '', target: 5, period: 'day', activeDays: [1, 2, 3, 5] }] });
    expect(isActiveOn(notThu, '2026-11-19')).toBe(false);
    expect(dailyTarget(notThu, '2026-11-19')).toBeNull();
    expect(isActiveOn(goal({ archived: true }), '2026-11-17')).toBe(false);
  });
});

describe('cantidad', () => {
  test('CA-11: 7 conteos contra un objetivo de 5', () => {
    expect(quantityProgress(goal(), ['2026-11-17'], () => 7)).toEqual({ value: 7, target: 5 });
  });

  test('semana: el objetivo suma solo los días en que aplica', () => {
    const notThu = goal({ versions: [{ effectiveFrom: '', target: 5, period: 'day', activeDays: [1, 2, 3, 5] }] });
    expect(quantityProgress(notThu, week, () => 1)).toEqual({ value: 5, target: 20 });
  });

  test('CA-15: una meta sin objetivo muestra el total sin objetivo', () => {
    const apl = goal({ versions: [{ effectiveFrom: '', target: null, period: 'day', activeDays: [1, 2, 3, 5] }] });
    expect(quantityProgress(apl, week, (d) => (d === '2026-11-17' ? 3 : 0))).toEqual({ value: 3, target: null });
  });

  test('meta semanal: el objetivo es el de la semana', () => {
    const w = goal({ versions: [{ effectiveFrom: '', target: 30, period: 'week', activeDays: [1, 2, 3, 4, 5] }] });
    expect(quantityProgress(w, week, () => 4)).toEqual({ value: 20, target: 30 });
  });
});

describe('tiempo', () => {
  const s = (bid: string, day: string, min: number, endedBy: SessionLike['endedBy'], counts = {}): SessionLike => ({
    bid, day, activeMs: min * 60000, endedBy, counts,
  });
  const proyecto = goal({ id: 'proyecto', kind: 'time', unit: '', links: ['p1'], versions: [{ effectiveFrom: '', target: null, period: 'week', activeDays: [1, 2, 3, 4, 5] }] });

  test('CA-12: solo cuentan sesiones confirmadas de eventos asociados', () => {
    const sessions = [
      s('p1', '2026-11-17', 40, 'manual'),
      s('p1', '2026-11-17', 30, 'auto_close'),
      s('p1', '2026-11-18', 10, 'open'),
      s('p1', '2026-11-18', 20, 'next'),
      s('otro', '2026-11-18', 50, 'manual'),
      s('p1', '2026-11-10', 99, 'manual'), // semana anterior
    ];
    expect(timeProgress(proyecto, week, sessions, (bid) => bid === 'p1')).toEqual({ value: 60, target: null });
  });

  test('CA-13: "N en M min" en una meta de cantidad y tiempo', () => {
    expect(countPerTime('com', s('b', '2026-11-17', 18, 'manual', { com: 5 }))).toEqual({ count: 5, minutes: 18 });
    expect(countPerTime('com', s('b', '2026-11-17', 18, 'manual'))).toBeNull();
  });
});

describe('gestión de metas (CG-22 a CG-28)', () => {
  const st = (goals: Goal[] = []): AgendaState => ({ categories: [], series: [], exceptions: [], goals, legacyBid: {} });
  const input = (over: Partial<GoalInput> = {}): GoalInput => ({
    name: 'Páginas leídas', kind: 'quantity', unit: 'páginas', target: 20, period: 'day', activeDays: [1, 2, 3, 4, 5],
    links: [], reminder: null, ...over,
  });
  const ok = (r: GoalOpResult) => {
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    return r;
  };

  test('CG-22: una meta de cantidad nueva, con objetivo 20 por día', () => {
    const r = ok(createGoal(st(), input(), '2026-11-17', 'm1'));
    const g = r.state.goals[0];
    expect(g).toMatchObject({ id: 'm1', name: 'Páginas leídas', kind: 'quantity', unit: 'páginas', archived: false });
    expect(quantityProgress(g, ['2026-11-17'], () => 25)).toEqual({ value: 25, target: 20 });
  });

  test('CG-23: una meta de tiempo sin eventos asociados no se guarda', () => {
    const r = createGoal(st(), input({ kind: 'time', unit: '' }), '2026-11-17');
    expect(r.ok || r.error).toEqual(['time-needs-event']);
    expect(createGoal(st(), input({ kind: 'both' }), '2026-11-17').ok).toBe(false);
    expect(createGoal(st(), input({ kind: 'time', unit: '', links: ['s1'] }), '2026-11-17').ok).toBe(true);
  });

  test('CG-28: dos metas activas con el mismo nombre, no (sin distinguir mayúsculas)', () => {
    const base = ok(createGoal(st(), input(), '2026-11-17', 'm1')).state;
    const r = createGoal(base, input({ name: ' páginas LEÍDAS ' }), '2026-11-17');
    expect(r.ok || r.error).toEqual(['name-taken']);
  });

  test('otras validaciones', () => {
    const err = (over: Partial<GoalInput>) => {
      const r = createGoal(st(), input(over), '2026-11-17');
      return r.ok ? [] : r.error;
    };
    expect(err({ name: ' ' })).toContain('name-empty');
    expect(err({ unit: '' })).toContain('unit-required');
    expect(err({ target: 0 })).toContain('bad-target');
    expect(err({ target: null })).toEqual([]);
    expect(err({ activeDays: [] })).toContain('no-days');
    expect(err({ reminder: '25:00' })).toContain('bad-reminder');
    expect(err({ reminder: '08:30' })).toEqual([]);
  });

  test('CG-24: subir el objetivo "A partir de hoy" no cambia los días pasados', () => {
    let s = ok(createGoal(st(), input({ target: 5 }), '2026-11-02', 'm1')).state;
    expect(goalNeedsScope(s.goals[0], input({ target: 10 }), '2026-11-20')).toBe(true);
    s = ok(updateGoal(s, 'm1', input({ target: 10 }), 'fromToday', '2026-11-20')).state;
    expect(dailyTarget(s.goals[0], '2026-11-18')).toBe(5);
    expect(dailyTarget(s.goals[0], '2026-11-20')).toBe(10);
  });

  test('CG-25: "Siempre" reescribe el historial', () => {
    let s = ok(createGoal(st(), input({ target: 5 }), '2026-11-02', 'm1')).state;
    s = ok(updateGoal(s, 'm1', input({ target: 10 }), 'fromToday', '2026-11-10')).state;
    s = ok(updateGoal(s, 'm1', input({ target: 8 }), 'always', '2026-11-20')).state;
    expect(s.goals[0].versions).toEqual([{ effectiveFrom: '2026-11-02', target: 8, period: 'day', activeDays: [1, 2, 3, 4, 5] }]);
    expect(dailyTarget(s.goals[0], '2026-11-04')).toBe(8);
  });

  test('cambiar nombre, unidad o eventos asociados no crea versiones ni pide alcance', () => {
    let s = ok(createGoal(st(), input(), '2026-11-02', 'm1')).state;
    expect(goalNeedsScope(s.goals[0], input({ name: 'Lectura', unit: 'pág.' }), '2026-11-20')).toBe(false);
    s = ok(updateGoal(s, 'm1', input({ name: 'Lectura', unit: 'pág.' }), 'fromToday', '2026-11-20')).state;
    expect(s.goals[0]).toMatchObject({ name: 'Lectura', unit: 'pág.' });
    expect(s.goals[0].versions).toHaveLength(1);
  });

  test('dos cambios "A partir de hoy" el mismo día dejan una sola versión de ese día', () => {
    let s = ok(createGoal(st(), input({ target: 5 }), '2026-11-02', 'm1')).state;
    s = ok(updateGoal(s, 'm1', input({ target: 6 }), 'fromToday', '2026-11-20')).state;
    s = ok(updateGoal(s, 'm1', input({ target: 7 }), 'fromToday', '2026-11-20')).state;
    expect(s.goals[0].versions.map((v) => [v.effectiveFrom, v.target])).toEqual([['2026-11-02', 5], ['2026-11-20', 7]]);
  });

  test('CG-26: archivar la saca de las metas activas y conserva su historial; reactivar', () => {
    let s = ok(createGoal(st(), input(), '2026-11-02', 'm1')).state;
    s = ok(setGoalArchived(s, 'm1', true)).state;
    expect(isActiveOn(s.goals[0], '2026-11-17')).toBe(false);
    expect(s.goals[0].versions).toHaveLength(1);
    s = ok(setGoalArchived(s, 'm1', false)).state;
    expect(isActiveOn(s.goals[0], '2026-11-17')).toBe(true);
  });

  test('CG-27: eliminar quita la definición (los conteos guardados por día no están en el modelo y no se tocan)', () => {
    const s = ok(createGoal(st(), input(), '2026-11-02', 'm1')).state;
    expect(ok(deleteGoal(s, 'm1')).state.goals).toEqual([]);
    expect(deleteGoal(s, 'nada')).toEqual({ ok: false, error: 'not-found' });
  });
});
