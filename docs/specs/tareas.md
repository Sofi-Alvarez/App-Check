# Plan de tareas: generalización y gestión de agenda y metas

Estado: borrador para aprobar. Fecha: 17/11/2026.
Specs de origen: `010-generalizacion-del-modelo-de-datos.md` (criterios `CA-01` a `CA-19`) y `009-gestion-de-agenda-y-metas.md` (criterios `CG-01` a `CG-32`).
Los plazos son estimaciones gruesas por tamaño (S, M, L), no fechas. Sirven para ordenar.

## 1. Cómo leer este plan

- **Una tarea = un cambio que se puede probar solo.** Termina con typecheck, lint y pruebas en verde, como pide `AGENTS.md`.
- **Cada fase termina en el teléfono.** El diagnóstico del 09/11 reconoció que la versión actual nunca se corrió en un teléfono antes de entregarla. Por eso cada fase tiene una prueba manual en el Redmi, y no se pasa a la siguiente sin ella.
- **La lógica va en funciones puras**, en `src/domain/`, sin importar nada de React Native ni de Expo. Así los criterios de aceptación se convierten en pruebas automáticas que corren sin teléfono.
- **Tamaños:** S = menos de medio día, M = alrededor de un día, L = varios días.

## 2. Decisiones que hay que tomar antes de empezar

### D1. ¿En la misma app o en una app nueva al lado?

`00-diagnostico-y-flujo.md` propone que la v2 sea un proyecto aparte, con otro identificador de app, instalada junto a la actual para no perder los datos de la semana de pruebas. La spec 010 asume una migración en el lugar. No se pueden las dos cosas a la vez.

| Opción | Ventaja | Riesgo |
|---|---|---|
| **A. En la misma app** (migración en el lugar) | Un solo producto y se conserva el historial automáticamente | Si la migración falla en tu teléfono, afecta los datos reales. Se mitiga con la copia de seguridad (T0.1) |
| **B. App nueva al lado** (importar desde una copia) | La actual sigue intacta como respaldo | Hay que mantener dos apps un tiempo y construir una importación |

**Recomendación:** A, pero solo después de exportar la copia de seguridad (T0.1) y de terminar tu semana de pruebas de datos. Si todavía estás juntando datos en la app actual, B es más seguro.

**Decisión (17/11/2026): A, migrar en la misma app.** Condición que se mantiene: no se publica ninguna migración (fase 1) antes de tener la copia de seguridad de T0.1 guardada fuera del teléfono.

### D2. Tope de avisos

Hay que medir en el Xiaomi cuántas alarmas aguanta antes de decidir cómo acortar la ventana de 14 días (spec 009, decisión 2). Está incluido como T2.6.

### D3. Navegación

`AGENTS.md` pide Expo Router, pero la app usa una navegación propia por pestañas en `App.tsx`. Este plan **no** cambia la navegación. Si querés migrarla a Expo Router o pasar a Hoy / Semana / Ajustes, es un trabajo aparte (spec 011, no escrita).

## 3. Mapa de dependencias

```
Fase 0 Preparación
   │
   ▼
Fase 1 Modelo y migración ──► Fase 2 Motor ──► Fase 3 Eventos ──► Fase 4 Categorías
                                   │                                    │
                                   └────────────► Fase 5 Metas ◄────────┘
                                                      │
                                                      ▼
                                               Fase 6 Cierre
```

Las fases 4 y 5 se pueden hacer en cualquier orden entre sí una vez terminada la 3, pero la 5 usa las categorías, así que conviene la 4 primero.

---

## Fase 0. Preparación

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T0.1 ✅ | **Exportar copia de seguridad completa** (JSON con todas las claves del almacén) desde Ajustes, además del CSV de uso. Hoy el CSV solo tiene el registro de uso, no la agenda editada ni las marcas de hecho. Se publica por actualización por internet *antes* de cualquier migración | S | nada | seguridad de CA-18 |
| T0.2 ✅ | **Infraestructura de pruebas.** Instalar el corredor de pruebas con `npx expo install` (según la versión de Expo, confirmar en la documentación de SDK 58 antes) y agregar el script `test`. Solo dependencias de desarrollo: no hace falta un APK nuevo | S | nada | base de todos los CA y CG |
| T0.3 ✅ | **Script `typecheck`** en `package.json` (`tsc --noEmit`) y un flujo en GitHub Actions que corra typecheck, lint y pruebas en cada push | S | T0.2 | calidad |
| T0.4 ✅ | **Datos de prueba.** Fixtures sintéticas generadas desde `defaultBlocks()` y un registro de uso de ejemplo. No se suben datos reales de personas ni notas privadas al repositorio | S | T0.2 | CA-16, CA-19 |

