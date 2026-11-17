import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockInfo, iso, parseISO, startOfDayMs } from './src/agenda';
import { shareBackup } from './src/backupShare';
import type { Ctx } from './src/ctx';
import { S } from './src/i18n';
import { expoKV } from './src/data/expoKV';
import { initializeIfEmpty, resetToTemplate } from './src/data/init';
import { Repository, RepositoryError, createRepository } from './src/data/repository';
import {
  StartTap, askNotifications, cancelTimerAlert, onStartTap, pendingStartTap, rescheduleAgenda, scheduleTimerAlert,
  setupChannels,
} from './src/notifications';
import type { AgendaState, SettingsV2 } from './src/domain/types';
import type { AgendaEngine, BlockRef, EngineBlock, MarginPlan } from './src/engine/types';
import { createV2Engine } from './src/engine/v2';
import { AgendaScreen } from './src/screens/AgendaScreen';
import { DataScreen } from './src/screens/DataScreen';
import { MarginPrompt } from './src/screens/MarginPrompt';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TimerScreen } from './src/screens/TimerScreen';
import {
  ActiveSession, DayData, EventKind, EventSource, TimerState, loadActive, loadDay, loadTimer, logEvent, saveActive, saveDay,
  saveTimer,
} from './src/store';
import { Theme, useTheme } from './src/theme';
import { Btn } from './src/ui';

type Tab = 'agenda' | 'metas' | 'datos' | 'timer' | 'ajustes';
const TABS: { key: Tab; label: string; glyph: string }[] = [
  { key: 'agenda', label: S.app.tabs.agenda, glyph: '☰' },
  { key: 'metas', label: S.app.tabs.metas, glyph: '◎' },
  { key: 'datos', label: S.app.tabs.datos, glyph: '▤' },
  { key: 'timer', label: S.app.tabs.timer, glyph: '◷' },
  { key: 'ajustes', label: S.app.tabs.ajustes, glyph: '⚙' },
];

const toRef = (day: string, b: EngineBlock): BlockRef => ({ bid: b.id, day, title: b.t, cat: b.c, planS: b.s, planE: b.e });

type Boot = { ok: true; engine: AgendaEngine } | { ok: false; repo: Repository; key: string };

/**
 * Arranque: si es una instalación nueva se arma la agenda con la plantilla inicial; si ya hay datos se usan tal cual.
 * Si los datos guardados están dañados no se toca nada y se muestra la pantalla de datos dañados.
 */
function boot(): Boot {
  const repo = createRepository(expoKV);
  try {
    initializeIfEmpty(repo, iso(new Date()));
    repo.loadAgenda();
    return { ok: true, engine: createV2Engine(repo) };
  } catch (e) {
    if (e instanceof RepositoryError) return { ok: false, repo, key: e.key };
    throw e;
  }
}

/** Datos dañados: primero exportar la copia (con las claves crudas), después, si se quiere, empezar de nuevo. */
function DataError({ t, repo, errorKey, onReset }: { t: Theme; repo: Repository; errorKey: string; onReset: () => void }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState('');
  const E = S.dataError;
  const startOver = () =>
    Alert.alert(E.startOver, E.startOverBody, [
      { text: S.common.cancel, style: 'cancel' },
      {
        text: E.startOverConfirm,
        style: 'destructive',
        onPress: () => {
          resetToTemplate(repo, iso(new Date()));
          onReset();
        },
      },
    ]);
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.error, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Text accessibilityRole="header" style={[s.errorTitle, { color: t.fg }]}>{E.title}</Text>
      <Text style={[s.errorBody, { color: t.fg }]}>{E.body}</Text>
      <Text style={[s.errorBody, { color: t.muted }]}>{E.detail(errorKey)}</Text>
      <Btn t={t} label={S.settings.backupButton} onPress={async () => setMsg(await shareBackup())} />
      {msg ? <Text accessibilityLiveRegion="polite" style={[s.errorBody, { color: t.fg }]}>{msg}</Text> : null}
      <Btn t={t} kind="ghost" label={E.startOver} onPress={startOver} />
    </ScrollView>
  );
}

function Start() {
  const t = useTheme();
  const [state, setState] = useState<Boot>(boot);
  if (!state.ok) return <DataError t={t} repo={state.repo} errorKey={state.key} onReset={() => setState(boot())} />;
  return <Root engine={state.engine} />;
}

