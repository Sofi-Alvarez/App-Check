import { defaultBlocks } from '../../agenda';
import { EXPECTED, NOW, buildV1Store } from '../../__fixtures__/v1-store';
import { memoryKV } from '../../data/kv';
import { KEYS, createRepository } from '../../data/repository';
import { buildDay } from '../../domain/recurrence';
import type { AgendaState } from '../../domain/types';
import { buildSessions } from '../../sessions';
import type { Entry } from '../v1-reader';
import { readV1, v1BlocksFor } from '../v1-reader';
import { BACKUP_COMPLETE_KEY, migrateRepository, migrateV1, seriesStarts, sourceEntries } from '../v1-to-v2';

const TODAY = '2026-11-17';

function migrated(entries: Entry[] = buildV1Store()) {
  const r = migrateV1(entries, TODAY);
  if (!r.ok) throw new Error(`${r.error}\n${JSON.stringify(r.mismatches.slice(0, 2), null, 1)}`);
  return r;
}
const legacyOf = (a: AgendaState, id: string) => a.legacyBid[id] ?? id;
const seriesById = (a: AgendaState, id: string) => a.series.find((s) => s.id === id)!;

describe('seriesStarts', () => {
  test('las semanas A son las del martes con adscripción del ancla', () => {
    expect(seriesStarts('2026-11-09', '2026-11-03')).toEqual({ weekly: '2026-11-09', a: '2026-11-02', b: '2026-11-09' });
    expect(seriesStarts('2026-11-03', '2026-11-03')).toEqual({ weekly: '2026-11-02', a: '2026-11-02', b: '2026-11-09' });
    expect(seriesStarts('2026-10-20', '2026-11-03')).toEqual({ weekly: '2026-10-19', a: '2026-10-19', b: '2026-10-26' });
  });
});

