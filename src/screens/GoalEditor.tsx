// Editor de metas (spec 009, sección 5; T5.2). Solo con el motor v2.

import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { DIAS } from '../agenda';
import type { Ctx } from '../ctx';
import type { GoalError, GoalInput, GoalScope } from '../domain/goals';
import { S } from '../i18n';
import { Btn, Label, MONO, Pill } from '../ui';

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const G = S.goal;
const INITIALS = S.dates.initials;
const KINDS = [['quantity', G.kinds.quantity], ['time', G.kinds.time], ['both', G.kinds.both]] as const;
const ERRORS: Record<GoalError, string> = G.errors;

export function GoalEditor({ c, target, onClose }: { c: Ctx; target: { id: string | null } | null; onClose: () => void }) {
  return (
    <Modal visible={!!target} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {target ? <Form key={target.id ?? 'new'} c={c} id={target.id} onClose={onClose} /> : null}
    </Modal>
  );
}

function Form({ c, id, onClose }: { c: Ctx; id: string | null; onClose: () => void }) {
  const t = c.theme;
  const ev = c.engine.events!;
  const goal = id ? ev.goalsAll().find((g) => g.id === id) ?? null : null;
  const series = useMemo(() => ev.linkableSeries(), [ev]);

  const [name, setName] = useState(goal?.name ?? '');
  const [kind, setKind] = useState<GoalInput['kind']>(goal?.kind ?? 'quantity');
  const [unit, setUnit] = useState(goal?.unit ?? '');
  const [targetText, setTargetText] = useState(goal?.version.target != null ? String(goal.version.target) : '');
  const [noTarget, setNoTarget] = useState(goal ? goal.version.target === null : false);
  const [period, setPeriod] = useState<'day' | 'week'>(goal?.version.period ?? 'day');
  const [days, setDays] = useState<number[]>(goal?.version.activeDays ?? [1, 2, 3, 4, 5]);
  const [links, setLinks] = useState<string[]>(goal?.links ?? []);
  const [reminder, setReminder] = useState<string | null>(goal?.reminder ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);

  const num = Number(targetText.replace(',', '.'));
  const input: GoalInput = {
    name, kind, unit, target: noTarget ? null : targetText.trim() === '' ? NaN : num, period, activeDays: days, links, reminder,
  };

  const run = (op: () => ReturnType<typeof ev.createGoal>, label: string) => {
    const r = c.runEvent(op, label);
    if (r.ok) onClose();
    else setErrors(r.error === 'not-found' ? [G.notFound] : r.error.map((e) => ERRORS[e]));
  };

  const save = () => {
    if (!goal) return run(() => ev.createGoal(input), G.created(name.trim()));
    if (ev.goalNeedsScope(goal.id, input)) return setSheet(true);
    run(() => ev.updateGoal(goal.id, input, 'fromToday'), G.saved(name.trim()));
  };
  const choose = (scope: GoalScope) => {
    setSheet(false);
    run(() => ev.updateGoal(goal!.id, input, scope), G.saved(name.trim()));
  };
  const archive = (archived: boolean) =>
    run(() => ev.setGoalArchived(goal!.id, archived), archived ? G.archived(goal!.name) : G.reactivated(goal!.name));
  const remove = () => {
    if (!goal) return;
    Alert.alert(G.deleteTitle, G.deleteBody(goal.name, goal.counts), [
      { text: S.common.cancel, style: 'cancel' },
      { text: S.common.delete, style: 'destructive', onPress: () => run(() => ev.deleteGoal(goal.id), G.deleted(goal.name)) },
    ]);
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const shiftReminder = (d: number) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(reminder ?? '');
    if (!m) return;
    const mins = (Number(m[1]) * 60 + Number(m[2]) + d + 1440) % 1440;
    setReminder(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
  };

  return (
    <KeyboardAvoidingView style={[st.root, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: c.insets.top + 12, paddingBottom: c.insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[st.h1, { color: t.fg }]}>{goal ? G.titleEdit : G.titleNew}</Text>

        <View style={{ gap: 6 }}>
          <Label t={t}>{G.name}</Label>
          <TextInput
            value={name} onChangeText={setName} maxLength={60} placeholder={G.namePlaceholder} placeholderTextColor={t.muted}
            accessibilityLabel={G.nameA11y} style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>{G.whatLabel}</Label>
          <View style={st.pills}>
            {KINDS.map(([k, label]) => <Pill key={k} t={t} label={label} selected={kind === k} onPress={() => setKind(k)} />)}
          </View>
          <Text style={[st.note, { color: t.muted }]}>
            {G.kindHints[kind]}
          </Text>
        </View>

        {kind !== 'time' ? (
          <View style={{ gap: 6 }}>
            <Label t={t}>{G.unit}</Label>
            <TextInput
              value={unit} onChangeText={setUnit} maxLength={20} placeholder={G.unitPlaceholder} placeholderTextColor={t.muted}
              accessibilityLabel={G.unit} style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
            />
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Label t={t}>{G.target}</Label>
          <View style={st.row}>
            <TextInput
              value={noTarget ? '' : targetText} onChangeText={(v) => { setTargetText(v); setNoTarget(false); }} editable={!noTarget}
              keyboardType="numeric" placeholder={kind === 'time' ? G.targetMinutes : G.targetNumber} placeholderTextColor={t.muted}
              accessibilityLabel={G.target} style={[st.input, st.num, { color: t.fg, backgroundColor: t.surface, borderColor: t.line, opacity: noTarget ? 0.5 : 1 }]}
            />
            <Pill t={t} label={G.noTarget} selected={noTarget} onPress={() => setNoTarget(!noTarget)} />
          </View>
          <View style={st.pills}>
            <Pill t={t} label={G.perDay} selected={period === 'day'} onPress={() => setPeriod('day')} />
            <Pill t={t} label={G.perWeek} selected={period === 'week'} onPress={() => setPeriod('week')} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>{G.days}</Label>
          <View style={st.pills}>
            {WEEK.map((d) => <Pill key={d} t={t} label={INITIALS[d]} a11y={DIAS[d]} selected={days.includes(d)} onPress={() => setDays(toggle(days, d))} />)}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>{kind === 'quantity' ? G.eventsOptional : G.events}</Label>
          <Text style={[st.note, { color: t.muted }]}>
            {kind === 'quantity' ? G.eventsHintQuantity : G.eventsHintTime}
          </Text>
          {series.map((s) => {
            const on = links.includes(s.id);
            return (
              <Pressable
                key={s.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={G.eventA11y(s.title, s.summary)}
                onPress={() => setLinks(toggle(links, s.id))}
                style={[st.option, { borderColor: on ? t.fg : t.line, backgroundColor: on ? t.surface2 : t.surface }]}
              >
                <Text style={[st.optionTitle, { color: t.fg }]}>{on ? '✓ ' : ''}{s.title}</Text>
                <Text style={[st.note, { color: t.muted }]}>{s.summary}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>{G.reminder}</Label>
          <View style={st.pills}>
            <Pill t={t} label={G.reminderNone} selected={reminder === null} onPress={() => setReminder(null)} />
            <Pill t={t} label={G.reminderAt} selected={reminder !== null} onPress={() => setReminder(reminder ?? '21:00')} />
          </View>
          {reminder !== null ? (
            <View style={st.row}>
              <Pill t={t} label="−15" a11y={G.reminderEarlier} onPress={() => shiftReminder(-15)} />
              <TextInput
                value={reminder} onChangeText={setReminder} maxLength={5} keyboardType="numbers-and-punctuation" accessibilityLabel={G.reminderTime}
                style={[st.input, st.num, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
              />
              <Pill t={t} label="+15" a11y={G.reminderLater} onPress={() => shiftReminder(15)} />
            </View>
          ) : null}
        </View>

        {errors.map((e) => <Text key={e} style={[st.note, { color: t.warn }]}>{e}</Text>)}

        <Btn t={t} label={goal ? S.common.save : G.create} onPress={save} />
        {goal ? (
          <>
            <Btn t={t} kind="ghost" label={goal.archived ? S.common.reactivate : S.common.archive} onPress={() => archive(!goal.archived)} />
            <Btn t={t} kind="ghost" label={G.deleteGoal} onPress={remove} />
          </>
        ) : null}
        <Btn t={t} kind="ghost" label={S.common.cancel} onPress={onClose} />
      </ScrollView>

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)} statusBarTranslucent>
        <View style={st.backdrop}>
          <View style={[st.sheet, { backgroundColor: t.surface, paddingBottom: c.insets.bottom + 16 }]}>
            <Text style={[st.sheetTitle, { color: t.fg }]}>{G.sheetTitle}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={G.scopeFromToday} onPress={() => choose('fromToday')} style={[st.option, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Text style={[st.optionTitle, { color: t.fg }]}>{G.scopeFromTodayTitle}</Text>
              <Text style={[st.note, { color: t.muted }]}>{G.scopeFromTodayHint}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={G.scopeAlways} onPress={() => choose('always')} style={[st.option, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Text style={[st.optionTitle, { color: t.warn }]}>{G.scopeAlways}</Text>
              <Text style={[st.note, { color: t.muted }]}>{G.scopeAlwaysHint}</Text>
            </Pressable>
            <Btn t={t} kind="ghost" label={S.common.cancel} onPress={() => setSheet(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  note: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  num: { flex: 1, fontFamily: MONO, fontSize: 18, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 48, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
});
