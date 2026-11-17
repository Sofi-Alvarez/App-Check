// T4.2: la paleta cerrada de categorías tiene que distinguirse del fondo en modo claro y oscuro.
// Criterio: WCAG 2.2, 1.4.11 (contraste de elementos no textuales), mínimo 3:1. Los colores de categoría se usan en
// puntos, bordes de casilla y casillas rellenas con un ✓ del color de la superficie.

import { COLOR_TOKENS } from '../domain/categories';
import { THEMES, colorFor } from '../theme';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('paleta de categorías: contraste (WCAG 1.4.11, mínimo 3:1)', () => {
  for (const [mode, t] of Object.entries(THEMES)) {
    for (const token of COLOR_TOKENS) {
      test(`${mode} · ${token}: contra la superficie y contra el fondo`, () => {
        const c = colorFor(t, token);
        expect(contrast(c, t.surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(c, t.bg)).toBeGreaterThanOrEqual(3);
      });
    }
  }

  test('el cálculo coincide con valores de referencia', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});
