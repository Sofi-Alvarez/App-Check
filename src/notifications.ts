// El plugin de import no ve los enums que expo-notifications reexporta; existen y tsc los valida.
/* eslint-disable import/namespace */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, hm, iso, startOfDayMs } from './agenda';
import { blocksFor } from './schedule';
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
    name: 'Bloques de la agenda',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CH_TIMER, {
    name: 'Timer',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  // Botón "Empecé" en el aviso de inicio de cada bloque. Abre la app para registrar la hora exacta.
  await Notifications.setNotificationCategoryAsync(CATEGORY_BLOCK, [
    { identifier: START_ACTION, buttonTitle: 'Empecé', options: { opensAppToForeground: true } },
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
      dateReq(TIMER_ID, t.endAt, 'Terminó el timer', t.label || 'Enfoque', CH_TIMER, exact),
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
      dateReq('test', Date.now() + 5000, 'Aviso de prueba', 'Así van a verse y sonar tus avisos.', CH_AGENDA, exact),
    );
  } catch {}
}

let chain: Promise<unknown> = Promise.resolve();

/** Reprograma los avisos de los próximos 14 días. Se llama al abrir la app y al cambiar ajustes. */
export function rescheduleAgenda(s: Settings, timer: TimerState): Promise<void> {
  const run = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const exact = await exactAlarmsGranted();
      const now = Date.now();
      const reqs: Notifications.NotificationRequestInput[] = [];
      const today = new Date();
      for (let i = 0; i < WINDOW_DAYS; i++) {
        const d = addDays(today, i);
        const blocks = blocksFor(d, s.anchor);
        if (!blocks) continue;
        const base = startOfDayMs(d);
        blocks.forEach((b, j) => {
          if (s.muted[b.id]) return;
          if (s.notifStart) {
            const at = base + b.s * 60000;
            const extra = b.c === 'fixed' || b.c === 'rest' ? undefined : { categoryIdentifier: CATEGORY_BLOCK, data: { bid: b.id, day: iso(d) } };
            if (at > now) reqs.push(dateReq(`ag:${iso(d)}:s${j}`, at, `${hm(b.s)} · ${b.t}`, b.n || `Hasta las ${hm(b.e)}`, CH_AGENDA, exact, extra));
          }
          if (s.endLead > 0 && b.e - b.s >= 30) {
            const at = base + (b.e - s.endLead) * 60000;
            if (at > now) reqs.push(dateReq(`ag:${iso(d)}:e${j}`, at, `Quedan ${s.endLead} min: ${b.t}`, `Termina a las ${hm(b.e)}`, CH_AGENDA, exact));
          }
        });
      }
      const renewAt = startOfDayMs(addDays(today, WINDOW_DAYS - 1)) + 9 * 3600000;
      if (renewAt > now) {
        reqs.push(dateReq('renew', renewAt, 'Abre la app', 'Ábrela para renovar los avisos de las próximas dos semanas.', CH_AGENDA, exact));
      }
      for (let k = 0; k < reqs.length; k += 20) {
        await Promise.all(reqs.slice(k, k + 20).map((r) => Notifications.scheduleNotificationAsync(r)));
      }
      if (timer.endAt > now) await scheduleTimerAlert(timer);
    } catch {}
  };
  chain = chain.then(run, run);
  return chain as Promise<void>;
}
