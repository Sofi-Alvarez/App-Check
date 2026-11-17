# Agenda de búsqueda: cómo instalarla en el Redmi Note 12 Pro

La app ya está escrita. Falta generar el archivo `.apk` y pasarlo al teléfono. Se hace en la nube de Expo, sin instalar Android Studio.

## 1. Generar el APK (una sola vez, unos 15 a 25 minutos)

1. Crea una cuenta gratis en https://expo.dev.
2. Abre una terminal dentro de esta carpeta (`agenda-app`).
3. Inicia sesión:

```bash
npx eas-cli@latest login
```

4. Lanza la compilación:

```bash
npx eas-cli@latest build -p android --profile preview
```

Si pregunta si quieres crear el proyecto en Expo, responde que sí. Cuando termine te da un enlace y un código QR.

## 2. Instalarla en el teléfono

1. Abre el enlace desde el Redmi y descarga el archivo.
2. Si Android lo pide, permite instalar apps desde ese navegador.
3. Instala y abre la app.

## 3. Configurar el teléfono (una sola vez)

1. En la app, pestaña **Ajustes**: permite las notificaciones y activa las alarmas exactas.
2. Toca **Probar aviso en 5 segundos**, bloquea la pantalla y comprueba que suena.
3. Haz los 4 pasos de la tarjeta "Para que no se pierdan en tu Xiaomi" (inicio automático, ahorro de batería sin restricciones, notificaciones en pantalla de bloqueo y candado en Recientes).

## Cómo se programan los avisos

- Al abrir la app se programan los avisos de los próximos 14 días.
- Cada vez que la abres se renueva esa ventana. Si pasas 13 días sin abrirla, un aviso te lo recuerda.
- Si cambias los avisos al empezar o antes de terminar, o silencias un bloque, se reprograman solos.

## Actualizaciones por internet (EAS Update)

Desde la versión 1.1.0 la app recibe cambios sin reinstalar. Para publicar uno:

```bash
npx eas-cli@latest update --channel preview --environment preview --message "descripción del cambio"
```

La app descarga la actualización al abrirse y la usa la siguiente vez que la abres (ciérrala y ábrela una o dos veces). Si el cambio agrega un permiso o una librería nativa, hay que generar un APK nuevo y subir `version` en `app.json`.

## Copia de seguridad (T0.1)

En la pestaña Ajustes hay una tarjeta "Copia de seguridad" con el botón "Exportar copia de seguridad". Guarda **todo** lo de la app (agenda editada, hechos, conteos, registro de sesiones y ajustes), a diferencia del CSV de Datos, que solo tiene el registro de uso.

### Cómo publicarla

```bash
npx eas-cli@latest update --channel preview --environment preview --message "copia de seguridad completa"
```

No necesita APK nuevo: solo cambia código JavaScript. Cierra y abre la app dos veces para que baje la actualización.

### Cómo probar T0.1 en el teléfono

1. Ajustes → "Exportar copia de seguridad". Debe mostrar el menú de compartir de Android.
2. Compártela a tu correo o a Drive. Si la copia es grande se manda en varias partes: guarda todas.
3. El mensaje de abajo debe decir "Copia lista: N claves, X KB". Si dice "incompleta", repite el paso.
4. Abre el archivo recibido: es texto JSON con `"format":"agenda-backup"` al comienzo.
5. Comprueba que la cantidad de claves se parece a lo esperado (un día con registro suma un par de claves: `agenda:day:…` y `agenda:log:…`).

> **Nota (fase 6, T6.2):** desde que se borró el código de la versión vieja, las secciones de migración (T1.7, E2a y E2b) quedan solo como historia: la app ya no lee el formato viejo. Una instalación nueva empieza con la plantilla inicial. Si algún día los datos guardados se dañaran, la app muestra una pantalla para exportar la copia de seguridad y, si quieres, empezar de nuevo con la plantilla.

## Prueba de la migración al formato nuevo (T1.7)

Esta actualización **no cambia tus datos**. Al abrir la app, prueba en memoria si tu agenda se puede pasar al formato nuevo y muestra el resultado en Ajustes.

### Cómo publicarla

```bash
git pull
```

```bash
npm install
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "prueba de migración"
```

