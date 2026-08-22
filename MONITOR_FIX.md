# 🔧 FIX para Deploy Monitor

## Problema
El workflow `deploy-monitor.yml` está fallando porque `configure-pages` requiere permisos de administrador.

## Solución
Reemplaza el contenido de `.github/workflows/deploy-monitor.yml` con:

```yaml
name: Deploy Monitor (GitHub Pages)

on:
  push:
    paths: ['glopsy/back/monitor/**']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: glopsy/back/monitor
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Cambios:
- ❌ Remover: `configure-pages` (requiere admin)
- ✅ Mantener: `upload-pages-artifact` + `deploy-pages`
- ✅ Resultado: Deploy directo sin necesidad de admin

## Próximos pasos:
1. Edita `.github/workflows/deploy-monitor.yml` en GitHub
2. Reemplaza el contenido con el YAML arriba
3. Guarda los cambios
4. Haz un push a cualquier archivo en `glopsy/back/monitor/`
5. El deploy debe funcionar ✅