describe('migración de la fixture v1', () => {
  const r = migrated();
  const a = r.agenda;
  const v1 = readV1(buildV1Store());

  test('CA-16: la agenda de cada día con datos es idéntica antes y después', () => {
    const dates = new Set([...Object.keys(v1.days), ...Object.keys(v1.overrides), ...v1.logs.map((e) => e.day)]);
    for (const d of dates) {
      const before = (v1BlocksFor(v1, d) ?? []).map((b) => [b.id, b.s, b.e, b.t, b.c, b.n].join('|')).sort();
      const after = buildDay(a, d).map((b) => [legacyOf(a, b.id), b.s, b.e, b.t, b.c, b.n].join('|')).sort();
      expect([d, ...after]).toEqual([d, ...before]);
    }
  });

  test('la autoverificación cubrió desde un año antes del primer dato hasta 8 semanas después de hoy', () => {
    // Del 03/11/2025 (52 semanas antes del primer dato) al 12/01/2027.
    expect(r.report.verifiedDays).toBeGreaterThan(364 + 56);
  });

  test('las fechas anteriores al primer dato también muestran la agenda, como en la v1', () => {
    for (const d of ['2026-10-27', '2026-06-01', '2025-11-10']) {
      const before = (v1BlocksFor(v1, d) ?? []).map((b) => b.id).sort();
      const after = buildDay(a, d).map((b) => legacyOf(a, b.id)).sort();
      expect([d, after]).toEqual([d, before]);
      expect(after.length).toBeGreaterThan(0);
    }
  });

  test('CA-16: el registro no se toca y las sesiones calculadas son las mismas', () => {
    expect(r.writes.some(([k]) => k.startsWith('agenda:log:'))).toBe(false);
    const { sessions } = buildSessions(v1.logs, NOW);
    expect(sessions).toHaveLength(EXPECTED.sessions);
  });

  test('CA-19: cada evento del registro se une a una serie que ocurre ese día', () => {
    for (const e of v1.logs) {
      const ok = buildDay(a, e.day).some((b) => legacyOf(a, b.id) === e.bid);
      expect(`${e.day} ${e.bid} ${ok}`).toBe(`${e.day} ${e.bid} true`);
    }
  });

  test('una tarea con el mismo horario en lunes, miércoles y viernes queda como una sola serie', () => {
    const s = seriesById(a, EXPECTED.sharedIdSameTimes);
    expect(s.rule).toEqual({ weekdays: [1, 3, 5], everyWeeks: 1 });
    expect(a.series.filter((x) => legacyOf(a, x.id) === EXPECTED.sharedIdSameTimes)).toHaveLength(1);
  });

  test('caso difícil: la misma tarea con horarios distintos se separa y conserva el vínculo con el id original', () => {
    const parts = a.series.filter((x) => legacyOf(a, x.id) === EXPECTED.sharedIdDifferentTimes);
    expect(parts.map((p) => [p.id, p.rule?.weekdays, p.startMin])).toEqual([
      ['u-yoga', [1, 3], 18 * 60 + 30],
      ['u-yoga~thu', [4], 19 * 60 + 40],
    ]);
    expect(a.legacyBid).toEqual({ 'u-yoga~thu': 'u-yoga' });
    expect(r.report.split).toEqual(['u-yoga']);
  });

  test('un bloque original con horario editado conserva su id', () => {
    const s = seriesById(a, EXPECTED.editedOriginal.id);
    expect([s.startMin, s.endMin]).toEqual([EXPECTED.editedOriginal.s, EXPECTED.editedOriginal.e]);
  });

  test('un bloque eliminado con "Siempre" no aparece en los viernes y sí en lunes', () => {
    expect(buildDay(a, '2026-11-13').some((b) => b.id === EXPECTED.deletedAlways.id)).toBe(false);
    expect(buildDay(a, '2026-11-09').some((b) => b.t === 'Pausa')).toBe(true);
  });

  test('los martes alternan con y sin adscripción también en el futuro', () => {
    const ads = defaultBlocks('tueAds').map((b) => b.id).sort();
    const off = defaultBlocks('tueOff').map((b) => b.id).sort();
    const ids = (d: string) => buildDay(a, d).map((b) => b.id).sort();
    expect(ids('2026-11-17')).toEqual(ads);
    expect(ids('2026-11-24')).toEqual(off);
    expect(ids('2026-12-01')).toEqual(ads);
    expect(ids('2027-01-12')).toEqual(ads); // 70 días después del 03/11: semana A
  });

  test('ediciones "Solo hoy": margen como excepciones modificadas, eliminación como cancelada, agregado como evento de un día', () => {
    expect(r.report.exceptions).toEqual({ cancelled: 1, modified: 3 });
    expect(r.report.oneOff).toBe(1);
    const medico = seriesById(a, EXPECTED.addedToday.id);
    expect([medico.rule, medico.startDate]).toEqual([null, EXPECTED.addedToday.date]);
    expect(a.exceptions).toContainEqual({ seriesId: EXPECTED.deletedToday.id, date: EXPECTED.deletedToday.date, kind: 'cancelled' });
    const cold = a.exceptions.find((x) => x.seriesId === EXPECTED.margin.to && x.date === EXPECTED.margin.date);
    expect(cold).toEqual({ seriesId: EXPECTED.margin.to, date: EXPECTED.margin.date, kind: 'modified', fields: { startMin: 690 } });
  });

  test('categorías iniciales, metas y ajustes sin ancla', () => {
    expect(a.categories.map((c) => c.id).sort()).toEqual(['close', 'content', 'english', 'fixed', 'health', 'project', 'rest', 'work']);
    expect(a.goals.map((g) => g.id)).toEqual(['post', 'com', 'rea', 'cold', 'fol', 'apl', 'proyecto', 'ejercicio']);
    expect(a.goals.find((g) => g.id === 'com')!.versions[0]).toMatchObject({ target: 5, period: 'day', activeDays: [1, 2, 3, 5] });
    expect(a.goals.find((g) => g.id === 'proyecto')!.links.length).toBeGreaterThan(0);
    expect(r.settings).not.toHaveProperty('anchor');
    expect(r.settings.muted).toEqual({ 'mwf:420': true });
  });

  test('las escrituras empiezan por la copia completa y terminan con la versión', () => {
    const keys = r.writes.map(([k]) => k);
    const n = buildV1Store().length;
    expect(keys.slice(0, n).every((k) => k.startsWith('backup:v1:'))).toBe(true);
    expect(r.writes[n]).toEqual([BACKUP_COMPLETE_KEY, String(n)]);
    expect(r.writes.at(-1)).toEqual([KEYS.schemaVersion, '2']);
  });

  test('es determinista', () => {
    expect(migrated().writes).toEqual(r.writes);
  });
});