Si la terminal es nueva, primero carga tu token con `export EXPO_TOKEN=...`.

### Qué mirar en el teléfono

1. Cierra y abre la app dos veces.
2. Ve a Ajustes. Debajo de "Copia de seguridad" aparece la tarjeta **"Formato nuevo de la agenda (prueba)"**.
3. Si el mensaje está en verde y dice **"Prueba correcta"**, la migración funcionaría con tus datos. Si está en naranja, encontró algo para revisar.
4. Toca **"Compartir informe"** y mándalo (por ejemplo, a tu correo) para pasárselo a Claude. No incluye títulos ni notas de tus tareas.
5. Usa la agenda normalmente: nada de lo que ves debería haber cambiado.

## Fase 2, paso E2a: motor nuevo, todavía con el formato viejo

Esta actualización no migra tus datos. La app sigue usando el formato actual, pero por dentro ya pasa por el "motor" nuevo. También cambian los avisos y el CSV (dos columnas nuevas al final), y en Ajustes aparece la cantidad de avisos programados.

### Cómo publicarla

```bash
git pull
```

```bash
npm install
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "fase 2: motor de agenda"
```

### Qué revisar en el teléfono

1. Cierra y abre la app dos veces.
2. **Agenda:** mira hoy, mañana y un martes de cada tipo. Todo tiene que verse igual que antes.
3. **Metas:** los números tienen que ser los mismos. La única diferencia esperada: la tarjeta dice "Posts" en vez de "Post publicado".
4. **Ajustes → Permisos:** anota el número de **"Avisos programados (próximos 14 días)"**.
5. **Prueba del tope de avisos (T2.6):** deja el teléfono bloqueado y fíjate si suenan los avisos de las próximas horas (inicio y "quedan 5 min").
6. Pásale a Claude el número de avisos programados y si sonaron.

## Fase 2, paso E2b: migración real al formato nuevo

Esta actualización **sí cambia cómo se guardan tus datos**. Antes de publicarla tiene que haber una copia de seguridad guardada en Drive (la del 17/11 a las 17:55 ya está validada).

### Cómo publicarla

```bash
git pull
```

```bash
npm install
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "fase 2: migración al formato nuevo"
```

### Qué revisar en el teléfono

1. Cierra y abre la app dos veces.
2. **Ajustes:** la tarjeta "Formato nuevo de la agenda" tiene que decir en verde **"Tu agenda se pasó al formato nuevo"**. Si dice otra cosa (naranja), no toques nada y comparte el informe.
3. **Ajustes → Permisos:** "Último reprogramado" tiene que decir alrededor de **222 de 223 avisos, sin errores**.
4. **Agenda:** revisa tres días con registro (por ejemplo, un lunes, un martes y un jueves de las últimas dos semanas): mismas tareas, mismos horarios y mismas marcas de hecho que antes.
5. **Metas** y **Datos:** mismos números y mismas sesiones.
6. Usa la app normalmente un día: empezar, terminar, un conteo y, si se da, un margen.

## Fase 3: crear, editar y eliminar eventos

### Cómo publicarla

```bash
git pull
```

```bash
npm install
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "fase 3: gestión de eventos"
```

### Qué probar en el teléfono

1. **Semana de 7 días:** en Agenda aparecen también sábado y domingo.
2. **Crear un evento de sábado** sin repetición ("+ Nuevo evento"). Tiene que aparecer solo ese sábado.
3. **Crear uno "Cada N semanas"** (por ejemplo, martes cada 2 semanas) y mirar los tres martes siguientes.
4. **Editar** un evento que se repite y probar los tres alcances: "Solo hoy", "A partir de hoy" y "Siempre". Mirar tres semanas.
5. **Cambiar la repetición** al editar: la hoja no tiene que ofrecer "Solo hoy".
6. **Eliminar** con cada alcance y comprobar en Datos que las sesiones siguen ahí.
7. **Intentar eliminar** un evento con una sesión en curso: no tiene que dejar.
8. **Deshacer:** después de guardar o eliminar, tocar "Deshacer" en la barra de abajo antes de 8 segundos.
9. Si un aviso de un evento nuevo tiene que sonar hoy, comprobar que suene.

## Fase 4: categorías

### Cómo publicarla

```bash
git pull
```

