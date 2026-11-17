// Ajustes → Categorías (spec 009, sección 4; T4.3). Solo con el motor v2. Se abre como pantalla completa.

import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Ctx } from '../ctx';
import { COLOR_TOKENS } from '../domain/categories';
import type { CategoryOpError } from '../domain/categories';
import type { ColorToken } from '../domain/types';
import { colorFor } from '../theme';
import { Btn, Label, Pill } from '../ui';

const COLOR_NAMES: Record<ColorToken, string> = {
  blue: 'Azul', pink: 'Rosa', teal: 'Verde azulado', green: 'Verde', amber: 'Ámbar', slate: 'Gris azulado', gray: 'Gris',
};
const plural = (n: number) => `${n} ${n === 1 ? 'evento' : 'eventos'}`;

function errorText(e: CategoryOpError): string {
  switch (e.kind) {
    case 'name':
      return e.error === 'name-empty' ? 'Escribe un nombre.' : e.error === 'name-too-long' ? 'El nombre puede tener hasta 30 caracteres.' : 'Ya hay una categoría activa con ese nombre.';
    case 'in-use':
      return `La usan ${plural(e.events)}. Elige otra categoría para pasarlos, o archívala.`;
    case 'last-category':
      return 'Tiene que quedar al menos una categoría activa.';
    case 'bad-target':
      return 'Elige otra categoría activa para pasar los eventos.';
    default:
      return 'No se encontró la categoría.';
  }
}

interface Draft {
  id: string | null;
  name: string;
  color: ColorToken;
  movable: boolean;
  tracked: boolean;
  avoid: boolean;
}

export function CategoriesScreen({ c, visible, onClose }: { c: Ctx; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {visible ? <Manager c={c} onClose={onClose} /> : null}
    </Modal>
  );
}