describe('casos especiales', () => {
  test('instalación sin datos: migra la agenda original y se verifica', () => {
    const r = migrated([]);
    expect(buildDay(r.agenda, '2026-11-17').map((b) => b.id).sort()).toEqual(defaultBlocks('tueAds').map((b) => b.id).sort());
    expect(r.report.sourceUsed).toBe('store');
  });

  test('una marca de hecho de una serie separada se reescribe al id nuevo de ese día', () => {
    const entries = buildV1Store().map(([k, v]): Entry =>
      k === 'agenda:day:2026-11-12' ? [k, JSON.stringify({ done: { 'u-yoga': true }, counts: { cold: 10 } })] : [k, v]);
    const r = migrated(entries);
    expect(r.report.renamedDone).toEqual(['2026-11-12']);
    const w = r.writes.find(([k]) => k === 'agenda:day:2026-11-12')!;
    expect(JSON.parse(w[1])).toEqual({ done: { 'u-yoga~thu': true }, counts: { cold: 10 } });
  });

  test('un silenciado de una serie separada se aplica a todas sus partes', () => {
    const entries = buildV1Store().map(([k, v]): Entry =>
      k === 'agenda:settings' ? [k, JSON.stringify({ ...JSON.parse(v), muted: { 'u-yoga': true } })] : [k, v]);
    expect(migrated(entries).settings.muted).toEqual({ 'u-yoga': true, 'u-yoga~thu': true });
  });

  test('claves desconocidas: no se tocan, se informan y quedan en la copia', () => {
    const r = migrated([...buildV1Store(), ['otra:clave', 'x']]);
    expect(r.report.unknownKeys).toEqual(['otra:clave']);
    expect(r.writes.some(([k]) => k === 'otra:clave')).toBe(false);
    expect(r.writes).toContainEqual(['backup:v1:otra:clave', 'x']);
  });

  test('una edición de sábado (que la v1 nunca mostró) se informa y no se migra', () => {
    const r = migrated([...buildV1Store(), ['agenda:ovr:2026-11-14', JSON.stringify(defaultBlocks('mwf'))]]);
    expect(r.report.ignoredWeekendOverrides).toEqual(['2026-11-14']);
    expect(buildDay(r.agenda, '2026-11-14')).toEqual([]);
  });

  test('una categoría desconocida en la agenda se conserva como categoría nueva', () => {
    const v1 = readV1(buildV1Store());
    const sched = { ...v1.sched, fri: [...v1.sched.fri!, { id: 'u-x', s: 1200, e: 1230, t: 'X', c: 'rara', n: '' }] };
    const entries = buildV1Store().map(([k, v]): Entry => (k === 'agenda:sched' ? [k, JSON.stringify(sched)] : [k, v]));
    const r = migrated(entries);
    expect(r.report.extraCategories).toEqual(['rara']);
    expect(r.agenda.categories.find((c) => c.id === 'rara')?.name).toBe('rara');
  });

  test('una tarea agregada "Solo hoy" con un id que ya usa otra serie recibe un id propio', () => {
    // u-lectura existe como serie de lun, mié y vie; se agrega "Solo hoy" el jueves 12.
    const v1 = readV1(buildV1Store());
    const thu = [...v1.overrides['2026-11-12'], { id: 'u-lectura', s: 1230, e: 1260, t: 'Lectura', c: 'project', n: '' }];
    const entries = buildV1Store().map(([k, v]): Entry => (k === 'agenda:ovr:2026-11-12' ? [k, JSON.stringify(thu)] : [k, v]));
    const r = migrated(entries);
    expect(r.agenda.legacyBid['u-lectura@2026-11-12']).toBe('u-lectura');
    expect(buildDay(r.agenda, '2026-11-12').some((b) => b.id === 'u-lectura@2026-11-12')).toBe(true);
  });
});

