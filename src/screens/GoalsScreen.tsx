import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GOAL_LABELS, addDays, dayType, goalsFor, iso, mondayOf, parseISO } from '../agenda';
import type { Ctx } from '../ctx';
import { blocksFor } from '../schedule';
import { loadDay } from '../store';
import { Bar, Card, Label, MONO } from '../ui';

interface Row { label: string; value: number; target: number | null; unit: string }

function weekRows(viewIso: string, anchor: string): Row[] {
  const mon = mondayOf(parseISO(viewIso));
  const keys = ['post', 'com', 'rea', 'cold', 'fol', 'apl'];
  const sums: Record<string, { c: number; t: number; hasT: boolean }> = {};
  keys.forEach((k) => (sums[k] = { c: 0, t: 0, hasT: false }));
  let projDone = 0, projTotal = 0, exDone = 0, exTotal = 0;
  for (let i = 0; i < 5; i++) {
    const d = addDays(mon, i);
    const type = dayType(d, anchor);
    const blocks = blocksFor(d, anchor) ?? [];
    const data = loadDay(iso(d));
    goalsFor(type).forEach((g) => {
      if (g.target != null) {
        sums[g.key].t += g.target;
        sums[g.key].hasT = true;
      }
    });
    Object.entries(data.counts).forEach(([k, v]) => {
      if (sums[k]) sums[k].c += v;
    });
    blocks.forEach((b) => {
      const dur = b.e - b.s;
      if (b.c === 'project') {
        projTotal += dur;
        if (data.done[b.id]) projDone += dur;
      }
      if (b.c === 'health') {
        exTotal += 1;
        if (data.done[b.id]) exDone += 1;
      }
    });
  }
  const rows: Row[] = keys.map((k) => ({
    label: GOAL_LABELS[k], value: sums[k].c, target: sums[k].hasT ? sums[k].t : null, unit: '',
  }));
  rows.push({ label: 'Proyecto', value: Math.round(projDone / 6) / 10, target: Math.round(projTotal / 6) / 10, unit: ' h' });
  rows.push({ label: 'Ejercicio', value: exDone, target: exTotal, unit: ' sesiones' });
  return rows;
}

export function GoalsScreen({ c }: { c: Ctx }) {
  const { theme: t, settings, viewIso, day } = c;
  const d = parseISO(viewIso);
  const type = dayType(d, settings.anchor);
  const goals = goalsFor(type);
  // `c.rev` fuerza a releer el almacenamiento tras cada cambio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => weekRows(viewIso, settings.anchor), [viewIso, settings.anchor, c.rev]);

  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]} showsVerticalScrollIndicator={false}>
      <Text style={[s.h1, { color: t.fg }]}>Metas</Text>
      <Text style={[s.sub, { color: t.muted }]}>
        Día que estás viendo: {d.getDate()}/{d.getMonth() + 1}. Cambia de día en la pestaña Agenda.
      </Text>

      <View style={s.grid}>
        {goals.map((g) => {
          const v = day.counts[g.key] ?? 0;
          const met = g.target != null && v >= g.target;
          return (
            <View key={g.key} style={[s.goal, { backgroundColor: t.surface, borderColor: met ? t.ok : t.line }]}>
              <Text style={[s.goalLabel, { color: t.muted }]}>{g.label}</Text>
              <View style={s.valRow}>
                <Text style={[s.val, { color: met ? t.ok : t.fg }]}>{v}</Text>
                {g.target != null ? <Text style={[s.valT, { color: t.muted }]}>/ {g.target}</Text> : null}
              </View>
              <View style={s.step}>
                <Pressable
                  accessibilityLabel={`Restar ${g.label}`}
                  onPress={() => c.changeCount(g.key, -1)}
                  style={[s.stepBtn, { backgroundColor: t.surface2 }]}
                >
                  <Text style={[s.stepText, { color: t.fg }]}>−</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Sumar ${g.label}`}
                  onPress={() => c.changeCount(g.key, 1)}
                  style={[s.stepBtn, { backgroundColor: t.surface2 }]}
                >
                  <Text style={[s.stepText, { color: t.fg }]}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <Card t={t} style={{ gap: 14 }}>
        <Label t={t}>Totales de la semana</Label>
        {rows.map((r) => {
          const pct = r.target ? Math.min(100, Math.round((r.value / r.target) * 100)) : 0;
          return (
            <View key={r.label} style={{ gap: 5 }}>
              <View style={s.wTop}>
                <Text style={[s.wLabel, { color: t.fg }]}>{r.label}</Text>
                <Text style={[s.wVal, { color: t.fg }]}>
                  {r.value}
                  {r.target != null ? ` / ${r.target}` : ''}
                  {r.unit}
                </Text>
              </View>
              {r.target != null ? <Bar t={t} pct={pct} /> : null}
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goal: { width: '48.4%', borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  goalLabel: { fontSize: 14 },
  valRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  val: { fontFamily: MONO, fontSize: 30, fontVariant: ['tabular-nums'] },
  valT: { fontFamily: MONO, fontSize: 15 },
  step: { flexDirection: 'row', gap: 8 },
  stepBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  wTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  wLabel: { fontSize: 15 },
  wVal: { fontFamily: MONO, fontSize: 14, fontVariant: ['tabular-nums'] },
});
