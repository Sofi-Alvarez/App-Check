import { defaultBlocks } from '../agenda';
import { legacyCategory } from '../domain/categories';
import { ReminderDay, planGoalReminders, planReminders } from '../reminders';

const tracked = (c: string) => legacyCategory(c as never).tracked;
const day = (date: string, blocks: ReminderDay['blocks'] = defaultBlocks('mwf')) => ({ date, dayStartMs: new Date(2026, 10, 16).getTime(), blocks });
const S = { notifStart: true, endLead: 5, muted: {} as Record<string, boolean> };

describe('planReminders', () => {
  const all = planReminders([day('2026-11-16')], S, tracked, 0);

  test('un aviso de inicio por evento y uno de fin para los de 30 minutos o más', () => {
    const blocks = defaultBlocks('mwf');
    expect(all.filter((r) => r.id.includes(':s'))).toHaveLength(blocks.length);
    expect(all.filter((r) => r.id.includes(':e'))).toHaveLength(blocks.filter((b) => b.e - b.s >= 30).length);
  });

  test('el botón "Empecé" solo en categorías que permiten empezar (no fijas ni pausas)', () => {
    const titles = (pred: (r: (typeof all)[number]) => boolean) => all.filter(pred).map((r) => r.title.slice(8));
    expect(titles((r) => r.id.includes(':s') && r.start === null)).toEqual(expect.arrayContaining(['Rutina de mañana', 'Pausa', 'Almuerzo']));
    expect(titles((r) => r.start !== null)).toEqual(expect.arrayContaining(['/jobs y postular', 'Cierre y plan de mañana']));
    expect(all.find((r) => r.start)?.start).toEqual({ bid: 'mwf:480', day: '2026-11-16' });
  });

  test('textos: hora y título; nota o "Hasta las"; aviso de fin', () => {
    const jobs = all.find((r) => r.id.endsWith(':s4'))!;
    expect(jobs.title).toBe('10:00 · /jobs y postular');
    const pausa = all.find((r) => r.title === '11:30 · Pausa')!;
    expect(pausa.body).toBe('Hasta las 11:45');
    expect(all.find((r) => r.title === 'Quedan 5 min: /jobs y postular')!.body).toBe('Termina a las 11:30');
  });

  test('silenciados, avisos pasados y ajustes apagados', () => {
    const muted = planReminders([day('2026-11-16')], { ...S, muted: { 'mwf:600': true } }, tracked, 0);
    expect(muted.some((r) => r.title.includes('/jobs'))).toBe(false);
    const noon = new Date(2026, 10, 16, 12, 0).getTime();
    expect(planReminders([day('2026-11-16')], S, tracked, noon).every((r) => r.at > noon)).toBe(true);
    expect(planReminders([day('2026-11-16')], { ...S, notifStart: false, endLead: 0 }, tracked, 0)).toEqual([]);
  });

  test('un fin de semana con eventos también tiene avisos', () => {
    const sat = planReminders([day('2026-11-21', [{ id: 'x', s: 600, e: 660, t: 'Correr', c: 'health', n: '' }])], S, tracked, 0);
    expect(sat.map((r) => r.id)).toEqual(['ag:2026-11-21:s0', 'ag:2026-11-21:e0']);
  });
});

describe('aviso propio por evento', () => {
  const b = (rem: { atStart: boolean; endLead: number } | null | undefined) => [{ id: 'x', s: 600, e: 660, t: 'Correr', c: 'health', n: '', rem }];
  const ids = (rem: Parameters<typeof b>[0], s = S) => planReminders([day('2026-11-21', b(rem))], s, tracked, 0).map((r) => r.title);

  test('sin aviso propio se usan los ajustes', () => {
    expect(ids(null)).toEqual(['10:00 · Correr', 'Quedan 5 min: Correr']);
    expect(ids(undefined, { ...S, notifStart: false, endLead: 0 })).toEqual([]);
  });
  test('el aviso propio pisa los ajustes', () => {
    expect(ids({ atStart: false, endLead: 15 })).toEqual(['Quedan 15 min: Correr']);
    expect(ids({ atStart: true, endLead: 0 }, { ...S, notifStart: false })).toEqual(['10:00 · Correr']);
  });
});

describe('avisos propios de las metas', () => {
  test('uno por meta y día, a la hora elegida, sin los que ya pasaron', () => {
    const start = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).getTime();
    const items = [
      { goalId: 'm1', name: 'Páginas leídas', date: '2026-11-17', time: '21:30' },
      { goalId: 'm1', name: 'Páginas leídas', date: '2026-11-18', time: '21:30' },
      { goalId: 'm2', name: 'Agua', date: '2026-11-17', time: '08:00' },
    ];
    const now = new Date(2026, 10, 17, 12, 0).getTime();
    const r = planGoalReminders(items, start, now);
    expect(r.map((x) => x.id)).toEqual(['meta:2026-11-17:m1', 'meta:2026-11-18:m1']);
    expect(r[0]).toMatchObject({ title: 'Meta: Páginas leídas', at: new Date(2026, 10, 17, 21, 30).getTime(), start: null });
  });
});
