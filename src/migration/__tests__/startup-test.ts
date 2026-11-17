import { buildV1Store } from '../../__fixtures__/v1-store';
import { memoryKV } from '../../data/kv';
import { KEYS, createRepository } from '../../data/repository';
import type { Repository } from '../../data/repository';
import { MIGRATION_MODE, describeMigration, migrationReportText, runStartupMigration } from '../startup';

const TODAY = '2026-11-17';

describe('runStartupMigration', () => {
  test('el modo activo es "prueba" hasta la entrega E2', () => {
    expect(MIGRATION_MODE).toBe('dry-run');
  });

  test('en modo prueba no escribe absolutamente nada y informa el resultado', () => {
    const kv = memoryKV(buildV1Store());
    const before = kv.dump();
    const s = runStartupMigration(createRepository(kv), TODAY, 'dry-run');
    expect(s).toMatchObject({ mode: 'dry-run', status: 'ok' });
    expect(kv.dump()).toEqual(before);
  });

  test('en modo prueba se puede repetir en cada apertura con el mismo resultado', () => {
    const repo = createRepository(memoryKV(buildV1Store()));
    expect(runStartupMigration(repo, TODAY, 'dry-run')).toEqual(runStartupMigration(repo, TODAY, 'dry-run'));
  });

  test('en modo aplicar migra y la segunda apertura no hace nada', () => {
    const kv = memoryKV(buildV1Store());
    const repo = createRepository(kv);
    expect(runStartupMigration(repo, TODAY, 'apply')).toMatchObject({ mode: 'apply', status: 'migrated' });
    expect(repo.schemaVersion()).toBe(2);
    expect(runStartupMigration(repo, TODAY, 'apply')).toEqual({ mode: 'apply', status: 'already-migrated' });
  });

  test('si ya está migrado, el modo prueba no recalcula nada', () => {
    const repo = createRepository(memoryKV([[KEYS.schemaVersion, '2']]));
    expect(runStartupMigration(repo, TODAY, 'dry-run')).toEqual({ mode: 'dry-run', status: 'already-migrated' });
  });

  test('un error inesperado no rompe la app: se devuelve como "crashed" y no se escribe nada', () => {
    const kv = memoryKV(buildV1Store());
    const before = kv.dump();
    const repo: Repository = { ...createRepository(kv), snapshot: () => { throw new Error('lectura fallida'); } };
    expect(runStartupMigration(repo, TODAY, 'dry-run')).toEqual({ mode: 'dry-run', status: 'crashed', error: 'lectura fallida' });
    expect(runStartupMigration(repo, TODAY, 'apply')).toEqual({ mode: 'apply', status: 'crashed', error: 'lectura fallida' });
    expect(kv.dump()).toEqual(before);
  });

  test('si una escritura falla en modo aplicar, queda en versión 1 para reintentar', () => {
    let fail = true;
    const kv = memoryKV(buildV1Store(), { failOn: (k) => fail && k === KEYS.goals });
    const repo = createRepository(kv);
    expect(runStartupMigration(repo, TODAY, 'apply')).toMatchObject({ status: 'crashed' });
    expect(repo.schemaVersion()).toBe(1);
    fail = false;
    expect(runStartupMigration(repo, TODAY, 'apply')).toMatchObject({ status: 'migrated' });
  });

  test('modo apagado', () => {
    expect(runStartupMigration(createRepository(memoryKV()), TODAY, 'off')).toEqual({ mode: 'off' });
  });
});

describe('describeMigration y el informe', () => {
  const ok = runStartupMigration(createRepository(memoryKV(buildV1Store())), TODAY, 'dry-run');

  test('prueba correcta: mensaje claro de que no se cambió nada y detalles', () => {
    const v = describeMigration(ok);
    expect(v.ok).toBe(true);
    expect(v.title).toMatch(/prueba/);
    expect(v.message).toMatch(/Todavía no se cambió nada/);
    expect(v.details.join(' ')).toMatch(/días revisados, sin diferencias/);
    expect(v.details.join(' ')).toMatch(/u-yoga/);
  });

  test('rechazo: dice cuántos días y que la agenda sigue igual', () => {
    const v = describeMigration({
      mode: 'dry-run', status: 'refused', error: 'x',
      mismatches: [{ date: '2026-11-10', v1: ['[600,690,"a","Título privado","work","Nota privada"]'], v2: [] }],
    });
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/diferencias en 1 día\. No se cambió nada/);
  });

  test('el informe no incluye títulos ni notas de las tareas', () => {
    const text = migrationReportText({
      mode: 'dry-run', status: 'refused', error: 'x',
      mismatches: [{ date: '2026-11-10', v1: ['[600,690,"a","Título privado","work","Nota privada"]'], v2: [] }],
    }, TODAY);
    expect(text).toMatch(/a 600-690/);
    expect(text).not.toMatch(/privad/);
  });

  test('error inesperado: en modo aplicar avisa que se reintenta', () => {
    expect(describeMigration({ mode: 'apply', status: 'crashed', error: 'e' }).message).toMatch(/se vuelve a intentar/);
    expect(describeMigration({ mode: 'dry-run', status: 'crashed', error: 'e' }).message).not.toMatch(/se vuelve a intentar/);
  });

  test('ya migrado y apagado', () => {
    expect(describeMigration({ mode: 'apply', status: 'already-migrated' }).message).toMatch(/ya está en el formato nuevo/);
    expect(describeMigration({ mode: 'off' }).ok).toBeNull();
  });
});
