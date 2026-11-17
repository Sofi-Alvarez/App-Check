// T6.3: revisión automática de accesibilidad de las pantallas nuevas. Cada elemento tocable tiene que tener nombre para
// los lectores de pantalla (etiqueta accesible o texto visible). Los tamaños mínimos (48 dp) se verifican en los
// estilos compartidos de `ui.tsx` y en las pruebas de cada pantalla.

import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { buildV2Store } from '../../__fixtures__/v2-store';
import type { Ctx } from '../../ctx';
import { memoryKV } from '../../data/kv';
import { createRepository } from '../../data/repository';
import { createV2Engine } from '../../engine/v2';
import { THEMES } from '../../theme';
import { Btn, Pill } from '../../ui';
import { AgendaScreen } from '../AgendaScreen';
import { CategoriesScreen } from '../CategoriesScreen';
import { EventEditor } from '../EventEditor';
import { GoalEditor } from '../GoalEditor';
import { GoalsScreen } from '../GoalsScreen';

jest.setTimeout(30000);

function ctx(): Ctx {
  const repo = createRepository(memoryKV(buildV2Store()));
  const now = new Date(2026, 10, 16, 9, 30);
  const engine = createV2Engine(repo, () => now);
  return {
    theme: THEMES.light, insets: { top: 0, bottom: 0 }, now, viewIso: '2026-11-16', settings: engine.loadSettings(),
    day: { done: {}, counts: {} }, active: null, engine, rev: 0, blocks: engine.blocksFor('2026-11-16') ?? [],
    setViewIso: jest.fn(), changeCount: jest.fn(), runEvent: (op: () => unknown) => op(),
  } as unknown as Ctx;
}

/** Nodo del árbol que devuelve `screen.toJSON()`. */
interface Node {
  type: string;
  props: Record<string, unknown>;
  children: (Node | string)[] | null;
}
const textOf = (n: Node | string): string =>
  typeof n === 'string' ? n : (n.children ?? []).map((c) => textOf(c)).join('');

/** Elementos tocables (con `onClick` o con respuesta táctil) sin nombre accesible. */
function unnamedTouchables(tree: Node | Node[] | null): string[] {
  const out: string[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') return;
    const p = n.props ?? {};
    const touchable = p.accessible === true && (typeof p.onClick === 'function' || typeof p.onResponderRelease === 'function');
    if (touchable && !p.accessibilityLabel && !textOf(n).trim()) out.push(`${n.type} ${JSON.stringify(p.accessibilityRole ?? '')}`);
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of Array.isArray(tree) ? tree : tree ? [tree] : []) walk(n);
  return out;
}

const screens: [string, (c: Ctx) => React.ReactElement][] = [
  ['Agenda', (c) => <AgendaScreen c={c} />],
  ['Metas', (c) => <GoalsScreen c={c} />],
  ['Categorías', (c) => <CategoriesScreen c={c} visible onClose={jest.fn()} />],
  ['Editor de eventos (nuevo)', (c) => <EventEditor c={c} target={{ id: null, refDate: '2026-11-16' }} onClose={jest.fn()} />],
  ['Editor de eventos (existente)', (c) => <EventEditor c={c} target={{ id: 'mwf:600', refDate: '2026-11-16' }} onClose={jest.fn()} />],
  ['Editor de metas', (c) => <GoalEditor c={c} target={{ id: 'com' }} onClose={jest.fn()} />],
];

describe('accesibilidad: todo lo tocable tiene nombre', () => {
  test('el revisor detecta un elemento tocable sin nombre (control de la propia prueba)', async () => {
    await render(<View><Pressable onPress={jest.fn()} style={{ width: 48, height: 48 }} /></View>);
    expect(unnamedTouchables(screen.toJSON() as Node | Node[] | null)).toHaveLength(1);
  });

  for (const [name, el] of screens) {
    test(name, async () => {
      await render(el(ctx()));
      expect(unnamedTouchables(screen.toJSON() as Node | Node[] | null)).toEqual([]);
    });
  }
});

describe('accesibilidad: tamaños mínimos de los controles compartidos', () => {
  test('botones y pastillas de al menos 48 dp', async () => {
    await render(
      <>
        <Btn t={THEMES.light} label="Guardar" onPress={jest.fn()} />
        <Pill t={THEMES.light} label="+" onPress={jest.fn()} />
      </>,
    );
    for (const label of ['Guardar', '+']) {
      const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    expect(StyleSheet.flatten(screen.getByLabelText('+').props.style).minWidth).toBeGreaterThanOrEqual(48);
  });
});
