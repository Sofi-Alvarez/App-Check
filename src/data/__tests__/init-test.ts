import { buildV2Store } from '../../__fixtures__/v2-store';
import { buildDay } from '../../domain/recurrence';
import { JOB_SEARCH_TEMPLATE } from '../../domain/templates';
import { initializeIfEmpty, resetToTemplate } from '../init';
import { memoryKV } from '../kv';
import { KEYS, RepositoryError, createRepository } from '../repository';

describe('arranque: initializeIfEmpty', () => {
  test('instalación nueva: arma la rutina de la plantilla con sus ids, desde la semana de hoy', () => {
    const repo = createRepository(memoryKV([]));
    expect(initializeIfEmpty(repo, '2026-11-18')).toBe('initialized');
    const st = repo.loadAgenda()!;
    expect(st.series.map((s) => s.id).sort()).toEqual(JOB_SEARCH_TEMPLATE.series.map((s) => s.id).sort());
    expect(st.exceptions).toEqual([]);
    expect(repo.schemaVersion()).toBe(2);
    expect(repo.getValue(KEYS.legacyTueAnchor)).toBe('2026-11-17');
    const titles = (d: string) => buildDay(st, d).map((b) => b.t);
    // El martes de esta semana tiene adscripción; el siguiente no; el otro sí.
    expect(titles('2026-11-17')).toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-24')).not.toContain('Adscripción de políticas educativas');
    expect(titles('2026-12-01')).toContain('Adscripción de políticas educativas');
    expect(titles('2026-11-21')).toEqual([]);
  });

  test('con datos guardados no toca nada', () => {
    const repo = createRepository(memoryKV(buildV2Store()));
    const before = JSON.stringify(repo.snapshot());
    expect(initializeIfEmpty(repo, '2026-11-18')).toBe('existing');
    expect(JSON.stringify(repo.snapshot())).toBe(before);
  });

  test('datos dañados: avisa con un error de la capa de acceso y no escribe nada', () => {
    const entries = buildV2Store().map(([k, v]): [string, string] => [k, k === KEYS.series ? '{roto' : v]);
    const repo = createRepository(memoryKV(entries));
    const before = JSON.stringify(repo.snapshot());
    expect(() => initializeIfEmpty(repo, '2026-11-18')).toThrow(RepositoryError);
    expect(JSON.stringify(repo.snapshot())).toBe(before);
  });

  test('"Empezar con la plantilla inicial" reemplaza la agenda dañada y conserva el registro de uso', () => {
    const entries = buildV2Store().map(([k, v]): [string, string] => [k, k === KEYS.series ? '{roto' : v]);
    const repo = createRepository(memoryKV(entries));
    const logs = repo.loadAllLog().length;
    resetToTemplate(repo, '2026-11-18');
    expect(repo.loadAgenda()!.series).toHaveLength(JOB_SEARCH_TEMPLATE.series.length);
    expect(repo.loadAllLog()).toHaveLength(logs);
    expect(logs).toBeGreaterThan(0);
  });
});