**Estado de T0.1 (17/11/2026).** Implementada en `src/domain/backup.ts` (partes, verificación y lectura de copias, 11 comprobaciones pasadas con un script provisional), `loadAllEntries()` en `src/store.ts` y una tarjeta "Copia de seguridad" en Ajustes. Typecheck y lint pasan. **Publicada y probada en el Redmi (17/11/2026):** la actualización por internet llegó y la exportación mostró "Copia lista: 21 claves, 68 KB, en 1 parte". Sofía confirmó que el texto empieza con `"format":"agenda-backup"` y que la guardó en Google Drive (una primera copia enviada por WhatsApp puede haber quedado cortada por el límite de largo de mensaje, por eso se rehízo en Drive). **T0.1 cerrada.** Se decidió no achicar las partes por ahora. No hay restauración todavía: la copia sirve para recuperar a mano y para la fase 1.

**Estado de T0.2 (17/11/2026).** Jest 30 con el preset `jest-expo ~58.0.13`, según la guía de pruebas de Expo SDK 58. Se instaló con `EXPO_OFFLINE=1 npx expo install jest-expo jest @types/jest --dev`, porque `api.expo.dev` está bloqueado en la red de la sesión; el modo sin conexión usa la tabla de versiones del paquete `expo` y da la misma versión de `jest-expo`. Scripts `test` y `test:watch`, `"types": ["jest"]` en `tsconfig.json` y `coverage/` en `.gitignore`. Las 11 comprobaciones provisionales de T0.1 pasaron a 16 pruebas en `src/domain/__tests__/backup-test.ts`. Convención: las pruebas van en `__tests__/` junto al código, con nombre `*-test.ts`. Solo dependencias de desarrollo: no requiere APK ni actualización por internet.

**Estado de T0.3 (17/11/2026).** Script `npm run typecheck` (`tsc --noEmit`) y flujo `.github/workflows/ci.yml` que corre `npm ci`, typecheck, lint y pruebas en cada push y pull request, con Node 22 (cumple el `^22.13.0` que pide Expo SDK 58). No compila ni publica la app. Verificado en local: los tres pasos y `npm ci` pasan.

**Estado de T0.4 (17/11/2026).** Tres piezas:
- `src/__fixtures__/v1-store.ts`: almacén v1 sintético armado desde `defaultBlocks()` (ids reales, datos inventados). Incluye a propósito cada caso que la migración tiene que resolver: un bloque original con horario editado cuyo id ya no coincide con su inicio, una tarea nueva en dos listas con el mismo horario (`u-lectura`), el caso difícil de la misma tarea con horarios distintos (`u-yoga`), una eliminación con "Siempre", una eliminación y un agregado "Solo hoy", un margen aceptado y uno rechazado, una sesión cerrada sola, una abierta, pausas, conteos sueltos y marcas de hecho y deshecho. `EXPECTED` guarda la línea base calculada a mano (46 eventos, 9 sesiones, etc.) para el criterio CA-16.
- `src/migration/v1-reader.ts`: lector puro del formato actual, que reproduce `listFor()` y `blocksFor()`. Nada se descarta en silencio: lo que no reconoce o no puede leer queda en `unknown`. Adelanta parte de T1.5.
- `src/storeShape.ts`: los tipos y valores por defecto del almacén pasaron a un archivo sin dependencias de Expo, para poder usarlos en pruebas. `store.ts` los reexporta, así que la app no cambia.

Hallazgo: los eventos guardan el horario planificado del momento del toque. Si después se aplica un margen ese día, la agenda del día cambia y los eventos anteriores conservan el horario viejo. La migración debe tratarlos como historia y no corregirlos (prueba incluida).

Verificación: 45 pruebas pasan en cuatro zonas horarias (Argentina, UTC, Los Ángeles y Kiritimati), y fallan si se rompe el lector (probado quitando las ediciones de un día y descartando claves desconocidas). Typecheck y lint limpios.

**Salida de la fase:** podés bajar una copia de seguridad desde el teléfono, y `npm test` y `npm run typecheck` corren vacíos pero en verde. **Fase 0 completa (17/11/2026).**

