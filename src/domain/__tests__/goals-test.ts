import { countPerTime, dailyTarget, goalVersionOn, isActiveOn, quantityProgress, timeProgress } from '../goals';
import type { SessionLike } from '../goals';
import type { Goal } from '../types';

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
