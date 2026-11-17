# De prototipo personal a producto real: modelo de partida

Fecha: 09/11/2026. Documento de trabajo para Sofía. Está pensado para usarse con desarrollo guiado por especificaciones: cada sección termina en algo que se puede convertir en una spec.

## 1. Diagnóstico honesto: qué es hoy esta app

**Qué hay.** Una app Expo / React Native de unas 2.450 líneas de TypeScript, instalada por APK directo en un solo teléfono (Redmi Note 12 Pro), con un solo usuario: tú.

**Qué la hace valiosa, aunque nació sin especificar.** Hay tres ideas de producto que ya funcionan y que conviene tratar como el núcleo:

1. **Bloques de tiempo con metas medibles de dos tipos** (por tiempo y por cantidad), no solo una agenda.
2. **Registro de uso con un solo toque**, en una lista de eventos con hora (append-only), de la que se calcula todo después.
3. **Margen de tiempo**: lo que sobra o falta al terminar una tarea se reparte, sin mover lo fijo.

**Qué la limita para otras personas.** Lo que sigue no es una crítica al código sino lo que cambia de un prototipo a un producto:

| Área | Hoy | Por qué no escala |
|---|---|---|
| Contenido | La agenda de búsqueda de empleo está escrita en el código (tipos de día `mwf`, `tueAds`, notas con "/jobs", "Tracker", LinkedIn, el martes de adscripción cada 14 días) | Es tu vida, no una plantilla. Otra persona no puede tener otra rutina |
| Datos | Un almacén clave-valor local con JSON | Sin consultas, sin respaldo, se pierde al desinstalar, sin cuenta |
| Avisos | Notificaciones locales en una ventana móvil de 14 días | Android tiene un tope cercano a 500 alarmas, iOS permite solo 64 pendientes, y Xiaomi mata la app en segundo plano |
| Distribución | APK directo | No hay ficha de tienda, ni revisión, ni actualización para extraños |
| Calidad | Sin pruebas automáticas, sin CI, sin monitoreo de errores | No sabrías que se rompió algo en el teléfono de otra persona |
| Privacidad | Guarda datos de comportamiento sin consentimiento ni política | Con terceros es obligatorio resolverlo |
| Idioma | Textos en español incrustados | No se puede traducir |
| Validación | Un usuario, una semana de prueba | No sabes si el problema existe fuera de ti |

Conclusión: el orden correcto es **validar el problema antes de construir la escala**. Lo técnico es resoluble; lo caro es construir para un usuario que no existe.

## 2. Modelo de producto (para especificar)

### 2.1 Problema y usuario, como hipótesis

- **Problema (hipótesis):** quien busca empleo, o trabaja en proyectos propios, sin jefe ni horario, planifica la semana pero no sabe cuánto tarda de verdad en cada cosa ni si cumple sus cuotas. Abandona porque medir cuesta esfuerzo.
- **Usuario inicial (hipótesis):** personas en búsqueda activa de empleo en diseño y tecnología. Es el que mejor conoces, tienes acceso a él y ya tienes contenido para él.
- **Trabajo a resolver:** "Quiero estructurar mi día de búsqueda, cumplir mis cuotas y saber qué ajustar la semana próxima, sin que registrar me quite tiempo".

### 2.2 Posicionamiento: vertical u horizontal

- **A. Vertical:** "agenda de búsqueda de empleo". Plantillas de semana, cuotas de contactos y postulaciones, conexión con el seguimiento.
- **B. Horizontal:** "bloques de tiempo con metas medibles" para cualquier rutina.

**Recomendación: empezar por A y construir el motor de forma que B quede posible.** Razón: A tiene un usuario concreto, un lenguaje concreto y un canal de prueba (tu red). B compite con productos de planificación grandes sin diferencial claro todavía. Esto es una recomendación, no un hecho: se decide en la fase 0.

### 2.3 Hipótesis a probar (con tus datos y con otras personas)

| # | Hipótesis | Cómo se prueba | Señal de éxito |
|---|---|---|---|
| H1 | Con un toque por tarea la gente sí registra | Tu CSV: porcentaje de bloques con sesión | Más de 70 % de los bloques de trabajo |
| H2 | Medir por tiempo y por cantidad aporta algo que una lista no | Si cambiaste decisiones por los datos | Al menos 2 ajustes concretos a tu semana |
| H3 | El margen se usa | Eventos `margin`: aceptados contra "dejar como está" | Más de 50 % aceptados |
| H4 | El botón del aviso baja el costo de registrar | Proporción de sesiones iniciadas desde el aviso | Más de 30 % |
| H5 | Los avisos son fiables en Android de distintas marcas | Pruebas en 3 o más marcas | Menos de 5 % de avisos perdidos |
| H6 | Otras personas en búsqueda quieren esto | 5 a 8 entrevistas y prueba con 3 a 5 personas | Lo usan solos al segundo día |

### 2.4 Principios del producto (la "constitución" para tus specs)