---

## Fase 1. Modelo de datos y migración (spec 010)

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T1.1 ✅ | **Tipos del dominio** en `src/domain/types.ts`: categoría, serie, regla, excepción, meta, versión de meta, plantilla | S | T0.2 | 010 §3 |
| T1.2 ✅ | **Expansión de series**: `occursOn(serie, fecha)` y `buildDay(fecha, estado)` (010 §3.4). Mismo formato de bloque que hoy, para no romper pantallas | M | T1.1 | CA-05, 06, 07, 08, 09, 10 |
| T1.3 ✅ | **Capa de acceso** (`repository`) sobre el almacén actual, con `schemaVersion`, y una versión en memoria para las pruebas | M | T1.1 | 010 §4.1 |
| T1.4 ✅ | **Categorías semilla** con las propiedades de 010 §3.1 y su mapeo desde los ocho nombres actuales | S | T1.1 | CA-01 |
| T1.5 ✅ | **Migración v1 a v2** como función pura (entrada: claves actuales; salida: claves nuevas). Idempotente. Copia previa bajo `backup:v1:`. Maneja el id repetido con horarios distintos y crea `legacyBid` | L | T1.2, T1.3, T1.4 | CA-16, CA-18, CA-19 |
| T1.6 ✅ | **Plantilla `busqueda-de-empleo`**: sacar de `agenda.ts` el contenido (bloques, notas, metas) y dejarlo como datos de plantilla | M | T1.1 | 010 §3.6 |
| T1.7 ✅ (modo prueba) | **Conectar la migración al arranque** (`App.tsx`), con marca de versión, reintento si falla y aviso claro si no se pudo | S | T1.5 | CA-18 |

**Estado de T1.1 a T1.6 (17/11/2026).** Hechas en código, con 119 pruebas en verde (typecheck, lint y empaquetado para Android también pasan). **La app todavía no usa nada de esto**: se conecta en T1.7, que no está hecha.

| Tarea | Dónde | Qué quedó |
|---|---|---|
| T1.1 | `src/domain/types.ts`, `src/domain/dates.ts` | Tipos del modelo v2 (categoría, serie, regla, excepción, meta con versiones, plantilla, ajustes v2) y fechas sin zona horaria |
| T1.2 | `src/domain/recurrence.ts` | `occursOn`, `buildDay` y validación de series y reglas. Criterios CA-05 a CA-10 |
| T1.3 | `src/data/` | Capa de acceso sobre un almacén clave-valor intercambiable (`expoKV` en el teléfono, `memoryKV` en pruebas). Claves nuevas `agenda2:*` y `agenda:schemaVersion`; las de uso de la v1 no cambian. Una clave dañada lanza un error explícito |
| T1.4 | `src/domain/categories.ts` | Las 8 categorías con sus ids, nombres de la leyenda, colores como tokens y propiedades que reproducen el comportamiento actual. Criterio CA-01 |
| T1.5 | `src/migration/v1-to-v2.ts` | Migración pura con autoverificación día por día (del primer dato a 8 semanas en el futuro) y reintento seguro desde la copia. Criterios CA-16, CA-18 y CA-19 |
| T1.6 | `src/domain/templates/` | Tu rutina como datos (`busqueda-de-empleo.json`, 66 series y 8 metas), la plantilla vacía y `applyTemplate`. Aplicada desde un martes con adscripción reproduce la agenda original durante 8 semanas |

**Decisiones tomadas en la implementación (para revisar):**
1. **Marcas de hecho de una serie separada.** La spec decía que `agenda:day:*` no cambia, pero si una tarea se separa en dos series (caso `u-yoga`), la marca de hecho del jueves quedaría apuntando a un id que ese día ya no existe. La migración reescribe solo esos días y lo informa en `renamedDone`. La copia guarda el valor original.
2. **Metas por día de la semana.** La v1 distinguía martes con y sin adscripción; la v2 usa días de la semana. Solo afecta a "Postulaciones", que no tiene objetivo.
3. **"Proyecto" y "Ejercicio"** pasan a metas de tiempo semanales sin objetivo, asociadas a las series de esas categorías. La v1 calculaba horas planificadas hechas y sesiones marcadas; el cálculo nuevo se decide en T2.5.
4. **Tarea "Solo hoy" con un id que ya usa otra serie:** recibe un id propio (`<id>@<fecha>`) vinculado al original en `legacyBid`.
5. **Ediciones de sábado o domingo** (la v1 nunca las mostró): no se migran, se informan y quedan en la copia.
6. **Categorías con un id desconocido** en la agenda guardada: se crean como categoría nueva con el id como nombre, para no perder el evento.

