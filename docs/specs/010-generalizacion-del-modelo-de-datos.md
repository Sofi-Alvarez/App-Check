# Spec 010: Generalización del modelo de datos

Estado: borrador para aprobar. Fecha: 17/11/2026.
Depende de: nada. La spec 009 (gestión de agenda y metas) se apoya en esta.
Fuentes: `src/agenda.ts`, `src/store.ts`, `src/schedule.ts`, `src/notifications.ts`, `src/screens/GoalsScreen.tsx`, `docs/analisis-de-features.md`.

## 1. Contexto

La app nació para una sola rutina (búsqueda de empleo) y esa rutina quedó escrita en el código. El motor (sesiones, eventos, margen, avisos, CSV) ya es genérico. El contenido y las reglas, no.

Sofía aclaró que la app es una **agenda general**: si cambian sus tareas, la app tiene que seguir funcionando con otros eventos y otras metas. Esta spec define el modelo de datos que lo permite.

### 1.1 Lo que hoy está fijo en el código

| Qué | Dónde | Efecto |
|---|---|---|
| 8 categorías cerradas | `type Cat` en `agenda.ts` | No se pueden crear, renombrar ni borrar |
| 5 tipos de día | `type DayType`, `TYPE_LABEL`, `LIST_KEYS`, `LIST_LABEL` | Toda tarea vive dentro de uno de esos 5 tipos |
| Recurrencia del martes cada 14 días | `dayType()` con `settings.anchor` | Es la única regla de repetición y no se edita |
| Solo lunes a viernes | `dayType()` devuelve `null` en sábado y domingo | No se puede planificar el fin de semana |
| Metas fijas | `G_BASE`, `G_ADS`, `G_THU`, `GOAL_LABELS` | No se pueden crear, editar ni borrar |
| Progreso semanal atado a categorías | `weekRows()` en `GoalsScreen.tsx` suma `project` y `health` a mano | Una categoría nueva no cuenta para nada |
| Comportamiento atado al nombre de la categoría | `c === 'fixed'` y `c === 'rest'` en `schedule.ts`, `notifications.ts` y `AgendaScreen.tsx` | "Fijo" y "descanso" son nombres mágicos, no propiedades |
| Contenido de ejemplo en el código | notas con "/jobs", "Tracker", LinkedIn | Otra persona vería la rutina de Sofía |
| Fecha ancla `2026-11-03` | `DEFAULT_SETTINGS.anchor` | La recurrencia depende de una fecha global |

### 1.2 Lo que se conserva

- El registro de eventos append-only (`LogEvent`) y el cálculo de sesiones. Es el núcleo.
- La separación entre dato confirmado y dato automático (`source`: `manual`, `next`, `auto_close`).
- La regla del margen: lo fijo nunca se mueve, el traspaso no cruza bloques fijos, ninguna tarea baja de 5 minutos.
- Los identificadores de bloque existentes, porque el registro histórico los usa como `bid`.

## 2. Principios

1. **Todo lo que hoy es una constante del código pasa a ser un dato que la persona crea.**
2. **El comportamiento viene de propiedades, no de nombres.** "Fija" es una propiedad de la categoría, no la palabra `fixed`.
3. **Nada de lo ya registrado se pierde ni cambia de significado.** La migración conserva `bid`, `cat` y `goal` de los eventos.
4. **Un mismo modelo para eventos puntuales y repetidos.** Un evento que se repite es una serie; uno puntual es una serie de un solo día.
5. **El historial no se reescribe.** Editar o borrar una meta o una categoría no altera lo que se midió.

## 3. Modelo de datos

### 3.1 Categoría

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto estable | Los ids semilla conservan el valor actual (`rest`, `health`, `work`, `content`, `project`, `english`, `fixed`, `close`) para no romper el registro |
| `name` | texto | Lo elige la persona |
| `color` | token de paleta | Una paleta cerrada de colores accesibles, no libre |
| `movable` | booleano | `false` = bloque fijo: el margen no lo mueve ni lo cruza. Reemplaza `c === 'fixed'` |
| `tracked` | booleano | `true` = ofrece Empezar, timer y botón "Empecé" en el aviso. Reemplaza `c === 'fixed' \|\| c === 'rest'` |
| `marginPreference` | `normal` o `avoid` | `avoid` = no se propone por defecto para recibir margen. Reemplaza `cat !== 'rest'` |
| `archived` | booleano | Para quitar una categoría de las opciones sin romper el historial |

