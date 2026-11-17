// Plantillas incluidas en la app. El contenido vive en archivos JSON (datos), no en código.

import type { Template } from '../types';
import busqueda from './busqueda-de-empleo.json';

/** "Búsqueda de empleo, 5 días": la rutina con la que nació la app. */
export const JOB_SEARCH_TEMPLATE = busqueda as unknown as Template;

/** Plantilla vacía: sin categorías ni eventos, para empezar desde cero. */
export const EMPTY_TEMPLATE: Template = {
  id: 'vacia', name: 'Empezar desde cero', description: 'Sin eventos ni metas.', language: 'es',
  categories: [], series: [], goals: [],
};

export const TEMPLATES: readonly Template[] = [JOB_SEARCH_TEMPLATE, EMPTY_TEMPLATE];

export { applyTemplate } from './apply';
