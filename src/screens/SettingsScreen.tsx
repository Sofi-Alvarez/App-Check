import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { MESES, addDays, dayType, iso, parseISO } from '../agenda';
import type { Ctx } from '../ctx';
import { buildBackupParts, parseBackupParts, sizeLabel } from '../domain/backup';
import { askExactAlarms, askNotifications, exactAlarmsGranted, notificationsGranted, scheduleTest } from '../notifications';
import { loadAllEntries } from '../store';
import { Btn, Card, Label, Pill } from '../ui';

const fmtDate = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]}`;

function upcomingAds(anchor: string, n: number): Date[] {
  const out: Date[] = [];
  let d = new Date();
  for (let i = 0; i < 26 * 7 && out.length < n; i++) {
    if (dayType(d, anchor) === 'tueAds' && iso(d) >= iso(new Date())) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function SettingsScreen({ c }: { c: Ctx }) {
  const { theme: t, settings } = c;
  const [perm, setPerm] = useState({ notif: false, exact: false });
  const [tested, setTested] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // Copia de seguridad completa (agenda editada, marcas de hecho, conteos, registro y ajustes).
  // Se arma, se verifica contra sí misma y recién entonces se comparte; si algo no cuadra, no se comparte nada.
  const exportBackup = async () => {
    const entries = loadAllEntries();
    if (!entries) {
      setBackupMsg('No se pudo leer el almacenamiento de la app. No se generó ninguna copia.');
      return;
    }
    if (entries.length === 0) {
      setBackupMsg('No hay datos guardados todavía.');
      return;
    }
    const parts = buildBackupParts(entries, new Date());
    const check = parseBackupParts(parts);
    if (!check.ok || check.entries.length !== entries.length) {
      setBackupMsg('La copia no pasó la verificación y no se compartió. Avísale a quien mantiene la app.');
      return;
    }
    const label = `${entries.length} claves, ${sizeLabel(parts)}`;
    let sent = 0;
    try {
      for (let i = 0; i < parts.length; i++) {
        const r = await Share.share({
          title: `Copia de seguridad de la agenda (${i + 1} de ${parts.length})`,
          message: parts[i],
        });
        if (r.action === Share.dismissedAction) break;
        sent++;
      }
    } catch {
      setBackupMsg(`Se compartieron ${sent} de ${parts.length} partes. Vuelve a intentarlo y guarda todas.`);
      return;
    }
    setBackupMsg(
      sent === parts.length
        ? `Copia lista: ${label}, en ${parts.length} ${parts.length === 1 ? 'parte' : 'partes'}. Guárdala fuera del teléfono.`
        : `Se compartieron ${sent} de ${parts.length} partes. La copia está incompleta: vuelve a intentarlo y guarda todas.`,
    );
  };

  const refresh = useCallback(async () => {
    setPerm({ notif: await notificationsGranted(), exact: await exactAlarmsGranted() });
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el estado se actualiza después de un await
    refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const shiftAnchor = (days: number) => c.updateSettings({ anchor: iso(addDays(parseISO(settings.anchor), days)) });
  const ads = upcomingAds(settings.anchor, 3);

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingTop: c.insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[s.h1, { color: t.fg }]}>Avisos y ajustes</Text>

      <Card t={t}>
        <Label t={t}>Avisos</Label>
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>Avisar al empezar cada bloque</Text>
          <Switch
            value={settings.notifStart}
            onValueChange={(v) => c.updateSettings({ notifStart: v })}
            trackColor={{ true: t.accent, false: t.line }}
            thumbColor={t.surface}
          />
        </View>
        <Text style={[s.optText, { color: t.fg }]}>Avisar antes de que termine un bloque</Text>
        <View style={s.pills}>
          {[0, 5, 10, 15].map((m) => (
            <Pill
              key={m}
              t={t}
              label={m === 0 ? 'No' : `${m} min`}
              selected={settings.endLead === m}
              onPress={() => c.updateSettings({ endLead: m })}
            />
          ))}
        </View>
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>Mantener la pantalla encendida mientras la app está abierta</Text>
          <Switch
            value={settings.wake}
            onValueChange={(v) => c.updateSettings({ wake: v })}
            trackColor={{ true: t.accent, false: t.line }}
            thumbColor={t.surface}
          />
        </View>
      </Card>

      <Card t={t}>
        <Label t={t}>Permisos</Label>
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>Notificaciones</Text>
          <Text style={[s.state, { color: perm.notif ? t.ok : t.warn }]}>{perm.notif ? 'Activadas' : 'Sin permiso'}</Text>
        </View>
        {!perm.notif && (
          <Btn t={t} label="Permitir notificaciones" onPress={async () => { await askNotifications(); await refresh(); }} />
        )}
        <View style={s.opt}>
          <Text style={[s.optText, { color: t.fg }]}>Alarmas exactas</Text>
          <Text style={[s.state, { color: perm.exact ? t.ok : t.warn }]}>{perm.exact ? 'Activadas' : 'Sin permiso'}</Text>
        </View>
        {!perm.exact && (
          <>
            <Text style={[s.note, { color: t.muted }]}>
              Sin este permiso los avisos pueden llegar con minutos de atraso. Al tocar el botón se abre la pantalla de alarmas y recordatorios: activa la app ahí.
            </Text>
            <Btn t={t} label="Activar alarmas exactas" onPress={async () => { await askExactAlarms(); await refresh(); }} />
          </>
        )}
        <Btn
          t={t}
          kind="ghost"
          label={tested ? 'Aviso en camino: bloquea la pantalla' : 'Probar aviso en 5 segundos'}
          onPress={async () => {
            await askNotifications();
            await scheduleTest();
            setTested(true);
            setTimeout(() => setTested(false), 8000);
          }}
        />
      </Card>

      <Card t={t}>
        <Label t={t}>Para que no se pierdan en tu Xiaomi</Label>
        <Text style={[s.note, { color: t.muted }]}>
          HyperOS cierra las apps en segundo plano para ahorrar batería y eso cancela los avisos. Haz esto una sola vez:
        </Text>
        {[
          'Inicio automático: actívalo para esta app.',
          'Ahorro de batería: elige “Sin restricciones”.',
          'Notificaciones: permite todas, incluidas las de pantalla de bloqueo.',
          'En Recientes, mantén presionada la tarjeta de la app y toca el candado.',
        ].map((line, i) => (
          <View key={i} style={s.step}>
            <Text style={[s.stepNum, { color: t.accent }]}>{i + 1}</Text>
            <Text style={[s.optText, { color: t.fg, flex: 1 }]}>{line}</Text>
          </View>
        ))}
        <Text style={[s.note, { color: t.muted }]}>Los nombres de los menús pueden variar según tu versión.</Text>
        <Btn t={t} label="Abrir ajustes de la app" onPress={() => Linking.openSettings()} />
      </Card>

      <Card t={t}>
        <Label t={t}>Martes con adscripción</Label>
        <Text style={[s.note, { color: t.muted }]}>Próximos martes con adscripción, cada 14 días:</Text>
        {ads.map((d) => (
          <Text key={iso(d)} style={[s.date, { color: t.fg }]}>
            {fmtDate(d)}
          </Text>
        ))}
        <Text style={[s.note, { color: t.muted }]}>Si alguna fecha no coincide con tu calendario, muévela una semana.</Text>
        <View style={s.pills}>
          <Pill t={t} label="− 1 semana" onPress={() => shiftAnchor(-7)} />
          <Pill t={t} label="+ 1 semana" onPress={() => shiftAnchor(7)} />
        </View>
      </Card>

      <Card t={t}>
        <Label t={t}>Copia de seguridad</Label>
        <Text style={[s.note, { color: t.muted }]}>
          Guarda todo lo de la app: la agenda con tus ediciones, lo hecho, los conteos, el registro de sesiones y los ajustes. Compártela a tu correo o a Drive. Si desinstalas la app, sin esta copia se pierde todo.
        </Text>
        <Btn t={t} label="Exportar copia de seguridad" onPress={exportBackup} />
        {backupMsg ? (
          <Text accessibilityLiveRegion="polite" style={[s.note, { color: t.fg }]}>
            {backupMsg}
          </Text>
        ) : null}
      </Card>

      <Card t={t}>
        <Label t={t}>Agenda</Label>
        <Text style={[s.note, { color: t.muted }]}>
          Si editaste tareas y quieres volver a la agenda original, restáurala. Tus datos de uso (sesiones, conteos, hechos) no se borran.
        </Text>
        <Btn
          t={t}
          kind="ghost"
          label="Restaurar agenda original"
          onPress={() =>
            Alert.alert('Restaurar agenda original', 'Se descartan todas las tareas que editaste, creaste o eliminaste.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Restaurar', style: 'destructive', onPress: c.restoreSchedule },
            ])
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
  date: { fontSize: 17, fontWeight: '600' },
});
