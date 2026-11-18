# Bitácora de la sesión: de agenda de búsqueda de empleo a agenda general

Escrita el 18/11/2026. El trabajo ocurrió el 17/11/2026, sobre la rama `claude/bold-fermat-vucbp2`.
Es un relato, no una especificación: qué hicimos, en qué orden, qué decidiste, qué descartamos y en qué nos equivocamos.
Las especificaciones y el plan están en `docs/specs/`; el estado de cada tarea, en `docs/specs/tareas.md`.

---

## 1. El punto de partida

Tenías una app de agenda en Expo / React Native (unas 2.450 líneas) con tu rutina de búsqueda de empleo escrita en el código: 8 categorías cerradas, 5 "tipos de día", metas fijas (posts, comentarios, reacciones…), solo lunes a viernes y la regla "martes con adscripción cada 14 días" desde una fecha fija.
El motor (sesiones, registro de eventos, margen, avisos, CSV) ya era bastante genérico. Lo atado a tu rutina era el **contenido** y las **reglas de repetición**.

Dos cosas que dijiste al principio y que dirigieron todo lo demás:

- "Esto no es para búsqueda de empleo únicamente, sino que funcione como agenda en general". La rutina de empleo pasó a ser solo el contenido de ejemplo que vos cargaste.
- "Necesito poder manejar la agenda desde la app: creando, eliminando, editando, en la agenda y en las metas". Hasta ese momento, para cambiar la agenda había que tocar código.

---

## 2. Cronología

### Etapa 1. Investigación (sin código)

1. **Primera ronda:** qué apps ya tienen estas funciones o más.
2. **Segunda ronda, más intensa:** cuál se acerca más a lo que tenés, cuál tiene más funciones y si alguna ayuda a priorizar o a mejorar el tiempo.
3. **Pregunta de ingeniería inversa:** ¿es viable usarla para captar las mejores funciones de cada app? El análisis terminó apoyándose en fuentes públicas (reseñas, comparativas, páginas de ayuda), no en abrir las apps. `docs/analisis-de-features.md` lo dice en su sección de límites: no se instaló ni probó ninguna.
4. **Tres listas:** lo que ya tenés, lo que te falta y tienen otras, y lo que querés y ninguna tiene.
5. **Corrección de enfoque:** la app es general. Eso cambió la recomendación de `MODELO-DE-PRODUCTO.md`: de "empezar vertical" a "horizontal". El competidor real pasó a ser Sunsama, Structured, Tiimo y Marvin, no Huntr o Teal.
6. **Quién gestiona mejor eventos y metas:**
   - Para eventos repetidos, el mejor modelo es el de **Google Calendar y Structured**: tres alcances al editar y al borrar (solo este, este y los siguientes, todos).
   - Para metas, el de **Loop Habit Tracker**.
   - Ninguna app junta agenda por bloques con metas dentro del bloque. Ese es el hueco de la tuya.

Lo que el análisis dice que es tuyo y nadie más tiene (según lo que se encontró, con la salvedad de que "no lo encontré" no es "no existe"): repartir el margen de tiempo a una tarea que elegís vos; metas por cantidad y por tiempo en el mismo bloque; datos confirmados separados de los automáticos; empezar una sesión con un toque desde el aviso; el registro de eventos con hora como base; todo local, sin cuenta y exportable.

### Etapa 2. Specs y plan

- **Spec 010 (modelo de datos):** categorías, series de eventos con regla de repetición, excepciones por día, metas con versiones por fecha y plantillas.
- **Spec 009 (gestión de agenda y metas):** crear, editar y eliminar con alcance, categorías, metas, avisos. Tiene 32 criterios (CG-01 a CG-32); la 010 tiene 19 (CA-01 a CA-19).
- **Plan de tareas** en 7 fases (0 a 6) con una regla: **cada fase termina en tu teléfono**, porque el diagnóstico del 09/11 había reconocido que la versión anterior nunca se probó en un teléfono antes de entregarla.

### Etapa 3. Fase 0: red de seguridad antes de tocar nada

- **T0.1:** copia de seguridad completa desde Ajustes. En tu teléfono: 21 claves, 68 KB, 1 parte. La mandaste por WhatsApp y a Drive.
- **T0.2 y T0.3:** infraestructura de pruebas (jest-expo) y CI en GitHub Actions con typecheck, lint y tests.
- **T0.4:** un almacén de prueba sintético con el formato viejo y un lector puro de ese formato.
- Se habilitó `docs.expo.dev` en el entorno para poder leer la documentación de Expo SDK 58 (el `AGENTS.md` pide no confiar en la memoria sobre Expo).