Equivalencias de migración:

| Categoría actual | `movable` | `tracked` | `marginPreference` |
|---|---|---|---|
| `fixed` | no | no | normal |
| `rest` | sí | no | avoid |
| `close` | sí | sí | normal |
| las demás (`health`, `work`, `content`, `project`, `english`) | sí | sí | normal |

### 3.2 Serie de eventos (reemplaza bloques por tipo de día)

Un **evento** de la agenda es una serie con una regla de repetición. Esto reemplaza a `DayType`, `Sched`, `defaultBlocks()` y `dayType()`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto estable | Los bloques migrados conservan su id actual (`mwf:420`, `u-...`) |
| `title` | texto | |
| `categoryId` | id de categoría | |
| `startMin`, `endMin` | minutos desde la medianoche | Dentro del mismo día. Fin mayor que inicio, duración mínima 5 |
| `note` | texto | Opcional |
| `rule` | regla o `null` | `null` = evento de un solo día |
| `startDate` | fecha `AAAA-MM-DD` | Primer día en que puede ocurrir |
| `endDate` | fecha o `null` | `null` = sin fin |
| `reminder` | `{ atStart, endLead }` o `null` | `null` usa los valores globales de Ajustes |
| `archived` | booleano | |

**Regla de repetición** (`rule`):

| Campo | Notas |
|---|---|
| `weekdays` | lista de 0 a 6 (domingo a sábado). Incluye fin de semana |
| `everyWeeks` | entero 1 o más. 1 = cada semana, 2 = cada dos semanas |

Una fecha cumple la regla si: está entre `startDate` y `endDate`, su día de la semana está en `weekdays`, y el número de semanas entre el lunes de `startDate` y el lunes de esa fecha es múltiplo de `everyWeeks`.

La regla actual "martes con adscripción cada 14 días desde `2026-11-03`" queda como `weekdays: [2]`, `everyWeeks: 2`, `startDate: 2026-11-03`. "Martes sin adscripción" es lo mismo con `startDate: 2026-11-10`. El "ancla" deja de ser un ajuste global y pasa a ser la `startDate` de cada serie.

**Repetición mensual (agregada el 17/11/2026, después del plan).** La regla puede ser semanal (la de arriba; los datos guardados antes no tienen `kind` y se leen como semanales) o mensual, con `kind: 'monthly'`:

| Campo | Valor |
|---|---|
| `everyMonths` | entero 1 o más, contado desde el mes de `startDate` |
| `on` | `{ day: 1 a 31 }` ("el día 17") o `{ nth: 1, 2, 3, 4 o −1, weekday: 0 a 6 }` ("el tercer martes"; −1 = "el último viernes") |

Si el día del mes no existe en un mes (29, 30 o 31 en un mes más corto), ese mes el evento cae el último día del mes, así no se saltea ningún mes. El editor ofrece las opciones a partir del día que se está mirando: "El día 17", "El tercer martes" y, si es la última semana del mes, "El último martes". Los alcances, las excepciones, los avisos y las metas funcionan igual que con la semanal.

Fuera de esta versión: repetición anual.

### 3.3 Excepción

Cambio que afecta a una sola fecha de una serie. Es lo que hoy hace `saveOverride` y lo que hace el margen.

| Campo | Notas |
|---|---|
| `seriesId` | |
| `date` | La fecha afectada |
| `kind` | `cancelled` o `modified` |
| `fields` | Solo para `modified`: cualquiera de `title`, `categoryId`, `startMin`, `endMin`, `note` |

Una fecha tiene como máximo una excepción por serie.

### 3.4 Cómo se arma un día

Para una fecha:

1. Tomar todas las series cuya regla cumple esa fecha (o cuya `startDate` es esa fecha y no tienen regla).
2. Descartar las que tienen una excepción `cancelled` ese día.
3. Aplicar los `fields` de las excepciones `modified`.
4. Ordenar por inicio y luego por fin.

