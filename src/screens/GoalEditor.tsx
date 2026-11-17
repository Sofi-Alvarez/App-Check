// Editor de metas (spec 009, sección 5; T5.2). Solo con el motor v2.

import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { DIAS } from '../agenda';
import type { Ctx } from '../ctx';
import type { GoalError, GoalInput, GoalScope } from '../domain/goals';
import { Btn, Label, MONO, Pill } from '../ui';

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const KINDS = [['quantity', 'Cantidad'], ['time', 'Tiempo'], ['both', 'Cantidad y tiempo']] as const;

const ERRORS: Record<GoalError, string> = {
  'name-empty': 'Escribe un nombre.',
  'name-too-long': 'El nombre puede tener hasta 60 caracteres.',
  'name-taken': 'Ya hay una meta activa con ese nombre.',
  'unit-required': 'Escribe qué se cuenta (por ejemplo, "páginas").',
  'unit-too-long': 'La unidad puede tener hasta 20 caracteres.',
  'bad-target': 'El objetivo tiene que ser un número mayor que cero, o elige "Sin objetivo".',
  'no-days': 'Elige al menos un día.',
  'time-needs-event': 'Una meta de tiempo necesita al menos un evento asociado: mide los minutos de sus sesiones.',
  'bad-reminder': 'Escribe la hora del aviso como 21:30.',
};

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
    else setErrors(r.error === 'not-found' ? ['No se encontró la meta.'] : r.error.map((e) => ERRORS[e]));
  };

  const save = () => {
    if (!goal) return run(() => ev.createGoal(input), `Se creó la meta "${name.trim()}"`);
    if (ev.goalNeedsScope(goal.id, input)) return setSheet(true);
    run(() => ev.updateGoal(goal.id, input, 'fromToday'), `Se guardó la meta "${name.trim()}"`);
  };
  const choose = (scope: GoalScope) => {
    setSheet(false);
    run(() => ev.updateGoal(goal!.id, input, scope), `Se guardó la meta "${name.trim()}"`);
  };
  const archive = (archived: boolean) =>
    run(() => ev.setGoalArchived(goal!.id, archived), archived ? `Se archivó "${goal!.name}"` : `Se reactivó "${goal!.name}"`);
  const remove = () => {
    if (!goal) return;
    const extra = goal.counts ? ` Tiene ${goal.counts} ${goal.counts === 1 ? 'conteo registrado' : 'conteos registrados'}: seguirán en Datos y en el CSV con este nombre.` : '';
    Alert.alert('Eliminar meta', `¿Eliminar "${goal.name}"?${extra} Si solo quieres dejar de verla, mejor archívala.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => run(() => ev.deleteGoal(goal.id), `Se eliminó la meta "${goal.name}"`) },
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
        <Text style={[st.h1, { color: t.fg }]}>{goal ? 'Editar meta' : 'Nueva meta'}</Text>

        <View style={{ gap: 6 }}>
          <Label t={t}>Nombre</Label>
          <TextInput
            value={name} onChangeText={setName} maxLength={60} placeholder="Ej.: Páginas leídas" placeholderTextColor={t.muted}
            accessibilityLabel="Nombre de la meta" style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>Qué mide</Label>
          <View style={st.pills}>
            {KINDS.map(([k, label]) => <Pill key={k} t={t} label={label} selected={kind === k} onPress={() => setKind(k)} />)}
          </View>
          <Text style={[st.note, { color: t.muted }]}>
            {kind === 'quantity' ? 'Cuántas veces: lo sumas con el botón +.' : kind === 'time' ? 'Minutos de las sesiones de los eventos asociados.' : 'Cuántas veces y en cuánto tiempo (por ejemplo, 5 en 18 min).'}
          </Text>
        </View>

        {kind !== 'time' ? (
          <View style={{ gap: 6 }}>
            <Label t={t}>Unidad</Label>
            <TextInput
              value={unit} onChangeText={setUnit} maxLength={20} placeholder="Ej.: páginas" placeholderTextColor={t.muted}
              accessibilityLabel="Unidad" style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
            />
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Label t={t}>Objetivo</Label>
          <View style={st.row}>
            <TextInput
              value={noTarget ? '' : targetText} onChangeText={(v) => { setTargetText(v); setNoTarget(false); }} editable={!noTarget}
              keyboardType="numeric" placeholder={kind === 'time' ? 'minutos' : 'número'} placeholderTextColor={t.muted}
              accessibilityLabel="Objetivo" style={[st.input, st.num, { color: t.fg, backgroundColor: t.surface, borderColor: t.line, opacity: noTarget ? 0.5 : 1 }]}
            />
            <Pill t={t} label="Sin objetivo" selected={noTarget} onPress={() => setNoTarget(!noTarget)} />
          </View>
          <View style={st.pills}>
            <Pill t={t} label="Por día" selected={period === 'day'} onPress={() => setPeriod('day')} />
            <Pill t={t} label="Por semana" selected={period === 'week'} onPress={() => setPeriod('week')} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>Días en que aplica</Label>
          <View style={st.pills}>
            {WEEK.map((d) => <Pill key={d} t={t} label={INITIALS[d]} a11y={DIAS[d]} selected={days.includes(d)} onPress={() => setDays(toggle(days, d))} />)}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>Eventos asociados{kind === 'quantity' ? ' (opcional)' : ''}</Label>
          <Text style={[st.note, { color: t.muted }]}>
            {kind === 'quantity' ? 'Si la asocias a un evento, su contador aparece dentro del evento mientras lo haces.' : 'Se suman los minutos de sus sesiones.'}
          </Text>
          {series.map((s) => {
            const on = links.includes(s.id);
            return (
              <Pressable
                key={s.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${s.title}, ${s.summary}`}
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
          <Label t={t}>Aviso propio</Label>
          <View style={st.pills}>
            <Pill t={t} label="Sin aviso" selected={reminder === null} onPress={() => setReminder(null)} />
            <Pill t={t} label="A una hora" selected={reminder !== null} onPress={() => setReminder(reminder ?? '21:00')} />
          </View>
          {reminder !== null ? (
            <View style={st.row}>
              <Pill t={t} label="−15" a11y="Aviso 15 minutos antes" onPress={() => shiftReminder(-15)} />
              <TextInput
                value={reminder} onChangeText={setReminder} maxLength={5} keyboardType="numbers-and-punctuation" accessibilityLabel="Hora del aviso"
                style={[st.input, st.num, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
              />
              <Pill t={t} label="+15" a11y="Aviso 15 minutos después" onPress={() => shiftReminder(15)} />
            </View>
          ) : null}
        </View>

        {errors.map((e) => <Text key={e} style={[st.note, { color: t.warn }]}>{e}</Text>)}

        <Btn t={t} label={goal ? 'Guardar' : 'Crear meta'} onPress={save} />
        {goal ? (
          <>
            <Btn t={t} kind="ghost" label={goal.archived ? 'Reactivar' : 'Archivar'} onPress={() => archive(!goal.archived)} />
            <Btn t={t} kind="ghost" label="Eliminar meta" onPress={remove} />
          </>
        ) : null}
        <Btn t={t} kind="ghost" label="Cancelar" onPress={onClose} />
      </ScrollView>

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)} statusBarTranslucent>
        <View style={st.backdrop}>
          <View style={[st.sheet, { backgroundColor: t.surface, paddingBottom: c.insets.bottom + 16 }]}>
            <Text style={[st.sheetTitle, { color: t.fg }]}>¿Desde cuándo vale el cambio?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="A partir de hoy" onPress={() => choose('fromToday')} style={[st.option, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Text style={[st.optionTitle, { color: t.fg }]}>A partir de hoy (sugerida)</Text>
              <Text style={[st.note, { color: t.muted }]}>Los días anteriores se siguen comparando con el objetivo que tenían.</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Siempre, incluso los días pasados" onPress={() => choose('always')} style={[st.option, { borderColor: t.line, backgroundColor: t.bg }]}>
              <Text style={[st.optionTitle, { color: t.warn }]}>Siempre, incluso los días pasados</Text>
              <Text style={[st.note, { color: t.muted }]}>Reescribe el objetivo de todo el historial: los porcentajes de días pasados van a cambiar.</Text>
            </Pressable>
            <Btn t={t} kind="ghost" label="Cancelar" onPress={() => setSheet(false)} />
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