**Hallazgo corregido por las pruebas:** con el almacén vacío (instalación nueva), la migración fallaba al calcular el último día a verificar. Está corregido y probado.

**Verificación de la autoverificación:** si se invierten las semanas de los martes, la migración se niega a escribir ("no coincide con la actual en 11 días").

**Estado de T1.7 (17/11/2026).** La migración corre al abrir la app (`src/migration/startup.ts`, conectada en `App.tsx`) y su resultado se ve en una tarjeta de Ajustes con un botón "Compartir informe". Decisiones aceptadas por Sofía para las seis situaciones de la migración (ver arriba).

**Se publica en modo prueba (`MIGRATION_MODE = 'dry-run'`)**: corre la migración completa con los datos reales del teléfono, en memoria, y **no escribe nada**. Motivo: si se aplicara ya, la app seguiría leyendo y editando con el formato viejo hasta la fase 2, y cualquier edición de esos días no llegaría al modelo nuevo. El modo `apply` (escribe de verdad, avisa si se niega y reintenta si se corta) está implementado y probado, y se activa en la entrega E2 junto con la fase 2. El informe compartido no incluye títulos ni notas de las tareas.

Verificación: 132 pruebas (13 de T1.7, incluida una que comprueba que el modo prueba no escribe ni una clave), typecheck, lint, empaquetado para Android y CI.

**Resultado en el teléfono (17/11/2026).** Sofía publicó la actualización y compartió el informe: "Modo: dry-run · Estado: ok · Prueba correcta · 66 eventos en el formato nuevo · 72 días revisados, sin diferencias". Sin casos especiales: ninguna tarea separada, ninguna marca de hecho reescrita, ninguna edición de un día, de fin de semana ni datos desconocidos. Los 66 eventos coinciden con la plantilla original, así que en sus datos actuales no hay ediciones de la agenda. **La migración queda validada con datos reales. Fase 1 completa en modo prueba**; la migración real se activa en E2, al final de la fase 2.

**Prueba en el teléfono (obligatoria):**
1. Exportar la copia de seguridad (T0.1) y guardarla fuera del teléfono.
2. Instalar la versión con la migración.
3. Comparar, para tres días con registro, la agenda, las marcas de hecho y los conteos con los de antes (criterio CG-32 y CA-16).
4. Abrir la pestaña Datos y verificar que las sesiones, pausas y conteos de la semana coinciden con el CSV anterior.

**Salida de la fase:** los datos están en el modelo nuevo y la app, vista desde afuera, **se ve y se comporta igual** (todavía con las pantallas viejas leyendo del modelo nuevo a través de un adaptador).

---

## Fase 2. Motor sobre el modelo nuevo (sin pantallas nuevas)

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T2.1 ✅ | **Reemplazar `blocksFor`, `dayType`, `listFor` y `loadOverride`** en `schedule.ts` por `buildDay`. Quitar `settings.anchor` y todo uso de `DayType` (incluido el listado de martes con adscripción en Ajustes) | M | T1.7 | CA-05 a 10 |
| T2.2 ✅ | **Margen con propiedades de categoría** (`movable`, `marginPreference`) y escritura como excepción `modified`. Se portan los casos actuales como pruebas de regresión | M | T2.1 | CA-03, CA-04 |
| T2.3 ✅ | **Registro con copias de nombre**: `catName`, `goalName` y título del momento; `bid` = id de la serie. Actualizar `eventsToCsv` con las columnas nuevas | S | T2.1 | CA-17 |
| T2.4 ✅ | **Avisos con el modelo nuevo**: usar `tracked` en lugar de nombres de categoría, silenciar por id de evento, soportar fin de semana. Extraer la construcción de avisos a una función pura para poder probarla | M | T2.1 | CG-30, CG-31 |
| T2.5 ✅ | **Motor de progreso de metas** (cantidad, tiempo, ambas, versiones por fecha). Reemplaza `goalsFor`, `GOAL_LABELS` y `weekRows()` | L | T2.1, T1.4 | CA-11 a 15 |
| T2.6 🔶 preparada | **Prueba del tope de avisos en el Xiaomi** (D2): programar eventos diarios en 14, 7 y 3 días y medir cuántos suenan. Resultado: decidir el largo de la ventana. Es una prueba, no un desarrollo | S | T2.4 | spec 009 decisión 2 |