```bash
npm install
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "fase 4: categorías"
```

### Qué probar en el teléfono

1. **Ajustes → Categorías → "Administrar categorías".** Tiene que aparecer la lista con cuántos eventos usan cada una.
2. **Renombrar** una categoría y comprobar en Agenda que sus eventos siguen con ella (con el nombre nuevo en el editor).
3. **Crear "Lectura"** con "Permite empezar y medir", asignarla a un evento de hoy y comprobar que ofrece "Empezar" y que su aviso trae "Empecé".
4. **Cambiar "Es fija"** en una categoría con eventos: tiene que pedir confirmación diciendo cuántos eventos afecta.
5. **Intentar eliminar** una categoría en uso: tiene que pedir a cuál pasar sus eventos (o archivarla).
6. **Archivar** una categoría: deja de aparecer para elegir en el editor, y sus eventos la conservan.

## Fase 5: metas

### Cómo publicarla

```bash
git pull
```

```bash
npm install
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "fase 5: metas"
```

### Qué probar en el teléfono

1. **Metas → "Tus metas":** aparecen tus metas con un resumen (qué mide, objetivo, días).
2. **"+ Nueva meta":** crear "Páginas leídas", unidad "páginas", objetivo 20 por día. Tiene que aparecer como contador los días en que aplica.
3. **Meta de tiempo** sin eventos asociados: no tiene que dejar guardar. Con un evento asociado, sí.
4. **Subir el objetivo** de una meta: tiene que preguntar "A partir de hoy" o "Siempre". Con "A partir de hoy", los días anteriores conservan el objetivo viejo.
5. **Asociar una meta a un evento** y, durante ese evento, sumar desde la tarjeta "Ahora" o "En curso" de Agenda.
6. **Archivar** una meta (deja de verse) y **eliminar** otra (pide confirmación).
7. **Datos:** los conteos de cada sesión se ven con el nombre de la meta.
8. **Aviso propio** de una meta a una hora cercana: tiene que sonar.

## Fase 6: publicación (T6.5) y pasada final (T6.6)

**T6.5:** la fase 6 se publicó el 17/11 como actualización por internet sobre la versión 1.1.0. No hizo falta un APK nuevo porque no se sumaron librerías con código nativo.

**T6.6: pasada final en el teléfono.** Lleva unos 30 minutos. Usa eventos, categorías y metas de prueba (con "Prueba" en el nombre) y bórralos al final; así tu rutina no cambia. Antes de empezar, exporta una copia de seguridad a Drive.

Anota solo lo que **no** salga como dice cada paso (el número del paso y qué pasó).

### A. Crear (sábado 21/11)
1. "+ Nuevo evento" → "Prueba 1", de 10:00 a 11:00, sin repetición. Aparece el sábado 21 y no el 28 (CG-01).
2. Pon el fin antes del inicio: aparece el error junto al campo y no guarda (CG-04). Con 10:00 a 10:03 tampoco guarda (CG-05).
3. Crea "Prueba 1b" de 10:30 a 11:30 el mismo sábado: avisa que se superpone con "Prueba 1" y guarda igual (CG-06).

### B. Repetir
4. "Prueba 2", días de la semana lunes y jueves. Aparece el 23/11, 26/11, 30/11 y 3/12 (CG-02).
5. "Prueba 3", cada 2 semanas, martes, creada desde el martes 24/11. Aparece el 24/11 y el 8/12, pero no el 1/12 (CG-03).

### C. Editar "Prueba 2"
6. Desde el lunes 23/11, cambia el nombre con **"Solo …"**: el 26/11 sigue con el nombre viejo (CG-07).
7. Desde el lunes 30/11, cambia el horario con **"A partir del 30/11"**: el 26/11 conserva el horario viejo y del 30/11 en adelante está el nuevo (CG-08).
8. Cambia la nota con **"Siempre"**: se ve en el 23/11 y en el 3/12 (CG-09).
9. Cambia la repetición (por ejemplo, agrega el viernes) y toca Guardar: la hoja no ofrece "Solo …" y explica por qué (CG-10). Puedes cancelar.