Esto reemplaza `blocksFor()`. El resultado tiene la misma forma que el `Block` actual para que `AgendaScreen`, `planMargin` y las notificaciones sigan funcionando.

### 3.5 Meta

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto estable | Los ids semilla conservan `post`, `com`, `rea`, `cold`, `fol`, `apl` |
| `name` | texto | |
| `kind` | `quantity`, `time` o `both` | Cantidad (comentarios), tiempo (minutos de un bloque) o las dos |
| `unit` | texto | "comentarios", "páginas", "series". Vacío si es solo tiempo |
| `target` | número o `null` | `null` = se cuenta sin objetivo (hoy "Postulaciones") |
| `period` | `day` o `week` | Período sobre el que se compara el objetivo |
| `links` | lista de ids de serie | A qué eventos está asociada. Vacía = meta global, no atada a un bloque |
| `activeDays` | lista de 0 a 6 | En qué días aplica. Por defecto, los días de los eventos asociados |
| `reminder` | hora o `null` | Aviso propio, como en Loop. Opcional |
| `archived` | booleano | |

**Versiones de una meta.** Cambiar `target`, `period` o `activeDays` crea una versión con `effectiveFrom` (fecha). El progreso de un día se compara con la versión vigente ese día. Así subir una meta de 5 a 10 comentarios no vuelve "incumplidos" los días pasados.

**Cómo se calcula el progreso.**

- `quantity`: suma de los eventos `count` de esa meta en el período.
- `time`: suma de minutos de las sesiones confirmadas de las series asociadas en el período. Las sesiones cerradas solas (`auto_close`) no cuentan, igual que hoy.
- `both`: las dos cuentas por separado. La pantalla muestra cantidad y tiempo, y puede calcular "cantidad en cuántos minutos" (por ejemplo, 5 comentarios en 18 minutos).

Esto reemplaza `goalsFor()`, `GOAL_LABELS` y los cálculos fijos de `weekRows()`. El progreso de "Proyecto" y "Ejercicio" pasa a ser una meta de tiempo y una de cantidad asociadas a esos eventos, no un caso especial por categoría.

### 3.6 Plantilla

Conjunto de categorías, series y metas que se puede aplicar de una vez. Sirve para la pantalla de bienvenida y para importar una rutina.

| Campo | Notas |
|---|---|
| `id`, `name`, `description`, `language` | |
| `categories`, `series`, `goals` | Con ids locales de la plantilla |

Aplicar una plantilla **copia** sus elementos con ids nuevos y fija un `startDate` elegido por la persona. No queda ningún vínculo con la plantilla: editarla después no cambia lo ya aplicado.

La rutina de búsqueda de empleo de Sofía deja de ser código y pasa a ser la primera plantilla (`busqueda-de-empleo`), con sus notas de ejemplo. Otras plantillas posibles: semana de estudio, semana con ejercicio, plantilla vacía.

### 3.7 Registro de eventos

`LogEvent` conserva su forma. Cambios:

- `bid`: id del evento (serie) y no de la posición. Para eventos migrados, el valor es el mismo que hoy.
- `cat`: id de categoría, no un nombre fijo. Se agrega `catName` como copia del nombre al momento del registro.
- `goal`: id de meta. Se agrega `goalName` como copia, por si la meta se borra o se renombra después.
- Se agrega `occurrenceDate` (ya existe como `day`) y se conserva `title` como copia del título del momento.

Las copias de nombre garantizan que el CSV siga siendo legible aunque se edite o se elimine la categoría, la meta o el evento.

### 3.8 Ajustes

`Settings.anchor` se elimina. `muted` pasa a guardarse por id de evento, no por posición. `notifStart`, `endLead` y `wake` se conservan.

## 4. Almacenamiento y migración

### 4.1 Decisión de almacenamiento

**Recomendado:** crear una capa de acceso (`repository`) con funciones como `getDay(date)`, `saveSeries()`, `listGoals()`, y que el resto de la app solo use esa capa. Hoy los datos están en `expo-sqlite/kv-store` como JSON. Primero se migra el modelo manteniendo el almacén actual, con una clave `schemaVersion`. Pasar a tablas relacionales queda como un paso posterior que solo toca la capa de acceso.

