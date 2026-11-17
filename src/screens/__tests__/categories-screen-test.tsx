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
import { CategoriesScreen } from '../CategoriesScreen';

jest.setTimeout(30000);

function setup() {
  const repo = createRepository(memoryKV(buildV1Store()));
  migrateRepository(repo, '2026-11-17');
  const engine = createV2Engine(repo, () => new Date(2026, 10, 17, 12, 0));
  const runs: string[] = [];
  const c = {
    theme: THEMES.light, insets: { top: 0, bottom: 0 }, engine,
    runEvent: <T extends { ok: boolean }>(op: () => T, label: string) => {
      const r = op();
      if (r.ok) runs.push(label);
      return r;
    },
  } as unknown as Ctx;
  return { c, engine, runs };
}
/** Simula tocar el botón con ese texto en el próximo Alert. */
const pressInAlert = (text: string) =>
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.find((b) => b.text === text)?.onPress?.());

afterEach(() => jest.restoreAllMocks());

describe('CategoriesScreen', () => {
  test('lista las categorías con cuántos eventos las usan', async () => {
    const { c } = setup();
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    expect(screen.getByText('Categorías')).toBeTruthy();
    expect(screen.getByLabelText('Editar Búsqueda')).toBeTruthy();
    expect(screen.getByText(/Fija/)).toBeTruthy();
  });

  test('renombrar: los eventos siguen con la categoría (por id) y se ve el nombre nuevo', async () => {
    const { c, engine, runs } = setup();
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Editar Inglés'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'English');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(runs).toEqual(['Se guardó la categoría "English"']);
    const b = engine.blocksFor('2026-11-16')!.find((x) => x.t === 'Estudio de inglés')!;
    expect(engine.category(b.c).name).toBe('English');
  });

  test('cambiar el comportamiento de una categoría con eventos pide confirmación', async () => {
    const { c, engine } = setup();
    const alert = pressInAlert('Guardar');
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Editar Inglés'));
    await fireEvent.press(screen.getByLabelText('Es fija: nunca se mueve'));
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(alert).toHaveBeenCalledWith('Cambia el comportamiento', expect.stringMatching(/afecta a \d+ eventos/), expect.anything());
    expect(engine.category('english').movable).toBe(false);
  });

  test('eliminar una categoría en uso: pide a cuál pasar los eventos y después elimina', async () => {
    const { c, engine } = setup();
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Editar Inglés'));
    await fireEvent.press(screen.getByLabelText('Eliminar categoría'));
    expect(screen.getByText(/La usan \d+ eventos. Elige otra categoría/)).toBeTruthy();
    expect(screen.getByLabelText('Pasar y eliminar').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('Pasar a Proyecto'));
    await fireEvent.press(screen.getByLabelText('Pasar y eliminar'));
    expect(engine.events!.categoriesAll().some((x) => x.id === 'english')).toBe(false);
    const b = engine.blocksFor('2026-11-16')!.find((x) => x.t === 'Estudio de inglés')!;
    expect(b.c).toBe('project');
  });

  test('archivar en lugar de eliminar: deja de ofrecerse y sus eventos la conservan', async () => {
    const { c, engine } = setup();
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Editar Inglés'));
    await fireEvent.press(screen.getByLabelText('Archivar'));
    expect(engine.events!.categories().some((x) => x.id === 'english')).toBe(false);
    expect(engine.blocksFor('2026-11-16')!.find((x) => x.t === 'Estudio de inglés')!.c).toBe('english');
    expect(screen.getByText(/Archivada/)).toBeTruthy();
  });

  test('crear una categoría nueva sin eventos y eliminarla con confirmación', async () => {
    const { c, engine } = setup();
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('+ Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'Lectura');
    await fireEvent.press(screen.getByLabelText('Crear categoría'));
    expect(screen.getByLabelText('Editar Lectura')).toBeTruthy();
    pressInAlert('Eliminar');
    await fireEvent.press(screen.getByLabelText('Editar Lectura'));
    await fireEvent.press(screen.getByLabelText('Eliminar categoría'));
    expect(engine.events!.categoriesAll().some((x) => x.name === 'Lectura')).toBe(false);
  });

  test('nombre repetido: lo dice y no guarda', async () => {
    const { c, runs } = setup();
    await render(<CategoriesScreen c={c} visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('+ Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre de la categoría'), 'proyecto');
    await fireEvent.press(screen.getByLabelText('Crear categoría'));
    expect(screen.getByText('Ya hay una categoría activa con ese nombre.')).toBeTruthy();
    expect(runs).toEqual([]);
  });
});
