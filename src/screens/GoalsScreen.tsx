import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { parseISO } from '../agenda';
import type { Ctx } from '../ctx';
import type { GoalView } from '../engine/types';
import { Bar, Btn, Card, Label, MONO } from '../ui';
import { GoalEditor } from './GoalEditor';
import { S } from '../i18n';

const G = S.goal;

const DAY_INITIALS = S.dates.initials;
/** "Cantidad · 5 comentarios por día · L M X V" */
function goalSummary(g: GoalView): string {
  const v = g.version;
  const kind = G.kinds[g.kind];
  const what = v.target == null ? G.summaryNoTarget : G.summaryTarget(v.target, g.kind === 'time' ? G.minutesUnit : g.unit);
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => v.activeDays.includes(d)).map((d) => DAY_INITIALS[d]).join(' ');
  return G.summary(kind, what, v.period === 'day', days);
}

export function GoalsScreen({ c }: { c: Ctx }) {
  const { theme: t, viewIso, day } = c;
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const all = c.engine.events.goalsAll();
  const d = parseISO(viewIso);
  const goals = c.engine.goalsFor(viewIso);
  // `c.rev` fuerza a releer el almacenamiento tras cada cambio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => c.engine.weekSummary(viewIso), [c.engine, viewIso, c.rev]);

  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]} showsVerticalScrollIndicator={false}>
      <Text style={[s.h1, { color: t.fg }]}>{G.screenTitle}</Text>
      <Text style={[s.sub, { color: t.muted }]}>
        {G.viewing(d.getDate(), d.getMonth() + 1)}
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
                  accessibilityLabel={G.subtract(g.label)}
                  onPress={() => c.changeCount(g.key, -1)}
                  style={[s.stepBtn, { backgroundColor: t.surface2 }]}
                >
                  <Text style={[s.stepText, { color: t.fg }]}>−</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={G.add(g.label)}
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
        <Label t={t}>{G.weekTotals}</Label>
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

      <Card t={t} style={{ gap: 10 }}>
        <Label t={t}>{G.yours}</Label>
        {all.length === 0 ? <Text style={[s.sub, { color: t.muted }]}>{G.none}</Text> : null}
        {[...all.filter((g) => !g.archived), ...all.filter((g) => g.archived)].map((g) => (
          <Pressable
            key={g.id} accessibilityRole="button" accessibilityLabel={G.editA11y(g.name)} onPress={() => setEditing({ id: g.id })}
            style={[s.item, { borderColor: t.line, opacity: g.archived ? 0.6 : 1 }]}
          >
            <Text style={[s.wLabel, { color: t.fg, fontWeight: '700' }]}>{g.name}{g.archived ? G.archivedTag : ''}</Text>
            <Text style={[s.sub, { color: t.muted }]}>{goalSummary(g)}</Text>
          </Pressable>
        ))}
        <Btn t={t} label={G.newButton} onPress={() => setEditing({ id: null })} />
      </Card>
      <GoalEditor c={c} target={editing} onClose={() => setEditing(null)} />
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
  item: { minHeight: 56, borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  wVal: { fontFamily: MONO, fontSize: 14, fontVariant: ['tabular-nums'] },
});
