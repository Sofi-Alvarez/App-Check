import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { buildV1Store } from '../../__fixtures__/v1-store';
import type { Ctx } from '../../ctx';
import { memoryKV } from '../../data/kv';
import { createRepository } from '../../data/repository';
import { createV2Engine } from '../../engine/v2';
import { migrateRepository } from '../../migration/v1-to-v2';
import { THEMES } from '../../theme';
import { AgendaScreen } from '../AgendaScreen';
import { GoalsScreen } from '../GoalsScreen';

jest.setTimeout(30000);
afterEach(() => jest.restoreAllMocks());

function setup(viewIso = '2026-11-16', now = new Date(2026, 10, 17, 12, 0)) {
  const repo = createRepository(memoryKV(buildV1Store()));
  migrateRepository(repo, '2026-11-17');
  const engine = createV2Engine(repo, () => now);
  const runs: string[] = [];
  const changeCount = jest.fn();
  const c = {
    theme: THEMES.light, insets: { top: 0, bottom: 0 }, settings: engine.loadSettings(), viewIso, now,
    day: { done: {}, counts: { com: 2 } }, engine, rev: 0, active: null, changeCount, setViewIso: jest.fn(),
    blocks: engine.blocksFor(viewIso) ?? [],
    runEvent: <T extends { ok: boolean }>(op: () => T, label: string) => {
      const r = op();
      if (r.ok) runs.push(label);
      return r;
    },
  } as unknown as Ctx;
  return { c, engine, runs, changeCount };
}

describe('GoalsScreen: tus metas', () => {
  test('lista las metas migradas con su resumen', async () => {
    const { c } = setup();
    await render(<GoalsScreen c={c} />);
    expect(screen.getByLabelText('Editar meta Comentarios')).toBeTruthy();
    expect(screen.getByText('Cantidad · 5 comentarios por día · L M X V')).toBeTruthy();
    expect(screen.getAllByText('Tiempo · sin objetivo por semana · L M X J V')).toHaveLength(2); // Proyecto y Ejercicio
  });

  test('crear una meta de cantidad: aparece en la lista y como contador los días en que aplica', async () => {
    const { c, engine, runs } = setup();
    await render(<GoalsScreen c={c} />);
    await fireEvent.press(screen.getByLabelText('+ Nueva meta'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la meta'), 'Páginas leídas');
    await fireEvent.changeText(screen.getByLabelText('Unidad'), 'páginas');
    await fireEvent.changeText(screen.getByLabelText('Objetivo'), '20');
    await fireEvent.press(screen.getByLabelText('Crear meta'));
    expect(runs).toEqual(['Se creó la meta "Páginas leídas"']);
    expect(engine.goalsFor('2026-11-16').find((g) => g.label === 'Páginas leídas')?.target).toBe(20);
    expect(engine.goalsFor('2026-11-21').some((g) => g.label === 'Páginas leídas')).toBe(false); // sábado
  });

  test('una meta de tiempo sin eventos asociados no se guarda y lo explica', async () => {
    const { c, runs } = setup();
    await render(<GoalsScreen c={c} />);
    await fireEvent.press(screen.getByLabelText('+ Nueva meta'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la meta'), 'Lectura');
    await fireEvent.press(screen.getByLabelText('Tiempo'));
    await fireEvent.press(screen.getByLabelText('Sin objetivo'));
    await fireEvent.press(screen.getByLabelText('Crear meta'));
    expect(screen.getByText(/necesita al menos un evento asociado/)).toBeTruthy();
    expect(runs).toEqual([]);
  });

  test('subir el objetivo pide alcance; "A partir de hoy" crea una versión nueva', async () => {
    const { c, engine } = setup();
    await render(<GoalsScreen c={c} />);
    await fireEvent.press(screen.getByLabelText('Editar meta Comentarios'));
    await fireEvent.changeText(screen.getByLabelText('Objetivo'), '8');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(screen.getByText('¿Desde cuándo vale el cambio?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('A partir de hoy'));
    const g = engine.events!.goalsAll().find((x) => x.id === 'com')!;
    expect(g.version.target).toBe(8);
    expect(engine.goalsFor('2026-11-16').find((x) => x.key === 'com')!.target).toBe(5); // día anterior a "hoy" (17/11)
    expect(engine.goalsFor('2026-11-18').find((x) => x.key === 'com')!.target).toBe(8);
  });

  test('cambiar solo el nombre no pide alcance', async () => {
    const { c, engine, runs } = setup();
    await render(<GoalsScreen c={c} />);
    await fireEvent.press(screen.getByLabelText('Editar meta Comentarios'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la meta'), 'Comentarios en LinkedIn');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(screen.queryByText('¿Desde cuándo vale el cambio?')).toBeNull();
    expect(runs).toEqual(['Se guardó la meta "Comentarios en LinkedIn"']);
    expect(engine.goalName('com')).toBe('Comentarios en LinkedIn');
  });

  test('archivar y eliminar con confirmación', async () => {
    const { c, engine } = setup();
    await render(<GoalsScreen c={c} />);
    await fireEvent.press(screen.getByLabelText('Editar meta Reacciones'));
    await fireEvent.press(screen.getByLabelText('Archivar'));
    expect(engine.goalsFor('2026-11-16').some((g) => g.key === 'rea')).toBe(false);
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, msg, buttons) => {
      expect(msg).toMatch(/Si solo quieres dejar de verla, mejor archívala/);
      buttons?.find((b) => b.text === 'Eliminar')?.onPress?.();
    });
    await fireEvent.press(screen.getByLabelText('Editar meta Postulaciones'));
    await fireEvent.press(screen.getByLabelText('Eliminar meta'));
    expect(engine.events!.goalsAll().some((g) => g.id === 'apl')).toBe(false);
  });
});

describe('AgendaScreen: contadores dentro del evento (T5.3)', () => {
  test('una meta asociada al evento que toca ahora aparece con su contador y botones', async () => {
    const now = new Date(2026, 10, 16, 9, 30); // lunes, "LinkedIn: publicar y social"
    const { engine } = setup('2026-11-16', now);
    const social = engine.blocksFor('2026-11-16')!.find((b) => b.t === 'LinkedIn: publicar y social')!;
    const g = engine.events!.goalsAll().find((x) => x.id === 'com')!;
    engine.events!.updateGoal('com', { name: g.name, kind: g.kind, unit: g.unit, target: g.version.target, period: g.version.period, activeDays: g.version.activeDays, links: [social.id], reminder: null }, 'fromToday');
    const { c, changeCount } = setup('2026-11-16', now);
    // Mismo motor con la meta ya asociada.
    (c as { engine: typeof engine }).engine = engine;
    (c as { blocks: unknown }).blocks = engine.blocksFor('2026-11-16');
    await render(<AgendaScreen c={c} />);
    expect(screen.getByText('2 / 5')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sumar Comentarios'));
    expect(changeCount).toHaveBeenCalledWith('com', 1);
  });
});
