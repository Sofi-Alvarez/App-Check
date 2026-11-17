// Prueba de pantalla del editor de eventos (fase 3): se renderiza con un motor v2 real (fixture migrada) y se recorren
// los flujos de crear, editar con la hoja de alcance, cambiar la repetición y eliminar.

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { buildV1Store } from '../../__fixtures__/v1-store';
import type { Ctx } from '../../ctx';
import { memoryKV } from '../../data/kv';
import { createRepository } from '../../data/repository';
import type { EventResult } from '../../engine/types';
import { createV2Engine } from '../../engine/v2';
import { migrateRepository } from '../../migration/v1-to-v2';
import { THEMES } from '../../theme';
import { EventEditor } from '../EventEditor';

function setup(active: Ctx['active'] = null) {
  const repo = createRepository(memoryKV(buildV1Store()));
  migrateRepository(repo, '2026-11-17');
  const engine = createV2Engine(repo, () => new Date(2026, 10, 17, 12, 0));
  const runs: string[] = [];
  const c = {
    theme: THEMES.light, insets: { top: 0, bottom: 0 }, engine, active,
    runEvent: (op: () => EventResult, label: string) => {
      const r = op();
      if (r.ok) runs.push(label);
      return r;
    },
  } as unknown as Ctx;
  return { c, engine, runs };
}

describe('EventEditor', () => {
  test('crear un evento de sábado', async () => {
    const { c, engine, runs } = setup();
    const onClose = jest.fn();
    await render(<EventEditor c={c} target={{ id: null, refDate: '2026-11-21', start: 600 }} onClose={onClose} />);
    expect(screen.getByText('Nuevo evento')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre del evento'), 'Correr');
    expect(screen.getByText(/Solo el sábado 21\/11/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ejercicio'));
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(onClose).toHaveBeenCalled();
    expect(runs).toEqual(['Se creó "Correr"']);
    expect(engine.blocksFor('2026-11-21')!.map((b) => [b.t, b.s, b.e, b.c])).toEqual([['Correr', 600, 630, 'health']]);
  });

  test('sin nombre no deja guardar y lo dice', async () => {
    const { c, runs } = setup();
    await render(<EventEditor c={c} target={{ id: null, refDate: '2026-11-21' }} onClose={jest.fn()} />);
    expect(screen.getByText('Escribe un nombre.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(runs).toEqual([]);
  });

  test('editar un evento que se repite abre la hoja con los tres alcances, sin ninguno preseleccionado', async () => {
    const { c, engine, runs } = setup();
    const ingles = engine.blocksFor('2026-11-23')!.find((b) => b.t === 'Estudio de inglés')!;
    const onClose = jest.fn();
    await render(<EventEditor c={c} target={{ id: ingles.id, refDate: '2026-11-23' }} onClose={onClose} />);
    expect(screen.getByText('Editar evento')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre del evento'), 'Inglés B2');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(screen.getByText('¿Qué días cambia?')).toBeTruthy();
    expect(screen.getByText(/^Solo (hoy|el 23\/11)$/)).toBeTruthy();
    expect(screen.getByText(/^A partir (de hoy|del 23\/11)$/)).toBeTruthy();
    expect(screen.getByText('Siempre')).toBeTruthy();
    expect(runs).toEqual([]); // nada se guarda hasta elegir
    await fireEvent.press(screen.getByText(/^A partir (de hoy|del 23\/11)$/));
    expect(onClose).toHaveBeenCalled();
    expect(engine.blocksFor('2026-11-18')!.some((b) => b.t === 'Estudio de inglés')).toBe(true);
    expect(engine.blocksFor('2026-11-25')!.some((b) => b.t === 'Inglés B2')).toBe(true);
  });

  test('si cambia la repetición, la hoja no ofrece "Solo hoy" y lo explica', async () => {
    const { c, engine } = setup();
    const ingles = engine.blocksFor('2026-11-23')!.find((b) => b.t === 'Estudio de inglés')!;
    await render(<EventEditor c={c} target={{ id: ingles.id, refDate: '2026-11-23' }} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Todos los días'));
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(screen.queryByText(/^Solo /)).toBeNull();
    expect(screen.getByText(/Cambiaste la repetición/)).toBeTruthy();
  });

  test('eliminar "Solo el día": muestra las sesiones registradas y quita solo ese día', async () => {
    const { c, engine, runs } = setup();
    const jobs = engine.blocksFor('2026-11-16')!.find((b) => b.t === '/jobs y postular')!;
    await render(<EventEditor c={c} target={{ id: jobs.id, refDate: '2026-11-16' }} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Eliminar evento'));
    expect(screen.getByText('¿De qué días lo quitas?')).toBeTruthy();
    expect(screen.getByText(/Tiene 2 sesiones registradas/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/^Solo (hoy|el 16\/11)$/));
    expect(runs).toEqual(['Se eliminó "/jobs y postular"']);
    expect(engine.blocksFor('2026-11-16')!.some((b) => b.id === jobs.id)).toBe(false);
    expect(engine.blocksFor('2026-11-18')!.some((b) => b.id === jobs.id)).toBe(true);
  });

  test('no deja eliminar un evento con una sesión en curso', async () => {
    const { engine } = setup();
    const jobs = engine.blocksFor('2026-11-16')!.find((b) => b.t === '/jobs y postular')!;
    const { c, runs } = setup({ bid: jobs.id, day: '2026-11-16', title: jobs.t, cat: jobs.c, planS: jobs.s, planE: jobs.e, startedAt: 0, pausedAt: 0, pausedMs: 0 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<EventEditor c={c} target={{ id: jobs.id, refDate: '2026-11-16' }} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Eliminar evento'));
    expect(alert).toHaveBeenCalledWith('Sesión en curso', expect.stringMatching(/Termínala primero/));
    expect(screen.queryByText('¿De qué días lo quitas?')).toBeNull();
    expect(runs).toEqual([]);
  });

  test('avisa superposiciones pero deja guardar', async () => {
    const { c, runs } = setup();
    await render(<EventEditor c={c} target={{ id: null, refDate: '2026-11-16', start: 600 }} onClose={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Nombre del evento'), 'Llamada');
    expect(screen.getByText(/Se superpone con \/jobs y postular/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(runs).toEqual(['Se creó "Llamada"']);
  });
});