### Etapa 4. Fase 1: el modelo nuevo y la migración (en modo prueba)

- Modelo v2, recurrencia (`occursOn`, `buildDay`), capa de acceso al almacén con `expoKV` en el teléfono y `memoryKV` en pruebas, categorías, plantilla de tu rutina como datos (66 series y 8 metas) y migración con **autoverificación día por día**: si el resultado no coincide con lo que mostraba la app vieja, la migración se niega a escribir.
- **T1.7:** la migración corre al abrir la app en modo prueba: calcula todo en memoria y no escribe nada.
- **En tu teléfono:** "Prueba correcta · 66 eventos · 72 días revisados, sin diferencias".

### Etapa 5. Fase 2: motor nuevo y avisos

- Un motor v2 con una prueba de equivalencia contra el v1, día por día del 02/11/2026 al 12/01/2027.
- **T2.6, la prueba del tope de avisos en el Xiaomi:** 222 avisos programados, exactamente lo calculado, muy por debajo del tope de unas 500 alarmas de Android. La ventana de 14 días se mantiene.
- Publicación **en dos pasos**: primero el motor nuevo con la migración todavía en modo prueba; después, con una copia de seguridad nueva en Drive, la migración real.
- **En tu teléfono, migración real:** tarjeta verde, 66 eventos, 436 días revisados sin diferencias, 219 de 219 avisos sin errores.

### Etapa 6. Fases 3 a 5: lo que ahora podés hacer

- **Fase 3, eventos:** crear, editar y eliminar con "Solo hoy", "A partir de hoy" y "Siempre"; "Deshacer" durante 8 segundos; semana de 7 días con fin de semana; avisos reprogramados tras cada cambio. Después, cinco pendientes que pediste cerrar: metas asociadas y aviso propio en el editor, "+ Nueva categoría" desde el editor, mover un solo día, botones de semana más anchos y sacar los textos de la rutina original.
- **Fase 4, categorías:** crear, editar, archivar y eliminar con reasignación; paleta cerrada con contraste verificado (el color más justo, el gris de "Pausa o comida" en modo claro, da 3,08:1 contra el fondo; no hizo falta cambiarlo).
- **Fase 5, metas:** crear y editar con versiones por fecha, archivar, eliminar, contadores dentro del evento en curso y aviso propio por meta. Los conteos de metas borradas siguen en Datos y en el CSV con el nombre que tenían.

### Etapa 7. Fase 6: cierre y borrado del código viejo

- **T6.1:** "Restaurar la plantilla inicial" y "Borrar toda la agenda", con confirmación y "Deshacer". Ninguna toca el registro de uso.
- **T6.3:** pastillas de al menos 48 × 48 dp y una prueba automática que falla si algún elemento tocable no tiene nombre para lectores de pantalla.
- **T6.4:** todos los textos pasaron a un diccionario tipado (`src/i18n/es.ts`) y una prueba falla si aparece español escrito directo en una pantalla.
- **T6.2, en dos tiempos:** primero parcial (el código viejo quedaba como red de seguridad); después, cuando me pediste "borrá el código de la versión vieja, esta app es mejor que la anterior", completo. Ver sección 4.
- **T6.5:** publicaste la actualización.
- **T6.6 (pasada final en el teléfono):** quedó pendiente. Te dejé una lista de 25 pasos en `INSTALAR.md`, y dijiste que no podías hacerla ahora.

### Etapa 8. Después del plan

Te propuse cuatro opciones que no estaban en el plan y elegiste **repetición mensual**: "el día 17 de cada mes", "el tercer martes", "el último viernes", cada 1 a 12 meses. Los meses que no tienen ese día (29, 30, 31) caen el último día del mes. Quedó con 17 pruebas nuevas.

---

## 3. Decisiones que tomaste

| Decisión | Qué elegiste | Por qué importa |
|---|---|---|
| **D1: ¿misma app o app nueva al lado?** | Migrar **en la misma app** (opción A) | Un solo producto y el historial se conserva. Condición: no publicar ninguna migración sin la copia de seguridad guardada fuera del teléfono |
| Eventos que cruzan la medianoche | **Por ahora no** | Queda fuera de alcance; se reabre solo si aparece la necesidad |
| Tope de avisos | **Probarlo en el Xiaomi** antes de acortar la ventana | Se probó (222 avisos) y la ventana de 14 días se quedó |
| Vocabulario de alcance | **"Solo hoy", "A partir de hoy" y "Siempre"** | Es la misma idea de Google Calendar y Structured, con tus palabras |
| Dónde se guardan los datos | Seguir con el almacén actual (clave-valor) con una capa de acceso, y pasar a tablas después | Cambiar almacén y modelo a la vez era el riesgo más alto; se evitó |
| Las 6 situaciones de la migración | **De acuerdo con las 6** (ver abajo) | Primero no las habías entendido y pediste que te las explicara mejor; después las aprobaste |
| Publicar en dos pasos | Primero modo prueba, después migración real | Cualquier edición con el formato viejo no habría llegado al modelo nuevo |
| Borrar el código viejo | **Sí, completo**, sin esperar la revisión del teléfono | Ver riesgo en la sección 4 |
| Qué sigue tras el plan | **Repetición mensual** | Es lo que más le falta a una agenda general |

