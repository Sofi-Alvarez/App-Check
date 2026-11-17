import { defaultBlocks } from '../agenda';
import { legacyCategory } from '../domain/categories';
import { planReminders } from '../reminders';

const tracked = (c: string) => legacyCategory(c as never).tracked;
const day = (date: string, blocks = defaultBlocks('mwf')) => ({ date, dayStartMs: new Date(2026, 10, 16).getTime(), blocks });
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
