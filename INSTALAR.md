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