**Estado de la fase 2 (17/11/2026).** Hecha en código, con 164 pruebas en verde (typecheck, lint y empaquetado para Android también pasan).

**Diseño: un motor de agenda con dos implementaciones** (`src/engine/`). Las pantallas hablan con un contrato (`AgendaEngine`) y no saben de dónde vienen los datos:
- `v1.ts` envuelve el código que ya funcionaba (`schedule.ts`, `store.ts`) sin cambiarlo.
- `v2.ts` hace lo mismo sobre el modelo nuevo. `legacy-ops.ts` traduce "Solo hoy", "Siempre" por tipo de día, el margen, restaurar y mover los martes a series y excepciones.
- La app elige el motor al arrancar (`boot()` en `App.tsx`): v2 solo si la migración real ya corrió y los datos nuevos se leen bien; si no, sigue con v1. El formato viejo no se borra nunca, así que la app no puede quedar sin agenda.

| Tarea | Qué quedó |
|---|---|
| T2.1 | La agenda del día, el evento actual, las listas por tipo de día y los martes salen del motor. En v2, sin ancla en los ajustes (queda una clave de transición `agenda2:legacyTueAnchor` para el vocabulario actual, hasta la fase 3) |
| T2.2 | Margen sobre las propiedades de la categoría (`movable`, `marginPreference`) en `src/engine/margin.ts`; en v2 se guarda como excepciones del día |
| T2.3 | El registro guarda `catName` y `goalName` (opcionales: los eventos anteriores no los tienen). El CSV suma dos columnas al final: `categoria_nombre` y `objetivo_nombre` |
| T2.4 | Avisos desde el motor con un plan puro (`src/reminders.ts`): el botón "Empecé" depende de `tracked`, y funcionan en cualquier día con eventos |
| T2.5 | Motor de progreso (`src/domain/goals.ts`): cantidad, tiempo con sesiones confirmadas, ambas y versiones por fecha (criterios CA-11 a CA-15). La pantalla de Metas conserva por ahora el cálculo actual de "Proyecto" (horas planificadas hechas) y "Ejercicio" (sesiones marcadas), según la decisión 3 |
| T2.6 | Ajustes muestra "Avisos programados (próximos 14 días)" y el resultado del último reprogramado (programados de planificados y primer error). Un aviso que falla ya no corta los demás (antes, un error en una tanda de 20 detenía el resto en silencio). Primera lectura en el Xiaomi (17/11): 20 avisos programados contra unos 222 esperados; pendiente distinguir si fue una lectura a mitad del reprogramado o un error real |

**Prueba de equivalencia** (`src/engine/__tests__/equivalence-test.ts`): el código actual corre sobre un almacén simulado y se compara con el motor v2 desde la misma fixture migrada, día por día del 02/11/2026 al 12/01/2027, sin cambios y después de cada operación (Solo hoy, Siempre, tarea separada, margen, restaurar, mover martes, ajustes, metas y totales). Si se rompe el motor a propósito, la prueba falla.

**Diferencias aceptadas o visibles (mínimas):**
1. En la v1, un día con cambios "Solo hoy" quedaba congelado frente a cambios "Siempre" posteriores. En la v2, ese día recibe el cambio y conserva solo lo que se cambió ese día (como pide la spec 009). Hay una prueba que lo documenta.
2. Las tarjetas de Metas usan el nombre de la meta: "Posts" en vez de "Post publicado" o "Post programado".
3. "Postulaciones" aparece también los martes con adscripción (decisión 2).
4. Si se mueven los martes con cambios "Solo hoy" en un martes, esos cambios quedan en el martes que ya no corresponde (en la v1 seguían en ese día). Caso raro.

**Publicación en dos pasos (recomendado):**
- **E2a, ahora:** esta versión con la migración todavía en modo prueba. La app sigue con el motor v1; cambian por dentro los avisos, el registro con nombres, el CSV y el contador de avisos. Sirve para la prueba del tope (T2.6) y para comprobar que nada visible cambió.
- **E2b, después:** copia de seguridad nueva en Drive, cambiar `MIGRATION_MODE` a `'apply'` y publicar. Ahí migra de verdad y pasa al motor v2. Revisar tres días con registro.

