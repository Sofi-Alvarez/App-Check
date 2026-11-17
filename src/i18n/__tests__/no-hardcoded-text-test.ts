/// <reference types="node" />
// T6.4: los textos de la interfaz viven en `src/i18n/es.ts`. Esta prueba recorre las pantallas y la lógica que arma
// textos para la persona, y falla si encuentra texto en español escrito directo en el código.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const FILES = [
  ...readdirSync(join(ROOT, 'screens')).filter((f) => f.endsWith('.tsx')).map((f) => join(ROOT, 'screens', f)),
  join(ROOT, '..', 'App.tsx'),
  join(ROOT, 'notifications.ts'),
  join(ROOT, 'reminders.ts'),
  join(ROOT, 'domain', 'describe.ts'),
  join(ROOT, 'agenda.ts'),
  join(ROOT, 'backupShare.ts'),
  join(ROOT, 'engine', 'v2.ts'),
].filter((f) => statSync(f).isFile());

/** Palabras en español de al menos 3 letras, con alguna minúscula: lo que suele ser un texto para la persona. */
const WORDS = /[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]{3,}(\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,})+/;
const PATTERNS: [string, RegExp][] = [
  ['texto dentro de una etiqueta JSX', />\s*([^<>{}]*[a-záéíóúñ]{3,}[^<>{}]*)</],
  ['propiedad de texto', /\b(label|a11y|placeholder|accessibilityLabel|title|message)=\s*"([^"]*[a-záéíóúñ]{3,}[^"]*)"/],
  ['texto de un aviso (Alert)', /Alert\.alert\(\s*'([^']+)'/],
  ['texto suelto en una línea de JSX', /^\s+([A-ZÁÉÍÓÚ¿][a-záéíóúñ]+(\s+[a-záéíóúñ,.:]+){3,})\s*$/],
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');
}

describe('sin textos de la interfaz escritos directo en el código', () => {
  for (const file of FILES) {
    test(file.slice(ROOT.length - 3), () => {
      const found: string[] = [];
      stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
        for (const [what, re] of PATTERNS) {
          const m = re.exec(line);
          if (m && WORDS.test(m[m.length - 1] ?? m[0])) found.push(`línea ${i + 1} (${what}): ${line.trim().slice(0, 100)}`);
        }
      });
      expect(found).toEqual([]);
    });
  }

  test('la prueba detecta un texto escrito directo (control)', () => {
    const line = '        <Text style={x}>Guardar los cambios</Text>';
    expect(PATTERNS.some(([, re]) => { const m = re.exec(line); return !!m && WORDS.test(m[m.length - 1]); })).toBe(true);
  });
});