describe('migrateRepository y reintentos (CA-18)', () => {
  test('migra una vez y la segunda no hace nada', () => {
    const kv = memoryKV(buildV1Store());
    const repo = createRepository(kv);
    expect(migrateRepository(repo, TODAY).status).toBe('migrated');
    expect(repo.schemaVersion()).toBe(2);
    expect(repo.getDay('2026-11-17').length).toBeGreaterThan(0);
    const before = kv.dump();
    expect(migrateRepository(repo, TODAY)).toEqual({ status: 'already-migrated' });
    expect(kv.dump()).toEqual(before);
  });

  test('las claves v1 y el registro siguen intactos después de migrar', () => {
    const kv = memoryKV(buildV1Store());
    migrateRepository(createRepository(kv), TODAY);
    const after = new Map(kv.dump());
    for (const [k, v] of buildV1Store()) expect(after.get(k) === v || k.startsWith('agenda:day:')).toBe(true);
  });

  test('un corte después de la copia: la versión queda en 1 y el reintento parte de la copia y da lo mismo', () => {
    let fail = true;
    const kv = memoryKV(buildV1Store(), { failOn: (k) => fail && k === KEYS.series });
    const repo = createRepository(kv);
    expect(() => migrateRepository(repo, TODAY)).toThrow(/fallo simulado/);
    expect(repo.schemaVersion()).toBe(1);

    // Simula además que antes del corte se había reescrito un día: el reintento debe ignorarlo y usar la copia.
    kv.setItem('agenda:day:2026-11-09', '{"done":{},"counts":{}}');
    fail = false;
    const out = migrateRepository(repo, TODAY);
    expect(out.status).toBe('migrated');
    if (out.status === 'migrated') expect(out.report.sourceUsed).toBe('backup');

    const clean = memoryKV(buildV1Store());
    migrateRepository(createRepository(clean), TODAY);
    const pick = (d: [string, string][]) => d.filter(([k]) => k.startsWith('agenda2:') || k === KEYS.schemaVersion);
    expect(pick(kv.dump())).toEqual(pick(clean.dump()));
  });

  test('un corte durante la copia: sin marca de copia completa, el reintento parte del almacén', () => {
    let fail = true;
    const target = `${KEYS.backupPrefix}agenda:settings`;
    const kv = memoryKV(buildV1Store(), { failOn: (k) => fail && k === target });
    const repo = createRepository(kv);
    expect(() => migrateRepository(repo, TODAY)).toThrow();
    expect(sourceEntries(kv.dump()).from).toBe('store');
    fail = false;
    const out = migrateRepository(repo, TODAY);
    expect(out.status).toBe('migrated');
    if (out.status === 'migrated') expect(out.report.sourceUsed).toBe('store');
  });

  test('si la verificación rechaza, no se escribe nada', () => {
    const kv = memoryKV(buildV1Store());
    const before = kv.dump();
    const out = migrateRepository(createRepository(kv), TODAY, () => ({ ok: false, error: 'no coincide', mismatches: [] }));
    expect(out).toEqual({ status: 'refused', error: 'no coincide', mismatches: [] });
    expect(kv.dump()).toEqual(before);
  });

  test('un día editado que repite un id con datos distintos se migra igual (el segundo pasa a evento de un día)', () => {
    const dup = [...defaultBlocks('mwf'), { ...defaultBlocks('mwf')[0], s: 1300, e: 1310 }];
    const r = migrateV1([...buildV1Store(), ['agenda:ovr:2026-11-16', JSON.stringify(dup)]], TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(buildDay(r.agenda, '2026-11-16')).toHaveLength(dup.length);
  });
});
