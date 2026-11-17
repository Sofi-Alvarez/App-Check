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