function Manager({ c, onClose }: { c: Ctx; onClose: () => void }) {
  const t = c.theme;
  const ev = c.engine.events!;
  const [rev, setRev] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [reassign, setReassign] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const all = ev.categoriesAll();
  void rev; // `rev` fuerza a releer la lista después de cada cambio

  const current = draft?.id ? all.find((x) => x.id === draft.id) : undefined;
  const refresh = () => setRev((n) => n + 1);
  const open = (d: Draft) => {
    setDraft(d);
    setError('');
    setShowReassign(false);
    setReassign(null);
  };
  const close = () => setDraft(null);

  const input = (d: Draft) => ({ name: d.name, color: d.color, movable: d.movable, tracked: d.tracked, marginPreference: d.avoid ? 'avoid' as const : 'normal' as const });

  const save = () => {
    if (!draft) return;
    if (!draft.id) {
      const r = c.runEvent(() => ev.createCategory(input(draft)), `Se creó la categoría "${draft.name.trim()}"`);
      if (!r.ok) return setError(errorText({ kind: 'name', error: r.error }));
      refresh();
      return close();
    }
    const propsChanged = current && (current.movable !== draft.movable || current.tracked !== draft.tracked || (current.marginPreference === 'avoid') !== draft.avoid);
    const doSave = () => {
      const r = c.runEvent(() => ev.updateCategory(draft.id!, input(draft)), `Se guardó la categoría "${draft.name.trim()}"`);
      if (!r.ok) return setError(errorText(r.error));
      refresh();
      close();
    };
    if (propsChanged && current && current.usage > 0) {
      Alert.alert('Cambia el comportamiento', `Este cambio afecta a ${plural(current.usage)} de esta categoría, desde ahora.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Guardar', onPress: doSave },
      ]);
    } else doSave();
  };

  const archive = (archived: boolean) => {
    if (!draft?.id) return;
    const r = c.runEvent(() => ev.setCategoryArchived(draft.id!, archived), archived ? `Se archivó "${draft.name}"` : `Se reactivó "${draft.name}"`);
    if (!r.ok) return setError(errorText(r.error));
    refresh();
    close();
  };

  const remove = () => {
    if (!draft?.id || !current) return;
    if (current.usage > 0 && !showReassign) {
      setShowReassign(true);
      setError(errorText({ kind: 'in-use', events: current.usage }));
      return;
    }
    const doDelete = () => {
      const r = c.runEvent(() => ev.deleteCategory(draft.id!, current.usage > 0 ? reassign : null), `Se eliminó la categoría "${draft.name}"`);
      if (!r.ok) return setError(errorText(r.error));
      refresh();
      close();
    };
    if (current.usage === 0) {
      Alert.alert('Eliminar categoría', `¿Eliminar "${current.name}"? No la usa ningún evento.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDelete },
      ]);
    } else doDelete();
  };

  return (
    <KeyboardAvoidingView style={[st.root, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: c.insets.top + 12, paddingBottom: c.insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[st.h1, { color: t.fg }]}>{draft ? (draft.id ? 'Editar categoría' : 'Nueva categoría') : 'Categorías'}</Text>

        {!draft ? (
          <>
            <Text style={[st.note, { color: t.muted }]}>
              Las categorías dan color a tus eventos y deciden cómo se comportan: si se pueden empezar y medir, si son fijas o si se evitan para recibir margen.
            </Text>
            {all.map((k) => (
              <Pressable
                key={k.id} accessibilityRole="button" accessibilityLabel={`Editar ${k.name}`}
                onPress={() => open({ id: k.id, name: k.name, color: k.color, movable: k.movable, tracked: k.tracked, avoid: k.marginPreference === 'avoid' })}
                style={[st.row, { borderColor: t.line, backgroundColor: t.surface, opacity: k.archived ? 0.6 : 1 }]}
              >
                <View style={[st.dot, { backgroundColor: colorFor(t, k.color) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.rowTitle, { color: t.fg }]}>{k.name}</Text>
                  <Text style={[st.note, { color: t.muted }]}>
                    {k.archived ? 'Archivada · ' : ''}
                    {plural(k.usage)}
                    {!k.movable ? ' · Fija' : ''}
                    {!k.tracked ? ' · Sin empezar ni medir' : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Btn t={t} label="+ Nueva categoría" onPress={() => open({ id: null, name: '', color: 'blue', movable: true, tracked: true, avoid: false })} />
            <Btn t={t} kind="ghost" label="Volver" onPress={onClose} />
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Label t={t}>Nombre</Label>
              <TextInput
                value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} maxLength={30}
                placeholder="Ej.: Lectura" placeholderTextColor={t.muted} accessibilityLabel="Nombre de la categoría"
                style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Label t={t}>Color</Label>
              <View style={st.pills}>
                {COLOR_TOKENS.map((tk) => (
                  <Pressable
                    key={tk} accessibilityRole="button" accessibilityLabel={`Color ${COLOR_NAMES[tk]}`} accessibilityState={{ selected: draft.color === tk }}
                    onPress={() => setDraft({ ...draft, color: tk })}
                    style={[st.swatch, { backgroundColor: colorFor(t, tk), borderColor: draft.color === tk ? t.fg : 'transparent' }]}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Label t={t}>Comportamiento</Label>
              <Pill t={t} label="Permite empezar y medir" selected={draft.tracked} onPress={() => setDraft({ ...draft, tracked: !draft.tracked })} />
              <Pill t={t} label="Es fija: nunca se mueve" selected={!draft.movable} onPress={() => setDraft({ ...draft, movable: !draft.movable })} />
              <Pill t={t} label="Evitar para recibir margen" selected={draft.avoid} onPress={() => setDraft({ ...draft, avoid: !draft.avoid })} />
            </View>

            {current ? <Text style={[st.note, { color: t.muted }]}>La usan {plural(current.usage)}.</Text> : null}
            {error ? <Text style={[st.note, { color: t.warn }]}>{error}</Text> : null}

            {showReassign && current ? (
              <View style={[st.box, { borderColor: t.line, backgroundColor: t.surface }]}>
                <Label t={t}>Pasar sus eventos a</Label>
                <View style={st.pills}>
                  {all.filter((x) => !x.archived && x.id !== current.id).map((x) => (
                    <Pill key={x.id} t={t} label={x.name} a11y={`Pasar a ${x.name}`} selected={reassign === x.id} onPress={() => setReassign(x.id)} />
                  ))}
                </View>
                <Btn t={t} label="Pasar y eliminar" disabled={!reassign} onPress={remove} />
                {!current.archived ? <Btn t={t} kind="ghost" label="Archivar en su lugar" onPress={() => archive(true)} /> : null}
              </View>
            ) : null}

            <Btn t={t} label={draft.id ? 'Guardar' : 'Crear categoría'} onPress={save} />
            {current && !showReassign ? (
              <>
                <Btn t={t} kind="ghost" label={current.archived ? 'Reactivar' : 'Archivar'} onPress={() => archive(!current.archived)} />
                <Btn t={t} kind="ghost" label="Eliminar categoría" onPress={remove} />
              </>
            ) : null}
            <Btn t={t} kind="ghost" label="Cancelar" onPress={close} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  note: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  box: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
});
