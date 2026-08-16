# 📱 Pass · Bóveda segura (React Native / Expo)

Versión móvil del gestor de contraseñas **Pass** (original en `htdocs/Pass`),
reescrita como app React Native con **Expo SDK 54** y TypeScript.

## Diferencia clave con la versión web

- **Almacenamiento**: la base de datos vive en un archivo `pass-database.json`
  dentro de los documentos de la app (`documentDirectory/pass/`). Desde
  **Ajustes → Base de datos (JSON)** puedes *Guardar* (compartir el archivo
  cifrado) o *Restablecer* (importar uno desde Descargas/archivos).
- **Cifrado idéntico**: PBKDF2 (SHA-256) + AES-256-GCM y el mismo
  base64 → **puedes importar tu `pass-database.json` actual de la web sin
  problemas** (mismo PIN). Las cuentas antiguas (PBKDF2 200k) se siguen
  desbloqueando y se **migran automáticamente** al primer inicio de sesión.
- **Endurecimiento**: la bóveda se cifra con una **master key aleatoria de
  256 bits** envuelta por la clave del PIN, derivada con **Argon2id** (64 MiB,
  t=3) en builds nativos (requiere `prebuild`/dev build). En Expo Go/web, sin
  el módulo nativo, se usa PBKDF2 600k como respaldo. El cambio de PIN solo
  re-envuelve la master key.
- **Sesión**: la clave descifrada se guarda en el **Keystore del dispositivo**
  (`expo-secure-store`), así al abrir la app se desbloquea al instante. La
  derivación (Argon2id/PBKDF2) solo ocurre la primera vez o tras cerrar sesión, y
  corre de forma asíncrona para no congelar la interfaz.
- Sin servidor: todo el cifrado ocurre en el dispositivo.
- **Anti-root / anti-overlay / anti-captura**: en builds nativos, la app
  detecta root (`PassSecurity.isDeviceRooted`) y superposiciones de terceros
  (`PassSecurity.isOverlayDanger`); si hay root o un overlay activo, la app
  se bloquea. Además se aplica `FLAG_SECURE` para impedir capturas, grabación
  de pantalla y vista previa en el recents.

## Funcionalidades portadas

- Registro / inicio de sesión con **PIN** y teclado numérico (6 dígitos al
  crear cuenta, se respeta la longitud del PIN existente).
- Bloqueo por 5 intentos fallidos con espera creciente (30s, 1m, 2m…).
- Añadir / editar / eliminar / **buscar** (nombre, usuario, URL, notas…).
- Tipos: **Contraseña**, **Semilla cripto**, **Tarjeta** y **Nota**; 7 categorías
  con iconos y colores.
- Generador de contraseñas seguras.
- Detalle con datos **enmascarados** (mostrar/ocultar, copiar).
- Cambiar PIN, guardar/restablecer base de datos JSON, exportar bóveda en claro,
  cerrar sesión, borrar cuenta.
- **Desbloqueo con huella** (`expo-local-authentication`): si se activa en
  Ajustes → Seguridad, al abrir la app pide tu huella en vez de auto-entrar
  (el PIN sigue disponible como respaldo).
- **Modo día/noche** (recordado), navegación inferior con botón central `+`,
  skeletons y diseño app móvil.

## Estructura

```
pass-app/
├── App.tsx                     # Proveedores + arranque
├── app.json
└── src/
    ├── types.ts                # Tipos de datos (Vault, User, Database…)
    ├── theme.ts                # Paletas claro/oscuro
    ├── lib/
    │   ├── crypto.ts           # PBKDF2 + AES-GCM + base64 (compatible web)
    │   ├── vault.ts            # Modelo, CRUD, búsqueda, sanitize
    │   ├── store.ts            # Lectura/escritura pass-database.json
    │   ├── persist.ts          # Tema, último usuario, bloqueo (AsyncStorage)
    │   └── export.ts           # Compartir JSON
    ├── context/
    │   ├── AuthContext.tsx     # Estado global (usuario, clave, bóveda)
    │   ├── ThemeContext.tsx
    │   └── ToastContext.tsx
    ├── components/             # Keypad, PinDots, ItemRow, ui, tab bar…
    ├── screens/                # Login, Registro, Inicio, Caja, Ajustes,
    │                           # Añadir/Editar, Detalle, Cambiar PIN
    └── navigation/
        ├── RootNavigator.tsx   # Auth flow + tabs + modales
        └── types.ts
```

## Ejecutar

```bash
cd pass-app
npm install
npm run android   # (o npx expo start y escanea el QR con Expo Go)
```

La app funciona 100 % en **Expo Go** (todas las dependencias nativas usadas
están incluidas). Para publicar:

```bash
# APK de pruebas (distribución interna)
npx eas-cli build -p android --profile preview

# AAB de producción para Play Store (firma gestionada por EAS)
npx eas-cli build -p android --profile production

# Subir a Play Store
npx eas-cli submit -p android --profile production
```

> Nota: la compilación nativa local (`npx expo run:android`) requiere binarios
> del Android SDK que Google solo publica para x86-64; en dispositivos ARM64
> usa **EAS Build en la nube**.

## Seguridad

- Los datos se cifran en el dispositivo con AES-256-GCM (clave PBKDF2 del PIN);
  el archivo `pass-database.json` solo contiene texto cifrado.
- Cada guardado usa un IV nuevo (cifrado no determinista).
- El PIN ofrece ~1.000.000 combinaciones (6 dígitos al crear cuenta); es
  cómodo pero débil frente a ataque offline del archivo. Copia tu
  `pass-database.json` como respaldo.
