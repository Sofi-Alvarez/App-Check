import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { hm } from '../agenda';
import type { MarginPlan } from '../schedule';
import { MIN_TASK } from '../schedule';
import type { Theme } from '../theme';
import { Btn, MONO } from '../ui';

interface Props {
  t: Theme;
  plan: MarginPlan | null;
  bottomInset: number;
  onApply: (targetId: string) => void;
  onSkip: () => void;
}

export function MarginPrompt({ t, plan, bottomInset, onApply, onSkip }: Props) {
  return (
    <Modal visible={!!plan} transparent animationType="slide" onRequestClose={onSkip} statusBarTranslucent>
      {plan ? <Sheet key={`${plan.day}:${plan.aId}:${plan.slack}`} t={t} plan={plan} bottomInset={bottomInset} onApply={onApply} onSkip={onSkip} /> : null}
    </Modal>
  );
}

function Sheet({ t, plan, bottomInset, onApply, onSkip }: Props & { plan: MarginPlan }) {
  const [picked, setPicked] = useState<string | null>(plan.defaultId);
  const early = plan.slack > 0;
  const min = Math.abs(plan.slack);
  const chosen = plan.options.find((o) => o.id === picked);

  return (
    <View style={s.backdrop}>
      <View style={[s.sheet, { backgroundColor: t.surface, paddingBottom: bottomInset + 16 }]}>
        <Text style={[s.title, { color: t.fg }]}>
          {early ? `Terminaste ${min} min antes` : `Te pasaste ${min} min`}
        </Text>
        <Text style={[s.note, { color: t.muted }]}>
          {early
            ? `${plan.aTitle} terminó antes de lo planificado. ¿A qué tarea de hoy pasan esos minutos?`
            : `${plan.aTitle} duró más de lo planificado. ¿De qué tarea de hoy se descuentan?`}
        </Text>

        <ScrollView style={s.list} contentContainerStyle={{ gap: 8 }}>
          {plan.options.map((o) => {
            const on = o.id === picked;
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: !o.ok }}
                accessibilityLabel={`${o.title}, ${hm(o.newS)} a ${hm(o.newE)}`}
                disabled={!o.ok}
                onPress={() => setPicked(o.id)}
                style={[
                  s.opt,
                  { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.now : t.surface, opacity: o.ok ? 1 : 0.45 },
                ]}
              >
                <Text style={[s.optTitle, { color: t.fg }]}>{o.title}</Text>
                <Text style={[s.optTime, { color: t.muted }]}>
                  {hm(o.newS)} a {hm(o.newE)}  ·  antes {hm(o.oldS)} a {hm(o.oldE)}
                </Text>
                {!o.ok ? <Text style={[s.optTime, { color: t.warn }]}>Quedaría de menos de {MIN_TASK} min.</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <Btn
          t={t}
          label={chosen ? `Aplicar a ${chosen.title}` : 'Aplicar'}
          disabled={!chosen}
          onPress={() => chosen && onApply(chosen.id)}
        />
        <Btn t={t} kind="ghost" label="Dejar como está" onPress={onSkip} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12, maxHeight: '85%' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  note: { fontSize: 15, lineHeight: 21 },
  list: { flexGrow: 0 },
  opt: { borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 2, minHeight: 56, justifyContent: 'center' },
  optTitle: { fontSize: 16, fontWeight: '700' },
  optTime: { fontFamily: MONO, fontSize: 13 },
});
