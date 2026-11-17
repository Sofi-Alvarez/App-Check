// Editor de eventos de la fase 3 (spec 009, secciones 3.2 a 3.6). Solo se usa con el motor v2; con el formato viejo
// sigue el editor anterior (`TaskEditor`).

import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { DIAS, MESES, hm, iso, parseISO } from '../agenda';
import type { Ctx } from '../ctx';
import { addDaysISO } from '../domain/dates';
import { describeRule, scopeHint, scopeLabel } from '../domain/describe';
import type { EditScope, EventPatch, OpError } from '../domain/events';
import type { SeriesError } from '../domain/recurrence';
import type { Rule } from '../domain/types';
import { overlaps } from '../engine/legacy-ops';
import { colorFor } from '../theme';
import { Btn, Label, MONO, Pill } from '../ui';

/** Qué abrir: un evento existente (en la fecha que se estaba mirando) o uno nuevo. */
export interface EditTarget {
  id: string | null;
  refDate: string;
  /** Hora sugerida para un evento nuevo, en minutos. */
  start?: number;
}

type RepeatMode = 'none' | 'daily' | 'weekly' | 'everyN';
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function parseHm(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && mins <= 24 * 60 ? mins : null;
}

const longDate = (date: string) => {
  const d = parseISO(date);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

const ERRORS: Record<SeriesError, string> = {
  'title-empty': 'Escribe un nombre.',
  'time-out-of-day': 'Las horas tienen que estar dentro del mismo día.',
  'time-order': 'La hora de fin tiene que ser después de la de inicio.',
  'too-short': 'El evento tiene que durar al menos 5 minutos.',
  'bad-start-date': 'La fecha no es válida.',
  'bad-end-date': 'La fecha de fin no es válida.',
  'end-before-start': 'La fecha de fin tiene que ser posterior al inicio.',
  'no-weekdays': 'Elige al menos un día de la semana.',
  'bad-weekday': 'Revisa los días de la semana elegidos.',
  'bad-every-weeks': 'Elige cada cuántas semanas se repite.',
};
const opErrorText = (e: OpError) =>
  e.kind === 'invalid' ? e.errors.map((x) => ERRORS[x]).join(' ')
    : e.kind === 'scope-not-allowed' ? 'Si cambias la repetición, no se puede elegir "Solo hoy".'
      : 'No se encontró el evento. Cierra y vuelve a abrirlo.';

export function EventEditor({ c, target, onClose }: { c: Ctx; target: EditTarget | null; onClose: () => void }) {
  return (
    <Modal visible={!!target} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {target ? <Form key={`${target.id ?? 'new'}-${target.refDate}`} c={c} target={target} onClose={onClose} /> : null}
    </Modal>
  );
}

function Form({ c, target, onClose }: { c: Ctx; target: EditTarget; onClose: () => void }) {
  const t = c.theme;
  const ev = c.engine.events!;
  const series = target.id ? ev.series(target.id) : null;
  // Lo que se ve ese día (con los cambios propios de ese día, si los hay).
  const occ = target.id ? (c.engine.blocksFor(target.refDate) ?? []).find((b) => b.id === target.id) : undefined;
  const isNew = !series;
  const categories = useMemo(() => ev.categories(), [ev]);

  const initStart = occ?.s ?? series?.startMin ?? target.start ?? 9 * 60;
  const initEnd = occ?.e ?? series?.endMin ?? Math.min(24 * 60, initStart + 30);
  const [name, setName] = useState(occ?.t ?? series?.title ?? '');
  const [cat, setCat] = useState(occ?.c ?? series?.categoryId ?? categories[0]?.id ?? 'work');
  const [sText, setSText] = useState(hm(initStart));
  const [eText, setEText] = useState(hm(initEnd));
  const [note, setNote] = useState(occ?.n ?? series?.note ?? '');
  const [date, setDate] = useState(series && !series.rule ? series.startDate : target.refDate);

  const r = series?.rule ?? null;
  const [mode, setMode] = useState<RepeatMode>(!r ? 'none' : r.weekdays.length === 7 && r.everyWeeks === 1 ? 'daily' : r.everyWeeks === 1 ? 'weekly' : 'everyN');
  const [days, setDays] = useState<number[]>(r?.weekdays ?? [parseISO(target.refDate).getDay()]);
  const [everyN, setEveryN] = useState(r && r.everyWeeks > 1 ? r.everyWeeks : 2);
  const [endDate, setEndDate] = useState<string | null>(series?.endDate ?? null);
  const [sheet, setSheet] = useState<null | { action: 'edit' | 'delete'; scopes: EditScope[]; patch?: EventPatch }>(null);
  const [error, setError] = useState('');

  const s = parseHm(sText);
  const e = parseHm(eText);
  const rule: Rule | null = mode === 'none' ? null : mode === 'daily' ? { weekdays: [0, 1, 2, 3, 4, 5, 6], everyWeeks: 1 } : { weekdays: days, everyWeeks: mode === 'everyN' ? everyN : 1 };
  const startDate = series?.rule ? series.startDate : date;
  const patch: EventPatch = { title: name, categoryId: cat, startMin: s ?? 0, endMin: e ?? 0, note, rule, endDate: rule ? endDate : null, date };

  let formError = '';
  if (!name.trim()) formError = ERRORS['title-empty'];
  else if (s == null || e == null) formError = 'Escribe las horas como 09:30.';
  else if (e <= s) formError = ERRORS['time-order'];
  else if (e - s < 5) formError = ERRORS['too-short'];
  else if (rule && rule.weekdays.length === 0) formError = ERRORS['no-weekdays'];

  const dayBlocks = c.engine.blocksFor(series?.rule ? target.refDate : date) ?? [];
  const clash = !formError && s != null && e != null ? overlaps(dayBlocks, s, e, target.id) : [];

  const run = (op: () => ReturnType<typeof ev.create>, label: string) => {
    const res = c.runEvent(op, label);
    if (res.ok) onClose();
    else setError(opErrorText(res.error));
  };

  const save = () => {
    if (formError) return;
    if (isNew) return run(() => ev.create(date, patch), `Se creó "${name.trim()}"`);
    const scopes = ev.allowedScopes(series!.id, target.refDate, patch);
    if (scopes.length === 1) return run(() => ev.edit(series!.id, target.refDate, patch, scopes[0]), `Se guardó "${name.trim()}"`);
    setSheet({ action: 'edit', scopes, patch });
  };

  const remove = () => {
    if (!series) return;
    if (c.active && (c.active.bid === series.id)) {
      Alert.alert('Sesión en curso', 'Hay una sesión en curso en este evento. Termínala primero.');
      return;
    }
    setSheet({ action: 'delete', scopes: ev.allowedDeleteScopes(series.id, target.refDate) });
  };

  const choose = (scope: EditScope) => {
    const sh = sheet!;
    setSheet(null);
    if (sh.action === 'edit') run(() => ev.edit(series!.id, target.refDate, sh.patch!, scope), `Se guardó "${name.trim()}"`);
    else run(() => ev.remove(series!.id, target.refDate, scope), `Se eliminó "${series!.title}"`);
  };

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const today = iso(new Date());

  return (
    <KeyboardAvoidingView style={[st.root, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: c.insets.top + 12, paddingBottom: c.insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[st.h1, { color: t.fg }]}>{isNew ? 'Nuevo evento' : 'Editar evento'}</Text>
        {!isNew && series?.rule ? <Text style={[st.note, { color: t.muted }]}>Estás en {longDate(target.refDate)}.</Text> : null}

        <View style={{ gap: 6 }}>
          <Label t={t}>Nombre</Label>
          <TextInput
            value={name} onChangeText={setName} placeholder="Ej.: Lectura" placeholderTextColor={t.muted} maxLength={80}
            accessibilityLabel="Nombre del evento"
            style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>Categoría</Label>
          <View style={st.pills}>
            {categories.map((k) => (
              <Pressable
                key={k.id} accessibilityRole="button" accessibilityLabel={k.name} accessibilityState={{ selected: cat === k.id }}
                onPress={() => setCat(k.id)}
                style={[st.catPill, { borderColor: cat === k.id ? t.fg : t.line, backgroundColor: cat === k.id ? t.surface2 : t.surface }]}
              >
                <View style={[st.dot, { backgroundColor: colorFor(t, k.color) }]} />
                <Text style={[st.pillText, { color: t.fg }]}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!series?.rule ? (
          <View style={{ gap: 8 }}>
            <Label t={t}>{mode === 'none' ? 'Día' : 'Desde'}</Label>
            <View style={st.stepper}>
              <Pill t={t} label="‹" a11y="Día anterior" onPress={() => setDate(addDaysISO(date, -1))} />
              <Text style={[st.stepText, { color: t.fg }]}>{longDate(date)}</Text>
              <Pill t={t} label="›" a11y="Día siguiente" onPress={() => setDate(addDaysISO(date, 1))} />
            </View>
          </View>
        ) : null}

        <View style={st.timeRow}>
          <TimeField c={c} label="Inicio" text={sText} onChange={setSText} />
          <TimeField c={c} label="Fin" text={eText} onChange={setEText} />
        </View>
        {s != null && e != null && e > s ? <Text style={[st.note, { color: t.muted }]}>Dura {e - s} min.</Text> : null}

        <View style={{ gap: 6 }}>
          <Label t={t}>Nota</Label>
          <TextInput
            value={note} onChangeText={setNote} multiline placeholder="Opcional" placeholderTextColor={t.muted}
            accessibilityLabel="Nota" style={[st.input, st.noteInput, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Label t={t}>Repetición</Label>
          <View style={st.pills}>
            {([['none', 'No se repite'], ['daily', 'Todos los días'], ['weekly', 'Días de la semana'], ['everyN', 'Cada N semanas']] as const).map(([k, label]) => (
              <Pill key={k} t={t} label={label} selected={mode === k} onPress={() => setMode(k)} />
            ))}
          </View>
          {mode === 'weekly' || mode === 'everyN' ? (
            <View style={st.pills}>
              {WEEK.map((d) => (
                <Pill key={d} t={t} label={INITIALS[d]} a11y={DIAS[d]} selected={days.includes(d)} onPress={() => toggleDay(d)} />
              ))}
            </View>
          ) : null}
          {mode === 'everyN' ? (
            <View style={st.stepper}>
              <Pill t={t} label="−" a11y="Menos semanas" onPress={() => setEveryN(Math.max(2, everyN - 1))} />
              <Text style={[st.stepText, { color: t.fg }]}>Cada {everyN} semanas</Text>
              <Pill t={t} label="+" a11y="Más semanas" onPress={() => setEveryN(Math.min(8, everyN + 1))} />
            </View>
          ) : null}
          {mode !== 'none' ? (
            <>
              <Label t={t}>Termina</Label>
              <View style={st.pills}>
                <Pill t={t} label="Nunca" selected={endDate === null} onPress={() => setEndDate(null)} />
                <Pill t={t} label="En una fecha" selected={endDate !== null} onPress={() => setEndDate(endDate ?? addDaysISO(startDate, 28))} />
              </View>
              {endDate !== null ? (
                <View style={st.stepper}>
                  <Pill t={t} label="‹" a11y="Una semana antes" onPress={() => setEndDate(addDaysISO(endDate, -7))} />
                  <Text style={[st.stepText, { color: t.fg }]}>{longDate(endDate)}</Text>
                  <Pill t={t} label="›" a11y="Una semana después" onPress={() => setEndDate(addDaysISO(endDate, 7))} />
                </View>
              ) : null}
            </>
          ) : null}
          {!formError ? <Text style={[st.note, { color: t.fg }]}>{describeRule(rule, startDate, rule ? endDate : null)}.</Text> : null}
        </View>

        {formError ? <Text style={[st.note, { color: t.warn }]}>{formError}</Text> : null}
        {error ? <Text style={[st.note, { color: t.warn }]}>{error}</Text> : null}
        {clash.length ? (
          <Text style={[st.note, { color: t.warn }]}>
            Se superpone con {clash.map((b) => `${b.t} (${hm(b.s)} a ${hm(b.e)})`).join(', ')}. Puedes guardar igual.
          </Text>
        ) : null}

        <Btn t={t} label="Guardar" disabled={!!formError} onPress={save} />
        {!isNew ? <Btn t={t} kind="ghost" label="Eliminar evento" onPress={remove} /> : null}
        <Btn t={t} kind="ghost" label="Cancelar" onPress={onClose} />
      </ScrollView>

      <ScopeSheet
        c={c} visible={!!sheet} action={sheet?.action ?? 'edit'} scopes={sheet?.scopes ?? []} refDate={target.refDate} today={today}
        info={sheet && series ? infoLines(c, series.id, target.refDate, sheet.action) : {}}
        onChoose={choose} onCancel={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

/** Líneas informativas por alcance: días con cambios propios (editar), o días afectados y sesiones (eliminar). */
function infoLines(c: Ctx, id: string, refDate: string, action: 'edit' | 'delete'): Partial<Record<EditScope | 'all', string>> {
  const ev = c.engine.events!;
  if (action === 'edit') {
    const all = ev.modifiedDays(id, null);
    const from = ev.modifiedDays(id, refDate);
    return {
      always: all ? `${all} ${all === 1 ? 'día tiene' : 'días tienen'} cambios propios y los mantienen.` : undefined,
      fromToday: from ? `${from} ${from === 1 ? 'día tiene' : 'días tienen'} cambios propios y los mantienen.` : undefined,
    };
  }
  const sessions = ev.sessionsFor(id);
  const count = (sc: EditScope) => {
    const n = ev.daysAffected(id, refDate, sc);
    return n === null ? undefined : `Se quitará de ${n} ${n === 1 ? 'día' : 'días'}.`;
  };
  return {
    today: count('today'),
    fromToday: count('fromToday'),
    always: count('always'),
    all: sessions ? `Tiene ${sessions} ${sessions === 1 ? 'sesión registrada' : 'sesiones registradas'}. Seguirán en Datos y en el CSV.` : undefined,
  };
}

/** Hoja de alcance (spec 009, 3.4 y 3.5): sin opción preseleccionada, con explicación de una línea por opción. */
function ScopeSheet({
  c, visible, action, scopes, refDate, today, info, onChoose, onCancel,
}: {
  c: Ctx; visible: boolean; action: 'edit' | 'delete'; scopes: EditScope[]; refDate: string; today: string;
  info: Partial<Record<EditScope | 'all', string>>; onChoose: (s: EditScope) => void; onCancel: () => void;
}) {
  const t = c.theme;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={st.backdrop}>
        <View style={[st.sheet, { backgroundColor: t.surface, paddingBottom: c.insets.bottom + 16 }]}>
          <Text style={[st.sheetTitle, { color: t.fg }]}>{action === 'edit' ? '¿Qué días cambia?' : '¿De qué días lo quitas?'}</Text>
          {info.all ? <Text style={[st.note, { color: t.muted }]}>{info.all}</Text> : null}
          {scopes.map((sc) => (
            <Pressable
              key={sc} accessibilityRole="button" accessibilityLabel={`${scopeLabel(sc, refDate, today)}. ${scopeHint(sc, action)}`}
              onPress={() => onChoose(sc)}
              style={[st.option, { borderColor: t.line, backgroundColor: t.bg }]}
            >
              <Text style={[st.optionTitle, { color: action === 'delete' && sc === 'always' ? t.warn : t.fg }]}>{scopeLabel(sc, refDate, today)}</Text>
              <Text style={[st.note, { color: t.muted }]}>{scopeHint(sc, action)}</Text>
              {info[sc] ? <Text style={[st.note, { color: t.muted }]}>{info[sc]}</Text> : null}
            </Pressable>
          ))}
          {action === 'edit' && !scopes.includes('today') ? (
            <Text style={[st.note, { color: t.muted }]}>Cambiaste la repetición: eso no se puede aplicar a un solo día.</Text>
          ) : null}
          <Btn t={t} kind="ghost" label="Cancelar" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function TimeField({ c, label, text, onChange }: { c: Ctx; label: string; text: string; onChange: (v: string) => void }) {
  const t = c.theme;
  const cur = parseHm(text);
  const shift = (d: number) => {
    if (cur != null) onChange(hm(Math.max(0, Math.min(24 * 60, cur + d))));
  };
  return (
    <View style={st.timeBox}>
      <Label t={t}>{label}</Label>
      <TextInput
        value={text} onChangeText={onChange} placeholder="09:00" placeholderTextColor={t.muted}
        keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel={label}
        style={[st.input, st.timeInput, { color: t.fg, backgroundColor: t.surface, borderColor: cur == null ? t.warn : t.line }]}
      />
      <View style={st.stepRow}>
        <Pill t={t} label="−15" onPress={() => shift(-15)} a11y={`${label} 15 minutos antes`} />
        <Pill t={t} label="+15" onPress={() => shift(15)} a11y={`${label} 15 minutos después`} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  note: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  noteInput: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeBox: { flex: 1, gap: 6 },
  timeInput: { fontFamily: MONO, fontSize: 20, textAlign: 'center' },
  stepRow: { flexDirection: 'row', gap: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPill: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1 },
  pillText: { fontSize: 15, fontWeight: '600' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepText: { flex: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  option: { minHeight: 48, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  optionTitle: { fontSize: 17, fontWeight: '700' },
});
