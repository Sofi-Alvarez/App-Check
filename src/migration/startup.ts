// Migración al abrir la app (T1.7).
//
// Modos:
// - `dry-run` (prueba): corre la migración sobre los datos reales, en memoria, y NO escribe nada. Sirve para validar la
//   autoverificación con los datos del teléfono antes de cambiar nada.
// - `apply`: migra de verdad (copia, modelo v2 y versión). Se activa recién con la fase 2, cuando las pantallas lean el
//   modelo nuevo; antes de eso, las ediciones hechas con las pantallas viejas no llegarían al modelo nuevo.
// - `off`: no hace nada.
//
// Nunca lanza: cualquier error se devuelve como `crashed` para mostrarlo, y en `apply` la versión queda en 1 para que el
// siguiente intento vuelva a empezar.

import type { Repository } from '../data/repository';
import { S } from '../i18n';
import { MigrationOutcome, MigrationReport, Mismatch, migrateRepository, migrateV1 } from './v1-to-v2';

export type MigrationMode = 'off' | 'dry-run' | 'apply';

/**
 * Modo activo. `apply` desde la entrega E2b (17/11/2026), después de validar la migración con los datos reales en modo
 * prueba y con una copia de seguridad completa guardada en Drive.
 */
export const MIGRATION_MODE: MigrationMode = 'apply';

export type StartupMigration =
  | { mode: 'off' }
  | { mode: 'dry-run' | 'apply'; status: 'already-migrated' }
  | { mode: 'dry-run'; status: 'ok'; report: MigrationReport }
  | { mode: 'apply'; status: 'migrated'; report: MigrationReport }
  | { mode: 'dry-run' | 'apply'; status: 'refused'; error: string; mismatches: Mismatch[] }
  | { mode: 'dry-run' | 'apply'; status: 'crashed'; error: string };

export function runStartupMigration(repo: Repository, today: string, mode: MigrationMode = MIGRATION_MODE): StartupMigration {
  if (mode === 'off') return { mode };
  try {
    if (repo.schemaVersion() >= 2) return { mode, status: 'already-migrated' };
    if (mode === 'dry-run') {
      const r = migrateV1(repo.snapshot(), today);
      return r.ok
        ? { mode, status: 'ok', report: r.report }
        : { mode, status: 'refused', error: r.error, mismatches: r.mismatches };
    }
    const out: MigrationOutcome = migrateRepository(repo, today);
    if (out.status === 'already-migrated') return { mode, status: 'already-migrated' };
    if (out.status === 'migrated') return { mode, status: 'migrated', report: out.report };
    return { mode, status: 'refused', error: out.error, mismatches: out.mismatches };
  } catch (e) {
    return { mode, status: 'crashed', error: e instanceof Error ? e.message : String(e) };
  }
}

export interface MigrationView {
  /** Título corto de la tarjeta. */
  title: string;
  /** Mensaje principal para la persona. */
  message: string;
  /** Detalles en líneas cortas. */
  details: string[];
  /** `true` = todo bien; `false` = algo para revisar; `null` = nada que mostrar. */
  ok: boolean | null;
}

const M = S.migration;

function reportDetails(r: MigrationReport): string[] {
  const d = [M.series(r.series), M.verified(r.verifiedDays)];
  const { cancelled, modified } = r.exceptions;
  if (cancelled + modified + r.oneOff > 0) d.push(M.dayChanges(modified, cancelled, r.oneOff));
  if (r.split.length) d.push(M.split(r.split.join(', ')));
  if (r.renamedDone.length) d.push(M.renamedDone(r.renamedDone.join(', ')));
  if (r.ignoredWeekendOverrides.length) d.push(M.weekend(r.ignoredWeekendOverrides.join(', ')));
  if (r.extraCategories.length) d.push(M.extraCategories(r.extraCategories.join(', ')));
  if (r.unknownKeys.length) d.push(M.unknownKeys(r.unknownKeys.join(', ')));
  if (r.sourceUsed === 'backup') d.push(M.fromBackup);
  return d;
}

/** Texto para la tarjeta de Ajustes. */
export function describeMigration(s: StartupMigration): MigrationView {
  const title = s.mode === 'dry-run' ? M.titleTest : M.title;
  if (s.mode === 'off') return { title, message: '', details: [], ok: null };
  const test = s.mode === 'dry-run';
  switch (s.status) {
    case 'already-migrated':
      return { title, message: M.already, details: [], ok: true };
    case 'ok':
      return { title, message: M.okTest, details: reportDetails(s.report), ok: true };
    case 'migrated':
      return { title, message: M.migrated, details: reportDetails(s.report), ok: true };
    case 'refused':
      return {
        title, message: M.refused(test, s.mismatches.length),
        details: s.mismatches.slice(0, 5).map((m) => M.mismatchLine(m.date, m.v1.length, m.v2.length)), ok: false,
      };
    case 'crashed':
      return { title, message: M.crashed(test), details: [s.error], ok: false };
  }
}

/**
 * Informe para compartir. Lleva fechas, cantidades e ids internos, pero no títulos ni notas de las tareas: de cada
 * diferencia solo se conservan inicio, fin e id.
 */
export function migrationReportText(s: StartupMigration, today: string): string {
  const v = describeMigration(s);
  const lines = [M.reportTitle(today), M.reportMode(s.mode), M.reportStatus('status' in s ? s.status : '-'), v.message, ...v.details];
  if ('status' in s && s.status === 'refused') {
    const short = (rows: string[]) => rows.map((r) => {
      try {
        const [st, en, id] = JSON.parse(r) as [number, number, string];
        return `${id} ${st}-${en}`;
      } catch {
        return '?';
      }
    });
    for (const m of s.mismatches.slice(0, 10)) {
      lines.push(`— ${m.date}`, M.reportBefore(short(m.v1).join(', ')), M.reportAfter(short(m.v2).join(', ')));
    }
  }
  return lines.join('\n');
}
