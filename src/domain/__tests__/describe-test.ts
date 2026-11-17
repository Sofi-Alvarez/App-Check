import { describeRule, scopeHint, scopeLabel, shortDate } from '../describe';

describe('describeRule', () => {
  test('sin repetición', () => {
    expect(describeRule(null, '2026-11-21', null)).toBe('Solo el sábado 21/11');
  });
  test('cada semana, varios días en orden de lunes a domingo', () => {
    expect(describeRule({ weekdays: [3, 1], everyWeeks: 1 }, '2026-11-02', null)).toBe('Cada semana, los lunes y miércoles, desde el 02/11');
    expect(describeRule({ weekdays: [0, 6, 1], everyWeeks: 1 }, '2026-11-02', null)).toBe('Cada semana, los lunes, sábados y domingos, desde el 02/11');
  });
  test('cada 2 semanas, un día, con fin', () => {
    expect(describeRule({ weekdays: [2], everyWeeks: 2 }, '2026-11-03', '2026-12-29')).toBe('Cada 2 semanas, el martes, desde el 03/11, hasta el 29/12');
  });
  test('todos los días y de lunes a viernes', () => {
    expect(describeRule({ weekdays: [0, 1, 2, 3, 4, 5, 6], everyWeeks: 1 }, '2026-11-02', null)).toBe('Todos los días, desde el 02/11');
    expect(describeRule({ weekdays: [1, 2, 3, 4, 5], everyWeeks: 1 }, '2026-11-02', null)).toBe('Cada semana, de lunes a viernes, desde el 02/11');
  });
});

describe('scopeLabel y scopeHint', () => {
  test('con la fecha de hoy', () => {
    expect(['today', 'fromToday', 'always'].map((s) => scopeLabel(s as never, '2026-11-17', '2026-11-17'))).toEqual(['Solo hoy', 'A partir de hoy', 'Siempre']);
  });
  test('con otra fecha, "hoy" se reemplaza por la fecha', () => {
    expect(['today', 'fromToday', 'always'].map((s) => scopeLabel(s as never, '2026-11-24', '2026-11-17'))).toEqual(['Solo el 24/11', 'A partir del 24/11', 'Siempre']);
  });
  test('explicaciones distintas para editar y eliminar', () => {
    expect(scopeHint('always', 'edit')).toMatch(/Datos no cambia/);
    expect(scopeHint('always', 'delete')).toMatch(/no se borra/);
    expect(shortDate('2026-01-05')).toBe('05/01');
  });
});