Razón: el almacén actual alcanza para la cantidad de datos de una persona y cambiar modelo y motor a la vez duplica el riesgo. Si la fase de consultas lo exige (estadísticas), la capa permite cambiar sin tocar las pantallas. Es una recomendación a confirmar.

### 4.2 Migración de datos existentes

Se ejecuta una sola vez al abrir la versión nueva, detrás de una marca `schemaVersion = 2`. Antes de escribir nada se guarda una copia del estado anterior bajo claves con prefijo `backup:v1:` para poder volver.

| Dato actual | Pasa a |
|---|---|
| `agenda:sched` y `defaultBlocks(type)` por cada tipo de día | Series. Cada bloque conserva su `id`. `mwf` → `weekdays [1,3]`, `thu` → `[4]`, `fri` → `[5]`, `tueAds` → `[2]` cada 2 semanas desde la ancla, `tueOff` → `[2]` cada 2 semanas desde la ancla más 7 días |
| `agenda:ovr:<fecha>` | Excepciones `modified` y `cancelled` por cada bloque que difiere de la serie ese día. Las tareas agregadas "solo hoy" pasan a ser series de un día |
| `agenda:day:<fecha>` con `done` y `counts` | Sin cambios: las marcas de hecho siguen indexadas por id de bloque. Los `counts` se mantienen y se muestran con las metas migradas |
| `agenda:log:<fecha>` (eventos) | Sin cambios de contenido. Se completan `catName` y `goalName` al migrar |
| `Settings.anchor` | Se usa para calcular las `startDate` de las series del martes y se elimina |
| 8 categorías | Se crean como categorías con los ids actuales y las propiedades de la tabla de 3.1 |
| Metas `G_BASE`, `G_ADS`, `G_THU` | 6 metas con los ids actuales. `post` pasa de "1 por día" a una meta con `activeDays` según cada día. `G_THU` y `G_ADS` se expresan con `activeDays` y `links` |

**Caso difícil: un mismo id en varios tipos de día con horarios distintos.** Con "Siempre" se guardaba la misma tarea en varias listas, y ediciones posteriores a una sola lista pueden haberlas hecho divergir. Si los horarios coinciden se unen en una sola serie con la unión de días. Si difieren, se crea una serie por tipo de día y las nuevas reciben un id propio; se guarda una tabla `legacyBid` para que el registro histórico siga uniéndose al id original. Este caso hay que probarlo con los datos reales del teléfono antes de publicar.

### 4.3 Reversibilidad

Si la migración falla a mitad de camino, la app queda en el estado anterior y vuelve a intentar en la siguiente apertura. No se borran las claves `backup:v1:` hasta que Sofía confirme, en Ajustes, que todo está bien (o tras 30 días).

## 5. Criterios de aceptación

Formato dado / cuando / entonces. Cada uno debe convertirse en una prueba automática sobre funciones puras (sin pantalla).

**Categorías**

- **CA-01** Dado que existen las 8 categorías semilla, cuando se migra, entonces cada una conserva su id y las propiedades de la tabla de 3.1.
- **CA-02** Dado que creo la categoría "Lectura" con `tracked = true` y `movable = true`, cuando la asigno a un evento, entonces el evento ofrece Empezar y el aviso trae el botón "Empecé".
- **CA-03** Dado que una categoría tiene `movable = false`, cuando se calcula el margen de una tarea anterior, entonces el traspaso no cruza un evento de esa categoría.
- **CA-04** Dado que una categoría tiene `marginPreference = avoid`, cuando se propone el destino del margen por defecto, entonces no se elige un evento de esa categoría si hay otro posible.

**Recurrencia y armado del día**

- **CA-05** Dado una serie con `weekdays [2]`, `everyWeeks 2` y `startDate 2026-11-03`, cuando se pide el 03/11, el 10/11 y el 17/11, entonces aparece el 03/11 y el 17/11 pero no el 10/11.
- **CA-06** Dado una serie con `weekdays [6, 0]`, cuando se pide un sábado y un domingo, entonces aparece en ambos. (Hoy el fin de semana devuelve vacío.)
- **CA-07** Dado una serie con `endDate`, cuando se pide una fecha posterior, entonces no aparece.
- **CA-08** Dado una excepción `cancelled` el 17/11, cuando se arma ese día, entonces la serie no aparece ese día y sí aparece el 24/11.
- **CA-09** Dado una excepción `modified` con `endMin` distinto, cuando se arma el día, entonces el evento aparece con ese fin y el resto de los campos de la serie.
- **CA-10** Dado una fecha con dos series que se pisan en horario, cuando se arma el día, entonces ambas aparecen ordenadas por inicio.