### D. Eliminar y deshacer
10. El 30/11, elimina "Prueba 2" con **"Solo …"**: desaparece ese día y sigue el 3/12 (CG-13).
11. Elimínala del 3/12 con **"A partir del 3/12"**: el 30/11 y los días anteriores la conservan (CG-14).
12. Elimina "Prueba 1" y toca **"Deshacer"** antes de 8 segundos: vuelve (CG-17).
13. Empieza una sesión en un evento de hoy y trata de eliminarlo: pide terminar la sesión primero y no borra nada (CG-16). No lo elimines; termina la sesión normalmente.

### E. Categorías (Ajustes → Administrar categorías)
14. Crea "Prueba Lectura" con "Permite empezar y medir". Crea un evento de hoy con esa categoría, que empiece en unos 10 minutos. En Agenda tiene "Empezar" y su aviso trae el botón "Empecé" (CG-18, CA-02). Toca "Empecé" y, después de un par de minutos, "Terminar".
15. Trata de eliminar una categoría con eventos (por ejemplo "Inglés"): pide pasar los eventos a otra o archivarla, y no elimina. Cancela (CG-19).
16. Cambia el nombre de "Prueba Lectura" a "Prueba Libros". Elimina el evento del paso 14 y después la categoría: desaparece de la lista (CG-20).

### F. Metas (pestaña Metas)
17. "+ Nueva meta" → "Prueba páginas", cantidad, unidad "páginas", objetivo 20 por día. En Agenda o en Metas, suma hasta 25: muestra 25 de 20 (CG-22).
18. Crea otra meta llamada igual: no guarda (CG-28).
19. Una meta de tiempo sin eventos asociados: no guarda y explica por qué (CG-23).
20. Archiva "Prueba páginas": desaparece de las tarjetas de hoy (CG-26). Después elimínala.

### G. Avisos
21. Crea "Prueba aviso" para hoy, dentro de 10 minutos. Antes de que suene, muévelo 5 minutos más tarde. Tiene que sonar solo a la hora nueva (CG-30).
22. Cambia el horario de un evento de hoy que ya pasó: no tiene que sonar ningún aviso por ese cambio (CG-31).
23. Ajustes → Permisos: "Avisos programados" muestra un número parecido al de antes (unos 219).

### H. Datos y CSV
24. Datos → "Exportar todos los datos (CSV)". Busca:
    - la sesión del paso 14, con la categoría **"Prueba Lectura"**, el nombre que tenía en ese momento (CG-21, CA-17);
    - los conteos de "Prueba páginas", aunque la meta ya esté eliminada (CG-27).

### I. Limpieza
25. Elimina con "Siempre" lo que quede de las pruebas: "Prueba 1", "Prueba 1b", "Prueba 3", "Prueba aviso" y el resto de "Prueba 2". Tu rutina tiene que verse como antes.

**No hace falta probar en el teléfono:**
- El resto de los criterios ya lo cubren las 220 pruebas automáticas: reglas del modelo CA-01 a CA-15, margen CA-03/CA-04, CG-11, CG-12, CG-24, CG-25 y CG-29.
- Los de migración (CA-16, CA-18, CA-19 y CG-32) se verificaron en tu teléfono en la fase 2. Ese código ya no existe.
- "Restaurar la plantilla inicial" y "Borrar toda la agenda" cambian tu agenda real. Están cubiertos por pruebas automáticas y tienen "Deshacer", pero no hace falta tocarlos.

## Repetición mensual

Se publica igual que siempre, sin APK nuevo:

```bash
git pull
```

```bash
npx eas-cli@latest update --channel preview --environment preview --message "repetición mensual"
```

### Qué probar en el teléfono
1. "+ Nuevo evento" un martes 17 → Repetición → **"Cada mes"**. Aparecen "El día 17" y "El tercer martes". Elige una; la descripción de abajo lo dice en palabras.
2. Guarda y mira el mes siguiente: aparece el día que corresponde (el 17/12 o el martes 15/12).
3. Con "+", prueba "Cada 2 meses": el mes siguiente no aparece y el otro sí.
4. Un evento "el día 31": en febrero aparece el 28.
5. Edita el evento mensual: pregunta "Solo …", "A partir de…" o "Siempre", como los semanales.
6. Si estás mirando un día de la última semana del mes, aparece también "El último …" (por ejemplo, "El último viernes").
