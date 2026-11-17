// Ajustes → Categorías (spec 009, sección 4; T4.3). Solo con el motor v2. Se abre como pantalla completa.

import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Ctx } from '../ctx';
import { COLOR_TOKENS } from '../domain/categories';
import type { CategoryOpError } from '../domain/categories';
import type { ColorToken } from '../domain/types';
import { colorFor } from '../theme';
import { S } from '../i18n';
import { Btn, Label, Pill } from '../ui';

const K = S.categories;
const COLOR_NAMES: Record<ColorToken, string> = S.category.colors;

function errorText(e: CategoryOpError): string {
  switch (e.kind) {
    case 'name':
      return e.error === 'name-empty' ? K.errorEmpty : e.error === 'name-too-long' ? K.errorTooLong : K.errorTakenActive;
    case 'in-use':
      return K.errorInUse(e.events);
    case 'last-category':
      return K.errorLast;
    case 'bad-target':
      return K.errorBadTarget;
    default:
      return K.errorNotFound;
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
      const r = c.runEvent(() => ev.createCategory(input(draft)), K.created(draft.name.trim()));
      if (!r.ok) return setError(errorText({ kind: 'name', error: r.error }));
      refresh();
      return close();
    }
    const propsChanged = current && (current.movable !== draft.movable || current.tracked !== draft.tracked || (current.marginPreference === 'avoid') !== draft.avoid);
    const doSave = () => {
      const r = c.runEvent(() => ev.updateCategory(draft.id!, input(draft)), K.saved(draft.name.trim()));
      if (!r.ok) return setError(errorText(r.error));
      refresh();
      close();
    };
    if (propsChanged && current && current.usage > 0) {
      Alert.alert(K.behaviorTitle, K.behaviorBody(current.usage), [
        { text: S.common.cancel, style: 'cancel' },
        { text: S.common.save, onPress: doSave },
      ]);
    } else doSave();
  };

  const archive = (archived: boolean) => {
    if (!draft?.id) return;
    const r = c.runEvent(() => ev.setCategoryArchived(draft.id!, archived), archived ? K.archived(draft.name) : K.reactivated(draft.name));
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
      const r = c.runEvent(() => ev.deleteCategory(draft.id!, current.usage > 0 ? reassign : null), K.deleted(draft.name));
      if (!r.ok) return setError(errorText(r.error));
      refresh();
      close();
    };
    if (current.usage === 0) {
      Alert.alert(K.deleteTitle, K.deleteBody(current.name), [
        { text: S.common.cancel, style: 'cancel' },
        { text: S.common.delete, style: 'destructive', onPress: doDelete },
      ]);
    } else doDelete();
  };

  return (
    <KeyboardAvoidingView style={[st.root, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: c.insets.top + 12, paddingBottom: c.insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={[st.h1, { color: t.fg }]}>{draft ? (draft.id ? K.titleEdit : K.titleNew) : K.title}</Text>

        {!draft ? (
          <>
            <Text style={[st.note, { color: t.muted }]}>
              {K.intro}
            </Text>
            {all.map((k) => (
              <Pressable
                key={k.id} accessibilityRole="button" accessibilityLabel={K.editA11y(k.name)}
                onPress={() => open({ id: k.id, name: k.name, color: k.color, movable: k.movable, tracked: k.tracked, avoid: k.marginPreference === 'avoid' })}
                style={[st.row, { borderColor: t.line, backgroundColor: t.surface, opacity: k.archived ? 0.6 : 1 }]}
              >
                <View style={[st.dot, { backgroundColor: colorFor(t, k.color) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.rowTitle, { color: t.fg }]}>{k.name}</Text>
                  <Text style={[st.note, { color: t.muted }]}>
                    {k.archived ? K.archivedTag : ''}
                    {S.common.events(k.usage)}
                    {!k.movable ? K.fixedTag : ''}
                    {!k.tracked ? K.untrackedTag : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Btn t={t} label={S.category.newPill} onPress={() => open({ id: null, name: '', color: 'blue', movable: true, tracked: true, avoid: false })} />
            <Btn t={t} kind="ghost" label={S.common.back} onPress={onClose} />
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Label t={t}>{K.name}</Label>
              <TextInput
                value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} maxLength={30}
                placeholder={S.category.namePlaceholder} placeholderTextColor={t.muted} accessibilityLabel={S.category.nameLabel}
                style={[st.input, { color: t.fg, backgroundColor: t.surface, borderColor: t.line }]}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Label t={t}>{K.color}</Label>
              <View style={st.pills}>
                {COLOR_TOKENS.map((tk) => (
                  <Pressable
                    key={tk} accessibilityRole="button" accessibilityLabel={S.category.colorA11y(COLOR_NAMES[tk])} accessibilityState={{ selected: draft.color === tk }}
                    onPress={() => setDraft({ ...draft, color: tk })}
                    style={[st.swatch, { backgroundColor: colorFor(t, tk), borderColor: draft.color === tk ? t.fg : 'transparent' }]}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Label t={t}>{K.behavior}</Label>
              <Pill t={t} label={S.category.tracked} selected={draft.tracked} onPress={() => setDraft({ ...draft, tracked: !draft.tracked })} />
              <Pill t={t} label={S.category.fixed} selected={!draft.movable} onPress={() => setDraft({ ...draft, movable: !draft.movable })} />
              <Pill t={t} label={S.category.avoid} selected={draft.avoid} onPress={() => setDraft({ ...draft, avoid: !draft.avoid })} />
            </View>

            {current ? <Text style={[st.note, { color: t.muted }]}>{K.usedBy(current.usage)}</Text> : null}
            {error ? <Text style={[st.note, { color: t.warn }]}>{error}</Text> : null}

            {showReassign && current ? (
              <View style={[st.box, { borderColor: t.line, backgroundColor: t.surface }]}>
                <Label t={t}>{K.moveTo}</Label>
                <View style={st.pills}>
                  {all.filter((x) => !x.archived && x.id !== current.id).map((x) => (
                    <Pill key={x.id} t={t} label={x.name} a11y={K.moveToA11y(x.name)} selected={reassign === x.id} onPress={() => setReassign(x.id)} />
                  ))}
                </View>
                <Btn t={t} label={K.moveAndDelete} disabled={!reassign} onPress={remove} />
                {!current.archived ? <Btn t={t} kind="ghost" label={K.archiveInstead} onPress={() => archive(true)} /> : null}
              </View>
            ) : null}

            <Btn t={t} label={draft.id ? S.common.save : S.category.create} onPress={save} />
            {current && !showReassign ? (
              <>
                <Btn t={t} kind="ghost" label={current.archived ? S.common.reactivate : S.common.archive} onPress={() => archive(!current.archived)} />
                <Btn t={t} kind="ghost" label={K.deleteCategory} onPress={remove} />
              </>
            ) : null}
            <Btn t={t} kind="ghost" label={S.common.cancel} onPress={close} />
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
