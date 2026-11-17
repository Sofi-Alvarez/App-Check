// Inicialización del almacén (reemplaza a la migración desde la versión vieja, que ya se borró).
//
// - Si no hay datos del modelo nuevo (instalación nueva), se arma la agenda con la rutina de la plantilla inicial,
//   desde la semana de hoy, y se marca la versión 2.
// - Si hay datos, no se toca nada.

import { instantiateTemplate, tuesdayOf, weekStarts } from '../domain/templates/apply';
import { JOB_SEARCH_TEMPLATE } from '../domain/templates';
import type { Repository } from './repository';
import { KEYS } from './repository';

export function initializeIfEmpty(repo: Repository, today: string): 'initialized' | 'existing' {
  if (repo.loadAgenda()) return 'existing';
  resetToTemplate(repo, today);
  return 'initialized';
}

/** Deja la agenda como la plantilla inicial desde la semana de hoy. No toca el registro de uso ni los ajustes. */
export function resetToTemplate(repo: Repository, today: string): void {
  const anchor = tuesdayOf(today);
  repo.saveAgenda(instantiateTemplate(JOB_SEARCH_TEMPLATE, weekStarts(today, anchor), today));
  repo.writeAll([[KEYS.legacyTueAnchor, anchor], [KEYS.schemaVersion, '2']]);
}
