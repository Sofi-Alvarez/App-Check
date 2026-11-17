// Equivalencia entre el motor v1 (el código actual, sobre un almacén simulado en memoria) y el motor v2 (modelo nuevo,
// desde la misma fixture migrada). Se aplican las mismas operaciones a los dos y se compara la agenda día por día.
//
// Diferencia conocida y aceptada: en la v1, un día con cambios "Solo hoy" quedaba congelado frente a cambios "Siempre"
// posteriores. En la v2, esos días conservan solo los campos que se cambiaron ese día y reciben el resto del cambio
// (es lo que pide la spec 009). Esos días se comparan aparte.

const mockMem = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (k: string) => (mockMem.has(k) ? mockMem.get(k)! : null),
    setItemSync: (k: string, v: string) => {
      mockMem.set(k, v);
    },
    removeItemSync: (k: string) => {
      mockMem.delete(k);
    },
    getAllKeysSync: () => [...mockMem.keys()],
  },
}));

/* eslint-disable import/first */
import { buildV1Store } from '../../__fixtures__/v1-store';
import { memoryKV } from '../../data/kv';
import { createRepository } from '../../data/repository';
import { addDaysISO } from '../../domain/dates';
import { migrateRepository } from '../../migration/v1-to-v2';
import type { AgendaEngine, EngineBlock } from '../types';
import { createV1Engine } from '../v1';
import { createV2Engine } from '../v2';
/* eslint-enable import/first */

const TODAY = '2026-11-17';
const CLOCK = () => new Date(2026, 10, 17, 12, 0);
const FROM = '2026-11-02';
const TO = '2027-01-12';
/** Días con cambios "Solo hoy" en la fixture. */
const OVERRIDE_DAYS = ['2026-11-11', '2026-11-12'];

function setup() {
  mockMem.clear();
  for (const [k, v] of buildV1Store()) mockMem.set(k, v);
  const v1 = createV1Engine();
  const repo = createRepository(memoryKV(buildV1Store()));
  expect(migrateRepository(repo, TODAY).status).toBe('migrated');
  const v2 = createV2Engine(repo, CLOCK);
  const legacy = (id: string) => repo.loadAgenda()!.legacyBid[id] ?? id;
  return { v1, v2, repo, legacy };
}

type Env = ReturnType<typeof setup>;
const norm = (bs: EngineBlock[] | null, map: (id: string) => string = (x) => x) =>
  bs === null ? null : bs.map((b) => [b.s, b.e, map(b.id), b.t, b.c, b.n].join('|')).sort();

/** Compara todos los días. Con `ignoreNewIds`, los ids de tareas nuevas (al azar en cada motor) no se comparan. */
function compareDays(env: Env, skip: string[] = [], ignoreNewIds = false) {
  const map = (id: string) => (ignoreNewIds && /^u-(?!lectura|yoga|medico)/.test(id) ? 'nuevo' : id);
  for (let d = FROM; d <= TO; d = addDaysISO(d, 1)) {
    if (skip.includes(d)) continue;
    expect([d, env.v2.dayKind(d)]).toEqual([d, env.v1.dayKind(d)]);
    expect([d, norm(env.v2.blocksFor(d), (id) => map(env.legacy(id)))]).toEqual([d, norm(env.v1.blocksFor(d), map)]);
  }
}
const both = (env: Env, f: (e: AgendaEngine) => void) => {
  f(env.v1);
  f(env.v2);
};
const block = (e: AgendaEngine, date: string, title: string) => e.blocksFor(date)!.find((b) => b.t === title)!;

