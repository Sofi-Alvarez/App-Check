# Agenda v2: diagnóstico de la versión actual y flujo del día

Fecha: 09/11/2026. Punto de partida para la spec de la versión nueva. La idea es la misma que la de la versión actual; el producto, el código y el APK son nuevos (carpeta aparte, otro identificador de app, se instala al lado de la actual).

Este documento tiene cuatro partes: qué falla en el flujo de la versión actual, qué se conserva, una propuesta de flujo del día para corregir, y las preguntas que tienes que responder para escribir la spec.

## 1. Qué falla en el flujo de la versión actual

Esto sale de lo que construimos y del código. Es un diagnóstico mío y hay que contrastarlo con lo que viviste al usarla. Si algo no coincide con tu experiencia, vale lo tuyo.

**Causa de fondo.** La app creció por capas, una función por pedido (sesiones, después edición, después margen, después el botón del aviso), sin un flujo pensado de punta a punta. Y nunca la corrí en un teléfono ni la vi en pantalla antes de entregártela; solo pasó revisiones de código.

**Problemas de flujo que veo:**

1. **Tres formas de decir "terminé".** El ✓ de cada fila (hecho), el botón Terminar de la sesión en curso y el Timer del bloque hacen cosas parecidas que no están conectadas. Hay que adivinar cuál usar y cuál cuenta para los datos.
2. **Cada fila carga cuatro acciones** (Aviso, Empezar, Editar, Timer) además del ✓. Son 5 controles por tarea en una línea de 14 tareas. Mucho ruido y botones apretados.
3. **Los contadores viven lejos de la tarea.** Para sumar un comentario hay que ir a la pestaña Metas, aunque estés en medio de la tarea de comentar. El flujo natural (estoy en la tarea, sumo ahí) no existe.
4. **Cinco pestañas con pesos muy distintos.** Agenda, Metas, Datos, Timer y Ajustes tienen la misma jerarquía, pero Datos se usa una vez por semana y Timer duplica la sesión. La navegación diaria queda llena de lo que no es diario.
5. **La tarjeta "Ahora" tiene cinco estados distintos** (vista previa, en curso, ahora, sigue, fin), y su botón principal cambia de lugar y de sentido entre ellos.
6. **La hoja de margen interrumpe justo al terminar**, cuando lo único que quieres es pasar a la siguiente tarea.
7. **Conceptos internos que salen a la interfaz.** "Solo hoy" y "Siempre", y los tipos de día ("Lun y mié", "Mar con adscripción"), son la forma en que está construido el código, no la forma en que piensas tu semana.
8. **El botón del aviso abre la app**, y recién ahí empieza la tarea. Es un recorrido largo para algo que debería ser un toque.
9. **Estados poco claros.** No se ve de un vistazo si una tarea está pendiente, en curso, pausada, hecha, saltada o cerrada sola.
10. **Sin diseño previo.** Los textos, los tamaños y la jerarquía los puse yo sin que los diseñaras, y se nota.

## 2. Qué se conserva (decisiones que ya tomaste y funcionan como idea)

- Una agenda semanal de bloques de tiempo, de lunes a viernes.
- Dos formas de medir una tarea: por tiempo y por cantidad (por ejemplo, 5 comentarios).
- Avisos al empezar cada bloque y antes de que termine.
- Registro de cuándo empezaste, pausaste y terminaste, con un toque.
- Si haces otra cosa que lo que toca, poder decirlo.
- Margen de tiempo: lo que sobra o falta pasa a otra tarea; los bloques fijos nunca se mueven.
- Editar y crear tareas.
- Exportar los datos para revisarlos después.
- Datos guardados en el teléfono, sin cuentas.

Lo que cambia es **cómo se encadena todo en el uso**, no lo que la app hace.

## 3. Propuesta de flujo del día (para corregir)

Principio central, a confirmar: **una sola pantalla de uso diario, con una sola acción principal visible a la vez.** Todo lo demás está a un toque, pero fuera del camino.

**Mañana.** Abres la app o tocas el primer aviso. Ves el día: qué toca ahora y qué sigue. Una acción grande: Empezar.

**Durante una tarea.** La pantalla muestra solo esa tarea: nombre, cuánto llevas, cuánto queda. Si tiene meta de cantidad, el contador está ahí mismo, con un toque para sumar. Acciones: Pausar y Terminar.

**Al terminar.** Un solo "Terminar" cierra la tarea y la marca hecha: no hay otro ✓ aparte. Si sobró o faltó tiempo, el margen se resuelve sin cortar el flujo (a definir: lo ofrece después, o lo asigna solo a la siguiente y puedes cambiarlo).

**Cambio de tarea.** Empezar la siguiente cierra la anterior. Si haces otra cosa, "Otra cosa" está a la vista, sin esconderlo.

**Desvíos.** Saltar una tarea o moverla a otro momento son acciones distintas de editarla, y quedan registradas distinto.

**Fin del día.** Resumen corto: qué hiciste, qué quedó pendiente, qué metas cumpliste.

**Semana.** Una vista aparte para ver la semana y editar la agenda. No es parte del uso del día.

**Una vez por semana.** Datos y exportación, dentro de Ajustes o de la vista de semana, no en la barra principal.

Esto sugiere una navegación de **tres lugares**: Hoy, Semana y Ajustes. Es una hipótesis para validar con tu diseño.

## 4. Preguntas que cambian la spec

Responde las que puedas, aunque sea con una frase.

**Sobre lo que viviste**
1. ¿Cuáles fueron los errores concretos que te encontraste? (Aunque sea una lista rápida: "el aviso no sonó", "no pude volver a...", "el botón X no hacía nada").
2. ¿En qué momento del día te frustró más usarla?
3. ¿Qué parte sí te sirvió y no quieres perder?

**Sobre el flujo ideal**
4. Cuando un aviso suena, ¿qué quieres poder hacer sin abrir la app, si fuera posible? ¿Y qué sí está bien que abra la app?
5. ¿Quieres que al terminar una tarea la app te pida algo (margen, nota, cantidad), o prefieres que no te interrumpa y revisar todo al final del día?
6. ¿Te sirve marcar tareas saltadas o movidas, o con "hecho / no hecho" te alcanza?
7. ¿Cuántas veces por día miras la app? ¿Con la pantalla bloqueada, caminando, sentada frente a la compu?

**Sobre el alcance**
8. ¿Hay algo de lo actual que quieras **quitar** en la versión nueva?
9. ¿Hay algo que **nunca** estuvo y que sí necesitas?

## 5. Cómo seguimos

1. Respondes las preguntas (el bloque "Sobre lo que viviste" es el más importante).
2. Yo escribo la **spec del flujo de uso diario** (pantalla Hoy) con criterios de aceptación, y tú la apruebas o corriges.
3. Tú diseñas las pantallas a partir de esa spec.
4. Se construye en piezas chicas, **verificando cada una en el teléfono antes de pasar a la siguiente**, empezando por Hoy y los avisos. Las demás (Semana, edición, margen, datos) se agregan una por una.
5. La versión nueva sale como proyecto aparte, con otro identificador de app, para que puedas instalarla junto a la actual sin perder los datos que estás juntando.

El orden respeta lo que pediste: la spec va primero, el diseño después, y recién entonces el código.
