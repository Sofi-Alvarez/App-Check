# Spec 009: Gestión completa de agenda y metas (crear, editar, borrar, con alcance y recurrencias)

Estado: borrador para aprobar. Fecha: 17/11/2026.
Depende de: `010-generalizacion-del-modelo-de-datos.md` (series, excepciones, categorías, metas y versiones de metas).
Reemplaza y amplía: la edición de tareas ya implementada (`TaskEditor.tsx`, `schedule.ts`) y las metas fijas (`GoalsScreen.tsx`).

## 1. Contexto

Hoy la app permite crear, editar y borrar tareas, con dos alcances ("Solo hoy" y "Siempre"), pero solo dentro de 5 tipos de día y 8 categorías fijas. Las metas no se pueden crear, editar ni borrar: la pantalla solo tiene los botones + y −, y las metas vienen escritas en el código.

Sofía necesita **manejar toda la agenda desde la app**: crear, editar y eliminar eventos en la agenda y también crear, editar y eliminar metas, sin depender de que alguien cambie el código. La app debe servir para cualquier rutina, no solo la de búsqueda de empleo.

### 1.1 Referencias de la competencia

| App | Qué se toma como referencia | Fuente |
|---|---|---|
| Google Calendar | Tres alcances al editar y al borrar un evento repetido: solo este, este y los siguientes, todos. El cambio de la regla de repetición se aplica a la serie o a "este y los siguientes" | [Ayuda oficial](https://support.google.com/calendar/answer/37115?hl=en&co=GENIE.Platform%3DAndroid) |
| Structured | Mismos tres alcances (solo esta, esta y las siguientes, todas) en una agenda por bloques de tiempo | [Editar y borrar tareas](https://help.structured.app/en/articles/3320002) |
| Sunsama | "Edit task series", "Stop repeating" y "Delete all instances" | [Recurring tasks](https://www.sunsama.com/pro-tips/recurring-tasks-refresher) |
| Loop Habit Tracker | Meta medible con unidad, objetivo, frecuencia y aviso propio | [Repositorio](https://github.com/iSoron/uhabits) |

Esta spec toma las ideas, no el código ni el diseño de ninguna de ellas. Loop es de código abierto pero con licencia copyleft: se pueden estudiar sus ideas, no copiar su código.

### 1.2 Lo que se conserva del comportamiento actual

- Aviso de superposición al guardar, pero se deja guardar (`overlaps()`).
- Duración mínima de 5 minutos y fin posterior al inicio.
- Reprogramar los avisos del teléfono después de cada cambio.
- Las marcas de "hecho" indexadas por id de evento.
- "Restaurar agenda original" (ver 7.4 para cómo cambia).
- El registro de uso nunca se toca al editar o borrar la agenda.

### 1.3 Prioridades

| Marca | Significa |
|---|---|
| **Debe** | Sin esto no se cumple lo pedido |
| **Debería** | Importante, puede ir en una segunda entrega |
| **Podría** | Mejora, sin urgencia |

## 2. Historias de usuario

1. **Debe.** Como persona con una rutina propia, quiero **crear un evento** con nombre, categoría, día, horario y, si quiero, repetición, para armar mi agenda sin tocar código.
2. **Debe.** Quiero **editar un evento** y elegir si el cambio vale solo para ese día, para ese día y los siguientes, o para todos, para no cambiar de más.
3. **Debe.** Quiero **eliminar un evento** con las mismas tres opciones, para sacar una actividad que dejé de hacer sin perder el historial.
4. **Debe.** Quiero **crear, editar y eliminar metas**, con tipo (cantidad, tiempo o ambas), objetivo, unidad y eventos asociados, para medir lo que me importa hoy.
5. **Debe.** Quiero **crear y editar categorías** con nombre, color y comportamiento, para que la agenda use mis propios rubros.
6. **Debe.** Quiero poder planificar **cualquier día de la semana**, incluidos sábado y domingo.
7. **Debería.** Quiero **deshacer** un borrado o una edición justo después, por si me equivoco.
8. **Debería.** Quiero ver y sumar el contador de una meta **dentro del evento en curso**, sin ir a otra pestaña.
9. **Podría.** Quiero **duplicar** un evento o un día entero.
10. **Podría.** Quiero **guardar mi semana como plantilla** y aplicar una plantilla de otra persona.

## 3. Gestión de eventos

### 3.1 Dónde se hace

- **Crear:** botón "+" en la pantalla del día. El día preseleccionado es el que se está viendo, sea cual sea (incluido sábado y domingo).
- **Editar:** tocar un evento abre su editor.
- **Eliminar:** botón dentro del editor.
- El día del que se parte (el que se miraba al abrir el editor) se llama aquí **la fecha de referencia**: los alcances "este y los siguientes" se calculan a partir de ella.

Las pantallas de edición caben en la navegación de tres lugares propuesta en `00-diagnostico-y-flujo.md` (Hoy, Semana, Ajustes). Esta spec no decide la navegación, solo exige que crear y editar sea posible desde la vista del día y que cualquier fecha sea alcanzable.

### 3.2 Campos del editor de eventos

| Campo | Obligatorio | Reglas |
|---|---|---|
| Nombre | Sí | No vacío después de recortar espacios. Máximo 80 caracteres |
| Categoría | Sí | Se elige de la lista. Incluye "Crear categoría…" sin salir del editor |
| Día | Sí | Fecha. Por defecto, la fecha de referencia |
| Inicio y fin | Sí | Minutos dentro del mismo día. Fin posterior al inicio. Duración mínima 5 minutos. Botones −15 / +15 como hoy |
| Nota | No | Texto libre |
| Repetición | No | Ver 3.3 |
| Metas asociadas | No | Lista de metas existentes. Incluye "Crear meta…" |
| Aviso | No | "Usar el de Ajustes" por defecto. Se puede desactivar o cambiar para este evento |

### 3.3 Repetición

Opciones en la interfaz, con lenguaje de la persona y no del código:

| Opción | Equivale a |
|---|---|
| No se repite | evento de un solo día |
| Todos los días | `weekdays` los 7 días, `everyWeeks 1` |
| Días de la semana… | elegir uno o más días, `everyWeeks 1` |
| Cada N semanas… | elegir días y N (por ejemplo, "martes cada 2 semanas") |

Y un fin: **nunca**, **hasta una fecha**. ("Después de N veces" queda como "Podría".)

- Los textos del tipo "Lun y mié" o "Mar con adscripción" dejan de existir como categorías del sistema. Si Sofía quiere ese nombre lo escribe en el título o en la nota.
- El editor muestra en una línea la regla resultante en lenguaje natural ("Cada 2 semanas, el martes, desde el 03/11"), para que se pueda verificar antes de guardar.

### 3.4 Alcance al editar un evento repetido

Si el evento no se repite, se guarda directo, sin preguntar el alcance.

Si se repite, al guardar aparece una hoja con tres opciones y una explicación de una línea para cada una. **No hay opción por defecto preseleccionada** para evitar el cambio por descuido.

| Opción | Qué hace | Efecto en los datos (spec 010) |
|---|---|---|
| **Solo este día** | Cambia solo la ocurrencia de la fecha de referencia | Crea o actualiza una excepción `modified` para esa fecha |
| **Este día y los siguientes** | Cambia desde la fecha de referencia en adelante. Los días anteriores quedan como estaban | Cierra la serie original con `endDate` el día anterior y crea una serie nueva desde la fecha de referencia con los cambios |
| **Todos los días** | Cambia la serie completa, pasada y futura | Actualiza la serie. Las excepciones de días puntuales se conservan |

Reglas:

- Si se cambió la **regla de repetición** (días, cada N semanas, fin), la opción "Solo este día" **no está disponible**, porque una sola ocurrencia no puede tener su propia regla.
- Si se cambió la **fecha** de la ocurrencia con "Solo este día", la ocurrencia original se cancela ese día y se crea un evento de un día en la fecha nueva.
- Si la fecha de referencia es el primer día de la serie, "Este día y los siguientes" equivale a "Todos los días" y la hoja lo indica en lugar de duplicar la serie.
- Las ocurrencias que ya tienen cambios propios (por ejemplo, un margen aplicado ese día) conservan sus campos. La hoja muestra una línea: "N días tienen cambios propios y los mantienen".
- Los eventos con sesiones registradas se pueden editar. El registro conserva el título, la categoría y el horario que tenían al momento (`title`, `catName`, `planS`, `planE`).

### 3.5 Alcance al eliminar un evento repetido

Mismas tres opciones:

| Opción | Efecto |
|---|---|
| **Solo este día** | Excepción `cancelled` para esa fecha |
| **Este día y los siguientes** | La serie termina el día anterior (`endDate`). Si es el primer día, se elimina la serie |
| **Todos los días** | Se elimina la serie y sus excepciones. Desaparece de la agenda pasada y futura |

Siempre:

- Se pide confirmación mostrando el nombre y cuántos días se verían afectados, cuando se pueda calcular ("Se quitará de 12 días").
- Los eventos que **ya tienen sesiones registradas** muestran una línea extra: "Tiene N sesiones registradas. Seguirán en Datos y en el CSV".
- **El registro de uso nunca se borra** al eliminar un evento, una categoría o una meta.
- No se puede eliminar un evento que tiene una **sesión en curso**. La app avisa "Hay una sesión en curso en este evento. Termínala primero" y no hace nada.

### 3.6 Deshacer

Después de editar o eliminar aparece un aviso con "Deshacer" durante 8 segundos. Deshacer restaura el estado anterior exacto (series, excepciones y avisos). Si el aviso se cierra o se cambia de pantalla, no se puede deshacer. **Debería.**

### 3.7 Superposiciones y límites

- Si el horario se pisa con otro evento ese día, se muestra el aviso con los nombres, y se **deja guardar**.
- El aviso evalúa la fecha de referencia y, para repeticiones, solo las próximas 4 semanas, para que el cálculo sea rápido.
- Un evento no puede cruzar la medianoche (pregunta abierta 1).

## 4. Gestión de categorías

Se administran desde Ajustes → Categorías y también inline desde el editor de eventos.

| Acción | Reglas |
|---|---|
| **Crear** | Nombre (obligatorio, único sin distinguir mayúsculas), color de una paleta cerrada, y tres propiedades con texto claro: "Es fija: nunca se mueve", "Permite empezar y medir", "Evitar para recibir margen" |
| **Editar** | Cualquier campo. Cambiar el nombre actualiza todos los eventos. El registro conserva el nombre anterior (`catName`) |
| **Archivar** | La categoría deja de ofrecerse al crear eventos. Los eventos que ya la usan la conservan |
| **Eliminar** | Solo si **ningún evento** la usa. Si hay eventos, la app pide elegir otra categoría a la que reasignarlos, o archivar |

Cambiar una propiedad (por ejemplo, quitar "Es fija") afecta a todos los eventos de la categoría de inmediato, y lo advierte antes de guardar con la cantidad de eventos afectados.

## 5. Gestión de metas

Pantalla Metas con la lista de metas activas, su progreso y un botón "+ Nueva meta".

### 5.1 Campos del editor de metas

| Campo | Obligatorio | Reglas |
|---|---|---|
| Nombre | Sí | Máximo 60 caracteres, único entre las metas activas |
| Tipo | Sí | Cantidad, tiempo, o cantidad y tiempo |
| Unidad | Si es cantidad | Texto corto ("comentarios", "páginas"). Máximo 20 caracteres |
| Objetivo | No | Número positivo o vacío. Vacío = se cuenta sin objetivo |
| Período | Sí | Por día o por semana |
| Días en que aplica | Sí | Por defecto, los días de los eventos asociados. Se puede cambiar |
| Eventos asociados | No | Uno o más eventos de la agenda. Vacío = meta global |
| Aviso propio | No | Una hora del día. Opcional |

Una meta de tipo **tiempo** necesita al menos un evento asociado, porque mide los minutos de sus sesiones. El editor lo exige.

### 5.2 Editar una meta

Cambiar el nombre, la unidad, los eventos asociados o el aviso se aplica de inmediato y no tiene alcance.

Cambiar el **objetivo**, el **período** o los **días en que aplica** abre una hoja con dos opciones:

| Opción | Efecto |
|---|---|
| **Desde hoy en adelante** (sugerida) | Crea una versión nueva de la meta desde hoy. Los días anteriores se siguen comparando con el objetivo que tenían |
| **Todos los días, incluso los pasados** | Reescribe el objetivo de todo el historial. La hoja avisa que los porcentajes de días pasados van a cambiar |

Las metas usan dos opciones y no tres porque no hay "ocurrencia" de una meta que tenga sentido modificar sola.

### 5.3 Eliminar una meta

| Opción | Efecto |
|---|---|
| **Archivar** (sugerida) | La meta desaparece de Metas y de la agenda desde hoy. El historial y sus conteos se conservan y se pueden ver en Datos |
| **Eliminar definitivamente** | Se quita la definición. Los eventos `count` ya registrados **permanecen** en el CSV con el nombre que tenía la meta (`goalName`) |

Se pide confirmación indicando cuántos conteos y sesiones tiene registrados.

### 5.4 Contadores

- Los botones + y − siguen funcionando como hoy. El conteo no baja de 0.
- **Debería:** dentro del evento en curso, las metas asociadas aparecen con su contador y botón +, sin ir a la pestaña Metas (problema 3 de `00-diagnostico-y-flujo.md`).
- Cada toque se guarda como evento `count` con la hora, asociado a la sesión en curso o, si no hay, al evento que toca.

### 5.5 Progreso

Se calcula según 3.5 de la spec 010: cantidad, tiempo o ambas. El progreso semanal ya no suma categorías fijas (`project`, `health`): cada meta se calcula por su propia definición.

## 6. Efectos secundarios de cualquier cambio

Después de guardar, editar o eliminar (eventos, categorías o metas):

1. Se reprograman los avisos del teléfono (`rescheduleAgenda`).
2. Se actualizan Agenda, Metas y Datos sin necesidad de reabrir la app.
3. Si hay una sesión en curso sobre un evento cuyo horario se editó, la sesión continúa; el horario planificado nuevo se usa para el cálculo de margen y de cierre automático.
4. Si cambió el horario de un evento de hoy que ya pasó, no se programan avisos en el pasado.

Los avisos tienen un tope del sistema (Android ronda las 500 alarmas, iOS 64 pendientes). Con eventos diarios, la ventana de 14 días puede superarlo. Ver pregunta abierta 4.

## 7. Casos límite

### 7.1 Datos
- Dos metas con el mismo nombre: no se permite guardar.
- Una meta asociada a un evento que se elimina: queda asociada a los demás eventos y, si no queda ninguno, pasa a global. Una meta de tiempo sin eventos asociados queda archivada y la app lo informa.
- Una categoría archivada que ya está asignada a un evento: el evento la conserva y la muestra.

### 7.2 Fechas
- Editar un día pasado está permitido. Cambia lo que se muestra en la agenda de ese día, no el registro.
- Un evento que empieza en una fecha futura no aparece antes de su `startDate`.
- Editar con "Este día y los siguientes" desde una fecha futura no toca el pasado ni el presente.

### 7.3 Interfaz
- Todos los controles interactivos miden al menos 48 dp.
- La hoja de alcance es legible con el texto grande del sistema y con lectores de pantalla (cada opción es un control con nombre y descripción).
- Los mensajes de error aparecen junto al campo, en español, y se escriben en claves de texto para poder traducirlos después.

### 7.4 "Restaurar agenda original"
Hoy descarta las ediciones y vuelve a la agenda de Sofía. Con el modelo nuevo ya no hay una "agenda original del código". Pasa a ser dos acciones separadas en Ajustes:
- "Restaurar la plantilla inicial": reaplica la plantilla con la que se empezó. Pide confirmación y muestra qué se reemplaza.
- "Borrar toda la agenda": quita eventos, categorías y metas, pero **no** el registro.

## 8. Criterios de aceptación

Formato dado / cuando / entonces. Cada criterio debe tener una prueba automática sobre funciones puras.

**Crear eventos**
- **CG-01** Dado que estoy mirando un sábado, cuando creo un evento sin repetición de 10:00 a 11:00, entonces aparece ese sábado y no otro día.
- **CG-02** Dado que creo un evento con "Días de la semana: lunes y jueves", cuando miro dos semanas, entonces aparece 4 veces, en los lunes y jueves.
- **CG-03** Dado que creo un evento con "Cada 2 semanas, martes, desde el 03/11", cuando miro el 03/11, el 10/11 y el 17/11, entonces aparece el 03/11 y el 17/11.
- **CG-04** Dado que el fin es anterior o igual al inicio, cuando intento guardar, entonces la app muestra el error junto al campo y no guarda.
- **CG-05** Dado que el evento dura menos de 5 minutos, cuando intento guardar, entonces no guarda.
- **CG-06** Dado que se pisa con otro evento, cuando guardo, entonces aparece el aviso con los nombres y el evento se guarda igual.

**Editar con alcance**
- **CG-07** Dado un evento semanal, cuando lo edito con "Solo este día", entonces ese día muestra el cambio y el resto de los días no.
- **CG-08** Dado un evento semanal que cambié con "Este día y los siguientes" desde el 24/11, entonces el 17/11 tiene los valores originales y el 24/11 en adelante los nuevos.
- **CG-09** Dado un evento semanal, cuando lo edito con "Todos los días", entonces la agenda pasada y la futura muestran el cambio.
- **CG-10** Dado que cambié la regla de repetición, cuando se abre la hoja de alcance, entonces "Solo este día" no está disponible.
- **CG-11** Dado un evento con una excepción de margen el 17/11, cuando edito el título con "Todos los días", entonces el 17/11 muestra el título nuevo y conserva su horario de margen.
- **CG-12** Dado que la fecha de referencia es el primer día de la serie, cuando elijo "Este día y los siguientes", entonces no se crea una serie duplicada.

**Eliminar**
- **CG-13** Dado un evento semanal, cuando lo elimino con "Solo este día", entonces desaparece ese día y vuelve a aparecer la semana siguiente.
- **CG-14** Dado un evento semanal, cuando lo elimino con "Este día y los siguientes", entonces los días anteriores lo conservan.
- **CG-15** Dado un evento con 5 sesiones registradas, cuando lo elimino con "Todos los días", entonces las 5 sesiones siguen en Datos y en el CSV con su título.
- **CG-16** Dado un evento con una sesión en curso, cuando intento eliminarlo, entonces la app me pide terminarla y no elimina nada.
- **CG-17** Dado que acabo de eliminar un evento, cuando toco "Deshacer" dentro de 8 segundos, entonces el evento vuelve con su serie y sus excepciones.

**Categorías**
- **CG-18** Dado que creo la categoría "Lectura" con "Permite empezar y medir", cuando la asigno a un evento, entonces ese evento ofrece Empezar.
- **CG-19** Dado una categoría usada por 3 eventos, cuando intento eliminarla, entonces la app pide reasignarlos o archivar y no elimina.
- **CG-20** Dado una categoría sin eventos, cuando la elimino, entonces desaparece de la lista.
- **CG-21** Dado que cambio el nombre de una categoría, cuando exporto el CSV, entonces las filas anteriores conservan el nombre antiguo.

**Metas**
- **CG-22** Dado que creo una meta de cantidad "Páginas leídas", objetivo 20 por día, cuando sumo 25, entonces el progreso es 25 de 20.
- **CG-23** Dado una meta de tiempo sin eventos asociados, cuando intento guardar, entonces la app lo exige.
- **CG-24** Dado que subo el objetivo de 5 a 10 con "Desde hoy en adelante", cuando miro un día pasado con 6 conteos, entonces sigue contando como cumplido.
- **CG-25** Dado que subo el objetivo con "Todos los días", cuando miro ese día pasado, entonces el progreso se compara con 10 y la hoja había avisado del cambio.
- **CG-26** Dado una meta con conteos registrados, cuando la archivo, entonces desaparece de Metas pero sus conteos siguen en Datos.
- **CG-27** Dado una meta con conteos, cuando la elimino definitivamente, entonces los eventos `count` siguen en el CSV con el nombre que tenía.
- **CG-28** Dado dos metas con el mismo nombre, cuando intento guardar la segunda, entonces no guarda.
- **CG-29** Dado una meta de cantidad y tiempo, cuando termino una sesión con 5 conteos en 18 minutos, entonces la pantalla puede mostrar "5 en 18 min".

**Efectos**
- **CG-30** Dado que cambio el horario de un evento de mañana, cuando guardo, entonces el aviso de mañana se reprograma a la hora nueva y el viejo se cancela.
- **CG-31** Dado que cambio el horario de un evento de hoy que ya pasó, cuando guardo, entonces no se programa ningún aviso en el pasado.
- **CG-32** Dado que migré los datos de la spec 010, cuando abro la agenda de cualquier día con registro, entonces los eventos, horarios y marcas de "hecho" coinciden con los de antes de migrar.

## 9. Fuera de alcance

- Repetición mensual y anual.
- Eventos que cruzan la medianoche (pregunta abierta 1).
- Sincronización con calendarios externos y con la nube.
- Compartir una plantilla con otra persona (solo se pueden aplicar las incluidas en la app).
- Prioridades, fechas límite y tareas sin hora (bandeja).
- IA para crear o reordenar eventos.
- Rediseño de la navegación (Hoy, Semana, Ajustes): se decide aparte.

## 10. Preguntas abiertas

1. **¿Necesitás eventos que crucen la medianoche?** (por ejemplo, una guardia de 23:00 a 01:00). Si sí, cambia el modelo de horarios.
2. **¿"Después de N veces" como fin de repetición?** Está como "Podría". ¿Lo usás?
3. **¿Duplicar evento o día entero?** Está como "Podría". ¿Te ahorra trabajo real al armar la semana?
4. **Tope de avisos.** Con eventos diarios la ventana de 14 días puede pasar el tope de alarmas. Opciones: acortar la ventana según la cantidad de eventos, o priorizar los eventos con "Empecé". Hay que decidir y probar en tu Xiaomi.
5. **¿El deshacer debe durar más de 8 segundos o aceptar varios pasos?** Recomendado 8 segundos y un solo paso.
6. **¿Querés registrar los cambios de agenda en el CSV?** Hoy solo se registra el margen (`margin`). Registrar altas, ediciones y bajas serviría para entender por qué un día cambió, a costa de más filas.
7. **¿Qué pasa con "Solo hoy" y "Siempre" en el vocabulario?** Esta spec los reemplaza por "Solo este día / Este día y los siguientes / Todos los días". Confirmar que el nuevo lenguaje te resulta claro.
