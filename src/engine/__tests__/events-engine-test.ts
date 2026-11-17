import { buildV1Store } from '../../__fixtures__/v1-store';
import { memoryKV } from '../../data/kv';
import { createRepository } from '../../data/repository';
import type { EventPatch } from '../../domain/events';
import { migrateRepository } from '../../migration/v1-to-v2';
import { createV2Engine } from '../v2';

function setup() {
  const repo = createRepository(memoryKV(buildV1Store()));
  expect(migrateRepository(repo, '2026-11-17').status).toBe('migrated');
  return { repo, engine: createV2Engine(repo, () => new Date(2026, 10, 17, 12, 0)) };
}
const p: EventPatch = { title: 'Correr', categoryId: 'health', startMin: 600, endMin: 660, note: '', rule: null, endDate: null };

describe('motor v2: operaciones de eventos (fase 3)', () => {
  test('crear un evento de sábado: aparece ese día (antes el fin de semana no tenía agenda)', () => {
    const { engine } = setup();
    expect(engine.blocksFor('2026-11-21')).toBeNull();
    const r = engine.events!.create('2026-11-21', p);
    expect(r.ok).toBe(true);
    expect(engine.blocksFor('2026-11-21')!.map((b) => b.t)).toEqual(['Correr']);
    expect(engine.blocksFor('2026-11-28')).toBeNull();
  });

  test('deshacer: el estado guardado vuelve exactamente al anterior', () => {
    const { engine, repo } = setup();
    const before = JSON.stringify(repo.loadAgenda());
    const snap = engine.events!.snapshot();
    engine.events!.create('2026-11-21', p);
    const id = engine.blocksFor('2026-11-16')!.find((b) => b.t === 'Pausa')!.id;
    engine.events!.remove(id, '2026-11-16', 'always');
    engine.events!.restore(snap);
    expect(JSON.stringify(repo.loadAgenda())).toBe(before);
  });

  test('el snapshot es una copia: cambios posteriores no lo alteran', () => {
    const { engine } = setup();
    const snap = engine.events!.snapshot();
    const n = snap.series.length;
    engine.events!.create('2026-11-21', p);
    expect(snap.series).toHaveLength(n);
  });

  test('editar "A partir de hoy" desde el motor y ver el resultado en días distintos', () => {
    const { engine } = setup();
    const ev = engine.events!;
    const ingles = engine.blocksFor('2026-11-16')!.find((b) => b.t === 'Estudio de inglés')!;
    const s = ev.series(ingles.id)!;
    const patch: EventPatch = { title: 'Inglés B2', categoryId: s.categoryId, startMin: s.startMin, endMin: s.endMin, note: s.note, rule: s.rule, endDate: null };
    expect(ev.allowedScopes(s.id, '2026-11-23', patch)).toEqual(['today', 'fromToday', 'always']);
    expect(ev.edit(s.id, '2026-11-23', patch, 'fromToday').ok).toBe(true);
    expect(engine.blocksFor('2026-11-18')!.some((b) => b.t === 'Estudio de inglés')).toBe(true);
    expect(engine.blocksFor('2026-11-23')!.some((b) => b.t === 'Inglés B2')).toBe(true);
  });

  test('sesiones registradas de un evento, también por su id original', () => {
    const { engine } = setup();
    const ev = engine.events!;
    const jobs = engine.blocksFor('2026-11-16')!.find((b) => b.t === '/jobs y postular')!;
    expect(ev.sessionsFor(jobs.id)).toBe(2); // lunes 09 y miércoles 11 en la fixture
    const yogaThu = engine.blocksFor('2026-11-19')!.find((b) => b.t === 'Yoga')!;
    expect(yogaThu.id).toBe('u-yoga~thu');
    expect(ev.sessionsFor(yogaThu.id)).toBe(1); // registrada con el id original "u-yoga"
  });

  test('categorías elegibles: todas las no archivadas, incluida "Cierre del día"', () => {
    const { engine } = setup();
    expect(engine.events!.categories().map((c) => c.id)).toContain('close');
    expect(engine.legend().map((c) => c.id)).not.toContain('close');
  });

  test('un error de validación no guarda nada', () => {
    const { engine, repo } = setup();
    const before = JSON.stringify(repo.loadAgenda());
    const r = engine.events!.create('2026-11-21', { ...p, endMin: 590 });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(repo.loadAgenda())).toBe(before);
  });
});
