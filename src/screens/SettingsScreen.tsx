import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { shareBackup } from '../backupShare';
import type { Ctx } from '../ctx';
import {
  askExactAlarms, askNotifications, countScheduled, exactAlarmsGranted, getScheduleReport, notificationsGranted, scheduleTest,
} from '../notifications';
import { S } from '../i18n';
import { Btn, Card, Label, Pill } from '../ui';
import { CategoriesScreen } from './CategoriesScreen';

const T = S.settings;

export function SettingsScreen({ c }: { c: Ctx }) {
  const { theme: t, settings } = c;
  const [perm, setPerm] = useState({ notif: false, exact: false });
  const [pending, setPending] = useState<number | null>(null);
  const [tested, setTested] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [catsOpen, setCatsOpen] = useState(false);

  // Copia de seguridad completa (agenda, marcas de hecho, conteos, registro y ajustes).
  const exportBackup = async () => setBackupMsg(await shareBackup());

  const refresh = useCallback(async () => {
    setPerm({ notif: await notificationsGranted(), exact: await exactAlarmsGranted() });
    setPending(await countScheduled());
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el estado se actualiza después de un await
    refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.h1, { color: t.fg }]}>{T.title}</Text>

      <Card t={t}>
        <Label t={t}>{T.reminders}</Label>
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>{T.atStart}</Text>
          <Switch
            value={settings.notifStart}
            onValueChange={(v) => c.updateSettings({ notifStart: v })}
            trackColor={{ true: t.accent, false: t.line }}
            thumbColor={t.surface}
          />
        </View>
        <Text style={[s.optText, { color: t.fg }]}>{T.beforeEnd}</Text>
        <View style={s.pills}>
          {[0, 5, 10, 15].map((m) => (
            <Pill
              key={m}
              t={t}
              label={m === 0 ? T.no : T.minutes(m)}
              selected={settings.endLead === m}
              onPress={() => c.updateSettings({ endLead: m })}
            />
          ))}
        </View>
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>{T.keepAwake}</Text>
          <Switch
            value={settings.wake}
            onValueChange={(v) => c.updateSettings({ wake: v })}
            trackColor={{ true: t.accent, false: t.line }}
            thumbColor={t.surface}
          />
        </View>
      </Card>

      <Card t={t}>
        <Label t={t}>{T.permissions}</Label>
        {pending != null ? (
          <View style={s.opt}>
            <Text style={[s.optText, { color: t.fg }]}>{T.scheduled}</Text>
            <Text style={[s.state, { color: t.fg }]}>{pending}</Text>
          </View>
        ) : null}
        {(() => {
          const r = getScheduleReport();
          if (!r) return null;
          const text = r.running
            ? T.rescheduling
            : T.lastSchedule(r.ok, r.planned, r.error);
          return <Text style={[s.note, { color: r.error ? t.warn : t.muted }]}>{text}</Text>;
        })()}
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>{T.notifications}</Text>
          <Text style={[s.state, { color: perm.notif ? t.ok : t.warn }]}>{perm.notif ? T.enabled : T.noPermission}</Text>
        </View>
        {!perm.notif && (
          <Btn t={t} label={T.allowNotifications} onPress={async () => { await askNotifications(); await refresh(); }} />
        )}
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>{T.exactAlarms}</Text>
          <Text style={[s.state, { color: perm.exact ? t.ok : t.warn }]}>{perm.exact ? T.enabled : T.noPermission}</Text>
        </View>
        {!perm.exact && (
          <>
            <Text style={[s.note, { color: t.muted }]}>
              {T.exactNote}
            </Text>
            <Btn t={t} label={T.enableExact} onPress={async () => { await askExactAlarms(); await refresh(); }} />
          </>
        )}
        <Btn
          t={t}
          kind="ghost"
          label={tested ? T.testSent : T.test}
          onPress={async () => {
            await askNotifications();
            await scheduleTest();
            setTested(true);
            setTimeout(() => setTested(false), 8000);
          }}
        />
      </Card>

      <Card t={t}>
        <Label t={t}>{T.xiaomiTitle}</Label>
        <Text style={[s.note, { color: t.muted }]}>
          {T.xiaomiIntro}
        </Text>
        {T.xiaomiSteps.map((line, i) => (
          <View key={i} style={s.step}>
            <Text style={[s.stepNum, { color: t.accent }]}>{i + 1}</Text>
            <Text style={[s.optText, { color: t.fg, flex: 1 }]}>{line}</Text>
          </View>
        ))}
        <Text style={[s.note, { color: t.muted }]}>{T.xiaomiNote}</Text>
        <Btn t={t} label={T.openSettings} onPress={() => Linking.openSettings()} />
      </Card>

      <Card t={t}>
        <Label t={t}>{T.backupTitle}</Label>
        <Text style={[s.note, { color: t.muted }]}>
          {T.backupIntro}
        </Text>
        <Btn t={t} label={T.backupButton} onPress={exportBackup} />
        {backupMsg ? (
          <Text accessibilityLiveRegion="polite" style={[s.note, { color: t.fg }]}>
            {backupMsg}
          </Text>
        ) : null}
      </Card>

      <Card t={t}>
        <Label t={t}>{T.categoriesTitle}</Label>
        <Text style={[s.note, { color: t.muted }]}>
          {T.categoriesIntro}
        </Text>
        <Btn t={t} label={T.manageCategories} onPress={() => setCatsOpen(true)} />
        <CategoriesScreen c={c} visible={catsOpen} onClose={() => setCatsOpen(false)} />
      </Card>

      <Card t={t}>
        <Label t={t}>{T.agendaTitle}</Label>
        <Text style={[s.note, { color: t.muted }]}>
          {T.agendaIntro}
        </Text>
        <Btn
          t={t}
          kind="ghost"
          label={T.restoreTemplate}
          onPress={() =>
            Alert.alert(
              T.restoreTemplate,
              T.restoreTemplateBody,
              [
                { text: S.common.cancel, style: 'cancel' },
                { text: T.restore, style: 'destructive', onPress: () => c.runEvent(() => c.engine.events.restoreTemplate(), T.restoredTemplate) },
              ],
            )
          }
        />
        <Btn
          t={t}
          kind="ghost"
          label={T.clearAll}
          onPress={() =>
            Alert.alert(
              T.clearAll,
              T.clearAllBody,
              [
                { text: S.common.cancel, style: 'cancel' },
                { text: T.clear, style: 'destructive', onPress: () => c.runEvent(() => c.engine.events.clearAll(), T.cleared) },
              ],
            )
          }
        />
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  optText: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  state: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 14, lineHeight: 20 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { fontSize: 16, fontWeight: '800', width: 18 },
});
