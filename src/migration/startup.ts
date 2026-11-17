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
import { MigrationOutcome, MigrationReport, Mismatch, migrateRepository, migrateV1 } from './v1-to-v2';

export type MigrationMode = 'off' | 'dry-run' | 'apply';

/** Modo activo. Pasa a `apply` en la entrega E2 (fases 1 y 2 juntas). */
export const MIGRATION_MODE: MigrationMode = 'dry-run';

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function reportDetails(r: MigrationReport): string[] {
  const d = [
    `${plural(r.series, 'evento', 'eventos')} en el formato nuevo.`,
    `${plural(r.verifiedDays, 'día revisado', 'días revisados')}, sin diferencias.`,
  ];
  const { cancelled, modified } = r.exceptions;
  if (cancelled + modified + r.oneOff > 0) {
    d.push(`Cambios de un solo día: ${modified} modificados, ${cancelled} quitados y ${plural(r.oneOff, 'tarea agregada', 'tareas agregadas')}.`);
  }
  if (r.split.length) d.push(`Tareas con horarios distintos según el día, separadas en varios eventos: ${r.split.join(', ')}.`);
  if (r.renamedDone.length) d.push(`Días con marcas de hecho actualizadas: ${r.renamedDone.join(', ')}.`);
  if (r.ignoredWeekendOverrides.length) d.push(`Ediciones de fin de semana que nunca se mostraron (quedan en la copia): ${r.ignoredWeekendOverrides.join(', ')}.`);
  if (r.extraCategories.length) d.push(`Categorías desconocidas conservadas como nuevas: ${r.extraCategories.join(', ')}.`);
  if (r.unknownKeys.length) d.push(`Datos que la app no reconoce (no se tocan): ${r.unknownKeys.join(', ')}.`);
  if (r.sourceUsed === 'backup') d.push('Se retomó desde la copia guardada en un intento anterior.');
  return d;
}

/** Texto para la tarjeta de Ajustes. */
export function describeMigration(s: StartupMigration): MigrationView {
  const title = s.mode === 'dry-run' ? 'Formato nuevo de la agenda (prueba)' : 'Formato nuevo de la agenda';
  if (s.mode === 'off') return { title, message: '', details: [], ok: null };
  switch (s.status) {
    case 'already-migrated':
      return { title, message: 'Tu agenda ya está en el formato nuevo.', details: [], ok: true };
    case 'ok':
      return {
        title,
        message: 'Prueba correcta: tu agenda se puede pasar al formato nuevo sin diferencias. Todavía no se cambió nada.',
        details: reportDetails(s.report),
        ok: true,
      };
    case 'migrated':
      return { title, message: 'Tu agenda se pasó al formato nuevo. Tus datos anteriores quedaron guardados en una copia dentro de la app.', details: reportDetails(s.report), ok: true };
    case 'refused':
      return {
        title,
        message: `${s.mode === 'dry-run' ? 'La prueba' : 'La migración'} encontró diferencias en ${plural(s.mismatches.length, 'día', 'días')}. No se cambió nada: tu agenda sigue igual. Comparte el informe para revisarlo.`,
        details: s.mismatches.slice(0, 5).map((m) => `${m.date}: antes ${m.v1.length}, después ${m.v2.length} eventos.`),
        ok: false,
      };
    case 'crashed':
      return {
        title,
        message: `${s.mode === 'dry-run' ? 'La prueba' : 'La migración'} no pudo completarse. No se cambió nada${s.mode === 'apply' ? ' y se vuelve a intentar la próxima vez que abras la app' : ''}. Comparte el informe para revisarlo.`,
        details: [s.error],
        ok: false,
      };
  }
}

/**
 * Informe para compartir. Lleva fechas, cantidades e ids internos, pero no títulos ni notas de las tareas: de cada
 * diferencia solo se conservan inicio, fin e id.
 */
export function migrationReportText(s: StartupMigration, today: string): string {
  const v = describeMigration(s);
  const lines = [`Informe de migración (${today})`, `Modo: ${s.mode}`, `Estado: ${'status' in s ? s.status : '-'}`, v.message, ...v.details];
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
      lines.push(`— ${m.date}`, `  antes: ${short(m.v1).join(', ')}`, `  después: ${short(m.v2).join(', ')}`);
    }
  }
  return lines.join('\n');
}
