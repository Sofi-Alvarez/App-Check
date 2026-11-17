// Arma la plantilla "Búsqueda de empleo" desde la agenda escrita en `agenda.ts`. Se usó una vez para generar
// `busqueda-de-empleo.json` y queda solo para la prueba que comprueba que el JSON no se desvió mientras `agenda.ts`
// exista. En T6.2 se borran este archivo, esa prueba y el contenido de `agenda.ts`: el JSON pasa a ser la única fuente.

import { Block, DayType, LIST_KEYS, defaultBlocks } from '../../agenda';
import { legacyGoals, seriesFromLists } from '../../migration/v1-to-v2';
import { SEED_CATEGORIES } from '../categories';
import { mondayNumber } from '../dates';
import type { Template } from '../types';

/** Semana de referencia: semana 0 = semana del martes con adscripción. */
const REF = { weekly: '2000-01-03', a: '2000-01-03', b: '2000-01-10' };

export function buildLegacyTemplate(): Template {
  const lists = Object.fromEntries(LIST_KEYS.map((k) => [k, defaultBlocks(k)])) as Record<DayType, Block[]>;
  const { series } = seriesFromLists(lists, REF);
  const goals = legacyGoals(REF.weekly, series).map((g) => ({
    ...g,
    versions: g.versions.map((v) => ({ ...v, effectiveFrom: '' })),
  }));
  return {
    id: 'busqueda-de-empleo',
    name: 'Búsqueda de empleo, 5 días',
    description:
      'Rutina de lunes a viernes para una búsqueda activa: postulaciones, contactos, contenido en LinkedIn, proyecto propio e inglés. Incluye martes alternos con una actividad fija y cuotas diarias de contactos y comentarios.',
    language: 'es',
    categories: SEED_CATEGORIES.map((c) => ({ ...c })),
    series: series.map(({ startDate, endDate: _endDate, ...s }) => ({
      ...s,
      weekOffset: (mondayNumber(startDate) - mondayNumber(REF.weekly)) / 7,
    })),
    goals,
  };
}
