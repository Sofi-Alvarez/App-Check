import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  DIAS, INIT, MESES, TYPE_LABEL, addDays, fmtClock, hm, iso, mondayOf,
  parseISO, secondsOfDay, weekRangeLabel,
} from '../agenda';
import type { Ctx } from '../ctx';
import type { EngineBlock, TaskDraft } from '../engine/types';
import { colorFor } from '../theme';
import { Bar, Btn, Card, Label, MONO, Pill } from '../ui';
import { TaskEditor } from './TaskEditor';

const toRef = (day: string, b: EngineBlock) => ({ bid: b.id, day, title: b.t, cat: b.c, planS: b.s, planE: b.e });

export function AgendaScreen({ c }: { c: Ctx }) {
  const { theme: t, now, settings, viewIso, day } = c;
  const d = parseISO(viewIso);
  const mon = mondayOf(d);
  const type = c.engine.dayKind(viewIso);
  const blocks = c.blocks;
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const todayIso = iso(now);
  const isToday = viewIso === todayIso;
  const sec = secondsOfDay(now);
  const curIdx = isToday ? blocks.findIndex((b) => sec >= b.s * 60 && sec < b.e * 60) : -1;
  const nextBlock = isToday && curIdx < 0 ? blocks.find((b) => b.s * 60 > sec) : undefined;
  const cur = curIdx >= 0 ? blocks[curIdx] : undefined;
  const { active } = c;
  const curInfo = cur && type ? toRef(viewIso, cur) : null;
  const activeMs = active ? (active.pausedAt || now.getTime()) - active.startedAt - active.pausedMs : 0;
  const activeOther = !!active && !!curInfo && active.bid !== curInfo.bid;

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: 4 }}>
        <Text style={[s.kicker, { color: t.muted }]}>{weekRangeLabel(mon)}</Text>
        <Text style={[s.h1, { color: t.fg }]}>
          {DIAS[d.getDay()]} {d.getDate()} de {MESES[d.getMonth()]}
        </Text>
        <View style={s.chips}>
          {isToday && (
            <View style={[s.chip, { backgroundColor: t.accent }]}>
              <Text style={[s.chipText, { color: t.onAccent }]}>Hoy</Text>
            </View>
          )}
          {type && (
            <View style={[s.chip, { backgroundColor: t.surface2 }]}>
              <Text style={[s.chipText, { color: t.fg }]}>{TYPE_LABEL[type]}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.weekNav}>
        <Pressable
          accessibilityLabel="Semana anterior"
          onPress={() => c.setViewIso(iso(addDays(d, -7)))}
          style={[s.navBtn, { backgroundColor: t.surface, borderColor: t.line }]}
        >
          <Text style={[s.navText, { color: t.fg }]}>‹</Text>
        </Pressable>
        <View style={s.days}>
          {[0, 1, 2, 3, 4].map((i) => {
            const x = addDays(mon, i);
            const id = iso(x);
            const sel = id === viewIso;
            return (
              <Pressable
                key={id}
                accessibilityLabel={`${DIAS[x.getDay()]} ${x.getDate()}`}
                accessibilityState={{ selected: sel }}
                onPress={() => c.setViewIso(id)}
                style={[s.dayBtn, { backgroundColor: sel ? t.fg : t.surface, borderColor: sel ? t.fg : t.line }]}
              >
                <Text style={[s.dayInit, { color: sel ? t.bg : t.fg }]}>
                  {INIT[x.getDay()]}
                  {id === todayIso ? ' •' : ''}
                </Text>
                <Text style={[s.dayNum, { color: sel ? t.bg : t.muted }]}>{x.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityLabel="Semana siguiente"
          onPress={() => c.setViewIso(iso(addDays(d, 7)))}
          style={[s.navBtn, { backgroundColor: t.surface, borderColor: t.line }]}
        >
          <Text style={[s.navText, { color: t.fg }]}>›</Text>
        </Pressable>
      </View>

      <Card t={t}>
        {!isToday ? (
          <>
            <Label t={t}>Vista previa</Label>
            <Text style={[s.note, { color: t.muted }]}>
              Estás viendo otro día. El reloj en vivo y los avisos siguen la agenda de hoy.
            </Text>
          </>
        ) : active ? (
          <>
            <Label t={t} style={{ color: t.accent }}>{active.pausedAt ? 'En pausa' : 'En curso'}</Label>
            <Text style={[s.nowTitle, { color: t.fg }]}>{active.title}</Text>
            <Text style={[s.mono, { color: t.muted }]}>
              {active.planS >= 0 ? `Plan ${hm(active.planS)} a ${hm(active.planE)}` : 'Fuera de la agenda'}
            </Text>
            <View style={s.countRow}>
              <Text style={[s.count, { color: t.fg }]}>{fmtClock(activeMs / 1000)}</Text>
              <Text style={[s.note, { color: t.muted }]}>de trabajo real</Text>
            </View>
            <View style={s.btnRow}>
              <Btn t={t} kind="ghost" label={active.pausedAt ? 'Reanudar' : 'Pausar'} onPress={c.pauseResume} style={s.flex} />
              <Btn t={t} label="Terminar" onPress={c.finishSession} style={s.flex} />
            </View>
            {activeOther && cur && curInfo ? (
              <>
                <Text style={[s.note, { color: t.muted }]}>
                  Según la agenda ahora toca {cur.t}, hasta las {hm(cur.e)}.
                </Text>
                <Btn t={t} kind="ghost" label={`Cambiar a ${cur.t}`} onPress={() => c.startSession(curInfo)} />
              </>
            ) : null}
          </>
        ) : cur ? (
          <>
            <Label t={t} style={{ color: t.accent }}>Ahora</Label>
            <Text style={[s.nowTitle, { color: t.fg }]}>{cur.t}</Text>
            <Text style={[s.mono, { color: t.muted }]}>{hm(cur.s)} a {hm(cur.e)}</Text>
            <View style={s.countRow}>
              <Text style={[s.count, { color: t.fg }]}>{fmtClock(cur.e * 60 - sec)}</Text>
              <Text style={[s.note, { color: t.muted }]}>para terminar</Text>
            </View>
            <Bar t={t} pct={((sec - cur.s * 60) / ((cur.e - cur.s) * 60)) * 100} />
            {cur.n ? <Text style={[s.note, { color: t.muted }]}>{cur.n}</Text> : null}
            {curInfo ? <Btn t={t} label="Empezar" onPress={() => c.startSession(curInfo)} /> : null}
            <Btn t={t} kind="ghost" label="Timer hasta el fin del bloque" onPress={() => c.startTimer((cur.e * 60 - sec) / 60, cur.t)} />
          </>
        ) : nextBlock ? (
          <>
            <Label t={t} style={{ color: t.accent }}>Sigue</Label>
            <Text style={[s.nowTitle, { color: t.fg }]}>{nextBlock.t}</Text>
            <Text style={[s.mono, { color: t.muted }]}>{hm(nextBlock.s)} a {hm(nextBlock.e)}</Text>
            <View style={s.countRow}>
              <Text style={[s.count, { color: t.fg }]}>{fmtClock(nextBlock.s * 60 - sec)}</Text>
              <Text style={[s.note, { color: t.muted }]}>para empezar</Text>
            </View>
            {nextBlock.n ? <Text style={[s.note, { color: t.muted }]}>{nextBlock.n}</Text> : null}
          </>
        ) : (
          <>
            <Label t={t}>Fin</Label>
            <Text style={[s.nowTitle, { color: t.fg }]}>Terminó la agenda de hoy</Text>
            <Text style={[s.note, { color: t.muted }]}>Lo que no es fijo se cierra a las 18:00. Descansa.</Text>
          </>
        )}
        {isToday && active?.bid !== 'other' ? (
          <Btn t={t} kind="ghost" label="Estoy haciendo otra cosa" onPress={() => c.startSession(null)} />
        ) : null}
      </Card>

      <View style={{ gap: 8 }}>
        <Label t={t}>Línea del día</Label>
        <View style={s.legend}>
          {c.engine.legend().map((k) => (
            <View key={k.id} style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: colorFor(t, k.color) }]} />
              <Text style={[s.legendText, { color: t.muted }]}>{k.name}</Text>
            </View>
          ))}
        </View>
        <View>
          {blocks.map((b, i) => {
            const category = c.engine.category(b.c);
            const col = colorFor(t, category.color);
            const done = !!day.done[b.id];
            const key = b.id;
            const muted = !!settings.muted[key];
            const isCur = i === curIdx;
            const noTimer = !category.tracked;
            return (
              <View key={b.id} style={[s.row, isCur && { backgroundColor: t.now }]}>
                <View style={s.timeCol}>
                  <Text style={[s.timeStart, { color: t.fg }]}>{hm(b.s)}</Text>
                  <Text style={[s.timeEnd, { color: t.muted }]}>{hm(b.e)}</Text>
                </View>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Marcar hecho: ${b.t}`}
                  accessibilityState={{ checked: done }}
                  hitSlop={8}
                  onPress={() => c.toggleDone(b.id)}
                  style={[s.chk, { borderColor: col, backgroundColor: done ? col : t.surface }]}
                >
                  {done ? <Text style={[s.chkMark, { color: t.surface }]}>✓</Text> : null}
                </Pressable>
                <View style={s.body}>
                  <Text style={[s.rowTitle, { color: done ? t.muted : t.fg }, done && s.strike]}>{b.t}</Text>
                  {b.n ? <Text style={[s.rowNote, { color: t.muted }]}>{b.n}</Text> : null}
                  <View style={s.acts}>
                    <Pill
                      t={t}
                      label={`Aviso: ${muted ? 'no' : 'sí'}`}
                      pressed={!muted}
                      a11y={`Aviso de ${b.t}: ${muted ? 'silenciado' : 'activado'}`}
                      onPress={() => c.toggleMute(key)}
                    />
                    {isToday && type ? (
                      <Pill
                        t={t}
                        label={active?.bid === b.id ? 'En curso' : 'Empezar'}
                        selected={active?.bid === b.id}
                        a11y={`Empezar ${b.t}`}
                        onPress={() => {
                          if (active?.bid !== b.id) c.startSession(toRef(viewIso, b));
                        }}
                      />
                    ) : null}
                    <Pill
                      t={t}
                      label="Editar"
                      a11y={`Editar ${b.t}`}
                      onPress={() => setDraft({ id: b.id, t: b.t, c: b.c, s: b.s, e: b.e, n: b.n })}
                    />
                    {noTimer ? null : (
                      <Pill t={t} label={`Timer ${b.e - b.s} min`} onPress={() => c.startTimer(b.e - b.s, b.t)} />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        {type ? (
          <Btn
            t={t}
            kind="ghost"
            label="+ Nueva tarea"
            onPress={() => {
              const start = isToday ? Math.min(23 * 60, Math.ceil(sec / 900) * 15) : 9 * 60;
              setDraft({ id: null, t: '', c: 'work', s: start, e: Math.min(24 * 60, start + 30), n: '' });
            }}
          />
        ) : null}
      </View>
      <TaskEditor c={c} draft={draft} type={type} onClose={() => setDraft(null)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  kicker: { fontFamily: MONO, fontSize: 12 },
  h1: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
  chipText: { fontSize: 13, fontWeight: '700' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: { width: 40, height: 56, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 26, lineHeight: 30 },
  days: { flex: 1, flexDirection: 'row', gap: 6 },
  dayBtn: { flex: 1, height: 56, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayInit: { fontSize: 16, fontWeight: '800' },
  dayNum: { fontFamily: MONO, fontSize: 12 },
  note: { fontSize: 15, lineHeight: 21 },
  btnRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  nowTitle: { fontSize: 22, lineHeight: 27, fontWeight: '700' },
  mono: { fontFamily: MONO, fontSize: 14 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  count: { fontFamily: MONO, fontSize: 46, fontWeight: '500', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12 },
  timeCol: { width: 48, alignItems: 'flex-end', paddingTop: 6 },
  timeStart: { fontFamily: MONO, fontSize: 14, fontWeight: '500' },
  timeEnd: { fontFamily: MONO, fontSize: 12 },
  chk: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  chkMark: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  strike: { textDecorationLine: 'line-through' },
  rowNote: { fontSize: 14, lineHeight: 19 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
