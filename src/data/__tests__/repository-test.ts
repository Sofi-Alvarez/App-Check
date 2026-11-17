import type { AgendaState } from '../../domain/types';
import { memoryKV } from '../kv';
import { DEFAULT_SETTINGS_V2, KEYS, RepositoryError, createRepository } from '../repository';

const state = (): AgendaState => ({
  categories: [{ id: 'work', name: 'Trabajo', color: 'blue', movable: true, tracked: true, marginPreference: 'normal', archived: false }],
  series: [{
    id: 's1', title: 'Correo', categoryId: 'work', startMin: 540, endMin: 600, note: '',
    rule: { weekdays: [1, 2, 3, 4, 5], everyWeeks: 1 }, startDate: '2026-11-02', endDate: null, reminder: null, archived: false,
  }],
  exceptions: [{ seriesId: 's1', date: '2026-11-18', kind: 'cancelled' }],
  goals: [],
  legacyBid: {},
});

describe('createRepository', () => {
  test('sin datos v2: versión 1, agenda nula y día vacío', () => {
    const repo = createRepository(memoryKV());
    expect(repo.schemaVersion()).toBe(1);
    expect(repo.loadAgenda()).toBeNull();
    expect(repo.getDay('2026-11-17')).toEqual([]);
  });

  test('guardar y leer el modelo v2, y armar días desde él', () => {
    const kv = memoryKV();
    const repo = createRepository(kv);
    repo.saveAgenda(state());
    expect(createRepository(kv).loadAgenda()).toEqual(state());
    expect(repo.getDay('2026-11-17').map((b) => b.id)).toEqual(['s1']);
    expect(repo.getDay('2026-11-18')).toEqual([]); // cancelado ese día
    expect(repo.getDay('2026-11-21')).toEqual([]); // sábado
  });

  test('guardar invalida la caché', () => {
    const repo = createRepository(memoryKV());
    repo.saveAgenda(state());
    expect(repo.getDay('2026-11-17')).toHaveLength(1);
    repo.saveAgenda({ ...state(), exceptions: [{ seriesId: 's1', date: '2026-11-17', kind: 'cancelled' }] });
    expect(repo.getDay('2026-11-17')).toEqual([]);
  });

  test('versión del esquema', () => {
    const repo = createRepository(memoryKV());
    repo.setSchemaVersion(2);
    expect(repo.schemaVersion()).toBe(2);
    expect(createRepository(memoryKV([[KEYS.schemaVersion, 'basura']])).schemaVersion()).toBe(1);
  });

  test('ajustes v2 con valores por defecto', () => {
    const repo = createRepository(memoryKV());
    expect(repo.loadSettings()).toEqual(DEFAULT_SETTINGS_V2);
    repo.saveSettings({ ...DEFAULT_SETTINGS_V2, endLead: 10, muted: { s1: true } });
    expect(repo.loadSettings()).toEqual({ ...DEFAULT_SETTINGS_V2, endLead: 10, muted: { s1: true } });
  });

  test('datos de un día y registro usan las mismas claves que la v1', () => {
    const kv = memoryKV([
      ['agenda:day:2026-11-17', '{"done":{"s1":true}}'],
      ['agenda:log:2026-11-17', JSON.stringify([{ ts: 2 }, { ts: 1 }])],
      ['agenda:log:2026-11-16', JSON.stringify([{ ts: 0 }])],
    ]);
    const repo = createRepository(kv);
    expect(repo.loadDayData('2026-11-17')).toEqual({ done: { s1: true }, counts: {} });
    expect(repo.loadDayData('2026-11-18')).toEqual({ done: {}, counts: {} });
    expect(repo.loadAllLog().map((e) => e.ts)).toEqual([0, 1, 2]);
  });

  test('una clave v2 dañada lanza un error explícito en vez de devolver datos vacíos', () => {
    const repo = createRepository(memoryKV([[KEYS.series, '{roto']]));
    expect(() => repo.loadAgenda()).toThrow(RepositoryError);
    const repo2 = createRepository(memoryKV([[KEYS.series, '[]'], [KEYS.exceptions, '{"no":"lista"}']]));
    expect(() => repo2.loadAgenda()).toThrow(/no es una lista/);
  });

  test('snapshot, writeAll en orden y remove', () => {
    const kv = memoryKV([['a', '1']]);
    const repo = createRepository(kv);
    repo.writeAll([['b', '2'], ['c', '3']]);
    repo.remove(['a']);
    expect(kv.dump()).toEqual([['b', '2'], ['c', '3']]);
    expect(repo.snapshot().sort()).toEqual([['b', '2'], ['c', '3']]);
  });

  test('writeAll se detiene en la primera escritura que falla', () => {
    const kv = memoryKV([], { failOn: (k) => k === 'c' });
    const repo = createRepository(kv);
    expect(() => repo.writeAll([['b', '2'], ['c', '3'], ['d', '4']])).toThrow(/fallo simulado/);
    expect(kv.dump()).toEqual([['b', '2']]);
  });
});
