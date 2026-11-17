import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fmtClock } from '../agenda';
import type { Ctx } from '../ctx';
import { Bar, Btn, Card, Label, MONO, Pill } from '../ui';

export function TimerScreen({ c }: { c: Ctx }) {
  const { theme: t, timer, timerLeft } = c;
  const [custom, setCustom] = useState('');
  const running = timer.endAt > 0;
  const paused = !running && timerLeft > 0 && timerLeft < timer.total;
  const finished = !running && timer.total > 0 && timerLeft <= 0;
  const status = running
    ? timer.label || 'Enfoque'
    : paused
      ? `En pausa · ${timer.label || 'Enfoque'}`
      : finished
        ? `Terminado · ${timer.label || 'Enfoque'}`
        : 'Sin timer activo';
  const pct = timer.total ? (1 - timerLeft / timer.total) * 100 : 0;
  const customMin = Number(custom);
  const customOk = Number.isFinite(customMin) && customMin >= 1 && customMin <= 240;

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.h1, { color: t.fg }]}>Timer</Text>
      <Card t={t} style={{ gap: 14 }}>
        <Text style={[s.clock, { color: t.fg }]}>{fmtClock(timerLeft)}</Text>
        <Text style={[s.status, { color: t.muted }]}>{status}</Text>
        <Bar t={t} pct={pct} />
        <View style={s.row}>
          <Btn t={t} style={{ flex: 1 }} label={running ? 'Pausar' : paused ? 'Seguir' : 'Iniciar'} onPress={c.toggleTimer} />
          <Btn t={t} style={{ flex: 1 }} kind="ghost" label="Reiniciar" onPress={c.resetTimer} />
        </View>
      </Card>

      <Card t={t}>
        <Label t={t}>Iniciar uno nuevo</Label>
        <View style={s.presets}>
          {[25, 45, 60].map((m) => (
            <Pill key={m} t={t} label={`${m} min`} onPress={() => c.startTimer(m, 'Enfoque')} />
          ))}
        </View>
        <View style={s.row}>
          <TextInput
            accessibilityLabel="Minutos del timer"
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="Minutos"
            placeholderTextColor={t.muted}
            maxLength={3}
            style={[s.input, { backgroundColor: t.surface2, color: t.fg }]}
          />
          <Btn
            t={t}
            label="Iniciar"
            disabled={!customOk}
            onPress={() => {
              c.startTimer(customMin, 'Enfoque');
              setCustom('');
            }}
          />
        </View>
        <Text style={[s.note, { color: t.muted }]}>
          Al terminar suena un aviso aunque la app esté cerrada. En la pestaña Agenda cada bloque tiene su propio botón de timer.
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
