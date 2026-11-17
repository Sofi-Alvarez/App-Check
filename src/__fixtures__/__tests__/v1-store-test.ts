// Comprueba que la fixture v1 es coherente consigo misma y con la lógica actual de la app.
// Si alguien cambia la agenda original o la fixture, estas pruebas avisan antes de que la migración se pruebe contra
// datos imposibles.

import { buildSessions } from '../../sessions';
import { readV1, v1BlocksFor } from '../../migration/v1-reader';
import { EXPECTED, NOW, SCHED, buildV1Store } from '../v1-store';

const entries = buildV1Store();
const st = readV1(entries);

describe('fixture v1: forma del almacén', () => {
  test('todas las claves son únicas y todos los valores (salvo marcas) son JSON', () => {
    expect(new Set(entries.map((e) => e[0])).size).toBe(entries.length);
    for (const [k, v] of entries) if (!k.startsWith('agenda:flag:')) expect(() => JSON.parse(v)).not.toThrow();
  });

  test('cada evento está guardado en la clave de la fecha local de su hora', () => {
    st.logs.forEach((e, i) => {
      const d = new Date(e.ts);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(st.logKeys[i]).toBe(local);
    });
  });
});

describe('fixture v1: coherencia con la agenda', () => {
  test('cada evento apunta a un bloque que existe ese día', () => {
    for (const e of st.logs) {
      const blocks = v1BlocksFor(st, e.day);
      expect(blocks).not.toBeNull();
      const ok = blocks!.some((x) => x.id === e.bid);
      expect(`${e.kind} ${e.day} ${e.bid} ${ok}`).toBe(`${e.kind} ${e.day} ${e.bid} true`);
    }
  });

  // Comportamiento real de la app: cada evento guarda el horario planificado del momento del toque. Si después se
  // aplica un margen ese día, la agenda del día cambia y los eventos anteriores conservan el horario viejo.
  // La migración no debe "corregirlos": son historia.
  test('el horario planificado de un evento coincide con el del día, salvo los registrados antes de un margen', () => {
    const marginAt: Record<string, number> = {};
    for (const e of st.logs) if (e.kind === 'margin' && e.goal !== 'none') marginAt[e.day] = e.ts;
    let stale = 0;
    for (const e of st.logs) {
      const b = v1BlocksFor(st, e.day)!.find((x) => x.id === e.bid)!;
      const same = e.planS === b.s && e.planE === b.e;
      if (!same) {
        expect(marginAt[e.day]).toBeDefined();
        expect(e.ts).toBeLessThanOrEqual(marginAt[e.day]);
        stale++;
      }
    }
    expect(stale).toBe(EXPECTED.staleAfterMargin);
  });

  test('el destino de un margen aceptado existe ese día', () => {
    for (const e of st.logs.filter((x) => x.kind === 'margin' && x.goal !== 'none')) {
      expect(v1BlocksFor(st, e.day)!.some((b) => b.id === e.goal)).toBe(true);
    }
  });

  test('cada marca de hecho apunta a un bloque de ese día', () => {
    for (const [date, d] of Object.entries(st.days)) {
      const ids = new Set((v1BlocksFor(st, date) ?? []).map((b) => b.id));
      for (const id of Object.keys(d.done)) expect(`${date} ${id} ${ids.has(id)}`).toBe(`${date} ${id} true`);
    }
  });

  test('la sesión en curso coincide con la última sesión abierta del registro', () => {
    const last = st.logs.filter((e) => e.kind === 'start').at(-1)!;
    expect(st.active?.bid).toBe(last.bid);
    expect(st.active?.startedAt).toBe(last.ts);
  });
});

describe('fixture v1: casos que la migración tiene que resolver', () => {
  const lists = Object.entries(SCHED);
  const where = (id: string) => lists.filter(([, l]) => l!.some((b) => b.id === id));
  const times = (id: string) => new Set(where(id).map(([, l]) => { const b = l!.find((x) => x.id === id)!; return `${b.s}-${b.e}`; }));

  test('una tarea nueva en varias listas con el mismo horario', () => {
    expect(where(EXPECTED.sharedIdSameTimes).length).toBeGreaterThan(1);
    expect(times(EXPECTED.sharedIdSameTimes).size).toBe(1);
  });

  test('una tarea nueva en varias listas con horarios distintos (caso difícil)', () => {
    expect(where(EXPECTED.sharedIdDifferentTimes).length).toBeGreaterThan(1);
    expect(times(EXPECTED.sharedIdDifferentTimes).size).toBeGreaterThan(1);
  });

  test('un bloque original con horario editado cuyo id ya no coincide con su hora de inicio', () => {
    const { id, s } = EXPECTED.editedOriginal;
    expect(id).not.toBe(`mwf:${s}`);
  });

  test('un bloque original eliminado con "Siempre", y otro eliminado y otro agregado "Solo hoy"', () => {
    expect(SCHED[EXPECTED.deletedAlways.list]!.some((b) => b.id === EXPECTED.deletedAlways.id)).toBe(false);
    expect(v1BlocksFor(st, EXPECTED.deletedToday.date)!.some((b) => b.id === EXPECTED.deletedToday.id)).toBe(false);
    expect(v1BlocksFor(st, EXPECTED.addedToday.date)!.some((b) => b.id === EXPECTED.addedToday.id)).toBe(true);
  });
});

describe('fixture v1: línea base de sesiones (CA-16)', () => {
  const { sessions, loose } = buildSessions(st.logs, NOW);

  test('cantidad de eventos, sesiones y sesiones por día', () => {
    expect(st.logs).toHaveLength(EXPECTED.totalEvents);
    expect(sessions).toHaveLength(EXPECTED.sessions);
    const byDay: Record<string, number> = {};
    for (const x of sessions) byDay[x.day] = (byDay[x.day] ?? 0) + 1;
    expect(byDay).toEqual(EXPECTED.sessionsByDay);
  });

  test('sesiones cerradas solas, abiertas y conteos sueltos', () => {
    expect(sessions.filter((x) => x.endedBy === 'auto_close')).toHaveLength(EXPECTED.autoClosed);
    expect(sessions.filter((x) => x.endedBy === 'open')).toHaveLength(EXPECTED.open);
    expect(loose).toHaveLength(EXPECTED.looseCounts);
  });

  test('tiempo real y pausa de una sesión con pausa', () => {
    const jobs = sessions[0];
    expect(Math.round(jobs.activeMs / 60000)).toBe(EXPECTED.mondayJobs.activeMin);
    expect(Math.round(jobs.pausedMs / 60000)).toBe(EXPECTED.mondayJobs.pausedMin);
    expect(jobs.endedBy).toBe(EXPECTED.mondayJobs.endedBy);
  });

  test('los conteos quedan asociados a la sesión en curso', () => {
    expect(sessions[1].counts).toEqual({ cold: 10 });
    expect(sessions.find((x) => x.day === '2026-11-11' && x.counts.cold)?.counts).toEqual({ cold: 8 });
  });
});
