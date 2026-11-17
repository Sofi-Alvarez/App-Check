// Idioma activo de la interfaz (T6.4). Hoy solo hay español; para sumar otro, se crea `xx.ts` con el tipo `Strings`
// y se elige acá (por ejemplo, según el idioma del teléfono).

import { es } from './es';
import type { Strings } from './es';

export const S: Strings = es;
export type { Strings };
