import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { buildV2Store } from '../../__fixtures__/v2-store';
import type { Ctx } from '../../ctx';
import { memoryKV } from '../../data/kv';
import { createRepository } from '../../data/repository';
import { createV2Engine } from '../../engine/v2';
import { THEMES } from '../../theme';
import { AgendaScreen } from '../AgendaScreen';

function ctxFor(viewIso: string): Ctx {
  const repo = createRepository(memoryKV(buildV2Store()));
  const engine = createV2Engine(repo, () => new Date(2026, 10, 17, 12, 0));
  return {
    theme: THEMES.light, insets: { top: 0, bottom: 0 }, now: new Date(2026, 10, 17, 12, 0), viewIso,
    settings: engine.loadSettings(), day: { done: {}, counts: {} }, active: null, engine,
    blocks: engine.blocksFor(viewIso) ?? [], setViewIso: jest.fn(),
  } as unknown as Ctx;
}

// Las pruebas de pantalla dibujan componentes completos: en la integración continua la primera puede tardar más de 5 s.
jest.setTimeout(30000);

describe('AgendaScreen con el modelo nuevo', () => {
  test('semana de 7 días, flechas de semana en la línea del título y sin la etiqueta del tipo de día', async () => {
    await render(<AgendaScreen c={ctxFor('2026-11-16')} />);
    for (const d of ['Lunes 16', 'Martes 17', 'Miércoles 18', 'Jueves 19', 'Viernes 20', 'Sábado 21', 'Domingo 22']) {
      expect(screen.getByLabelText(d)).toBeTruthy();
    }
    expect(screen.getByLabelText('Semana anterior')).toBeTruthy();
    expect(screen.getByLabelText('Semana siguiente')).toBeTruthy();
    expect(screen.queryByText('Día completo')).toBeNull();
    expect(screen.getByLabelText('+ Nuevo evento')).toBeTruthy();
  });

  test('un sábado sin eventos lo dice y permite crear uno', async () => {
    await render(<AgendaScreen c={ctxFor('2026-11-21')} />);
    expect(screen.getByText(/No hay eventos este día/)).toBeTruthy();
    expect(screen.getByLabelText('+ Nuevo evento')).toBeTruthy();
  });
});