**Prueba en el teléfono:** agenda de varios días, avisos de mañana a la hora correcta, un margen aplicado, y la pantalla de metas con los mismos números de antes.

**Salida de la fase:** ningún archivo fuera de `src/domain/` y `src/migration/` conoce `DayType`, `Cat` ni `GOAL_LABELS`. Se puede borrar el código muerto en la fase 6.

---

## Fase 3. Gestión de eventos (spec 009, secciones 3 y 6)

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T3.1 | **Operaciones puras de edición y borrado con alcance**: `editEvent(alcance)` y `deleteEvent(alcance)` para "Solo hoy", "A partir de hoy" y "Siempre". Incluye partir una serie, cerrar con `endDate` y conservar las excepciones | L | T2.1 | CG-07 a 15 |
| T3.2 | **Deshacer** por instantánea del estado afectado, un solo paso, 8 segundos | S | T3.1 | CG-17 |
| T3.3 | **Editor de eventos** (reemplaza `TaskEditor.tsx`): campos, validaciones, repetición con descripción en lenguaje natural ("Cada 2 semanas, el martes, desde el 03/11"), aviso de superposición | L | T3.1 | CG-01 a 06 |
| T3.4 | **Hoja de alcance** con tres opciones, sin ninguna preseleccionada, con etiquetas dinámicas ("Solo el 24/11", "A partir del 24/11"), la opción "Solo hoy" oculta si cambió la regla y la línea "N días tienen cambios propios" | M | T3.3 | CG-10, CG-12 |
| T3.5 | **Eliminar**: confirmación con cantidad de días y sesiones registradas, y bloqueo si hay una sesión en curso | M | T3.1 | CG-15, CG-16 |
| T3.6 | **Cualquier fecha, incluido fin de semana**: la vista del día muestra sábados y domingos (hoy devuelve vacío) y permite crear con "+" | M | T2.1 | CG-01 |
| T3.7 | **Efectos tras cada cambio**: reprogramar avisos y refrescar Agenda, Metas y Datos sin reabrir | S | T3.3, T2.4 | CG-30, CG-31 |

**Prueba en el teléfono (lista de verificación):**
1. Crear un evento de sábado sin repetición.
2. Crear un evento "martes cada 2 semanas" y verificar los 3 próximos martes.
3. Editar con cada uno de los tres alcances y mirar tres semanas.
4. Eliminar con cada alcance y verificar que Datos conserva las sesiones.
5. Intentar eliminar con una sesión en curso.
6. Deshacer.

**Salida de la fase:** podés armar y cambiar toda tu agenda desde la app, sin tocar código.

---

## Fase 4. Categorías (spec 009, sección 4)

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T4.1 | **Operaciones puras de categorías**: crear, editar, archivar, eliminar con reasignación, validar nombre único | M | T2.1 | CG-19, 20, 21 |
| T4.2 | **Paleta cerrada de colores** con contraste verificado (nivel AA para texto sobre cada color) en modo claro y oscuro | S | nada | accesibilidad |
| T4.3 | **Pantalla Ajustes → Categorías** y creación en línea desde el editor de eventos | M | T4.1, T4.2, T3.3 | CG-18 |

**Prueba en el teléfono:** crear "Lectura" con "Permite empezar y medir", asignarla, verificar que ofrece Empezar y que el aviso trae "Empecé"; intentar eliminar una categoría en uso.

---

## Fase 5. Metas (spec 009, sección 5)

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T5.1 | **Operaciones puras de metas**: crear, editar con versiones ("A partir de hoy" y "Siempre"), archivar, eliminar, nombre único, meta de tiempo con evento asociado | M | T2.5 | CG-22 a 28 |
| T5.2 | **Pantalla Metas**: lista con progreso, botón "+ Nueva meta", editor y hoja de alcance con aviso sobre porcentajes pasados | L | T5.1, T4.3 | CG-22 a 28 |
| T5.3 | **Contadores dentro del evento en curso** (prioridad "Debería"): las metas asociadas aparecen con su botón + en la tarjeta del evento | M | T5.1 | CG-29 |
| T5.4 | **Datos con metas archivadas y eliminadas**: sus conteos siguen visibles en Datos y en el CSV con el nombre que tenían | S | T5.1, T2.3 | CG-26, CG-27 |

**Prueba en el teléfono:** crear una meta de cantidad ("Páginas leídas", 20 por día) y una de cantidad y tiempo asociada a un evento; sumar conteos; cambiar el objetivo con cada alcance y mirar un día pasado; archivar y eliminar.