**Las 6 situaciones de la migración y cómo se resolvieron:**

1. *Tarea separada en dos series (caso "yoga"):* la marca de "hecho" de ese día se reescribe y se informa; la copia guarda el valor original.
2. *Metas por día de la semana,* no por "tipo de día": solo afecta a "Postulaciones", que no tiene objetivo.
3. *"Proyecto" y "Ejercicio"* pasan a metas de tiempo semanales sin objetivo, conservando el cálculo anterior.
4. *Una tarea "Solo hoy" con un id ya usado por otra serie* recibe un id propio, vinculado al original.
5. *Ediciones de sábado o domingo* de la versión vieja (nunca se mostraron): no se migran, se informan y quedan en la copia.
6. *Categorías con id desconocido:* se crean como categoría nueva con el id como nombre, para no perder el evento.

---

## 4. Lo que descartamos (y por qué)

- **App nueva al lado de la vieja** (opción B del diagnóstico del 09/11). Habría dejado la actual intacta como respaldo, pero obligaba a mantener dos apps y construir una importación.
- **Empezar con una app vertical** de búsqueda de empleo. Al aclarar que es una agenda general, pasó a ser la base horizontal.
- **Cambiar la navegación a Expo Router o a Hoy / Semana / Ajustes.** El `AGENTS.md` del repo pide Expo Router, pero la app usa pestañas propias en `App.tsx`. Quedó **fuera del plan a propósito** y no se resolvió: es una tensión abierta entre la guía del repo y lo que hay.
- **Reagendado automático con IA y "estrategias" configurables al estilo Marvin.** Chocan con tu principio de que registrar cuesta un toque, y tu margen es manual a propósito.
- **Eventos que cruzan la medianoche, repetición anual, sincronización con calendarios y nube, iOS, traducción.** Fuera del plan por escrito.
- **Aplicar la migración de entrada.** Se descartó por el modo prueba primero.
- **Mantener la compatibilidad de metas de fin de semana con el modelo viejo** (fase 5): se retiró; el sábado y el domingo muestran las metas que aplican ese día.
- **Dejar el código viejo como red de seguridad.** Era mi recomendación (T6.2 parcial). Vos decidiste lo contrario y se hizo.
- **Las otras tres opciones post-plan** (eventos que pasan la medianoche, vista Hoy / Semana, ayuda para priorizar): quedaron sin hacer.

---

## 5. En qué nos equivocamos y qué se corrigió

Los errores que encontró una prueba o una verificación antes de llegar a tu teléfono están marcados con 🧪. Los que aparecieron con datos o con el entorno real, con 📱 o ⚙️.