function Root({ engine }: { engine: AgendaEngine }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('agenda');
  const [now, setNow] = useState(new Date());
  const [rev, setRev] = useState(0);
  const [schedRev, setSchedRev] = useState(0);
  const [margin, setMargin] = useState<MarginPlan | null>(null);
  const [settings, setSettings] = useState<SettingsV2>(() => engine.loadSettings());
  const [timer, setTimer] = useState<TimerState>(() => loadTimer());
  const [viewIso, setViewIso] = useState(() => iso(new Date()));
  const [active, setActive] = useState<ActiveSession | null>(() => loadActive());
  const lastResched = useRef(0);

  const bump = useCallback(() => setRev((r) => r + 1), []);

  // Registro de uso con los nombres de la categoría y de la meta al momento del toque (T2.3).
  const log = useCallback((kind: EventKind, info: BlockInfo | null, ts: number, source: EventSource = 'manual', goal = '', delta = 0) => {
    const catName = info?.cat && info.cat !== 'other' ? engine.category(info.cat).name : '';
    const goalName = kind === 'count' && goal ? engine.goalName(goal) : '';
    logEvent(kind, info, ts, source, goal, delta, { catName, goalName });
  }, [engine]);

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
      await rescheduleAgenda(engine, engine.loadSettings(), loadTimer());
    })();
  }, []);

  // Reprogramar al cambiar ajustes que afectan los avisos
  const notifKey = useMemo(
    () => JSON.stringify([settings.notifStart, settings.endLead, settings.muted, schedRev]),
    [settings.notifStart, settings.endLead, settings.muted, schedRev],
  );
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      lastResched.current = Date.now();
      rescheduleAgenda(engine, settings, timer);
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
          rescheduleAgenda(engine, engine.loadSettings(), loadTimer());
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
  const blocks = useMemo(() => engine.blocksFor(viewIso), [engine, viewIso, rev]);

  const updateSettings = useCallback((patch: Partial<SettingsV2>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      engine.saveSettings(next);
      return next;
    });
  }, [engine]);

  const toggleDone = useCallback((id: string) => {
    const d = loadDay(viewIso);
    const k = id;
    const done = { ...d.done };
    const wasDone = !!done[k];
    if (wasDone) delete done[k];
    else done[k] = true;
    saveDay(viewIso, { ...d, done });
    const b = blocks.find((x) => x.id === id);
    if (b) log(wasDone ? 'undone' : 'done', toRef(viewIso, b), Date.now());
    bump();
  }, [viewIso, blocks, bump, log]);

  const changeCount = useCallback((key: string, delta: number) => {
    const d = loadDay(viewIso);
    const before = d.counts[key] ?? 0;
    const after = Math.max(0, before + delta);
    saveDay(viewIso, { ...d, counts: { ...d.counts, [key]: after } });
    if (after !== before) {
      // El conteo se asocia a la sesión en curso o, si no hay, al bloque que toca ahora.
      const cur = loadActive() ?? engine.currentBlock(new Date());
      const info = cur ? { ...cur, day: viewIso } : null;
      log('count', info, Date.now(), 'manual', key, after - before);
    }
    bump();
  }, [viewIso, engine, bump, log]);

  const toggleMute = useCallback((key: string) => {
    setSettings((cur) => {
      const muted = { ...cur.muted };
      if (muted[key]) delete muted[key];
      else muted[key] = true;
      const next = { ...cur, muted };
      engine.saveSettings(next);
      return next;
    });
  }, [engine]);

  // Editar la agenda: se relee la lista del día y se reprograman los avisos.
  const scheduleChanged = useCallback(() => {
    setSchedRev((r) => r + 1);
    bump();
  }, [bump]);

  // Operaciones de eventos con "Deshacer" durante 8 segundos (spec 009, 3.6).
  const [undo, setUndo] = useState<{ snap: AgendaState; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runEvent = useCallback(<T extends { ok: boolean }>(op: () => T, label: string): T => {
    const ev = engine.events;
    const snap = ev.snapshot();
    const res = op();
    if (res.ok) {
      scheduleChanged();
      setUndo({ snap, label });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 8000);
    }
    return res;
  }, [engine, scheduleChanged]);
  const doUndo = useCallback(() => {
    if (!undo) return;
    engine.events.restore(undo.snap);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    scheduleChanged();
  }, [undo, engine, scheduleChanged]);

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
      const next = { ...timer, total, left, endAt: nowMs + left * 1000, label: timer.label || S.reminders.timerDefault };
      commitTimer(next);
      cancelTimerAlert().then(() => scheduleTimerAlert(next));
    }
  }, [timer, commitTimer]);

  const resetTimer = useCallback(() => {
    commitTimer({ ...timer, endAt: 0, left: timer.total });
    cancelTimerAlert();
  }, [timer, commitTimer]);

  const closeActive = useCallback((cur: ActiveSession, ts: number, source: EventSource) => {
    log('finish', cur, ts, source);
    saveActive(null);
    setActive(null);
  }, [log]);

  // Al terminar una tarea con más de 5 min de diferencia, se ofrece pasar el margen a otra tarea.
  const offerMargin = useCallback((cur: ActiveSession, ts: number) => {
    if (cur.planE < 0) return;
    const endMin = Math.round((ts - startOfDayMs(parseISO(cur.day))) / 60000);
    const plan = engine.planMargin(cur.day, cur.bid, endMin);
    if (plan) setMargin(plan);
  }, [engine]);

  const startSession = useCallback((info: BlockInfo | null) => {
    const ts = Date.now();
    const cur = loadActive();
    if (cur) {
      closeActive(cur, ts, 'next');
      offerMargin(cur, ts);
    }
    const base: BlockInfo = info ?? {
      bid: 'other', day: iso(new Date(ts)), title: S.app.otherThing, cat: 'other', planS: -1, planE: -1,
    };
    const next: ActiveSession = { ...base, startedAt: ts, pausedAt: 0, pausedMs: 0 };
    saveActive(next);
    setActive(next);
    log('start', base, ts);
  }, [closeActive, offerMargin, log]);

  const pauseResume = useCallback(() => {
    const cur = loadActive();
    if (!cur) return;
    const ts = Date.now();
    const next = cur.pausedAt
      ? { ...cur, pausedMs: cur.pausedMs + (ts - cur.pausedAt), pausedAt: 0 }
      : { ...cur, pausedAt: ts };
    saveActive(next);
    setActive(next);
    log(cur.pausedAt ? 'resume' : 'pause', cur, ts);
  }, [log]);

  const finishSession = useCallback(() => {
    const cur = loadActive();
    if (!cur) return;
    const ts = Date.now();
    closeActive(cur, ts, 'manual');
    offerMargin(cur, ts);
  }, [closeActive, offerMargin]);

  const applyMarginChoice = useCallback((targetId: string) => {
    if (!margin) return;
    const done = engine.applyMargin(margin, targetId);
    const info: BlockInfo = { bid: margin.aId, day: margin.day, title: margin.aTitle, cat: '', planS: -1, planE: -1 };
    log('margin', info, Date.now(), 'manual', done ? targetId : 'none', margin.slack);
    setMargin(null);
    if (done) scheduleChanged();
  }, [margin, engine, scheduleChanged, log]);

  const skipMargin = useCallback(() => {
    if (margin) {
      const info: BlockInfo = { bid: margin.aId, day: margin.day, title: margin.aTitle, cat: '', planS: -1, planE: -1 };
      log('margin', info, Date.now(), 'manual', 'none', margin.slack);
    }
    setMargin(null);
  }, [margin, log]);

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
    const b = engine.blocksFor(tap.day)?.find((x) => x.id === tap.bid);
    if (!b || loadActive()?.bid === b.id) return;
    startSession(toRef(tap.day, b));
    setTab('agenda');
    setViewIso(tap.day);
  }, [engine, startSession]);

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
    blocks, engine, runEvent,
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
      {undo ? (
        <View accessibilityLiveRegion="polite" style={[s.undo, { backgroundColor: t.fg }]}>
          <Text style={[s.undoText, { color: t.bg }]} numberOfLines={2}>{undo.label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={S.common.undo} onPress={doUndo} hitSlop={8} style={s.undoBtn}>
            <Text style={[s.undoAction, { color: t.bg }]}>{S.common.undo}</Text>
          </Pressable>
        </View>
      ) : null}
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
      <Start />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  error: { paddingHorizontal: 16, gap: 16 },
  errorTitle: { fontSize: 26, fontWeight: '800' },
  errorBody: { fontSize: 16, lineHeight: 23 },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, marginBottom: 8, paddingLeft: 16, paddingRight: 8, minHeight: 52, borderRadius: 12 },
  undoText: { flex: 1, fontSize: 15, fontWeight: '600' },
  undoBtn: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  undoAction: { fontSize: 15, fontWeight: '800', textDecorationLine: 'underline' },
  root: { flex: 1 },
  screen: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
  glyph: { fontSize: 22, lineHeight: 26 },
  tabText: { fontSize: 12 },
});
