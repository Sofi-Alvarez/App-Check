import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fmtClock } from '../agenda';
import type { Ctx } from '../ctx';
import { S } from '../i18n';
import { Bar, Btn, Card, Label, MONO, Pill } from '../ui';

const T = S.timer;

export function TimerScreen({ c }: { c: Ctx }) {
  const { theme: t, timer, timerLeft } = c;
  const [custom, setCustom] = useState('');
  const running = timer.endAt > 0;
  const paused = !running && timerLeft > 0 && timerLeft < timer.total;
  const finished = !running && timer.total > 0 && timerLeft <= 0;
  const status = running
    ? timer.label || T.focus
    : paused
      ? T.pausedLabel(timer.label || T.focus)
      : finished
        ? T.finishedLabel(timer.label || T.focus)
        : T.none;
  const pct = timer.total ? (1 - timerLeft / timer.total) * 100 : 0;
  const customMin = Number(custom);
  const customOk = Number.isFinite(customMin) && customMin >= 1 && customMin <= 240;

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.h1, { color: t.fg }]}>{T.title}</Text>
      <Card t={t} style={{ gap: 14 }}>
        <Text style={[s.clock, { color: t.fg }]}>{fmtClock(timerLeft)}</Text>
        <Text style={[s.status, { color: t.muted }]}>{status}</Text>
        <Bar t={t} pct={pct} />
        <View style={s.row}>
          <Btn t={t} style={{ flex: 1 }} label={running ? T.pause : paused ? T.resume : T.start} onPress={c.toggleTimer} />
          <Btn t={t} style={{ flex: 1 }} kind="ghost" label={T.reset} onPress={c.resetTimer} />
        </View>
      </Card>

      <Card t={t}>
        <Label t={t}>{T.newOne}</Label>
        <View style={s.presets}>
          {[25, 45, 60].map((m) => (
            <Pill key={m} t={t} label={T.minutes(m)} onPress={() => c.startTimer(m, T.focus)} />
          ))}
        </View>
        <View style={s.row}>
          <TextInput
            accessibilityLabel={T.minutesA11y}
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={T.minutesPlaceholder}
            placeholderTextColor={t.muted}
            maxLength={3}
            style={[s.input, { backgroundColor: t.surface2, color: t.fg }]}
          />
          <Btn
            t={t}
            label={T.start}
            disabled={!customOk}
            onPress={() => {
              c.startTimer(customMin, T.focus);
              setCustom('');
            }}
          />
        </View>
        <Text style={[s.note, { color: t.muted }]}>
          {T.note}
        </Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  clock: { fontFamily: MONO, fontSize: 64, lineHeight: 70, fontVariant: ['tabular-nums'] },
  status: { fontSize: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { flex: 1, minHeight: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 18, fontFamily: MONO },
  note: { fontSize: 14, lineHeight: 19 },
});