1. Registrar cuesta un toque o menos.
2. Los datos son de la persona: exportables y borrables en cualquier momento.
3. Local primero: funciona sin internet; la nube sincroniza, no manda.
4. Ningún dato automático se mezcla con uno confirmado por la persona.
5. Los bloques fijos nunca se mueven solos.
6. Cada aviso se puede silenciar.
7. Accesible desde el inicio (zonas táctiles de 48 dp o más, contraste, tamaño de texto del sistema).
8. Español primero, con textos preparados para traducir.

Los principios 1, 4 y 5 ya los cumple la app. Los demás hay que construirlos.

### 2.5 Métricas

- **Activación:** completó la configuración inicial y empezó su primera sesión en 24 horas.
- **Métrica central:** personas con sesiones registradas en 3 o más días de la semana.
- **Retención:** sigue activa a los 7 y a los 28 días.
- **Calidad del dato:** porcentaje de bloques con sesión real (no cerrada sola).
- **Efectividad de los avisos:** de los avisos de inicio, cuántos terminan en "Empecé".
- **Cumplimiento:** metas alcanzadas sobre metas planificadas.

Casi todas se pueden calcular con la lista de eventos que ya existe; solo falta anonimizarla y enviarla con consentimiento.

## 3. Del código a la spec: especificación inversa

La app se construyó sin especificar. El primer trabajo de producto es **escribir las specs de lo que ya hace**, para decidir qué se conserva, qué se corrige y qué se descarta. Estructura sugerida:

```
docs/
  constitucion.md            principios (sección 2.4)
  specs/
    001-agenda-del-dia.md    vista del día, bloque actual, tipos de bloque
    002-sesiones-y-registro.md   empezar, pausar, terminar, cierre automático
    003-metas-y-conteos.md   metas por tiempo y por cantidad
    004-edicion-de-tareas.md solo hoy / siempre, superposiciones, restaurar
    005-margen-de-tiempo.md  reglas del traspaso
    006-avisos.md            inicio, pre-fin, botón Empecé, permisos
    007-exportacion-y-datos.md  CSV, borrado, privacidad
    008-onboarding-y-plantillas.md   NUEVA: crear una semana desde cero
  plan.md                    arquitectura objetivo (sección 4)
  tareas.md                  trabajo derivado, ordenado por fase
```

Cada spec con: contexto, historias, criterios de aceptación en formato dado / cuando / entonces, casos límite y fuera de alcance. Ejemplo de cómo se vería la 005, con lo que ya quedó decidido:

> **Dado** que terminé una tarea flexible y la diferencia con su hora de fin es de 5 minutos o más,
> **cuando** la sesión se cierra por "Terminar" o por empezar otra tarea,
> **entonces** la app me pregunta a qué tarea posterior del mismo día pasan o de cuál se descuentan los minutos.
> **Y** las tareas del medio se corren esos minutos y la elegida absorbe el cambio sin mover su hora de fin.
> **Y** no se puede cruzar un bloque fijo, ni dejar una tarea en menos de 5 minutos.
> **Y** cualquier decisión, incluida "dejar como está", se registra.

Beneficio extra: cada criterio de aceptación se convierte en una prueba automática. Hoy la lógica del margen y de la edición se probó con scripts sueltos; en un producto esas pruebas viven en el repositorio.

## 4. Arquitectura objetivo

### 4.1 Separar motor y contenido

- **Motor** (igual para todos): bloques, recurrencias, sesiones, metas, margen, avisos, registro.
- **Contenido** (cambia por persona): la agenda, las metas, las notas, las categorías.
- **Plantillas:** la semana de búsqueda de empleo pasa a ser la primera plantilla ("Búsqueda de empleo, 5 días"), no código.

### 4.2 Modelo de datos generalizado

- **Usuario** y **Dispositivo**.
- **Plantilla de semana:** nombre, idioma, autor.
- **Bloque de rutina:** título, categoría, inicio, fin, nota, si es fijo o flexible, regla de recurrencia, meta asociada.
- **Regla de recurrencia:** días de la semana, intervalo (cada N semanas) y fecha ancla. Esto reemplaza al "martes con adscripción cada 14 días" escrito a mano y a los tipos de día `mwf`, `thu`, `fri`.
- **Meta:** tipo (`tiempo`, `cantidad` o ambas), objetivo, unidad, período (día o semana) y alcance (un bloque o global).
- **Día materializado:** los bloques de una fecha, con ediciones "solo hoy" y traspasos de margen.
- **Sesión** y **Evento** (lista append-only): ya existen y son la base correcta; solo hay que pasarlos a tablas.
- **Preferencias de aviso.**

### 4.3 Capas técnicas

