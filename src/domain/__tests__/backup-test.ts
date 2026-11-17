import { BACKUP_FORMAT, BACKUP_VERSION, Entry, buildBackupParts, parseBackupParts, sizeLabel } from '../backup';

const AT = new Date('2026-11-17T12:00:00Z');
const logEntries = (n: number, size: number): Entry[] =>
  Array.from({ length: n }, (_, i) => [`agenda:log:2026-11-${String(i).padStart(2, '0')}`, 'x'.repeat(size)]);
const asMap = (es: Entry[]) => Object.fromEntries(es);

function parsedEntries(parts: string[]): Entry[] {
  const r = parseBackupParts(parts);
  if (!r.ok) throw new Error(`se esperaba una copia válida: ${r.error}`);
  return r.entries;
}
function parseError(parts: string[]): string {
  const r = parseBackupParts(parts);
  if (r.ok) throw new Error('se esperaba un error');
  return r.error;
}

describe('buildBackupParts y parseBackupParts', () => {
  test('un almacén vacío produce una copia válida de una parte y cero claves', () => {
    const parts = buildBackupParts([], AT);
    expect(parts).toHaveLength(1);
    expect(parsedEntries(parts)).toEqual([]);
  });

  test('ida y vuelta sin pérdida, con tildes, comillas y saltos de línea', () => {
    const entries: Entry[] = [
      ['agenda:settings', '{"anchor":"2026-11-03"}'],
      ['agenda:day:2026-11-17', '{"done":{"mwf:420":true}}'],
      ['agenda:flag:ñ"\\', 'á\né'],
    ];
    const parts = buildBackupParts(entries, AT);
    expect(parts).toHaveLength(1);
    expect(asMap(parsedEntries(parts))).toEqual(asMap(entries));
  });

  test('cada parte lleva el formato, la versión y la fecha', () => {
    const p = JSON.parse(buildBackupParts([['k', 'v']], AT)[0]);
    expect(p).toMatchObject({
      format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: AT.toISOString(), part: 1, parts: 1, totalEntries: 1,
    });
  });

  test('parte la copia cuando supera el máximo y no pierde claves', () => {
    const entries = logEntries(10, 100);
    const parts = buildBackupParts(entries, AT, 350);
    expect(parts.length).toBeGreaterThan(1);
    for (const t of parts) expect(JSON.parse(t).entries.length).toBeGreaterThan(0);
    expect(asMap(parsedEntries(parts))).toEqual(asMap(entries));
  });

  test('el orden en que llegan las partes no importa', () => {
    const parts = buildBackupParts(logEntries(10, 100), AT, 350);
    expect(parsedEntries([...parts].reverse())).toHaveLength(10);
  });

  test('una entrada más grande que el máximo queda entera en su propia parte', () => {
    const parts = buildBackupParts([['a', 'x'.repeat(1000)], ['b', 'y']], AT, 100);
    const a = parsedEntries(parts).find((e) => e[0] === 'a');
    expect(a?.[1]).toHaveLength(1000);
  });

  test('el contenido es estable: el mismo almacén en otro orden da la misma copia', () => {
    const entries: Entry[] = [['b', '2'], ['a', '1'], ['c', '3']];
    expect(buildBackupParts(entries, AT)).toEqual(buildBackupParts([...entries].reverse(), AT));
  });
});

describe('parseBackupParts detecta copias rotas', () => {
  const parts = buildBackupParts(logEntries(10, 100), AT, 350);

  test('falta la primera parte', () => {
    expect(parseError(parts.slice(1))).toMatch(/Falta la parte 1/);
  });

  test('falta la última parte', () => {
    expect(parseError(parts.slice(0, -1))).toMatch(/Falta la parte/);
  });

  test('una parte repetida', () => {
    expect(parseError([parts[0], parts[0], ...parts.slice(1)])).toMatch(/repetidas/);
  });

  test('partes de copias distintas', () => {
    const other = buildBackupParts(logEntries(10, 100), new Date('2026-11-18T00:00:00Z'), 350);
    expect(parseError([parts[0], other[1], ...parts.slice(2)])).toMatch(/distintas/);
  });

  test('textos que no son una copia', () => {
    expect(parseError([])).toMatch(/No hay partes/);
    expect(parseError(['no es json'])).toMatch(/JSON/);
    expect(parseError(['{"format":"otro"}'])).toMatch(/formato/);
  });

  test('una entrada con un valor que no es texto', () => {
    const bad = JSON.stringify({
      format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: 'x', part: 1, parts: 1, totalEntries: 1, entries: [['k', 5]],
    });
    expect(parseError([bad])).toMatch(/formato/);
  });

  test('menos claves de las anunciadas', () => {
    const p = JSON.parse(buildBackupParts([['a', '1'], ['b', '2']], AT)[0]);
    p.entries = p.entries.slice(1);
    expect(parseError([JSON.stringify(p)])).toMatch(/Se esperaban 2 claves y hay 1/);
  });

  test('claves repetidas', () => {
    const p = JSON.parse(buildBackupParts([['a', '1'], ['b', '2']], AT)[0]);
    p.entries[1][0] = 'a';
    expect(parseError([JSON.stringify(p)])).toMatch(/claves repetidas/);
  });
});

describe('sizeLabel', () => {
  test('muestra bytes por debajo de 1 KB y KB por encima', () => {
    expect(sizeLabel(['x'.repeat(10)])).toBe('10 B');
    expect(sizeLabel(['x'.repeat(2048)])).toBe('2 KB');
  });
});
