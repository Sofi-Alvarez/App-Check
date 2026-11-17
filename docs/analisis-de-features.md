# Análisis de features: lo que tengo, lo que me falta y lo que nadie ofrece

Fecha: 17/11/2026. Base: código de `main` (Expo / React Native, unas 2.450 líneas), `RESUMEN-03-11-2026.md`, `docs/00-diagnostico-y-flujo.md`, `docs/MODELO-DE-PRODUCTO.md` y dos rondas de investigación de competencia.

**Cómo leerlo.** "Ninguna app" significa que no lo encontré en las fuentes revisadas, no que esté demostrado que no exista. Las fuentes son reseñas y blogs, muchos de competidores. Los puntos marcados con (?) hay que confirmarlos probando la app.

Apps comparadas: Sunsama, Toggl Track, Structured, Tiimo, Motion, Reclaim, Akiflow, Amazing Marvin, Loop Habit Tracker, y trackers de empleo (Huntr, Teal, Careerflow).

---

## 1. Features que YA tengo

| # | Feature | Dónde está | ¿Lo tienen otras apps? |
|---|---|---|---|
| 1 | Agenda semanal de lunes a viernes con bloques de tiempo | `AgendaScreen`, `agenda.ts` | Sí, todas |
| 2 | Bloques fijos que nunca se mueven | `schedule.ts` | Parcial (calendarios los tienen, sin la regla de "nunca se mueven solos") |
| 3 | Categorías de tareas con color | `agenda.ts` (`Cat`) | Sí, Tiimo y Structured |
| 4 | Crear y editar tareas, "solo hoy" o "siempre", aviso de superposición, restaurar agenda | `TaskEditor`, `schedule.ts` | Sí (editar); "solo hoy / siempre" es común en calendarios |
| 5 | Sesiones con Empezar, Pausar/Reanudar y Terminar | `sessions.ts`, `AgendaScreen` | Sí, Sunsama y Toggl |
| 6 | Empezar la siguiente tarea cierra la anterior | `App.tsx` | Parcial (?) |
| 7 | "Estoy haciendo otra cosa" | `AgendaScreen` | No lo encontré |
| 8 | Cierre automático de sesiones olvidadas, marcado como "cerrada sola" y fuera de los totales | `store.ts` (`auto_close`) | No lo encontré |
| 9 | Metas con contadores (+ y −) | `GoalsScreen` | Parcial (Loop tiene hábitos numéricos) |
| 10 | Timer aparte con aviso | `TimerScreen` | Sí, Structured, Tiimo y Marvin |
| 11 | Avisos de inicio y de pre-fin de bloque | `notifications.ts` | Sí |
| 12 | Botón "Empecé" dentro del aviso | `notifications.ts` (`START_ACTION`) | No lo encontré |
| 13 | Margen de tiempo: lo que sobra o falta pasa a otra tarea elegida, sin cruzar bloques fijos | `MarginPrompt`, `schedule.ts` (`planMargin`, `applyMargin`) | Parcial: Motion y Structured reagendan, pero solos y sin que elijas |
| 14 | Registro de eventos con hora (start, pause, resume, finish, count, done, undone, margin) | `store.ts` | No lo encontré |
| 15 | Pestaña de datos con tiempo real vs. planificado, pausas y conteos | `DataScreen` | Sí, Sunsama y Toggl |
| 16 | Exportar a CSV | `sessions.ts` (`eventsToCsv`) | Parcial: Loop y Habito lo tienen; Sunsama y Motion, no lo encontré |
| 17 | Datos locales, sin cuenta ni internet | `store.ts` | Parcial: Loop lo tiene; casi todas las demás no |
| 18 | Actualizaciones por internet (EAS Update) | `app.json`, `eas.json` | No aplica al usuario |
| 19 | Recurrencia "martes con adscripción cada 14 días" | `agenda.ts` | Parcial: está escrita en el código, no es una regla editable |

---

## 2. Features que NO tengo y otras apps SÍ

Ordenadas por cuántas apps lo ofrecen y por cuánto podrían servirle a tu producto.

