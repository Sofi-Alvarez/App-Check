// El plugin de import no ve los enums que expo-notifications reexporta; existen y tsc los valida.
/* eslint-disable import/namespace */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, iso, startOfDayMs } from './agenda';
import type { AgendaEngine } from './engine/types';
import { S } from './i18n';
import { ReminderDay, planGoalReminders, planReminders } from './reminders';
import type { Settings, TimerState } from './store';

export const CH_AGENDA = 'agenda';
export const CH_TIMER = 'timer';
// Sin ':' ni '-' en el identificador de la categoría (lo exige expo-notifications).
const CATEGORY_BLOCK = 'bloque';
export const START_ACTION = 'empece';
const WINDOW_DAYS = 14;
const TIMER_ID = 'timer';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CH_AGENDA, {
    name: S.reminders.channelAgenda,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CH_TIMER, {
    name: S.reminders.channelTimer,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  // Botón "Empecé" en el aviso de inicio de cada bloque. Abre la app para registrar la hora exacta.
  await Notifications.setNotificationCategoryAsync(CATEGORY_BLOCK, [
    { identifier: START_ACTION, buttonTitle: S.reminders.startAction, options: { opensAppToForeground: true } },
  ]);
}

export interface StartTap {
  bid: string;
  day: string;
  key: string;
}

/** Convierte la respuesta a un aviso en "tocó Empecé en tal bloque", o null si fue otra cosa. */
function toStartTap(r: Notifications.NotificationResponse | null): StartTap | null {
  if (!r || r.actionIdentifier !== START_ACTION) return null;
  const data = r.notification.request.content.data as { bid?: unknown; day?: unknown } | undefined;
  if (typeof data?.bid !== 'string' || typeof data?.day !== 'string') return null;
  return { bid: data.bid, day: data.day, key: `${r.notification.request.identifier}@${r.notification.date}` };
}

/** Escucha el botón mientras la app está abierta o en segundo plano. */
export function onStartTap(cb: (tap: StartTap) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const tap = toStartTap(r);
    if (tap) cb(tap);
  });
  return () => sub.remove();
}

/** Si la app se abrió desde el botón con la app cerrada, devuelve ese toque (una sola vez). */
export async function pendingStartTap(): Promise<StartTap | null> {
  try {
    const tap = toStartTap(await Notifications.getLastNotificationResponseAsync());
    if (tap) await Notifications.clearLastNotificationResponseAsync();
    return tap;
  } catch {
    return null;
  }
}

export async function notificationsGranted(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function askNotifications(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function exactAlarmsGranted(): Promise<boolean> {
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function askExactAlarms() {
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch {}
}

function dateReq(
  identifier: string,
  at: number,
  title: string,
  body: string,
  channelId: string,
  exact: boolean,
  extra?: { categoryIdentifier: string; data: Record<string, string> },
): Notifications.NotificationRequestInput {
  return {
    identifier,
    content: { title, body, ...extra },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId,
      delivery: exact ? 'alarmClock' : 'bestEffort',
    },
  };
}

export async function scheduleTimerAlert(t: TimerState) {
  try {
    if (t.endAt <= Date.now()) return;
    const exact = await exactAlarmsGranted();
    await Notifications.scheduleNotificationAsync(
      dateReq(TIMER_ID, t.endAt, S.reminders.timerTitle, t.label || S.reminders.timerDefault, CH_TIMER, exact),
    );
  } catch {}
}

export async function cancelTimerAlert() {
  try {
    await Notifications.cancelScheduledNotificationAsync(TIMER_ID);
  } catch {}
}

export async function scheduleTest() {
  try {
    const exact = await exactAlarmsGranted();
    await Notifications.scheduleNotificationAsync(
      dateReq('test', Date.now() + 5000, S.reminders.testTitle, S.reminders.testBody, CH_AGENDA, exact),
    );
  } catch {}
}

let chain: Promise<unknown> = Promise.resolve();

/** Resultado del último reprogramado de avisos (para Ajustes y la prueba del tope, T2.6). */
export interface ScheduleReport {
  at: number;
  /** Avisos que se intentaron programar. */
  planned: number;
  /** Avisos programados sin error. */
  ok: number;
  /** Primer error, si hubo. */
  error: string | null;
  /** `true` mientras se está reprogramando. */
  running: boolean;
}
let lastReport: ScheduleReport | null = null;
export const getScheduleReport = () => lastReport;

/** Reprograma los avisos de los próximos 14 días. Se llama al abrir la app y al cambiar ajustes. */
export function rescheduleAgenda(engine: AgendaEngine, s: Settings, timer: TimerState): Promise<void> {
  const run = async () => {
    lastReport = { at: Date.now(), planned: 0, ok: 0, error: null, running: true };
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const exact = await exactAlarmsGranted();
      const now = Date.now();
      const today = new Date();
      const days: ReminderDay[] = [];
      const starts = new Map<string, number>();
      for (let i = 0; i < WINDOW_DAYS; i++) {
        const d = addDays(today, i);
        starts.set(iso(d), startOfDayMs(d));
        const blocks = engine.blocksFor(iso(d));
        if (blocks && blocks.length) days.push({ date: iso(d), dayStartMs: startOfDayMs(d), blocks });
      }
      const reqs: Notifications.NotificationRequestInput[] = planReminders(days, s, (c) => engine.category(c).tracked, now).map((r) =>
        dateReq(r.id, r.at, r.title, r.body, CH_AGENDA, exact, r.start ? { categoryIdentifier: CATEGORY_BLOCK, data: r.start } : undefined),
      );
      // Avisos propios de las metas (fase 5).
      const goalItems = engine.events?.goalReminders([...starts.keys()]) ?? [];
      for (const r of planGoalReminders(goalItems, (date) => starts.get(date)!, now)) {
        reqs.push(dateReq(r.id, r.at, r.title, r.body, CH_AGENDA, exact));
      }
      const renewAt = startOfDayMs(addDays(today, WINDOW_DAYS - 1)) + 9 * 3600000;
      if (renewAt > now) {
        reqs.push(dateReq('renew', renewAt, S.reminders.renewTitle, S.reminders.renewBody, CH_AGENDA, exact));
      }
      // Un aviso que falla no corta los demás: se programan todos y se guarda el primer error.
      lastReport = { ...lastReport!, planned: reqs.length };
      for (let k = 0; k < reqs.length; k += 20) {
        const res = await Promise.allSettled(reqs.slice(k, k + 20).map((r) => Notifications.scheduleNotificationAsync(r)));
        for (const x of res) {
          if (x.status === 'fulfilled') lastReport.ok++;
          else if (!lastReport.error) lastReport.error = x.reason instanceof Error ? x.reason.message : String(x.reason);
        }
      }
      if (timer.endAt > now) await scheduleTimerAlert(timer);
    } catch (e) {
      if (lastReport && !lastReport.error) lastReport.error = e instanceof Error ? e.message : String(e);
    }
    if (lastReport) lastReport = { ...lastReport, running: false };
  };
  chain = chain.then(run, run);
  return chain as Promise<void>;
}

/** Cantidad de avisos programados en el teléfono (para la prueba del tope de avisos, T2.6). `null` si no se puede leer. */
export async function countScheduled(): Promise<number | null> {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return null;
  }
}