describe('motores v1 y v2: sin cambios', () => {
  test('la misma agenda todos los días, incluidos fines de semana (null) y martes alternos', () => {
    compareDays(setup());
  });

  test('listas por tipo de día, evento actual, categorías y leyenda', () => {
    const env = setup();
    for (const k of ['mwf', 'tueOff', 'tueAds', 'thu', 'fri'] as const) {
      expect([k, norm(env.v2.listFor(k))]).toEqual([k, norm(env.v1.listFor(k))]);
    }
    for (const h of [6, 9, 10, 13, 15, 19, 23]) {
      const now = new Date(2026, 10, 16, h, 5);
      const a = env.v1.currentBlock(now);
      const b = env.v2.currentBlock(now);
      expect(b && { ...b, bid: env.legacy(b.bid) }).toEqual(a);
    }
    expect(env.v2.legend()).toEqual(env.v1.legend());
    for (const id of ['work', 'fixed', 'rest', 'close', 'rara']) expect(env.v2.category(id)).toEqual(env.v1.category(id));
  });

  test('ajustes: mismos valores y el ancla de los martes', () => {
    const env = setup();
    expect(env.v2.loadSettings()).toEqual(env.v1.loadSettings());
  });

  test('metas: mismas tarjetas (salvo nombres y Postulaciones los martes con adscripción) y mismos totales', () => {
    const env = setup();
    for (let d = '2026-11-09'; d <= '2026-11-20'; d = addDaysISO(d, 1)) {
      const kind = env.v1.dayKind(d);
      // Diferencia aceptada (fase 5): el fin de semana la v1 mostraba las metas de un día común; la v2 muestra las
      // que aplican ese día (las migradas son de lunes a viernes, así que ninguna).
      if (kind === null) {
        expect(env.v2.goalsFor(d)).toEqual([]);
        continue;
      }
      const pick = (cards: { key: string; target: number | null }[]) =>
        cards.filter((c) => !(kind === 'tueAds' && c.key === 'apl')).map((c) => [c.key, c.target]);
      expect([d, pick(env.v2.goalsFor(d))]).toEqual([d, pick(env.v1.goalsFor(d))]);
    }
    for (const w of ['2026-11-09', '2026-11-16']) {
      const strip = (rows: { value: number; target: number | null; unit: string }[]) => rows.map((r) => [r.value, r.target, r.unit]);
      expect(strip(env.v2.weekSummary(w))).toEqual(strip(env.v1.weekSummary(w)));
      expect(env.v2.weekSummary(w).map((r) => r.label)).toEqual(env.v1.weekSummary(w).map((r) => r.label));
    }
  });

  test('próximos martes con adscripción', () => {
    const env = setup();
    expect(env.v2.upcomingTueAds(3, TODAY)).toEqual(env.v1.upcomingTueAds(3, TODAY));
  });
});