**Metas**

- **CA-11** Dado una meta `quantity` con objetivo 5 por día, cuando registro 7 conteos en un día, entonces el progreso es 7 de 5.
- **CA-12** Dado una meta `time` asociada a una serie, cuando hay una sesión confirmada de 40 minutos y una cerrada sola de 30, entonces el progreso es 40 minutos.
- **CA-13** Dado una meta `both`, cuando registro 5 conteos y 18 minutos en la misma sesión, entonces la pantalla puede mostrar "5 en 18 min".
- **CA-14** Dado que el objetivo de una meta sube de 5 a 10 el 20/11, cuando consulto el 18/11, entonces se compara contra 5.
- **CA-15** Dado una meta sin `target`, cuando miro la semana, entonces se muestra el total sin porcentaje.

**Historial y migración**

- **CA-16** Dado el estado real de la app antes de migrar, cuando se migra, entonces para cada día con registro la cantidad de sesiones, pausas y conteos calculados es idéntica a la de antes.
- **CA-17** Dado que borro una categoría o una meta, cuando exporto el CSV, entonces las filas antiguas muestran el nombre que tenían (`catName`, `goalName`).
- **CA-18** Dado que la migración falla a mitad de camino, cuando reinicio la app, entonces los datos anteriores están intactos y la migración se vuelve a intentar.
- **CA-19** Dado el caso de un id repetido con horarios distintos entre tipos de día, cuando se migra, entonces cada ocurrencia histórica sigue asociada a su evento correcto vía `legacyBid`.

## 6. Casos límite

- Una serie sin días en `weekdays`: no se permite guardar.
- Una meta asociada a una serie que se elimina: la meta queda sin asociación y pasa a ser global; no se borra.
- Una categoría eliminada que todavía tiene eventos: no se puede eliminar, se debe reasignar o archivar (detalle en la spec 009).
- Cambio de huso horario o de horario de verano: las horas son locales y se interpretan en el huso actual del teléfono.
- Eventos que cruzan la medianoche: quedan fuera de esta versión (decisión 1).

## 7. Fuera de alcance

- Cuenta, sincronización y respaldo en la nube.
- Repetición mensual o anual.
- Sincronización con Google Calendar u Outlook.
- Cambio a base relacional (ver 4.1).
- IA de cualquier tipo.
- iOS.

## 8. Decisiones tomadas (17/11/2026)

| # | Decisión | Estado |
|---|---|---|
| 1 | Los eventos **no cruzan la medianoche** por ahora. `startMin` y `endMin` quedan dentro del mismo día | Cerrada |
| 2 | Almacén actual con capa de acceso, y pasar a tablas después (4.1) | Cerrada |
| 3 | El tope de avisos se prueba en el Xiaomi (ver spec 009, decisión 2) | Pendiente de prueba |
| 4 | Vocabulario de alcance: "Solo hoy", "A partir de hoy" y "Siempre" (ver spec 009) | Cerrada |

## 9. Preguntas abiertas

1. **¿La serie es el modelo correcto?** Es el que usan Google Calendar y Structured y permite los tres alcances de edición. La alternativa es mantener "tipos de día" renombrables, que es más simple pero no permite "este y los siguientes".
2. ~~Almacén actual o tablas~~ Decidido: almacén actual con capa de acceso.
3. ~~Eventos que cruzan la medianoche~~ Decidido: no por ahora.
4. **¿La paleta de colores es cerrada o libre?** Recomendado cerrada, por contraste y accesibilidad.
5. **¿Cuántas plantillas se incluyen al lanzar?** Mínimo: vacía y la de Sofía como ejemplo.
6. **¿La meta de tiempo debe contar también bloques sin sesión (solo marcados como hechos)?** Recomendado que no: solo sesiones confirmadas.