| # | Feature | Quién lo tiene | ¿Encaja con tu producto? |
|---|---|---|---|
| 1 | **Sincronizar con Google Calendar, Outlook e iCloud** | Casi todas (Structured, Motion, Reclaim, Morgen, Akiflow) | Alto. Te evita duplicar compromisos |
| 2 | **Cuenta, respaldo en la nube y varios dispositivos** | Casi todas | Alto. Hoy se pierde todo al desinstalar. Choca con "local primero", se resuelve con sincronización opcional |
| 3 | **Reagendado automático con IA** cuando algo cambia | Motion, Reclaim, Structured (Replan, Pro) | Medio. Tu margen es manual a propósito (decisión tuya) |
| 4 | **Prioridades y fechas límite** por tarea | Motion, Reclaim, Todoist | Medio. Tu agenda es por bloques fijos, no por lista de pendientes |
| 5 | **Bandeja de tareas sin hora** (backlog) que se arrastran al calendario | Sunsama, Akiflow, Toggl, Structured | Medio. Hoy toda tarea tiene hora |
| 6 | **Estimar duración y avisar de sobrecarga del día** | Sunsama | Alto y barato: ya tenés duraciones de bloque |
| 7 | **Ritual de planificación y cierre del día** | Sunsama; en tu v2 ya está en el flujo | Alto, ya figura en tu propuesta de flujo |
| 8 | **Partir una tarea en pasos con IA** | Tiimo | Bajo para búsqueda de empleo |
| 9 | **Rachas de hábitos y estadísticas visuales** (gráficos) | Loop, Marvin, TickTick | Medio. Tu pestaña Datos es una tabla |
| 10 | **Plantillas y onboarding** para armar la semana propia | Varias (?) | Alto. Ya está planeado como spec 008 |
| 11 | **Días no laborables** (sábado y domingo) | Todas | Medio. Hoy solo hay lunes a viernes |
| 12 | **Recurrencias editables** (cada N semanas, días elegidos) | Todas | Alto. Hoy están escritas en el código |
| 13 | **Widgets, pantalla bloqueada y reloj** | Tiimo (cuenta regresiva en reloj y pantalla bloqueada), Structured | Medio. Ayuda a tu problema de avisos en Xiaomi |
| 14 | **iOS** | Todas | Decisión de fase 5 |
| 15 | **Seguimiento de postulaciones** (kanban, contactos, CV) | Huntr, Teal, Careerflow | Medio. Podría ser integración con tu Tracker de Notion, no reemplazo |
| 16 | **Estrategias configurables** (más de 50) | Amazing Marvin | Bajo. Es lo opuesto a tu "un toque" |
| 17 | **Coach con check-ins de mañana y noche** | Rocky.ai | Medio. Es el candidato para tu "ayuda a priorizar" |
| 18 | **Programación según energía** | Marvin, Lifestack | Bajo por ahora |

---

## 3. Features que QUIERO y ninguna app tiene (según lo que encontré)

| # | Feature | Por qué parece un diferencial |
|---|---|---|
| 1 | **Reparto del margen a una tarea elegida por vos**, sin mover bloques fijos | Las apps que reagendan lo hacen solas. Ninguna te deja decidir de dónde sale o adónde va el tiempo |
| 2 | **Metas por tiempo Y por cantidad en el mismo bloque** ("5 comentarios y en cuánto tiempo") | Los timers miden tiempo, los hábitos miden cantidad. No vi una que mida las dos cosas dentro de un bloque de agenda |
| 3 | **Datos confirmados separados de los automáticos** | El cambio automático se ve pero no cuenta como dato real. No lo vi en ninguna. Es el principio 4 de tu constitución |
| 4 | **Empezar una sesión con un toque desde el aviso** | Toggl la inicia desde el bloque dentro de la app. No vi hacerlo desde el aviso |
| 5 | **Registro de eventos con hora como base** (se calculan después cosas que hoy no sabés que querés medir) | Las demás guardan resultados, no eventos. Exportar es limitado |
| 6 | **Agenda diaria con cuotas para búsqueda de empleo** (comentarios, postulaciones, contactos) | Los trackers de empleo registran postulaciones, no la rutina diaria ni las cuotas |
| 7 | **Todo lo anterior, local, sin cuenta y exportable** | Solo Loop es local, y no tiene agenda |
| 8 | **Revisión semanal con IA sobre tus datos medidos** (propuesta mía, no pedida por vos) | Motion, Structured y Tiimo usan IA para planificar. No vi ninguna que analice tiempos reales y cumplimiento de metas para decirte qué ajustar |

El punto 8 es una idea nueva, no algo que ya hayas pedido: ver `MODELO-DE-PRODUCTO.md`, sección 2.3 (H2: "si cambiaste decisiones por los datos").

---

## 4. Decisiones que salen de esto

1. **Núcleo diferencial a proteger:** los puntos 1, 2, 3 y 5 de la sección 3. Son lo que justifica una app propia.
2. **Lo que conviene copiar sin culpa** (es práctica común y no es de nadie): sincronización de calendarios, estimación de carga del día, ritual de cierre, plantillas de semana, recurrencias editables.
3. **Lo que conviene NO copiar:** estrategias configurables al estilo Marvin y auto-agendado de Motion. Chocan con "registrar cuesta un toque".
4. **A validar antes de construir:** que el margen elegible y la meta doble se usan de verdad (hipótesis H2 y H3 de tu documento de producto).

## 5. Límites del análisis

- No instalé ni probé ninguna app. Todo sale de reseñas, comparativas y páginas de ayuda.
- No hay datos de Habitify, Streaks, Timeular ni Clockify.
- No investigué apps en español ni con precios para Argentina.
- Sin confirmar (?): si Amazing Marvin tiene contadores por cantidad; si Sunsama incluye time tracking en todos sus planes; cómo se comporta cada app en Xiaomi.
