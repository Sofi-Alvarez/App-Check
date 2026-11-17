import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { DIAS, DayType, LIST_KEYS, LIST_LABEL, hm, parseISO } from '../agenda';
import type { Ctx } from '../ctx';
import { overlaps } from '../engine/legacy-ops';
import type { Scope, TaskDraft } from '../engine/types';
import { Btn, Label, MONO, Pill } from '../ui';

function parseHm(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && mins <= 24 * 60 ? mins : null;
}

function TimeField({
  c, label, text, onChange,
}: { c: Ctx; label: string; text: string; onChange: (v: string) => void }) {
  const t = c.theme;
  const cur = parseHm(text);
  const shift = (d: number) => {
    if (cur != null) onChange(hm(Math.max(0, Math.min(24 * 60, cur + d))));
  };
  return (
    <View style={s.timeBox}>
      <Label t={t}>{label}</Label>
      <TextInput
        value={text}
        onChangeText={onChange}
        placeholder="09:00"
        placeholderTextColor={t.muted}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        accessibilityLabel={label}
        style={[s.input, s.timeInput, { color: t.fg, backgroundColor: t.surface, borderColor: cur == null ? t.warn : t.line }]}
      />
      <View style={s.stepRow}>
        <Pill t={t} label="−15" onPress={() => shift(-15)} a11y={`${label} 15 minutos antes`} />
        <Pill t={t} label="+15" onPress={() => shift(15)} a11y={`${label} 15 minutos después`} />
      </View>
    </View>
  );
}

export function TaskEditor({
  c, draft, type, onClose,
}: { c: Ctx; draft: TaskDraft | null; type: DayType | null; onClose: () => void }) {
  // El formulario se monta nuevo cada vez que se abre, así que el estado inicial sale del borrador.
  return (
    <Modal visible={!!draft} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {draft ? <Form key={draft.id ?? 'new'} c={c} draft={draft} type={type} onClose={onClose} /> : null}
    </Modal>
  );
}

function Form({
  c, draft, type, onClose,
}: { c: Ctx; draft: TaskDraft; type: DayType | null; onClose: () => void }) {
  const t = c.theme;
  const isNew = draft.id == null;
  const [name, setName] = useState(draft.t);
  const [cat, setCat] = useState<string>(draft.c);
  const [sText, setSText] = useState(hm(draft.s));
  const [eText, setEText] = useState(hm(draft.e));
  const [note, setNote] = useState(draft.n);
  const [lists, setLists] = useState<DayType[]>(type ? [type] : []);

  const s = parseHm(sText);
  const e = parseHm(eText);
  const day = parseISO(c.viewIso);
  const dayName = `${DIAS[day.getDay()]} ${day.getDate()}`;

  let error = '';
  if (!name.trim()) error = 'Escribe un nombre.';
  else if (s == null || e == null) error = 'Escribe las horas como 09:30.';
  else if (e <= s) error = 'La hora de fin tiene que ser después de la de inicio.';

  // Avisos de superposición: con el día que estás viendo y con las listas elegidas para "Siempre".
  const warnings: string[] = [];
  if (!error && s != null && e != null) {
    const fmt = (b: { t: string; s: number; e: number }) => `${b.t} (${hm(b.s)} a ${hm(b.e)})`;
    const here = overlaps(c.blocks, s, e, draft.id);
    if (here.length) warnings.push(`Hoy se superpone con ${here.map(fmt).join(', ')}.`);
    for (const key of lists) {
      if (key === type) continue;
      const other = overlaps(c.engine.listFor(key), s, e, draft.id);
      if (other.length) warnings.push(`${LIST_LABEL[key]}: se superpone con ${other.map(fmt).join(', ')}.`);
    }
  }

  const build = (): TaskDraft => ({ id: draft.id, t: name, c: cat, s: s ?? 0, e: e ?? 0, n: note });
  const save = (scope: Scope) => {
    c.saveTask(build(), scope);
    onClose();
  };
  const toggleList = (k: DayType) => setLists((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const remove = () => {
    if (!draft.id) return;
    const id = draft.id;
    Alert.alert('Eliminar tarea', `¿Quitar "${draft.t}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: `Solo hoy`, onPress: () => { c.deleteTask(id, { kind: 'today' }); onClose(); } },
      {
        text: 'Siempre',
        style: 'destructive',
        onPress: () => { c.deleteTask(id, { kind: 'always', lists: type ? [type] : [] }); onClose(); },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={[s2.root, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s2.content, { paddingTop: c.insets.top + 12, paddingBottom: c.insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s2.h1, { color: t.fg }]}>{isNew ? 'Nueva tarea' : 'Editar tarea'}</Text>
        <Text style={[s2.note, { color: t.muted }]}>Estás en {dayName}.</Text>

        <View style={{ gap: 6 }}>
          <Label t={t}>Nombre</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej.: Revisar ofertas"
            placeholderTextColor={t.muted}
            accessibilityLabel="Nombre de la tarea"
            style={[s2.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
          />
        </View>

        <View style={s2.timeRow}>
          <TimeField c={c} label="Inicio" text={sText} onChange={setSText} />
          <TimeField c={c} label="Fin" text={eText} onChange={setEText} />
        </View>
        {s != null && e != null && e > s ? (
          <Text style={[s2.note, { color: t.muted }]}>Dura {e - s} min.</Text>
        ) : null}

        <View style={{ gap: 8 }}>
          <Label t={t}>Tipo</Label>
          <View style={s2.pills}>
            {c.engine.legend().map((k) => (
              <Pill key={k.id} t={t} label={k.name} selected={cat === k.id} onPress={() => setCat(k.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Label t={t}>Nota (opcional)</Label>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Qué tienes que hacer en este bloque"
            placeholderTextColor={t.muted}
            accessibilityLabel="Nota de la tarea"
            style={[s2.input, s2.noteInput, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>Si eliges “Siempre”, se aplica a</Label>
          <View style={s2.pills}>
            {LIST_KEYS.map((k) => (
              <Pill key={k} t={t} label={LIST_LABEL[k]} selected={lists.includes(k)} onPress={() => toggleList(k)} />
            ))}
          </View>
        </View>

        {error ? <Text style={[s2.note, { color: t.warn }]}>{error}</Text> : null}
        {warnings.map((w) => (
          <Text key={w} style={[s2.note, { color: t.warn }]}>{w} Puedes guardar igual.</Text>
        ))}

        <View style={s2.saveRow}>
          <Btn t={t} kind="ghost" label="Solo hoy" disabled={!!error} onPress={() => save({ kind: 'today' })} style={s2.flex} />
          <Btn
            t={t}
            label="Siempre"
            disabled={!!error || lists.length === 0}
            onPress={() => save({ kind: 'always', lists })}
            style={s2.flex}
          />
        </View>
        <Text style={[s2.note, { color: t.muted }]}>
          “Solo hoy” cambia únicamente {dayName}. “Siempre” cambia ese tipo de día en todas las semanas.
        </Text>

        {!isNew ? <Btn t={t} kind="ghost" label="Eliminar tarea" onPress={remove} /> : null}
        <Btn t={t} kind="ghost" label="Cancelar" onPress={onClose} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  timeBox: { flex: 1, gap: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  timeInput: { fontFamily: MONO, fontSize: 20, textAlign: 'center' },
  stepRow: { flexDirection: 'row', gap: 8 },
});
const s2 = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  note: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  noteInput: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
