# glopsy Monitor

Panel de monitoreo en tiempo real del repo, CI y servidor de glopsy.
Estático (un solo HTML), sin build, responsive para móvil, hosteado **fuera del servidor**.

## Qué muestra

- **Repositorio**: últimos commits (mensaje, autor, hash, hace cuánto).
- **CI / Workflows**: estado de los últimos runs de GitHub Actions (verde/rojo/amarillo).
- **Servidor**: salud de la API, PostgreSQL, Redis y uptime, vía `GET /api/health`.

GitHub API se consulta cada 5 min (límite 60 req/h sin token). La salud del servidor cada 20 s.

## Configuración

Por defecto consulta `alvijosei20-cpu/glopsy-` y `https://api.tu-dominio.com`.
Se puede sobreescribir con query params, sin editar el archivo:

```
?repo=alvijosei20-cpu/glopsy-&api=https://api.tu-dominio.com
```

## Requisitos en el back

El endpoint `/api/health` ya existe en glopsy. Para que el navegador pueda consultarlo
desde el panel, agregar el origen del panel en el servidor:

```
DASHBOARD_ORIGIN=https://alvijosei20-cpu.github.io
```

(en `docker-compose.yml` via `.env`, o en el `.env` del back).

## Despliegue

### GitHub Pages (automático)

Ya hay un workflow (`deploy-monitor.yml`) que publica la carpeta `monitor/` al hacer
push de cambios en ella. Solo:

1. En el repo en GitHub: **Settings → Pages → Source: "GitHub Actions"**.
2. Push de `monitor/index.html`. El panel queda en:
   `https://alvijosei20-cpu.github.io/glopsy-/monitor/`

### Vercel (alternativa)

```sh
cd monitor
npx vercel
```

### UptimeRobot (alertas al móvil)

1. Crea cuenta en uptimerobot.com → Add New Monitor → **HTTP(s)**.
2. URL: `https://api.tu-dominio.com/api/health` — intervalo 5 min.
3. Alert Contacts: agrega Telegram/WhatsApp/email y elige quién notifica.
