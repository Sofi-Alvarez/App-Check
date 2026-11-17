// Almacén sintético en formato v2 para las pruebas: es la fixture de la versión vieja ya migrada (se generó con la
// migración antes de borrarla). Conserva sus casos: una tarea en varios días ("u-lectura"), una separada en dos por
// tener horarios distintos ("u-yoga" y "u-yoga~thu", con `legacyBid`), un margen aplicado el 11/11, un evento de un
// día ("u-medico"), un día con un evento quitado (12/11), sesiones con pausa, cerradas solas y abiertas, y conteos.

import data from './v2-store.json';

export type Entry = [key: string, value: string];
export const buildV2Store = (): Entry[] => (data as Entry[]).map(([k, v]) => [k, v]);
