import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockInfo, addDays, blockInfo, iso, parseISO, startOfDayMs } from './src/agenda';
import type { Ctx } from './src/ctx';
import {
  StartTap, askNotifications, cancelTimerAlert, onStartTap, pendingStartTap, rescheduleAgenda, scheduleTimerAlert,
  setupChannels,
} from './src/notifications';
import {
  MarginPlan, Scope, TaskDraft, applyMargin, blocksFor, currentBlockInfo, planMargin, deleteTask as removeTask, migrateDoneToIds, saveTask as storeTask,
} from './src/schedule';
import { AgendaScreen } from './src/screens/AgendaScreen';
import { DataScreen } from './src/screens/DataScreen';
import { MarginPrompt } from './src/screens/MarginPrompt';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TimerScreen } from './src/screens/TimerScreen';
import {
  ActiveSession, DayData, EventSource, Settings, TimerState, loadActive, loadDay, loadSettings, loadTimer,
  logEvent, resetSchedule, saveActive, saveDay, saveSettings, saveTimer,
} from './src/store';
import { useTheme } from './src/theme';

type Tab = 'agenda' | 'metas' | 'datos' | 'timer' | 'ajustes';
const TABS: { key: Tab; label: string; glyph: string }[] = [
  { key: 'agenda', label: 'Agenda', glyph: '☰' },
  { key: 'metas', label: 'Metas', glyph: '◎' },
  { key: 'datos', label: 'Datos', glyph: '▤' },
  { key: 'timer', label: 'Timer', glyph: '◷' },
  { key: 'ajustes', label: 'Ajustes', glyph: '⚙' },
];

function defaultView(): string {
  const n = new Date();
  const dw = n.getDay();
  return iso(dw === 6 ? addDays(n, 2) : dw === 0 ? addDays(n, 1) : n);
}

