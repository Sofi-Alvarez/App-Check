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