describe('motores v1 y v2: mismas operaciones, mismo resultado', () => {
  test('"Solo hoy": editar una tarea existente', () => {
    const env = setup();
    both(env, (e) => {
      const b = block(e, '2026-11-16', 'Cold outreach');
      e.saveTask({ id: b.id, t: 'Contactos', c: 'work', s: b.s + 15, e: b.e, n: 'otra nota' }, { kind: 'today' }, '2026-11-16');
    });
    compareDays(env);
  });

  test('"Solo hoy": tarea nueva y tarea quitada', () => {
    const env = setup();
    both(env, (e) => {
      e.saveTask({ id: null, t: 'Médico', c: 'fixed', s: 600, e: 660, n: '' }, { kind: 'today' }, '2026-11-18');
      e.deleteTask(block(e, '2026-11-19', 'Viaje').id, { kind: 'today' }, '2026-11-19');
    });
    compareDays(env, [], true);
  });

  test('"Solo hoy" sobre un día que ya tenía cambios', () => {
    const env = setup();
    both(env, (e) => {
      const b = block(e, '2026-11-11', 'Pausa');
      e.saveTask({ id: b.id, t: 'Pausa larga', c: 'rest', s: b.s, e: b.e + 5, n: '' }, { kind: 'today' }, '2026-11-11');
    });
    compareDays(env);
  });

  test('"Siempre": editar una tarea y aplicarla a otro tipo de día', () => {
    const env = setup();
    both(env, (e) => {
      const b = block(e, '2026-11-16', 'Proyecto de diseño');
      e.saveTask({ id: b.id, t: 'Portfolio', c: 'project', s: b.s, e: b.e, n: '' }, { kind: 'always', lists: ['mwf', 'fri'] }, '2026-11-16');
    });
    compareDays(env, OVERRIDE_DAYS);
  });

  test('"Siempre": tarea nueva solo los martes con adscripción, y otra en todos los martes y jueves', () => {
    const env = setup();
    both(env, (e) => {
      e.saveTask({ id: null, t: 'Lectura corta', c: 'project', s: 1260, e: 1290, n: '' }, { kind: 'always', lists: ['tueAds'] }, TODAY);
      e.saveTask({ id: null, t: 'Estirar', c: 'health', s: 1300, e: 1320, n: '' }, { kind: 'always', lists: ['tueAds', 'tueOff', 'thu'] }, TODAY);
    });
    // Los ids nuevos difieren entre motores: se compara sin ids.
    const noId = (bs: EngineBlock[] | null) => (bs === null ? null : bs.map((b) => [b.s, b.e, b.t, b.c, b.n].join('|')).sort());
    for (let d = FROM; d <= TO; d = addDaysISO(d, 1)) {
      if (OVERRIDE_DAYS.includes(d)) continue;
      expect([d, noId(env.v2.blocksFor(d))]).toEqual([d, noId(env.v1.blocksFor(d))]);
    }
  });

  test('"Siempre": quitar una tarea de un tipo de día', () => {
    const env = setup();
    both(env, (e) => e.deleteTask('u-lectura', { kind: 'always', lists: ['fri'] }, '2026-11-20'));
    compareDays(env, OVERRIDE_DAYS);
  });

  test('"Siempre" sobre la tarea separada (caso difícil): pasa a ser solo de los jueves', () => {
    const env = setup();
    both(env, (e) => {
      const b = block(e, '2026-11-19', 'Yoga');
      e.saveTask({ id: b.id, t: 'Yoga', c: 'health', s: 1200, e: 1230, n: '' }, { kind: 'always', lists: ['thu'] }, '2026-11-19');
    });
    compareDays(env, OVERRIDE_DAYS);
  });

  test('margen: mismo plan y mismo día resultante', () => {
    const env = setup();
    const plans = [env.v1, env.v2].map((e) => e.planMargin('2026-11-16', block(e, '2026-11-16', '/jobs y postular').id, 660));
    const mapPlan = (p: typeof plans[number], map: (id: string) => string) =>
      p && { ...p, aId: map(p.aId), defaultId: p.defaultId && map(p.defaultId), options: p.options.map((o) => ({ ...o, id: map(o.id) })) };
    expect(mapPlan(plans[1], env.legacy)).toEqual(plans[0]);
    const target = plans[0]!.options.find((o) => o.title === 'Cold outreach')!.id;
    expect(env.v1.applyMargin(plans[0]!, target)).toBe(true);
    expect(env.v2.applyMargin(plans[1]!, target)).toBe(true);
    compareDays(env);
  });

  test('margen: no se ofrece desde una tarea fija ni con menos de 5 minutos', () => {
    const env = setup();
    for (const e of [env.v1, env.v2]) {
      expect(e.planMargin('2026-11-17', block(e, '2026-11-17', 'Viaje').id, 500)).toBeNull();
      expect(e.planMargin('2026-11-16', block(e, '2026-11-16', '/jobs y postular').id, 688)).toBeNull();
    }
  });

  test('restaurar la agenda original', () => {
    const env = setup();
    both(env, (e) => {
      e.saveTask({ id: null, t: 'X', c: 'work', s: 1300, e: 1330, n: '' }, { kind: 'today' }, '2026-11-16');
      e.restore();
    });
    compareDays(env);
  });

  test('mover los martes una semana (adelante y atrás)', () => {
    const env = setup();
    both(env, (e) => e.shiftTuesdays(7));
    compareDays(env);
    expect(env.v2.loadSettings().anchor).toBe(env.v1.loadSettings().anchor);
    both(env, (e) => e.shiftTuesdays(-7));
    compareDays(env);
  });

  test('ajustes guardados: mismos valores al releer', () => {
    const env = setup();
    both(env, (e) => e.saveSettings({ ...e.loadSettings(), endLead: 10, muted: { 'mwf:600': true } }));
    expect(env.v2.loadSettings()).toEqual(env.v1.loadSettings());
  });
});

describe('diferencia aceptada: los días con cambios "Solo hoy" reciben los cambios "Siempre" posteriores', () => {
  test('el 11/11 (margen aplicado) muestra el título nuevo y conserva el horario del margen', () => {
    const env = setup();
    const before = block(env.v2, '2026-11-11', 'Cold outreach');
    const b = block(env.v2, '2026-11-16', 'Cold outreach');
    env.v2.saveTask({ id: b.id, t: 'Contactos nuevos', c: 'work', s: b.s, e: b.e, n: b.n }, { kind: 'always', lists: ['mwf'] }, '2026-11-16');
    const after = block(env.v2, '2026-11-11', 'Contactos nuevos');
    expect([after.s, after.e]).toEqual([before.s, before.e]);
    // En la v1 ese día habría quedado con el título viejo:
    env.v1.saveTask({ id: b.id, t: 'Contactos nuevos', c: 'work', s: b.s, e: b.e, n: b.n }, { kind: 'always', lists: ['mwf'] }, '2026-11-16');
    expect(env.v1.blocksFor('2026-11-11')!.some((x) => x.t === 'Cold outreach')).toBe(true);
  });
});