function Root() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('agenda');
  const [now, setNow] = useState(new Date());
  const [rev, setRev] = useState(0);
  const [schedRev, setSchedRev] = useState(0);
  const [margin, setMargin] = useState<MarginPlan | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    const st = loadSettings();
    migrateDoneToIds(st.anchor);
    return st;
  });
  const [timer, setTimer] = useState<TimerState>(() => loadTimer());
  const [viewIso, setViewIso] = useState(defaultView);
  const [active, setActive] = useState<ActiveSession | null>(() => loadActive());
  const lastResched = useRef(0);

  const bump = useCallback(() => setRev((r) => r + 1), []);

  // Reloj de la app
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Canales, permiso y primera programación
  useEffect(() => {
    (async () => {
      await setupChannels();
      await askNotifications();
      lastResched.current = Date.now();
      await rescheduleAgenda(loadSettings(), loadTimer());
    })();
  }, []);

  // Reprogramar al cambiar ajustes que afectan los avisos
  const notifKey = useMemo(
    () => JSON.stringify([settings.notifStart, settings.endLead, settings.anchor, settings.muted, schedRev]),
    [settings.notifStart, settings.endLead, settings.anchor, settings.muted, schedRev],
  );
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      lastResched.current = Date.now();
      rescheduleAgenda(settings, timer);
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifKey]);

  // Renovar la ventana de 14 días al volver a la app
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        setNow(new Date());
        if (Date.now() - lastResched.current > 30 * 60000) {
          lastResched.current = Date.now();
          rescheduleAgenda(loadSettings(), loadTimer());
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Pantalla encendida
  useEffect(() => {
    if (settings.wake) activateKeepAwakeAsync('agenda').catch(() => {});
    else deactivateKeepAwake('agenda').catch(() => {});
  }, [settings.wake]);

  // El timer terminó
  useEffect(() => {
    if (timer.endAt && now.getTime() >= timer.endAt) {
      const next = { ...timer, endAt: 0, left: 0 };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacciona al reloj de la app
      setTimer(next);
      saveTimer(next);
    }
  }, [now, timer]);

  // `rev` fuerza a releer el almacenamiento tras cada cambio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day: DayData = useMemo(() => loadDay(viewIso), [viewIso, rev]);

  // Bloques del día que se está viendo (con las ediciones aplicadas).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blocks = useMemo(() => blocksFor(parseISO(viewIso), settings.anchor) ?? [], [viewIso, settings.anchor, rev]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleDone = useCallback((id: string) => {
    const d = loadDay(viewIso);
    const k = id;
    const done = { ...d.done };
    const wasDone = !!done[k];
    if (wasDone) delete done[k];
    else done[k] = true;
    saveDay(viewIso, { ...d, done });
    const b = blocks.find((x) => x.id === id);
    if (b) logEvent(wasDone ? 'undone' : 'done', blockInfo(viewIso, b), Date.now());
    bump();
  }, [viewIso, blocks, bump]);

  const changeCount = useCallback((key: string, delta: number) => {
    const d = loadDay(viewIso);
    const before = d.counts[key] ?? 0;
    const after = Math.max(0, before + delta);
    saveDay(viewIso, { ...d, counts: { ...d.counts, [key]: after } });
    if (after !== before) {
      // El conteo se asocia a la sesión en curso o, si no hay, al bloque que toca ahora.
      const cur = loadActive() ?? currentBlockInfo(new Date(), settings.anchor);
      const info = cur ? { ...cur, day: viewIso } : null;
      logEvent('count', info, Date.now(), 'manual', key, after - before);
    }
    bump();
  }, [viewIso, settings.anchor, bump]);

  const toggleMute = useCallback((key: string) => {
    setSettings((cur) => {
      const muted = { ...cur.muted };
      if (muted[key]) delete muted[key];
      else muted[key] = true;
      const next = { ...cur, muted };
      saveSettings(next);
      return next;
    });
  }, []);

  // Editar la agenda: se relee la lista del día y se reprograman los avisos.
  const scheduleChanged = useCallback(() => {
    setSchedRev((r) => r + 1);
    bump();
  }, [bump]);

  const saveTask = useCallback((draft: TaskDraft, scope: Scope) => {
    storeTask(draft, scope, viewIso, settings.anchor);
    scheduleChanged();
  }, [viewIso, settings.anchor, scheduleChanged]);

  const deleteTask = useCallback((id: string, scope: Scope) => {
    removeTask(id, scope, viewIso, settings.anchor);
    scheduleChanged();
  }, [viewIso, settings.anchor, scheduleChanged]);

  const restoreSchedule = useCallback(() => {
    resetSchedule();
    scheduleChanged();
  }, [scheduleChanged]);

  const commitTimer = useCallback((next: TimerState) => {
    setTimer(next);
    saveTimer(next);
  }, []);

  const startTimer = useCallback((minutes: number, label: string) => {
    const total = Math.max(1, Math.round(minutes * 60));
    const next = { total, left: total, endAt: Date.now() + total * 1000, label };
    commitTimer(next);
    cancelTimerAlert().then(() => scheduleTimerAlert(next));
    setTab('timer');
  }, [commitTimer]);

  const toggleTimer = useCallback(() => {
    const nowMs = Date.now();
    if (timer.endAt) {
      commitTimer({ ...timer, left: Math.max(1, Math.ceil((timer.endAt - nowMs) / 1000)), endAt: 0 });
      cancelTimerAlert();
    } else {
      const total = timer.total || 1500;
      const left = timer.left > 0 ? timer.left : total;
      const next = { ...timer, total, left, endAt: nowMs + left * 1000, label: timer.label || 'Enfoque' };
      commitTimer(next);
      cancelTimerAlert().then(() => scheduleTimerAlert(next));
    }
  }, [timer, commitTimer]);

  const resetTimer = useCallback(() => {
    commitTimer({ ...timer, endAt: 0, left: timer.total });
    cancelTimerAlert();
  }, [timer, commitTimer]);

  const closeActive = useCallback((cur: ActiveSession, ts: number, source: EventSource) => {
    logEvent('finish', cur, ts, source);
    saveActive(null);
    setActive(null);
  }, []);

  // Al terminar una tarea con más de 5 min de diferencia, se ofrece pasar el margen a otra tarea.
  const offerMargin = useCallback((cur: ActiveSession, ts: number) => {
    if (cur.planE < 0) return;
    const endMin = Math.round((ts - startOfDayMs(parseISO(cur.day))) / 60000);
    const plan = planMargin(cur.day, settings.anchor, cur.bid, endMin);
    if (plan) setMargin(plan);
  }, [settings.anchor]);

  const startSession = useCallback((info: BlockInfo | null) => {
    const ts = Date.now();
    const cur = loadActive();
    if (cur) {
      closeActive(cur, ts, 'next');
      offerMargin(cur, ts);
    }
    const base: BlockInfo = info ?? {
      bid: 'other', day: iso(new Date(ts)), title: 'Otra cosa', cat: 'other', planS: -1, planE: -1,
    };
    const next: ActiveSession = { ...base, startedAt: ts, pausedAt: 0, pausedMs: 0 };
    saveActive(next);
    setActive(next);
    logEvent('start', base, ts);
  }, [closeActive, offerMargin]);

  const pauseResume = useCallback(() => {
    const cur = loadActive();
    if (!cur) return;
    const ts = Date.now();
    const next = cur.pausedAt
      ? { ...cur, pausedMs: cur.pausedMs + (ts - cur.pausedAt), pausedAt: 0 }
      : { ...cur, pausedAt: ts };
    saveActive(next);
    setActive(next);
    logEvent(cur.pausedAt ? 'resume' : 'pause', cur, ts);
  }, []);

  const finishSession = useCallback(() => {
    const cur = loadActive();
    if (!cur) return;
    const ts = Date.now();
    closeActive(cur, ts, 'manual');
    offerMargin(cur, ts);
  }, [closeActive, offerMargin]);

  const applyMarginChoice = useCallback((targetId: string) => {
    if (!margin) return;
    const done = applyMargin(margin, targetId, settings.anchor);
    const info: BlockInfo = { bid: margin.aId, day: margin.day, title: margin.aTitle, cat: '', planS: -1, planE: -1 };
    logEvent('margin', info, Date.now(), 'manual', done ? targetId : 'none', margin.slack);
    setMargin(null);
    if (done) scheduleChanged();
  }, [margin, settings.anchor, scheduleChanged]);

  const skipMargin = useCallback(() => {
    if (margin) {
      const info: BlockInfo = { bid: margin.aId, day: margin.day, title: margin.aTitle, cat: '', planS: -1, planE: -1 };
      logEvent('margin', info, Date.now(), 'manual', 'none', margin.slack);
    }
    setMargin(null);
  }, [margin]);

  // Si te olvidas de terminar, la sesión se cierra sola a la hora planificada (con una hora de gracia)
  // y queda marcada como auto_close para no mezclarla con datos reales.
  useEffect(() => {
    if (!active) return;
    const nowMs = now.getTime();
    const limit = active.planE >= 0
      ? new Date(parseISO(active.day).getTime() + active.planE * 60000).getTime()
      : active.startedAt;
    const grace = active.planE >= 0 ? 60 * 60000 : 3 * 3600000;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacciona al reloj de la app
    if (nowMs > limit + grace) closeActive(active, Math.max(limit, active.startedAt), 'auto_close');
  }, [now, active, closeActive]);

  // Botón "Empecé" del aviso: empieza la tarea del aviso con la hora del toque.
  const handledTaps = useRef(new Set<string>());
  const handleStartTap = useCallback((tap: StartTap) => {
    if (handledTaps.current.has(tap.key)) return;
    handledTaps.current.add(tap.key);
    if (tap.day !== iso(new Date())) return;
    const b = blocksFor(parseISO(tap.day), settings.anchor)?.find((x) => x.id === tap.bid);
    if (!b || loadActive()?.bid === b.id) return;
    startSession(blockInfo(tap.day, b));
    setTab('agenda');
    setViewIso(tap.day);
  }, [settings.anchor, startSession]);

  useEffect(() => {
    pendingStartTap().then((tap) => tap && handleStartTap(tap));
    return onStartTap(handleStartTap);
  }, [handleStartTap]);

  const timerLeft = timer.endAt ? Math.max(0, Math.ceil((timer.endAt - now.getTime()) / 1000)) : timer.left;

  const ctx: Ctx = {
    theme: t, insets: { top: insets.top, bottom: insets.bottom }, now, rev, settings, updateSettings,
    viewIso, setViewIso, day, toggleDone, changeCount, toggleMute,
    timer, timerLeft, startTimer, toggleTimer, resetTimer,
    active, startSession, pauseResume, finishSession,
    blocks, saveTask, deleteTask, restoreSchedule,
  };

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={s.screen}>
        {tab === 'agenda' && <AgendaScreen c={ctx} />}
        {tab === 'metas' && <GoalsScreen c={ctx} />}
        {tab === 'datos' && <DataScreen c={ctx} />}
        {tab === 'timer' && <TimerScreen c={ctx} />}
        {tab === 'ajustes' && <SettingsScreen c={ctx} />}
      </View>
      <View style={[s.bar, { backgroundColor: t.surface, borderTopColor: t.line, paddingBottom: insets.bottom }]}>
        {TABS.map((x) => {
          const on = tab === x.key;
          return (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={x.label}
              onPress={() => setTab(x.key)}
              android_ripple={{ color: 'rgba(127,127,127,0.25)' }}
              style={s.tab}
            >
              <Text style={[s.glyph, { color: on ? t.accent : t.muted }]}>{x.glyph}</Text>
              <Text style={[s.tabText, { color: on ? t.accent : t.muted, fontWeight: on ? '800' : '600' }]}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <MarginPrompt t={t} plan={margin} bottomInset={insets.bottom} onApply={applyMarginChoice} onSkip={skipMargin} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
  glyph: { fontSize: 22, lineHeight: 26 },
  tabText: { fontSize: 12 },
});