| Capa | Hoy | Objetivo | Nota |
|---|---|---|---|
| App | Expo / React Native | Mantener | Cubre Android e iOS y las actualizaciones por internet |
| Datos locales | SQLite clave-valor | SQLite relacional con migraciones | Prerrequisito de todo lo demás |
| Cuenta y nube | Ninguna | Autenticación + base en la nube + sincronización | Opciones a evaluar: Supabase, Firebase, o un motor de sincronización local-first |
| Avisos | Locales, ventana de 14 días | Locales para el día + push desde servidor como respaldo | Resuelve los topes de alarmas y parte del problema de Xiaomi |
| Calidad | Typecheck y lint | + pruebas automáticas + CI + monitoreo de errores | Sin esto no hay forma de saber si una versión rompió algo |
| Métricas | Ninguna | Eventos de producto con consentimiento | Reutilizar la lista de eventos |
| Textos | Incrustados | Archivos de idioma | Español primero, inglés después |

### 4.4 Decisiones que no se pueden tomar desde aquí

- **Avisos exactos en Google Play.** La app declara el permiso de alarma exacta; Play lo restringe a apps cuya función principal es alarma, temporizador o calendario. Hay que revisar si una agenda con avisos califica o si se necesita otro enfoque. Verificar la política vigente antes de publicar.
- **Tienda.** Pasar de APK a Google Play requiere cuenta de desarrollador, ficha, política de privacidad, formulario de seguridad de datos y, para cuentas personales nuevas, un período de prueba cerrada con un mínimo de testers. Los requisitos cambian; confirmarlos en la consola de Play.
- **iOS.** Mismo código, pero con otras reglas de avisos (tope de 64 pendientes) y costo anual de cuenta.
- **Privacidad y ley.** Se guardan datos de comportamiento de personas. Hace falta consentimiento claro, política de privacidad, exportación y borrado. Consultar los requisitos legales de los países donde se publique (en Argentina, la ley de protección de datos personales; en Europa, el RGPD).

## 5. Fases y criterios de salida

**Fase 0. Validar (ahora → 2 semanas)**
- Terminar tu semana de prueba y analizar el CSV.
- Responder H1 a H4 con tus datos.
- Entrevistar a 5 a 8 personas en búsqueda activa; decidir vertical u horizontal.
- *Salida:* una página con el problema, el usuario y las hipótesis confirmadas, descartadas o abiertas.

**Fase 1. Especificar (2 semanas)**
- Escribir la constitución y las specs 001 a 007 de lo que ya existe, y la 008 nueva.
- Marcar qué se conserva, corrige o descarta.
- *Salida:* specs aprobadas por ti, con criterios de aceptación.

**Fase 2. Cimientos (3 a 4 semanas)**
- Pasar el almacenamiento a tablas con migraciones.
- Convertir la agenda en plantilla y las recurrencias en reglas.
- Pruebas automáticas desde los criterios de aceptación, integración continua y monitoreo de errores.
- Textos en archivos de idioma.
- *Salida:* la app hace lo mismo que hoy, pero cualquiera puede tener otra agenda.

**Fase 3. Primeras personas (3 semanas)**
- Pantalla de bienvenida: elegir plantilla, ajustar horarios, permisos y configuración de Xiaomi.
- Consentimiento de datos, exportación y borrado.
- Prueba con 5 a 10 personas, en 3 o más marcas de teléfono.
- *Salida:* H5 y H6 respondidas.

**Fase 4. Cuentas y nube (4 a 6 semanas)**
- Registro, sincronización y respaldo.
- Avisos con respaldo desde servidor.
- *Salida:* cambias de teléfono y no pierdes nada.

**Fase 5. Publicar y medir**
- Prueba cerrada en Google Play, luego abierta; decisión sobre iOS.
- Panel de métricas de la sección 2.5.
- *Salida:* retención a 7 y 28 días medida con personas reales.

Los plazos son estimaciones gruesas para una sola persona con asistencia de IA; sirven para ordenar, no para comprometer fechas.

## 6. Riesgos principales

1. **Construir antes de validar.** Mitigación: la fase 0 es obligatoria y tiene criterio de salida.
2. **Los avisos son el producto y son frágiles.** Cada marca de teléfono los trata distinto. Mitigación: probar en varias marcas pronto y tener respaldo desde servidor.
3. **Registrar cansa.** Si H1 falla, ninguna escala lo arregla. Mitigación: el botón del aviso, el cierre automático y reducir toques.
4. **Datos personales sin marco legal.** Mitigación: constitución, consentimiento y borrado desde la fase 3.
5. **Código generado sin especificar.** Hoy sin pruebas, un cambio puede romper algo sin que se note. Mitigación: fase 1 y pruebas en la fase 2.
6. **Competencia no investigada.** No se revisó el mercado de planificadores y rastreadores de hábitos para este documento. Es una tarea de la fase 0.

## 7. Lo que sigue

1. Terminar la semana de prueba y pasarme el CSV.
2. Decidir vertical u horizontal (recomendado: vertical, sección 2.2).
3. Empezar la especificación inversa: escribir la constitución y las specs de lo que ya existe, a partir del código y de las decisiones del 03/11.