---

## Fase 6. Cierre

| ID | Tarea | Tamaño | Depende de | Cubre |
|---|---|---|---|---|
| T6.1 | **Reemplazar "Restaurar agenda original"** por "Restaurar la plantilla inicial" y "Borrar toda la agenda" (spec 009, 7.4). Ninguna toca el registro | S | T1.6 | spec 009 §7.4 |
| T6.2 | **Limpieza**: borrar `DayType`, `Cat`, `G_*`, `GOAL_LABELS`, el adaptador de la fase 1 y los textos de búsqueda de empleo que queden en el código | M | todas | CA, CG |
| T6.3 | **Revisión de accesibilidad**: controles de 48 dp o más, hoja de alcance legible con lectores de pantalla y texto grande, mensajes de error junto al campo | M | T3.4, T5.2 | spec 009 §7.3 |
| T6.4 | **Textos en claves** para poder traducir después, sin traducir todavía | M | T6.2 | principio 8 de la constitución |
| T6.5 | **Publicación**: se agrega solo JavaScript, así que alcanza con una actualización por internet para la versión 1.1.0, siempre que no se sumen librerías con código nativo. Se agrega una nota en `INSTALAR.md` | S | todas | entrega |
| T6.6 | **Pasada final** sobre todos los criterios CA y CG con la lista de verificación del teléfono | M | todas | cierre |

---

## 4. Orden recomendado de entregas

| Entrega | Contiene | Qué ve Sofía |
|---|---|---|
| **E1** | Fase 0 completa | Copia de seguridad desde Ajustes. Nada más cambia |
| **E2** | Fases 1 y 2 | La app se ve igual, pero ya funciona sobre el modelo nuevo y soporta fin de semana |
| **E3** | Fase 3 | Crear, editar y eliminar eventos con los tres alcances |
| **E4** | Fases 4 y 5 | Categorías y metas propias |
| **E5** | Fase 6 | Limpieza, accesibilidad y plantillas |

E1 y E2 no agregan funciones nuevas visibles, pero son las que más riesgo reducen. **E3 es la primera que le cambia el uso diario.** Si hay prisa por ver algo, la tentación es saltar a E3; no conviene, porque sin E2 los eventos nuevos no tendrían dónde guardarse de forma correcta.

## 5. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| La migración falla con datos reales y deja la agenda rara | Media | Alto | T0.1 antes de migrar, copia `backup:v1:`, función pura probada con fixtures, reintento y prueba manual de la fase 1 |
| El caso del id repetido con horarios distintos rompe el vínculo con el historial | Media | Medio | `legacyBid`, prueba CA-19 y revisión con tus datos reales |
| Los avisos superan el tope de alarmas con eventos diarios | Alta | Medio | T2.6 mide antes de construir la interfaz y se decide la ventana con datos |
| Xiaomi / HyperOS mata los procesos y los avisos no suenan | Alta | Medio | Ya conocido (pendiente desde antes). No lo resuelve este plan |
| No hay pruebas automáticas hoy: un cambio puede romper algo sin que se note | Alta | Medio | Fase 0 antes de todo; cada tarea de lógica tiene sus pruebas |
| Se cambia el almacenamiento y el modelo a la vez | Baja | Alto | Decidido: se mantiene el almacén actual con una capa de acceso |
| El alcance crece (mensual, medianoche, sincronización) | Media | Medio | Fuera de alcance por escrito en ambas specs |
| Se instala una librería con código nativo y la actualización por internet deja de alcanzar | Baja | Medio | Revisar cada dependencia nueva; solo las de desarrollo y JavaScript puro |

## 6. Definición de terminado (para cada tarea)

1. Los criterios CA y CG que cubre tienen una prueba automática que pasa.
2. `typecheck`, `lint` y `test` pasan.
3. Si la tarea toca la pantalla o los avisos, se probó en el teléfono y hay una nota con lo que se verificó.
4. Los textos nuevos están en español, sin conceptos internos del código (nada de "serie", "excepción" ni "alcance" a la vista de la persona).
5. No se borra ni se altera el registro de uso.

## 7. Fuera de este plan

Navegación Hoy / Semana / Ajustes, migración a Expo Router, repetición mensual, eventos que cruzan la medianoche, sincronización con calendarios y nube, IA, iOS, traducción de los textos, y la importación de plantillas de otras personas.
