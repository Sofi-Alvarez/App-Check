// Copia de seguridad completa del almacén local. Funciones puras: no importan nada de React Native ni de Expo,
// para poder probarlas sin teléfono.
//
// Formato: uno o más textos JSON ("partes"). Cada parte es autosuficiente y lleva un subconjunto de las claves.
// Se parte porque Android limita el tamaño de lo que se puede compartir de una vez.

export const BACKUP_FORMAT = 'agenda-backup';
export const BACKUP_VERSION = 1;
/** Tamaño máximo aproximado (caracteres) de una parte. Muy por debajo del límite de compartir texto en Android. */
export const MAX_PART_CHARS = 300_000;

export type Entry = [key: string, value: string];

export interface BackupPart {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  part: number;
  parts: number;
  totalEntries: number;
  entries: Entry[];
}

/** Largo en caracteres que ocupa una entrada ya serializada, con un margen para comas y corchetes. */
const entrySize = (e: Entry) => JSON.stringify(e).length + 1;

/**
 * Arma las partes de la copia. Orden estable por clave. Empaqueta de forma golosa sin superar `maxChars`
 * por parte; una entrada que sola ya supera el máximo queda en una parte propia (no se corta ni se pierde).
 * Siempre devuelve al menos una parte, aunque el almacén esté vacío.
 */
export function buildBackupParts(entries: Entry[], createdAt: Date, maxChars: number = MAX_PART_CHARS): string[] {
  const sorted = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const groups: Entry[][] = [];
  let current: Entry[] = [];
  let size = 0;
  for (const e of sorted) {
    const n = entrySize(e);
    if (current.length > 0 && size + n > maxChars) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(e);
    size += n;
  }
  groups.push(current); // la última, o la única (vacía si no hay datos)

  return groups.map((g, i) =>
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: createdAt.toISOString(),
      part: i + 1,
      parts: groups.length,
      totalEntries: sorted.length,
      entries: g,
    } satisfies BackupPart),
  );
}

export type ParseResult =
  | { ok: true; entries: Entry[]; createdAt: string }
  | { ok: false; error: string };

/**
 * Valida un conjunto de partes y devuelve todas las entradas. Detecta partes que faltan, repetidas, de otra copia
 * o mal formadas, y claves duplicadas. No escribe nada: sirve para verificar una copia y, más adelante, para restaurar.
 */
export function parseBackupParts(texts: string[]): ParseResult {
  if (texts.length === 0) return { ok: false, error: 'No hay partes que leer.' };
  const parts: BackupPart[] = [];
  for (const t of texts) {
    let p: unknown;
    try {
      p = JSON.parse(t);
    } catch {
      return { ok: false, error: 'Una de las partes no es un JSON válido.' };
    }
    if (!isPart(p)) return { ok: false, error: 'Una de las partes no tiene el formato de la copia de seguridad.' };
    parts.push(p);
  }
  const first = parts[0];
  if (parts.some((p) => p.createdAt !== first.createdAt || p.parts !== first.parts || p.totalEntries !== first.totalEntries)) {
    return { ok: false, error: 'Las partes son de copias distintas.' };
  }
  const seen = new Set(parts.map((p) => p.part));
  if (seen.size !== parts.length) return { ok: false, error: 'Hay partes repetidas.' };
  for (let i = 1; i <= first.parts; i++) {
    if (!seen.has(i)) return { ok: false, error: `Falta la parte ${i} de ${first.parts}.` };
  }
  const entries = parts.sort((a, b) => a.part - b.part).flatMap((p) => p.entries);
  if (entries.length !== first.totalEntries) {
    return { ok: false, error: `Se esperaban ${first.totalEntries} claves y hay ${entries.length}.` };
  }
  if (new Set(entries.map((e) => e[0])).size !== entries.length) return { ok: false, error: 'Hay claves repetidas.' };
  return { ok: true, entries, createdAt: first.createdAt };
}

function isPart(p: unknown): p is BackupPart {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    o.format === BACKUP_FORMAT &&
    o.version === BACKUP_VERSION &&
    typeof o.createdAt === 'string' &&
    Number.isInteger(o.part) &&
    Number.isInteger(o.parts) &&
    Number.isInteger(o.totalEntries) &&
    Array.isArray(o.entries) &&
    (o.entries as unknown[]).every(
      (e) => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' && typeof e[1] === 'string',
    )
  );
}

/** Texto corto para mostrar el tamaño: "340 KB". */
export function sizeLabel(texts: string[]): string {
  const chars = texts.reduce((a, t) => a + t.length, 0);
  return chars < 1024 ? `${chars} B` : `${Math.round(chars / 1024)} KB`;
}
