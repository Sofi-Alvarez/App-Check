import React, { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { DIAS, MESES, hm, iso, mondayOf, addDays, parseISO } from '../agenda';
import type { Ctx } from '../ctx';
import { Session, buildSessions, eventsToCsv, minutesLabel } from '../sessions';
import { loadAllLog } from '../store';
import { S } from '../i18n';
import { Btn, Card, Label, MONO } from '../ui';

const D = S.data;

const ENDED: Record<Session['endedBy'], string> = S.data.ended;

export function DataScreen({ c }: { c: Ctx }) {
  const { theme: t, viewIso } = c;
  const nowMs = c.now.getTime();
  // Se relee el almacenamiento al cambiar de sesión, de día o tras un cambio (`rev`), no cada segundo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => loadAllLog(), [c.rev, c.active, viewIso]);
  const { sessions, loose } = useMemo(() => buildSessions(events, nowMs), [events, nowMs]);

  const mon = mondayOf(parseISO(viewIso));
  // Con el modelo nuevo puede haber sesiones el fin de semana: la semana tiene 7 días.
  const days = (c.engine.events ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4]).map((i) => iso(addDays(mon, i)));

  // Nombre de cada meta en los conteos (T5.4): el actual si la meta existe; si no (eliminada), el último nombre que
  // quedó guardado en el registro; si tampoco, el id.
  const savedNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of events) if (e.goal && e.goalName) m[e.goal] = e.goalName;
    return m;
  }, [events]);
  const kinds = useMemo(
    () => Object.fromEntries((c.engine.events?.goalsAll() ?? []).map((g) => [g.id, g.kind])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `c.rev` relee las metas después de un cambio
    [c.engine, c.rev],
  );
  const goalLabel = (k: string) => {
    const current = c.engine.goalName(k);
    return current !== k ? current : savedNames[k] ?? k;
  };
  const week = sessions.filter((x) => days.includes(x.day));
  const valid = week.filter((x) => x.endedBy !== 'auto_close' && x.endedBy !== 'open');
  const totalMs = valid.reduce((a, x) => a + x.activeMs, 0);

  const exportCsv = async () => {
    try {
      await Share.share({ title: D.shareTitle, message: eventsToCsv(loadAllLog()) });
    } catch {}
  };

  return (
    <ScrollView contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]} showsVerticalScrollIndicator={false}>
      <Text style={[s.h1, { color: t.fg }]}>{D.title}</Text>
      <Text style={[s.sub, { color: t.muted }]}>
        {D.week(mon.getDate(), MESES[mon.getMonth()])}
      </Text>

      <Card t={t}>
        <Label t={t}>{D.summary}</Label>
        <View style={s.sum}>
          <View style={s.sumItem}>
            <Text style={[s.big, { color: t.fg }]}>{week.length}</Text>
            <Text style={[s.sumLabel, { color: t.muted }]}>{D.sessions}</Text>
          </View>
          <View style={s.sumItem}>
            <Text style={[s.big, { color: t.fg }]}>{minutesLabel(totalMs)}</Text>
            <Text style={[s.sumLabel, { color: t.muted }]}>{D.realWork}</Text>
          </View>
        </View>
        <Text style={[s.note, { color: t.muted }]}>
          {D.savedTotal(events.length)}
        </Text>
        <Btn t={t} label={D.exportCsv} onPress={exportCsv} disabled={events.length === 0} />
        {loose.length > 0 ? (
          <Text style={[s.note, { color: t.muted }]}>
            {D.loose(loose.length)}
          </Text>
        ) : null}
      </Card>

      {days.map((day) => {
        const list = week.filter((x) => x.day === day);
        const d = parseISO(day);
        return (
          <View key={day} style={{ gap: 8 }}>
            <Label t={t}>{DIAS[d.getDay()]} {d.getDate()}</Label>
            {list.length === 0 ? (
              <Text style={[s.note, { color: t.muted }]}>{D.noSessions}</Text>
            ) : (
              list.map((x) => {
                const planMin = x.planS >= 0 ? x.planE - x.planS : null;
                const realMin = Math.round(x.activeMs / 60000);
                const counts = Object.entries(x.counts).filter(([, v]) => v !== 0);
                return (
                  <Card key={x.startTs} t={t} style={{ gap: 4 }}>
                    <Text style={[s.rowTitle, { color: t.fg }]}>{x.title}</Text>
                    <Text style={[s.mono, { color: t.muted }]}>
                      {new Date(x.startTs).toTimeString().slice(0, 5)}
                      {x.endTs ? D.to(new Date(x.endTs).toTimeString().slice(0, 5)) : ''}
                      {x.planS >= 0 ? D.plan(hm(x.planS), hm(x.planE)) : ''}
                    </Text>
                    <Text style={[s.note, { color: t.fg }]}>
                      {D.realMinutes(realMin)}{planMin != null ? D.ofPlanned(planMin) : ''}
                      {x.pausedMs > 0 ? D.paused(Math.round(x.pausedMs / 60000)) : ''}
                    </Text>
                    {counts.length > 0 ? (
                      <Text style={[s.note, { color: t.fg }]}>
                        {counts.map(([k, v]) => `${goalLabel(k)}: ${v}${kinds[k] === 'both' && x.endedBy !== 'open' ? D.countIn(realMin) : ''}`).join('  ·  ')}
                      </Text>
                    ) : null}
                    <Text style={[s.note, { color: x.endedBy === 'auto_close' ? t.warn : t.muted }]}>{ENDED[x.endedBy]}</Text>
                  </Card>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 19 },
  sum: { flexDirection: 'row', gap: 24 },
  sumItem: { gap: 2 },
  big: { fontFamily: MONO, fontSize: 28, fontVariant: ['tabular-nums'] },
  sumLabel: { fontSize: 13 },
  note: { fontSize: 14, lineHeight: 20 },
  rowTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  mono: { fontFamily: MONO, fontSize: 13 },
});