1. **La spec decía que `agenda:day:*` no cambia, y era falso** para el caso de una tarea separada en dos series: la marca de "hecho" del jueves quedaba apuntando a un id que ese día ya no existe. Se corrigió en la implementación reescribiendo solo esos días y avisándolo. La spec quedó desactualizada en ese punto hasta que se registró como decisión.
2. 🧪 **La migración fallaba con el almacén vacío** (una instalación nueva): no podía calcular el último día a verificar. Lo encontró una prueba.
3. 🧪 **El pasado "desaparecía" en el modelo nuevo.** Una prueba temporal con tu copia real comparó v1 con v2 y vio que las fechas anteriores a la semana del primer dato aparecían vacías (la versión vieja las mostraba). Se arregló con series que empiezan 52 semanas antes. Esto se detectó **antes de publicar la migración real**; si no, lo habrías visto en el teléfono.
4. 📱 **"20 avisos programados" en el Xiaomi.** Era una lectura a mitad del reprogramado; la segunda lectura dio 222, justo lo calculado. En el camino apareció un error real de la versión vieja: **un fallo en un aviso cortaba los demás en silencio.** Se corrigió y Ajustes ahora muestra el resultado del último reprogramado.
5. 🧪 **Las pruebas de pantalla pasaban en local y fallaban en GitHub** por superar los 5 s del tiempo por defecto. Se subió a 30 s.
6. 🧪 **React Native Testing Library 14 es asíncrona** (`render` y `fireEvent` hay que esperarlos). Las primeras pruebas no veían cambios de estado por no esperarlas.
7. 🧪 **Dos botones con el mismo nombre "Ejercicio"** (una categoría y una meta). Mala accesibilidad y pruebas ambiguas. Ahora son "Categoría Ejercicio" y "Meta Ejercicio".
8. 🧪 **La revisión automática de accesibilidad** falló por tipos de una librería que no estaba instalada y por una importación dinámica; se resolvió con un tipo local y una importación estática. La prueba de control comprueba que el revisor de verdad detecta un elemento sin nombre.
9. 🧪 **Reglas de lint y de texto:** `import/first` en una pantalla y la prueba que impide español escrito directo en el código (necesitó una referencia a los tipos de `fs`).
10. ⚙️ **Entorno:** `api.expo.dev` estaba bloqueado (se usó `EXPO_OFFLINE=1` para el empaquetado de prueba) y un *force push* fue bloqueado por el modo automático; se resolvió fusionando `origin/main` en la rama en vez de reescribir historia.
11. **Cifras que quedaron desactualizadas en los documentos:** el encabezado de la fase 6 decía 285 pruebas cuando la tabla decía 301; las dos eran de momentos distintos. Se unificó a 220 tras el borrado.
12. **Una cifra mía incorrecta en el chat:** al borrar el código viejo te dije "unas 70 pruebas" menos. La cuenta real es de unas 80: pasamos de 301 a 220, con 4 pruebas nuevas del arranque.
13. **Un resto sin ✅:** en la tabla del plan, la fila de T6.5 quedó sin marcar aunque la tabla de estado la daba por hecha. Se corrigió junto con esta bitácora.

---

## 6. El riesgo que asumiste al borrar el código viejo

Pediste borrarlo **sin haber terminado** la revisión de tres días con registro de la fase 2 ni la pasada T6.6. Era una decisión tuya, con una razón razonable, pero cambia el riesgo:

- **Antes:** si los datos nuevos fallaban al abrir, la app volvía al formato viejo, que nunca se borraba.
- **Ahora:** esa red ya no existe. Las claves viejas siguen guardadas pero **nada las lee**. Entran en la copia de seguridad.
- **Lo que lo compensa:** una instalación nueva arranca con la plantilla inicial; y si los datos guardados están dañados, la app muestra una **pantalla de datos dañados** con "Exportar copia de seguridad" y "Empezar con la plantilla inicial" (no toca el registro ni los ajustes).
- **Lo que sí te pedí:** exportar una copia nueva a Drive antes de publicar.

---

## 7. Cómo quedó

| | |
|---|---|
| Pruebas | 237, todas en verde, con typecheck, lint y empaquetado para Android |
| Fases | 0 a 5 cerradas; la 6, salvo T6.6 |
| Pendiente tuyo | T6.6: pasada final en el teléfono (lista en `INSTALAR.md`); la revisión de tres días con registro de la fase 2 sigue sin confirmar |
| En tu teléfono | Publicado hasta el borrado del código viejo. La repetición mensual está subida a la rama y **todavía no publicada** |
| Para publicarla | `npx eas-cli@latest update --channel preview --environment preview --message "repetición mensual"` |
| Documentos | `docs/specs/009…`, `010…`, `tareas.md`, `INSTALAR.md`, `analisis-de-features.md` y esta bitácora |

**Lo que sigue abierto:**

- T6.6 en el teléfono.
- La tensión entre el `AGENTS.md` (Expo Router) y la navegación propia.
- Opciones post-plan sin hacer: eventos que pasan la medianoche, vista Hoy / Semana y ayuda para priorizar con tus datos de uso.
- "Después de N veces" como fin de repetición y "duplicar evento o día" siguen como preguntas abiertas en la spec 009: nunca respondiste si te sirven.
- Sin confirmar en el análisis de competencia (marcadas con "(?)"): si Marvin tiene contadores por cantidad, si Sunsama incluye el seguimiento de tiempo en todos los planes y cómo se comporta cada app en Xiaomi.

**Una lección de método que se repitió:** lo que más errores atrapó fue comparar contra **tus datos reales** (la copia de seguridad) y no contra la fixture sintética, y publicar en **dos pasos** (modo prueba y después aplicar). Los errores 3 y 4 de la sección 5 solo aparecieron así.
